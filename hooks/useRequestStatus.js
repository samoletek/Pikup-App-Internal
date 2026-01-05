// hooks/useRequestStatus.js - Auto-refresh hook for tracking request status
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useRequestStatus = (requestId) => {
  const { currentUser } = useAuth();
  const [requestStatus, setRequestStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const FIRESTORE_BASE_URL = 'https://firestore.googleapis.com/v1/projects/pikup-b1b7d/databases/(default)/documents';

  const fetchRequestStatus = async () => {
    if (!currentUser?.accessToken || !requestId) return;

    try {
      const response = await fetch(`${FIRESTORE_BASE_URL}/pickupRequests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${currentUser.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch request status: ${response.statusText}`);
      }

      const doc = await response.json();
      
      // Convert Firestore format to JS object
      const status = {
        id: requestId,
        status: doc.fields?.status?.stringValue || 'pending',
        driverId: doc.fields?.driverId?.stringValue || null,
        driverEmail: doc.fields?.driverEmail?.stringValue || null,
        acceptedAt: doc.fields?.acceptedAt?.stringValue || null,
        updatedAt: doc.fields?.updatedAt?.stringValue || null,
      };

      setRequestStatus(status);
      setError(null);
      
      // Stop polling if request is completed or cancelled
      if (status.status === 'completed' || status.status === 'cancelled') {
        stopPolling();
      }
      
    } catch (err) {
      console.error('Error fetching request status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchRequestStatus, 5000);
    
    // Initial fetch
    fetchRequestStatus();
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (requestId && currentUser) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [requestId, currentUser]);

  return {
    requestStatus,
    loading,
    error,
    refresh: fetchRequestStatus,
    startPolling,
    stopPolling
  };
};