import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import MediaViewer from "../../components/MediaViewer";
import { useAuth } from "../../contexts/AuthContext";
import { uploadToSupabase, compressImage } from "../../services/StorageService";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)(\?|#|$)/i;
const VIDEO_URL_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;
const DEFAULT_IMAGE_ASPECT_RATIO = 4 / 3;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const MIN_MEDIA_ASPECT_RATIO = 0.45;
const MAX_MEDIA_ASPECT_RATIO = 2.2;

export default function MessageScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentUser,
    userType,
    sendMessage,
    subscribeToMessages,
    markMessageAsRead,
    loadOlderMessages,
  } = useAuth();

  const { conversationId, driverName, customerName, driverInfo } = route.params || {};
  const title = driverName || customerName || driverInfo?.name || "Chat";
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerMediaUri, setViewerMediaUri] = useState(null);
  const [viewerMediaType, setViewerMediaType] = useState("image");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [mediaNaturalSizeById, setMediaNaturalSizeById] = useState({});
  const messageListRef = useRef(null);
  const mediaSizeProbeInFlightRef = useRef(new Set());
  const isKeyboardVisible = keyboardHeight > 0;
  const mediaMaxWidth = Math.round(Math.min(contentMaxWidth * 0.7, width * 0.72));
  const mediaMaxHeight = Math.round(Math.min(contentMaxWidth * 0.78, width * 0.8));

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    });
  }, []);

  const getMessageMediaType = useCallback((message) => {
    const normalizedType = String(message?.messageType || "").toLowerCase();
    if (normalizedType === "image" || normalizedType === "video") {
      return normalizedType;
    }

    const content = String(message?.content || "").trim();
    if (!/^https?:\/\//i.test(content)) {
      return null;
    }

    if (VIDEO_URL_PATTERN.test(content)) {
      return "video";
    }

    if (content.includes("/chat-attachments/") || IMAGE_URL_PATTERN.test(content)) {
      return "image";
    }

    return null;
  }, []);

  const getMediaDisplaySize = useCallback(
    (messageId, mediaType) => {
      const naturalSize = mediaNaturalSizeById[String(messageId)];
      const hasNaturalSize = !!naturalSize?.width && !!naturalSize?.height;
      const defaultAspectRatio =
        mediaType === "video" ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO;
      const rawAspectRatio = hasNaturalSize
        ? naturalSize.width / naturalSize.height
        : defaultAspectRatio;
      const aspectRatio = Math.min(
        MAX_MEDIA_ASPECT_RATIO,
        Math.max(MIN_MEDIA_ASPECT_RATIO, rawAspectRatio)
      );

      let widthCandidate = mediaMaxWidth;
      let heightCandidate = Math.round(widthCandidate / aspectRatio);
      if (heightCandidate > mediaMaxHeight) {
        heightCandidate = mediaMaxHeight;
        widthCandidate = Math.round(heightCandidate * aspectRatio);
      }

      return {
        width: Math.max(widthCandidate, 1),
        height: Math.max(heightCandidate, 1),
      };
    },
    [mediaMaxHeight, mediaMaxWidth, mediaNaturalSizeById]
  );

  const saveMediaNaturalSize = useCallback((messageId, loadedWidth, loadedHeight) => {
    const parsedWidth = Number(loadedWidth || 0);
    const parsedHeight = Number(loadedHeight || 0);

    if (!parsedWidth || !parsedHeight) {
      return;
    }

    const mediaKey = String(messageId);
    setMediaNaturalSizeById((prev) => {
      const existing = prev[mediaKey];
      if (existing?.width === parsedWidth && existing?.height === parsedHeight) {
        return prev;
      }

      return {
        ...prev,
        [mediaKey]: { width: parsedWidth, height: parsedHeight },
      };
    });
  }, []);

  const handleImageLoad = useCallback((messageId, event) => {
    const source = event?.nativeEvent?.source;
    saveMediaNaturalSize(messageId, source?.width, source?.height);
  }, [saveMediaNaturalSize]);

  const handleVideoReady = useCallback((messageId, event) => {
    const naturalSize = event?.naturalSize || event?.nativeEvent?.naturalSize;
    saveMediaNaturalSize(messageId, naturalSize?.width, naturalSize?.height);
  }, [saveMediaNaturalSize]);

  const probeMediaSize = useCallback((messageId, uri) => {
    if (typeof uri !== "string" || !uri) {
      return;
    }

    const mediaKey = String(messageId);
    if (mediaNaturalSizeById[mediaKey] || mediaSizeProbeInFlightRef.current.has(mediaKey)) {
      return;
    }

    mediaSizeProbeInFlightRef.current.add(mediaKey);
    Image.getSize(
      uri,
      (loadedWidth, loadedHeight) => {
        mediaSizeProbeInFlightRef.current.delete(mediaKey);
        if (!loadedWidth || !loadedHeight) {
          return;
        }

        saveMediaNaturalSize(mediaKey, loadedWidth, loadedHeight);
      },
      () => {
        mediaSizeProbeInFlightRef.current.delete(mediaKey);
      }
    );
  }, [mediaNaturalSizeById, saveMediaNaturalSize]);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setHasMore(true);

    const unsubscribe = subscribeToMessages(
      conversationId,
      // onInitialLoad — receives array of last 20 messages
      (initialMessages) => {
        setMessages((prevMessages) => {
          const pendingMessages = prevMessages.filter(
            (msg) => msg.id?.startsWith("temp-") && msg.status !== "sent"
          );
          return [...initialMessages, ...pendingMessages];
        });
        if (initialMessages.length < 20) setHasMore(false);
        setLoading(false);
      },
      // onNewMessage — receives single new message from realtime
      (newMsg) => {
        setMessages((prev) => {
          // Skip if already present (e.g. optimistic)
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    );

    markMessageAsRead(conversationId, userType);
    return unsubscribe;
  }, [conversationId, currentUserId, subscribeToMessages, markMessageAsRead, userType]);

  useEffect(() => {
    setMediaNaturalSizeById((prev) => {
      const activeIds = new Set(messages.map((message) => String(message.id)));
      let hasRemovedItems = false;
      const next = {};

      mediaSizeProbeInFlightRef.current.forEach((mediaId) => {
        if (!activeIds.has(mediaId)) {
          mediaSizeProbeInFlightRef.current.delete(mediaId);
        }
      });

      Object.entries(prev).forEach(([mediaId, size]) => {
        if (activeIds.has(mediaId)) {
          next[mediaId] = size;
        } else {
          hasRemovedItems = true;
        }
      });

      return hasRemovedItems ? next : prev;
    });
  }, [messages]);

  useEffect(() => {
    messages.forEach((message) => {
      const mediaType = getMessageMediaType(message);
      if (!mediaType) {
        return;
      }

      if (mediaType === "image") {
        probeMediaSize(message.id, String(message.content || ""));
      }
    });
  }, [getMessageMediaType, messages, probeMediaSize]);

  // No initial scroll logic needed — inverted FlatList shows latest messages first

  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.timestamp) return;

    setLoadingOlder(true);
    try {
      const olderMessages = await loadOlderMessages(conversationId, oldestMessage.timestamp);
      if (olderMessages.length === 0 || olderMessages.length < 20) {
        setHasMore(false);
      }
      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadOlderMessages, loadingOlder, messages]);

  useEffect(() => {
    const handleKeyboardChange = (event) => {
      const nextKeyboardHeight = Number(event?.endCoordinates?.height || 0);
      setKeyboardHeight(nextKeyboardHeight);
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const subscriptions =
      Platform.OS === "ios"
        ? [
          Keyboard.addListener("keyboardWillChangeFrame", handleKeyboardChange),
          Keyboard.addListener("keyboardWillHide", handleKeyboardHide),
        ]
        : [
          Keyboard.addListener("keyboardDidShow", handleKeyboardChange),
          Keyboard.addListener("keyboardDidHide", handleKeyboardHide),
        ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [scrollToLatest]);

  const handleSend = async () => {
    if (!messageText.trim() || sending || !currentUserId) {
      return;
    }

    const content = messageText.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic update - show message immediately
    const optimisticMessage = {
      id: tempId,
      senderId: currentUserId,
      content,
      messageType: "text",
      timestamp: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText("");
    setSending(true);

    try {
      const sentMessage = await sendMessage(conversationId, currentUserId, userType, content);
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...sentMessage, status: "sent" } : msg
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
      // Mark as failed and restore text
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, status: "failed" } : msg
        )
      );
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const handleAttachPress = () => {
    Alert.alert(
      "Attach Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImageFromLibrary },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await uploadAndSendImage(result.assets[0]);
    }
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await uploadAndSendImage(result.assets[0]);
    }
  };

  const uploadAndSendImage = async (asset) => {
    if (!currentUserId || !conversationId) return;

    const uri = typeof asset === "string" ? asset : asset?.uri;
    if (!uri) return;

    const tempId = `temp-img-${Date.now()}`;
    const imageWidth = Number(asset?.width || 0);
    const imageHeight = Number(asset?.height || 0);

    // Optimistic update - show image immediately with local URI
    const optimisticMessage = {
      id: tempId,
      senderId: currentUserId,
      content: uri,
      messageType: "image",
      timestamp: new Date().toISOString(),
      status: "uploading",
    };

    if (imageWidth && imageHeight) {
      saveMediaNaturalSize(tempId, imageWidth, imageHeight);
    }

    setMessages((prev) => [...prev, optimisticMessage]);
    setUploadingImage(true);

    try {
      const compressedUri = await compressImage(uri);
      // Use chat-attachments bucket which has proper policies
      const filename = `${currentUserId}/${conversationId}/${Date.now()}.jpg`;
      const publicUrl = await uploadToSupabase(compressedUri, "chat-attachments", filename);

      // Update to show uploading to server
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, content: publicUrl, status: "sending" } : msg
        )
      );

      const sentMessage = await sendMessage(conversationId, currentUserId, userType, publicUrl, "image");
      // Replace with real message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...sentMessage, status: "sent" } : msg
        )
      );
    } catch (error) {
      console.error("Error uploading image:", error);
      // Mark as failed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, status: "failed" } : msg
        )
      );
      Alert.alert("Upload Failed", "Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const openMediaViewer = (mediaUri, mediaType) => {
    if (!mediaUri) return;
    setViewerMediaUri(mediaUri);
    setViewerMediaType(mediaType === "video" ? "video" : "image");
    setViewerVisible(true);
  };

  const closeMediaViewer = () => {
    setViewerVisible(false);
    setViewerMediaUri(null);
    setViewerMediaType("image");
  };

  // Render message status icon for outgoing messages
  const renderStatusIcon = (status) => {
    switch (status) {
      case "sending":
      case "uploading":
        return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />;
      case "sent":
        return <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.7)" />;
      case "delivered":
        return <Ionicons name="checkmark-done-outline" size={12} color="rgba(255,255,255,0.7)" />;
      case "read":
        return <Ionicons name="checkmark-done" size={12} color={colors.success} />;
      case "failed":
        return <Ionicons name="alert-circle" size={12} color={colors.error} />;
      default:
        return <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.7)" />;
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === currentUserId;
    const messageTime = new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (item.messageType === "system") {
      return (
        <View style={styles.systemBox}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    // Media message (image/video)
    const mediaType = getMessageMediaType(item);
    if (mediaType) {
      const isUploading = item.status === "uploading" || item.status === "sending";
      const mediaSize = getMediaDisplaySize(item.id, mediaType);
      const isImage = mediaType === "image";
      const canOpenMediaViewer = !isUploading;
      const MediaBubble = canOpenMediaViewer ? TouchableOpacity : View;

      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.outgoingContainer : styles.incomingContainer,
          ]}
        >
          <MediaBubble
            style={[
              styles.imageBubble,
              item.status === "failed" && styles.failedMsg,
            ]}
            {...(canOpenMediaViewer
              ? {
                onPress: () => openMediaViewer(item.content, mediaType),
                activeOpacity: 0.9,
              }
              : {})}
          >
            <View style={[styles.imageWrapper, mediaSize]}>
              {isImage ? (
                <Image
                  source={{ uri: item.content }}
                  style={[styles.messageImage, mediaSize, isUploading && styles.imageUploading]}
                  resizeMode="contain"
                  onLoad={(event) => handleImageLoad(item.id, event)}
                />
              ) : (
                <>
                  <View style={[styles.videoContainer, mediaSize, isUploading && styles.imageUploading]}>
                    <Video
                      source={{ uri: item.content }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={false}
                      isLooping={false}
                      isMuted
                      useNativeControls={false}
                      onLoad={(status) =>
                        saveMediaNaturalSize(
                          item.id,
                          status?.naturalSize?.width,
                          status?.naturalSize?.height
                        )
                      }
                      onReadyForDisplay={(event) => handleVideoReady(item.id, event)}
                    />
                  </View>
                  <View style={styles.videoPreviewOverlay} pointerEvents="none">
                    <Ionicons name="play-circle" size={spacing.xxl} color={colors.white} />
                  </View>
                </>
              )}
              {isUploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={colors.white} />
                </View>
              )}
              {/* Time and status overlay on image */}
              <View style={styles.imageTimeOverlay}>
                <Text style={styles.imageTimeText}>{messageTime}</Text>
                {isMyMessage && (
                  <View style={styles.statusIcon}>
                    {renderStatusIcon(item.status)}
                  </View>
                )}
              </View>
            </View>
          </MediaBubble>
        </View>
      );
    }

    // Text message
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.outgoingContainer : styles.incomingContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.outgoingMsg : styles.incomingMsg,
            item.status === "failed" && styles.failedMsg,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.outgoingText : styles.incomingText,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.outgoingTime : styles.incomingTime,
              ]}
            >
              {messageTime}
            </Text>
            {isMyMessage && (
              <View style={styles.statusIcon}>
                {renderStatusIcon(item.status)}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
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
          {/* Paperclip/Attach Button */}
          <TouchableOpacity
            style={[styles.attachButton, uploadingImage && styles.attachButtonDisabled]}
            onPress={handleAttachPress}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="attach" size={22} color={colors.text.secondary} />
            )}
          </TouchableOpacity>

          {/* Input Field with Send Button */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                { maxHeight: 10 * 20 } // 10 lines × ~20px line height
              ]}
              placeholder="Send message..."
              placeholderTextColor={colors.text.placeholder}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              textAlignVertical="center"
              scrollEnabled={true}
            />
            {messageText.trim().length > 0 && (
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                disabled={sending}
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

      {/* Full-screen Media Viewer */}
      <MediaViewer
        visible={viewerVisible}
        mediaUri={viewerMediaUri}
        mediaType={viewerMediaType}
        onClose={closeMediaViewer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentColumn: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.base,
  },
  systemBox: {
    backgroundColor: colors.background.tertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm + spacing.xs,
  },
  systemText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOlderContainer: {
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  messageContainer: {
    marginBottom: spacing.sm + spacing.xs,
    maxWidth: "80%",
  },
  incomingContainer: {
    alignSelf: "flex-start",
  },
  outgoingContainer: {
    alignSelf: "flex-end",
  },
  messageBubble: {
    padding: 10,
    borderRadius: borderRadius.lg,
  },
  incomingMsg: {
    backgroundColor: colors.background.tertiary,
    borderBottomLeftRadius: borderRadius.xs,
  },
  outgoingMsg: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  incomingText: {
    color: colors.text.primary,
  },
  outgoingText: {
    color: colors.white,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    lineHeight: 14, // Explicit lineHeight to match icon height
    // marginTop: spacing.xs, // Removed to fix alignment with icon
    opacity: 0.7,
  },
  incomingTime: {
    color: colors.text.secondary,
  },
  outgoingTime: {
    color: colors.white,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
    minHeight: 40,
    paddingLeft: spacing.base,
    paddingRight: 2,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    lineHeight: 20,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "top",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
    marginBottom: 0,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  attachButtonDisabled: {
    opacity: 0.6,
  },
  imageBubble: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  messageImage: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  messageVideo: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  videoContainer: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    overflow: "hidden",
  },
  imageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    opacity: 0.8,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
  },
  imageTimeOverlay: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  imageTimeText: {
    fontSize: typography.fontSize.xs,
    color: colors.white,
  },
  statusIcon: {
    marginLeft: spacing.xs,
  },
  failedMsg: {
    opacity: 0.6,
    borderWidth: 1,
    borderColor: colors.error,
  },
  imageWrapper: {
    position: "relative",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  imageUploading: {
    opacity: 0.5,
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
  },
});
