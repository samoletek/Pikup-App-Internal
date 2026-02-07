import CustomerHomeScreen from "../screens/customer/CustomerHomeScreen";
import CustomerProfileScreen from "../screens/customer/CustomerProfileScreen";
import CustomerActivityScreen from "../screens/customer/CustomerActivityScreen";
import CustomerMessagesScreen from "../screens/customer/CustomerMessagesScreen";

import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";
import DriverEarningsScreen from "../screens/driver/DriverEarningsScreen";
import DriverMessagesScreen from "../screens/driver/DriverMessagesScreen";

export const customerTabs = [
  {
    name: "Home",
    component: CustomerHomeScreen,
    icon: { active: "home", inactive: "home-outline" },
  },
  {
    name: "Activity",
    component: CustomerActivityScreen,
    icon: { active: "time", inactive: "time-outline" },
  },
  {
    name: "Messages",
    component: CustomerMessagesScreen,
    icon: { active: "chatbubble", inactive: "chatbubble-outline" },
  },
  {
    name: "Account",
    component: CustomerProfileScreen,
    icon: { active: "person", inactive: "person-outline" },
  },
];

export const driverTabs = [
  {
    name: "Home",
    component: DriverHomeScreen,
    icon: { active: "car", inactive: "car-outline" },
  },
  {
    name: "Earnings",
    component: DriverEarningsScreen,
    icon: { active: "wallet", inactive: "wallet-outline" },
  },
  {
    name: "Messages",
    component: DriverMessagesScreen,
    icon: { active: "chatbubble", inactive: "chatbubble-outline" },
  },
  {
    name: "Account",
    component: DriverProfileScreen,
    icon: { active: "person", inactive: "person-outline" },
  },
];
