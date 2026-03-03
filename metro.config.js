const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  // relative path to global.css from project root
  cssEntryFile: './global.css',
  // auto-generate Tailwind typings
  dtsFile: './src/uniwind-types.d.ts',
});
