import * as DriverService from '../../../services/DriverService';

export const createDriverDomainActions = ({ authFetch }) => {
  return {
    getDriverTrips: DriverService.getDriverTrips,
    getDriverStats: DriverService.getDriverStats,
    updateDriverEarnings: DriverService.updateDriverEarnings,
    calculateDriverEarnings: DriverService.calculateDriverEarnings,
    getDriverProfile: DriverService.getDriverProfile,
    setDriverOnline: (driverId, location, mode) =>
      DriverService.setDriverOnline(driverId, { ...location, mode }, authFetch),
    setDriverOffline: (driverId) => DriverService.setDriverOffline(driverId, authFetch),
    updateDriverHeartbeat: (driverId, location) =>
      DriverService.updateDriverHeartbeat(driverId, location, authFetch),
    getOnlineDrivers: (customerLocation, radiusMiles) =>
      DriverService.getOnlineDrivers(customerLocation, radiusMiles, authFetch),
    getDriverSessionStats: (driverId, date) =>
      DriverService.getDriverSessionStats(driverId, date, authFetch),
  };
};
