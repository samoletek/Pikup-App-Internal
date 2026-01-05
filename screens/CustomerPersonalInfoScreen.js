import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

export default function CustomerPersonalInfoScreen({ navigation }) {
  const { currentUser, profileImage, uploadProfileImage, getProfileImage, deleteProfileImage, getUserProfile, updateUserProfile } = useAuth();
  
  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    email: currentUser?.email || "user@example.com",
    phone: "+1 (555) 123-4567",
    dateOfBirth: "01/15/1990",
    address: "123 Main Street, Apt 4B",
    city: "New York",
    state: "NY",
    zipCode: "10001",
  });

  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareRideInfo: true,
    marketingEmails: false,
    dataCollection: true,
  });

  const [saving, setSaving] = useState(false);
  
  const toTitle = s => s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // Load profile image and user data when component mounts
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        await getProfileImage();
        // fetch user profile to prefill names
        const profile = await getUserProfile(currentUser?.uid);
        if (profile) {
          setPersonalInfo(prev => ({
            ...prev,
            firstName: profile.firstName || prev.firstName || "",
            lastName:  profile.lastName  || prev.lastName  || "",
            email:     profile.email     || prev.email     || currentUser?.email || ""
          }));
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    };

    loadProfileData();
  }, []);

  const toggleSwitch = (setting) => {
    setPrivacySettings({
      ...privacySettings,
      [setting]: !privacySettings[setting],
    });
  };

  const handleSave = async () => {
    try {
      if (saving) return;
      setSaving(true);
      const f = toTitle((personalInfo.firstName || "").trim());
      const l = toTitle((personalInfo.lastName || "").trim());
      if (f.length < 2 || l.length < 2) {
        Alert.alert("Error", "Please enter your first and last name (min 2 characters).");
        setSaving(false);
        return;
      }
      const name = `${f} ${l}`;
      await updateUserProfile({ firstName: f, lastName: l, name });
      // Reflect immediately in local UI (even if context isn't updated)
      setPersonalInfo(p => ({ ...p, firstName: f, lastName: l }));
      await getUserProfile(currentUser.uid); // optional: refresh any cached context
      Alert.alert("Success", "Your personal information has been updated successfully.", [{ text: "OK" }]);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePhotoPress = () => {
    // Show Android alert with profile picture options
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Remove Photo', onPress: removePhoto, style: 'destructive' },
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        await uploadProfileImage(result.assets[0].uri);
        Alert.alert('Success', 'Profile picture updated successfully!');
      } catch (error) {
        Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        await uploadProfileImage(result.assets[0].uri);
        Alert.alert('Success', 'Profile picture updated successfully!');
      } catch (error) {
        Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
      }
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfileImage();
              Alert.alert('Success', 'Profile picture removed successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
            }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Information</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.profilePhotoContainer} onPress={handleProfilePhotoPress}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profilePhotoImage} />
            ) : (
              <Text style={styles.profilePhotoText}>
                {personalInfo.firstName.charAt(0)}
                {personalInfo.lastName.charAt(0)}
              </Text>
            )}
            <View style={styles.editIconOverlay}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.firstName}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, firstName: text })
              }
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.lastName}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, lastName: text })
              }
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.email}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, email: text })
              }
              keyboardType="email-address"
              placeholderTextColor="#666"
              editable={false}
            />
            <Text style={styles.inputNote}>Email cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.phone}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, phone: text })
              }
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.dateOfBirth}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, dateOfBirth: text })
              }
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Street Address</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.address}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, address: text })
              }
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.city}
              onChangeText={(text) =>
                setPersonalInfo({ ...personalInfo, city: text })
              }
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 0.45 }]}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.textInput}
                value={personalInfo.state}
                onChangeText={(text) =>
                  setPersonalInfo({ ...personalInfo, state: text })
                }
                placeholderTextColor="#666"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 0.45 }]}>
              <Text style={styles.inputLabel}>ZIP Code</Text>
              <TextInput
                style={styles.textInput}
                value={personalInfo.zipCode}
                onChangeText={(text) =>
                  setPersonalInfo({ ...personalInfo, zipCode: text })
                }
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
            </View>
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Share Location</Text>
              <Text style={styles.settingDescription}>
                Allow app to access your location while using the service
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={privacySettings.shareLocation ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("shareLocation")}
              value={privacySettings.shareLocation}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Share Ride Information</Text>
              <Text style={styles.settingDescription}>
                Allow sharing your ride status with friends and family
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={privacySettings.shareRideInfo ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("shareRideInfo")}
              value={privacySettings.shareRideInfo}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Marketing Emails</Text>
              <Text style={styles.settingDescription}>
                Receive promotional emails and offers
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={privacySettings.marketingEmails ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("marketingEmails")}
              value={privacySettings.marketingEmails}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Data Collection</Text>
              <Text style={styles.settingDescription}>
                Allow collection of usage data to improve services
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={privacySettings.dataCollection ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("dataCollection")}
              value={privacySettings.dataCollection}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#A77BFF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Download My Data</Text>
            <Ionicons name="chevron-forward" size={20} color="#A77BFF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
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
    backgroundColor: "#0A0A1F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#141426",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2A1F3D",
  },
  saveButtonText: {
    color: "#A77BFF",
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  photoSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  profilePhotoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2A1F3D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profilePhotoText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#A77BFF",
  },
  profilePhotoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#A77BFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0A0A1F',
  },
  photoHint: {
    color: "#999",
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#999",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3B",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#fff",
  },
  inputNote: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: "#999",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  deleteButton: {
    paddingVertical: 16,
    marginTop: 16,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ff4444",
  },
  bottomSpacing: {
    height: 40,
  },
}); 