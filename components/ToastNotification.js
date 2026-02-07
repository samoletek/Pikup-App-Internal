import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function ToastNotification({ 
  visible, 
  message, 
  type = 'info', 
  duration = 3000, 
  onHide 
}) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      showToast();
    } else {
      hideToast();
    }
  }, [visible]);

  const showToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Auto-hide after duration
      if (duration > 0) {
        setTimeout(() => {
          hideToast();
        }, duration);
      }
    });
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: colors.success,
          borderColor: colors.success,
          icon: 'checkmark-circle',
          iconColor: colors.text.primary,
        };
      case 'error':
        return {
          backgroundColor: colors.error,
          borderColor: colors.error,
          icon: 'close-circle',
          iconColor: colors.text.primary,
        };
      case 'warning':
        return {
          backgroundColor: colors.warning,
          borderColor: colors.warning,
          icon: 'warning',
          iconColor: colors.text.primary,
        };
      case 'info':
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primaryDark,
          icon: 'information-circle',
          iconColor: colors.text.primary,
        };
    }
  };

  const toastStyle = getToastStyle();

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: toastStyle.backgroundColor,
            borderColor: toastStyle.borderColor,
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.toastContent}
          onPress={hideToast}
          activeOpacity={0.9}
        >
          <Ionicons
            name={toastStyle.icon}
            size={20}
            color={toastStyle.iconColor}
            style={styles.icon}
          />
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
            <Ionicons name="close" size={16} color={colors.text.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toast: {
    marginTop: 10,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: width - 40,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});
