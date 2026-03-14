import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenHeader from "../../components/ScreenHeader";
import MediaViewer from "../../components/MediaViewer";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { DRIVER_RATING_BADGES } from "../../constants/ratingBadges";
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
const STAR_SIZE = 32;
const PHOTO_PREVIEW_SIZE = 112;
const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6;
const TRIP_DETAILS_AUTO_SYNC_INTERVAL_MS = 5000;

const STATUS_STEPS = Object.freeze([
  {
    key: TRIP_STATUS.ACCEPTED,
    label: "Delivery Confirmed",
    icon: "checkmark-circle",
    description: "Your driver accepted the trip request.",
  },
  {
    key: TRIP_STATUS.IN_PROGRESS,
    label: "On the way to you",
    icon: "car-sport",
    description: "Driver is heading to your pickup location.",
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_PICKUP,
    label: "Driver arrived",
    icon: "location",
    description: "Driver is waiting at the pickup point.",
  },
  {
    key: TRIP_STATUS.PICKED_UP,
    label: "Package collected",
    icon: "cube",
    description: "Your items are loaded and secured.",
  },
  {
    key: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    label: "On the way to destination",
    icon: "navigate",
    description: "Package is in transit to drop-off.",
  },
  {
    key: TRIP_STATUS.ARRIVED_AT_DROPOFF,
    label: "Arrived at destination",
    icon: "home",
    description: "Driver reached the delivery destination.",
  },
  {
    key: TRIP_STATUS.COMPLETED,
    label: "Delivered",
    icon: "checkmark-circle",
    description: "Delivery was completed successfully.",
  },
]);

const STEP_INDEX_BY_STATUS = Object.freeze(
  STATUS_STEPS.reduce((acc, step, index) => {
    acc[step.key] = index;
    return acc;
  }, {})
);

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === "object") {
          return [parsed];
        }
      } catch (_) {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
};

const getPickupPhotoCandidates = (source) => {
  return (
    source.pickupPhotos ||
    source.pickup_photos ||
    source.photos ||
    source.pickup?.photos ||
    source.pickup?.details?.photos ||
    []
  );
};

const getDropoffPhotoCandidates = (source) => {
  return (
    source.dropoffPhotos ||
    source.dropoff_photos ||
    source.deliveryPhotos ||
    source.delivery_photos ||
    source.dropoff?.photos ||
    source.dropoff?.details?.photos ||
    []
  );
};

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

const getRatingLabel = (rating) => {
  if (rating >= 5) return "Excellent";
  if (rating >= 4) return "Great";
  if (rating >= 3) return "Good";
  if (rating >= 2) return "Fair";
  return "Needs improvement";
};

const normalizeRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(5, Math.max(0, Math.round(parsed)));
};

const normalizeBadgeIds = (value) => {
  const parsed = toArray(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(parsed));
};

