global.__DEV__ = true;

jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openSettings: jest.fn(),
  },
  Platform: {
    OS: "ios",
    select: (options) => options.ios ?? options.default,
  },
}));
