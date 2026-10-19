const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, config => {
    const flags = ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds'];
    config.modResults = config.modResults.filter(item => !flags.includes(item.key));
    config.modResults.push(...flags.map(key => ({ type: 'property', key, value: 'true' })));
    return config;
  });
  return withAppBuildGradle(config, config => {
    const defaults = /getDefaultProguardFile\((['"])proguard-android(?:-optimize)?\.txt\1\)/g;
    if (config.modResults.language !== 'groovy' || !defaults.test(config.modResults.contents)) {
      throw new Error('Review the Android release ProGuard configuration before building.');
    }
    config.modResults.contents = config.modResults.contents.replace(defaults,
      'getDefaultProguardFile("proguard-android-optimize.txt")');
    return config;
  });
};
