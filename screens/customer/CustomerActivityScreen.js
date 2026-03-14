import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";
import {
  TRIP_STATUS,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import { appConfig } from "../../config/appConfig";

const HEADER_ROW_HEIGHT = 56;

// TODO(cleanup): Remove mock fallback before production release.
// This data is only for local UI development when no trips are returned.
const MOCK_TRIPS = [
  {
    id: "mock-trip-1",
    status: TRIP_STATUS.COMPLETED,
    dateLabel: "Jan 15, 2026",
    pickup: "123 Main Street, Los Angeles, CA 90012",
    dropoff: "456 Oak Avenue, Beverly Hills, CA 90210",
    item: "Small Package",
    driver: "Michael",
    amount: "$24.50",
    timestamp: "2026-01-15T14:30:00Z",
  },
  {
    id: "mock-trip-2",
    status: TRIP_STATUS.COMPLETED,
    dateLabel: "Jan 12, 2026",
    pickup: "789 Sunset Blvd, West Hollywood, CA 90069",
    dropoff: "321 Wilshire Blvd, Santa Monica, CA 90401",
    item: "Documents",
    driver: "Sarah",
    amount: "$18.75",
    timestamp: "2026-01-12T10:15:00Z",
  },
  {
    id: "mock-trip-3",
    status: TRIP_STATUS.CANCELLED,
    dateLabel: "Jan 10, 2026",
    pickup: "555 Hollywood Blvd, Hollywood, CA 90028",
    dropoff: "888 Venice Beach, Venice, CA 90291",
    item: "Electronics",
    driver: "James",
    amount: "$0.00",
    timestamp: "2026-01-10T16:45:00Z",
  },
  {
    id: "mock-trip-4",
    status: TRIP_STATUS.COMPLETED,
    dateLabel: "Jan 8, 2026",
    pickup: "200 Downtown LA, Los Angeles, CA 90015",
    dropoff: "400 Pasadena Ave, Pasadena, CA 91101",
    item: "Fragile Box",
    driver: "Emma",
    amount: "$32.00",
    timestamp: "2026-01-08T09:00:00Z",
  },
  {
    id: "mock-trip-5",
    status: TRIP_STATUS.CANCELLED,
    dateLabel: "Jan 5, 2026",
    pickup: "100 Century City, Los Angeles, CA 90067",
    dropoff: "700 Marina del Rey, Marina del Rey, CA 90292",
    item: "Gift Package",
    driver: "David",
    amount: "$0.00",
    timestamp: "2026-01-05T13:20:00Z",
  },
];
const ENABLE_DEV_MOCK_ACTIVITY = appConfig.devMocks.enabled;
const SEARCH_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TOTAL_COLLAPSE_DISTANCE =
  SEARCH_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;

const formatDate = (value) => {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} min ago`;
  }
  if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)} hr ago`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCurrencyLabel = (amount) => {
  const normalizedAmount = Number(amount) || 0;
  return `$${normalizedAmount.toFixed(2)}`;
};

const statusLabel = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  if (normalizedStatus === TRIP_STATUS.COMPLETED) {
    return "Completed";
  }
  if (normalizedStatus === TRIP_STATUS.CANCELLED) {
    return "Cancelled";
  }
  return "Archived";
};

const statusColor = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  if (normalizedStatus === TRIP_STATUS.COMPLETED) {
    return colors.success;
  }
  if (normalizedStatus === TRIP_STATUS.CANCELLED) {
    return colors.error;
  }
  return colors.text.tertiary;
};

