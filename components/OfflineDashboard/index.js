// Offline Dashboard component: renders its UI and handles related interactions.
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthIdentity, useDriverActions } from '../../contexts/AuthContext';
import { logger } from '../../services/logger';
import OfflineDashboardBody from './OfflineDashboardBody';
import { styles, SCREEN_HEIGHT } from './styles';
import { colors } from '../../styles/theme';

export const COLLAPSED_HEIGHT = 200;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.75;

export default function OfflineDashboard({
    onGoOnline,
    onGoOnlineScheduled,
    navigation,
    onExpandedChange,
    isDriverGeoRestricted,
}) {
    const { currentUser } = useAuthIdentity();
    const { getDriverSessionStats, getDriverStats } = useDriverActions();
    const currentUserId = currentUser?.uid || currentUser?.id;
    const driverActionsRef = useRef({
        getDriverSessionStats,
        getDriverStats,
    });
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
    const onExpandedChangeRef = useRef(onExpandedChange);
    onExpandedChangeRef.current = onExpandedChange;

    useEffect(() => {
        driverActionsRef.current = {
            getDriverSessionStats,
            getDriverStats,
        };
    }, [getDriverSessionStats, getDriverStats]);

    const expand = useCallback(() => {
        setIsExpanded(true);
        isExpandedRef.current = true;
        onExpandedChangeRef.current?.(true);
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
    }, [animatedHeight, backdropOpacity]);

    const collapse = useCallback(() => {
        setIsExpanded(false);
        isExpandedRef.current = false;
        onExpandedChangeRef.current?.(false);
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
    }, [animatedHeight, backdropOpacity]);

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
                    onExpandedChangeRef.current?.(true);
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
                    onExpandedChangeRef.current?.(false);
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

    const buildRecommendations = useCallback((stats) => {
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

        return recs;
    }, []);

    useEffect(() => {
        if (!currentUserId) {
            return;
        }

        let cancelled = false;
        const loadSessionData = async () => {
            try {
                const sessionLoader = driverActionsRef.current.getDriverSessionStats;
                const statsLoader = driverActionsRef.current.getDriverStats;
                const stats = await sessionLoader?.(currentUserId) || {};
                const weeklyStats = await statsLoader?.(currentUserId) || {};

                if (cancelled) {
                    return;
                }

                setSessionStats({
                    ...stats,
                    averageRating: 4.8
                });

                setDriverStats({
                    currentWeekTrips: weeklyStats.currentWeekTrips || 0,
                    weeklyMilestone: 15
                });

                setRecommendations(buildRecommendations(stats));
            } catch (error) {
                if (!cancelled) {
                    logger.error('OfflineDashboard', 'Error loading session data', error);
                }
            }
        };

        void loadSessionData();
        return () => {
            cancelled = true;
        };
    }, [buildRecommendations, currentUserId]);

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
                    <OfflineDashboardBody
                        isExpanded={isExpanded}
                        toggleExpanded={toggleExpanded}
                        collapse={collapse}
                        panHandlers={panResponder.panHandlers}
                        driverStats={driverStats}
                        milestoneProgress={milestoneProgress}
                        tripsRemaining={tripsRemaining}
                        sessionStats={sessionStats}
                        recommendations={recommendations}
                        formatDuration={formatDuration}
                        handleNavigation={handleNavigation}
                        styles={styles}
                        colors={colors}
                    />

                    {/* Go Online Button - Always visible at bottom */}
                    <Animated.View
                        style={[styles.buttonContainer, { opacity: goOnlineButtonOpacity }]}
                        pointerEvents={isExpanded ? 'none' : 'auto'}
                    >
                        {isDriverGeoRestricted ? (
                            <View style={styles.buttonStack}>
                                <TouchableOpacity
                                    style={[styles.goOnlineBtn, styles.goOnlineBtnDisabled]}
                                    disabled
                                    activeOpacity={1}
                                >
                                    <View style={styles.lockedButtonContent}>
                                        <Ionicons name="lock-closed" size={14} color={colors.text.primary} />
                                        <Text style={styles.goOnlineTextDisabled}>Go Online</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.goOnlineBtn,
                                        styles.goOnlineScheduledBtn,
                                        styles.goOnlineBtnDisabled,
                                    ]}
                                    disabled
                                    activeOpacity={1}
                                >
                                    <View style={styles.lockedButtonContent}>
                                        <Ionicons name="lock-closed" size={14} color={colors.text.primary} />
                                        <Text style={styles.goOnlineTextDisabled}>
                                            Go Online Scheduled
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.buttonStack}>
                                <TouchableOpacity style={styles.goOnlineBtn} onPress={onGoOnline} activeOpacity={0.8}>
                                    <Text style={styles.goOnlineText}>Go Online</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.goOnlineBtn, styles.goOnlineScheduledBtn]}
                                    onPress={onGoOnlineScheduled}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.goOnlineScheduledText}>Go Online Scheduled</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>

                </LinearGradient>
            </Animated.View>
        </>
    );
}
