import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
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

const FILTERS = ["all", "active", "archive"];

// TODO(cleanup): Remove mock conversations/profiles when backend data is stable.
// ======== MOCK DATA FOR UI DEVELOPMENT ========
const MOCK_CONVERSATIONS = [
  {
    id: "conv-001",
    customerId: "current-user-id",
    driverId: "driver-001",
    driverName: "Alex Johnson",
    requestId: "req-abc12345",
    requestStatus: "in_progress",
    lastMessage: "I'm 5 minutes away from your location",
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    unreadByCustomer: 2,
  },
  {
    id: "conv-002",
    customerId: "current-user-id",
    driverId: "driver-002",
    driverName: "Maria Garcia",
    requestId: "req-def67890",
    requestStatus: "pickup_started",
    lastMessage: "Package picked up, heading to drop-off",
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    unreadByCustomer: 1,
  },
  {
    id: "conv-003",
    customerId: "current-user-id",
    driverId: "driver-003",
    driverName: "John Smith",
    requestId: "req-ghi11111",
    requestStatus: "completed",
    lastMessage: "Thanks for using Pikup! Have a great day!",
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    unreadByCustomer: 0,
    completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "conv-004",
    customerId: "current-user-id",
    driverId: "driver-004",
    driverName: "Lisa Chen",
    requestId: "req-jkl22222",
    requestStatus: "delivered",
    lastMessage: "Your package has been delivered successfully",
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadByCustomer: 0,
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "conv-005",
    customerId: "current-user-id",
    driverId: "driver-005",
    driverName: "Mike Wilson",
    requestId: "req-mno33333",
    requestStatus: "cancelled",
    lastMessage: "Order was cancelled. Sorry for any inconvenience.",
    lastMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    unreadByCustomer: 0,
    archivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "conv-006",
    customerId: "current-user-id",
    driverId: "driver-006",
    driverName: "Sarah Davis",
    requestId: "req-pqr44444",
    requestStatus: "pending_pickup",
    lastMessage: "On my way to pick up your package now",
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    unreadByCustomer: 3,
  },
];

const MOCK_PEER_PROFILES = {
  "driver-001": {
    id: "driver-001",
    first_name: "Alex",
    last_name: "Johnson",
    profileImageUrl: null,
  },
  "driver-002": {
    id: "driver-002",
    first_name: "Maria",
    last_name: "Garcia",
    profileImageUrl: null,
  },
  "driver-003": {
    id: "driver-003",
    first_name: "John",
    last_name: "Smith",
    profileImageUrl: null,
  },
  "driver-004": {
    id: "driver-004",
    first_name: "Lisa",
    last_name: "Chen",
    profileImageUrl: null,
  },
  "driver-005": {
    id: "driver-005",
    first_name: "Mike",
    last_name: "Wilson",
    profileImageUrl: null,
  },
  "driver-006": {
    id: "driver-006",
    first_name: "Sarah",
    last_name: "Davis",
    profileImageUrl: null,
  },
};
// ======== END MOCK DATA ========

const HEADER_ROW_HEIGHT = 56;
const SEARCH_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TOTAL_COLLAPSE_DISTANCE =
  SEARCH_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;
const ARCHIVE_STATUSES = new Set([
  "completed",
  "cancelled",
  "delivered",
  "archived",
]);

