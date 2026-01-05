import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DriverPreferencesScreen({ navigation }) {
  // Pickup Type Preferences
  const [pickupPreferences, setPickupPreferences] = useState({
    smallItems: true,
    mediumItems: true,
    largeItems: false,
    extraLargeItems: false,
    fragileItems: true,
    outdoorItems: true,
  });

  // Equipment Available
  const [equipment, setEquipment] = useState({
    dolly: false,
    handTruck: false,
    movingStraps: false,
    heavyDutyGloves: true,
    furniturePads: false,
    toolSet: false,
    rope: true,
    tarp: false,
  });

  // Vehicle Specifications
  const [vehicleSpecs, setVehicleSpecs] = useState({
    truckBed: false,
    trailer: false,
    largeVan: false,
    suvSpace: true,
    roofRack: false,
  });

  // Availability Settings
  const [availability, setAvailability] = useState({
    weekends: true,
    evenings: true,
    shortNotice: false,
    longDistance: false,
  });

  const handleSavePreferences = () => {
    Alert.alert(
      'Preferences Saved',
      'Your PikUp preferences have been updated successfully!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const ToggleSection = ({ title, subtitle, items, state, setState }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {Object.entries(items).map(([key, label]) => (
        <View key={key} style={styles.toggleItem}>
          <View style={styles.toggleLeft}>
            <Text style={styles.toggleLabel}>{label}</Text>
          </View>
          <Switch
            value={state[key]}
            onValueChange={(value) => setState(prev => ({ ...prev, [key]: value }))}
            trackColor={{ false: '#2A2A3B', true: '#00D4AA' }}
            thumbColor={state[key] ? '#fff' : '#999'}
            ios_backgroundColor="#2A2A3B"
          />
        </View>
      ))}
    </View>
  );

  const pickupItems = {
    smallItems: 'Small Items (under 25 lbs)',
    mediumItems: 'Medium Items (25-75 lbs)',
    largeItems: 'Large Items (75-150 lbs)',
    extraLargeItems: 'Extra Large Items (150+ lbs)',
    fragileItems: 'Fragile/Delicate Items',
    outdoorItems: 'Outdoor/Garden Items',
  };

  const equipmentItems = {
    dolly: 'Dolly/Hand Truck',
    handTruck: 'Heavy Duty Hand Truck',
    movingStraps: 'Moving Straps',
    heavyDutyGloves: 'Heavy Duty Gloves',
    furniturePads: 'Furniture Pads/Blankets',
    toolSet: 'Basic Tool Set',
    rope: 'Rope/Bungee Cords',
    tarp: 'Tarp/Protective Covering',
  };

  const vehicleItems = {
    truckBed: 'Pickup Truck Bed',
    trailer: 'Trailer Available',
    largeVan: 'Large Van/Box Truck',
    suvSpace: 'SUV/Large Cargo Space',
    roofRack: 'Roof Rack System',
  };

  const availabilityItems = {
    weekends: 'Weekend Availability',
    evenings: 'Evening Hours (6PM-10PM)',
    shortNotice: 'Short Notice Pickups',
    longDistance: 'Long Distance Hauls (50+ miles)',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PikUp Preferences</Text>
        </View>

        {/* Introduction */}
        <View style={styles.introSection}>
          <View style={styles.introIcon}>
            <Ionicons name="options" size={28} color="#A77BFF" />
          </View>
          <Text style={styles.introTitle}>Customize Your Driver Experience</Text>
          <Text style={styles.introSubtitle}>
            Set your preferences to receive pickup requests that match your capabilities and equipment
          </Text>
        </View>

        {/* Pickup Type Preferences */}
        <ToggleSection
          title="Pickup Types"
          subtitle="What types of items are you comfortable handling?"
          items={pickupItems}
          state={pickupPreferences}
          setState={setPickupPreferences}
        />

        {/* Equipment Available */}
        <ToggleSection
          title="Equipment Available"
          subtitle="What equipment do you have for moving items?"
          items={equipmentItems}
          state={equipment}
          setState={setEquipment}
        />

        {/* Vehicle Specifications */}
        <ToggleSection
          title="Vehicle Capabilities"
          subtitle="What special features does your vehicle have?"
          items={vehicleItems}
          state={vehicleSpecs}
          setState={setVehicleSpecs}
        />

        {/* Availability Settings */}
        <ToggleSection
          title="Availability Preferences"
          subtitle="When and how do you prefer to work?"
          items={availabilityItems}
          state={availability}
          setState={setAvailability}
        />

        {/* Earnings Impact */}
        <View style={styles.earningsInfo}>
          <View style={styles.earningsIcon}>
            <Ionicons name="trending-up" size={24} color="#00D4AA" />
          </View>
          <View style={styles.earningsContent}>
            <Text style={styles.earningsTitle}>Maximize Your Earnings</Text>
            <Text style={styles.earningsSubtitle}>
              Drivers with more equipment can make more by completing more trips!
            </Text>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Get equipment for your safety most importantly</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Equipment owners get priority for matching requests</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Rush hours usually have more requests</Text>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSavePreferences}>
            <Text style={styles.saveButtonText}>Save Preferences</Text>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#141426',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  introSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 25,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  introIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#1A1A3A',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#141426',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  toggleLeft: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  earningsInfo: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  earningsIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#1A3A2E',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  earningsContent: {
    flex: 1,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
    marginBottom: 4,
  },
  earningsSubtitle: {
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  tipsSection: {
    backgroundColor: '#141426',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  tipItem: {
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  saveButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 10,
  },
  bottomSpacing: {
    height: 40,
  },
});