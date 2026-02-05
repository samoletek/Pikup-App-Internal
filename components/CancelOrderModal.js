import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import BaseModal from './BaseModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CancelOrderModal = ({ visible, onClose, onCancelSuccess, orderData, orderId }) => {
  const [loading, setLoading] = useState(false);
  const { cancelOrder, getCancellationInfo } = useAuth();

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
        `Your order has been cancelled successfully.${cancellationInfo.fee > 0
          ? `\n\nCancellation fee: $${cancellationInfo.fee.toFixed(2)}`
          : ''
        }${cancellationInfo.refundAmount > 0
          ? `\nRefund amount: $${cancellationInfo.refundAmount.toFixed(2)}`
          : ''
        }${cancellationInfo.driverCompensation > 0
          ? `\n\nDriver compensation: $${cancellationInfo.driverCompensation.toFixed(2)}`
          : ''
        }`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Ensure we close properly and then trigger success callback
              if (onCancelSuccess) onCancelSuccess();
              onClose();
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

  const renderHeader = (closeModal) => (
    <View style={styles.header}>
      <Text style={styles.title}>Cancel Order</Text>
      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height={SCREEN_HEIGHT * 0.8}
      backgroundColor="#141426"
      renderHeader={renderHeader}
      showHandle={true}
      handleStyle={{ backgroundColor: '#2A2A3B' }}
    >
      {() => (
        <View style={styles.content}>
          {cancellationInfo.canCancel ? (
            <>
              {/* Order Info */}
              <View style={styles.orderInfo}>
                <View style={styles.row}>
                  <Text style={styles.orderTitle}>Order Details</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: orderData.status === 'completed' ? 'rgba(0, 212, 170, 0.2)' : 'rgba(167, 123, 255, 0.2)' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: orderData.status === 'completed' ? '#00D4AA' : '#A77BFF' }
                    ]}>{orderData.status}</Text>
                  </View>
                </View>

                <View style={styles.routeContainer}>
                  <Ionicons name="ellipse" size={10} color="#00D4AA" style={{ marginRight: 8 }} />
                  <Text style={styles.orderRoute} numberOfLines={1}>
                    {orderData.pickup?.address || "Pickup"}
                  </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeContainer}>
                  <Ionicons name="location" size={12} color="#A77BFF" style={{ marginRight: 6 }} />
                  <Text style={styles.orderRoute} numberOfLines={1}>
                    {orderData.dropoff?.address || "Dropoff"}
                  </Text>
                </View>
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
                <Text style={styles.detailsTitle}>Summary</Text>

                {cancellationInfo.fee > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cancellation Fee</Text>
                    <Text style={[styles.detailValue, { color: '#FF6B6B' }]}>
                      -${cancellationInfo.fee.toFixed(2)}
                    </Text>
                  </View>
                )}

                {cancellationInfo.driverCompensation > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Driver Fee</Text>
                    <Text style={[styles.detailValue, { color: '#FF6B6B' }]}>
                      -${cancellationInfo.driverCompensation.toFixed(2)}
                    </Text>
                  </View>
                )}

                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Refund Amount</Text>
                  <Text style={styles.totalValue}>
                    ${cancellationInfo.refundAmount.toFixed(2)}
                  </Text>
                </View>

                {cancellationInfo.reason && (
                  <Text style={styles.reasonText}>
                    * {cancellationInfo.reason}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.keepButton}
                  onPress={onClose}
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
                    <Text style={styles.cancelButtonText}>Confirm Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.centerContent}>
              {/* Cannot Cancel */}
              <View style={styles.noCancelIcon}>
                <Ionicons name="close-circle" size={64} color="#FF6B6B" />
              </View>
              <Text style={styles.noCancelTitle}>Cancellation Unavailable</Text>
              <Text style={styles.noCancelMessage}>
                {cancellationInfo.reason || "This order cannot be cancelled at this stage."}
              </Text>

              <TouchableOpacity
                style={styles.okButton}
                onPress={onClose}
              >
                <Text style={styles.okButtonText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  orderInfo: {
    backgroundColor: '#222233',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeLine: {
    height: 12,
    width: 1,
    backgroundColor: '#333',
    marginLeft: 4.5, // Center with dot (10px -> center 5)
    marginVertical: 2,
  },
  orderRoute: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  warningText: {
    color: '#FF9500',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  detailsContainer: {
    backgroundColor: '#222233',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  detailsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
  },
  totalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#00D4AA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reasonText: {
    color: '#666',
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
  keepButton: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  keepButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: "#FF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButtonDisabled: {
    backgroundColor: '#552222',
    opacity: 0.7,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noCancelIcon: {
    marginBottom: 16,
    opacity: 0.9,
  },
  noCancelTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  noCancelMessage: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  okButton: {
    backgroundColor: '#2A2A3B',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CancelOrderModal;