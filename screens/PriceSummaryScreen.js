// PriceSummaryScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MatchingDriverModal from '../components/MatchingDriverModal'; // ✅

export default function PriceSummaryScreen({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSchedule = () => {
    setModalVisible(true);
    setTimeout(() => {
      setModalVisible(false);
      navigation.navigate('DriverFoundScreen');
    }, 3000); // Simulate matching delay
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://via.placeholder.com/400x140.png?text=Map' }}
        style={styles.map}
      />

      <View style={styles.summaryBox}>
        <Text style={styles.sectionTitle}>Price Summary</Text>

        <View style={styles.priceRow}>
          <Text style={styles.label}>Price</Text>
          <Text style={styles.price}>$40.00</Text>
        </View>

        <TouchableOpacity style={styles.paymentRow}>
          <Image
            source={{
              uri: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Google_Pay_Logo.svg',
            }}
            style={styles.googlePayLogo}
          />
          <Text style={styles.payText}>Google Pay</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#ccc"
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.scheduleBtn} onPress={handleSchedule}>
          <Ionicons name="calendar-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.scheduleText}>Schedule Pickup</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Matching popup overlay */}
      <MatchingDriverModal visible={modalVisible} onCancel={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  map: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  summaryBox: {
    backgroundColor: '#141426',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1F1F2F',
    borderRadius: 10,
    marginBottom: 20,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
  },
  price: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  googlePayLogo: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  payText: {
    color: '#fff',
    fontSize: 14,
  },
  scheduleBtn: {
    backgroundColor: '#a77bff',
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  scheduleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
