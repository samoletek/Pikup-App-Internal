// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Improve module resolution
config.resolver.alias = {
  '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage',
  // Add more aliases if needed
};

// Extend default asset extensions with mp4 for onboarding video
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}

module.exports = config;
