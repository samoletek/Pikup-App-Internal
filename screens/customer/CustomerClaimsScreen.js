import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Image,
  Alert,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

export default function CustomerClaimsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, getUserPickupRequests } = useAuth();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
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

  const loadClaimsData = async () => {
    try {
      setLoading(true);

      const { data: claims, error } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', currentUser.uid || currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (claims) {
        // Separate ongoing and completed claims
        const ongoing = [];
        const completed = [];

        claims.forEach(claim => {
          const claimItem = {
            id: claim.id,
            bookingId: claim.booking_id,
            date: new Date(claim.created_at || claim.loss_date).toLocaleDateString(),
            status: claim.status, // Assuming status matches app expectation or needs mapping
            item: claim.loss_description || 'Item', // Schema might differ slightly
            description: claim.loss_description,
            amount: claim.estimated_value ? `$${claim.estimated_value}` : 'Pending',
            lossDate: claim.loss_date,
            progress: getClaimProgress({ status: claim.status }),
            claimantName: claim.claimant_name,
            claimantEmail: claim.claimant_email,
            rawClaim: claim,
          };

          if (claim.status === 'COMPLETED' || claim.status === 'CLOSED') {
            completed.push({
              ...claimItem,
              resolution: claim.resolution || 'Resolved',
              completedDate: new Date(claim.updated_at || claim.created_at).toLocaleDateString(),
            });
          } else {
            ongoing.push(claimItem);
          }
        });

        setOngoingClaims(ongoing);
        setCompletedClaims(completed);
      } else {
        setOngoingClaims([]);
        setCompletedClaims([]);
      }
    } catch (error) {
      console.error('Error loading claims:', error);
      // Alert.alert('Error', 'Failed to load claims history');
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
          normalizeTripStatus(request.status) === TRIP_STATUS.COMPLETED &&
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
    // MIGRATION: Using static defaults
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
      case 'filed': return colors.primary;
      case 'processing': return colors.warning;
      case 'review': return colors.info;
      case 'completed': return colors.success;
      default: return colors.text.tertiary;
    }
  };

  const handleStartClaim = () => {
    setShowPastTrips(true);
  };

  const handleSelectTrip = async (trip) => {
    // MIGRATION: Stub check
    // Assuming if it has insurance bookingId, it's valid for now.
    if (!trip.bookingId) {
      Alert.alert('Error', 'This delivery does not have insurance details.');
      return;
    }

    setSelectedTrip({
      ...trip,
      setupData: { claimsEnabled: true } // Stub
    });
    setShowPastTrips(false);
    setModalVisible(true);
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
      console.log('Submitting claim via Edge Function...');

      const { data, error } = await supabase.functions.invoke('submit-claim', {
        body: {
          bookingId: selectedTrip.bookingId,
          lossType: claimType,
          lossDate: new Date().toISOString().split('T')[0],
          lossDescription: claimDescription,
          lossEstimatedClaimValue: selectedTrip.insuranceValue || 500, // Should be number
          claimantName: currentUser.displayName || currentUser.email,
          claimantEmail: currentUser.email,
          documentTypes: selectedDocuments.map(doc => doc.documentType),
          // TODO: Files should ideally be uploaded to Supabase Storage first and URLs sent.
          // For now, only metadata is sent to the function.
          // Real implementation requires client-side upload logic.
        }
      });

      if (error) throw error;

      console.log('Claim submitted successfully:', data);

      // Reset form
      setClaimDescription('');
      setClaimType('DAMAGED_GOODS');
      setSelectedDocuments([]);
      setModalVisible(false);

      // Reload claims data
      await loadClaimsData();

      Alert.alert(
        'Claim Submitted',
        'Your claim has been submitted successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting claim:', error);
      Alert.alert('Error', 'Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderClaimItem = ({ item }) => {
    const claimStatus = getClaimStatus(item);
    const statusText = getClaimStatusText(claimStatus);
    const statusColor = getClaimStatusColor(claimStatus);

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

        {claimStatus === 'completed' && (
          <View style={styles.resolutionContainer}>
            <Text style={styles.resolutionLabel}>Resolution:</Text>
            <Text style={styles.resolutionText}>{getResolutionText(item)}</Text>
            <Text style={styles.completedDate}>Completed on {item.completedDate}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.viewDetailsButton}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
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
          <Ionicons name="location" size={16} color={colors.primary} />
          <View style={styles.tripLocations}>
            <Text style={styles.tripLocation}>{item.pickup} → {item.dropoff}</Text>
          </View>
        </View>

        <View style={styles.tripItemContainer}>
          <Ionicons name="cube-outline" size={16} color={colors.primary} />
          <Text style={styles.tripItemText}>{item.item}</Text>
        </View>

        <View style={styles.insuranceContainer}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
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
          color={colors.primary}
        />
        <Text style={styles.documentName}>{item.name}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeDocumentButton}
        onPress={() => removeDocument(item.id)}
      >
        <Ionicons name="close-circle" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Claims"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
          rightContent={
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadClaimsData}
              accessibilityRole="button"
              accessibilityLabel="Refresh claims"
            >
              <Ionicons name="refresh" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          }
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading claims...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Claims"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
        rightContent={
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadClaimsData}
            accessibilityRole="button"
            accessibilityLabel="Refresh claims"
          >
            <Ionicons name="refresh" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        }
      />

      <View style={[styles.topSection, { maxWidth: contentMaxWidth }]}>
        {/* Insurance Banner */}
        <View style={styles.insuranceBanner}>
          <View style={styles.insuranceIcon}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          </View>
          <View style={styles.insuranceContent}>
            <Text style={styles.insuranceTitle}>Redkik Insurance</Text>
            <Text style={styles.insuranceBannerText}>
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
      </View>

      {/* Claims List */}
      {!showPastTrips ? (
        <>
          <FlatList
            data={activeTab === 'ongoing' ? ongoingClaims : completedClaims}
            renderItem={renderClaimItem}
            keyExtractor={(item) => item.id}
            style={[styles.listViewport, { maxWidth: contentMaxWidth }]}
            contentContainerStyle={styles.claimsList}
            refreshing={loading}
            onRefresh={loadClaimsData}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={colors.text.subtle} />
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
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.startClaimText}>File New Claim</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <View style={[styles.pastTripsHeader, { maxWidth: contentMaxWidth }]}>
            <Text style={styles.pastTripsTitle}>Select Insured Delivery</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPastTrips(false)}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={pastTrips}
            renderItem={renderTripItem}
            keyExtractor={(item) => item.id}
            style={[styles.listViewport, { maxWidth: contentMaxWidth }]}
            contentContainerStyle={styles.tripsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color={colors.text.subtle} />
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
                <Ionicons name="close" size={24} color={colors.text.subtle} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.tripSummary}>
                <Text style={styles.tripSummaryTitle}>Delivery Details</Text>
                <Text style={styles.tripSummaryDate}>{selectedTrip?.date}</Text>
                <Text style={styles.tripSummaryItem}>{selectedTrip?.item}</Text>
                <View style={styles.tripSummaryRoute}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.tripSummaryRouteText}>
                    {selectedTrip?.pickup} → {selectedTrip?.dropoff}
                  </Text>
                </View>
                <View style={styles.insuranceInfo}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.success} />
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
                  placeholderTextColor={colors.text.tertiary}
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
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
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
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Submit Claim</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Comprehensive styles for the component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  topSection: {
    width: '100%',
    alignSelf: 'center',
  },
  listViewport: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
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
    color: colors.primary,
    fontSize: typography.fontSize.md,
    marginTop: spacing.sm + spacing.xs,
  },
  insuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.panel,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    padding: spacing.md + spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  insuranceIcon: {
    width: 50,
    height: 50,
    backgroundColor: colors.primaryLight,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md + spacing.xs,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  insuranceBannerText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: 16,
    borderRadius: borderRadius.xs + 2,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  activeTabText: {
    color: colors.white,
  },
  claimsList: {
    paddingHorizontal: spacing.base,
    paddingBottom: 100,
  },
  claimCard: {
    backgroundColor: colors.background.panel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
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
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  claimItem: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  claimDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.strong,
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
    backgroundColor: colors.background.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resolutionLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 14,
    color: colors.white,
    marginBottom: 4,
  },
  completedDate: {
    fontSize: 12,
    color: colors.success,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  viewDetailsText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    color: colors.text.subtle,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.text.subtle,
    textAlign: 'center',
    marginTop: spacing.xs + 1,
  },
  startClaimButton: {
    position: 'absolute',
    bottom: spacing.xl + spacing.xs,
    left: spacing.base,
    right: spacing.base,
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.md,
  },
  startClaimText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  pastTripsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + spacing.xs,
    backgroundColor: colors.background.secondary,
    width: '100%',
    alignSelf: 'center',
  },
  pastTripsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripsList: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl + spacing.xs,
  },
  tripCard: {
    backgroundColor: colors.background.panel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  tripAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
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
    color: colors.white,
    lineHeight: 20,
  },
  tripItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripItemText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  insuranceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceText: {
    fontSize: 14,
    color: colors.success,
    marginLeft: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    width: '100%',
    maxWidth: layout.sheetMaxWidth,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
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
    backgroundColor: colors.background.panel,
    margin: spacing.base,
    padding: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  tripSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 12,
  },
  tripSummaryDate: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: 8,
  },
  tripSummaryItem: {
    fontSize: 16,
    color: colors.white,
    marginBottom: 12,
  },
  tripSummaryRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripSummaryRouteText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  insuranceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceInfoText: {
    fontSize: 14,
    color: colors.success,
    marginLeft: 8,
    fontWeight: '500',
  },
  claimTypeContainer: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  claimTypeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
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
    backgroundColor: colors.background.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
  },
  claimTypeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  claimTypeText: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  claimTypeTextSelected: {
    color: colors.white,
  },
  inputContainer: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.background.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: 16,
    color: colors.white,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  documentsContainer: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  documentsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
    marginBottom: 12,
  },
  documentsList: {
    marginBottom: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.panel,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    color: colors.white,
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
    backgroundColor: colors.background.panel,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  addDocumentText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: colors.primary,
    margin: spacing.base,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.subtle,
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
