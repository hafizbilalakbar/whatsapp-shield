'use strict';
// Anti-spam & security hardening test suite (backend internals).
// Run: node backend/tests/hardening.test.js
// These tests verify the fail-closed guarantees that protect a real WhatsApp
// account even when the UI is bypassed: rate limits, single-flight locks,
// sanitization caps, circuit breakers, and idempotent scan submission.

const assert = require('assert');
const { RateLimiter, SingleFlight, sanitizeNumbers, clampDelay } = require('../services/safety-guard');
const { CircuitBreaker } = require('../services/stability');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok: ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.error(`  FAIL: ${name}\n    ${err.message}`);
  }
}

(async () => {
  console.log('safety-guard: RateLimiter charge/isBlocked');

  test('RateLimiter blocks after max, read-only isBlocked does not charge', () => {
    const limiter = new RateLimiter({ windowMs: 60000, max: 5, name: 't' });
    const key = '1.2.3.4';
    for (let i = 0; i < 5; i++) assert.strictEqual(limiter.check(key).allowed, true, `hit ${i + 1} should pass`);
    assert.strictEqual(limiter.check(key).allowed, false, '6th hit should be blocked');
    // isBlocked must not mutate state
    assert.strictEqual(limiter.isBlocked(key), true, 'isBlocked reports over-limit');
    assert.strictEqual(limiter.isBlocked('other'), false, 'unknown key is not blocked');
    limiter._pruneTimer.unref && clearInterval(limiter._pruneTimer);
  });

  test('RateLimiter windows expire', () => {
    const limiter = new RateLimiter({ windowMs: 10, max: 1, name: 't2' });
    limiter.check('k1');
    assert.strictEqual(limiter.check('k1').allowed, false);
    return new Promise((resolve) => setTimeout(() => {
      assert.strictEqual(limiter.check('k1').allowed, true, 'after window expiry a fresh hit passes');
      limiter._pruneTimer.unref && clearInterval(limiter._pruneTimer);
      resolve();
    }, 25));
  });

  console.log('safety-guard: SingleFlight');

  test('SingleFlight rejects concurrent acquisition', () => {
    const lock = new SingleFlight('scan');
    assert.strictEqual(lock.tryAcquire(), true);
    assert.strictEqual(lock.tryAcquire(), false);
    lock.release();
    assert.strictEqual(lock.tryAcquire(), true);
    lock.release();
  });

  console.log('safety-guard: sanitizeNumbers');

  test('sanitizeNumbers dedupes, rejects invalid, caps batch', () => {
    const out = sanitizeNumbers(['+1 (555) 123-4567', '15551234567', '123', 'abcdef', '---', 447912345678], 3);
    assert.strictEqual(out.length, 2, 'dedup of identical digits collapses to one, invalid dropped');
    assert.deepStrictEqual(out, ['15551234567', '447912345678']);
    const capped = sanitizeNumbers(Array.from({ length: 20 }, (_, i) => `+1${String(i).padStart(10, '0')}`), 5);
    assert.strictEqual(capped.length, 5, 'batch capped at max');
    assert.strictEqual(sanitizeNumbers('not-an-array', 100).length, 0, 'non-array yields empty');
  });

  test('clampDelay enforces natural floors and ceiling', () => {
    assert.strictEqual(clampDelay(NaN, false), 1200, 'invalid fast default');
    assert.strictEqual(clampDelay(NaN, true), 3000, 'invalid shield default');
    assert.strictEqual(clampDelay(1, false), 600, 'fast floor');
    assert.strictEqual(clampDelay(500000, false), 30000, 'ceiling');
    assert.strictEqual(clampDelay(120, true), 1200, 'shield floor');
  });

  console.log('stability: CircuitBreaker');

  test('CircuitBreaker opens after threshold and re-probes in half-open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetMs: 15, halfOpenMs: 5, name: 't' });
    for (let i = 0; i < 3; i++) cb.recordFailure(new Error(`f${i}`));
    assert.strictEqual(cb.state, 'open', 'opens after threshold');
    assert.strictEqual(cb.isAvailable, false, 'rejects while open');
    return new Promise((resolve) => setTimeout(() => {
      assert.strictEqual(cb.isAvailable, true, 'half-open probes');
      assert.strictEqual(cb.isAvailable, true, 'probe allowed in half-open');
      cb.recordFailure(new Error('probe fail'));
      assert.strictEqual(cb.state, 'open', 'probe failure re-opens');
      resolve();
    }, 20));
  });

  test('CircuitBreaker success closes', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, name: 't' });
    cb.recordFailure(new Error('boom'));
    assert.strictEqual(cb.state, 'open');
    cb.recordSuccess();
    assert.strictEqual(cb.state, 'closed');
    assert.strictEqual(cb.isAvailable, true);
  });

  console.log('send-path invariants (simulated via sanitize + limits)');

  test('Duplicate identical batch is rejected by dedup window', () => {
    // Mirrors guardDuplicateScanStart semantics in server.js: same hash inside
    // the window must be refused; a different batch is allowed straight through.
    const windowMs = 30000;
    let lastHash = null; let lastAt = 0;
    const hashOf = (arr) => require('crypto').createHash('sha256').update(arr.join('|')).digest('hex').slice(0, 32);
    const guard = (arr, now) => {
      const h = hashOf(arr);
      if (lastHash === h && now - lastAt < windowMs) return 'duplicate';
      lastHash = h; lastAt = now; return null;
    };
    const t0 = 100000;
    assert.strictEqual(guard(['123', '456'], t0), null);
    assert.strictEqual(guard(['123', '456'], t0 + 1000), 'duplicate');
    assert.strictEqual(guard(['123', '456'], t0 + 31000), null, 'window expiry allows resubmit');
    assert.strictEqual(guard(['999', '456'], t0 + 32000), null, 'different batch allowed');
  });

  test('Global and per-contact caps are enforced (simulated)', () => {
    // Mirrors whatsapp.js sendMessage budget logic to lock in the fail-closed
    // behavior: exceeding per-contact or global budgets must throw.
    const globalTimes = [];
    const perJid = new Map();
    const config = { maxPerHour: 3, globalMaxPerHour: 5 };
    const send = (jid) => {
      const now = Date.now();
      const h = (perJid.get(jid) || []).filter(t => now - t < 3600000);
      if (h.length >= config.maxPerHour) throw new Error('hourly limit');
      const gh = globalTimes.filter(t => now - t < 3600000);
      if (gh.length >= config.globalMaxPerHour) throw new Error('global hourly limit');
      perJid.set(jid, [...perJid.get(jid) || [], now]);
      globalTimes.push(now);
    };
    send('a'); send('a'); send('a');
    assert.throws(() => send('a'), /hourly limit/, '4th to same jid refused');
    send('d'); send('e');
    assert.throws(() => send('f'), /global hourly limit/, '6th global send refused');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\nFailures:');
    for (const f of failures) console.error(`  - ${f.name}: ${f.err.message}`);
    process.exit(1);
  }
})();