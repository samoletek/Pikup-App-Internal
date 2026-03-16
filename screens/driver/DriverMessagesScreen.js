import React, { useCallback, useEffect, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConversationInboxItem from "../../components/messages/ConversationInboxItem";
import MessagesInboxScaffold from "../../components/messages/MessagesInboxScaffold";
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
} from "../../contexts/AuthContext";
import { logger } from "../../services/logger";
import {
  filterDriverInboxConversations,
  formatConversationTimestamp,
  getAvatarInitial,
  getAvatarUrlFromProfile,
  getDisplayNameFromProfile,
  isArchivedConversation,
  isSupportUserId,
} from "../../services/MessagesInboxService";
import { colors, spacing } from "../../styles/theme";

export default function DriverMessagesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { currentUser } = useAuthIdentity();
  const { getConversations, subscribeToConversations, markMessageAsRead } = useMessagingActions();
  const { getUserProfile } = useProfileActions();

  const currentUserId = currentUser?.uid || currentUser?.id;
  const [conversations, setConversations] = useState([]);
  const [peerProfiles, setPeerProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userConversations = await getConversations(currentUserId, "driver");
      setConversations(filterDriverInboxConversations(userConversations));
    } catch (error) {
      logger.error("DriverMessagesScreen", "Error loading conversations", error);
      Alert.alert("Unable to Load Messages", "Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getConversations]);

  const loadPeerProfiles = useCallback(async () => {
    const peerIds = Array.from(
      new Set(
        conversations
          .map((conversation) => conversation.customerId)
          .filter((customerId) => Boolean(customerId) && !isSupportUserId(customerId))
      )
    );

    const missingIds = peerIds.filter((id) => !peerProfiles[id]);
    if (missingIds.length === 0) {
      return;
    }

    const profileEntries = await Promise.all(
      missingIds.map(async (id) => {
        try {
          const profile = await getUserProfile(id);
          return [id, profile];
        } catch (error) {
          logger.error("DriverMessagesScreen", "Error loading peer profile", { id, error });
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
  }, [conversations, getUserProfile, peerProfiles]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!currentUserId || !subscribeToConversations) {
      return undefined;
    }

    const unsubscribe = subscribeToConversations(
      currentUserId,
      "driver",
      (userConversations) => {
        setConversations(filterDriverInboxConversations(userConversations));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [currentUserId, subscribeToConversations]);

  useEffect(() => {
    loadPeerProfiles();
  }, [loadPeerProfiles]);

  const matchesSearch = useCallback(
    (conversation, query) => {
      if (!query) {
        return true;
      }

      const profile = peerProfiles[conversation.customerId];
      const fallbackName =
        conversation.customerName ||
        `Customer ${conversation.customerId?.substring(0, 8) || ""}`;
      const peerName = getDisplayNameFromProfile(profile, fallbackName).toLowerCase();
      const requestId = conversation.requestId?.substring(0, 8)?.toLowerCase() || "";
      const message = conversation.lastMessage?.toLowerCase() || "";

      return (
        peerName.includes(query) || message.includes(query) || requestId.includes(query)
      );
    },
    [peerProfiles]
  );

  const renderConversationItem = useCallback(
    (conversation) => {
      const profile = peerProfiles[conversation.customerId];
      const fallbackName =
        conversation.customerName ||
        `Customer ${conversation.customerId?.substring(0, 8) || ""}`;
      const customerName = getDisplayNameFromProfile(profile, fallbackName);
      const avatarUrl = getAvatarUrlFromProfile(profile);
      const avatarInitial = getAvatarInitial(customerName);
      const isUnread = Number(conversation.unreadByDriver || 0) > 0;
      const isArchived = isArchivedConversation(conversation);
      const metaIconName = isArchived ? "archive-outline" : "cube-outline";
      const metaColor = isArchived ? colors.text.tertiary : colors.primary;

      return (
        <ConversationInboxItem
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          peerName={customerName}
          timestampLabel={formatConversationTimestamp(conversation.lastMessageAt)}
          metaIconName={metaIconName}
          metaColor={metaColor}
          metaLabel={`Request #${conversation.requestId.substring(0, 8)}`}
          lastMessage={conversation.lastMessage}
          isUnread={isUnread}
          onPress={() => {
            setConversations((prevConversations) =>
              prevConversations.map((item) =>
                item.id === conversation.id
                  ? { ...item, unreadByDriver: 0 }
                  : item
              )
            );

            markMessageAsRead?.(conversation.id, "driver");
            navigation.navigate("MessageScreen", {
              conversationId: conversation.id,
              customerId: conversation.customerId,
              customerName,
              requestId: conversation.requestId,
            });
          }}
        />
      );
    },
    [markMessageAsRead, navigation, peerProfiles]
  );

  const showBack =
    route?.name === "DriverMessagesScreen" && navigation.canGoBack();

  return (
    <MessagesInboxScaffold
      topInset={insets.top}
      bottomInset={insets.bottom}
      windowHeight={windowHeight}
      onBack={() => navigation.goBack()}
      showBack={showBack}
      conversations={conversations}
      loading={loading}
      onRefresh={loadConversations}
      matchesSearch={matchesSearch}
      renderConversationItem={renderConversationItem}
      emptyStateSubtitle="Messages with your customers will appear here"
      emptyStateStyle={{ paddingBottom: 56 + spacing.xxxl - spacing.base }}
      emptyStateMinHeightBase={280}
    />
  );
}
