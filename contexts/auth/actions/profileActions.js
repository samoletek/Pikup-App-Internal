import * as ProfileService from '../../../services/ProfileService';

export const createProfileDomainActions = ({
  currentUser,
  userType,
  setCurrentUser,
  setProfileImage,
  setLoading,
}) => {
  const updateUserProfile = (updates) =>
    ProfileService.updateUserProfile(updates, currentUser, userType).then((data) => {
      setCurrentUser((prev) => ({ ...prev, ...data }));
      return data;
    });

  const uploadProfileImage = async (imageUri) => {
    setLoading(true);
    try {
      const url = await ProfileService.uploadProfileImage(imageUri, currentUser, userType);
      setProfileImage(url);
      return url;
    } finally {
      setLoading(false);
    }
  };

  const getProfileImage = () =>
    ProfileService.getProfileImage(currentUser, userType).then((url) => {
      if (url) setProfileImage(url);
      return url;
    });

  const deleteProfileImage = async () => {
    setLoading(true);
    try {
      await ProfileService.deleteProfileImage(currentUser, userType);
      setProfileImage(null);
    } finally {
      setLoading(false);
    }
  };

  const getUserProfile = (targetUser = currentUser, options = {}) => {
    const normalizedTarget = targetUser || currentUser;
    return ProfileService.getUserProfile(normalizedTarget, options);
  };

  return {
    updateUserProfile,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserRating: (userId, newRating, profileType) =>
      ProfileService.updateUserRating(userId, newRating, profileType),
    saveFeedback: (feedbackData) => ProfileService.saveFeedback(feedbackData, currentUser),
    submitTripRating: (ratingData) => ProfileService.submitTripRating(ratingData, currentUser),
    getDriverFeedback: ProfileService.getDriverFeedback,
  };
};
