const { expo } = require('./app.json');

if (process.env.REMEDIATION_TEST_BUILD === '1') {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL || '');
  if (!['http:', 'https:'].includes(url.protocol) || /(^|\.)api\.sirfbazar\.com$/i.test(url.hostname))
    throw new Error('Remediation native build requires a dedicated nonproduction EXPO_PUBLIC_API_URL');
  expo.name += ' Remediation';
  expo.slug += '-remediation';
  expo.scheme += '-remediation';
  expo.android.package += '.remediation';
  expo.ios.bundleIdentifier += '.remediation';
}

module.exports = { expo };
