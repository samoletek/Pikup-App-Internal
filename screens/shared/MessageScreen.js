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

export default function MessageScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentUser,
    userType,
    sendMessage,
    subscribeToMessages,
    markMessageAsRead,
  } = useAuth();

  const { conversationId, driverName, customerName, driverInfo } = route.params || {};
  const title = driverName || customerName || driverInfo?.name || "Chat";
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messageListRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const isKeyboardVisible = keyboardHeight > 0;

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToEnd?.({ animated });
    });
  }, []);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribe = subscribeToMessages(conversationId, (serverMessages) => {
      setMessages((prevMessages) => {
        // Keep only pending optimistic messages (those with temp IDs that aren't on server yet)
        const pendingMessages = prevMessages.filter(
          (msg) => msg.id?.startsWith("temp-") && msg.status !== "sent"
        );

        // Merge: server messages + pending optimistic messages
        return [...serverMessages, ...pendingMessages];
      });
      setLoading(false);
    });

    markMessageAsRead(conversationId, userType);
    return unsubscribe;
  }, [conversationId, currentUserId, subscribeToMessages, markMessageAsRead, userType]);

  useEffect(() => {
    hasInitialScrollRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const shouldAnimate = hasInitialScrollRef.current;
    scrollToLatest(shouldAnimate && !isKeyboardVisible);
    hasInitialScrollRef.current = true;
  }, [isKeyboardVisible, loading, messages.length, scrollToLatest]);

  useEffect(() => {
    const handleKeyboardChange = (event) => {
      const nextKeyboardHeight = Number(event?.endCoordinates?.height || 0);
      setKeyboardHeight(nextKeyboardHeight);
      scrollToLatest(false);
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
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await uploadAndSendImage(result.assets[0].uri);
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
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await uploadAndSendImage(result.assets[0].uri);
    }
  };

  const uploadAndSendImage = async (uri) => {
    if (!currentUserId || !conversationId) return;

    const tempId = `temp-img-${Date.now()}`;

    // Optimistic update - show image immediately with local URI
    const optimisticMessage = {
      id: tempId,
      senderId: currentUserId,
      content: uri,
      messageType: "image",
      timestamp: new Date().toISOString(),
      status: "uploading",
    };

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

  const openImageViewer = (imageUri) => {
    setViewerImageUri(imageUri);
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
    setViewerImageUri(null);
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

    // Image message
    if (item.messageType === "image") {
      const isUploading = item.status === "uploading" || item.status === "sending";
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.outgoingContainer : styles.incomingContainer,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.imageBubble,
              item.status === "failed" && styles.failedMsg,
            ]}
            onPress={() => openImageViewer(item.content)}
            activeOpacity={0.9}
            disabled={isUploading}
          >
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: item.content }}
                style={[styles.messageImage, isUploading && styles.imageUploading]}
                resizeMode="cover"
              />
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
          </TouchableOpacity>
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
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            style={styles.messageListContainer}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onLayout={() => scrollToLatest(false)}
            onContentSizeChange={() => {
              if (!hasInitialScrollRef.current) return;
              scrollToLatest(false);
            }}
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

      {/* Full-screen Image Viewer */}
      <MediaViewer
        visible={viewerVisible}
        imageUri={viewerImageUri}
        onClose={closeImageViewer}
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
    padding: spacing.base,
    paddingBottom: spacing.sm,
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
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
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
  },
  imageUploading: {
    opacity: 0.5,
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
