// hooks/usePickupRequests.js
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  createPickupRequest, 
  getUserPickupRequests, 
  getAvailablePickupRequests,
  updatePickupRequestStatus,
  acceptPickupRequest 
} from '../services/firestore';

export const usePickupRequests = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create a new pickup request
  const createRequest = async (requestData) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const newRequest = await createPickupRequest({
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        ...requestData
      }, currentUser.accessToken);

      // Add to local state
      setRequests(prev => [newRequest, ...prev]);
      return newRequest;
      
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's pickup requests
  const fetchUserRequests = async () => {
    if (!currentUser?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const userRequests = await getUserPickupRequests(currentUser.uid, currentUser.accessToken);
      setRequests(userRequests);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching user requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update request status
  const updateRequestStatus = async (requestId, status, updates = {}) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updatedRequest = await updatePickupRequestStatus(
        requestId, 
        status, 
        updates, 
        currentUser.accessToken
      );

      // Update local state
      setRequests(prev => 
        prev.map(req => req.id === requestId ? updatedRequest : req)
      );

      return updatedRequest;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Accept a pickup request (for drivers)
  const acceptRequest = async (requestId) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    try {
      const updatedRequest = await acceptPickupRequest(
        requestId, 
        currentUser.uid, 
        currentUser.accessToken
      );

      return updatedRequest;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Auto-fetch requests when user changes
  useEffect(() => {
    if (currentUser) {
      fetchUserRequests();
    } else {
      setRequests([]);
    }
  }, [currentUser]);

  return {
    requests,
    loading,
    error,
    createRequest,
    fetchUserRequests,
    updateRequestStatus,
    acceptRequest,
    refreshRequests: fetchUserRequests
  };
};

// Hook specifically for drivers to get available requests
export const useAvailableRequests = () => {
  const { currentUser } = useAuth();
  const [availableRequests, setAvailableRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAvailableRequests = async () => {
    if (!currentUser?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const requests = await getAvailablePickupRequests(currentUser.accessToken);
      setAvailableRequests(requests);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching available requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch available requests when user changes
  useEffect(() => {
    if (currentUser) {
      fetchAvailableRequests();
      
      // Refresh every 30 seconds for real-time updates
      const interval = setInterval(fetchAvailableRequests, 30000);
      return () => clearInterval(interval);
    } else {
      setAvailableRequests([]);
    }
  }, [currentUser]);

  return {
    availableRequests,
    loading,
    error,
    refreshRequests: fetchAvailableRequests
  };
};