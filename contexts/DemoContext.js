import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

const DemoContext = createContext();

// Mock request object for demo flow
const MOCK_REQUEST = {
  id: 'demo-request-123456',
  status: 'inProgress',
  customerEmail: 'demo.user@example.com',
  pickup: {
    address: '123 Main St, Atlanta, GA',
    coordinates: { latitude: 33.7490, longitude: -84.3880 }
  },
  dropoff: {
    address: '456 Peachtree St, Atlanta, GA',
    coordinates: { latitude: 33.7590, longitude: -84.3920 }
  },
  item: {
    description: 'Large furniture - Sofa',
    needsHelp: true
  },
  driverEmail: 'driver@example.com',
  pickupCoordinates: { latitude: 33.7490, longitude: -84.3880 },
  dropoffCoordinates: { latitude: 33.7590, longitude: -84.3920 },
  pricing: {
    basePrice: 35.00,
    serviceFee: 2.99,
    tax: 3.04,
    total: 40.99
  }
};

// Mock driver location
const MOCK_DRIVER_LOCATION = {
  latitude: 33.7490,
  longitude: -84.3880
};

// Mock pickup photos
const MOCK_PICKUP_PHOTOS = [
  'https://picsum.photos/300/200?random=1',
  'https://picsum.photos/300/200?random=2',
  'https://picsum.photos/300/200?random=3'
];

// Demo flow stages and their timing (in milliseconds)
const DEMO_STAGES = {
  // Initial stages for user interaction
  SEARCH_LOCATION: { nextStage: null, delay: 0 }, // User must complete manually
  SUMMARY_DETAILS: { nextStage: null, delay: 0 }, // User must complete manually
  VEHICLE_SELECTION: { nextStage: null, delay: 0 }, // User must complete manually
  PRICE_SUMMARY: { nextStage: null, delay: 0 }, // User must complete manually
  
  // Auto-completing stages after price summary
  REQUEST_SENT: { nextStage: 'FINDING_DRIVER', delay: 3000 },
  FINDING_DRIVER: { nextStage: 'DRIVER_FOUND', delay: 5000, screen: 'DriverFoundScreen', params: { requestId: 'demo-123', requestData: MOCK_REQUEST } },
  DRIVER_FOUND: { nextStage: 'EN_ROUTE_TO_PICKUP', delay: 3000, screen: 'EnRouteToPickupScreen', params: { isCustomerView: true, request: MOCK_REQUEST } },
  EN_ROUTE_TO_PICKUP: { nextStage: 'ARRIVED_AT_PICKUP', delay: 8000 },
  ARRIVED_AT_PICKUP: { nextStage: 'EN_ROUTE_TO_DELIVERY', delay: 5000, screen: 'CustomerActivityScreen', params: { requestId: 'demo-123', status: 'driverArrivedAtPickup', request: MOCK_REQUEST, pickupPhotos: MOCK_PICKUP_PHOTOS } },
  EN_ROUTE_TO_DELIVERY: { nextStage: 'TRACKING_DELIVERY', delay: 3000, screen: 'CustomerActivityScreen', params: { requestId: 'demo-123', status: 'enRouteToDelivery', request: MOCK_REQUEST, pickupPhotos: MOCK_PICKUP_PHOTOS, driverLocation: MOCK_DRIVER_LOCATION } },
  TRACKING_DELIVERY: { nextStage: 'ARRIVED_AT_DELIVERY', delay: 8000, screen: 'EnRouteToPickupScreen', params: { isCustomerView: true, request: MOCK_REQUEST, isDelivery: true, title: "On the way to delivery" } },
  ARRIVED_AT_DELIVERY: { nextStage: null, delay: 5000, screen: 'CustomerActivityScreen', params: { requestId: 'demo-123', status: 'driverArrivedAtDelivery', request: MOCK_REQUEST, pickupPhotos: MOCK_PICKUP_PHOTOS } },
  FEEDBACK: { nextStage: null, delay: 0, screen: 'DeliveryFeedbackScreen', params: { requestId: 'demo-123', requestData: MOCK_REQUEST, returnToHome: true } },
  COMPLETE: { nextStage: null, delay: 0, screen: 'CustomerTabs' }
};

export const DemoProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [timer, setTimer] = useState(null);
  const navigationRef = useRef(null);
  const [demoData, setDemoData] = useState({
    pickup: null,
    dropoff: null,
    itemDescription: null,
    needsHelp: null,
    vehicle: null,
    price: null
  });

  // Clear any existing timers when component unmounts
  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timer]);

  // Handle stage changes and navigation
  useEffect(() => {
    if (!isDemoMode || !currentStage) return;
    
    const stageInfo = DEMO_STAGES[currentStage];
    if (!stageInfo) return;
    
    // Navigate to the appropriate screen if specified
    if (stageInfo.screen && navigationRef.current) {
      if (stageInfo.params) {
        navigationRef.current(stageInfo.screen, stageInfo.params);
      } else {
        navigationRef.current(stageInfo.screen);
      }
    }
    
    // Set up timer for next stage if there is one
    if (stageInfo.nextStage) {
      const newTimer = setTimeout(() => {
        setCurrentStage(stageInfo.nextStage);
      }, stageInfo.delay);
      
      setTimer(newTimer);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentStage, isDemoMode]);

  // Start the demo flow
  const startDemo = () => {
    setIsDemoMode(true);
    setCurrentStage('SEARCH_LOCATION');
    
    // Initialize demo data with defaults
    setDemoData({
      pickup: null,
      dropoff: null,
      itemDescription: null,
      needsHelp: null,
      vehicle: null,
      price: null
    });
  };

  // Stop the demo flow
  const stopDemo = () => {
    if (timer) clearTimeout(timer);
    setTimer(null);
    setIsDemoMode(false);
    setCurrentStage(null);
    setDemoData({
      pickup: null,
      dropoff: null,
      itemDescription: null,
      needsHelp: null,
      vehicle: null,
      price: null
    });
  };

  // Register navigation function
  const registerNavigation = (navigateFunction) => {
    navigationRef.current = navigateFunction;
  };

  // Update demo data and advance to next stage
  const updateDemoData = (data, nextStage) => {
    setDemoData(prevData => ({
      ...prevData,
      ...data
    }));
    
    if (nextStage) {
      setCurrentStage(nextStage);
    }
  };

  // Start auto-completion after manual stages
  const startAutoCompletion = () => {
    setCurrentStage('REQUEST_SENT');
  };

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        currentStage,
        demoData,
        startDemo,
        stopDemo,
        registerNavigation,
        updateDemoData,
        startAutoCompletion
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);

export default DemoContext; 