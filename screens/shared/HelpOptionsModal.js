import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

export default function HelpOptionsModal({ visible, onClose }) {
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalBox}>
              <Text style={styles.header}>Loading or Unloading Help?</Text>
              <Text style={styles.description}>
                If the helper is handling the task alone, it may take longer and could result in additional charges.
              </Text>

              <TouchableOpacity style={styles.optionBtn} onPress={onClose}>
                <Text style={styles.optionText}>Drive Only (no extra charge)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.fullBtn} onPress={onClose}>
                <Text style={styles.fullBtnText}>Full Assistance (additional charge)</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#131328',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  header: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionBtn: {
    backgroundColor: '#23233C',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  fullBtn: {
    backgroundColor: '#A77BFF',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  fullBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
