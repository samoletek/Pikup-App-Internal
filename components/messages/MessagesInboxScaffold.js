// Messages Inbox Scaffold component: renders its UI and handles related interactions.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "./CollapsibleMessagesHeader";
import {
  isActiveConversation,
  isArchivedConversation,
} from "../../services/MessagesInboxService";
import { colors } from "../../styles/theme";
import styles from "./messagesInboxStyles";

const FILTERS = ["all", "active", "archive"];
const HEADER_ROW_HEIGHT = 56;
const SEARCH_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TOTAL_COLLAPSE_DISTANCE =
  SEARCH_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;

export default function MessagesInboxScaffold({
  topInset,
  bottomInset,
  windowHeight,
  onBack,
  showBack,
  conversations,
  loading,
  onRefresh,
  matchesSearch,
  renderConversationItem,
  emptyStateTitle = "No messages yet",
  emptyStateSubtitle,
  loadingTitle = "Loading conversations...",
  emptyStateStyle,
  emptyStateMinHeightBase = 0,
}) {
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return (Array.isArray(conversations) ? conversations : []).filter((conversation) => {
      if (selectedFilter === "active" && !isActiveConversation(conversation)) {
        return false;
      }
      if (selectedFilter === "archive" && !isArchivedConversation(conversation)) {
        return false;
      }
      if (!query) {
        return true;
      }

      if (typeof matchesSearch !== "function") {
        return true;
      }

      return Boolean(matchesSearch(conversation, query));
    });
  }, [conversations, matchesSearch, searchText, selectedFilter]);

  const activeCount = useMemo(
    () => (Array.isArray(conversations) ? conversations : []).filter(isActiveConversation).length,
    [conversations]
  );
  const archiveCount = useMemo(
    () => (Array.isArray(conversations) ? conversations : []).filter(isArchivedConversation).length,
    [conversations]
  );

  const titleLockCompensation = scrollY.interpolate({
    inputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    outputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const headerHeight = topInset + MESSAGES_TOP_BAR_HEIGHT;
  const emptyStateMinHeight = Math.max(
    emptyStateMinHeightBase,
    windowHeight - headerHeight - HEADER_ROW_HEIGHT * 3 - bottomInset - 120
  );

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TOTAL_COLLAPSE_DISTANCE) {
      return null;
    }

    if (offsetY < SEARCH_COLLAPSE_DISTANCE) {
      return offsetY < SEARCH_COLLAPSE_DISTANCE / 2 ? 0 : SEARCH_COLLAPSE_DISTANCE;
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

  const renderFilter = (filterKey) => {
    const isActive = selectedFilter === filterKey;
    const totalCount = Array.isArray(conversations) ? conversations.length : 0;
    const label =
      filterKey === "all" ? "All" : filterKey === "active" ? "Active" : "Archive";
    const count =
      filterKey === "all"
        ? totalCount
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

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Messages"
        onBack={onBack}
        topInset={topInset}
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
            paddingBottom: bottomInset + 90,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
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
              <Text style={styles.emptyStateTitle}>{loadingTitle}</Text>
            </View>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation, index) => {
              const conversationKey = String(
                conversation?.id || `${conversation?.requestId || "req"}-${index}`
              );

              return (
                <React.Fragment key={conversationKey}>
                  {renderConversationItem(conversation)}
                </React.Fragment>
              );
            })
          ) : (
            <View style={[styles.emptyState, emptyStateStyle, { minHeight: emptyStateMinHeight }]}>
              <Ionicons
                name="chatbubbles-outline"
                size={56}
                color={colors.border.strong}
              />
              <Text style={styles.emptyStateTitle}>{emptyStateTitle}</Text>
              <Text style={styles.emptyStateSubtitle}>{emptyStateSubtitle}</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}
