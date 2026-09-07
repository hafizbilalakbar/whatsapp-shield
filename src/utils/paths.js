// Single source of truth for product slugs. Shield has its own dedicated
// path; Agent owns /message-agent. All navigation, redirects and the
// ProductSwitcher active-state logic must resolve through these constants.
export const SHIELD_HOME = '/shield';
export const AGENT_HOME = '/message-agent';

// Every route that belongs to the Shield product. Pages like Dashboard,
// Settings or Profile are intentionally NOT listed — there the switcher
// highlights neither product.
export const SHIELD_PATHS = [SHIELD_HOME, '/number-formats', '/history'];
export const AGENT_PATHS = [AGENT_HOME];