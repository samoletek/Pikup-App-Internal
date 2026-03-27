// Request Modal component: renders its UI and handles related interactions.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  StatusBar,
  TouchableOpacity,
  View,
} from 'react-native';
import { spacing } from '../styles/theme';
import styles from './RequestModal.styles';
import RequestCard from './requestModal/RequestCard';
import RequestMapSection from './requestModal/RequestMapSection';
import RequestModalHeader from './requestModal/RequestModalHeader';
import RequestCardsSection from './requestModal/RequestCardsSection';
import RequestPageIndicators from './requestModal/RequestPageIndicators';
import {
  CARD_WIDTH,
  MODAL_DISMISS_DRAG_THRESHOLD,
  SCREEN_HEIGHT,
} from './requestModal/requestModalUtils';
import useRequestModalTimers from '../hooks/useRequestModalTimers';
import useRequestModalRoute from '../hooks/useRequestModalRoute';

const EMPTY_REQUESTS = Object.freeze([]);
const dedupeRequestsById = (list = []) => {
  const seen = new Set();
  const deduped = [];

  (Array.isArray(list) ? list : []).forEach((request) => {
    const requestId = String(request?.id || '').trim();
    if (!requestId) {
      deduped.push(request);
      return;
    }

    if (seen.has(requestId)) {
      return;
    }

    seen.add(requestId);
    deduped.push(request);
  });

  return deduped;
};

export default function RequestModal({
  visible,
  mode = 'available',
  requests,
  selectedRequest,
  currentLocation,
  loading = false,
  error = null,
  onClose,
  onAccept,
  onViewDetails,
  onMessage,
  onRefresh,
}) {
  const requestList = useMemo(
    () => dedupeRequestsById(Array.isArray(requests) ? requests : EMPTY_REQUESTS),
    [requests]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMap, setShowMap] = useState(true);
  const isAcceptedMode = mode === 'accepted';
  const modalTitle = isAcceptedMode ? 'Accepted Requests' : 'Available Requests';
  const countLabel = isAcceptedMode
    ? `${requestList.length} accepted request${requestList.length !== 1 ? 's' : ''}`
    : `${requestList.length} request${requestList.length !== 1 ? 's' : ''} nearby`;

  const flatListRef = useRef(null);
  const mapRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dragTranslateY = useRef(new Animated.Value(0)).current;

  const timers = useRequestModalTimers({ visible, requests: requestList });
  const { selectedRoute, selectedRouteMarkers, resetRoute } = useRequestModalRoute({
    visible,
    showMap,
    requests: requestList,
    selectedIndex,
    mapRef,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        dragTranslateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismiss =
          gestureState.dy >= MODAL_DISMISS_DRAG_THRESHOLD || gestureState.vy > 1.2;

        if (shouldDismiss) {
          Animated.timing(dragTranslateY, {
            toValue: SCREEN_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            dragTranslateY.setValue(0);
            onClose?.();
          });
          return;
        }

        Animated.spring(dragTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      dragTranslateY.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      return;
    }

    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
    resetRoute();
  }, [dragTranslateY, resetRoute, slideAnim, visible]);

  useEffect(() => {
    if (!selectedRequest || requestList.length === 0) {
      return;
    }

    const index = requestList.findIndex((requestItem) => requestItem.id === selectedRequest.id);
    if (index === -1) {
      return;
    }

    setSelectedIndex(index);
    if (!flatListRef.current) {
      return;
    }

    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, 100);
  }, [requestList, selectedRequest]);

  useEffect(() => {
    if (selectedIndex >= requestList.length) {
      setSelectedIndex(0);
    }
  }, [requestList.length, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [mode]);

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (CARD_WIDTH + spacing.lg));
    const boundedIndex = Math.max(0, Math.min(requestList.length - 1, index));
    setSelectedIndex(boundedIndex);
  };

  const renderRequestCard = ({ item, index }) => (
    <RequestCard
      item={item}
      index={index}
      selectedIndex={selectedIndex}
      styles={styles}
      timers={timers}
      onMessage={onMessage}
      onAccept={onAccept}
      onViewDetails={onViewDetails}
    />
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.backdropOverlay} />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: Animated.add(slideAnim, dragTranslateY) }],
          },
        ]}
      >
        <RequestModalHeader
          title={modalTitle}
          countLabel={countLabel}
          requestsCount={requestList.length}
          onClose={onClose}
          panHandlers={panResponder.panHandlers}
          styles={styles}
        />

        <RequestMapSection
          showMap={showMap}
          onShowMap={() => setShowMap(true)}
          onHideMap={() => setShowMap(false)}
          currentLocation={currentLocation}
          requests={requestList}
          selectedIndex={selectedIndex}
          onSelectRequestIndex={setSelectedIndex}
          flatListRef={flatListRef}
          mapRef={mapRef}
          selectedRoute={selectedRoute}
          selectedRouteMarkers={selectedRouteMarkers}
          styles={styles}
        />

        <RequestCardsSection
          loading={loading}
          error={error}
          mode={mode}
          requests={requestList}
          onRefresh={onRefresh}
          flatListRef={flatListRef}
          renderRequestCard={renderRequestCard}
          onScroll={handleScroll}
          styles={styles}
        />

        <RequestPageIndicators
          requests={requestList}
          selectedIndex={selectedIndex}
          styles={styles}
        />
      </Animated.View>
    </Modal>
  );
}
