import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AIImageService from "../services/AIImageService";

const { height } = Dimensions.get("window");

const SummaryDetailsModal = ({
  visible,
  onClose,
  onNext,
  selectedLocations,
  isUploadingPhotos = false,
}) => {
  // Form states
  const [itemDescription, setItemDescription] = useState("");
  const [itemValue, setItemValue] = useState("500");
  const [needsHelp, setNeedsHelp] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [photos, setPhotos] = useState([]);

  // AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [analysisResults, setAnalysisResults] = useState([]);

  // Animation
  const [slideAnim] = useState(new Animated.Value(height));
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: height,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: height,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      // Reset form when closing
      setItemDescription("");
      setNeedsHelp(false);
      setSpecialInstructions("");
      setPhotos([]);
      setAiSuggestions(null);
      setAnalysisResults([]);
      onClose();
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission",
        "We need camera permission to analyze your items.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => ImagePicker.requestCameraPermissionsAsync(),
          },
        ]
      );
      return false;
    }
    return true;
  };

  // Enhanced function to extract people count from AI description
  const extractPeopleNeeded = (description) => {
    if (!description) return 1;

    const desc = description.toLowerCase();

    // Try the specific format we're asking for: "X people needed"
    let peopleMatch = desc.match(/(\d+)\s*people\s*needed/i);

    // Fallback patterns
    if (!peopleMatch) {
      const patterns = [
        /(\d+)\s*(?:person|people)\s*(?:required|recommended)/i,
        /(?:requires?|needs?)\s+(\d+)\s*(?:person|people)/i,
        /(\d+)\s*(?:person|people)/i,
      ];

      for (const pattern of patterns) {
        peopleMatch = desc.match(pattern);
        if (peopleMatch) break;
      }
    }

    if (peopleMatch) {
      const count = parseInt(peopleMatch[1]);
      if (count > 0 && count <= 10) {
        // Reasonable range
        return count;
      }
    }

    return 1;
  };

  const analyzeImageWithAI = async (imageData) => {
    setIsAnalyzing(true);
    try {
      console.log("🖼️ Starting AI analysis for image...");
      
      // Use the AI service to analyze the image
      const analysis = await AIImageService.analyzeImage(imageData, "gemini");

      // Extract people count using our enhanced function
      const peopleNeeded = extractPeopleNeeded(analysis.description);

      // Extract insights from the analysis
      const insights = {
        description: analysis.description,
        confidence: analysis.confidence,
        provider: analysis.provider,
        categories: AIImageService.generateCategories(analysis.description),
        helpRequirements: {
          helpNeeded: peopleNeeded > 1,
          peopleNeeded: peopleNeeded,
          reason:
            peopleNeeded > 1
              ? `${peopleNeeded} people recommended for safe handling`
              : "Single person can handle",
        },
        tokens_used: analysis.tokens_used,
        structuredData: analysis.structuredData,
      };

      console.log("✅ AI analysis completed successfully");
      return insights;
    } catch (error) {
      console.error("❌ AI analysis failed:", error.message);
      
      // Show more specific error messages based on error type
      let errorTitle = "Analysis Failed";
      let errorMessage = "Could not analyze the image. You can still add it manually.";
      
      if (error.message.includes("API key")) {
        errorTitle = "API Configuration Error";
        errorMessage = "Gemini API key is not configured. Please contact support or add items manually.";
      } else if (error.message.includes("Rate limit")) {
        errorTitle = "Rate Limit Exceeded";
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error.message.includes("Invalid")) {
        errorTitle = "Invalid API Key";
        errorMessage = "The API key is invalid. Please contact support or add items manually.";
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        errorTitle = "Network Error";
        errorMessage = "Please check your internet connection and try again.";
      }
      
      Alert.alert(errorTitle, errorMessage, [{ text: "OK" }]);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Required for AI analysis
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processNewPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const selectFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant access to your photo library."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Required for AI analysis
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processNewPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Error selecting photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const processNewPhoto = async (asset) => {
    const photoData = {
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    // Add photo to list immediately
    setPhotos((prev) => [...prev, { ...photoData, analyzing: true }]);

    // Scroll to show new photo
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Analyze with AI
    const analysis = await analyzeImageWithAI(photoData);

    // Update photo with analysis results
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoData.id
          ? { ...photo, analyzing: false, analysis }
          : photo
      )
    );

    // Store analysis result
    if (analysis) {
      setAnalysisResults((prev) => {
        const newAnalyses = [...prev, analysis];

        // Update description with ALL analyses including the new one
        const allItemDescriptions = newAnalyses.map((a) =>
          extractItemDescription(a.description)
        );

        // Calculate max people needed across ALL items using our enhanced extraction
        const maxPeopleNeeded = Math.max(
          ...newAnalyses.map((a) => a.helpRequirements.peopleNeeded || 1)
        );

        // Format: "item1, item2, item3 - X people needed"
        const itemsList = allItemDescriptions.join(", ");
        const fullDescription = `${itemsList} - ${maxPeopleNeeded} person${
          maxPeopleNeeded > 1 ? "s" : ""
        } needed`;

        setItemDescription(fullDescription);

        return newAnalyses;
      });

      // Auto-set help requirement based on analysis
      const helpNeeded = analysis.helpRequirements.helpNeeded;

      if (helpNeeded) {
        setNeedsHelp(true);
      }

      // Update AI suggestions
      updateAISuggestions([...analysisResults, analysis]);
    }
  };

  const updateAISuggestions = (analyses) => {
    if (analyses.length === 0) return;

    // Generate comprehensive suggestions
    const categories = new Set();
    let needsHelpVotes = 0;
    let totalConfidence = 0;

    analyses.forEach((analysis) => {
      analysis.categories.forEach((cat) => categories.add(cat));
      if (analysis.helpRequirements.helpNeeded) needsHelpVotes++;
      totalConfidence += analysis.confidence === "high" ? 1 : 0.5;
    });

    // Build description for all items with single people count
    const allItemDescriptions = analyses.map((a) =>
      extractItemDescription(a.description)
    );

    // Calculate max people needed across all items
    const maxPeopleNeeded = Math.max(
      ...analyses.map((a) => a.helpRequirements.peopleNeeded || 1)
    );

    // Format: "item1, item2, item3 - X people needed"
    const itemsList = allItemDescriptions.join(", ");
    const fullDescription = `${itemsList} - ${maxPeopleNeeded} person${
      maxPeopleNeeded > 1 ? "s" : ""
    } needed`;

    const suggestions = {
      description: fullDescription,
      categories: Array.from(categories),
      needsHelp: needsHelpVotes > analyses.length / 2,
      confidence: totalConfidence / analyses.length,
      itemCount: analyses.length,
      helpReason: analyses.find((a) => a.helpRequirements.helpNeeded)
        ?.helpRequirements.reason,
    };

    setAiSuggestions(suggestions);
  };

  const extractItemDescription = (aiDescription) => {
    // Since the AI now returns the exact format we want, just clean it up a bit
    if (!aiDescription) return "Item";

    // The AI should return: "Item name, approximately X lbs, Y people needed"
    // We want to extract just the item name and weight for the description
    const parts = aiDescription.split(",");
    if (parts.length >= 2) {
      const itemName = parts[0].trim();
      const weightPart = parts[1].trim();
      return `${itemName} (${weightPart})`;
    }

    // Fallback - return the first part or the whole description
    return parts[0]?.trim() || aiDescription;
  };

  const removePhoto = (photoId) => {
    Alert.alert("Remove Photo", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          // Find the photo being removed and its analysis
          const photoToRemove = photos.find((photo) => photo.id === photoId);
          const photoIndex = photos.findIndex((photo) => photo.id === photoId);

          // Remove the photo
          setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));

          // If this photo had analysis, remove its description from the text
          if (photoToRemove?.analysis) {
            // Remove corresponding analysis result first
            const updatedAnalyses = analysisResults.filter(
              (_, index) => index !== photoIndex
            );
            setAnalysisResults(updatedAnalyses);

            setItemDescription((currentDesc) => {
              if (updatedAnalyses.length === 0) {
                // No more items, clear description
                return "";
              }

              // Rebuild description with remaining items and recalculate max people needed
              const remainingItemDescriptions = updatedAnalyses.map((a) =>
                extractItemDescription(a.description)
              );

              // Calculate max people needed across remaining items
              const maxPeopleNeeded = Math.max(
                ...updatedAnalyses.map(
                  (a) => a.helpRequirements.peopleNeeded || 1
                )
              );

              // Format: "item1, item2 - X people needed"
              const itemsList = remainingItemDescriptions.join(", ");
              return `${itemsList} - ${maxPeopleNeeded} person${
                maxPeopleNeeded > 1 ? "s" : ""
              } needed`;
            });

            // Update help requirement - keep true if any remaining analysis needs help
            const stillNeedsHelp = updatedAnalyses.some(
              (analysis) => analysis.helpRequirements?.helpNeeded
            );
            setNeedsHelp(stillNeedsHelp);

            // Update AI suggestions with remaining analyses
            if (updatedAnalyses.length > 0) {
              updateAISuggestions(updatedAnalyses);
            } else {
              setAiSuggestions(null);
            }
          } else {
            // Photo had no analysis, just remove it
            setAnalysisResults((prev) =>
              prev.filter((_, index) => index !== photoIndex)
            );
          }
        },
      },
    ]);
  };

  const showPhotoOptions = () => {
    Alert.alert("Add Photo", "Choose how you want to add a photo", [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: selectFromGallery },
    ]);
  };

  const handleNext = () => {
    if (photos.length < 2) {
      Alert.alert(
        "Photos Required",
        "Please upload at least 2 photos of your items for proper assessment and pricing."
      );
      return;
    }

    if (!itemDescription.trim()) {
      Alert.alert(
        "Required",
        "Please describe your items or add photos for AI analysis."
      );
      return;
    }

    const numericValue = parseFloat(itemValue);
    if (isNaN(numericValue) || numericValue < 50) {
      Alert.alert(
        "Item Value Required",
        "Please enter a valid item value of at least $50 for insurance coverage."
      );
      return;
    }

    const summaryData = {
      itemDescription: itemDescription.trim(),
      itemValue: numericValue,
      needsHelp,
      specialInstructions: specialInstructions.trim(),
      photos,
      aiAnalysis: analysisResults,
      aiSuggestions,
    };

    onNext(summaryData);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Item Details</Text>
            <TouchableOpacity
              onPress={handleNext}
              style={[
                styles.nextButton,
                (photos.length < 2 || !itemDescription.trim() || isUploadingPhotos) && styles.nextButtonDisabled,
              ]}
              disabled={photos.length < 2 || !itemDescription.trim() || isUploadingPhotos}
            >
              {isUploadingPhotos ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.uploadingText}>Uploading Photos...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.nextButtonText,
                    (photos.length < 2 || !itemDescription.trim()) && styles.nextButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Route Summary */}
          {selectedLocations && (
            <View style={styles.routeSummary}>
              <View style={styles.routeInfo}>
                <Ionicons name="location" size={16} color="#A77BFF" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {typeof selectedLocations.pickup === 'string' 
                    ? selectedLocations.pickup 
                    : selectedLocations.pickup?.address || 'Pickup Location'} → {typeof selectedLocations.dropoff === 'string' 
                    ? selectedLocations.dropoff 
                    : selectedLocations.dropoff?.address || 'Dropoff Location'}
                </Text>
              </View>
              {selectedLocations.isScheduled &&
                selectedLocations.scheduledDateTime && (
                  <View style={styles.scheduleInfo}>
                    <Ionicons name="time" size={14} color="#00D4AA" />
                    <Text style={styles.scheduleText}>
                      {selectedLocations.scheduledDateTime.displayText}
                    </Text>
                  </View>
                )}
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <Text style={[
                  styles.photoCount, 
                  photos.length < 2 && styles.photoCountRequired
                ]}>{photos.length}/10 (min 2)</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Add photos for AI analysis and automatic description
              </Text>

              <ScrollView
                horizontal
                style={styles.photoScrollView}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoContainer}
              >
                {/* Add Photo Button */}
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={showPhotoOptions}
                >
                  <Ionicons name="camera" size={32} color="#A77BFF" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                  <Text style={styles.addPhotoSubtext}>AI Analysis</Text>
                </TouchableOpacity>

                {/* Photo Items */}
                {photos.map((photo, index) => (
                  <View key={photo.id} style={styles.photoItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoImage}
                    />

                    {/* Analysis Status Overlay */}
                    {photo.analyzing && (
                      <View style={styles.analysisOverlay}>
                        <ActivityIndicator size="small" color="#A77BFF" />
                        <Text style={styles.analysisText}>Analyzing...</Text>
                      </View>
                    )}

                    {/* Analysis Result Badge */}
                    {photo.analysis && (
                      <View style={styles.analysisBadge}>
                        <Ionicons name="sparkles" size={12} color="#fff" />
                        <Text style={styles.analysisBadgeText}>
                          {photo.analysis.helpRequirements.peopleNeeded}P
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(photo.id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                    </TouchableOpacity>

                    <View style={styles.photoIndex}>
                      <Text style={styles.photoIndexText}>{index + 1}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {photos.length === 0 && (
                <View style={styles.noPhotosContainer}>
                  <Ionicons name="camera-outline" size={48} color="#666" />
                  <Text style={styles.noPhotosText}>No photos yet</Text>
                  <Text style={styles.noPhotosSubtext}>
                    Add photos for AI-powered analysis
                  </Text>
                </View>
              )}
            </View>

            {/* Description Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Item Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={3}
                placeholder="Describe the items you need to move..."
                placeholderTextColor="#666"
                value={itemDescription}
                onChangeText={setItemDescription}
                maxLength={200}
              />
              <Text style={styles.charCount}>{itemDescription.length}/200</Text>
            </View>

            {/* Item Value Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Estimated Item Value <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.valueInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.valueInput}
                  placeholder="500"
                  placeholderTextColor="#666"
                  value={itemValue}
                  onChangeText={(text) => {
                    // Only allow numbers and decimal points
                    const cleanText = text.replace(/[^0-9.]/g, '');
                    // Prevent multiple decimal points
                    const parts = cleanText.split('.');
                    if (parts.length > 2) {
                      return;
                    }
                    setItemValue(cleanText);
                  }}
                  keyboardType="numeric"
                  maxLength={8}
                />
              </View>
              <Text style={styles.valueHint}>
                Used for insurance coverage calculation (minimum $50)
              </Text>
            </View>

            {/* Help Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleHeader}>
                <Text style={styles.toggleLabel}>
                  Need loading/unloading help?
                </Text>
                <TouchableOpacity
                  style={[styles.toggle, needsHelp && styles.toggleActive]}
                  onPress={() => setNeedsHelp(!needsHelp)}
                >
                  <View
                    style={[
                      styles.toggleSlider,
                      needsHelp && styles.toggleSliderActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.toggleDescription}>
                {needsHelp
                  ? "Driver will help load and unload items (additional cost may apply)"
                  : "Driver will transport only - you handle loading/unloading"}
              </Text>
            </View>

            {/* Special Instructions */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Special Instructions (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={2}
                placeholder="Parking instructions, access codes, floor number..."
                placeholderTextColor="#666"
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                maxLength={150}
              />
              <Text style={styles.charCount}>
                {specialInstructions.length}/150
              </Text>
            </View>

            {/* Analysis Status */}
            {isAnalyzing && (
              <View style={styles.analysisStatus}>
                <ActivityIndicator size="small" color="#A77BFF" />
                <Text style={styles.analysisStatusText}>
                  AI is analyzing your photos...
                </Text>
              </View>
            )}

            <View style={styles.bottomSpacing} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0A0A1F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.9,
    maxHeight: height * 0.9,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#666",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#A77BFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nextButtonDisabled: {
    backgroundColor: "#666",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  nextButtonTextDisabled: {
    color: "#999",
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  routeSummary: {
    backgroundColor: "#141426",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  routeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  routeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
  scheduleInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleText: {
    color: "#00D4AA",
    fontSize: 12,
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  photoSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  photoCount: {
    color: "#A77BFF",
    fontSize: 14,
    fontWeight: "600",
  },
  photoCountRequired: {
    color: "#ff4444",
  },
  sectionSubtitle: {
    color: "#999",
    fontSize: 14,
    marginBottom: 16,
  },
  photoScrollView: {
    marginHorizontal: -20,
  },
  photoContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    backgroundColor: "#1A1A3A",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#A77BFF",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoText: {
    color: "#A77BFF",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  addPhotoSubtext: {
    color: "#666",
    fontSize: 10,
    marginTop: 2,
  },
  photoItem: {
    position: "relative",
    width: 120,
    height: 120,
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  analysisOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  analysisText: {
    color: "#fff",
    fontSize: 10,
    marginTop: 4,
  },
  analysisBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#A77BFF",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  analysisBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "600",
  },
  removePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
  },
  photoIndex: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  photoIndexText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  noPhotosContainer: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#141426",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  noPhotosText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
  },
  noPhotosSubtext: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  required: {
    color: "#ff4444",
  },
  textInput: {
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3B",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    textAlignVertical: "top",
  },
  charCount: {
    color: "#666",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  toggleSection: {
    marginBottom: 20,
  },
  toggleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  toggleLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    backgroundColor: "#2A2A3B",
    borderRadius: 15,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#A77BFF",
  },
  toggleSlider: {
    width: 26,
    height: 26,
    backgroundColor: "#666",
    borderRadius: 13,
    alignSelf: "flex-start",
  },
  toggleSliderActive: {
    backgroundColor: "#fff",
    alignSelf: "flex-end",
  },
  toggleDescription: {
    color: "#999",
    fontSize: 14,
    lineHeight: 18,
  },
  analysisStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141426",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  analysisStatusText: {
    color: "#A77BFF",
    fontSize: 14,
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
  valueInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141426",
    borderWidth: 1,
    borderColor: "#2A2A3B",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    color: "#A77BFF",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  valueInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 12,
  },
  valueHint: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
});

export default SummaryDetailsModal;
