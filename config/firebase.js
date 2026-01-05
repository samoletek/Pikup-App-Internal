// config/firebase.js - Firebase Storage Configuration
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_STORAGE_BUCKET,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Storage paths constants matching Firebase rules
export const STORAGE_PATHS = {
  PROFILE_IMAGES: 'profile-images',
  PHOTOS: 'photos',
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  PICKUP_CONFIRMATION: 'pickup-confirmation',
  DELIVERY_CONFIRMATION: 'delivery-confirmation'
};

// Helper function to generate storage paths matching your Firebase rules
export const getStoragePath = {
  userProfile: (userId, fileName = 'profile.jpg') => `${STORAGE_PATHS.PROFILE_IMAGES}/${userId}/${fileName}`,
  customerPhotos: (requestId, photoId) => `${STORAGE_PATHS.PHOTOS}/${requestId}/pickup/${photoId}.jpg`,
  pickupPhotos: (requestId, photoId) => `${STORAGE_PATHS.PHOTOS}/${requestId}/${STORAGE_PATHS.PICKUP_CONFIRMATION}/${photoId}.jpg`,
  deliveryPhotos: (requestId, photoId) => `${STORAGE_PATHS.PHOTOS}/${requestId}/${STORAGE_PATHS.DELIVERY_CONFIRMATION}/${photoId}.jpg`,
};

export default app;