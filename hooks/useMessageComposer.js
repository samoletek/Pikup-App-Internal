import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { compressImage, uploadToSupabase } from "../services/StorageService";
import { logger } from "../services/logger";

const dedupeMessagesById = (list = []) => {
  const seen = new Set();
  const deduped = [];

  (Array.isArray(list) ? list : []).forEach((message) => {
    const messageId = String(message?.id || "").trim();
    if (!messageId) {
      deduped.push(message);
      return;
    }

    if (seen.has(messageId)) {
      return;
    }

    seen.add(messageId);
    deduped.push(message);
  });

  return deduped;
};

export default function useMessageComposer({
  conversationId,
  currentUserId,
  userType,
  sendMessage,
  setMessages,
  saveMediaNaturalSize,
}) {
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadAndSendImage = useCallback(
    async (asset) => {
      if (!currentUserId || !conversationId) {
        return;
      }

      const uri = typeof asset === "string" ? asset : asset?.uri;
      if (!uri) {
        return;
      }

      const tempId = `temp-img-${Date.now()}`;
      const imageWidth = Number(asset?.width || 0);
      const imageHeight = Number(asset?.height || 0);

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

      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
      setUploadingImage(true);

      try {
        const compressedUri = await compressImage(uri);
        const filename = `${currentUserId}/${conversationId}/${Date.now()}.jpg`;
        const publicUrl = await uploadToSupabase(
          compressedUri,
          "chat-attachments",
          filename
        );

        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempId ? { ...msg, content: publicUrl, status: "sending" } : msg
          )
        );

        const sentMessage = await sendMessage(
          conversationId,
          currentUserId,
          userType,
          publicUrl,
          "image"
        );

        setMessages((prevMessages) => {
          const updated = prevMessages.map((msg) =>
            msg.id === tempId ? { ...sentMessage, status: "sent" } : msg
          );
          return dedupeMessagesById(updated);
        });
      } catch (error) {
        logger.error("MessageComposer", "Error uploading image", error);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempId ? { ...msg, status: "failed" } : msg
          )
        );
        Alert.alert("Upload Failed", "Failed to upload image. Please try again.");
      } finally {
        setUploadingImage(false);
      }
    },
    [
      conversationId,
      currentUserId,
      saveMediaNaturalSize,
      sendMessage,
      setMessages,
      userType,
    ]
  );

  const takePhoto = useCallback(async () => {
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
  }, [uploadAndSendImage]);

  const pickImageFromLibrary = useCallback(async () => {
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
  }, [uploadAndSendImage]);

  const handleAttachPress = useCallback(() => {
    if (!conversationId) {
      Alert.alert("Chat unavailable", "Conversation was not initialized.");
      return;
    }

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
  }, [conversationId, pickImageFromLibrary, takePhoto]);

  const handleSend = useCallback(async () => {
    if (!conversationId) {
      Alert.alert("Chat unavailable", "Conversation was not initialized.");
      return;
    }

    if (!messageText.trim() || sending || !currentUserId) {
      return;
    }

    const content = messageText.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      senderId: currentUserId,
      content,
      messageType: "text",
      timestamp: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
    setMessageText("");
    setSending(true);

    try {
      const sentMessage = await sendMessage(
        conversationId,
        currentUserId,
        userType,
        content
      );

      setMessages((prevMessages) => {
        const updated = prevMessages.map((msg) =>
          msg.id === tempId ? { ...sentMessage, status: "sent" } : msg
        );
        return dedupeMessagesById(updated);
      });
    } catch (error) {
      logger.error("MessageComposer", "Error sending message", error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId ? { ...msg, status: "failed" } : msg
        )
      );
      setMessageText(content);
    } finally {
      setSending(false);
    }
  }, [
    conversationId,
    currentUserId,
    messageText,
    sendMessage,
    sending,
    setMessages,
    userType,
  ]);

  return {
    messageText,
    setMessageText,
    sending,
    uploadingImage,
    handleAttachPress,
    handleSend,
  };
}
