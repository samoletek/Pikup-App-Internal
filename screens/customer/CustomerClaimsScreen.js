import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '../../contexts/AuthContext';
import {
  CLAIM_WORKFLOW_LABELS,
  CLAIM_WORKFLOW_STATUS,
  fetchClaimsForUser,
  mapEligibleTripsForClaims,
  submitClaimRequest,
} from '../../services/ClaimsService';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';
import ClaimFlowModal from '../../components/ClaimFlowModal';
import ClaimCard from '../../components/claims/ClaimCard';
import ClaimsTabs from '../../components/claims/ClaimsTabs';
import ClaimsEmptyState from '../../components/claims/ClaimsEmptyState';
import ClaimsInsuranceInfoModal from '../../components/claims/ClaimsInsuranceInfoModal';

const MIN_REFRESH_SPINNER_MS = 700;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getClaimStatusColor = (workflowStatus) => {
  switch (workflowStatus) {
    case CLAIM_WORKFLOW_STATUS.FILED:
      return colors.primary;
    case CLAIM_WORKFLOW_STATUS.PROCESSING:
      return colors.warning;
    case CLAIM_WORKFLOW_STATUS.REVIEW:
      return colors.info;
    case CLAIM_WORKFLOW_STATUS.COMPLETED:
      return colors.success;
    default:
      return colors.text.tertiary;
  }
};

const getClaimResolutionText = (claim) => {
  if (claim.resolution) return claim.resolution;
  if (String(claim.status || '').toUpperCase() === 'COMPLETED') {
    return 'Claim processed successfully';
  }
  return 'Claim reviewed';
};

