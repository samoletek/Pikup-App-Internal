import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function DriverMessagesScreen({ navigation }) {
  const { currentUser, getConversations } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  const loadConversations = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const userConversations = await getConversations(currentUser.uid, 'driver');
      
      // Filter out invalid conversations
      const validConversations = userConversations.filter(conv => 
        conv.customerId && conv.driverId && conv.requestId
      );
      
      setConversations(validConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Show user-friendly error
      Alert.alert(
        'Unable to Load Messages',
        'Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInMinutes / 10080)} week${Math.floor(diffInMinutes / 10080) > 1 ? 's' : ''} ago`;
  };

  const getAvatarUrl = (customerName) => {
    const initials = customerName.split(' ').map(n => n[0]).join('').substring(0, 2);
    const colors = ['4A90E2', 'A77BFF', '00D4AA', 'FF6B6B', 'FFD93D'];
    const colorIndex = customerName.length % colors.length;
    return `https://via.placeholder.com/50x50/${colors[colorIndex]}/FFFFFF?text=${initials}`;
  };


  const filteredConversations = conversations.filter(conversation => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'active') return conversation.requestId && conversation.lastMessageAt;
    if (selectedFilter === 'support') return conversation.customerId === 'support';
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#00D4AA';
      case 'completed': return '#999';
      case 'support': return '#A77BFF';
      default: return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'radio-button-on';
      case 'completed': return 'checkmark-circle';
      case 'support': return 'help-circle';
      default: return 'ellipse';
    }
  };

  const renderConversationItem = (conversation) => {
    const customerName = conversation.customerId === 'support' ? 'Support Team' : `Customer ${conversation.customerId.substring(0, 8)}`;
    const isUnread = conversation.unreadByDriver > 0;
    const status = conversation.customerId === 'support' ? 'support' : 'active';
    
    return (
      <TouchableOpacity 
        key={conversation.id} 
        style={[styles.messageItem, isUnread && styles.unreadMessage]}
        onPress={() => {
          navigation.navigate('MessageScreen', { 
            conversationId: conversation.id,
            customerId: conversation.customerId,
            customerName: customerName,
            requestId: conversation.requestId 
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: getAvatarUrl(customerName) }} style={styles.avatar} />
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
          {isUnread && <View style={styles.unreadIndicator} />}
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.customerName, isUnread && styles.unreadText]}>
              {customerName}
            </Text>
            <View style={styles.messageInfo}>
              {conversation.lastMessageAt && (
                <Text style={styles.timestamp}>
                  {formatTimestamp(conversation.lastMessageAt)}
                </Text>
              )}
            </View>
          </View>

          {conversation.requestId && (
            <View style={styles.tripInfo}>
              <Ionicons name="cube-outline" size={12} color="#00D4AA" />
              <Text style={styles.tripId}>Request #{conversation.requestId.substring(0, 8)}</Text>
              <Ionicons 
                name={getStatusIcon(status)} 
                size={12} 
                color={getStatusColor(status)} 
                style={{ marginLeft: 8 }}
              />
            </View>
          )}

          <Text style={[styles.lastMessage, isUnread && styles.unreadMessageText]} numberOfLines={2}>
            {conversation.lastMessage || 'No messages yet'}
          </Text>

          {isUnread && (
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickReplyButton}>
                <Ionicons name="chatbubble" size={12} color="#00D4AA" />
                <Text style={styles.quickReplyText}>Quick Reply</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Driver Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusInfo}>
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Online • Available for pickups</Text>
          </View>
          <Text style={styles.statusSubtext}>{conversations.filter(c => c.requestId && c.lastMessageAt).length} active conversations</Text>
        </View>
        <TouchableOpacity style={styles.statusButton}>
          <Ionicons name="settings" size={16} color="#00D4AA" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterTab, selectedFilter === 'all' && styles.activeFilter]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.activeFilterText]}>
            All
          </Text>
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{conversations.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterTab, selectedFilter === 'active' && styles.activeFilter]}
          onPress={() => setSelectedFilter('active')}
        >
          <Text style={[styles.filterText, selectedFilter === 'active' && styles.activeFilterText]}>
            Active
          </Text>
          <View style={[styles.filterBadge, { backgroundColor: '#00D4AA' }]}>
            <Text style={styles.filterBadgeText}>
              {conversations.filter(c => c.requestId && c.lastMessageAt).length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterTab, selectedFilter === 'support' && styles.activeFilter]}
          onPress={() => setSelectedFilter('support')}
        >
          <Text style={[styles.filterText, selectedFilter === 'support' && styles.activeFilterText]}>
            Support
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions for Drivers */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton}>
          <Ionicons name="document-text" size={20} color="#FFD93D" />
          <Text style={styles.quickActionText}>Report Issue</Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Loading conversations...</Text>
          </View>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map(renderConversationItem)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#2A2A3B" />
            <Text style={styles.emptyStateTitle}>No messages yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Messages with your customers will appear here
            </Text>
          </View>
        )}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#141426',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: '#141426',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  statusInfo: {
    flex: 1,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4AA',
    marginRight: 8,
  },
  statusText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
  },
  statusSubtext: {
    color: '#999',
    fontSize: 12,
  },
  statusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141426',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141426',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  activeFilter: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  filterText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#2A2A3B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#141426',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  unreadMessage: {
    borderColor: '#00D4AA',
    backgroundColor: '#1A1A3A',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#141426',
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00D4AA',
    borderWidth: 2,
    borderColor: '#141426',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unreadText: {
    color: '#00D4AA',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingText: {
    color: '#999',
    fontSize: 12,
    marginLeft: 2,
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemType: {
    color: '#00D4AA',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  tripId: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  unreadMessageText: {
    color: '#fff',
    fontWeight: '500',
  },
  quickReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A3A2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  quickReplyText: {
    color: '#00D4AA',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4AA',
    marginLeft: 8,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
});