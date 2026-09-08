import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { FileText, AlignLeft, Code2, FileDown, MessageCircle, Search, Trash2, Check, Loader2 } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useWebSocket } from '../../context/WebSocketProvider';
import { countries } from '../../data/countries';
import { exportFilteredCSV, exportFilteredTXT, exportFilteredJSON, exportFilteredPDF, downloadFile, getCountryName } from '../../utils/exportUtils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/Dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/AlertDialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';
import ResultAvatar from '../ResultAvatar';
import { cn } from '../ui/cn';

const CHART_COLORS = ['#00D97E', '#EF4444', '#F59E0B'];

const EXPORT_BTNS = [
  { key: 'csv', label: 'CSV', icon: FileText, color: '#16A34A', hoverColor: '#15803D' },
  { key: 'txt', label: 'TXT', icon: AlignLeft, color: '#2563EB', hoverColor: '#1D4ED8' },
  { key: 'json', label: 'JSON', icon: Code2, color: '#7C3AED', hoverColor: '#6D28D9' },
  { key: 'pdf', label: 'PDF', icon: FileDown, color: '#DC2626', hoverColor: '#B91C1C' },
];

const Step5Reports = () => {
  const { resultsList, sessionUser, campaignHistory, sendMessage, deleteCampaign, addLog } = useWebSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showHistory, setShowHistory] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyCountryFilter, setHistoryCountryFilter] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [exportStates, setExportStates] = useState({ csv: 'idle', txt: 'idle', json: 'idle', pdf: 'idle' });
  const tableContainerRef = useRef(null);
  const [transferState, setTransferState] = useState('idle');
  const [transferMsg, setTransferMsg] = useState('');
  const [transferDetail, setTransferDetail] = useState('');

  const setExportState = (key, state) => {
    setExportStates(prev => ({ ...prev, [key]: state }));
  };

  const handleExport = async (key, fn) => {
    if (exportStates[key] !== 'idle') return;
    setExportState(key, 'loading');
    await new Promise(r => setTimeout(r, 800));
    try {
      await fn();
      setExportState(key, 'done');
    } catch (e) {
      console.error(`Export ${key} failed:`, e);
      setExportState(key, 'idle');
      return;
    }
    await new Promise(r => setTimeout(r, 1200));
    setExportState(key, 'idle');
  };

  const verifiedTransferCount = useMemo(
    () => resultsList.filter(r => r.exists === true && r.isValidFormat !== false).length,
    [resultsList]
  );

  const handleTransferVerified = async () => {
    if (transferState !== 'idle' || verifiedTransferCount === 0) return;
    setTransferState('loading');
    setTransferMsg('');
    setTransferDetail('');
    try {
      let rules = {};
      try {
        const rulesRes = await fetch('/api/message-agent/lead-transfer');
        const rulesData = await rulesRes.json();
        if (rulesData.success && rulesData.rules) rules = rulesData.rules;
      } catch { /* use defaults */ }
      if (rules.enabled === false) {
        setTransferState('done');
        setTransferMsg('Transfer disabled');
        setTransferDetail('Enable it in Message Agent → Settings → Lead Transfer.');
        return;
      }
      const fallbackCampaign = campaignHistory?.[0] || {};
      const contacts = resultsList
        .filter(r => r.exists === true && r.isValidFormat !== false)
        .map(r => ({
          phone: r.formatted || r.number || r.phone,
          name: r.displayName || r.verifiedName || '',
          country: r.detectedCountry || r.country || fallbackCampaign.countryCode || 'Unknown',
          avatar: r.avatar || null,
          about: r.about || '',
          exists: true,
          isVerified: true,
          isBusiness: r.isBusiness || false,
          isValidFormat: true,
          campaignId: r.campaignId || fallbackCampaign.id || null,
          campaignDate: r.campaignDate || fallbackCampaign.timestamp || null,
          validationDate: new Date().toISOString(),
        }));
      const res = await fetch('/api/message-agent/import-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts,
          mode: 'manual',
          metadata: {
            source: 'whatsapp_shield',
            campaignId: fallbackCampaign.id || null,
            campaignDate: fallbackCampaign.timestamp || null,
            tags: [...(rules.addTags || []), 'shield_verified'],
            validated: true,
            defaultJourney: rules.defaultJourney || 'new_lead',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferState('done');
        setTransferMsg(`${data.added} lead${data.added === 1 ? '' : 's'} transferred`);
        setTransferDetail(data.skipped > 0 ? `${data.skipped} already in CRM and skipped` : 'Now in your CRM pipeline');
      } else {
        setTransferState('idle');
        window.dispatchEvent(new CustomEvent('ws-toast', {
          detail: { message: data.error || 'Transfer failed', type: 'error' }
        }));
      }
    } catch {
      setTransferState('idle');
      window.dispatchEvent(new CustomEvent('ws-toast', {
        detail: { message: 'Transfer failed. Check connection and try again.', type: 'error' }
      }));
    }
  };

  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [resultsList.length]);

  const loadCampaignHistory = () => {
    const phone = sessionUser?.number?.replace(/\D/g, '');
    if (phone) {
      sendMessage({ type: 'get_history', phone });
    }
  };

  const handleDeleteCampaign = async (id) => {
    const phone = sessionUser?.number?.replace(/\D/g, '');
    try {
      const res = await deleteCampaign(id, phone);
      if (!res?.success) {
        console.error('Delete campaign failed:', res?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Delete campaign failed:', err?.message || err);
    }
    setDeleteConfirm(null);
  };

  const filteredHistory = useMemo(() => {
    let list = [...campaignHistory];
    if (historyDateFilter) {
      list = list.filter(c => c.timestamp.startsWith(historyDateFilter));
    }
    if (historyCountryFilter !== 'all') {
      list = list.filter(c => c.countryCode === historyCountryFilter);
    }
    return list;
  }, [campaignHistory, historyDateFilter, historyCountryFilter]);

  const uniqueCountries = useMemo(() => {
    return [...new Set(campaignHistory.map(c => c.countryCode))].sort();
  }, [campaignHistory]);

  const stats = useMemo(() => {
    const total = resultsList.length;
    const registered = resultsList.filter(r => r.exists === true).length;
    const unregistered = resultsList.filter(r => r.exists === false && r.isValidFormat).length;
    const invalid = resultsList.filter(r => !r.isValidFormat).length;
    return { total, registered, unregistered, invalid };
  }, [resultsList]);

  const [chartData, setChartData] = useState([]);
  useEffect(() => {
    const data = [
      { name: 'Registered', value: resultsList.filter(r => r.exists === true).length },
      { name: 'Not Registered', value: resultsList.filter(r => !r.exists && r.isValidFormat).length },
      { name: 'Invalid', value: resultsList.filter(r => !r.isValidFormat).length }
    ].filter(d => d.value > 0);
    setChartData(data);
  }, [resultsList]);

  const filteredResults = useMemo(() => {
    return resultsList.filter(result => {
      const matchesSearch = result.formatted?.includes(searchTerm) ||
                            result.number?.includes(searchTerm) ||
                            (result.displayName && result.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
      let matchesStatus = true;
      if (statusFilter === 'registered') matchesStatus = result.exists === true;
      if (statusFilter === 'unregistered') matchesStatus = result.exists === false && result.isValidFormat;
      if (statusFilter === 'invalid') matchesStatus = !result.isValidFormat;
      return matchesSearch && matchesStatus;
    });
  }, [resultsList, searchTerm, statusFilter]);

  const filterLabel = useMemo(() => {
    const parts = [];
    if (statusFilter === 'registered') parts.push('Registered');
    else if (statusFilter === 'unregistered') parts.push('Not Registered');
    else if (statusFilter === 'invalid') parts.push('Invalid');
    else parts.push('All Results');
    if (searchTerm) parts.push(`matching "${searchTerm}"`);
    return parts.join(' ');
  }, [statusFilter, searchTerm]);

  const detectedCountry = useMemo(() => {
    const counts = {};
    resultsList.forEach(r => {
      if (r.detectedCountry) counts[r.detectedCountry] = (counts[r.detectedCountry] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? entries[0][0] : 'Unknown';
  }, [resultsList]);

  const liveScanCampaign = useMemo(() => ({
    id: 'current-scan',
    timestamp: new Date().toISOString(),
    countryCode: detectedCountry,
    shieldMode: true,
    delayMs: 0,
    totalChecked: stats.total,
    registeredCount: stats.registered,
    unregisteredCount: stats.unregistered,
    invalidCount: stats.invalid,
    results: resultsList,
  }), [resultsList, stats, detectedCountry]);

  const openWhatsApp = (number) => {
    const cleanNumber = number.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
  };

  const exportHandlers = {
    csv: () => exportFilteredCSV(filteredResults, liveScanCampaign, filterLabel),
    txt: () => exportFilteredTXT(filteredResults, liveScanCampaign, filterLabel),
    json: () => exportFilteredJSON(filteredResults, liveScanCampaign, filterLabel),
    pdf: () => exportFilteredPDF(filteredResults, liveScanCampaign, sessionUser, filterLabel),
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <FileText className="text-primary" size={22} /> Audit Reports
            </h2>
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { loadCampaignHistory(); setShowHistory(true); }}>
                  <FileText size={13} /> History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Campaign History</DialogTitle>
                  <DialogDescription>Past validation campaigns sorted by date.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 py-2 flex-wrap">
                  <input type="date" value={historyDateFilter} onChange={(e) => setHistoryDateFilter(e.target.value)} className="bg-surface border border-border rounded px-3 py-1.5 text-sm font-mono" />
                  <select value={historyCountryFilter} onChange={(e) => setHistoryCountryFilter(e.target.value)} className="bg-surface border border-border rounded px-3 py-1.5 text-sm font-mono">
                    <option value="all">All Countries</option>
                    {uniqueCountries.map(cc => (<option key={cc} value={cc}>+{cc}</option>))}
                  </select>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                  {filteredHistory.length === 0 && (<p className="text-center text-text-muted py-8">No campaigns found.</p>)}
                  {filteredHistory.map((camp) => (
                    <div key={camp.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setSelectedCampaign(selectedCampaign?.id === camp.id ? null : camp)}>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-xs text-text-muted font-mono">{new Date(camp.timestamp).toLocaleString()}</span>
                        <span className="text-sm font-medium">{camp.totalChecked} numbers &middot; {camp.registeredCount} registered &middot; {camp.unregisteredCount} unregistered &middot; {camp.invalidCount} invalid</span>
                        <span className="text-xs text-text-secondary">Country: {camp.countryName || ('+' + camp.countryCode)} &middot; Shield: {camp.shieldMode ? 'ON' : 'OFF'} &middot; Delay: {camp.delayMs}ms</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedCampaign?.id === camp.id && <Badge variant="success">Viewing</Badge>}
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(camp.id); }} className="p-1.5 rounded-md text-text-muted hover:text-white hover:bg-error/80 transition-colors" title="Delete this campaign"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                        <AlertDesc>This action cannot be undone. The campaign and all its results will be permanently removed.</AlertDesc>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCampaign(deleteConfirm)} className="bg-error hover:bg-error/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <Input placeholder="Search numbers..." className="pl-8 py-1.5 text-sm h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="unregistered">Not Registered</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="flex flex-row gap-5 flex-grow min-h-0">
          {/* Left Sidebar */}
          <div className="w-[260px] shrink-0 flex flex-col gap-3 overflow-y-auto">
            <Card className="shrink-0">
              <CardHeader className="pb-2 border-b border-border px-4 py-2.5">
                <CardTitle className="text-sm font-semibold">Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 px-4 pb-3 flex flex-col items-center">
                <div className="h-28 w-full mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={2} dataKey="value" stroke="none">
                        {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1 text-xs">
                  <div className="flex justify-between items-center px-2 py-1 bg-surface rounded-md">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#00D97E]" /> Registered</span>
                    <span className="font-bold">{stats.registered}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1 bg-surface rounded-md">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#EF4444]" /> Not Registered</span>
                    <span className="font-bold">{stats.unregistered}</span>
                  </div>
                  {stats.invalid > 0 && (
                    <div className="flex justify-between items-center px-2 py-1 bg-surface rounded-md">
                      <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Invalid</span>
                      <span className="font-bold">{stats.invalid}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Compact Export Buttons */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1">Export Filtered Data</span>
              {EXPORT_BTNS.map(btn => {
                const Icon = btn.icon;
                const state = exportStates[btn.key];
                return (
                  <Tooltip key={btn.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleExport(btn.key, exportHandlers[btn.key])}
                        disabled={state !== 'idle'}
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 w-full",
                          state === 'done' ? 'bg-green-500/10 border border-green-500/30 text-green-600' :
                          state === 'loading' ? 'opacity-80 cursor-not-allowed' :
                          'border border-border bg-surface hover:bg-background cursor-pointer'
                        )}
                        style={state === 'idle' ? { color: btn.color } : {}}
                      >
                        {state === 'loading' ? (
                          <Loader2 size={13} className="animate-spin shrink-0" />
                        ) : state === 'done' ? (
                          <Check size={13} className="shrink-0" />
                        ) : (
                          <Icon size={13} className="shrink-0" />
                        )}
                        <span className="truncate">{state === 'loading' ? 'Exporting...' : state === 'done' ? 'Exported!' : `Export ${btn.label}`}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{`Export filtered results as ${btn.label}`}</TooltipContent>
                  </Tooltip>
                );
              })}
              {filterLabel !== 'All Results' && (
                <p className="text-[10px] text-primary px-1 mt-0.5">Exporting: {filterLabel}</p>
              )}
            </div>

            {/* Verified Lead Transfer → Message Agent */}
            <Card className="border-primary/20 bg-primary/5 shrink-0">
              <CardHeader className="pb-2 border-b border-primary/10 px-3 py-2.5">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-primary" /> Send to Message Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 px-3 pb-3 space-y-2">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Transfer verified leads straight into your AI conversation CRM. Each lead keeps its campaign
                  provenance, gets validated, and is deduplicated before entering your pipeline.
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Verified leads ready</span>
                  <span className="font-bold text-text-primary">{verifiedTransferCount}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-primary text-white"
                  disabled={transferState !== 'idle' || verifiedTransferCount === 0}
                  onClick={handleTransferVerified}
                >
                  {transferState === 'loading' ? (
                    <><Loader2 size={13} className="animate-spin mr-1" /> Transferring...</>
                  ) : transferState === 'done' ? (
                    <><Check size={13} className="mr-1" /> {transferMsg || 'Transferred'}</>
                  ) : (
                    <><MessageCircle size={13} className="mr-1" /> Transfer Verified Leads</>
                  )}
                </Button>
                {transferState === 'done' && (
                  <p className="text-[10px] text-primary text-center">{transferDetail}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Area — Table */}
          <div className="flex flex-col flex-1 min-w-0 bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-background/50 flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-text-secondary">
                {filteredResults.length} of {resultsList.length} results
              </span>
            </div>

            <div ref={tableContainerRef} className="results-table-scroll">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-surface shadow-sm">
                  <TableRow>
                    <TableHead className="w-[52px] text-[11px]">Profile</TableHead>
                    <TableHead className="text-[11px]">Phone Number</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px]">Type</TableHead>
                    <TableHead className="hidden lg:table-cell text-[11px]">Display Name</TableHead>
                    <TableHead className="text-right text-[11px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length > 0 ? (
                    filteredResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <ResultAvatar result={result} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{result.formatted || result.number}</TableCell>
                        <TableCell>
                          {result.exists ? (
                            <Badge variant="success" className="text-[11px] px-2 py-0.5">Registered</Badge>
                          ) : result.isValidFormat ? (
                            <Badge variant="destructive" className="text-[11px] px-2 py-0.5">Not Registered</Badge>
                          ) : (
                            <Badge variant="warning" className="text-[11px] px-2 py-0.5">Invalid</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {result.exists ? (
                            <Badge variant={result.isBusiness ? "default" : "outline"} className={cn("text-[10px] px-2 py-0.5", result.isBusiness && "bg-primary/10 text-primary border-primary/30")}>
                              {result.isBusiness ? 'Business' : 'Personal'}
                            </Badge>
                          ) : (
                            <span className="text-text-muted text-xs">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-text-secondary truncate max-w-[160px] text-sm" title={result.displayName || result.verifiedName}>
                          {result.displayName || result.verifiedName || '---'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" disabled={!result.exists} onClick={() => openWhatsApp(result.formatted)} className="text-text-secondary hover:text-primary w-7 h-7" title="Message on WhatsApp">
                              <MessageCircle size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                const event = new CustomEvent('openMessageAgent', {
                                  detail: {
                                    phone: result.formatted,
                                      contact: {
                                        name: `+${result.formatted.replace(/\D/g, '')}`,
                                        phone: result.formatted,
                                        exists: result.exists,
                                        avatar: result.avatar,
                                        country: result.detectedCountry || 'Unknown',
                                        accountType: result.isBusiness ? 'Business' : (result.exists ? 'Personal' : 'N/A'),
                                        displayName: result.displayName || ''
                                      }
                                  }
                                });
                                window.dispatchEvent(event);
                              }} 
                              className="text-text-secondary hover:text-[#25D366] w-7 h-7" 
                              title="Open in Message Agent"
                            >
                              <MessageCircle size={14} className="text-green-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-text-muted text-sm">
                        No results found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Step5Reports;
