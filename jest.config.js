module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(expo(?:-[^/]+)?|@expo|react-native|@react-native|@react-navigation|@rnmapbox|@stripe|@supabase|react-native-url-polyfill)/)",
  ],
  moduleNameMapper: {
    "\\.(png|jpg|jpeg|gif|webp|svg)$": "<rootDir>/__tests__/fileMock.js",
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  clearMocks: true,
};