export default function CustomerClaimsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, getUserPickupRequests } = useAuth();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [activeTab, setActiveTab] = useState('ongoing');
  const [claimFlowVisible, setClaimFlowVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimType, setClaimType] = useState('DAMAGED_GOODS');
  const [showInsuranceInfo, setShowInsuranceInfo] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  const [ongoingClaims, setOngoingClaims] = useState([]);
  const [completedClaims, setCompletedClaims] = useState([]);
  const [pastTrips, setPastTrips] = useState([]);

  const currentUserId = currentUser?.uid || currentUser?.id;

  const loadClaimsData = useCallback(async ({ withInitialLoader = false } = {}) => {
    if (!currentUserId) {
      setOngoingClaims([]);
      setCompletedClaims([]);
      if (withInitialLoader) setInitialLoading(false);
      return;
    }

    try {
      if (withInitialLoader) setInitialLoading(true);
      const result = await fetchClaimsForUser(currentUserId);

      if (!result.success) {
        setOngoingClaims([]);
        setCompletedClaims([]);
        return;
      }

      setOngoingClaims(result.ongoingClaims);
      setCompletedClaims(result.completedClaims);
    } finally {
      if (withInitialLoader) setInitialLoading(false);
    }
  }, [currentUserId]);

  const loadPastTrips = useCallback(async () => {
    try {
      const requests = await getUserPickupRequests();
      const tripsWithInsurance = mapEligibleTripsForClaims(requests);
      setPastTrips(tripsWithInsurance);
    } catch (error) {
      console.error('Error loading past trips:', error);
      Alert.alert('Error', 'Failed to load past trips');
    }
  }, [getUserPickupRequests]);

  useEffect(() => {
    loadClaimsData({ withInitialLoader: true });
    loadPastTrips();
  }, [loadClaimsData, loadPastTrips]);

  const handleRefreshClaims = async () => {
    if (refreshing) return;

    setRefreshing(true);
    const refreshStartedAt = Date.now();

    try {
      await loadClaimsData();
    } finally {
      const elapsed = Date.now() - refreshStartedAt;
      if (elapsed < MIN_REFRESH_SPINNER_MS) {
        await wait(MIN_REFRESH_SPINNER_MS - elapsed);
      }
      setRefreshing(false);
    }
  };

  const handleStartClaim = () => {
    setSelectedTrip(null);
    setClaimDescription('');
    setClaimType('DAMAGED_GOODS');
    setSelectedDocuments([]);
    setClaimFlowVisible(true);
  };

  const handleSelectTrip = (trip) => {
    if (!trip.bookingId) {
      Alert.alert('Error', 'This delivery does not have insurance details.');
      return false;
    }

    setSelectedTrip({
      ...trip,
      // TODO(remove): legacy flag, no longer required by current ClaimFlowModal.
      setupData: { claimsEnabled: true },
    });

    return true;
  };

  const handleCloseClaimFlow = () => {
    setClaimFlowVisible(false);
    setSelectedTrip(null);
    setClaimDescription('');
    setClaimType('DAMAGED_GOODS');
    setSelectedDocuments([]);
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
        setSelectedDocuments((prev) => [...prev, document]);
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
        setSelectedDocuments((prev) => [...prev, document]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleAddDocument = async () => {
    Alert.alert('Add Document', 'Choose document type', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose File', onPress: pickDocument },
    ]);
  };

  const removeDocument = (documentId) => {
    setSelectedDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
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
      const result = await submitClaimRequest({
        selectedTrip,
        claimType,
        claimDescription,
        currentUser,
        selectedDocuments,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to submit claim. Please try again.');
        return;
      }

      setClaimDescription('');
      setClaimType('DAMAGED_GOODS');
      setSelectedDocuments([]);
      setClaimFlowVisible(false);
      setSelectedTrip(null);

      await loadClaimsData();

      Alert.alert('Claim Submitted', 'Your claim has been submitted successfully.', [{ text: 'OK' }]);
    } finally {
      setSubmitting(false);
    }
  };

  const activeClaims = useMemo(
    () => (activeTab === 'ongoing' ? ongoingClaims : completedClaims),
    [activeTab, ongoingClaims, completedClaims]
  );

  const renderClaimItem = ({ item }) => {
    const statusText = CLAIM_WORKFLOW_LABELS[item.workflowStatus] || 'Unknown';
    const statusColor = getClaimStatusColor(item.workflowStatus);

    return (
      <ClaimCard
        item={item}
        statusColor={statusColor}
        statusText={statusText}
        resolutionText={getClaimResolutionText(item)}
        showResolution={item.workflowStatus === CLAIM_WORKFLOW_STATUS.COMPLETED}
      />
    );
  };

  const headerActions = (
    <View style={styles.headerActions}>
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => setShowInsuranceInfo(true)}
        accessibilityRole="button"
        accessibilityLabel="Open Redkik insurance info"
      >
        <Ionicons name="information-circle-outline" size={22} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Claims"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
          sideSlotWidth={88}
          rightContent={headerActions}
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
        sideSlotWidth={88}
        rightContent={headerActions}
      />

      <View style={[styles.topSection, { maxWidth: contentMaxWidth }]}>
        <ClaimsTabs
          activeTab={activeTab}
          ongoingCount={ongoingClaims.length}
          completedCount={completedClaims.length}
          onTabChange={setActiveTab}
        />
      </View>

      <FlatList
        data={activeClaims}
        renderItem={renderClaimItem}
        keyExtractor={(item) => item.id}
        style={[styles.listViewport, { maxWidth: contentMaxWidth }]}
        contentContainerStyle={[
          styles.claimsList,
          activeClaims.length === 0 && styles.claimsListEmpty,
        ]}
        bounces
        alwaysBounceVertical
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefreshClaims}
          />
        }
        ListEmptyComponent={<ClaimsEmptyState activeTab={activeTab} />}
      />

      <TouchableOpacity
        style={[
          styles.startClaimButton,
          { bottom: insets.bottom > 0 ? insets.bottom + spacing.sm : spacing.lg },
        ]}
        onPress={handleStartClaim}
      >
        <Ionicons name="add-circle" size={20} color={colors.white} />
        <Text style={styles.startClaimText}>New Claim</Text>
      </TouchableOpacity>

      <ClaimsInsuranceInfoModal
        visible={showInsuranceInfo}
        onClose={() => setShowInsuranceInfo(false)}
      />

      <ClaimFlowModal
        visible={claimFlowVisible}
        onClose={handleCloseClaimFlow}
        pastTrips={pastTrips}
        selectedTrip={selectedTrip}
        onSelectTrip={handleSelectTrip}
        claimType={claimType}
        onClaimTypeChange={setClaimType}
        claimDescription={claimDescription}
        onClaimDescriptionChange={setClaimDescription}
        selectedDocuments={selectedDocuments}
        onAddDocument={handleAddDocument}
        onRemoveDocument={removeDocument}
        onSubmit={handleSubmitClaim}
        submitting={submitting}
      />
    </View>
  );
}

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
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
  claimsList: {
    paddingHorizontal: spacing.base,
    paddingBottom: 100,
  },
  claimsListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  startClaimButton: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: borderRadius.full,
  },
  startClaimText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
  },
});
