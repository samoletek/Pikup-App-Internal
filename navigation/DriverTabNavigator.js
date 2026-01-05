// navigation/DriverTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DriverHomeScreen from '../screens/DriverHomeScreen';
import DriverProfileScreen from '../screens/DriverProfileScreen';
import DriverEarningsScreen from '../screens/DriverEarningsScreen';
import DriverMessagesScreen from '../screens/DriverMessagesScreen';

const Tab = createBottomTabNavigator();

export default function DriverTabNavigator({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'Earnings') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Account') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#A77BFF',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#141426',
          borderTopColor: '#2A2A3B',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 20,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={DriverHomeScreen}
      />
      <Tab.Screen 
        name="Earnings" 
        component={DriverEarningsScreen}
      />
      <Tab.Screen 
        name="Messages" 
        component={DriverMessagesScreen}
      />
      <Tab.Screen 
        name="Account" 
        component={DriverProfileScreen}
      />
    </Tab.Navigator>
  );
}