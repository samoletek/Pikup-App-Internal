import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HelpOptionsModal from './HelpOptionsModal';

export default function RouteConfirmationScreen({ route, navigation }) {
  const { pickup, dropoff } = route.params || {};
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Furniture');
  const [helpNeeded, setHelpNeeded] = useState('yes');
  const [modalVisible, setModalVisible] = useState(false);

  const categories = ['Furniture', 'Appliance', 'Electronic', 'Fragile'];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image
            source={{ uri: 'https://via.placeholder.com/400x140.png?text=Route+Map' }}
            style={styles.mapImage}
          />

          <Text style={styles.sectionHeader}>Summary Details</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Pickup From</Text>
            <Text style={styles.address}>{pickup}</Text>
            <Text style={styles.label}>Drop At</Text>
            <Text style={styles.address}>{dropoff}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>Estimated Arrival: <Text style={styles.bold}>15 mins</Text></Text>
              <Text style={styles.meta}>Available Helpers: <Text style={styles.bold}>5</Text></Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.pill, category === item && styles.activePill]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.pillText, category === item && styles.activePillText]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Describe your items</Text>
            <TextInput
              multiline
              textAlignVertical="top"
              placeholder="Add details here..."
              placeholderTextColor="#aaa"
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
            />
            <Text style={styles.charCount}>{description.length} / 200 char.</Text>

            <Text style={[styles.label, { marginTop: 20 }]}>Do you need help with loading/unloading?</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, helpNeeded === 'yes' && styles.activeToggle]}
                onPress={() => {
                  setHelpNeeded('yes');
                  setModalVisible(true);
                }}
              >
                <Text style={helpNeeded === 'yes' ? styles.activeToggleText : styles.toggleText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, helpNeeded === 'no' && styles.activeToggle]}
                onPress={() => setHelpNeeded('no')}
              >
                <Text style={helpNeeded === 'no' ? styles.activeToggleText : styles.toggleText}>No</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.checkboxRow}>
              <Ionicons name="checkmark-circle" size={20} color="#A77BFF" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff' }}>Driver Assistance Requested</Text>
            </View>

            <Text style={styles.label}>Add Photos</Text>
            <View style={styles.uploadBox}>
              <Ionicons name="camera-outline" size={32} color="#bbb" />
              <Text style={styles.uploadText}>Add photos of your items</Text>
            </View>
            <TouchableOpacity style={styles.uploadBtn}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload Photos</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={() => navigation.navigate('VehicleSelectionScreen')}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>

          <HelpOptionsModal visible={modalVisible} onClose={() => setModalVisible(false)} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0A0A1F', padding: 20 },
  mapImage: { width: '100%', height: 140, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  sectionHeader: { color: '#fff', fontSize: 18, fontWeight: '600', marginVertical: 12 },
  card: {
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    marginBottom: 20,
  },
  label: { color: '#ccc', marginBottom: 6 },
  address: { color: '#fff', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: '#bbb', fontSize: 13 },
  bold: { fontWeight: 'bold', color: '#fff' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#2A2A3B',
    borderRadius: 20,
  },
  activePill: { backgroundColor: '#A77BFF' },
  pillText: { color: '#ccc', fontSize: 13 },
  activePillText: { color: '#fff' },
  textArea: {
    backgroundColor: '#1E1E2D',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    height: 100,
  },
  charCount: { color: '#888', fontSize: 12, textAlign: 'right', marginTop: 4 },
  toggleRow: { flexDirection: 'row', marginVertical: 10, gap: 10 },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#1F1F2F',
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeToggle: { backgroundColor: '#7A45FF' },
  toggleText: { color: '#ccc' },
  activeToggleText: { color: '#fff', fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#444',
    borderRadius: 10,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadText: { color: '#bbb', fontSize: 13, marginTop: 6 },
  uploadBtn: {
    backgroundColor: '#7A45FF',
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  uploadBtnText: { color: '#fff', fontWeight: '600' },
  nextBtn: {
    backgroundColor: '#7A45FF',
    borderRadius: 30,
    paddingVertical: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
