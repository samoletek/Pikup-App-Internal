jest.mock("../../services/AuthService", () => ({
  signup: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  deleteAccount: jest.fn(),
  changePassword: jest.fn(),
  verifyAccountPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

const AuthService = require("../../services/AuthService");
const { createAuthDomainActions } = require("../../contexts/auth/actions/authActions");

describe("auth domain actions smoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("login toggles loading and writes user session state", async () => {
    const setCurrentUser = jest.fn();
    const setUserType = jest.fn();
    const setLoading = jest.fn();

    AuthService.login.mockResolvedValue({
      user: { id: "user_1", email: "a@b.com" },
      userType: "customer",
    });

    const actions = createAuthDomainActions({
      currentUser: null,
      setCurrentUser,
      setUserType,
      setLoading,
    });

    const result = await actions.login("a@b.com", "pw", "customer");

    expect(AuthService.login).toHaveBeenCalledWith("a@b.com", "pw", "customer");
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setCurrentUser).toHaveBeenCalledWith({ id: "user_1", email: "a@b.com" });
    expect(setUserType).toHaveBeenCalledWith("customer");
    expect(result.user.id).toBe("user_1");
  });

  test("logout clears local auth state", async () => {
    const setCurrentUser = jest.fn();
    const setUserType = jest.fn();
    const setLoading = jest.fn();

    const actions = createAuthDomainActions({
      currentUser: { id: "user_1" },
      setCurrentUser,
      setUserType,
      setLoading,
    });

    await actions.logout();

    expect(AuthService.logout).toHaveBeenCalledTimes(1);
    expect(setCurrentUser).toHaveBeenCalledWith(null);
    expect(setUserType).toHaveBeenCalledWith(null);
    expect(setLoading).not.toHaveBeenCalled();
  });

  test("deleteAccount clears local auth state after service call", async () => {
    const setCurrentUser = jest.fn();
    const setUserType = jest.fn();
    const setLoading = jest.fn();
    const currentUser = { id: "user_9" };

    AuthService.deleteAccount.mockResolvedValue({ success: true });

    const actions = createAuthDomainActions({
      currentUser,
      setCurrentUser,
      setUserType,
      setLoading,
    });

    const result = await actions.deleteAccount();

    expect(AuthService.deleteAccount).toHaveBeenCalledWith(currentUser);
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setCurrentUser).toHaveBeenCalledWith(null);
    expect(setUserType).toHaveBeenCalledWith(null);
    expect(result.success).toBe(true);
  });
});
