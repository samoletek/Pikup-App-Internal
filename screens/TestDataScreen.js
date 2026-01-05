// screens/TestDataScreen.js - Simple screen to test if data is being saved
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function TestDataScreen({ navigation }) {
  const { currentUser, getUserPickupRequests } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async (isRefresh = false) => {
    if (!currentUser?.accessToken) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const userRequests = await getUserPickupRequests();
      setRequests(userRequests);
      
      if (userRequests.length === 0) {
        Alert.alert('Info', 'No pickup requests found. Create one to test!');
      } else {
        Alert.alert('Success', `Found ${userRequests.length} pickup requests`);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to fetch requests: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchRequests(true);
  };

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser]);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#00D4AA';
      case 'inProgress': return '#A77BFF';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#FF6B6B';
      default: return '#999';
    }
  };

  if (loading && requests.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A77BFF" />
        <Text style={styles.loadingText}>Loading your pickup requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#A77BFF" />
        </TouchableOpacity>
        <Text style={styles.title}>My Pickup Requests</Text>
        <TouchableOpacity onPress={() => fetchRequests()}>
          <Ionicons name="refresh" size={24} color="#A77BFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.userInfoCard}>
          <Text style={styles.userInfo}>
            Logged in as: {currentUser?.email || 'Not logged in'}
          </Text>
          <Text style={styles.requestCount}>
            Total Requests: {requests.length}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => navigation.navigate('CustomerTabs')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create New Pickup Request</Text>
        </TouchableOpacity>

        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#666" />
            <Text style={styles.emptyTitle}>No pickup requests yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a pickup request to see it here!
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.requestsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#A77BFF"
              />
            }
          >
            {requests.map((request, index) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestTitle}>Request #{index + 1}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{request.status || 'pending'}</Text>
                  </View>
                </View>
                
                <Text style={styles.requestId}>ID: {request.id}</Text>
                <Text style={styles.requestDate}>
                  Created: {formatDate(request.createdAt)}
                </Text>
                
                {request.pickup && typeof request.pickup === 'object' && request.pickup.fields?.address?.stringValue && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#A77BFF" />
                    <Text style={styles.locationText}>
                      From: {request.pickup.fields.address.stringValue}
                    </Text>
                  </View>
                )}
                
                {request.dropoff && typeof request.dropoff === 'object' && request.dropoff.fields?.address?.stringValue && (
                  <View style={styles.locationRow}>
                    <Ionicons name="flag" size={14} color="#00D4AA" />
                    <Text style={styles.locationText}>
                      To: {request.dropoff.fields.address.stringValue}
                    </Text>
                  </View>
                )}
                
                {request.item && typeof request.item === 'object' && request.item.fields?.description?.stringValue && (
                  <View style={styles.itemRow}>
                    <Ionicons name="cube" size={14} color="#FFA500" />
                    <Text style={styles.itemText}>
                      Item: {request.item.fields.description.stringValue}
                    </Text>
                  </View>
                )}
                
                {request.pricing && typeof request.pricing === 'object' && request.pricing.fields?.total && (
                  <View style={styles.priceRow}>
                    <Ionicons name="card" size={14} color="#A77BFF" />
                    <Text style={styles.priceText}>
                      Total: ${request.pricing.fields.total.doubleValue || request.pricing.fields.total.stringValue}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userInfoCard: {
    backgroundColor: '#2A2A3B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3A4B',
  },
  userInfo: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  requestCount: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#A77BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  requestsList: {
    flex: 1,
  },
  requestCard: {
    backgroundColor: '#2A2A3B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A3A4B',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requestId: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  requestDate: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3A3A4B',
  },
  priceText: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});