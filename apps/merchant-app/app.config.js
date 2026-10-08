const expo = structuredClone(require('./app.json').expo);

const googleIosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
if (googleIosClientId && !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(googleIosClientId)) {
  throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be the OAuth iOS client for this bundle identifier.');
}
if (process.env.EAS_BUILD_PLATFORM === 'ios' && !googleIosClientId) {
  throw new Error('Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before building iOS Google sign-in.');
}
if (googleIosClientId) {
  expo.plugins = expo.plugins.map(plugin => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name === '@react-native-google-signin/google-signin'
      ? [name, { iosUrlScheme: googleIosClientId.split('.').reverse().join('.') }]
      : plugin;
  });
}

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
