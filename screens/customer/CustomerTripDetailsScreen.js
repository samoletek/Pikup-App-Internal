import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ScreenHeader";
import { useAuth } from "../../contexts/AuthContext";
import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const BORDER_WIDTH = StyleSheet.hairlineWidth;
const ICON_SIZE_SMALL = typography.fontSize.sm + 2;
const ICON_SIZE_BASE = typography.fontSize.md;
const STATUS_CHIP_HORIZONTAL_PADDING = spacing.sm + 2;
const STATUS_CHIP_VERTICAL_PADDING = spacing.xs + 1;
const ROUTE_DIVIDER_OFFSET = spacing.sm - 1;
const ROUTE_DIVIDER_HEIGHT = spacing.lg - 2;
const BODY_LINE_HEIGHT = Math.round(
  typography.fontSize.base * typography.lineHeight.normal
);

const formatAmount = (value) => {
  if (typeof value === "string" && value.includes("$")) {
    return value;
  }

  const numeric = Number(value) || 0;
  return `$${numeric.toFixed(2)}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatSchedule = (value) => {
  if (!value) {
    return "ASAP";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const formatReason = (value) => {
  const raw = firstText(value);
  if (!raw) return "Not provided";
  if (raw === "customer_request") return "Cancelled by customer";

  return raw
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const statusMeta = (status) => {
  const normalized = normalizeTripStatus(status);

  if (normalized === TRIP_STATUS.COMPLETED) {
    return {
      label: "Completed",
      icon: "checkmark-circle",
      textColor: colors.success,
      chipBackground: colors.successLight,
    };
  }

  if (normalized === TRIP_STATUS.CANCELLED) {
    return {
      label: "Cancelled",
      icon: "close-circle",
      textColor: colors.error,
      chipBackground: colors.errorLight,
    };
  }

  return {
    label: "Archived",
    icon: "time-outline",
    textColor: colors.text.tertiary,
    chipBackground: colors.background.elevated,
  };
};

const toDisplayTrip = (trip, fallback) => {
  const source = trip || fallback || {};
  const pricingTotal = source.pricing?.total ?? source.price;

  const itemsFromArray = Array.isArray(source.items) ? source.items : [];
  const normalizedItem =
    typeof source.item === "string"
      ? { description: source.item }
      : source.item || null;
  const hasSingleItem = Boolean(normalizedItem);
  const itemsCount = itemsFromArray.length || (hasSingleItem ? 1 : 0);

  const primaryItem =
    normalizedItem?.description ||
    itemsFromArray[0]?.description ||
    firstText(source.item, source.tripItem) ||
    "Package";

  const pickupAddress = firstText(
    source.pickup?.address,
    source.pickupAddress,
    source.pickup
  ) || "Unknown pickup";

  const dropoffAddress = firstText(
    source.dropoff?.address,
    source.dropoffAddress,
    source.dropoff
  ) || "Unknown drop-off";

  const createdAt =
    source.createdAt || source.created_at || source.timestamp || source.date || null;

  const status = normalizeTripStatus(source.status);
  const meta = statusMeta(status);
  const id = source.id || fallback?.id || "Unknown";

  const driverNameRaw = firstText(
    source.driver,
    source.assignedDriverEmail,
    source.driverEmail
  );
  const driverName = driverNameRaw
    ? driverNameRaw.includes("@")
      ? driverNameRaw.split("@")[0]
      : driverNameRaw
    : "Not assigned";

  return {
    id,
    idShort: String(id).slice(0, 8).toUpperCase(),
    status,
    statusLabel: meta.label,
    statusIcon: meta.icon,
    statusTextColor: meta.textColor,
    statusChipBackground: meta.chipBackground,
    amountLabel: formatAmount(source.amount ?? pricingTotal),
    createdLabel: formatDateTime(createdAt),
    pickupAddress,
    dropoffAddress,
    vehicleType: firstText(source.vehicleType, source.vehicle?.type) || "Vehicle",
    scheduleLabel: formatSchedule(source.scheduledTime || source.scheduled_time),
    itemsCount,
    itemDescription: primaryItem,
    driverName,
    cancelledAt: source.cancelledAt || source.cancelled_at || null,
    cancellationReason: source.cancellationReason || source.cancellation_reason || null,
  };
};

export default function CustomerTripDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { getRequestById } = useAuth();

  const tripSummary = route?.params?.tripSummary || null;
  const initialSnapshot = route?.params?.tripSnapshot || tripSummary || null;
  const tripId = route?.params?.tripId || initialSnapshot?.id || null;
  const isMockTrip = String(tripId || "").startsWith("mock-");

  const [tripData, setTripData] = useState(initialSnapshot);
  const [loading, setLoading] = useState(!isMockTrip && Boolean(tripId));
  const [refreshing, setRefreshing] = useState(false);

  const displayTrip = useMemo(
    () => toDisplayTrip(tripData, tripSummary),
    [tripData, tripSummary]
  );

  const loadTrip = useCallback(
    async ({ refresh = false } = {}) => {
      if (!tripId || isMockTrip) {
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const latest = await getRequestById(tripId);
        if (latest) {
          setTripData(latest);
        }
      } catch (error) {
        console.error("Error loading trip details:", error);
      } finally {
        if (refresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [tripId, isMockTrip, getRequestById]
  );

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  if (loading && !tripData && !tripSummary) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Trip Details"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      </View>
    );
  }

  const infoRows = [
    { label: "Vehicle", value: displayTrip.vehicleType },
    {
      label: "Items",
      value: `${displayTrip.itemsCount} item${displayTrip.itemsCount === 1 ? "" : "s"}`,
    },
    { label: "Scheduled", value: displayTrip.scheduleLabel },
    { label: "Driver", value: displayTrip.driverName },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Trip Details"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTrip({ refresh: true })}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentColumn}>
          <LinearGradient
            colors={[colors.background.panel, colors.background.tertiary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: displayTrip.statusChipBackground },
                ]}
              >
                <Ionicons
                  name={displayTrip.statusIcon}
                  size={ICON_SIZE_SMALL}
                  color={displayTrip.statusTextColor}
                />
                <Text
                  style={[styles.statusChipText, { color: displayTrip.statusTextColor }]}
                >
                  {displayTrip.statusLabel}
                </Text>
              </View>

              <Text style={styles.amountText}>{displayTrip.amountLabel}</Text>
            </View>

            <Text style={styles.heroDateText}>{displayTrip.createdLabel}</Text>
            <Text style={styles.heroIdText}>Trip ID: {displayTrip.idShort}</Text>
          </LinearGradient>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Route</Text>
            <View style={styles.routeRow}>
              <Ionicons
                name="arrow-up-circle-outline"
                size={ICON_SIZE_BASE}
                color={colors.primary}
              />
              <Text style={styles.routeText}>{displayTrip.pickupAddress}</Text>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <Ionicons
                name="arrow-down-circle-outline"
                size={ICON_SIZE_BASE}
                color={colors.success}
              />
              <Text style={styles.routeText}>{displayTrip.dropoffAddress}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trip Information</Text>
            {infoRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Primary Item</Text>
            <Text style={styles.itemDescription}>{displayTrip.itemDescription}</Text>
          </View>

          {displayTrip.status === TRIP_STATUS.CANCELLED && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Cancellation</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reason</Text>
                <Text style={styles.infoValue}>
                  {formatReason(displayTrip.cancellationReason)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cancelled At</Text>
                <Text style={styles.infoValue}>
                  {formatDateTime(displayTrip.cancelledAt)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.base,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.full,
    paddingHorizontal: STATUS_CHIP_HORIZONTAL_PADDING,
    paddingVertical: STATUS_CHIP_VERTICAL_PADDING,
  },
  statusChipText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  amountText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  heroDateText: {
    marginTop: spacing.base,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  heroIdText: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  sectionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: BORDER_WIDTH,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDivider: {
    marginLeft: ROUTE_DIVIDER_OFFSET,
    marginVertical: spacing.sm,
    width: BORDER_WIDTH,
    height: ROUTE_DIVIDER_HEIGHT,
    backgroundColor: colors.border.strong,
  },
  routeText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: colors.border.strong,
  },
  infoLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  infoValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: spacing.base,
  },
  itemDescription: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
});
