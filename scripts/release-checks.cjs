const REQUIRED_JOBS = Object.freeze([
  'deployment-tools', 'api', 'web', 'admin', 'remaining-clients',
  'browser-journeys', 'database-regressions',
]);

function checkReleaseResults(needs) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
    throw new Error('Release gate results must be an object.');
  }
  const unexpected = Object.keys(needs).filter((name) => !REQUIRED_JOBS.includes(name));
  if (unexpected.length) throw new Error(`Unrecognized release gates: ${unexpected.join(', ')}`);
  const blocked = REQUIRED_JOBS.filter((name) => needs[name]?.result !== 'success');
  if (blocked.length) {
    throw new Error(`Release blocked: ${blocked.map((name) => `${name}=${needs[name]?.result ?? 'missing'}`).join(', ')}`);
  }
}

if (require.main === module) {
  try {
    checkReleaseResults(JSON.parse(process.env.RELEASE_CHECK_RESULTS));
    console.log(`PASS: all ${REQUIRED_JOBS.length} release gates succeeded.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { REQUIRED_JOBS, checkReleaseResults };
