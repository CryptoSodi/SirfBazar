/** Refuse live/default database targets before any service fixture writes. */
function disposableUrl(raw = process.env.DATABASE_URL) {
  if (!raw) throw new Error('A disposable PostgreSQL DATABASE_URL is required');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      !url.port || ['5432', '5433', '3001'].includes(url.port) ||
      url.pathname !== '/sirfbazar_remediation_test') {
    throw new Error('Use local sirfbazar_remediation_test on a unique non-live port');
  }
  return url;
}

module.exports = { disposableUrl };
