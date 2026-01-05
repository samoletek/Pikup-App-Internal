import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OfflineDashboard({ onGoOnline, navigation }) {
  const { currentUser, getDriverSessionStats, getDriverStats } = useAuth();
  const [sessionStats, setSessionStats] = useState({
    totalEarnings: 0,
    tripsCompleted: 0,
    totalOnlineMinutes: 0,
    averageRating: 4.8
  });
  const [driverStats, setDriverStats] = useState({
    currentWeekTrips: 0,
    weeklyMilestone: 15
  });
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(240)); // Collapsed height

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      if (currentUser?.uid) {
        const stats = await getDriverSessionStats?.(currentUser.uid) || {};
        const weeklyStats = await getDriverStats?.(currentUser.uid) || {};
        
        setSessionStats({
          ...stats,
          averageRating: 4.8 // Default rating, can be enhanced later
        });
        
        setDriverStats({
          currentWeekTrips: weeklyStats.currentWeekTrips || 0,
          weeklyMilestone: 15
        });
        
        generateRecommendations(stats);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = (stats) => {
    const recs = [];
    const currentHour = new Date().getHours();
    
    // Peak hours recommendation
    if (currentHour >= 16 && currentHour <= 19) {
      recs.push({
        icon: 'time-outline',
        title: 'Peak Hours Active',
        description: 'High demand expected for next 2 hours',
        color: '#00D4AA'
      });
    }
    
    // Earnings goal progress
    const dailyGoal = 100;
    if ((stats.totalEarnings || 0) < dailyGoal) {
      const remaining = dailyGoal - (stats.totalEarnings || 0);
      const progress = Math.floor(((stats.totalEarnings || 0)/dailyGoal) * 100);
      recs.push({
        icon: 'trending-up-outline',
        title: `$${remaining.toFixed(2)} to Daily Goal`,
        description: `You're ${progress}% there`,
        color: '#00BFA6'
      });
    } else {
      recs.push({
        icon: 'checkmark-circle-outline',
        title: 'Daily Goal Achieved!',
        description: 'Great job! Keep earning more?',
        color: '#00D4AA'
      });
    }
    
    // High demand areas (placeholder data)
    const areas = ['Downtown', 'Midtown', 'Buckhead', 'Airport'];
    const randomArea = areas[Math.floor(Math.random() * areas.length)];
    recs.push({
      icon: 'location-outline',
      title: `High Demand: ${randomArea}`,
      description: 'More requests expected in this area',
      color: '#17A2A2'
    });
    
    setRecommendations(recs);
  };

  const formatDuration = (minutes) => {
    const total = minutes || 0;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleNavigation = (screen) => {
    if (navigation) {
      navigation.navigate(screen);
    }
  };

  const toggleExpanded = () => {
    const toValue = isExpanded ? 240 : SCREEN_HEIGHT * 0.83;
    setIsExpanded(!isExpanded);
    
    Animated.spring(animatedHeight, {
      toValue,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const milestoneProgress = Math.min((driverStats.currentWeekTrips / driverStats.weeklyMilestone) * 100, 100);
  const tripsRemaining = Math.max(driverStats.weeklyMilestone - driverStats.currentWeekTrips, 0);

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>      
      <LinearGradient colors={['#0A0A1F', '#141426']} style={styles.gradient}>
        
        {/* Collapsed View (unchanged) */}
        {!isExpanded && (
          <View style={styles.collapsedContainer}>
            <TouchableOpacity style={styles.collapsedContent} onPress={toggleExpanded}>
              <Text style={styles.waitTimeText}>5 to 11 min wait in your area</Text>
              <Text style={styles.waitSubtitle}>Average wait for pickup requests over the last hour</Text>
              
              <View style={styles.progressSection}>
                <Text style={styles.progressTitle}>Weekly Milestone</Text>
                <View style={styles.progressBarCollapsed}>
                  <View style={[styles.progressFillCollapsed, { width: `${milestoneProgress}%` }]} />
                </View>
                <Text style={styles.nextLevel}>
                  {driverStats.currentWeekTrips >= driverStats.weeklyMilestone 
                    ? 'Milestone achieved! $50 bonus earned'
                    : `${tripsRemaining} more trips for $50 bonus`
                  }
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.expandButton} onPress={toggleExpanded}>
              <Ionicons name="chevron-up" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Expanded View (restyled) */}
        {isExpanded && (
          <ScrollView style={styles.expandedContainer} showsVerticalScrollIndicator={false}>
            {/* Header with Close */}
            <View style={styles.expandedHeader}>
              <TouchableOpacity onPress={toggleExpanded} style={styles.closeButton}>
                <Ionicons name="chevron-down" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.expandedTitle}>Driver Dashboard</Text>
            </View>

            {/* Status */}
            <View style={[styles.sectionCard, styles.statusCard]}> 
              <View style={styles.statusIndicator}>
                <View style={styles.offlineIndicator} />
                <Text style={styles.statusText}>You're Offline</Text>
              </View>
              <Text style={styles.subtitle}>Ready to start earning?</Text>
            </View>

            {/* Weekly Milestone — mirrors Earnings screen layout with green accents */}
            <View style={[styles.sectionCard, styles.milestoneCard]}> 
              <View style={styles.milestoneHeader}>
                <View style={styles.milestoneLeft}>
                  <Ionicons name="trophy" size={22} color="#00D4AA" />
                  <View style={styles.milestoneTextWrap}>
                    <Text style={styles.milestoneTitle}>Weekly Milestone</Text>
                    <Text style={styles.milestoneSubtitle}>
                      {tripsRemaining > 0 ? `${tripsRemaining} more trips for $50 bonus` : 'Milestone achieved! $50 bonus earned'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.milestoneCount}>{driverStats.currentWeekTrips}/{driverStats.weeklyMilestone}</Text>
              </View>
              <View style={styles.progressRow}>
                <View style={styles.progressBar}> 
                  <View style={[styles.progressFill, { width: `${milestoneProgress}%` }]} />
                </View>
                <Text style={styles.progressPct}>{Math.round(milestoneProgress)}%</Text>
              </View>
            </View>

            {/* Today's Session Summary */}
            <View style={[styles.sectionCard, styles.sessionCard]}> 
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="calendar-outline" size={18} color="#00D4AA" />
                <Text style={styles.sectionTitle}>Today's Session</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>${(sessionStats.totalEarnings || 0).toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Earnings</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{sessionStats.tripsCompleted || 0}</Text>
                  <Text style={styles.statLabel}>Trips</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatDuration(sessionStats.totalOnlineMinutes)}</Text>
                  <Text style={styles.statLabel}>Online</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{(sessionStats.averageRating || 0).toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>
            </View>

            {/* Recommendations */}
            <View style={[styles.sectionCard, styles.recommendationsCard]}> 
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bulb-outline" size={18} color="#00D4AA" />
                <Text style={styles.sectionTitle}>Recommendations</Text>
              </View>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={[styles.recIcon, { backgroundColor: rec.color }]}>
                    <Ionicons name={rec.icon} size={18} color="#fff" />
                  </View>
                  <View style={styles.recContent}>
                    <Text style={styles.recTitle}>{rec.title}</Text>
                    <Text style={styles.recDescription}>{rec.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Quick Actions */}
            <View style={[styles.sectionCard, styles.actionsCard]}> 
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flash-outline" size={18} color="#00D4AA" />
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={styles.actionsGrid}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleNavigation('DriverEarningsScreen')}
                >
                  <Ionicons name="stats-chart-outline" size={22} color="#00D4AA" />
                  <Text style={styles.actionText}>Earnings</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleNavigation('CustomerPersonalInfoScreen')}
                >
                  <Ionicons name="person-outline" size={22} color="#00D4AA" />
                  <Text style={styles.actionText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleNavigation('DriverPreferencesScreen')}
                >
                  <Ionicons name="settings-outline" size={22} color="#00D4AA" />
                  <Text style={styles.actionText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleNavigation('CustomerHelpScreen')}
                >
                  <Ionicons name="help-circle-outline" size={22} color="#00D4AA" />
                  <Text style={styles.actionText}>Help</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 88 }} />
          </ScrollView>
        )}

        {/* Go Online Button - Always visible */}
        <TouchableOpacity 
          style={[styles.goOnlineButton, isExpanded && styles.goOnlineButtonExpanded]} 
          onPress={onGoOnline}
        >
          <LinearGradient colors={['#A77BFF', '#7B5BFF']} style={styles.goOnlineGradient}>
            <Ionicons name="radio-button-off" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.goOnlineText}>Go Online</Text>
          </LinearGradient>
        </TouchableOpacity>

      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  gradient: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  
  // Collapsed View Styles (kept same structure; minor token rename for clarity)
  collapsedContainer: {
    flex: 1,
    position: 'relative',
  },
  collapsedContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 68, // Make room for Go Online button
  },
  waitTimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    lineHeight: 22,
  },
  waitSubtitle: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 14,
    lineHeight: 16,
  },
  progressSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  progressTitle: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBarCollapsed: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden'
  },
  progressFillCollapsed: {
    height: 6,
    backgroundColor: '#A77BFF',
    borderRadius: 3,
  },
  nextLevel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  expandButton: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Expanded View Styles
  expandedContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingTop: 35,
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F33'
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },

  // Reusable Section Card (matches Earnings screen card feel)
  sectionCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Status
  statusCard: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  offlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    marginRight: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#ccc',
  },

  // Milestone (mirrors Earnings screen structure; uses green accents)
  milestoneCard: {},
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  milestoneTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  milestoneSubtitle: {
    fontSize: 13,
    color: '#9DA3AF',
  },
  milestoneCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00D4AA',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#2A2A3B',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00D4AA',
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00D4AA',
    minWidth: 36,
    textAlign: 'right',
  },

  // Session
  sessionCard: {},
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#00D4AA',
  },
  statLabel: {
    fontSize: 12,
    color: '#9DA3AF',
    marginTop: 4,
  },

  // Recommendations
  recommendationsCard: {},
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  recIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recContent: {
    flex: 1,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  recDescription: {
    fontSize: 12,
    color: '#9DA3AF',
    marginTop: 2,
  },

  // Actions
  actionsCard: {},
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A3A',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  actionText: {
    fontSize: 12,
    color: '#00D4AA',
    marginTop: 6,
    fontWeight: '600',
  },

  // Go Online Button
  goOnlineButton: {
    margin: 16,
    marginTop: 0,
  },
  goOnlineButtonExpanded: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    margin: 0,
  },
  goOnlineGradient: {
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goOnlineText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
});
