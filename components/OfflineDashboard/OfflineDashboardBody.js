import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineDashboardBody({
  isExpanded,
  toggleExpanded,
  collapse,
  panHandlers,
  driverStats,
  milestoneProgress,
  tripsRemaining,
  sessionStats,
  recommendations,
  formatDuration,
  handleNavigation,
  styles,
  colors,
}) {
  return (
    <>
      <View {...panHandlers} style={styles.handleArea}>
        <View style={styles.dragHandle} />
      </View>

      {!isExpanded && (
        <TouchableOpacity style={styles.collapsedContainer} onPress={toggleExpanded} activeOpacity={0.9}>
          <View style={styles.peekContent}>
            <View style={styles.peekHeader}>
              <View style={styles.peekLeft}>
                <Ionicons name="trophy" size={18} color={colors.primary} />
                <Text style={styles.peekTitle}>Weekly Milestone</Text>
              </View>
              <Text style={styles.peekProgress}>{driverStats.currentWeekTrips}/{driverStats.weeklyMilestone}</Text>
            </View>

            <View style={styles.progressBarSmall}>
              <View style={[styles.progressFillSmall, { width: `${milestoneProgress}%` }]} />
            </View>

            <View style={styles.peekFooter}>
              <Text style={styles.peekSubtitle}>
                {tripsRemaining > 0 ? `${tripsRemaining} more trips for $50 bonus` : 'Milestone achieved! $50 bonus earned'}
              </Text>
              <View style={styles.expandHint}>
                <Ionicons name="chevron-up" size={14} color={colors.text.muted} />
                <Text style={styles.expandHintText}>Tap for more</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {isExpanded && (
        <>
          <View style={styles.expandedHeader}>
            <View style={styles.headerSideSpacer} />
            <Text style={styles.expandedTitle}>Driver Dashboard</Text>
            <TouchableOpacity onPress={collapse} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionCard}>
              <View style={styles.milestoneHeader}>
                <View style={styles.milestoneLeft}>
                  <Ionicons name="trophy" size={22} color={colors.success} />
                  <View style={styles.milestoneTextWrap}>
                    <Text style={styles.milestoneTitle}>Weekly Milestone</Text>
                    <Text style={styles.milestoneSubtitle}>
                      {tripsRemaining > 0 ? `${tripsRemaining} more trips for $50 bonus` : 'Milestone achieved!'}
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

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.success} />
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

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bulb-outline" size={18} color={colors.success} />
                <Text style={styles.sectionTitle}>Recommendations</Text>
              </View>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={[styles.recIcon, { backgroundColor: rec.color }]}>
                    <Ionicons name={rec.icon} size={18} color={colors.text.primary} />
                  </View>
                  <View style={styles.recContent}>
                    <Text style={styles.recTitle}>{rec.title}</Text>
                    <Text style={styles.recDescription}>{rec.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flash-outline" size={18} color={colors.success} />
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DriverEarningsScreen')}>
                  <Ionicons name="stats-chart-outline" size={22} color={colors.success} />
                  <Text style={styles.actionText}>Earnings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('PersonalInfoScreen')}>
                  <Ionicons name="person-outline" size={22} color={colors.success} />
                  <Text style={styles.actionText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('DriverMessagesScreen')}>
                  <Ionicons name="chatbubbles-outline" size={22} color={colors.success} />
                  <Text style={styles.actionText}>Messages</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleNavigation('CustomerHelpScreen')}>
                  <Ionicons name="help-circle-outline" size={22} color={colors.success} />
                  <Text style={styles.actionText}>Help</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
    </>
  );
}
