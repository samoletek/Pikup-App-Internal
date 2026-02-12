import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { styles, SCREEN_HEIGHT } from './styles';
import { colors } from '../../styles/theme';

const COLLAPSED_HEIGHT = 200;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.75;

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
    const [isExpanded, setIsExpanded] = useState(false);
    const animatedHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const isExpandedRef = useRef(false); // For PanResponder

    const expand = useCallback(() => {
        setIsExpanded(true);
        isExpandedRef.current = true;
        Animated.parallel([
            Animated.spring(animatedHeight, {
                toValue: EXPANDED_HEIGHT,
                useNativeDriver: false,
                tension: 100,
                friction: 10,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0.5,
                duration: 300,
                useNativeDriver: false,
            }),
        ]).start();
    }, []);

    const collapse = useCallback(() => {
        setIsExpanded(false);
        isExpandedRef.current = false;
        Animated.parallel([
            Animated.spring(animatedHeight, {
                toValue: COLLAPSED_HEIGHT,
                useNativeDriver: false,
                tension: 100,
                friction: 10,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }),
        ]).start();
    }, []);

    // PanResponder for swipe gesture
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (!isExpandedRef.current && gestureState.dy < 0) {
                    // Swiping up from collapsed
                    const newHeight = Math.min(EXPANDED_HEIGHT, COLLAPSED_HEIGHT - gestureState.dy);
                    animatedHeight.setValue(newHeight);
                    backdropOpacity.setValue(Math.min(0.5, (-gestureState.dy / (EXPANDED_HEIGHT - COLLAPSED_HEIGHT)) * 0.5));
                } else if (isExpandedRef.current && gestureState.dy > 0) {
                    // Swiping down from expanded
                    const newHeight = Math.max(COLLAPSED_HEIGHT, EXPANDED_HEIGHT - gestureState.dy);
                    animatedHeight.setValue(newHeight);
                    backdropOpacity.setValue(Math.max(0, 0.5 - (gestureState.dy / (EXPANDED_HEIGHT - COLLAPSED_HEIGHT)) * 0.5));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (!isExpandedRef.current && gestureState.dy < -50) {
                    // Expand
                    setIsExpanded(true);
                    isExpandedRef.current = true;
                    Animated.parallel([
                        Animated.spring(animatedHeight, {
                            toValue: EXPANDED_HEIGHT,
                            useNativeDriver: false,
                            tension: 100,
                            friction: 10,
                        }),
                        Animated.timing(backdropOpacity, {
                            toValue: 0.5,
                            duration: 200,
                            useNativeDriver: false,
                        }),
                    ]).start();
                } else if (isExpandedRef.current && gestureState.dy > 50) {
                    // Collapse - set state FIRST, then animate
                    setIsExpanded(false);
                    isExpandedRef.current = false;
                    Animated.parallel([
                        Animated.spring(animatedHeight, {
                            toValue: COLLAPSED_HEIGHT,
                            useNativeDriver: false,
                            tension: 100,
                            friction: 10,
                        }),
                        Animated.timing(backdropOpacity, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: false,
                        }),
                    ]).start();
                } else {
                    // Snap back
                    const targetHeight = isExpandedRef.current ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
                    const targetOpacity = isExpandedRef.current ? 0.5 : 0;
                    Animated.parallel([
                        Animated.spring(animatedHeight, {
                            toValue: targetHeight,
                            useNativeDriver: false,
                            tension: 100,
                            friction: 10,
                        }),
                        Animated.timing(backdropOpacity, {
                            toValue: targetOpacity,
                            duration: 200,
                            useNativeDriver: false,
                        }),
                    ]).start();
                }
            },
        })
    ).current;

    const toggleExpanded = () => {
        if (isExpanded) {
            collapse();
        } else {
            expand();
        }
    };

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
                    averageRating: 4.8
                });

                setDriverStats({
                    currentWeekTrips: weeklyStats.currentWeekTrips || 0,
                    weeklyMilestone: 15
                });

                generateRecommendations(stats);
            }
        } catch (error) {
            console.error('Error loading session data:', error);
        }
    };

    const generateRecommendations = (stats) => {
        const recs = [];
        const currentHour = new Date().getHours();

        if (currentHour >= 16 && currentHour <= 19) {
            recs.push({
                icon: 'time-outline',
                title: 'Peak Hours Active',
                description: 'High demand expected for next 2 hours',
                color: colors.success
            });
        }

        const dailyGoal = 100;
        if ((stats.totalEarnings || 0) < dailyGoal) {
            const remaining = dailyGoal - (stats.totalEarnings || 0);
            const progress = Math.floor(((stats.totalEarnings || 0) / dailyGoal) * 100);
            recs.push({
                icon: 'trending-up-outline',
                title: `$${remaining.toFixed(2)} to Daily Goal`,
                description: `You're ${progress}% there`,
                color: colors.success
            });
        } else {
            recs.push({
                icon: 'checkmark-circle-outline',
                title: 'Daily Goal Achieved!',
                description: 'Great job! Keep earning more?',
                color: colors.success
            });
        }

        const areas = ['Downtown', 'Midtown', 'Buckhead', 'Airport'];
        const randomArea = areas[Math.floor(Math.random() * areas.length)];
        recs.push({
            icon: 'location-outline',
            title: `High Demand: ${randomArea}`,
            description: 'More requests expected in this area',
            color: colors.success
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

    const milestoneProgress = Math.min((driverStats.currentWeekTrips / driverStats.weeklyMilestone) * 100, 100);
    const tripsRemaining = Math.max(driverStats.weeklyMilestone - driverStats.currentWeekTrips, 0);
    const goOnlineButtonOpacity = animatedHeight.interpolate({
        inputRange: [COLLAPSED_HEIGHT, EXPANDED_HEIGHT],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    return (
        <>
            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, { opacity: backdropOpacity }]}
                pointerEvents={isExpanded ? 'auto' : 'none'}
            >
                <TouchableOpacity style={{ flex: 1 }} onPress={collapse} activeOpacity={1} />
            </Animated.View>

            {/* Dashboard */}
            <Animated.View style={[styles.container, { height: animatedHeight }]}>
                <LinearGradient colors={[colors.background.primary, colors.background.secondary]} style={styles.gradient}>

                    {/* Swipeable Handle Area */}
                    <View {...panResponder.panHandlers} style={styles.handleArea}>
                        <View style={styles.dragHandle} />
                    </View>

                    {/* Collapsed Peek - Progress Bar visible */}
                    {!isExpanded && (
                        <TouchableOpacity
                            style={styles.collapsedContainer}
                            onPress={toggleExpanded}
                            activeOpacity={0.9}
                        >
                            {/* Peek Content - Weekly Progress */}
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
                                        {tripsRemaining > 0
                                            ? `${tripsRemaining} more trips for $50 bonus`
                                            : 'Milestone achieved! $50 bonus earned'
                                        }
                                    </Text>
                                    <View style={styles.expandHint}>
                                        <Ionicons name="chevron-up" size={14} color={colors.text.muted} />
                                        <Text style={styles.expandHintText}>Tap for more</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Expanded View - Full Dashboard */}
                    {isExpanded && (
                        <>
                            {/* Header with Close */}
                            <View style={styles.expandedHeader}>
                                <View style={styles.headerSideSpacer} />
                                <Text style={styles.expandedTitle}>Driver Dashboard</Text>
                                <TouchableOpacity onPress={collapse} style={styles.closeBtn}>
                                    <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>


                                {/* Weekly Milestone */}
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

                                {/* Today's Session */}
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

                                {/* Recommendations */}
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

                                {/* Quick Actions */}
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

                    {/* Go Online Button - Always visible at bottom */}
                    <Animated.View
                        style={[styles.buttonContainer, { opacity: goOnlineButtonOpacity }]}
                        pointerEvents={isExpanded ? 'none' : 'auto'}
                    >
                        <TouchableOpacity onPress={onGoOnline} activeOpacity={0.8}>
                            <View style={styles.goOnlineBtn}>
                                <Ionicons name="radio-button-off" size={18} color={colors.text.primary} style={{ marginRight: 8 }} />
                                <Text style={styles.goOnlineText}>Go Online</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                </LinearGradient>
            </Animated.View>
        </>
    );
}
