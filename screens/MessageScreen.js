import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function MessageScreen({ navigation, route }) {
  const { currentUser, userType, getMessages, sendMessage, subscribeToMessages, markMessageAsRead } = useAuth();
  const { conversationId, driverName, requestId, driverInfo } = route.params || {};
  const title = driverName || driverInfo?.name || 'Chat';
  
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    setLoading(true);
    
    // Subscribe to real-time messages
    const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
    });

    // Mark messages as read when entering the conversation
    markMessageAsRead(conversationId, userType);

    // Clean up subscription on unmount
    return unsubscribe;
  }, [conversationId, currentUser]);

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation, title]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await sendMessage(conversationId, currentUser.uid, userType, content);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message text on error
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === currentUser?.uid;
    const messageTime = new Date(item.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    if (item.messageType === 'system') {
      return (
        <View style={styles.systemBox}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.outgoingContainer : styles.incomingContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.outgoingMsg : styles.incomingMsg
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.outgoingText : styles.incomingText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.outgoingTime : styles.incomingTime
          ]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

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

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Send message..."
          placeholderTextColor="#999"
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
            color="#fff" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1F' },
  header: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A1F',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  messageList: {
    padding: 16,
    paddingBottom: 100,
  },
  systemBox: {
    backgroundColor: '#1E1E2D',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  systemText: { color: '#ccc', fontSize: 13, textAlign: 'center' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ccc',
    fontSize: 16,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  incomingContainer: {
    alignSelf: 'flex-start',
  },
  outgoingContainer: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  incomingMsg: {
    backgroundColor: '#1E1E2D',
    borderBottomLeftRadius: 4,
  },
  outgoingMsg: {
    backgroundColor: '#a77bff',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  incomingText: { 
    color: '#fff' 
  },
  outgoingText: { 
    color: '#fff' 
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  incomingTime: {
    color: '#ccc',
  },
  outgoingTime: {
    color: '#fff',
  },
  timeBtn: {
    backgroundColor: '#a77bff',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  timeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2D',
    margin: 16,
    borderRadius: 32,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
  },
  sendBtn: {
    backgroundColor: '#a77bff',
    padding: 10,
    borderRadius: 24,
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
});
