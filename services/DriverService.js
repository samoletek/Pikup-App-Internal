// services/DriverService.js
// Facade that keeps public API stable while delegating to focused driver modules.

export {
  calculateDriverEarnings,
  getDriverTrips,
  getDriverStats,
  subscribeToDriverEarningsUpdates,
  updateDriverEarnings,
} from './driverEarningsService';

export {
  getDriverReadinessProfile,
  getDriverProfile,
  subscribeToDriverProfileUpdates,
} from './driverProfileService';

export {
  setDriverOnline,
  setDriverOffline,
  updateDriverHeartbeat,
  getOnlineDrivers,
  getDriverSessionStats,
} from './driverPresenceService';
