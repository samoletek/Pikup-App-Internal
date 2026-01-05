import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  Image,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
// import * as DocumentPicker from 'expo-document-picker';

export default function CustomerClaimsScreen({ navigation }) {
  const { currentUser, getUserPickupRequests } = useAuth();
  const [activeTab, setActiveTab] = useState('ongoing');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimType, setClaimType] = useState('DAMAGED_GOODS');
  const [showPastTrips, setShowPastTrips] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  // Real claims data from insurance API
  const [ongoingClaims, setOngoingClaims] = useState([]);
  const [completedClaims, setCompletedClaims] = useState([]);
  const [pastTrips, setPastTrips] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);

  // Payment service URL - Use the same URL as AuthContext
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';

  useEffect(() => {
    loadClaimsData();
    loadPastTrips();
    loadDocumentTypes();
  }, []);

  const loadClaimsData = async () => {
    try {
      setLoading(true);
      
      // Get ALL claims and filter on frontend by user email
      const response = await fetch(`${PAYMENT_SERVICE_URL}/insurance/claims`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.accessToken || ''}`,
        },
      });

      if (response.ok) {
        const claimsData = await response.json();
        
        // Filter claims for current user by email only (safe approach)
        const userClaims = claimsData.data?.filter(claim => 
          claim.claimantEmail === currentUser.email
        ) || [];
        
        // Separate ongoing and completed claims
        const ongoing = [];
        const completed = [];
        
        userClaims.forEach(claim => {
          const claimItem = {
            id: claim.id,
            bookingId: claim.bookingId,
            date: new Date(claim.createdAt || claim.lossDate).toLocaleDateString(),
            status: getClaimStatus(claim),
            item: claim.booking?.risk?.commodityName || claim.lossDescription || 'Item',
            description: claim.lossDescription,
            amount: claim.lossEstimatedClaimValue ? `$${claim.lossEstimatedClaimValue.toFixed(2)}` : 'Pending',
            lossDate: claim.lossDate,
            progress: getClaimProgress(claim),
            claimantName: claim.claimantName,
            claimantEmail: claim.claimantEmail,
            rawClaim: claim,
          };

          if (claim.status === 'COMPLETED' || claim.status === 'CLOSED') {
            completed.push({
              ...claimItem,
              resolution: getResolutionText(claim),
              completedDate: new Date(claim.updatedAt || claim.createdAt).toLocaleDateString(),
            });
          } else {
            ongoing.push(claimItem);
          }
        });
        
        setOngoingClaims(ongoing);
        setCompletedClaims(completed);
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to load claims:', response.status, errorData);
        if (response.status === 404) {
          // No claims found is OK
          setOngoingClaims([]);
          setCompletedClaims([]);
        } else {
          Alert.alert('Error', 'Failed to load claims data');
        }
      }
    } catch (error) {
      console.error('Error loading claims:', error);
      Alert.alert('Error', 'Failed to connect to claims service');
    } finally {
      setLoading(false);
    }
  };

  const loadPastTrips = async () => {
    try {
      // Get user's completed pickup requests that had insurance
      const requests = await getUserPickupRequests();
      
      const tripsWithInsurance = requests
        .filter(request => 
          request.status === 'completed' && 
          request.insurance && 
          request.insurance.included &&
          request.insurance.bookingId // Must have actual insurance booking ID
        )
        .map(request => ({
          id: request.id,
          date: new Date(request.completedAt || request.createdAt).toLocaleDateString(),
          pickup: request.pickup?.address || 'Pickup Location',
          dropoff: request.dropoff?.address || 'Dropoff Location',
          item: request.item?.description || 'Items',
          driver: 'Driver',
          amount: `${request.pricing?.total || '0.00'}`,
          insuranceValue: request.itemValue || 500,
          // Use the actual insurance booking ID (from purchase response)
          bookingId: request.insurance.bookingId,
          quoteId: request.insurance.quoteId,
        }));
      
      setPastTrips(tripsWithInsurance);
    } catch (error) {
      console.error('Error loading past trips:', error);
      Alert.alert('Error', 'Failed to load past trips');
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/insurance/claims-document-types`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.accessToken || ''}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentTypes(data.documentTypes || []);
      } else {
        console.warn('Failed to load document types, using defaults');
        setDocumentTypes([
          'PHOTOS_DAMAGE',
          'PHOTOS_SCENE', 
          'POLICE_REPORT',
          'RECEIPT',
          'INVOICE',
          'MEDICAL_REPORT',
          'WITNESS_STATEMENT',
          'OTHER'
        ]);
      }
    } catch (error) {
      console.error('Error loading document types:', error);
      setDocumentTypes([
        'PHOTOS_DAMAGE',
        'PHOTOS_SCENE',
        'POLICE_REPORT', 
        'RECEIPT',
        'INVOICE',
        'MEDICAL_REPORT',
        'WITNESS_STATEMENT',
        'OTHER'
      ]);
    }
  };

  const getClaimStatus = (claim) => {
    if (!claim.status) return 'filed';
    
    switch (claim.status.toUpperCase()) {
      case 'SUBMITTED':
      case 'PENDING':
        return 'filed';
      case 'IN_PROGRESS':
      case 'INVESTIGATING':
        return 'processing';
      case 'UNDER_REVIEW':
        return 'review';
      case 'COMPLETED':
      case 'CLOSED':
        return 'completed';
      default:
        return 'filed';
    }
  };

  const getClaimProgress = (claim) => {
    const status = getClaimStatus(claim);
    switch (status) {
      case 'filed': return 20;
      case 'processing': return 50;
      case 'review': return 75;
      case 'completed': return 100;
      default: return 20;
    }
  };

  const getResolutionText = (claim) => {
    if (claim.resolution) return claim.resolution;
    if (claim.status === 'COMPLETED') return 'Claim processed successfully';
    return 'Claim reviewed';
  };

  const getClaimStatusText = (status) => {
    switch (status) {
      case 'filed': return 'Claim Filed';
      case 'processing': return 'Processing';
      case 'review': return 'Under Review';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  const getClaimStatusColor = (status) => {
    switch (status) {
      case 'filed': return '#A77BFF';
      case 'processing': return '#FFB347';
      case 'review': return '#4A90E2';
      case 'completed': return '#00D4AA';
      default: return '#999';
    }
  };

  const handleStartClaim = () => {
    setShowPastTrips(true);
  };

  const handleSelectTrip = async (trip) => {
    try {
      // Verify this booking can have claims filed
      const setupResponse = await fetch(
        `${PAYMENT_SERVICE_URL}/insurance/claims/setup/${trip.bookingId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken || ''}`,
          },
        }
      );

      if (setupResponse.ok) {
        const setupData = await setupResponse.json();
        if (!setupData.claimsEnabled) {
          Alert.alert('Error', 'Claims are not enabled for this delivery');
          return;
        }
        
        setSelectedTrip({
          ...trip,
          setupData
        });
        setShowPastTrips(false);
        setModalVisible(true);
      } else {
        const errorData = await setupResponse.json().catch(() => null);
        if (setupResponse.status === 404) {
          Alert.alert('Error', 'This delivery is not found in the insurance system');
        } else {
          Alert.alert('Error', 'Cannot verify insurance coverage for this delivery');
        }
      }
    } catch (error) {
      console.error('Error checking claims setup:', error);
      Alert.alert('Error', 'Failed to verify insurance coverage');
    }
  };

  const handleAddDocument = async () => {
    Alert.alert(
      'Add Document',
      'Choose document type',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose File', onPress: pickDocument },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const document = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: result.assets[0].fileSize || 0,
          documentType: 'PHOTOS_DAMAGE',
        };
        setSelectedDocuments([...selectedDocuments, document]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickDocument = async () => {
    // Temporarily disabled - requires expo-document-picker
    Alert.alert('Feature Temporarily Unavailable', 'Document picker will be available in the next update');
    /*
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const document = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: result.assets[0].mimeType,
          size: result.assets[0].size,
          documentType: 'OTHER',
        };
        setSelectedDocuments([...selectedDocuments, document]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
    */
  };

  const removeDocument = (documentId) => {
    setSelectedDocuments(selectedDocuments.filter(doc => doc.id !== documentId));
  };

  const handleSubmitClaim = async () => {
    if (!claimDescription.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    if (!selectedTrip) {
      Alert.alert('Error', 'No trip selected');
      return;
    }

    setSubmitting(true);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Use the actual insurance booking ID
      const bookingId = selectedTrip.bookingId;
      
      // Add claim data - only send what the insurance API expects
      formData.append('bookingId', bookingId);
      formData.append('lossType', claimType);
      formData.append('lossDate', new Date().toISOString().split('T')[0]);
      formData.append('lossDescription', claimDescription);
      formData.append('lossEstimatedClaimValue', String(selectedTrip.insuranceValue || 500));
      formData.append('claimantName', currentUser.displayName || currentUser.email);
      formData.append('claimantEmail', currentUser.email);

      // DO NOT send your app's customerId to avoid conflicts with insurance API

      // Add document types
      const documentTypesList = selectedDocuments.map(doc => doc.documentType);
      formData.append('documentTypes', JSON.stringify(documentTypesList));

      // Add files in proper React Native format
      selectedDocuments.forEach((doc, index) => {
        formData.append('documents', {
          uri: doc.uri,
          name: doc.name,
          type: doc.type,
        });
      });

      console.log('Submitting claim with data:', {
        bookingId,
        lossType: claimType,
        lossDescription: claimDescription,
        claimantEmail: currentUser.email,
        documentCount: selectedDocuments.length
      });

      // Don't set Content-Type header - let React Native handle FormData
      const response = await fetch(`${PAYMENT_SERVICE_URL}/insurance/claims`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken || ''}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Claim submitted successfully:', result);
        
        // Reset form
        setClaimDescription('');
        setClaimType('DAMAGED_GOODS');
        setSelectedDocuments([]);
        setModalVisible(false);
        
        // Reload claims data
        await loadClaimsData();
        
        Alert.alert(
          'Claim Submitted',
          'Your claim has been submitted successfully. We will review it shortly.',
          [{ text: 'OK' }]
        );
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Claim submission failed:', response.status, error);
        throw new Error(error.error || `Failed to submit claim (${response.status})`);
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      let errorMessage = 'Failed to submit claim. Please try again.';
      
      if (error.message.includes('not found')) {
        errorMessage = 'Booking not found or claims not available for this trip.';
      } else if (error.message.includes('not enabled')) {
        errorMessage = 'Claims are not enabled for this booking.';
      } else if (error.message.includes('File too large')) {
        errorMessage = 'One or more files are too large. Maximum size is 10MB.';
      } else if (error.message.includes('Too many files')) {
        errorMessage = 'Too many files selected. Maximum is 10 files.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderClaimItem = ({ item }) => {
    const statusText = getClaimStatusText(item.status);
    const statusColor = getClaimStatusColor(item.status);
    
    return (
      <View style={styles.claimCard}>
        <View style={styles.claimHeader}>
          <View style={styles.claimInfo}>
            <Text style={styles.claimDate}>{item.date}</Text>
            <Text style={styles.claimItem}>{item.item}</Text>
          </View>
          <Text style={styles.claimAmount}>{item.amount}</Text>
        </View>
        
        <Text style={styles.claimDescription} numberOfLines={2}>
          {item.description}
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${item.progress}%`, backgroundColor: statusColor }
              ]} 
            />
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {item.status === 'completed' && (
          <View style={styles.resolutionContainer}>
            <Text style={styles.resolutionLabel}>Resolution:</Text>
            <Text style={styles.resolutionText}>{item.resolution}</Text>
            <Text style={styles.completedDate}>Completed on {item.completedDate}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#A77BFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderTripItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.tripCard} 
      onPress={() => handleSelectTrip(item)}
    >
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>{item.date}</Text>
        <Text style={styles.tripAmount}>{item.amount}</Text>
      </View>
      
      <View style={styles.tripDetails}>
        <View style={styles.tripLocationContainer}>
          <Ionicons name="location" size={16} color="#A77BFF" />
          <View style={styles.tripLocations}>
            <Text style={styles.tripLocation}>{item.pickup} → {item.dropoff}</Text>
          </View>
        </View>
        
        <View style={styles.tripItemContainer}>
          <Ionicons name="cube-outline" size={16} color="#A77BFF" />
          <Text style={styles.tripItemText}>{item.item}</Text>
        </View>
        
        <View style={styles.insuranceContainer}>
          <Ionicons name="shield-checkmark" size={16} color="#00D4AA" />
          <Text style={styles.insuranceText}>
            Insured up to ${item.insuranceValue?.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDocumentItem = ({ item }) => (
    <View style={styles.documentItem}>
      <View style={styles.documentInfo}>
        <Ionicons 
          name={item.type.startsWith('image/') ? 'image' : 'document'} 
          size={20} 
          color="#A77BFF" 
        />
        <Text style={styles.documentName}>{item.name}</Text>
      </View>
      <TouchableOpacity 
        style={styles.removeDocumentButton}
        onPress={() => removeDocument(item.id)}
      >
        <Ionicons name="close-circle" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A77BFF" />
          <Text style={styles.loadingText}>Loading claims...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Claims</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={loadClaimsData}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Insurance Banner */}
      <View style={styles.insuranceBanner}>
        <View style={styles.insuranceIcon}>
          <Ionicons name="shield-checkmark" size={24} color="#A77BFF" />
        </View>
        <View style={styles.insuranceContent}>
          <Text style={styles.insuranceTitle}>Redkik Insurance</Text>
          <Text style={styles.insuranceText}>
            File claims for insured deliveries through our secure portal
          </Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'ongoing' && styles.activeTab]}
          onPress={() => setActiveTab('ongoing')}
        >
          <Text style={[styles.tabText, activeTab === 'ongoing' && styles.activeTabText]}>
            Ongoing ({ongoingClaims.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({completedClaims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Claims List */}
      {!showPastTrips ? (
        <>
          <FlatList
            data={activeTab === 'ongoing' ? ongoingClaims : completedClaims}
            renderItem={renderClaimItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.claimsList}
            refreshing={loading}
            onRefresh={loadClaimsData}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#666" />
                <Text style={styles.emptyStateText}>
                  {activeTab === 'ongoing' 
                    ? 'No ongoing claims' 
                    : 'No completed claims'}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Claims can only be filed for deliveries with insurance coverage
                </Text>
              </View>
            }
          />

          {/* Start New Claim Button */}
          {pastTrips.length > 0 && (
            <TouchableOpacity 
              style={styles.startClaimButton}
              onPress={handleStartClaim}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.startClaimText}>File New Claim</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <View style={styles.pastTripsHeader}>
            <Text style={styles.pastTripsTitle}>Select Insured Delivery</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowPastTrips(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={pastTrips}
            renderItem={renderTripItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.tripsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color="#666" />
                <Text style={styles.emptyStateText}>No insured deliveries found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Only deliveries with insurance coverage can have claims filed
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Enhanced Claim Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>File Insurance Claim</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.tripSummary}>
                <Text style={styles.tripSummaryTitle}>Delivery Details</Text>
                <Text style={styles.tripSummaryDate}>{selectedTrip?.date}</Text>
                <Text style={styles.tripSummaryItem}>{selectedTrip?.item}</Text>
                <View style={styles.tripSummaryRoute}>
                  <Ionicons name="location-outline" size={16} color="#A77BFF" />
                  <Text style={styles.tripSummaryRouteText}>
                    {selectedTrip?.pickup} → {selectedTrip?.dropoff}
                  </Text>
                </View>
                <View style={styles.insuranceInfo}>
                  <Ionicons name="shield-checkmark" size={16} color="#00D4AA" />
                  <Text style={styles.insuranceInfoText}>
                    Insured value: ${selectedTrip?.insuranceValue?.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.claimTypeContainer}>
                <Text style={styles.claimTypeLabel}>Issue Type:</Text>
                <View style={styles.claimTypeOptions}>
                  <TouchableOpacity 
                    style={[
                      styles.claimTypeOption, 
                      claimType === 'DAMAGED_GOODS' && styles.claimTypeSelected
                    ]}
                    onPress={() => setClaimType('DAMAGED_GOODS')}
                  >
                    <Text style={[
                      styles.claimTypeText,
                      claimType === 'DAMAGED_GOODS' && styles.claimTypeTextSelected
                    ]}>
                      Damaged
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.claimTypeOption, 
                      claimType === 'LOST_GOODS' && styles.claimTypeSelected
                    ]}
                    onPress={() => setClaimType('LOST_GOODS')}
                  >
                    <Text style={[
                      styles.claimTypeText,
                      claimType === 'LOST_GOODS' && styles.claimTypeTextSelected
                    ]}>
                      Lost/Missing
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.claimTypeOption, 
                      claimType === 'OTHER' && styles.claimTypeSelected
                    ]}
                    onPress={() => setClaimType('OTHER')}
                  >
                    <Text style={[
                      styles.claimTypeText,
                      claimType === 'OTHER' && styles.claimTypeTextSelected
                    ]}>
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Describe the issue: *</Text>
                <TextInput
                  style={styles.textInput}
                  multiline={true}
                  numberOfLines={4}
                  placeholder="Please provide detailed information about what happened..."
                  placeholderTextColor="#999"
                  value={claimDescription}
                  onChangeText={setClaimDescription}
                />
              </View>

              <View style={styles.documentsContainer}>
                <Text style={styles.documentsLabel}>Supporting Documents:</Text>
                
                {selectedDocuments.length > 0 && (
                  <FlatList
                    data={selectedDocuments}
                    renderItem={renderDocumentItem}
                    keyExtractor={(item) => item.id}
                    style={styles.documentsList}
                  />
                )}

                <TouchableOpacity 
                  style={styles.addDocumentButton}
                  onPress={handleAddDocument}
                >
                  <Ionicons name="add-circle" size={24} color="#A77BFF" />
                  <Text style={styles.addDocumentText}>Add Photo or Document</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitClaim}
              disabled={submitting}
            >
              {submitting ? (
                <View style={styles.submittingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Submit Claim</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Comprehensive styles for the component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#141426',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#A77BFF',
    fontSize: 16,
    marginTop: 10,
  },
  insuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    margin: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  insuranceIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#A77BFF20',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  insuranceText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#1E1E38',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#A77BFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#fff',
  },
  claimsList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  claimCard: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  claimInfo: {
    flex: 1,
  },
  claimDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  claimItem: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
  },
  claimDescription: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#2A2A3B',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  resolutionContainer: {
    backgroundColor: '#0A0A1F',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resolutionLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  completedDate: {
    fontSize: 12,
    color: '#00D4AA',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#A77BFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  startClaimButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    left: 20,
    backgroundColor: '#A77BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startClaimText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  pastTripsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#141426',
  },
  pastTripsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripsList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  tripCard: {
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 14,
    color: '#999',
  },
  tripAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
  },
  tripDetails: {
    gap: 8,
  },
  tripLocationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripLocations: {
    flex: 1,
    marginLeft: 8,
  },
  tripLocation: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  tripItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripItemText: {
    fontSize: 14,
    color: '#CCC',
    marginLeft: 8,
  },
  insuranceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceText: {
    fontSize: 14,
    color: '#00D4AA',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#141426',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: '70%',
  },
  tripSummary: {
    backgroundColor: '#1E1E38',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  tripSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  tripSummaryDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  tripSummaryItem: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  tripSummaryRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripSummaryRouteText: {
    fontSize: 14,
    color: '#CCC',
    marginLeft: 8,
  },
  insuranceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceInfoText: {
    fontSize: 14,
    color: '#00D4AA',
    marginLeft: 8,
    fontWeight: '500',
  },
  claimTypeContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  claimTypeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 12,
  },
  claimTypeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  claimTypeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E1E38',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    alignItems: 'center',
  },
  claimTypeSelected: {
    backgroundColor: '#A77BFF',
    borderColor: '#A77BFF',
  },
  claimTypeText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  claimTypeTextSelected: {
    color: '#fff',
  },
  inputContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1E1E38',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    padding: 16,
    color: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  documentsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  documentsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 12,
  },
  documentsList: {
    marginBottom: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E38',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  removeDocumentButton: {
    padding: 4,
  },
  addDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E38',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#A77BFF',
    borderStyle: 'dashed',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  addDocumentText: {
    fontSize: 14,
    color: '#A77BFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#A77BFF',
    margin: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#666',
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});