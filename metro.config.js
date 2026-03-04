const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude platform-specific native binaries for other OSes so Metro's
// file watcher doesn't crash on Windows when macOS/Linux packages are present.
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules[/\\]@tailwindcss[/\\]oxide-darwin-.*/,
  /node_modules[/\\]@tailwindcss[/\\]oxide-linux-.*/,
];

module.exports = withUniwindConfig(config, {
  // relative path to global.css from project root
  cssEntryFile: './global.css',
  // auto-generate Tailwind typings
  dtsFile: './src/uniwind-types.d.ts',
});
