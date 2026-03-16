import * as AuthService from '../../../services/AuthService';
import { logFlowError, logFlowInfo, startFlowContext } from '../../../services/flowContext';

export const createAuthDomainActions = ({
  currentUser,
  setCurrentUser,
  setUserType,
  setLoading,
}) => {
  const signup = async (email, password, type, additionalData) => {
    const flowContext = startFlowContext('auth.signup', { type });
    setLoading(true);
    try {
      logFlowInfo('AuthDomainActions', 'signup started', flowContext);
      const result = await AuthService.signup(email, password, type, additionalData);
      setCurrentUser(result.user);
      setUserType(result.userType);
      logFlowInfo('AuthDomainActions', 'signup succeeded', flowContext);
      return result;
    } catch (error) {
      logFlowError('AuthDomainActions', 'signup failed', error, flowContext, 'Signup failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, expectedRole) => {
    const flowContext = startFlowContext('auth.login', { expectedRole });
    setLoading(true);
    try {
      logFlowInfo('AuthDomainActions', 'login started', flowContext);
      const result = await AuthService.login(email, password, expectedRole);
      setCurrentUser(result.user);
      setUserType(result.userType);
      logFlowInfo('AuthDomainActions', 'login succeeded', flowContext);
      return result;
    } catch (error) {
      logFlowError('AuthDomainActions', 'login failed', error, flowContext, 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const flowContext = startFlowContext('auth.logout', { userId: currentUser?.id || null });
    await AuthService.logout();
    setCurrentUser(null);
    setUserType(null);
    logFlowInfo('AuthDomainActions', 'logout succeeded', flowContext);
  };

  const signInWithApple = async (userRole) => {
    const flowContext = startFlowContext('auth.apple', { userRole });
    setLoading(true);
    try {
      logFlowInfo('AuthDomainActions', 'apple sign-in started', flowContext);
      const result = await AuthService.signInWithApple(userRole);
      if (result.user) {
        setCurrentUser(result.user);
        setUserType(result.userType || userRole);
      }
      logFlowInfo('AuthDomainActions', 'apple sign-in succeeded', flowContext);
      return result;
    } catch (error) {
      logFlowError('AuthDomainActions', 'apple sign-in failed', error, flowContext, 'Apple sign-in failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (userRole) => {
    const flowContext = startFlowContext('auth.google', { userRole });
    setLoading(true);
    try {
      logFlowInfo('AuthDomainActions', 'google sign-in started', flowContext);
      const result = await AuthService.signInWithGoogle(userRole);
      if (result?.user) {
        setCurrentUser(result.user);
        setUserType(result.userType || userRole);
      }
      logFlowInfo('AuthDomainActions', 'google sign-in succeeded', flowContext);
      return result;
    } catch (error) {
      logFlowError('AuthDomainActions', 'google sign-in failed', error, flowContext, 'Google sign-in failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    const flowContext = startFlowContext('auth.deleteAccount', { userId: currentUser?.id || null });
    setLoading(true);
    try {
      logFlowInfo('AuthDomainActions', 'account deletion started', flowContext);
      const result = await AuthService.deleteAccount(currentUser);
      setCurrentUser(null);
      setUserType(null);
      logFlowInfo('AuthDomainActions', 'account deletion succeeded', flowContext);
      return result;
    } catch (error) {
      logFlowError('AuthDomainActions', 'account deletion failed', error, flowContext, 'Account deletion failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = (currentPassword, newPassword) =>
    AuthService.changePassword(currentUser, currentPassword, newPassword);
  const verifyAccountPassword = (password) =>
    AuthService.verifyAccountPassword(currentUser, password);
  const resetPassword = (email) => AuthService.resetPassword(email);

  return {
    signup,
    login,
    logout,
    signInWithApple,
    signInWithGoogle,
    deleteAccount,
    changePassword,
    verifyAccountPassword,
    resetPassword,
  };
};
