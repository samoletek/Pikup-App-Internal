import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const { height } = Dimensions.get('window');

const CancelOrderModal = ({ visible, onClose, onCancelSuccess, orderData, orderId }) => {
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const { cancelOrder, getCancellationInfo } = useAuth();

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: height,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  if (!orderData) {
    return null;
  }

  const cancellationInfo = getCancellationInfo(orderData);

  const handleCancel = async () => {
    try {
      setLoading(true);
      const result = await cancelOrder(orderId || orderData.id);

      Alert.alert(
        'Order Cancelled',
        `Your order has been cancelled successfully.${
          cancellationInfo.fee > 0 
            ? `\n\nCancellation fee: $${cancellationInfo.fee.toFixed(2)}`
            : ''
        }${
          cancellationInfo.refundAmount > 0 
            ? `\nRefund amount: $${cancellationInfo.refundAmount.toFixed(2)}`
            : ''
        }${
          cancellationInfo.driverCompensation > 0
            ? `\n\nDriver compensation: $${cancellationInfo.driverCompensation.toFixed(2)}`
            : ''
        }`,
        [
          {
            text: 'OK',
            onPress: () => {
              onCancelSuccess();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert(
        'Cancellation Failed',
        error.message || 'Unable to cancel the order. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: height,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.modal,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Cancel Order</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {cancellationInfo.canCancel ? (
              <>
                {/* Order Info */}
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>Order Details</Text>
                  <Text style={styles.orderRoute}>
                    {orderData.pickup?.address} → {orderData.dropoff?.address}
                  </Text>
                  <Text style={styles.orderStatus}>
                    Status: <Text style={styles.statusValue}>{orderData.status}</Text>
                  </Text>
                </View>

                {/* Warning Message */}
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={24} color="#FF9500" />
                  <Text style={styles.warningText}>
                    Are you sure you want to cancel this order?
                  </Text>
                </View>

                {/* Cancellation Details */}
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsTitle}>Cancellation Details</Text>
                  
                  {cancellationInfo.fee > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cancellation Fee:</Text>
                      <Text style={styles.detailValue}>
                        ${cancellationInfo.fee.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Refund Amount:</Text>
                    <Text style={[styles.detailValue, styles.refundValue]}>
                      ${cancellationInfo.refundAmount.toFixed(2)}
                    </Text>
                  </View>

                  {cancellationInfo.driverCompensation > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Driver Compensation:</Text>
                      <Text style={styles.detailValue}>
                        ${cancellationInfo.driverCompensation.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.reasonText}>
                    {cancellationInfo.reason}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.keepButton}
                    onPress={handleClose}
                    disabled={loading}
                  >
                    <Text style={styles.keepButtonText}>Keep Order</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cancelButton, loading && styles.cancelButtonDisabled]}
                    onPress={handleCancel}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.cancelButtonText}>Cancel Order</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Cannot Cancel */}
                <View style={styles.noCancel}>
                  <Ionicons name="close-circle" size={64} color="#FF6B6B" />
                  <Text style={styles.noCancelTitle}>Cannot Cancel</Text>
                  <Text style={styles.noCancelMessage}>
                    {cancellationInfo.reason}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.okButton}
                  onPress={handleClose}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderInfo: {
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  orderRoute: {
    color: '#A77BFF',
    fontSize: 14,
    marginBottom: 4,
  },
  orderStatus: {
    color: '#999',
    fontSize: 14,
  },
  statusValue: {
    color: '#00D4AA',
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1F00',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  warningText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  detailsContainer: {
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  refundValue: {
    color: '#00D4AA',
  },
  reasonText: {
    color: '#666',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  keepButton: {
    flex: 1,
    backgroundColor: '#2A2A3B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  keepButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noCancel: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCancelTitle: {
    color: '#FF6B6B',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noCancelMessage: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  okButton: {
    backgroundColor: '#A77BFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CancelOrderModal;