export default function CustomerActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const { getUserPickupRequests, currentUser } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  const fetchTrips = async () => {
    if (!currentUser) {
      setTrips([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTrips = await getUserPickupRequests();
      const tripsList = Array.isArray(userTrips) ? userTrips : [];
      const normalizedTrips = tripsList
        .map((trip) => {
          const completedAt = trip.completedAt || trip.completed_at || null;
          const createdAt = trip.createdAt || trip.created_at || null;
          const timestamp = completedAt || createdAt || new Date().toISOString();
          const amountValue = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;

          return {
            id: trip.id,
            status: normalizeTripStatus(trip.status),
            dateLabel: formatDate(timestamp),
            pickup: trip.pickup?.address || trip.pickupAddress || "Unknown pickup",
            dropoff: trip.dropoff?.address || trip.dropoffAddress || "Unknown drop-off",
            item: trip.item?.description || "Package",
            driver:
              (trip.assignedDriverEmail || trip.driverEmail || "Driver")
                .split("@")[0],
            amount: formatCurrencyLabel(amountValue),
            timestamp,
            rawTrip: trip,
          };
        })
        .filter((trip) => trip.status === TRIP_STATUS.COMPLETED || trip.status === TRIP_STATUS.CANCELLED)
        .sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

      // TODO(cleanup): Remove MOCK_TRIPS fallback and show proper empty state only.
      setTrips(
        normalizedTrips.length > 0
          ? normalizedTrips
          : ENABLE_DEV_MOCK_ACTIVITY
            ? MOCK_TRIPS
            : []
      );
    } catch (error) {
      console.error("Error fetching trips:", error);
      Alert.alert("Unable to Load Activity", "Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [currentUser]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const filteredTrips = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return trips;
    }

    return trips.filter((trip) => {
      const haystack = [
        trip.pickup,
        trip.dropoff,
        trip.item,
        trip.driver,
        statusLabel(trip.status),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchText, trips]);

  const titleLockCompensation = scrollY.interpolate({
    inputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    outputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TOTAL_COLLAPSE_DISTANCE) {
      return null;
    }

    if (offsetY < SEARCH_COLLAPSE_DISTANCE) {
      return offsetY < SEARCH_COLLAPSE_DISTANCE / 2
        ? 0
        : SEARCH_COLLAPSE_DISTANCE;
    }

    const titleProgress = offsetY - SEARCH_COLLAPSE_DISTANCE;
    return titleProgress < TITLE_COLLAPSE_DISTANCE / 2
      ? SEARCH_COLLAPSE_DISTANCE
      : TOTAL_COLLAPSE_DISTANCE;
  };

  const snapToNearestOffset = (offsetY) => {
    const targetOffset = getSnapOffset(offsetY);
    if (targetOffset === null || Math.abs(targetOffset - offsetY) < 1) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    isSnappingRef.current = true;
    scrollRef.current.scrollTo({ y: targetOffset, animated: true });
    setTimeout(() => {
      isSnappingRef.current = false;
    }, 220);
  };

  const handleScrollEndDrag = (event) => {
    if (isSnappingRef.current) {
      return;
    }

    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.15) {
      snapToNearestOffset(event.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollEnd = (event) => {
    if (isSnappingRef.current) {
      return;
    }
    snapToNearestOffset(event.nativeEvent.contentOffset.y);
  };

  const handleTripPress = (trip) => {
    navigation.navigate("CustomerTripDetailsScreen", {
      tripId: trip.id,
      tripSummary: trip,
      tripSnapshot: trip.rawTrip || trip,
    });
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
            color={statusColor(trip.status)}
          />
          <Text style={[styles.statusText, { color: statusColor(trip.status) }]}>
            {statusLabel(trip.status)}
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
    windowHeight - headerHeight - HEADER_ROW_HEIGHT * 2 - insets.bottom - 120
  );

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
            <TextInput
              style={styles.searchInput}
              placeholder="Search trips"
              placeholderTextColor={colors.text.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your trips...</Text>
          </View>
        ) : filteredTrips.length > 0 ? (
          filteredTrips.map(renderTripCard)
        ) : (
          <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
            <Ionicons name="file-tray-outline" size={56} color={colors.border.strong} />
            <Text style={styles.emptyTitle}>No past trips yet</Text>
            <Text style={styles.emptySubtitle}>
              Completed and cancelled trips will appear here
            </Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  largeTitleSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
    zIndex: 2,
  },
  largeTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },
  searchSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    zIndex: 1,
    marginBottom: spacing.sm,
  },
  searchBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  tripAmount: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  tripDate: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  locationRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    flexShrink: 1,
  },
  metaDot: {
    color: colors.text.tertiary,
    marginHorizontal: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    marginTop: spacing.base,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    marginTop: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});
