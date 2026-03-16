import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuthIdentity, useTripActions } from '../../contexts/AuthContext';
import {
  CLAIM_WORKFLOW_LABELS,
  CLAIM_WORKFLOW_STATUS,
} from '../../services/ClaimsService';
import {
  colors,
  layout,
  spacing,
} from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';
import ClaimFlowModal from '../../components/ClaimFlowModal';
import ClaimCard from '../../components/claims/ClaimCard';
import ClaimsTabs from '../../components/claims/ClaimsTabs';
import ClaimsEmptyState from '../../components/claims/ClaimsEmptyState';
import ClaimsInsuranceInfoModal from '../../components/claims/ClaimsInsuranceInfoModal';
import AppButton from '../../components/ui/AppButton';
import styles from './CustomerClaimsScreen.styles';
import useCustomerClaimsData from './useCustomerClaimsData';
import useClaimDocuments from './useClaimDocuments';
import useClaimFlowController from './useClaimFlowController';

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
  const { currentUser } = useAuthIdentity();
  const { getUserPickupRequests } = useTripActions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [activeTab, setActiveTab] = useState('ongoing');

  const currentUserId = currentUser?.uid || currentUser?.id;
  const {
    completedClaims,
    initialLoading,
    loadClaimsData,
    ongoingClaims,
    pastTrips,
    refreshing,
    handleRefreshClaims,
  } = useCustomerClaimsData({
    currentUserId,
    getUserPickupRequests,
  });
  const {
    selectedDocuments,
    clearDocuments,
    handleAddDocument,
    removeDocument,
  } = useClaimDocuments();
  const {
    claimDescription,
    claimFlowVisible,
    claimType,
    selectedTrip,
    showInsuranceInfo,
    submitting,
    setClaimDescription,
    setClaimType,
    setShowInsuranceInfo,
    handleCloseClaimFlow,
    handleSelectTrip,
    handleStartClaim,
    handleSubmitClaim,
  } = useClaimFlowController({
    currentUser,
    loadClaimsData,
    selectedDocuments,
    clearDocuments,
  });

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

      <AppButton
        title="New Claim"
        onPress={handleStartClaim}
        leftIcon={<Ionicons name="add-circle" size={20} color={colors.white} />}
        style={[
          styles.startClaimButton,
          { bottom: insets.bottom > 0 ? insets.bottom + spacing.sm : spacing.lg },
        ]}
      />

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