const resolvePhotoUri = (photo) => {
  if (!photo) {
    return null;
  }

  if (typeof photo === "string") {
    const raw = photo.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        return resolvePhotoUri(JSON.parse(raw));
      } catch (_) {
        return null;
      }
    }

    if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:image\/)/i.test(raw)) {
      return raw;
    }

    const normalizedPath = raw.replace(/^\/+/, "").replace(/^trip_photos\//, "");
    const { data } = supabase.storage.from("trip_photos").getPublicUrl(normalizedPath);
    return data?.publicUrl || null;
  }

  if (Array.isArray(photo)) {
    return resolvePhotoUri(photo[0]);
  }

  if (typeof photo === "object") {
    const candidates = [
      photo.uri,
      photo.url,
      photo.photo_url,
      photo.publicUrl,
      photo.public_url,
      photo.imageUrl,
      photo.image_url,
      photo.secure_url,
      photo.path,
      photo.storagePath,
      photo.storage_path,
      photo.filePath,
      photo.file_path,
      photo.source?.uri,
      photo.asset?.uri,
    ];

    for (const candidate of candidates) {
      const resolved = resolvePhotoUri(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

const resolvePhotoUris = (photos = []) => {
  return toArray(photos).map(resolvePhotoUri).filter(Boolean);
};

const extractTripPhotoPath = (uri) => {
  if (typeof uri !== "string") {
    return null;
  }

  const raw = uri.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("trip_photos/")) {
    return raw.replace(/^trip_photos\//, "");
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const match = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/trip_photos\/([^?]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  if (raw.includes("/") && !raw.startsWith("file://") && !raw.startsWith("content://")) {
    return raw.replace(/^\/+/, "");
  }

  return null;
};

const toSignedTripPhotoUri = async (uri) => {
  const path = extractTripPhotoPath(uri);
  if (!path) {
    return uri;
  }

  try {
    const { data, error } = await supabase.storage
      .from("trip_photos")
      .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (error) {
    console.warn("Unable to sign trip photo URL, falling back to original URI:", error);
  }

  return uri;
};

const resolvePhotoUrisAsync = async (photos = []) => {
  const candidates = resolvePhotoUris(photos);
  if (candidates.length === 0) {
    return [];
  }

  const signedUris = await Promise.all(candidates.map((uri) => toSignedTripPhotoUri(uri)));
  return signedUris.filter(Boolean);
};

const getProgressIndex = (status) => {
  const normalizedStatus = normalizeTripStatus(status);
  const index = STEP_INDEX_BY_STATUS[normalizedStatus];
  return Number.isInteger(index) ? index : -1;
};

const getProgressStep = (status) => {
  const step = STATUS_STEPS.find((item) => item.key === normalizeTripStatus(status));
  return step || null;
};

const statusMeta = (status) => {
  const normalized = normalizeTripStatus(status);
  const activeStep = getProgressStep(normalized);

  if (normalized === TRIP_STATUS.CANCELLED) {
    return {
      label: "Cancelled",
      icon: "close-circle",
      textColor: colors.error,
      chipBackground: colors.errorLight,
    };
  }

  if (activeStep) {
    return {
      label: activeStep.label,
      icon: activeStep.icon,
      textColor: normalized === TRIP_STATUS.COMPLETED ? colors.success : colors.primary,
      chipBackground: normalized === TRIP_STATUS.COMPLETED ? colors.successLight : colors.primaryLight,
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
  const id = String(source.id || fallback?.id || "Unknown");

  const driverNameRaw = firstText(
    source.driver,
    source.assignedDriverEmail,
    source.driverEmail,
    source.driver_email
  );
  const driverName = driverNameRaw
    ? driverNameRaw.includes("@")
      ? driverNameRaw.split("@")[0]
      : driverNameRaw
    : "Not assigned";
  const driverId =
    source.assignedDriverId ||
    source.driverId ||
    source.driver_id ||
    source.assigned_driver_id ||
    null;

  const pickupPhotos = toArray(getPickupPhotoCandidates(source));
  const dropoffPhotos = toArray(getDropoffPhotoCandidates(source));
  const progressIndex = getProgressIndex(status);
  const progressStep = progressIndex >= 0 ? STATUS_STEPS[progressIndex] : null;

  return {
    id,
    idShort: id.slice(0, 8).toUpperCase(),
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
    driverId,
    pickupPhotos,
    dropoffPhotos,
    progressIndex,
    progressStep,
    cancelledAt: source.cancelledAt || source.cancelled_at || null,
    cancellationReason: source.cancellationReason || source.cancellation_reason || null,
  };
};

const PhotoGallerySection = ({ title, photos, emptyLabel, onOpenPhoto }) => {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoScrollContent}
        >
          {photos.map((photoUri, index) => (
            <View key={`${title}-${index}`} style={styles.photoTile}>
              <TouchableOpacity
                style={styles.photoTilePressable}
                activeOpacity={0.9}
                onPress={() => onOpenPhoto?.(photoUri)}
              >
                <Image source={{ uri: photoUri }} style={styles.photoTileImage} resizeMode="cover" />
              </TouchableOpacity>
              <View style={styles.photoTileBadge}>
                <Text style={styles.photoTileBadgeText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.sectionHint}>{emptyLabel}</Text>
      )}
    </View>
  );
};

export default function CustomerTripDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser, getRequestById, submitTripRating, refreshProfile } = useAuth();

  const tripSummary = route?.params?.tripSummary || null;
  const initialSnapshot = route?.params?.tripSnapshot || tripSummary || null;
  const tripId = route?.params?.tripId || initialSnapshot?.id || null;
  const isMockTrip = String(tripId || "").startsWith("mock-");

  const [tripData, setTripData] = useState(initialSnapshot);
  const [loading, setLoading] = useState(!isMockTrip && Boolean(tripId));
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState(0);
  const [selectedBadges, setSelectedBadges] = useState([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [existingTripFeedback, setExistingTripFeedback] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);

  const displayTrip = useMemo(
    () => toDisplayTrip(tripData, tripSummary),
    [tripData, tripSummary]
  );

  const [pickupPhotoUris, setPickupPhotoUris] = useState([]);
  const [dropoffPhotoUris, setDropoffPhotoUris] = useState([]);

  const currentUserId = currentUser?.uid || currentUser?.id || null;
  const isTripCompleted = displayTrip.status === TRIP_STATUS.COMPLETED;
  const isRatingReadOnly = isRatingSubmitted || Boolean(existingTripFeedback?.id);
  const canSubmitRating =
    isTripCompleted &&
    Boolean(displayTrip.driverId) &&
    !isRatingReadOnly &&
    rating >= 1 &&
    !isSubmittingRating;

  const loadTrip = useCallback(
    async ({ refresh = false, silent = false } = {}) => {
      if (!tripId || isMockTrip) {
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
      }

      try {
        const latest = await getRequestById(tripId);
        if (latest) {
          setTripData((prev) => ({ ...(prev || {}), ...latest }));
        }
      } catch (error) {
        console.error("Error loading trip details:", error);
      } finally {
        if (refresh) {
          setRefreshing(false);
        } else if (!silent) {
          setLoading(false);
        }
      }
    },
    [tripId, isMockTrip, getRequestById]
  );

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!tripId || isMockTrip) {
      return undefined;
    }

    let refreshTimer = null;
    const scheduleRefresh = (delayMs = 120) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        loadTrip({ silent: true });
      }, delayMs);
    };

    const channel = supabase
      .channel(`customer-trip-details-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          const nextTrip = payload?.new;
          if (nextTrip && typeof nextTrip === "object") {
            setTripData((prev) => ({ ...(prev || {}), ...nextTrip }));
          }
          scheduleRefresh();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`Trip details realtime ${status.toLowerCase()} for ${tripId}`);
        }
      });

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [tripId, isMockTrip, loadTrip]);

  useEffect(() => {
    if (!tripId || isMockTrip) {
      return undefined;
    }

    const normalizedStatus = normalizeTripStatus(displayTrip.status);
    if (normalizedStatus === TRIP_STATUS.COMPLETED || normalizedStatus === TRIP_STATUS.CANCELLED) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadTrip({ silent: true });
    }, TRIP_DETAILS_AUTO_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [tripId, isMockTrip, displayTrip.status, loadTrip]);

  const loadExistingTripFeedback = useCallback(async () => {
    if (!isTripCompleted || !displayTrip.id || !currentUserId) {
      setExistingTripFeedback(null);
      setRating(0);
      setSelectedBadges([]);
      setIsRatingSubmitted(false);
      return;
    }

    try {
      let feedbackRows = [];
      const primaryResult = await supabase
        .from("feedbacks")
        .select("id,request_id,user_id,rating,badges,created_at")
        .eq("request_id", displayTrip.id)
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (primaryResult.error) {
        const errorMessage = String(primaryResult.error?.message || "").toLowerCase();
        if (!errorMessage.includes("badges")) {
          throw primaryResult.error;
        }

        const fallbackResult = await supabase
          .from("feedbacks")
          .select("id,request_id,user_id,rating,created_at")
          .eq("request_id", displayTrip.id)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (fallbackResult.error) {
          throw fallbackResult.error;
        }

        feedbackRows = Array.isArray(fallbackResult.data) ? fallbackResult.data : [];
      } else {
        feedbackRows = Array.isArray(primaryResult.data) ? primaryResult.data : [];
      }

      const latestFeedback = feedbackRows[0] || null;
      if (!latestFeedback) {
        setExistingTripFeedback(null);
        setRating(0);
        setSelectedBadges([]);
        setIsRatingSubmitted(false);
        return;
      }

      const savedRating = normalizeRating(latestFeedback.rating);
      const savedBadges = normalizeBadgeIds(latestFeedback.badges);

      setExistingTripFeedback(latestFeedback);
      setRating(savedRating);
      setSelectedBadges(savedBadges);
      setIsRatingSubmitted(savedRating > 0);
    } catch (error) {
      console.error("Error loading existing trip rating:", error);
      setExistingTripFeedback(null);
      setRating(0);
      setSelectedBadges([]);
      setIsRatingSubmitted(false);
    }
  }, [currentUserId, displayTrip.id, isTripCompleted]);

  useEffect(() => {
    loadExistingTripFeedback();
  }, [loadExistingTripFeedback]);

  useEffect(() => {
    let isCancelled = false;

    const loadPickupPhotoUris = async () => {
      const resolved = await resolvePhotoUrisAsync(displayTrip.pickupPhotos);
      if (!isCancelled) {
        setPickupPhotoUris(resolved);
      }
    };

    loadPickupPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [displayTrip.id, displayTrip.pickupPhotos]);

  useEffect(() => {
    let isCancelled = false;

    const loadDropoffPhotoUris = async () => {
      const resolved = await resolvePhotoUrisAsync(displayTrip.dropoffPhotos);
      if (!isCancelled) {
        setDropoffPhotoUris(resolved);
      }
    };

    loadDropoffPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [displayTrip.id, displayTrip.dropoffPhotos]);

  const toggleBadge = useCallback(
    (badgeId) => {
      if (isRatingReadOnly) {
        return;
      }

      setSelectedBadges((prev) => {
        if (prev.includes(badgeId)) {
          return prev.filter((id) => id !== badgeId);
        }
        return [...prev, badgeId];
      });
    },
    [isRatingReadOnly]
  );

  const submitDriverRating = useCallback(async () => {
    if (!isTripCompleted || !displayTrip.id || !displayTrip.driverId) {
      Alert.alert("Rating unavailable", "Driver details are missing for this trip.");
      return;
    }

    if (rating < 1) {
      Alert.alert("Select rating", "Please tap at least one star.");
      return;
    }

    try {
      setIsSubmittingRating(true);
      const result = await submitTripRating({
        requestId: displayTrip.id,
        toUserId: displayTrip.driverId,
        toUserType: "driver",
        rating,
        badges: selectedBadges,
      });

      await refreshProfile?.();

      if (result?.alreadySubmitted) {
        await loadExistingTripFeedback();
        Alert.alert("Rating already submitted", "You already rated this trip.");
        return;
      }

      setExistingTripFeedback({
        id: result?.feedbackId || `local-${displayTrip.id}`,
        request_id: displayTrip.id,
        user_id: currentUserId,
        rating,
        badges: selectedBadges,
      });
      setIsRatingSubmitted(true);
      Alert.alert("Thanks for your feedback", "Your rating has been saved.");
    } catch (error) {
      console.error("Error submitting trip rating from details:", error);
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    } finally {
      setIsSubmittingRating(false);
    }
  }, [
    currentUserId,
    displayTrip.driverId,
    displayTrip.id,
    isTripCompleted,
    loadExistingTripFeedback,
    rating,
    refreshProfile,
    selectedBadges,
    submitTripRating,
  ]);

  const handleOpenPhotoViewer = useCallback((uri) => {
    if (!uri) {
      return;
    }
    setViewerUri(uri);
    setViewerVisible(true);
  }, []);

  const handleClosePhotoViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerUri(null);
  }, []);

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

          {!isTripCompleted ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Trip Status</Text>

              {displayTrip.progressStep ? (
                <View style={styles.progressList}>
                  {STATUS_STEPS.map((step, index) => {
                    const isCompleted = displayTrip.progressIndex > index;
                    const isCurrent = displayTrip.progressIndex === index;
                    const isReached = displayTrip.progressIndex >= index;

                    return (
                      <View key={step.key} style={styles.progressStepRow}>
                        <View style={styles.progressStepRail}>
                          <View
                            style={[
                              styles.progressStepIconWrap,
                              isReached && styles.progressStepIconWrapReached,
                              isCurrent && styles.progressStepIconWrapCurrent,
                            ]}
                          >
                            <Ionicons
                              name={step.icon}
                              size={14}
                              color={isReached ? colors.white : colors.text.muted}
                            />
                          </View>
                          {index < STATUS_STEPS.length - 1 && (
                            <View
                              style={[
                                styles.progressConnector,
                                isCompleted && styles.progressConnectorReached,
                              ]}
                            />
                          )}
                        </View>

                        <View style={styles.progressStepTextWrap}>
                          <Text
                            style={[
                              styles.progressStepLabel,
                              isReached && styles.progressStepLabelReached,
                              isCurrent && styles.progressStepLabelCurrent,
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text style={styles.progressStepDescription}>{step.description}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.sectionHint}>
                  Detailed step tracking is unavailable for this status.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Rate Your Driver</Text>

              <Text style={styles.ratingSubtitle}>
                How was your trip with {displayTrip.driverName}?
              </Text>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isSelected = star <= rating;
                  return (
                    <TouchableOpacity
                      key={star}
                      style={styles.starButton}
                      onPress={() => setRating(star)}
                      disabled={isRatingReadOnly || isSubmittingRating}
                    >
                      <Ionicons
                        name={isSelected ? "star" : "star-outline"}
                        size={STAR_SIZE}
                        color={isSelected ? colors.warning : colors.text.muted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {rating > 0 && <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>}

              <Text style={styles.badgesTitle}>Badges</Text>
              <View style={styles.badgesRow}>
                {DRIVER_RATING_BADGES.map((badge) => {
                  const isSelected = selectedBadges.includes(badge.id);

                  return (
                    <TouchableOpacity
                      key={badge.id}
                      style={[
                        styles.badgeButton,
                        isSelected && {
                          borderColor: badge.activeColor,
                          backgroundColor: `${badge.activeColor}22`,
                        },
                      ]}
                      onPress={() => toggleBadge(badge.id)}
                      disabled={isRatingReadOnly || isSubmittingRating}
                    >
                      <Ionicons
                        name={badge.icon}
                        size={18}
                        color={isSelected ? badge.activeColor : colors.text.muted}
                      />
                      <Text
                        style={[
                          styles.badgeLabel,
                          isSelected && { color: badge.activeColor },
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.submitRatingButton,
                  !canSubmitRating &&
                  styles.submitRatingButtonDisabled,
                ]}
                onPress={submitDriverRating}
                activeOpacity={0.9}
                disabled={!canSubmitRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.submitRatingButtonText}>
                    {isRatingReadOnly
                      ? "Rating Saved"
                      : !displayTrip.driverId
                        ? "Driver unavailable"
                        : "Submit Rating"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

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

          <PhotoGallerySection
            title={`Pickup Photos (${pickupPhotoUris.length})`}
            photos={pickupPhotoUris}
            emptyLabel="Driver has not uploaded pickup photos yet."
            onOpenPhoto={handleOpenPhotoViewer}
          />

          <PhotoGallerySection
            title={`Delivery Photos (${dropoffPhotoUris.length})`}
            photos={dropoffPhotoUris}
            emptyLabel="Driver has not uploaded delivery photos yet."
            onOpenPhoto={handleOpenPhotoViewer}
          />

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

      <MediaViewer
        visible={viewerVisible}
        mediaUri={viewerUri}
        mediaType="image"
        onClose={handleClosePhotoViewer}
      />
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
  sectionHint: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  progressList: {
    paddingTop: spacing.xs,
  },
  progressStepRow: {
    flexDirection: "row",
  },
  progressStepRail: {
    width: 20,
    alignItems: "center",
    marginRight: spacing.sm,
  },
  progressStepIconWrap: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.circle,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.elevated,
  },
  progressStepIconWrapReached: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  progressStepIconWrapCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressConnector: {
    marginTop: spacing.xs,
    width: 2,
    flex: 1,
    minHeight: spacing.base,
    backgroundColor: colors.border.strong,
  },
  progressConnectorReached: {
    backgroundColor: colors.primary,
  },
  progressStepTextWrap: {
    flex: 1,
    paddingBottom: spacing.base,
  },
  progressStepLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  progressStepLabelReached: {
    color: colors.text.primary,
  },
  progressStepLabelCurrent: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  progressStepDescription: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
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
  photoScrollContent: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  photoTile: {
    width: PHOTO_PREVIEW_SIZE,
    height: PHOTO_PREVIEW_SIZE,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginRight: spacing.sm,
  },
  photoTileImage: {
    width: "100%",
    height: "100%",
  },
  photoTilePressable: {
    width: "100%",
    height: "100%",
  },
  photoTileBadge: {
    position: "absolute",
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  photoTileBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.semibold,
  },
  ratingSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: BODY_LINE_HEIGHT,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.base,
  },
  starButton: {
    paddingHorizontal: spacing.xs,
  },
  ratingLabel: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  badgesTitle: {
    marginTop: spacing.lg,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  badgesRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  badgeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  badgeLabel: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs + 1,
    textAlign: "center",
    color: colors.text.muted,
    fontWeight: typography.fontWeight.medium,
  },
  submitRatingButton: {
    marginTop: spacing.lg,
    height: 46,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitRatingButtonDisabled: {
    opacity: 0.6,
  },
  submitRatingButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
