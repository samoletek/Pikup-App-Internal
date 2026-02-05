// Placeholder screen - Coming Soon
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function CustomerSafetyScreen({ navigation }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Safety</Text>
                <View style={{ width: 24 }} />
            </View>
            <View style={styles.content}>
                <Ionicons name="construct-outline" size={64} color="#A77BFF" />
                <Text style={styles.title}>Coming Soon</Text>
                <Text style={styles.subtitle}>This feature is under development</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1F' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: '#141426',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A3B',
    },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 20 },
    subtitle: { fontSize: 16, color: '#888', marginTop: 8 },
});
