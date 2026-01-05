import React, { useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  PanResponder, 
  Animated,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: screenHeight } = Dimensions.get('window');

export const OfflineModal = ({ onGoOnline, onClose }) => {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Close modal if dragged down enough
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            onClose && onClose();
          });
        } else {
          // Snap back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View 
      style={[
        styles.modalContent,
        {
          transform: [{ translateY }],
        }
      ]}
      {...panResponder.panHandlers}
    >
      {/* Drag Handle */}
      <View style={styles.dragHandle} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View style={styles.offlineDot} />
          <Text style={styles.statusText}>You're Offline</Text>
        </View>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Go online to start receiving pickup requests
      </Text>

      {/* Progress Section */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Ionicons name="trophy-outline" size={16} color="#A77BFF" />
          <Text style={styles.progressTitle}>Weekly Progress</Text>
        </View>
        
        <View style={styles.progressStats}>
          <Text style={styles.progressPoints}>220/500 points</Text>
          <Text style={styles.progressLevel}>Gold Level</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarFull}>
            <View style={[styles.progressBarFill, { width: '44%' }]} />
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color="#00D4AA" />
          <Text style={styles.statLabel}>Peak Hours</Text>
          <Text style={styles.statValue}>3-6 PM</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={16} color="#A77BFF" />
          <Text style={styles.statLabel}>Demand</Text>
          <Text style={styles.statValue}>High</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Ionicons name="cash-outline" size={16} color="#FFD700" />
          <Text style={styles.statLabel}>Bonus</Text>
          <Text style={styles.statValue}>+15%</Text>
        </View>
      </View>

      {/* Bonus Categories */}
      <View style={styles.bonusSection}>
        <View style={styles.bonusHeader}>
          <Ionicons name="gift-outline" size={16} color="#A77BFF" />
          <Text style={styles.sectionTitle}>Active Bonuses</Text>
        </View>
        
        <View style={styles.bonusGrid}>
          <View style={styles.bonusItem}>
            <Ionicons name="cube-outline" size={20} color="#00D4AA" />
            <Text style={styles.bonusText}>Furniture</Text>
            <Text style={styles.bonusPercent}>+10%</Text>
          </View>
          
          <View style={styles.bonusItem}>
            <Ionicons name="car-outline" size={20} color="#A77BFF" />
            <Text style={styles.bonusText}>Appliances</Text>
            <Text style={styles.bonusPercent}>+15%</Text>
          </View>
          
          <View style={styles.bonusItem}>
            <Ionicons name="people-outline" size={20} color="#FFD700" />
            <Text style={styles.bonusText}>Help Load</Text>
            <Text style={styles.bonusPercent}>+20%</Text>
          </View>
        </View>
      </View>

      {/* Go Online Button */}
      <TouchableOpacity style={styles.goOnlineBtn} onPress={onGoOnline}>
        <Ionicons name="radio-button-on" size={18} color="#fff" />
        <Text style={styles.goOnlineText}>Go Online</Text>
      </TouchableOpacity>

      {/* Tip */}
      <View style={styles.tipContainer}>
        <Ionicons name="information-circle-outline" size={14} color="#666" />
        <Text style={styles.tipText}>Swipe down to close • Tap outside to dismiss</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: screenHeight * 0.75, // Only take up 75% of screen
    borderWidth: 1,
    borderColor: '#2A2A3B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#141426',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  progressCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressPoints: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: '700',
  },
  progressLevel: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: 4,
  },
  progressBarFull: {
    height: 6,
    backgroundColor: '#2A2A3B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#A77BFF',
    borderRadius: 3,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2A3B',
    marginHorizontal: 12,
  },
  statLabel: {
    color: '#999',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bonusSection: {
    marginBottom: 20,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  bonusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bonusItem: {
    flex: 1,
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  bonusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  bonusPercent: {
    color: '#00D4AA',
    fontSize: 12,
    fontWeight: '700',
  },
  goOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A77BFF',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  goOnlineText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  tipText: {
    color: '#666',
    fontSize: 11,
    marginLeft: 6,
  },
});

// Add default export
export default OfflineModal;