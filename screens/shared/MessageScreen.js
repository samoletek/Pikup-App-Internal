import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import { useAuth } from "../../contexts/AuthContext";
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

  const { conversationId, driverName, driverInfo } = route.params || {};
  const title = driverName || driverInfo?.name || "Chat";
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
    });

    markMessageAsRead(conversationId, userType);
    return unsubscribe;
  }, [conversationId, currentUserId, subscribeToMessages, markMessageAsRead, userType]);

  const handleSend = async () => {
    if (!messageText.trim() || sending || !currentUserId) {
      return;
    }

    const content = messageText.trim();
    setMessageText("");
    setSending(true);

    try {
      await sendMessage(conversationId, currentUserId, userType, content);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageText(content);
    } finally {
      setSending(false);
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
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.outgoingTime : styles.incomingTime,
            ]}
          >
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + spacing.sm : 0}
    >
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
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputRow, { marginBottom: insets.bottom + spacing.base }]}>
          <TextInput
            style={styles.input}
            placeholder="Send message..."
            placeholderTextColor={colors.text.placeholder}
            value={messageText}
            onChangeText={setMessageText}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            disabled={sending}
          >
            <Ionicons
              name={sending ? "hourglass-outline" : "send"}
              size={20}
              color={colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  messageList: {
    padding: spacing.base,
    paddingBottom: 100,
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
    padding: spacing.md,
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
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  incomingTime: {
    color: colors.text.secondary,
  },
  outgoingTime: {
    color: colors.white,
  },
  inputRow: {
    flexDirection: "row",
    backgroundColor: colors.background.tertiary,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    borderRadius: borderRadius.full,
    alignItems: "center",
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: borderRadius.circle,
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
});
