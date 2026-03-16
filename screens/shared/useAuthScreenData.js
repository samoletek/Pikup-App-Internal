import { useCallback, useState } from "react";
import { Alert, Linking } from "react-native";

const EMAIL_REGEX = /\S+@\S+\.\S+/;

export default function useAuthScreenData({
  login,
  signup,
  signInWithApple,
  signInWithGoogle,
  userRole,
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [termsAcceptedError, setTermsAcceptedError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetErrors = useCallback(() => {
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setNameError("");
    setTermsAcceptedError("");
  }, []);

  const validateEmail = useCallback((value) => {
    return EMAIL_REGEX.test(String(value || ""));
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    try {
      await signInWithApple(userRole);
    } catch (error) {
      if (!error?.canceled) {
        Alert.alert("Sign In Error", error?.message || "Apple sign-in failed.");
      }
    }
  }, [signInWithApple, userRole]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle(userRole);
    } catch (error) {
      if (!error?.canceled) {
        Alert.alert("Sign In Error", error?.message || "Google sign-in failed.");
      }
    }
  }, [signInWithGoogle, userRole]);

  const handleAuth = useCallback(async () => {
    resetErrors();
    let isValid = true;

    if (!email || !validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    }

    if (!password || password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    }

    if (!isLogin && password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      isValid = false;
    }

    if (!isLogin && (!firstName || !lastName)) {
      setNameError("Please enter your full name");
      isValid = false;
    }

    if (!isLogin && !termsAccepted) {
      setTermsAcceptedError("You must accept the Terms and Privacy Policy");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    try {
      if (isLogin) {
        await login(email, password, userRole);
        return;
      }

      await signup(email, password, userRole, {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
      });
    } catch (error) {
      Alert.alert("Authentication Error", error?.message || "Authentication failed.");
    }
  }, [
    confirmPassword,
    email,
    firstName,
    isLogin,
    lastName,
    login,
    password,
    resetErrors,
    signup,
    termsAccepted,
    userRole,
    validateEmail,
  ]);

  const handleOpenExternalUrl = useCallback(async (url, fallbackErrorMessage) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Error", `Cannot open this link: ${url}`);
        return;
      }
      await Linking.openURL(url);
    } catch (_error) {
      Alert.alert("Error", fallbackErrorMessage);
    }
  }, []);

  const toggleAuthMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    resetErrors();
  }, [resetErrors]);

  return {
    confirmPassword,
    confirmPasswordError,
    email,
    emailError,
    firstName,
    handleAppleSignIn,
    handleAuth,
    handleGoogleSignIn,
    handleOpenExternalUrl,
    isLogin,
    lastName,
    nameError,
    password,
    passwordError,
    setConfirmPassword,
    setEmail,
    setFirstName,
    setLastName,
    setPassword,
    setShowConfirmPassword,
    setShowPassword,
    setTermsAccepted,
    showConfirmPassword,
    showPassword,
    termsAccepted,
    termsAcceptedError,
    toggleAuthMode,
  };
}
