module.exports = ({ config }) => {
  const iosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const androidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const plugins = (config.plugins || []).filter(plugin => (
    Array.isArray(plugin) ? plugin[0] !== 'react-native-maps' : plugin !== 'react-native-maps'
  ));

  if (iosApiKey || androidApiKey) {
    const mapOptions = {};
    if (iosApiKey) mapOptions.iosGoogleMapsApiKey = iosApiKey;
    if (androidApiKey) mapOptions.androidGoogleMapsApiKey = androidApiKey;
    plugins.push(['react-native-maps', mapOptions]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      googleMapsIosEnabled: Boolean(iosApiKey)
    }
  };
};
