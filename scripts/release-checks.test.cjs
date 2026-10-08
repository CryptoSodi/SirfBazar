const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { test } = require('node:test');
const { REQUIRED_JOBS, checkReleaseResults } = require('./release-checks.cjs');

const successful = () => Object.fromEntries(REQUIRED_JOBS.map((name) => [name, { result: 'success' }]));

test('all seven gate groups must succeed, including the entire client matrix', () => {
  assert.equal(REQUIRED_JOBS.length, 7);
  assert.doesNotThrow(() => checkReleaseResults(successful()));
});

for (const result of ['failure', 'skipped', 'cancelled', 'pending', undefined]) {
  test(`${result ?? 'missing result'} blocks every gate independently`, () => {
    for (const name of REQUIRED_JOBS) {
      const needs = successful();
      needs[name] = { result };
      assert.throws(() => checkReleaseResults(needs), /Release blocked/);
    }
  });
}

test('missing or unexpected gates cannot silently reduce coverage', () => {
  for (const name of REQUIRED_JOBS) {
    const needs = successful();
    delete needs[name];
    assert.throws(() => checkReleaseResults(needs), /missing/);
  }
  assert.throws(() => checkReleaseResults({ ...successful(), unreviewed: { result: 'success' } }), /Unrecognized/);
});

test('invalid input fails closed', () => {
  for (const needs of [null, undefined, [], 'success', 1]) {
    assert.throws(() => checkReleaseResults(needs), /must be an object/);
  }
});

test('CLI fails on absent or malformed input and passes only a complete success', () => {
  for (const [value, expected] of [[undefined, 1], ['{broken', 1], ['{}', 1], [JSON.stringify(successful()), 0]]) {
    const env = { ...process.env };
    if (value === undefined) delete env.RELEASE_CHECK_RESULTS;
    else env.RELEASE_CHECK_RESULTS = value;
    const result = spawnSync(process.execPath, [join(__dirname, 'release-checks.cjs')], { env, encoding: 'utf8' });
    assert.equal(result.status, expected, result.stderr);
  }
});
