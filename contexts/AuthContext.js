// contexts/AuthContext.js - Updated with Driver Earnings and Payment Integration
import React, { createContext, useState, useContext } from 'react';
import { Platform } from 'react-native';
import { storage, getStoragePath } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  
  // Payment service configuration - Updated for Android emulator
  // Always use Render server for all environments
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';

  // Authenticated fetch helper
  const authFetch = async (url, opts = {}) => {
    // If you later wire up Firebase Auth SDK, you can try getIdToken(false) here.
    // For now, safely fall back to the token you already store on currentUser.
    const token = currentUser?.accessToken;
    if (!token) throw new Error('Not authenticated');

    return fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  };

  // Helper function to convert JavaScript object to Firestore format
  const toFirestoreFormat = (obj) => {
    const fields = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          fields[key] = { integerValue: value.toString() };
        } else {
          fields[key] = { doubleValue: value };
        }
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        fields[key] = { timestampValue: value.toISOString() };
      } else if (Array.isArray(value)) {
        // Handle empty arrays
        if (value.length === 0) {
          fields[key] = { arrayValue: { values: [] } };
        } else {
          // Process non-empty arrays
          const arrayValues = [];
          
          for (const item of value) {
            if (item === null || item === undefined) {
              arrayValues.push({ nullValue: null });
            } else if (typeof item === 'string') {
              arrayValues.push({ stringValue: item });
            } else if (typeof item === 'number') {
              if (Number.isInteger(item)) {
                arrayValues.push({ integerValue: item.toString() });
              } else {
                arrayValues.push({ doubleValue: item });
              }
            } else if (typeof item === 'boolean') {
              arrayValues.push({ booleanValue: item });
            } else if (typeof item === 'object') {
              // Safely handle nested objects in arrays
              try {
                const nestedObj = { fields: {} };
                Object.keys(item).forEach(nestedKey => {
                  const nestedValue = item[nestedKey];
                  if (typeof nestedValue === 'string') {
                    nestedObj.fields[nestedKey] = { stringValue: nestedValue };
                  } else if (typeof nestedValue === 'number') {
                    if (Number.isInteger(nestedValue)) {
                      nestedObj.fields[nestedKey] = { integerValue: nestedValue.toString() };
                    } else {
                      nestedObj.fields[nestedKey] = { doubleValue: nestedValue };
                    }
                  } else if (typeof nestedValue === 'boolean') {
                    nestedObj.fields[nestedKey] = { booleanValue: nestedValue };
                  } else {
                    // For complex nested objects, convert to string
                    nestedObj.fields[nestedKey] = { stringValue: String(nestedValue) };
                  }
                });
                arrayValues.push({ mapValue: nestedObj });
              } catch (err) {
                // Fallback to string representation
                arrayValues.push({ stringValue: String(item) });
              }
            } else {
              arrayValues.push({ stringValue: String(item) });
            }
          }
          
          fields[key] = { arrayValue: { values: arrayValues } };
        }
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects more carefully
        try {
          const nestedFields = {};
          Object.keys(value).forEach(nestedKey => {
            const nestedValue = value[nestedKey];
            if (nestedValue === null || nestedValue === undefined) {
              nestedFields[nestedKey] = { nullValue: null };
            } else if (typeof nestedValue === 'string') {
              nestedFields[nestedKey] = { stringValue: nestedValue };
            } else if (typeof nestedValue === 'number') {
              if (Number.isInteger(nestedValue)) {
                nestedFields[nestedKey] = { integerValue: nestedValue.toString() };
              } else {
                nestedFields[nestedKey] = { doubleValue: nestedValue };
              }
            } else if (typeof nestedValue === 'boolean') {
              nestedFields[nestedKey] = { booleanValue: nestedValue };
            } else if (Array.isArray(nestedValue)) {
              // Convert arrays to strings to avoid deep nesting issues
              nestedFields[nestedKey] = { stringValue: JSON.stringify(nestedValue) };
            } else if (typeof nestedValue === 'object') {
              // Convert objects to strings to avoid deep nesting issues
              nestedFields[nestedKey] = { stringValue: JSON.stringify(nestedValue) };
            } else {
              nestedFields[nestedKey] = { stringValue: String(nestedValue) };
            }
          });
          
          fields[key] = { mapValue: { fields: nestedFields } };
        } catch (err) {
          // Fallback to string representation
          fields[key] = { stringValue: JSON.stringify(value) };
        }
      } else {
        fields[key] = { stringValue: String(value) };
      }
    });
    
    return { fields };
  };

  // Helper function to convert from Firestore format to JavaScript
  const fromFirestoreFormat = (doc) => {
    if (!doc) return {};
    
    const fields = doc.fields || doc;
    const result = {};
    
    Object.keys(fields).forEach(key => {
      const field = fields[key];
      
      if (field.nullValue !== undefined) {
        result[key] = null;
      } else if (field.stringValue !== undefined) {
        // Check if it's a JSON string that needs parsing (for coordinates)
        if (field.stringValue.startsWith('{') || field.stringValue.startsWith('[')) {
          try {
            result[key] = JSON.parse(field.stringValue);
          } catch {
            result[key] = field.stringValue;
          }
        } else {
          result[key] = field.stringValue;
        }
      } else if (field.integerValue !== undefined) {
        result[key] = parseInt(field.integerValue);
      } else if (field.doubleValue !== undefined) {
        result[key] = field.doubleValue;
      } else if (field.booleanValue !== undefined) {
        result[key] = field.booleanValue;
      } else if (field.timestampValue !== undefined) {
        result[key] = field.timestampValue;
      } else if (field.mapValue !== undefined) {
        // Recursively parse nested maps
        result[key] = fromFirestoreFormat(field.mapValue);
      } else if (field.arrayValue !== undefined) {
        result[key] = (field.arrayValue.values || []).map(item => {
          if (item.mapValue) {
            return fromFirestoreFormat(item.mapValue);
          } else if (item.stringValue !== undefined) {
            // Check for JSON strings in arrays too
            if (item.stringValue.startsWith('{') || item.stringValue.startsWith('[')) {
              try {
                return JSON.parse(item.stringValue);
              } catch {
                return item.stringValue;
              }
            }
            return item.stringValue;
          } else if (item.integerValue !== undefined) {
            return parseInt(item.integerValue);
          } else if (item.doubleValue !== undefined) {
            return item.doubleValue;
          } else if (item.booleanValue !== undefined) {
            return item.booleanValue;
          } else {
            return item;
          }
        });
      }
    });
    
    return result;
  };

  // ===========================================
  // FIREBASE STORAGE FUNCTIONS
  // ===========================================

  // Compress and optimize image for upload
  const compressImage = async (uri) => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024, height: 1024 } }],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      return manipulatedImage.uri;
    } catch (error) {
      console.warn('Image compression failed, using original:', error);
      return uri;
    }
  };

  // Convert URI to blob for Firebase upload
  const uriToBlob = async (uri) => {
    const response = await fetch(uri);
    return await response.blob();
  };

  // Upload single photo to Firebase Storage
  const uploadPhotoToStorage = async (uri, storagePath, onProgress = null) => {
    try {
      console.log('Starting upload to:', storagePath);
      
      // Compress image before upload
      const compressedUri = await compressImage(uri);
      
      // Convert to blob
      const blob = await uriToBlob(compressedUri);
      
      // Create storage reference
      const storageRef = ref(storage, storagePath);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Upload successful:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  // Upload multiple photos to Firebase Storage
  const uploadMultiplePhotos = async (photos, basePath, onProgress = null) => {
    try {
      const uploadPromises = photos.map(async (photo, index) => {
        const photoId = photo.id || `photo_${Date.now()}_${index}`;
        const fullPath = `${basePath}/${photoId}.jpg`;
        
        const downloadURL = await uploadPhotoToStorage(photo.uri, fullPath, onProgress);
        
        return {
          id: photoId,
          url: downloadURL,
          originalPhoto: photo,
          storagePath: fullPath,
          timestamp: new Date().toISOString()
        };
      });

      const results = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${results.length} photos`);
      return results;
      
    } catch (error) {
      console.error('Multiple upload failed:', error);
      throw new Error(`Multiple upload failed: ${error.message}`);
    }
  };

  // Delete photo from Firebase Storage
  const deletePhotoFromStorage = async (storagePath) => {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      console.log('Photo deleted successfully:', storagePath);
    } catch (error) {
      if (error.code === 'storage/object-not-found') {
        console.warn('Photo not found for deletion:', storagePath);
      } else {
        console.error('Delete failed:', error);
        throw error;
      }
    }
  };

  // Get download URL for a storage path
  const getPhotoURL = async (storagePath) => {
    try {
      const storageRef = ref(storage, storagePath);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Failed to get photo URL:', error);
      throw error;
    }
  };

  // Calculate driver earnings (80% of total, with minimum $5 per trip)
  const calculateDriverEarnings = (totalAmount) => {
    const driverPercentage = 0.70; // Driver gets 70% (updated to match server)
    const minimumEarnings = 5.00; // Minimum $5 per trip
    const calculatedEarnings = totalAmount * driverPercentage;
    return Math.max(calculatedEarnings, minimumEarnings);
  };

  // Get driver's completed trips
  const getDriverTrips = async (driverId) => {
    if (!driverId) {
      console.error('Driver ID is required');
      return [];
    }

    try {
      console.log('Fetching trips for driver:', driverId);
      
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests?key=${API_KEY}`, {
        headers: {
          'Authorization': `Bearer ${currentUser?.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trips: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.documents) {
        return [];
      }

      // Filter for this driver's completed trips
      const driverTrips = data.documents
        .filter(doc => {
          const fields = fromFirestoreFormat(doc);
          return fields.assignedDriverId === driverId && fields.status === 'completed';
        })
        .map(doc => {
          const id = doc.name.split('/').pop();
          const fields = fromFirestoreFormat(doc);
          
          // Calculate driver earnings if not already stored
          if (!fields.driverEarnings && fields.pricing?.total) {
            fields.driverEarnings = calculateDriverEarnings(fields.pricing.total);
          }
          
          return { id, ...fields };
        })
        .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

      console.log(`Found ${driverTrips.length} completed trips for driver`);
      return driverTrips;
      
    } catch (error) {
      console.error('Error getting driver trips:', error);
      return [];
    }
  };

  // Get driver statistics
  const getDriverStats = async (driverId) => {
    try {
      console.log('Getting driver stats for:', driverId);
      
      // Get all completed trips for this driver
      const trips = await getDriverTrips(driverId);
      
      // Calculate current week (Monday to Sunday)
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() + mondayOffset);
      mondayDate.setHours(0, 0, 0, 0);

      // Filter this week's trips
      const thisWeekTrips = trips.filter(trip => {
        const tripDate = new Date(trip.completedAt || trip.createdAt);
        return tripDate >= mondayDate;
      });

      // Calculate totals
      const currentWeekTrips = thisWeekTrips.length;
      const weeklyEarnings = thisWeekTrips.reduce((sum, trip) => {
        return sum + (trip.driverEarnings || calculateDriverEarnings(trip.pricing?.total || 0));
      }, 0);

      const totalTrips = trips.length;
      const totalEarnings = trips.reduce((sum, trip) => {
        return sum + (trip.driverEarnings || calculateDriverEarnings(trip.pricing?.total || 0));
      }, 0);

      // Get driver profile data for additional stats
      let driverProfile = {};
      try {
        const profileResponse = await fetch(`${FIRESTORE_BASE_URL}/drivers/${driverId}`, {
          headers: {
            'Authorization': `Bearer ${currentUser.accessToken}`
          }
        });
        
        if (profileResponse.ok) {
          const profileDoc = await profileResponse.json();
          driverProfile = fromFirestoreFormat(profileDoc);
        }
      } catch (profileError) {
        console.log('No driver profile found, using defaults');
      }

      const stats = {
        currentWeekTrips,
        weeklyEarnings,
        totalTrips,
        totalEarnings,
        availableBalance: driverProfile.availableBalance || totalEarnings, // All earnings available by default
        rating: driverProfile.rating || 4.9,
        acceptanceRate: driverProfile.acceptanceRate || 98,
        lastTripCompletedAt: trips.length > 0 ? trips[0].completedAt : null
      };

      console.log('Driver stats calculated:', stats);
      return stats;
      
    } catch (error) {
      console.error('Error getting driver stats:', error);
      return {
        currentWeekTrips: 0,
        weeklyEarnings: 0,
        totalTrips: 0,
        totalEarnings: 0,
        availableBalance: 0,
        rating: 4.9,
        acceptanceRate: 98,
        lastTripCompletedAt: null
      };
    }
  };

  // Update driver earnings and profile when trip is completed
  const updateDriverEarnings = async (driverId, tripData) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Updating driver earnings for:', driverId);
      
      // Calculate earnings for this trip
      const tripEarnings = tripData.driverEarnings || calculateDriverEarnings(tripData.pricing?.total || 0);
      
      // Get current driver profile
      let currentProfile = {};
      try {
        const profileResponse = await fetch(`${FIRESTORE_BASE_URL}/drivers/${driverId}`, {
          headers: {
            'Authorization': `Bearer ${currentUser.accessToken}`
          }
        });
        
        if (profileResponse.ok) {
          const profileDoc = await profileResponse.json();
          currentProfile = fromFirestoreFormat(profileDoc);
        }
      } catch (error) {
        console.log('Creating new driver profile');
      }

      // Update driver profile with new earnings
      const updatedProfile = {
        ...currentProfile,
        totalTrips: (currentProfile.totalTrips || 0) + 1,
        totalEarnings: (currentProfile.totalEarnings || 0) + tripEarnings,
        availableBalance: (currentProfile.availableBalance || 0) + tripEarnings,
        lastTripCompletedAt: new Date().toISOString(),
        lastTripEarnings: tripEarnings,
        // Update acceptance rate if we track declined requests
        acceptanceRate: currentProfile.acceptanceRate || 98,
        rating: currentProfile.rating || 4.9
      };

      const updateData = toFirestoreFormat(updatedProfile);

      const response = await fetch(`${FIRESTORE_BASE_URL}/drivers/${driverId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.accessToken}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error(`Failed to update driver earnings: ${response.statusText}`);
      }

      console.log('Driver earnings updated successfully');
      return updatedProfile;
      
    } catch (error) {
      console.error('Error updating driver earnings:', error);
      throw error;
    }
  };

  // DRIVER PAYMENT FUNCTIONS
  const getDriverProfile = async (driverId) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      // Check drivers collection first (where earnings and Stripe data is stored)
      const driversResponse = await fetch(`${FIRESTORE_BASE_URL}/drivers/${driverId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (driversResponse.ok) {
        const driverDoc = await driversResponse.json();
        if (driverDoc && driverDoc.fields) {
          return fromFirestoreFormat(driverDoc);
        }
      }

      // Fallback to users collection
      const response = await fetch(`${FIRESTORE_BASE_URL}/users/${driverId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch driver profile: ${response.statusText}`);
      }

      const doc = await response.json();
      if (doc && doc.fields) {
        const userData = fromFirestoreFormat(doc);
        return userData.driverProfile || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting driver profile:', error);
      return null;
    }
  };

  const createDriverConnectAccount = async (driverInfo) => {
    try {
      console.log('Creating Stripe Connect account with URL:', PAYMENT_SERVICE_URL);
      console.log('Driver info:', driverInfo);
      const response = await fetch(`${PAYMENT_SERVICE_URL}/create-driver-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any auth headers you need
        },
        body: JSON.stringify({
          driverId: currentUser.uid,
          email: currentUser.email,
          ...driverInfo,
        }),
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `Payment service error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If response is not JSON, use status text
          if (response.statusText) {
            errorMessage = `${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.success) {
        // Update driver profile with Connect account ID (same pattern as updateDriverEarnings)
        try {
          const profileResponse = await fetch(`${FIRESTORE_BASE_URL}/drivers/${currentUser.uid}`, {
            headers: { 'Authorization': `Bearer ${currentUser.accessToken}` }
          });

          let currentProfile = {};
          if (profileResponse.ok) {
            const profileDoc = await profileResponse.json();
            if (profileDoc.fields) {
              currentProfile = fromFirestoreFormat(profileDoc);
            }
          }

          const updatedProfile = {
            ...currentProfile,
            connectAccountId: result.connectAccountId,
            stripeOnboardingStatus: 'pending',
            canReceivePayments: false,
            updatedAt: new Date().toISOString()
          };

          const updateData = toFirestoreFormat(updatedProfile);

          const response = await fetch(`${FIRESTORE_BASE_URL}/drivers/${currentUser.uid}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentUser.accessToken}`
            },
            body: JSON.stringify(updateData)
          });

          if (!response.ok) {
            throw new Error(`Failed to update driver profile: ${response.statusText}`);
          }
        } catch (updateError) {
          console.error('Failed to save Connect account to drivers collection:', updateError);
          throw updateError;
        }
        
        return { success: true, connectAccountId: result.connectAccountId };
      } else {
        throw new Error(result.error || 'Failed to create Connect account');
      }
    } catch (error) {
      console.error('Error creating driver Connect account:', error);
      return { success: false, error: error.message };
    }
  };

  const getDriverOnboardingLink = async (connectAccountId, refreshUrl, returnUrl) => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/onboard-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectAccountId,
          refreshUrl,
          returnUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting onboarding link:', error);
      return { success: false, error: error.message };
    }
  };

  const updateDriverPaymentProfile = async (driverId, updates) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      // Convert updates to Firestore format with driverProfile prefix
      const firestoreUpdates = {};
      Object.keys(updates).forEach(key => {
        firestoreUpdates[`driverProfile.${key}`] = updates[key];
      });
      firestoreUpdates['updatedAt'] = new Date().toISOString();

      const fieldPaths = Object.keys(firestoreUpdates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(firestoreUpdates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/users/${driverId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update driver payment profile: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating driver payment profile:', error);
      return { success: false, error: error.message };
    }
  };

  const checkDriverOnboardingStatus = async (connectAccountId) => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/driver-status/${connectAccountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking driver onboarding status:', error);
      return { success: false, error: error.message };
    }
  };

  const getDriverEarningsHistory = async (driverId, period = 'week') => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/driver-earnings/${driverId}?period=${period}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting driver earnings history:', error);
      return { success: false, error: error.message };
    }
  };

  const getDriverPayouts = async (driverId) => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/driver-payouts/${driverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting driver payouts:', error);
      return { success: false, error: error.message };
    }
  };

  const requestInstantPayout = async (amount) => {
    try {
      const driverProfile = await getDriverProfile(currentUser.uid);
      
      if (!driverProfile?.connectAccountId) {
        throw new Error('Driver payment account not set up');
      }
      
      const response = await fetch(`${PAYMENT_SERVICE_URL}/instant-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectAccountId: driverProfile.connectAccountId,
          amount,
          driverId: currentUser.uid,
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error requesting instant payout:', error);
      return { success: false, error: error.message };
    }
  };

  const processTripPayout = async (payoutData) => {
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/process-trip-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payoutData),
      });

      if (!response.ok) {
        throw new Error(`Payment service error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error processing trip payout:', error);
      return { success: false, error: error.message };
    }
  };

  // Enhanced trip completion with payment processing
  const completeTripWithPayment = async (tripId, completionData) => {
    try {
      // Update trip status in Firebase
      await updateRequestStatus(tripId, 'completed', {
        completedAt: new Date().toISOString(),
        ...completionData,
      });

      // Trigger driver payout through payment service
      const trip = await getRequestById(tripId);
      if (trip && trip.assignedDriverId) {
        const driverProfile = await getDriverProfile(trip.assignedDriverId);
        
        if (driverProfile?.connectAccountId && driverProfile?.canReceivePayments) {
          const driverEarnings = calculateDriverEarnings(trip.pricing?.total || 0);
          
          const payoutResult = await processTripPayout({
            tripId,
            driverId: trip.assignedDriverId,
            connectAccountId: driverProfile.connectAccountId,
            amount: driverEarnings,
            customerPaymentIntentId: trip.payment?.paymentIntentId,
          });

          if (payoutResult.success) {
            // Update driver earnings in Firebase
            await updateDriverEarnings(trip.assignedDriverId, {
              ...trip,
              driverEarnings,
            });
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error completing trip with payment:', error);
      return { success: false, error: error.message };
    }
  };

  async function signup(email, password, type, additionalData = {}) {
    setLoading(true);
    
    try {
      // Create user with Firebase Auth REST API
      const signupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      });
      
      const signupData = await signupResponse.json();
      
      if (signupData.error) {
        throw new Error(signupData.error.message);
      }
      
      console.log('Firebase REST signup successful');
      
      // Prepare user data without terms (will be added via acceptTerms)
      const userData = {
        email: email,
        userType: type,
        createdAt: new Date().toISOString(),
        // DO NOT set termsAgreement here - will be set by acceptTerms()
        ...additionalData
      };

      // If it's a driver, initialize driver-specific payment fields
      if (type === 'driver') {
        userData.driverProfile = {
          onboardingStarted: false,
          onboardingComplete: false,
          connectAccountId: null,
          documentsVerified: false,
          canReceivePayments: false,
          vehicleVerified: false,
          backgroundCheckComplete: false,
          totalEarnings: 0,
          availableBalance: 0,
          completedTrips: 0,
          rating: 5.0,
          ratingCount: 0,
          status: 'pending_onboarding', // pending_onboarding, active, suspended
          payoutSchedule: 'weekly', // daily, weekly, instant
          lastPayoutDate: null,
          bankAccountVerified: false,
        };
      }

      // If it's a customer, initialize customer rating fields
      if (type === 'customer') {
        userData.customerProfile = {
          rating: 5.0,
          ratingCount: 0,
          completedOrders: 0,
        };
      }

      const firestoreData = toFirestoreFormat(userData);
      
      // Save user data to Firestore using REST API
      await fetch(`${FIRESTORE_BASE_URL}/users/${signupData.localId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signupData.idToken}`
        },
        body: JSON.stringify(firestoreData)
      });
      
      console.log('User data saved to Firestore');
      
      const mockUser = {
        uid: signupData.localId,
        email: email,
        accessToken: signupData.idToken
      };
      
      setCurrentUser(mockUser);
      setUserType(type);
      
      // Accept current terms with proper versions and server timestamp
      try {
        await acceptTerms(mockUser.uid, true, signupData.idToken); // Pass token to avoid race condition
        console.log('Terms accepted with current versions during signup');
      } catch (termsError) {
        console.error('Failed to accept terms during signup:', termsError);
        // Don't fail the signup, but log the error
      }
      
      return { user: mockUser };
      
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setLoading(true);
    
    try {
      // Use Firebase Auth REST API
      const loginResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (loginData.error) {
        throw new Error(loginData.error.message);
      }
      
      console.log('Firebase REST login successful');
      
      const mockUser = {
        uid: loginData.localId,
        email: email,
        accessToken: loginData.idToken
      };
      
      setCurrentUser(mockUser);
      setUserType('customer'); // You can fetch this from Firestore if needed
      
      // Check if user needs to accept terms after login
      try {
        const consentStatus = await checkTermsAcceptance(mockUser.uid);
        return { 
          user: mockUser, 
          needsConsent: consentStatus.needsAcceptance,
          missingVersions: consentStatus.missingVersions 
        };
      } catch (consentError) {
        console.error('Error checking consent status:', consentError);
        // Don't fail login if consent check fails, but indicate consent needed
        return { 
          user: mockUser, 
          needsConsent: true,
          missingVersions: ['tosVersion', 'privacyVersion'] 
        };
      }
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setCurrentUser(null);
    setUserType(null);
    console.log('Logged out');
  }

  // Create pickup request function
  async function createPickupRequest(requestData) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const docId = `pickup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate expiry time (4 minutes from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 4 * 60 * 1000).toISOString();

      // Get customer name for the request
      let customerName = 'Customer';
      try {
        const customerProfile = await getUserProfile();
        customerName = customerProfile?.name || 
          [customerProfile?.firstName, customerProfile?.lastName].filter(Boolean).join(' ') || 
          (currentUser.email ? currentUser.email.split('@')[0] : 'Customer');
      } catch (error) {
        console.log('Could not fetch customer name, using fallback');
      }

      const firestoreData = toFirestoreFormat({
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        customerName: customerName,
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt,
        extendedTimes: 0,
        resetCount: 0,
        viewingDriverId: null,
        viewedAt: null,
        ...requestData,
        
        // NEW: Insurance data (backward compatible)
        ...(requestData.insurance && typeof requestData.insurance === 'object' ? {
          insurance: requestData.insurance,
          itemValue: Math.max(0, Number(requestData.itemValue) || 0)
        } : {})
      });

      console.log('Creating pickup request:', docId);
      
      // Log insurance data if present
      if (requestData.insurance && typeof requestData.insurance === 'object') {
        console.log('✅ Insurance data included:', {
          premium: requestData.insurance.premium,
          itemValue: requestData.itemValue,
          included: true
        });
      } else {
        console.log('ℹ️ No insurance data (backward compatible)');
      }
      
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${docId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.accessToken}`
        },
        body: JSON.stringify(firestoreData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Firestore error:', errorData);
        throw new Error(`Failed to create pickup request: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Pickup request created successfully:', result);
      
      return {
        id: docId,
        ...requestData,
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        status: 'pending',
        createdAt: new Date().toISOString(),
        
        // Include insurance data in response if present
        ...(requestData.insurance && typeof requestData.insurance === 'object' ? {
          insurance: requestData.insurance,
          itemValue: Math.max(0, Number(requestData.itemValue) || 0)
        } : {})
      };
      
    } catch (error) {
      console.error('Error creating pickup request:', error);
      throw error;
    }
  }

  // Get user's pickup requests
  async function getUserPickupRequests() {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pickup requests: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.documents) {
        return [];
      }

      const userRequests = data.documents
        .filter(doc => {
          const fields = fromFirestoreFormat(doc);
          return fields.customerId === currentUser.uid;
        })
        .map(doc => {
          const id = doc.name.split('/').pop();
          const fields = fromFirestoreFormat(doc);
          return { id, ...fields };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return userRequests;
      
    } catch (error) {
      console.error('Error fetching pickup requests:', error);
      throw error;
    }
  }

  // Get available pickup requests for drivers
  async function getAvailableRequests() {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      // Check if current driver is online first
      const driverResponse = await fetch(
        `${FIRESTORE_BASE_URL}/users/${currentUser.uid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          }
        }
      );

      if (driverResponse.ok) {
        const driverDoc = await driverResponse.json();
        const driverData = fromFirestoreFormat(driverDoc);
        
        // Return empty array if driver is offline
        if (!driverData?.driverStatus?.isOnline) {
          console.log('Driver is offline, returning no requests');
          return [];
        }
      }
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch requests: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.documents) return [];

      // Filter for pending requests only and convert to format your UI expects
      const availableRequests = data.documents
        .filter(doc => {
          const fields = fromFirestoreFormat(doc);
          return fields.status === 'pending';
        })
        .map(doc => {
          const id = doc.name.split('/').pop();
          const fields = fromFirestoreFormat(doc);
          
          // Transform to format your IncomingRequestModal expects
          return {
            id,
            price: `$${fields.pricing?.total || '40.00'}`,
            type: 'Furniture', // You can derive this from item description
            vehicle: {
              type: fields.vehicle?.type || null
            },
            pickup: {
              address: fields.pickup?.address || 'Unknown pickup',
              coordinates: fields.pickup?.coordinates || null
            },
            dropoff: {
              address: fields.dropoff?.address || 'Unknown dropoff',
              coordinates: fields.dropoff?.coordinates || null
            },
            item: {
              description: fields.item?.description || 'No description',
              needsHelp: fields.item?.needsHelp || false,
              type: fields.item?.type || 'Package'
            },
            customer: {
              name: fields.customerEmail?.split('@')[0] || 'Customer', // Extract name from email
              rating: 5.0, // Default rating for now
              photo: require('../assets/profile.png') // Default photo
            },
            photos: fields.customerPhotos || [], // Customer photos from Firebase Storage
            // Keep original fields for other operations
            originalData: fields
          };
        })
        .sort((a, b) => new Date(b.originalData.createdAt) - new Date(a.originalData.createdAt));

      return availableRequests;
    } catch (error) {
      console.error('Error fetching available requests:', error);
      throw error;
    }
  }

  // Accept a pickup request (for drivers)
  async function acceptRequest(requestId) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updates = {
        status: 'accepted',
        driverId: currentUser.uid,
        assignedDriverId: currentUser.uid, // Also store as assignedDriverId for easier querying
        driverEmail: currentUser.email,
        acceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const fieldPaths = Object.keys(updates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to accept request: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Request accepted successfully:', result);
      
      // Create conversation for this request
      try {
        // First fetch the request details to get customerId
        const requestResponse = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${currentUser.accessToken}`
          }
        });
        
        if (requestResponse.ok) {
          const requestData = await requestResponse.json();
          const request = fromFirestoreFormat(requestData.fields);
          
          if (request.customerId) {
            // Safely derive names without cross-reads
            let customerName = 
              request.customerName ||
              (request.customerEmail ? request.customerEmail.split('@')[0] : 'Customer');

            let driverName = 'Driver';
            try {
              // Current user is the driver - allowed to read own profile
              const driverProfile = await getUserProfile();
              driverName = 
                driverProfile?.name ||
                [driverProfile?.firstName, driverProfile?.lastName].filter(Boolean).join(' ') ||
                (currentUser?.email ? currentUser.email.split('@')[0] : 'Driver');
            } catch (error) {
              console.log('Could not fetch driver name, using default');
            }

            // Fetch driver rating from /drivers/{currentUser.uid}
            let driverRating = 5.0;
            try {
              const statsRes = await fetch(`${FIRESTORE_BASE_URL}/drivers/${currentUser.uid}`, {
                headers: { 'Authorization': `Bearer ${currentUser.accessToken}` }
              });
              if (statsRes.ok) {
                const statsDoc = await statsRes.json();
                const stats = fromFirestoreFormat(statsDoc);
                if (typeof stats.rating === 'number') driverRating = stats.rating;
              }
            } catch (error) {
              console.log('Could not fetch driver rating, using default');
            }

            // Update pickup request with display fields
            const nameUpdates = {
              customerName,
              assignedDriverName: driverName,
              assignedDriverRating: driverRating
            };
            
            const nameFieldPaths = Object.keys(nameUpdates);
            const nameUpdateMaskParams = nameFieldPaths.map(path => `updateMask.fieldPaths=${encodeURIComponent(path)}`).join('&');

            await fetch(
              `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${nameUpdateMaskParams}`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentUser.accessToken}`
                },
                body: JSON.stringify(toFirestoreFormat(nameUpdates))
              }
            );

            // Create conversation with names
            await createConversation(requestId, request.customerId, currentUser.uid, customerName, driverName);
            console.log('Conversation created for request with names:', requestId);
          }
        }
      } catch (convError) {
        console.error('Error creating conversation:', convError);
        // Don't fail the accept if conversation creation fails
      }
      
      return result;
    } catch (error) {
      console.error('Error accepting request:', error);
      throw error;
    }
  }

  // Update request status (for status changes like 'inProgress', 'completed')
  async function updateRequestStatus(requestId, newStatus, additionalData = {}) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updates = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...additionalData
      };

      const fieldPaths = Object.keys(updates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update request: ${response.statusText}`);
      }

      const result = await response.json();

      // If this is a customer feedback with rating, update driver's profile rating
      if (newStatus === 'completed' && additionalData.customerRating) {
        try {
          // Get request data to find the driver ID
          const requestData = await getRequestById(requestId);
          if (requestData.assignedDriverId) {
            await updateUserRating(requestData.assignedDriverId, additionalData.customerRating, 'driverProfile');
          }
        } catch (ratingError) {
          console.error('Error updating driver rating:', ratingError);
          // Don't throw - rating update failure shouldn't fail the main request update
        }
      }

      return result;
    } catch (error) {
      console.error('Error updating request status:', error);
      throw error;
    }
  }

  // Update driver location in real-time for active requests
  async function updateDriverLocation(requestId, location) {
    if (!currentUser?.accessToken || !requestId || !location) {
      return; // Silently fail if no active request
    }

    try {
      const updates = {
        driverLocation: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        lastLocationUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const fieldPaths = [
        'driverLocation.latitude',
        'driverLocation.longitude', 
        'lastLocationUpdate',
        'updatedAt'
      ];

      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      const updateData = toFirestoreFormat(updates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        console.warn(`Failed to update driver location: ${response.statusText}`);
        return;
      }

      console.log('Driver location updated successfully');
    } catch (error) {
      console.warn('Error updating driver location:', error);
      // Don't throw error to avoid breaking location tracking
    }
  }

  // Update user profile
  async function updateUserProfile(updates) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const fieldPaths = Object.keys(updatesWithTimestamp);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updatesWithTimestamp);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/users/${currentUser.uid}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Update driver status and location
  async function updateDriverStatus(requestId, status, location = null, additionalData = {}) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updates = {
        status,
        [`${status}At`]: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...additionalData
      };
      
      if (location) {
        updates.driverLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString()
        };
      }

      const fieldPaths = [];
      Object.keys(updates).forEach(key => {
        if (key === 'driverLocation' && location) {
          fieldPaths.push('driverLocation.latitude');
          fieldPaths.push('driverLocation.longitude');
          fieldPaths.push('driverLocation.timestamp');
        } else {
          fieldPaths.push(key);
        }
      });

      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      const updateData = toFirestoreFormat(updates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update driver status: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Driver status updated to ${status}:`, result);
      return result;
    } catch (error) {
      console.error('Error updating driver status:', error);
      throw error;
    }
  }

  // Upload pickup/dropoff photos to Firebase Storage
  async function uploadRequestPhotos(requestId, photos, photoType = 'pickup') {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    if (!photos || photos.length === 0) {
      console.log('No photos to upload');
      return null;
    }

    try {
      console.log(`Uploading ${photos.length} ${photoType} photos for request ${requestId}`);
      
      // Define storage path based on photo type to match Firebase rules
      let basePath;
      switch (photoType) {
        case 'customer':
          // Customer photos during order creation go to pickup folder initially
          basePath = `photos/${requestId}/pickup`;
          break;
        case 'pickup':
          // Driver pickup confirmation photos
          basePath = `photos/${requestId}/pickup-confirmation`;
          break;
        case 'dropoff':
        case 'delivery':
          // Driver delivery confirmation photos
          basePath = `photos/${requestId}/delivery-confirmation`;
          break;
        default:
          basePath = `photos/${requestId}/${photoType}`;
      }

      // Upload all photos to Firebase Storage
      const uploadedPhotos = await uploadMultiplePhotos(photos, basePath);

      // Prepare data for Firestore - store download URLs and metadata
      const photoData = uploadedPhotos.map(uploaded => ({
        id: uploaded.id,
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        type: photoType,
        timestamp: uploaded.timestamp,
        uploadedBy: currentUser.uid
      }));

      // Normalize photoType to match DeliveryTrackingScreen expectations
      const normalizedType = photoType === 'delivery' ? 'dropoff' : photoType;
      
      const updates = {
        [`${normalizedType}Photos`]: photoData,
        [`${normalizedType}PhotosUploadedAt`]: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const fieldPaths = Object.keys(updates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updates);

      // Update Firestore with photo metadata
      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update photos in database: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`${photoType} photos uploaded successfully to Firebase Storage and database`);
      return {
        firestoreResult: result,
        uploadedPhotos: uploadedPhotos,
        photoData: photoData
      };
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error;
    }
  }

  // Get specific request details (for drivers and customers)
  async function getRequestById(requestId) {
    if (!currentUser?.accessToken) {
      console.error('getRequestById: User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
      console.log(`Fetching request with ID: ${requestId}`);
      
      // Validate requestId
      if (!requestId) {
        console.error('getRequestById: Invalid request ID');
        throw new Error('Invalid request ID');
      }

      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Firestore API error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch request: ${response.status} ${response.statusText}`);
      }

      const doc = await response.json();
      console.log('getRequestById - Raw doc:', doc);
      
      if (!doc || !doc.fields) {
        console.error('getRequestById: Empty or invalid response from Firestore');
        throw new Error('Invalid response from server');
      }
      
      const fields = fromFirestoreFormat(doc);
      console.log('getRequestById - Processed fields:', fields);
      
      const result = {
        id: requestId,
        ...fields
      };
      console.log(`Successfully fetched request ${requestId}:`, result);
      
      return result;
    } catch (error) {
      console.error('Error fetching request by ID:', error);
      
      // Return a mock object for development to prevent crashes
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Returning mock data for development');
        return {
          id: requestId,
          status: 'inProgress',
          customerEmail: 'test@example.com',
          driverEmail: 'driver@example.com',
          pickup: { address: '123 Main St' },
          dropoff: { address: '456 Oak Ave' },
          item: { description: 'Test Package' },
          pricing: { total: 25.99 },
          createdAt: new Date().toISOString()
        };
      }
      
      throw error;
    }
  }

  // Complete delivery with rating and photos
  async function completeDelivery(requestId, completionData = {}) {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updates = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: currentUser.uid,
        updatedAt: new Date().toISOString(),
        ...completionData
      };

      const fieldPaths = Object.keys(updates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updates);

      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to complete delivery: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Delivery completed successfully:', result);
      return result;
    } catch (error) {
      console.error('Error completing delivery:', error);
      throw error;
    }
  }

  // Updated finishDelivery to include earnings calculation
  const finishDelivery = async (requestId, photos = [], driverLocation = null, customerRating = null) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Finishing delivery for request:', requestId);
      
      // First get the request data to calculate earnings
      const requestData = await getRequestById(requestId);
      const driverEarnings = calculateDriverEarnings(requestData.pricing?.total || 0);
      
      // Upload photos if provided
      if (photos.length > 0) {
        await uploadRequestPhotos(requestId, photos, 'dropoff');
      }
      
      // Complete the delivery with earnings data
      const completionData = {
        driverEarnings,
        assignedDriverId: currentUser.uid, // Ensure we have the driver ID
        completedBy: currentUser.uid,
        finalLocation: driverLocation,
        customerRating: customerRating || 5
      };
      
      const result = await completeDelivery(requestId, completionData);
      
      // Update customer rating if driver rated the customer
      if (customerRating && requestData.customerId) {
        await updateUserRating(requestData.customerId, customerRating, 'customerProfile');
      }
      
      // Update driver's earnings profile
      await updateDriverEarnings(currentUser.uid, {
        ...requestData,
        driverEarnings,
        pricing: requestData.pricing
      });
      
      // Process the payout through payment service
      try {
        const driverProfile = await getDriverProfile(currentUser.uid);
        
        if (driverProfile?.connectAccountId && driverProfile?.canReceivePayments) {
          const payoutResult = await processTripPayout({
            tripId: requestId,
            driverId: currentUser.uid,
            connectAccountId: driverProfile.connectAccountId,
            amount: driverEarnings,
            customerPaymentIntentId: requestData.payment?.paymentIntentId
          });
          
          if (!payoutResult.success) {
            console.error('Failed to process driver payout:', payoutResult.error);
            // Continue with delivery completion - don't fail the entire process
          } else {
            console.log('Driver payout processed successfully:', payoutResult);
          }
        } else {
          console.warn('Driver not eligible for automatic payout - onboarding incomplete');
        }
      } catch (payoutError) {
        console.error('Error processing driver payout:', payoutError);
        // Continue with delivery completion - don't fail the entire process
      }
      
      console.log('Delivery completed with earnings:', driverEarnings);
      return result;
      
    } catch (error) {
      console.error('Error finishing delivery:', error);
      throw error;
    }
  };

  // Profile picture functions - Firebase Storage implementation
  const uploadProfileImage = async (imageUri) => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      console.log('Uploading profile image to Firebase Storage...');
      
      // Upload to Firebase Storage
      const storagePath = getStoragePath.userProfile(currentUser.uid);
      const downloadURL = await uploadPhotoToStorage(imageUri, storagePath);
      
      // Update user profile in Firestore with new photo URL
      await updateUserProfile({
        profileImageUrl: downloadURL
      });
      
      // Update local state
      setProfileImage(downloadURL);
      
      console.log('Profile image uploaded successfully:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getProfileImage = async () => {
    if (!currentUser?.uid) {
      return null;
    }

    try {
      // Get from Firestore user profile
      const response = await fetch(`${FIRESTORE_BASE_URL}/users/${currentUser.uid}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (response.ok) {
        const doc = await response.json();
        const userData = fromFirestoreFormat(doc);
        const profileUrl = userData.profileImageUrl;
        
        // Update local state
        setProfileImage(profileUrl);
        return profileUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting profile image:', error);
      return profileImage; // Return cached version on error
    }
  };

  const deleteProfileImage = async () => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      console.log('Deleting profile image from Firebase Storage...');
      
      // Delete from Firebase Storage
      const storagePath = getStoragePath.userProfile(currentUser.uid);
      await deletePhotoFromStorage(storagePath);
      
      // Remove from user profile in Firestore
      await updateUserProfile({
        profileImageUrl: null
      });
      
      // Clear local state
      setProfileImage(null);
      
      console.log('Profile image deleted successfully');
      
    } catch (error) {
      console.error('Error deleting profile image:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get user profile - Firebase implementation
  const getUserProfile = async () => {
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${FIRESTORE_BASE_URL}/users/${currentUser.uid}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (response.ok) {
        const doc = await response.json();
        const userData = fromFirestoreFormat(doc);
        
        return {
          uid: currentUser.uid,
          email: currentUser.email,
          profileImageUrl: userData.profileImageUrl || null,
          ...userData
        };
      }
      
      // Fallback if no profile found
      return {
        uid: currentUser.uid,
        email: currentUser.email,
        profileImageUrl: null
      };
      
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  // Rating aggregation function
  const updateUserRating = async (userId, newRating, profileType = 'driverProfile') => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      // Get current user data
      const response = await fetch(`${FIRESTORE_BASE_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      const userProfile = fromFirestoreFormat(userData);
      
      // Get current rating data
      const profile = userProfile[profileType] || {};
      const currentRating = profile.rating || 5.0;
      const currentCount = profile.ratingCount || 0;
      
      // Calculate new average rating
      const totalRatingPoints = currentRating * currentCount;
      const newTotalPoints = totalRatingPoints + newRating;
      const newCount = currentCount + 1;
      const newAverageRating = newTotalPoints / newCount;
      
      // Update profile with new rating
      const updatedProfile = {
        ...profile,
        rating: Math.round(newAverageRating * 100) / 100, // Round to 2 decimals
        ratingCount: newCount
      };

      // If customer profile, also increment completed orders
      if (profileType === 'customerProfile') {
        updatedProfile.completedOrders = (profile.completedOrders || 0) + 1;
      }

      const updates = {
        [profileType]: updatedProfile,
        updatedAt: new Date().toISOString()
      };

      const fieldPaths = Object.keys(updates);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const updateData = toFirestoreFormat(updates);

      // Update user profile in Firebase
      await fetch(
        `${FIRESTORE_BASE_URL}/users/${userId}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.accessToken}`
          },
          body: JSON.stringify(updateData)
        }
      );

      console.log(`Updated ${profileType} rating: ${currentRating} -> ${newAverageRating} (${newCount} ratings)`);
      
    } catch (error) {
      console.error('Error updating user rating:', error);
      throw error;
    }
  };

  // Messaging functions
  const createConversation = async (requestId, customerId, driverId, customerName, driverName) => {
    try {
      const conversationId = `${requestId}_${customerId}_${driverId}`;
      
      // Check existence first (avoid overwriting createdAt)
      let createdAt;
      const getRes = await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${currentUser?.accessToken}` }
      });
      const exists = getRes.ok;
      if (!exists) createdAt = new Date().toISOString();

      const now = new Date().toISOString();

      // Build fields once
      const base = {
        requestId,
        customerId,
        driverId,
        updatedAt: now,
        ...(customerName ? { customerName } : {}),
        ...(driverName ? { driverName } : {}),
      };

      const createOnly = !exists
        ? {
            createdAt,
            lastMessage: null,
            lastMessageAt: null,
            unreadByCustomer: 0,
            unreadByDriver: 0,
          }
        : {};

      const fields = { ...base, ...createOnly };

      // PATCH (merge) without clobbering existing data
      const response = await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify(toFirestoreFormat(fields)),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const getConversations = async (userId, userType) => {
    try {
      const field = userType === 'customer' ? 'customerId' : 'driverId';
      const response = await fetch(
        `${FIRESTORE_BASE_URL}/conversations?key=${API_KEY}&structuredQuery=${encodeURIComponent(JSON.stringify({
          from: [{ collectionId: 'conversations' }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          },
          orderBy: [
            {
              field: { fieldPath: 'lastMessageAt' },
              direction: 'DESCENDING'
            }
          ]
        }))}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser?.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      const conversations = (data.documents || []).map(doc => ({
        id: doc.name.split('/').pop(),
        ...fromFirestoreFormat(doc.fields)
      }));

      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  };

  const sendMessage = async (conversationId, senderId, senderType, content, messageType = 'text') => {
    try {
      const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageData = {
        id: messageId,
        conversationId,
        senderId,
        senderType,
        content,
        messageType,
        timestamp: new Date().toISOString(),
        read: false
      };

      // Send message
      const messageResponse = await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}/messages/${messageId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(messageData)
        })
      });

      if (!messageResponse.ok) {
        throw new Error('Failed to send message');
      }

      // Update conversation with last message
      const updateData = {
        lastMessage: content,
        lastMessageAt: new Date().toISOString()
      };

      if (senderType === 'customer') {
        updateData.unreadByDriver = 1;
      } else {
        updateData.unreadByCustomer = 1;
      }

      await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });

      return messageData;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const getMessages = async (conversationId) => {
    try {
      const response = await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}/messages?key=${API_KEY}&orderBy=timestamp`, {
        headers: {
          'Authorization': `Bearer ${currentUser?.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      const messages = data.documents ? data.documents.map(doc => ({
        id: doc.name.split('/').pop(),
        ...fromFirestoreFormat(doc.fields)
      })) : [];

      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const subscribeToMessages = (conversationId, callback) => {
    const pollMessages = async () => {
      try {
        const messages = await getMessages(conversationId);
        callback(messages);
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    };

    // Poll every 2 seconds for new messages
    const interval = setInterval(pollMessages, 2000);
    
    // Initial load
    pollMessages();

    // Return cleanup function
    return () => clearInterval(interval);
  };

  const markMessageAsRead = async (conversationId, userType) => {
    try {
      const updateData = {};
      if (userType === 'customer') {
        updateData.unreadByCustomer = 0;
      } else {
        updateData.unreadByDriver = 0;
      }

      await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.accessToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Initialize empty conversations for existing orders
  const initializeEmptyConversations = async () => {
    try {
      // Get all pickup requests
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests?key=${API_KEY}`);
      if (!response.ok) {
        throw new Error('Failed to fetch pickup requests');
      }
      
      const requestData = await response.json();
      
      for (const doc of (requestData.documents || [])) {
        const request = fromFirestoreFormat(doc.fields);
        const requestId = doc.name.split('/').pop();
        
        // Only for accepted/completed orders with assigned drivers
        if (request.assignedDriverId && request.customerId) {
          const conversationId = `${requestId}_${request.customerId}_${request.assignedDriverId}`;
          
          // Check if conversation exists
          const convResponse = await fetch(
            `${FIRESTORE_BASE_URL}/conversations/${conversationId}?key=${API_KEY}`
          );
          
          if (convResponse.ok) {
            const convData = await convResponse.json();
            // If conversation exists but has no fields
            if (!convData.fields || Object.keys(convData.fields).length === 0) {
              // Initialize with proper data
              await fetch(`${FIRESTORE_BASE_URL}/conversations/${conversationId}?key=${API_KEY}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: toFirestoreFormat({
                    requestId: requestId,
                    customerId: request.customerId,
                    driverId: request.assignedDriverId,
                    createdAt: request.acceptedAt || request.createdAt,
                    lastMessage: 'Conversation started',
                    lastMessageAt: new Date().toISOString(),
                    unreadByCustomer: 0,
                    unreadByDriver: 0
                  })
                })
              });
              console.log('Initialized empty conversation:', conversationId);
            }
          }
        }
      }
      console.log('Finished initializing empty conversations');
    } catch (error) {
      console.error('Error initializing conversations:', error);
    }
  };

  // Timer and request management functions
  const checkExpiredRequests = async () => {
    try {
      const now = new Date().toISOString();
      
      // Query for expired requests that are still pending
      const response = await fetch(
        `${FIRESTORE_BASE_URL}/pickupRequests?key=${API_KEY}&structuredQuery=${encodeURIComponent(JSON.stringify({
          from: [{ collectionId: 'pickupRequests' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'pending' }
                  }
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'expiresAt' },
                    op: 'LESS_THAN',
                    value: { timestampValue: now }
                  }
                }
              ]
            }
          }
        }))}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check expired requests');
      }

      const data = await response.json();
      const expiredRequests = data.documents ? data.documents.map(doc => ({
        id: doc.name.split('/').pop(),
        ...fromFirestoreFormat(doc)
      })) : [];

      // Reset expired requests to make them available again
      for (const request of expiredRequests) {
        await resetExpiredRequest(request.id);
      }

      return expiredRequests.length;
    } catch (error) {
      console.error('Error checking expired requests:', error);
      return 0;
    }
  };

  const resetExpiredRequest = async (requestId) => {
    try {
      const newExpiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 minutes from now
      
      const updateData = {
        status: 'pending',
        expiresAt: newExpiresAt,
        viewingDriverId: null,
        resetCount: 1 // We'll increment this if the request was already reset
      };

      await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });

      console.log(`Reset expired request ${requestId} with new expiry: ${newExpiresAt}`);
    } catch (error) {
      console.error('Error resetting expired request:', error);
      throw error;
    }
  };

  const extendRequestTimer = async (requestId, additionalMinutes = 2) => {
    try {
      // Get current request
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?key=${API_KEY}`);
      
      if (!response.ok) {
        throw new Error('Failed to get request');
      }

      const data = await response.json();
      const request = fromFirestoreFormat(data.fields);
      
      // Calculate new expiry time
      const currentExpiry = new Date(request.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);
      
      const updateData = {
        expiresAt: newExpiry.toISOString(),
        extendedTimes: (request.extendedTimes || 0) + 1
      };

      await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });

      return newExpiry.toISOString();
    } catch (error) {
      console.error('Error extending request timer:', error);
      throw error;
    }
  };

  const claimRequestForViewing = async (requestId, driverId) => {
    try {
      const updateData = {
        viewingDriverId: driverId,
        viewedAt: new Date().toISOString()
      };

      await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });
    } catch (error) {
      console.error('Error claiming request for viewing:', error);
      throw error;
    }
  };

  const releaseRequestViewing = async (requestId) => {
    try {
      const updateData = {
        viewingDriverId: null
      };

      await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFormat(updateData)
        })
      });
    } catch (error) {
      console.error('Error releasing request viewing:', error);
      throw error;
    }
  };

  // Driver convenience functions
  const driverFunctions = {
    // Start driving to pickup
    startDriving: (requestId, driverLocation) => 
      updateDriverStatus(requestId, 'inProgress', driverLocation),
    
    // Arrive at pickup location  
    arriveAtPickup: (requestId, driverLocation, photos = []) => 
      updateDriverStatus(requestId, 'arrivedAtPickup', driverLocation, { arrivedAt: new Date().toISOString() }),
    
    // Confirm pickup with photos
    confirmPickup: async (requestId, photos = [], driverLocation = null) => {
      if (photos.length > 0) {
        await uploadRequestPhotos(requestId, photos, 'pickup');
      }
      return updateDriverStatus(requestId, 'pickedUp', driverLocation);
    },
    
    // Start driving to dropoff
    startDelivery: (requestId, driverLocation) => 
      updateDriverStatus(requestId, 'enRouteToDropoff', driverLocation),
    
    // Arrive at dropoff
    arriveAtDropoff: (requestId, driverLocation) => 
      updateDriverStatus(requestId, 'arrivedAtDropoff', driverLocation),
  };

  // ===========================================
  // ORDER CANCELLATION FUNCTIONS
  // ===========================================

  const cancelOrder = async (orderId, reason = 'customer_request') => {
    try {
      console.log('Cancelling order:', orderId);
      
      // Get current order status
      const orderData = await getRequestById(orderId);
      console.log('CancelOrder - orderData:', orderData);
      
      if (!orderData) {
        console.error('CancelOrder - Order data is null/undefined for ID:', orderId);
        throw new Error('Order not found');
      }
      
      // Check if cancellation is allowed
      const cancellationInfo = getCancellationInfo(orderData);
      
      if (!cancellationInfo.canCancel) {
        throw new Error(cancellationInfo.reason);
      }
      
      // Get driver location if available
      let driverLocation = null;
      if (orderData.driverLocation) {
        driverLocation = {
          latitude: orderData.driverLocation.latitude,
          longitude: orderData.driverLocation.longitude
        };
      }
      
      // Call the payment service to process cancellation
      const response = await fetch(`${PAYMENT_SERVICE_URL}/cancel-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          customerId: currentUser.uid,
          reason,
          driverLocation
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel order');
      }

      const cancellationResult = await response.json();
      
      if (!cancellationResult.success) {
        throw new Error(cancellationResult.error || 'Cancellation failed');
      }
      
      // Update order status in Firebase with ACTUAL payment details from server
      await updateRequestStatus(orderId, 'cancelled', {
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser.uid,
        cancellationReason: reason,
        cancellationFee: cancellationResult.cancellationFee || 0,
        refundAmount: cancellationResult.refundAmount || 0,
        driverCompensation: cancellationResult.driverCompensation || 0,
        refundId: cancellationResult.refundId || null,
        compensationTransferId: cancellationResult.driverCompensationId || null
      });
      
      console.log('Order cancelled successfully with refund:', cancellationResult);
      return {
        success: true,
        cancellationFee: cancellationResult.cancellationFee || 0,
        refundAmount: cancellationResult.refundAmount || 0,
        driverCompensation: cancellationResult.driverCompensation || 0,
        refundId: cancellationResult.refundId
      };
      
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  };

  const getCancellationInfo = (orderData) => {
    const status = orderData.status;
    const timeSinceAccepted = orderData.acceptedAt 
      ? Date.now() - new Date(orderData.acceptedAt).getTime()
      : 0;
    const orderTotal = orderData.pricing?.total || 0;
    
    switch (status) {
      case 'pending':
        return {
          canCancel: true,
          fee: 0,
          reason: 'Free cancellation - no driver assigned yet',
          refundAmount: orderTotal,
          driverCompensation: 0
        };
        
      case 'accepted':
      case 'inProgress':
        return {
          canCancel: true,
          fee: 0,
          reason: 'Free cancellation - driver is on the way',
          refundAmount: orderTotal,
          driverCompensation: 0
        };
        
      case 'arrivedAtPickup':
        return {
          canCancel: false,
          fee: 0,
          reason: 'Cannot cancel - driver has arrived at pickup location',
          refundAmount: 0,
          driverCompensation: 0
        };
        
      case 'pickedUp':
        return {
          canCancel: false,
          fee: 0,
          reason: 'Cannot cancel - items have been picked up',
          refundAmount: 0,
          driverCompensation: 0
        };
        
      case 'enRouteToDropoff':
        return {
          canCancel: false,
          fee: 0,
          reason: 'Cannot cancel - delivery is in progress',
          refundAmount: 0,
          driverCompensation: 0
        };
        
      case 'completed':
        return {
          canCancel: false,
          fee: 0,
          reason: 'Cannot cancel - order has been completed',
          refundAmount: 0,
          driverCompensation: 0
        };
        
      case 'cancelled':
        return {
          canCancel: false,
          fee: 0,
          reason: 'Order is already cancelled',
          refundAmount: 0,
          driverCompensation: 0
        };
        
      default:
        return {
          canCancel: false,
          fee: 0,
          reason: 'Unknown order status',
          refundAmount: 0,
          driverCompensation: 0
        };
    }
  };

  // Create Stripe Identity verification session
  const createVerificationSession = async (userData) => {
    // Use payment service URL - Render backend
    const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com';
    
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/create-verification-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          ...userData
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create verification session');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating verification session:', error);
      throw error;
    }
  };

  // ===========================================
  // TERMS OF SERVICE FUNCTIONS
  // ===========================================

  // Get current legal document versions from Firestore (PUBLIC ACCESS)
  const getLegalConfig = async () => {
    try {
      // Fetch legal config without authentication (public-read document)
      const response = await fetch(`${FIRESTORE_BASE_URL}/appConfig/legal`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Legal configuration not found. Please contact support.');
        }
        throw new Error(`Failed to load legal configuration: ${response.status}`);
      }

      const doc = await response.json();
      const config = fromFirestoreFormat(doc);
      
      // Validate required fields exist
      if (!config.tosVersion || !config.privacyVersion) {
        throw new Error('Invalid legal configuration. Please contact support.');
      }

      return {
        tosVersion: config.tosVersion,
        privacyVersion: config.privacyVersion,
        driverAgreementVersion: config.driverAgreementVersion || null
      };
    } catch (error) {
      console.error('Error getting legal config:', error);
      // DON'T fall back to defaults - this is critical for compliance
      throw new Error('Unable to load current terms and privacy policy. Please check your internet connection and try again.');
    }
  };

  // Check if user needs to accept/re-accept terms
  const checkTermsAcceptance = async (uid) => {
    if (!uid) uid = currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    try {
      // Get current required versions
      const currentVersions = await getLegalConfig();
      
      // Get user's accepted versions
      const response = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
        headers: {
          'Authorization': `Bearer ${currentUser?.accessToken}`
        }
      });

      if (!response.ok) {
        return { 
          needsAcceptance: true, 
          missingVersions: ['tosVersion', 'privacyVersion'],
          reason: 'No terms acceptance record found'
        };
      }

      const doc = await response.json();
      const userData = fromFirestoreFormat(doc);
      const userTerms = userData.termsAgreement;

      // If no terms agreement at all
      if (!userTerms || !userTerms.accepted) {
        return { 
          needsAcceptance: true, 
          missingVersions: ['tosVersion', 'privacyVersion'],
          reason: 'No terms accepted'
        };
      }

      // Migration: Handle old format users (version field instead of tosVersion/privacyVersion)
      if (userTerms.version && !userTerms.tosVersion) {
        console.log('Migrating user from old terms format - forcing re-acceptance');
        return { 
          needsAcceptance: true, 
          missingVersions: ['tosVersion', 'privacyVersion'],
          reason: 'Migration: old format detected',
          requiresMigration: true
        };
      }

      // Check version mismatches
      const missingVersions = [];
      
      if (userTerms.tosVersion !== currentVersions.tosVersion) {
        missingVersions.push('tosVersion');
      }
      
      if (userTerms.privacyVersion !== currentVersions.privacyVersion) {
        missingVersions.push('privacyVersion');
      }
      
      // Check driver agreement if user is a driver
      if (userData.userType === 'driver' && currentVersions.driverAgreementVersion) {
        if (userTerms.driverAgreementVersion !== currentVersions.driverAgreementVersion) {
          missingVersions.push('driverAgreementVersion');
        }
      }

      return {
        needsAcceptance: missingVersions.length > 0,
        missingVersions,
        currentVersions,
        userVersions: {
          tosVersion: userTerms.tosVersion,
          privacyVersion: userTerms.privacyVersion,
          driverAgreementVersion: userTerms.driverAgreementVersion
        },
        reason: missingVersions.length > 0 ? 'Version mismatch' : 'All versions current'
      };
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      throw error; // Don't hide errors - let them bubble up
    }
  };

  // Accept current terms versions for user
  const acceptTerms = async (uid, acceptedDuringSignup = false, tokenOverride) => {
    if (!uid) uid = currentUser?.uid;
    const token = tokenOverride || currentUser?.accessToken;
    if (!uid || !token) throw new Error('User not authenticated');

    try {
      // Get current versions that need to be accepted
      const currentVersions = await getLegalConfig();
      
      // Get user data to determine if they're a driver
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      let userType = 'customer';
      if (userResponse.ok) {
        const userDoc = await userResponse.json();
        const userData = fromFirestoreFormat(userDoc);
        userType = userData.userType || 'customer';
      }

      const updateData = {
        termsAgreement: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          tosVersion: currentVersions.tosVersion,
          privacyVersion: currentVersions.privacyVersion,
          driverAgreementVersion: userType === 'driver' ? currentVersions.driverAgreementVersion : null,
          acceptedDuringSignup: acceptedDuringSignup,
          ipAddress: null // Could be added later if needed
        }
      };

      const fieldPaths = Object.keys(updateData);
      const updateMaskParams = fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const firestoreData = toFirestoreFormat(updateData);

      await fetch(
        `${FIRESTORE_BASE_URL}/users/${uid}?${updateMaskParams}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(firestoreData)
        }
      );

      console.log('Terms acceptance updated for user:', uid, 'versions:', currentVersions);
      return true;
    } catch (error) {
      console.error('Error accepting terms:', error);
      throw error;
    }
  };

  // Get full terms status for a user
  const getTermsStatus = async (uid) => {
    if (!uid) uid = currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    try {
      const termsData = await checkTermsAcceptance(uid);
      
      return {
        hasAccepted: termsData.accepted || false,
        version: termsData.version || null,
        acceptedAt: termsData.acceptedAt || null,
        acceptedDuringSignup: termsData.acceptedDuringSignup || false,
        needsUpdate: termsData.version !== "1.0" // Update this when terms version changes
      };
    } catch (error) {
      console.error('Error getting terms status:', error);
      return {
        hasAccepted: false,
        version: null,
        acceptedAt: null,
        acceptedDuringSignup: false,
        needsUpdate: true
      };
    }
  };

  // ===========================================
  // DRIVER ONLINE/OFFLINE SYSTEM
  // ===========================================

  // Set driver online with location and create new session
  const setDriverOnline = async (driverId, location) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Setting driver online:', driverId, 'at location:', location);
      
      const response = await authFetch(`${PAYMENT_SERVICE_URL}/driver/online`, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
          latitude: location.latitude,
          longitude: location.longitude
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to set driver online: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Driver set online successfully with session:', result.sessionId);
      return result.sessionId;
    } catch (error) {
      console.error('Error setting driver online:', error);
      throw error;
    }
  };

  // Set driver offline and end current session
  const setDriverOffline = async (driverId) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Setting driver offline:', driverId);
      
      const response = await authFetch(`${PAYMENT_SERVICE_URL}/driver/offline`, {
        method: 'POST',
        body: JSON.stringify({
          driverId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to set driver offline: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Driver set offline successfully. Session duration:', result.onlineMinutes, 'minutes');
      return true;
    } catch (error) {
      console.error('Error setting driver offline:', error);
      throw error;
    }
  };

  // Update driver heartbeat (location and last ping)
  const updateDriverHeartbeat = async (driverId, location) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await authFetch(`${PAYMENT_SERVICE_URL}/driver/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
          latitude: location.latitude,
          longitude: location.longitude
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update heartbeat: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error updating driver heartbeat:', error);
      throw error;
    }
  };

  // Helper function to calculate distance between two points in miles
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get online drivers near a location
  const getOnlineDrivers = async (customerLocation, radiusMiles = 10) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await authFetch(
        `${PAYMENT_SERVICE_URL}/drivers/online?lat=${customerLocation.latitude}&lng=${customerLocation.longitude}&radiusMiles=${radiusMiles}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get online drivers: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Found ${result.count} online drivers within ${radiusMiles} miles`);
      return result.drivers || [];
    } catch (error) {
      console.error('Error getting online drivers:', error);
      throw error;
    }
  };

  // Get driver session stats for a specific date
  const getDriverSessionStats = async (driverId, date = null) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const response = await authFetch(
        `${PAYMENT_SERVICE_URL}/drivers/${driverId}/session-stats?date=${targetDate}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get session stats: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        totalOnlineMinutes: result.totalOnlineMinutes || 0,
        tripsCompleted: result.tripsCompleted || 0,
        totalEarnings: result.totalEarnings || 0
      };
    } catch (error) {
      console.error('Error getting driver session stats:', error);
      return { totalOnlineMinutes: 0, tripsCompleted: 0, totalEarnings: 0 };
    }
  };

  const value = {
    currentUser,
    userType,
    signup,
    login,
    logout,
    loading,
    createPickupRequest,
    getUserPickupRequests,
    getAvailableRequests,
    acceptRequest,
    updateRequestStatus,
    updateDriverLocation,
    updateUserProfile,
    // Driver progress functions
    updateDriverStatus,
    uploadRequestPhotos,
    getRequestById,
    completeDelivery,
    // Driver earnings functions
    getDriverTrips,
    getDriverStats,
    updateDriverEarnings,
    calculateDriverEarnings,
    // Driver payment functions
    getDriverProfile,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverEarningsHistory,
    getDriverPayouts,
    requestInstantPayout,
    processInstantPayout: requestInstantPayout, // Alias for DriverEarningsScreen compatibility
    processTripPayout,
    completeTripWithPayment,
    // Updated finishDelivery with earnings
    finishDelivery,
    // Profile picture functions
    profileImage,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    // Rating functions
    updateUserRating,
    // Firebase Storage functions
    uploadPhotoToStorage,
    uploadMultiplePhotos,
    deletePhotoFromStorage,
    getPhotoURL,
    compressImage,
    // Convenience functions for drivers
    ...driverFunctions,
    // Messaging functions
    createConversation,
    getConversations,
    sendMessage,
    getMessages,
    subscribeToMessages,
    markMessageAsRead,
    initializeEmptyConversations,
    // Timer and request management functions
    checkExpiredRequests,
    resetExpiredRequest,
    extendRequestTimer,
    claimRequestForViewing,
    releaseRequestViewing,
    // Order cancellation functions
    cancelOrder,
    getCancellationInfo,
    // Stripe Identity verification
    createVerificationSession,
    // Terms of service functions
    getLegalConfig,
    checkTermsAcceptance,
    acceptTerms,
    getTermsStatus,
    // Driver online/offline system functions
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat,
    getOnlineDrivers,
    getDriverSessionStats
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}