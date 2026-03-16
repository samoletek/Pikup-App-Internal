import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MediaViewer from "../../components/MediaViewer";
import ScreenHeader from "../../components/ScreenHeader";
import ChatMessageItem from "../../components/messages/ChatMessageItem";
import { getMessageMediaType } from "../../components/messages/messageMediaUtils";
import { useAuthIdentity, useMessagingActions } from "../../contexts/AuthContext";
import useConversationMessages from "../../hooks/useConversationMessages";
import useKeyboardHeight from "../../hooks/useKeyboardHeight";
import useMessageComposer from "../../hooks/useMessageComposer";
import useMessageMediaSizing from "../../hooks/useMessageMediaSizing";
import styles from "./MessageScreen.styles";
import { colors, layout, spacing } from "../../styles/theme";

export default function MessageScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, userType } = useAuthIdentity();
  const {
    sendMessage,
    subscribeToMessages,
    markMessageAsRead,
    loadOlderMessages,
  } = useMessagingActions();

  const { conversationId, driverName, customerName, driverInfo } = route.params || {};
  const hasConversationId = Boolean(conversationId);
  const title = driverName || customerName || driverInfo?.name || "Chat";
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerMediaUri, setViewerMediaUri] = useState(null);
  const [viewerMediaType, setViewerMediaType] = useState("image");
  const missingConversationAlertShownRef = useRef(false);
  const messageListRef = useRef(null);

  const keyboardHeight = useKeyboardHeight();
  const isKeyboardVisible = keyboardHeight > 0;
  const mediaMaxWidth = Math.round(Math.min(contentMaxWidth * 0.7, width * 0.72));
  const mediaMaxHeight = Math.round(Math.min(contentMaxWidth * 0.78, width * 0.8));

  const { messages, setMessages, loading, loadingOlder, handleLoadOlder } =
    useConversationMessages({
      conversationId,
      currentUserId,
      userType,
      subscribeToMessages,
      markMessageAsRead,
      loadOlderMessages,
    });

  const {
    getMediaDisplaySize,
    handleImageLoad,
    handleVideoReady,
    saveMediaNaturalSize,
  } = useMessageMediaSizing({
    messages,
    mediaMaxWidth,
    mediaMaxHeight,
  });

  const {
    messageText,
    setMessageText,
    sending,
    uploadingImage,
    handleAttachPress,
    handleSend,
  } = useMessageComposer({
    conversationId,
    currentUserId,
    userType,
    sendMessage,
    setMessages,
    saveMediaNaturalSize,
  });

  useEffect(() => {
    if (hasConversationId || missingConversationAlertShownRef.current) {
      return;
    }

    missingConversationAlertShownRef.current = true;
    Alert.alert(
      "Chat unavailable",
      "Could not open this chat. Please go back and try again.",
      [{ text: "OK" }]
    );
  }, [hasConversationId]);

  const openMediaViewer = useCallback((mediaUri, mediaType) => {
    if (!mediaUri) {
      return;
    }

    setViewerMediaUri(mediaUri);
    setViewerMediaType(mediaType === "video" ? "video" : "image");
    setViewerVisible(true);
  }, []);

  const closeMediaViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerMediaUri(null);
    setViewerMediaType("image");
  }, []);

  const renderMessage = useCallback(
    ({ item }) => {
      const mediaType = getMessageMediaType(item);
      const mediaSize = mediaType ? getMediaDisplaySize(item.id, mediaType) : null;

      return (
        <ChatMessageItem
          item={item}
          currentUserId={currentUserId}
          mediaType={mediaType}
          mediaSize={mediaSize}
          onOpenMediaViewer={openMediaViewer}
          onImageLoad={handleImageLoad}
          onVideoReady={handleVideoReady}
          onVideoLoad={saveMediaNaturalSize}
        />
      );
    },
    [
      currentUserId,
      getMediaDisplaySize,
      handleImageLoad,
      handleVideoReady,
      openMediaViewer,
      saveMediaNaturalSize,
    ]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}> 
        {!hasConversationId && (
          <View style={[styles.systemBox, { marginHorizontal: spacing.base, marginTop: spacing.sm }]}>
            <Text style={styles.systemText}>Conversation is unavailable for this trip.</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={messageListRef}
            data={[...messages].reverse()}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            inverted
            style={styles.messageListContainer}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingOlder ? (
                <View style={styles.loadingOlderContainer}>
                  <ActivityIndicator size="small" color={colors.text.secondary} />
                </View>
              ) : null
            }
          />
        )}

        <View
          style={[
            styles.inputContainer,
            {
              marginBottom: isKeyboardVisible
                ? keyboardHeight + spacing.sm
                : insets.bottom + spacing.base,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.attachButton,
              (uploadingImage || !hasConversationId) && styles.attachButtonDisabled,
            ]}
            onPress={handleAttachPress}
            disabled={uploadingImage || !hasConversationId}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="attach" size={22} color={colors.text.secondary} />
            )}
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { maxHeight: 10 * 20 }]}
              placeholder="Send message..."
              placeholderTextColor={colors.text.placeholder}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              textAlignVertical="center"
              scrollEnabled
              editable={hasConversationId}
            />
            {messageText.trim().length > 0 && (
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, (sending || !hasConversationId) && styles.sendBtnDisabled]}
                disabled={sending || !hasConversationId}
              >
                <Ionicons
                  name={sending ? "hourglass-outline" : "arrow-up"}
                  size={18}
                  color={colors.white}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <MediaViewer
        visible={viewerVisible}
        mediaUri={viewerMediaUri}
        mediaType={viewerMediaType}
        onClose={closeMediaViewer}
      />
    </View>
  );
}
