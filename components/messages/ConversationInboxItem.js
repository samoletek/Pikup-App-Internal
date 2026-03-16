// Conversation Inbox Item component: renders its UI and handles related interactions.
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import styles from "./messagesInboxStyles";

export default function ConversationInboxItem({
  avatarUrl,
  avatarInitial,
  peerName,
  timestampLabel,
  metaIconName,
  metaColor,
  metaLabel,
  lastMessage,
  isUnread,
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.messageItem} onPress={onPress}>
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
            {peerName}
          </Text>
          <Text style={styles.timestamp}>{timestampLabel}</Text>
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
          {lastMessage || "No messages yet"}
        </Text>
      </View>

      {isUnread ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}
