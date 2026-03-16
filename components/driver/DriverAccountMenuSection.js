// Driver Account Menu Section component: renders its UI and handles related interactions.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

function DriverAccountMenuItem({ item, isLast, ui }) {
  return (
    <TouchableOpacity
      key={item.id}
      style={[ui.menuItem, isLast && ui.menuItemLast]}
      onPress={item.onPress}
      disabled={item.disabled}
    >
      <View style={ui.menuItemLeft}>
        <Ionicons
          name={item.icon}
          size={20}
          color={item.disabled ? colors.text.muted : colors.primary}
        />
        <Text style={[ui.menuItemTitle, item.disabled && ui.menuItemTitleDisabled]}>
          {item.title}
        </Text>
      </View>
      <Ionicons
        name={item.external ? 'open-outline' : 'chevron-forward'}
        size={20}
        color={colors.text.tertiary}
      />
    </TouchableOpacity>
  );
}

export default function DriverAccountMenuSection({ menuItems, ui }) {
  return (
    <>
      <Text style={ui.sectionLabel}>ACCOUNT SETTINGS</Text>
      <View style={ui.menuSections}>
        {menuItems.map((item, index) => (
          <DriverAccountMenuItem
            key={item.id}
            item={item}
            isLast={index === menuItems.length - 1}
            ui={ui}
          />
        ))}
      </View>
    </>
  );
}
