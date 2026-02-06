import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated as RNAnimated,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomerMessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, getConversations } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reanimated Hooks
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const headerHeight = interpolate(
      scrollY.value,
      [0, 100],
      [50, 10],
      Extrapolation.CLAMP
    );

    return {
      paddingBottom: headerHeight,
      borderBottomWidth: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
      borderBottomColor: '#2A2A3B',
    };
  });

  const smallTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [40, 60],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const largeTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 40],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const headerContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      paddingTop: insets.top,
      paddingHorizontal: 20,
      backgroundColor: '#0A0A1F',
      zIndex: 100,
      justifyContent: 'center',
      minHeight: 60 + insets.top
    };
  });

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  const loadConversations = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userConversations = await getConversations(currentUser.uid, 'customer');

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

  const getAvatarUrl = (driverName) => {
    const initials = driverName.split(' ').map(n => n[0]).join('').substring(0, 2);
    const colors = ['4A90E2', 'A77BFF', '00D4AA', 'FF6B6B', 'FFD93D'];
    const colorIndex = driverName.length % colors.length;
    return `https://via.placeholder.com/50x50/${colors[colorIndex]}/FFFFFF?text=${initials}`;
  };

  const filteredConversations = conversations.filter(conversation => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'active') return conversation.requestId && conversation.lastMessageAt;
    if (selectedFilter === 'support') return conversation.driverId === 'support';
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
    const driverName = conversation.driverId === 'support' ? 'Support Team' : `Driver ${conversation.driverId.substring(0, 8)}`;
    const isUnread = conversation.unreadByCustomer > 0;
    const status = conversation.driverId === 'support' ? 'support' : 'active';

    return (
      <TouchableOpacity
        key={conversation.id}
        style={[styles.messageItem, isUnread && styles.unreadMessage]}
        onPress={() => {
          navigation.navigate('MessageScreen', {
            conversationId: conversation.id,
            driverId: conversation.driverId,
            driverName: driverName,
            requestId: conversation.requestId
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: getAvatarUrl(driverName) }} style={styles.avatar} />
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
        </View>

        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.driverName, isUnread && styles.unreadText]}>
              {driverName}
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
              <Ionicons name="car-outline" size={12} color="#A77BFF" />
              <Text style={styles.tripId}>Request #{conversation.requestId.substring(0, 8)}</Text>
              <Ionicons
                name={getStatusIcon(status)}
                size={12}
                color={getStatusColor(status)}
                style={{ marginLeft: 8 }}
              />
            </View>
          )}

          <Text style={[styles.lastMessage, isUnread && styles.unreadMessage]} numberOfLines={2}>
            {conversation.lastMessage || 'No messages yet'}
          </Text>
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[headerContainerAnimatedStyle, headerStyle]}>
        {/* Small Title - Centered & Absolute */}
        <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }, smallTitleStyle]}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
            Messages
          </Text>
        </Animated.View>

        {/* Large Title - Standard Flow */}
        <Animated.Text style={[{
          fontWeight: 'bold',
          color: '#fff',
          fontSize: 34,
          marginTop: 10
        }, largeTitleStyle]}>
          Messages
        </Animated.Text>
      </Animated.View>

      {/* Search Bar - Top */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Messages List - Main content area */}
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Loading conversations...</Text>
        </View>
      ) : filteredConversations.length > 0 ? (
        <Animated.ScrollView
          style={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: 10 }}
        >
          {filteredConversations.map(renderConversationItem)}
          <View style={styles.bottomSpacing} />
        </Animated.ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#2A2A3B" />
          <Text style={styles.emptyStateTitle}>No messages yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Messages with your drivers will appear here
          </Text>
        </View>
      )}

      {/* Bottom Controls - Filter Tabs */}
      <View style={[styles.bottomControlsContainer, { paddingBottom: insets.bottom + 12 }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  bottomControlsContainer: {
    backgroundColor: '#0A0A1F',
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    paddingTop: 12,
    gap: 8,
    justifyContent: 'center',
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
    backgroundColor: '#A77BFF',
    borderColor: '#A77BFF',
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
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141426',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  unreadMessage: {
    borderColor: '#A77BFF',
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
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unreadText: {
    color: '#A77BFF',
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
  tripId: {
    color: '#A77BFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  lastMessage: {
    color: '#999',
    fontSize: 14,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A77BFF',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 20,
  },
});