import * as StorageService from '../../../services/StorageService';

export const createStorageDomainActions = () => {
  return {
    compressImage: StorageService.compressImage,
    uploadToSupabase: StorageService.uploadToSupabase,
    uploadMultiplePhotos: StorageService.uploadMultiplePhotos,
    getPhotoURL: StorageService.getPhotoURL,
    deletePhotoFromStorage: StorageService.deletePhotoFromStorage,
    uploadPhotoToStorage: StorageService.uploadPhotoToStorage,
  };
};
