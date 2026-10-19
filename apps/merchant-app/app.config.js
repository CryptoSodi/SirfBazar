const expo = structuredClone(require('./app.json').expo);

const androidMapsKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '').trim();
if (androidMapsKey && !/^AIza[A-Za-z0-9_-]{35}$/.test(androidMapsKey)) {
  throw new Error('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY must be a valid Android-restricted Maps key.');
}
if (process.env.EAS_BUILD_PLATFORM === 'android' && process.env.NODE_ENV === 'production'
    && process.env.REMEDIATION_TEST_BUILD !== '1' && !androidMapsKey) {
  throw new Error('Configure EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY before building merchant Android releases.');
}
if (androidMapsKey) {
  expo.android.config = { ...expo.android.config, googleMaps: { apiKey: androidMapsKey } };
}

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
  if (expo.android.config) delete expo.android.config.googleMaps;
  // Production FCM configuration does not register the isolated test package.
  delete expo.android.googleServicesFile;
  expo.ios.bundleIdentifier += '.remediation';
}

module.exports = { expo };
