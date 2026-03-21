import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthIdentity, useTripActions } from "../../contexts/AuthContext";
import useTwoStageScrollSnap from "../../hooks/useTwoStageScrollSnap";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import AppInput from "../../components/ui/AppInput";
import {
  colors,
  spacing,
} from "../../styles/theme";
import {
  HEADER_ROW_HEIGHT,
  SEARCH_COLLAPSE_DISTANCE,
  TITLE_COLLAPSE_DISTANCE,
} from "./activity.constants";
import {
  ACTIVITY_FILTER,
  isActiveActivityTrip,
  isArchivedActivityTrip,
  isScheduledActivityTrip,
  matchActivityTripByFilter,
  statusColor,
  statusLabel,
} from "./activity.utils";
import useCustomerActivityData from "./useCustomerActivityData";
import styles from "./CustomerActivityScreen.styles";

export default function CustomerActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    scrollRef,
    scrollY,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
  } = useTwoStageScrollSnap({
    searchCollapseDistance: SEARCH_COLLAPSE_DISTANCE,
    titleCollapseDistance: TITLE_COLLAPSE_DISTANCE,
  });

  const { currentUser } = useAuthIdentity();
  const { getUserPickupRequests } = useTripActions();
  const {
    loading,
    searchText,
    setSearchText,
    trips,
    filteredTrips,
    fetchTrips,
  } = useCustomerActivityData({
    currentUser,
    getUserPickupRequests,
  });
  const [selectedFilter, setSelectedFilter] = useState(ACTIVITY_FILTER.ACTIVE);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [scrollRef]);

  const titleLockCompensation = scrollY.interpolate({
    inputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    outputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const handleTripPress = (trip) => {
    navigation.navigate("CustomerTripDetailsScreen", {
      tripId: trip.id,
      tripSummary: trip,
      tripSnapshot: trip.rawTrip || trip,
    });
  };

  const activeCount = useMemo(
    () => (Array.isArray(trips) ? trips : []).filter(isActiveActivityTrip).length,
    [trips]
  );
  const scheduledCount = useMemo(
    () => (Array.isArray(trips) ? trips : []).filter(isScheduledActivityTrip).length,
    [trips]
  );
  const archiveCount = useMemo(
    () => (Array.isArray(trips) ? trips : []).filter(isArchivedActivityTrip).length,
    [trips]
  );
  const displayedTrips = useMemo(
    () =>
      (Array.isArray(filteredTrips) ? filteredTrips : []).filter((trip) =>
        matchActivityTripByFilter(trip, selectedFilter)
      ),
    [filteredTrips, selectedFilter]
  );
  const filterTabs = useMemo(
    () => [
      { key: ACTIVITY_FILTER.ACTIVE, label: "Active", count: activeCount },
      { key: ACTIVITY_FILTER.SCHEDULED, label: "Scheduled", count: scheduledCount },
      { key: ACTIVITY_FILTER.ARCHIVE, label: "Archive", count: archiveCount },
    ],
    [activeCount, archiveCount, scheduledCount]
  );

  const renderFilter = ({ key, label, count }, index) => {
    const isActive = selectedFilter === key;
    const isLast = index === filterTabs.length - 1;
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.filterTab,
          !isLast && styles.filterTabSpaced,
          isActive && styles.filterTabActive,
        ]}
        onPress={() => setSelectedFilter(key)}
      >
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
        <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTripCard = (trip) => (
    <TouchableOpacity
      key={trip.id}
      style={styles.tripCard}
      activeOpacity={0.9}
      onPress={() => handleTripPress(trip)}
    >
      <View style={styles.tripHeader}>
        <View style={styles.statusRow}>
          <Ionicons
            name="time-outline"
            size={14}
            color={statusColor(trip.status, { scheduledTime: trip.scheduledTime })}
          />
          <Text
            style={[
              styles.statusText,
              { color: statusColor(trip.status, { scheduledTime: trip.scheduledTime }) },
            ]}
          >
            {statusLabel(trip.status, { scheduledTime: trip.scheduledTime })}
          </Text>
        </View>
        <Text style={styles.tripAmount}>{trip.amount}</Text>
      </View>

      <Text style={styles.tripDate}>{trip.dateLabel}</Text>

      <View style={styles.locationRow}>
        <Ionicons name="arrow-up-circle-outline" size={14} color={colors.primary} />
        <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
          {trip.pickup}
        </Text>
      </View>

      <View style={styles.locationRow}>
        <Ionicons name="arrow-down-circle-outline" size={14} color={colors.success} />
        <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
          {trip.dropoff}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>
          {trip.item}
        </Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {trip.driver}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;
  const emptyStateMinHeight = Math.max(
    280,
    windowHeight - headerHeight - HEADER_ROW_HEIGHT * 3 - insets.bottom - 120
  );
  const emptyStateTitle =
    selectedFilter === ACTIVITY_FILTER.ACTIVE
      ? "No active trips"
      : selectedFilter === ACTIVITY_FILTER.SCHEDULED
        ? "No scheduled trips"
        : "No archived trips";
  const emptyStateSubtitle =
    selectedFilter === ACTIVITY_FILTER.ACTIVE
      ? "Trips in progress will appear here"
      : selectedFilter === ACTIVITY_FILTER.SCHEDULED
        ? "Accepted scheduled trips will appear here"
        : "Completed and cancelled trips will appear here";

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Activity"
        topInset={insets.top}
        showBack={false}
        scrollY={scrollY}
        searchCollapseDistance={SEARCH_COLLAPSE_DISTANCE}
        titleCollapseDistance={TITLE_COLLAPSE_DISTANCE}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 90,
          paddingHorizontal: spacing.base,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchTrips}
            tintColor={colors.primary}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.largeTitleSection,
            { transform: [{ translateY: titleLockCompensation }] },
          ]}
        >
          <Text style={styles.largeTitle}>Activity</Text>
        </Animated.View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.text.tertiary} />
            <AppInput
              containerStyle={styles.searchInputContainer}
              inputStyle={styles.searchInput}
              placeholder="Search trips"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterRow}>{filterTabs.map(renderFilter)}</View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your trips...</Text>
          </View>
        ) : displayedTrips.length > 0 ? (
          displayedTrips.map(renderTripCard)
        ) : (
          <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
            <Ionicons name="file-tray-outline" size={56} color={colors.border.strong} />
            <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptyStateSubtitle}</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
