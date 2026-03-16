// Chat Message Item component: renders its UI and handles related interactions.
import React from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import styles from "../../screens/shared/MessageScreen.styles";
import { colors, spacing } from "../../styles/theme";

function renderStatusIcon(status) {
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
}

export default function ChatMessageItem({
  item,
  currentUserId,
  mediaType,
  mediaSize,
  onOpenMediaViewer,
  onImageLoad,
  onVideoReady,
  onVideoLoad,
}) {
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

  if (mediaType) {
    const isUploading = item.status === "uploading" || item.status === "sending";
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
          style={[styles.imageBubble, item.status === "failed" && styles.failedMsg]}
          {...(canOpenMediaViewer
            ? {
                onPress: () => onOpenMediaViewer(item.content, mediaType),
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
                onLoad={(event) => onImageLoad(item.id, event)}
              />
            ) : (
              <>
                <View
                  style={[styles.videoContainer, mediaSize, isUploading && styles.imageUploading]}
                >
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
                      onVideoLoad(
                        item.id,
                        status?.naturalSize?.width,
                        status?.naturalSize?.height
                      )
                    }
                    onReadyForDisplay={(event) => onVideoReady(item.id, event)}
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
            <View style={styles.imageTimeOverlay}>
              <Text style={styles.imageTimeText}>{messageTime}</Text>
              {isMyMessage && <View style={styles.statusIcon}>{renderStatusIcon(item.status)}</View>}
            </View>
          </View>
        </MediaBubble>
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
          item.status === "failed" && styles.failedMsg,
        ]}
      >
        <Text
          style={[styles.messageText, isMyMessage ? styles.outgoingText : styles.incomingText]}
        >
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMyMessage ? styles.outgoingTime : styles.incomingTime]}>
            {messageTime}
          </Text>
          {isMyMessage && <View style={styles.statusIcon}>{renderStatusIcon(item.status)}</View>}
        </View>
      </View>
    </View>
  );
}
