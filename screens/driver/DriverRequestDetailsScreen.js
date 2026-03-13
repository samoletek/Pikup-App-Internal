import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { supabase } from "../../config/supabase";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const PHOTO_URL_TTL_SECONDS = 60 * 60 * 6;

const formatAmount = (value) => {
  if (typeof value === "string" && value.includes("$")) {
    return value;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
};

const formatDateTime = (value) => {
  if (!value) return "ASAP";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "ASAP";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
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
  if (value && typeof value === "object") return [value];
  return [];
};

const getItemRows = (request = {}) => {
  const list = toArray(request.items);
  if (list.length > 0) return list;

  if (request.item && typeof request.item === "object") {
    return [request.item];
  }

  return [];
};

const getPhotoRows = (request = {}) => {
  const directPhotos = toArray(request.photos);
  if (directPhotos.length > 0) return directPhotos;

  const fromItems = getItemRows(request).flatMap((item) => toArray(item?.photos));
  return fromItems;
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

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const formatWeight = (item = {}) => {
  const raw = Number(
    item.weightEstimate ??
      item.weight ??
      item.estimated_weight_lbs ??
      item.weight_lbs
  );

  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return `${raw} lb`;
};

export default function DriverRequestDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const request = route?.params?.request || null;
  const [photoUris, setPhotoUris] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);

  const details = useMemo(() => {
    if (!request) return null;

    const pricing = request.pricing || request.originalData?.pricing || {};
    const payoutLabel = formatAmount(
      request.driverPayout ??
        request.earnings ??
        pricing.driverPayout ??
        request.price
    );
    const totalLabel = formatAmount(pricing.total ?? request.price);
    const scheduleLabel = formatDateTime(request.scheduledTime || request.scheduled_time);
    const itemRows = getItemRows(request);
    const photoRows = getPhotoRows(request);
    const pickupDetails = request.pickup?.details || {};
    const dropoffDetails = request.dropoff?.details || {};

    return {
      id: String(request.id || "unknown"),
      payoutLabel,
      totalLabel,
      scheduleLabel,
      vehicleType: firstText(request.vehicle?.type, request.vehicleType) || "Standard",
      pickupAddress: firstText(request.pickup?.address) || "Not specified",
      dropoffAddress: firstText(request.dropoff?.address) || "Not specified",
      pickupNotes: firstText(pickupDetails.notes, pickupDetails.note),
      dropoffNotes: firstText(dropoffDetails.notes, dropoffDetails.note),
      itemRows,
      photoRows,
      timeDistance: [request.time, request.distance].filter(Boolean).join(" · "),
    };
  }, [request]);

  useEffect(() => {
    if (!details || details.photoRows.length === 0) {
      setPhotoUris([]);
      setPhotosLoading(false);
      return;
    }

    let isCancelled = false;
    setPhotosLoading(true);

    const loadPhotoUris = async () => {
      try {
        const resolved = await resolvePhotoUrisAsync(details.photoRows);
        if (!isCancelled) {
          setPhotoUris(resolved);
        }
      } catch (error) {
        console.warn("Failed to resolve request photos:", error);
        if (!isCancelled) {
          setPhotoUris([]);
        }
      } finally {
        if (!isCancelled) {
          setPhotosLoading(false);
        }
      }
    };

    void loadPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [details]);

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

  if (!details) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Request Details"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.warning} />
          <Text style={styles.emptyTitle}>Request data is unavailable</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Request Details"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.background.elevated, colors.background.panel]}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroPayout}>{details.payoutLabel}</Text>
            <View style={styles.heroTag}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={styles.heroTagText}>{details.scheduleLabel}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>Trip #{details.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.heroMetaText}>{details.vehicleType}</Text>
            <Text style={styles.heroMetaText}>Total {details.totalLabel}</Text>
          </View>
          {details.timeDistance ? (
            <Text style={styles.heroSubText}>{details.timeDistance}</Text>
          ) : null}
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Route</Text>

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{details.pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Drop-off</Text>
              <Text style={styles.routeText}>{details.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {(details.pickupNotes || details.dropoffNotes) ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {details.pickupNotes ? (
              <>
                <Text style={styles.noteLabel}>Pickup</Text>
                <Text style={styles.noteText}>{details.pickupNotes}</Text>
              </>
            ) : null}
            {details.dropoffNotes ? (
              <>
                <Text style={styles.noteLabel}>Drop-off</Text>
                <Text style={styles.noteText}>{details.dropoffNotes}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Items</Text>
          {details.itemRows.length > 0 ? (
            details.itemRows.map((item, index) => {
              const itemName = firstText(item?.name, item?.description, item?.category) || "Item";
              const itemMeta = [
                firstText(item?.category),
                formatWeight(item),
                item?.isFragile ? "Fragile" : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <View key={`${details.id}-item-${index}`} style={styles.itemRow}>
                  <View style={styles.itemBadge}>
                    <Ionicons name="cube-outline" size={14} color={colors.primary} />
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemName}>{itemName}</Text>
                    {itemMeta ? <Text style={styles.itemMeta}>{itemMeta}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No item details provided.</Text>
          )}
        </View>

        {details.photoRows.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Photos</Text>

            {photosLoading ? (
              <View style={styles.photoLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.photoLoadingText}>Loading photos...</Text>
              </View>
            ) : photoUris.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosRow}
              >
                {photoUris.map((uri, index) => (
                  <TouchableOpacity
                    key={`${details.id}-photo-${index}`}
                    activeOpacity={0.9}
                    onPress={() => handleOpenPhotoViewer(uri)}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Could not load photos for this request.</Text>
            )}
          </View>
        ) : null}
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.base,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  heroPayout: {
    color: colors.white,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  heroTagText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroMetaText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  heroSubText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.base,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.circle,
    marginTop: 4,
    marginRight: spacing.sm,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xxs,
  },
  routeText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.base,
    marginLeft: spacing.xl,
  },
  noteLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xxs,
  },
  noteText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  itemBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  itemMeta: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xxs,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  photosRow: {
    gap: spacing.sm,
  },
  photoLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  photoLoadingText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
  },
  photo: {
    width: 108,
    height: 108,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.elevated,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.base,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
