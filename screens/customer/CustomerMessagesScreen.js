import React, { useCallback, useEffect, useState } from "react";
import { Alert, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConversationInboxItem from "../../components/messages/ConversationInboxItem";
import MessagesInboxScaffold from "../../components/messages/MessagesInboxScaffold";
import { appConfig } from "../../config/appConfig";
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
} from "../../contexts/AuthContext";
import { logger } from "../../services/logger";
import {
  filterCustomerInboxConversations,
  formatConversationTimestamp,
  getAvatarInitial,
  getAvatarUrlFromProfile,
  getDisplayNameFromProfile,
  isArchivedConversation,
  isSupportUserId,
} from "../../services/MessagesInboxService";
import { colors } from "../../styles/theme";
import {
  MOCK_CONVERSATIONS,
  MOCK_PEER_PROFILES,
} from "./customerMessages.mock";

const ENABLE_DEV_MOCK_MESSAGES = appConfig.devMocks.enabled;

export default function CustomerMessagesScreen({ navigation }) {
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
    setLoading(true);
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const userConversations = await getConversations(currentUserId, "customer");
      const validConversations = filterCustomerInboxConversations(userConversations);

      if (validConversations.length > 0) {
        setConversations(validConversations);
      } else if (ENABLE_DEV_MOCK_MESSAGES) {
        setConversations(MOCK_CONVERSATIONS);
      } else {
        setConversations([]);
      }
    } catch (error) {
      logger.error("CustomerMessagesScreen", "Error loading conversations", error);
      if (ENABLE_DEV_MOCK_MESSAGES) {
        setConversations(MOCK_CONVERSATIONS);
      } else {
        Alert.alert("Unable to Load Messages", "Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getConversations]);

  const loadPeerProfiles = useCallback(async () => {
    const requestIdByPeerId = new Map();
    conversations.forEach((conversation) => {
      const peerId = conversation.driverId;
      const requestId = conversation.requestId;
      if (peerId && requestId && !requestIdByPeerId.has(peerId)) {
        requestIdByPeerId.set(peerId, requestId);
      }
    });

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
        if (isSupportUserId(id)) {
          return [
            id,
            {
              first_name: "PikUp",
              last_name: "Support",
              photo_url: null,
            },
          ];
        }

        try {
          const profile = await getUserProfile(id, {
            requestId: requestIdByPeerId.get(id) || undefined,
          });
          return [id, profile];
        } catch (error) {
          logger.error("CustomerMessagesScreen", "Error loading peer profile", { id, error });
          if (ENABLE_DEV_MOCK_MESSAGES) {
            return [id, MOCK_PEER_PROFILES[id] || null];
          }
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
      "customer",
      (userConversations) => {
        setConversations(filterCustomerInboxConversations(userConversations));
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
    },
    [peerProfiles]
  );

  const renderConversationItem = useCallback(
    (conversation) => {
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
        <ConversationInboxItem
          avatarUrl={avatarUrl}
          avatarInitial={avatarInitial}
          peerName={driverName}
          timestampLabel={formatConversationTimestamp(conversation.lastMessageAt)}
          metaIconName={metaIconName}
          metaColor={metaColor}
          metaLabel={metaLabel}
          lastMessage={conversation.lastMessage}
          isUnread={isUnread}
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
        />
      );
    },
    [markMessageAsRead, navigation, peerProfiles]
  );

  return (
    <MessagesInboxScaffold
      topInset={insets.top}
      bottomInset={insets.bottom}
      windowHeight={windowHeight}
      onBack={() => navigation.goBack()}
      showBack={false}
      conversations={conversations}
      loading={loading}
      onRefresh={loadConversations}
      matchesSearch={matchesSearch}
      renderConversationItem={renderConversationItem}
      emptyStateSubtitle="Messages with your drivers will appear here"
    />
  );
}
