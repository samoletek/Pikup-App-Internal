// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Improve module resolution
config.resolver.alias = {
  '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage',
  // Add more aliases if needed
};

// Ensure proper handling of native modules
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json', 'cjs'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ttf'];

module.exports = config;