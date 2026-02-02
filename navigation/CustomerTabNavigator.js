// navigation/CustomerTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import CustomerHomeScreen from '../screens/customer/CustomerHomeScreen';
import CustomerProfileScreen from '../screens/customer/CustomerProfileScreen';
import CustomerActivityScreen from '../screens/customer/CustomerActivityScreen';
import CustomerMessagesScreen from '../screens/customer/CustomerMessagesScreen';

const Tab = createBottomTabNavigator();

export default function CustomerTabNavigator({ navigation }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Activity') {
            iconName = focused ? 'time' : 'time-outline';
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
        component={CustomerHomeScreen}
      />
      <Tab.Screen
        name="Activity"
        component={CustomerActivityScreen}
      />
      <Tab.Screen
        name="Messages"
        component={CustomerMessagesScreen}
      />
      <Tab.Screen
        name="Account"
        component={CustomerProfileScreen}
      />
    </Tab.Navigator>
  );
}