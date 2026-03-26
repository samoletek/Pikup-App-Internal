const originalEnv = process.env;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
    manifest: { extra: {} },
    manifest2: { extra: {} },
  },
}));

describe("appConfig", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.__DEV__ = true;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("uses defaults when env vars are missing", () => {
    delete process.env.EXPO_PUBLIC_URL_SCHEME;
    delete process.env.EXPO_PUBLIC_ENABLE_DEV_MOCK_DATA;

    const { appConfig } = require("../../config/appConfig");

    expect(appConfig.stripe.urlScheme).toBe("pikup");
    expect(appConfig.devMocks.enabled).toBe(false);
  });

  test("enables dev mocks only when explicit flag is set", () => {
    process.env.EXPO_PUBLIC_ENABLE_DEV_MOCK_DATA = "1";

    const { appConfig } = require("../../config/appConfig");

    expect(appConfig.devMocks.enabled).toBe(true);
  });

  test("driver readiness bypass helper checks both id and email in dev", () => {
    process.env.EXPO_PUBLIC_DRIVER_READINESS_BYPASS_EMAILS = "allowed@example.com";
    process.env.EXPO_PUBLIC_DRIVER_READINESS_BYPASS_USER_IDS = "driver_123";

    const { isDriverReadinessBypassEnabled } = require("../../config/appConfig");

    expect(isDriverReadinessBypassEnabled({ email: "allowed@example.com" })).toBe(true);
    expect(isDriverReadinessBypassEnabled({ uid: "driver_123" })).toBe(true);
    expect(isDriverReadinessBypassEnabled({ email: "blocked@example.com" })).toBe(false);
  });
});