export default function CustomerMessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    currentUser,
    getConversations,
    getUserProfile,
    subscribeToConversations,
    markMessageAsRead,
  } = useAuth();
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [conversations, setConversations] = useState([]);
  const [peerProfiles, setPeerProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  useEffect(() => {
    const currentUserId = currentUser?.uid || currentUser?.id;
    if (!currentUserId || !subscribeToConversations) {
      return undefined;
    }

    const unsubscribe = subscribeToConversations(
      currentUserId,
      "customer",
      (userConversations) => {
        const validConversations = (Array.isArray(userConversations) ? userConversations : []).filter(
          (conversation) =>
            conversation.customerId &&
            conversation.driverId &&
            (conversation.requestId ||
              conversation.driverId === "support" ||
              conversation.driverId === "ffffffff-ffff-ffff-ffff-ffffffffffff") &&
            conversation.driverId !== conversation.customerId
        );
        setConversations(validConversations);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [currentUser?.uid, currentUser?.id, subscribeToConversations]);

  useEffect(() => {
    loadPeerProfiles();
  }, [conversations]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const loadConversations = async () => {
    setLoading(true);

    const currentUserId = currentUser?.uid || currentUser?.id;
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const userConversations = await getConversations(currentUserId, "customer");
      const validConversations = (Array.isArray(userConversations) ? userConversations : []).filter(
        (conversation) =>
          conversation.customerId &&
          conversation.driverId &&
          (conversation.requestId ||
            conversation.driverId === "support" ||
            conversation.driverId === "ffffffff-ffff-ffff-ffff-ffffffffffff") &&
          conversation.driverId !== conversation.customerId
      );

      if (validConversations.length > 0) {
        setConversations(validConversations);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      Alert.alert("Unable to Load Messages", "Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const loadPeerProfiles = async () => {
    const peerIds = Array.from(
      new Set(
        conversations
          .map((conversation) => conversation.driverId)
          .filter((driverId) => Boolean(driverId))
      )
    );
    const missingIds = peerIds.filter((id) => !peerProfiles[id]);
    if (missingIds.length === 0) {
      return;
    }

    const profileEntries = await Promise.all(
      missingIds.map(async (id) => {
        // Return static profile for support
        if (id === "support" || id === "ffffffff-ffff-ffff-ffff-ffffffffffff") {
          return [id, {
            first_name: "PikUp",
            last_name: "Support",
            photo_url: null
          }];
        }

        try {
          const profile = await getUserProfile(id);
          return [id, profile];
        } catch (error) {
          console.error("Error loading peer profile:", id, error);
          return [id, null];
        }
      })
    );

    setPeerProfiles((prev) => {
      const next = { ...prev };
      profileEntries.forEach(([id, profile]) => {
        next[id] = profile || { id };
      });
      return next;
    });
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return "";
    }
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) {
      return "Just now";
    }
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    }
    if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hr ago`;
    }
    if (diffInMinutes < 10080) {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
    const weeks = Math.floor(diffInMinutes / 10080);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  };

  const getDisplayNameFromProfile = (profile, fallbackName) => {
    const firstName = profile?.first_name || profile?.firstName || "";
    const lastName = profile?.last_name || profile?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      profile?.name ||
      profile?.email?.split("@")?.[0] ||
      fallbackName
    );
  };

  const getAvatarUrlFromProfile = (profile) =>
    profile?.profileImageUrl ||
    profile?.profile_image_url ||
    profile?.avatar_url ||
    null;

  const getAvatarInitial = (displayName) =>
    String(displayName || "?").trim().charAt(0).toUpperCase() || "?";

  const getConversationStatus = (conversation) =>
    String(
      conversation.requestStatus ||
      conversation.tripStatus ||
      conversation.status ||
      ""
    ).toLowerCase();

  const isArchivedConversation = (conversation) => {
    const status = getConversationStatus(conversation);
    return (
      ARCHIVE_STATUSES.has(status) ||
      Boolean(conversation.archivedAt) ||
      Boolean(conversation.completedAt)
    );
  };

  const isActiveConversation = (conversation) =>
    Boolean(conversation.requestId) && !isArchivedConversation(conversation);

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (selectedFilter === "active" && !isActiveConversation(conversation)) {
        return false;
      }
      if (selectedFilter === "archive" && !isArchivedConversation(conversation)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const profile = peerProfiles[conversation.driverId];
      const fallbackName =
        conversation.driverName ||
        `Driver ${conversation.driverId?.substring(0, 8) || ""}`;
      const peerName = getDisplayNameFromProfile(profile, fallbackName).toLowerCase();
      const requestId = conversation.requestId?.substring(0, 8)?.toLowerCase() || "";
      const message = conversation.lastMessage?.toLowerCase() || "";

      return (
        peerName.includes(query) || message.includes(query) || requestId.includes(query)
      );
    });
  }, [conversations, searchText, selectedFilter, peerProfiles]);

  const activeCount = conversations.filter(
    (conversation) => isActiveConversation(conversation)
  ).length;
  const archiveCount = conversations.filter(
    (conversation) => isArchivedConversation(conversation)
  ).length;

  const renderFilter = (filterKey) => {
    const isActive = selectedFilter === filterKey;
    const label =
      filterKey === "all"
        ? "All"
        : filterKey === "active"
          ? "Active"
          : "Archive";
    const count =
      filterKey === "all"
        ? conversations.length
        : filterKey === "active"
          ? activeCount
          : archiveCount;

    return (
      <TouchableOpacity
        key={filterKey}
        style={[styles.filterTab, isActive && styles.filterTabActive]}
        onPress={() => setSelectedFilter(filterKey)}
      >
        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
        <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderConversationItem = (conversation) => {
    const profile = peerProfiles[conversation.driverId];
    const fallbackName =
      conversation.driverName ||
      `Driver ${conversation.driverId?.substring(0, 8) || ""}`;
    const driverName = getDisplayNameFromProfile(profile, fallbackName);
    const avatarUrl = getAvatarUrlFromProfile(profile);
    const avatarInitial = getAvatarInitial(driverName);
    const isUnread = Number(conversation.unreadByCustomer || 0) > 0;
    const isArchived = isArchivedConversation(conversation);
    const metaIconName = isArchived ? "archive-outline" : "car-outline";
    const metaColor = isArchived ? colors.text.tertiary : colors.primary;
    const requestShortId = conversation.requestId?.substring(0, 8);
    const metaLabel = requestShortId ? `Request #${requestShortId}` : "Support";

    return (
      <TouchableOpacity
        key={conversation.id}
        style={styles.messageItem}
        onPress={() => {
          setConversations((prevConversations) =>
            prevConversations.map((item) =>
              item.id === conversation.id
                ? { ...item, unreadByCustomer: 0 }
                : item
            )
          );
          markMessageAsRead?.(conversation.id, "customer");
          navigation.navigate("MessageScreen", {
            conversationId: conversation.id,
            driverId: conversation.driverId,
            driverName,
            requestId: conversation.requestId,
          });
        }}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{avatarInitial}</Text>
            </View>
          )}
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.peerName, isUnread && styles.peerNameUnread]} numberOfLines={1}>
              {driverName}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(conversation.lastMessageAt)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name={metaIconName} size={12} color={metaColor} />
            <Text style={[styles.metaText, { color: metaColor }]} numberOfLines={1}>
              {metaLabel}
            </Text>
          </View>

          <Text
            style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {conversation.lastMessage || "No messages yet"}
          </Text>
        </View>

        {isUnread ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  };

  const showBack = false;
  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;
  const emptyStateMinHeight =
    windowHeight -
    headerHeight -
    HEADER_ROW_HEIGHT * 3 -
    insets.bottom -
    120;
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

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Messages"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack={showBack}
        scrollY={scrollY}
        searchCollapseDistance={SEARCH_COLLAPSE_DISTANCE}
        titleCollapseDistance={TITLE_COLLAPSE_DISTANCE}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.messagesList}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight,
            paddingBottom: insets.bottom + 90,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadConversations}
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
          <Text style={styles.largeTitle}>Messages</Text>
        </Animated.View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages"
              placeholderTextColor={colors.text.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterRow}>{FILTERS.map(renderFilter)}</View>
        </View>

        <View style={styles.messagesSection}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Loading conversations...</Text>
            </View>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map(renderConversationItem)
          ) : (
            <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
              <Ionicons
                name="chatbubbles-outline"
                size={56}
                color={colors.border.strong}
              />
              <Text style={styles.emptyStateTitle}>No messages yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Messages with your drivers will appear here
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  filterSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  messagesSection: {},
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  filterTextActive: {
    color: colors.text.primary,
  },
  filterBadge: {
    marginLeft: spacing.sm,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: colors.background.elevated,
  },
  filterBadgeActive: {
    backgroundColor: colors.overlayPrimarySoft,
  },
  filterBadgeText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  messagesList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.base,
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
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginLeft: spacing.sm,
  },
  messageItem: {
    height: 100,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    position: "relative",
    marginRight: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  messageContent: {
    flex: 1,
    justifyContent: "center",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  peerName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginRight: spacing.sm,
  },
  peerNameUnread: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  timestamp: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  lastMessage: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.warning,
    alignSelf: "center",
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyStateTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});
