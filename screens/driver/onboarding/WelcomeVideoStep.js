import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../styles/theme";

const WelcomeVideoStep = ({
  styles,
  videoRef,
  toggleVideoPlayback,
  handleVideoPlaybackStatus,
  isVideoPlaying,
  videoWatched,
}) => {
  return (
    <View style={styles.welcomeContent}>
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={0.9}
        onPress={toggleVideoPlayback}
      >
        <Video
          ref={videoRef}
          source={require("../../../assets/videos/pikup-order-v2.mp4")}
          style={styles.video}
          resizeMode="contain"
          shouldPlay={false}
          isLooping={false}
          onPlaybackStatusUpdate={handleVideoPlaybackStatus}
        />
        {!isVideoPlaying && (
          <View style={styles.videoOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color={colors.white} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {videoWatched && (
        <View style={styles.videoWatchedBadge}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.videoWatchedText}>Video watched — you can continue</Text>
        </View>
      )}

      <View style={styles.benefitsList}>
        <View style={styles.benefitItem}>
          <Ionicons name="cash-outline" size={20} color={colors.success} />
          <Text style={styles.benefitText}>Earn up to $25/hour</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="time-outline" size={20} color={colors.success} />
          <Text style={styles.benefitText}>Flexible schedule</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="card-outline" size={20} color={colors.success} />
          <Text style={styles.benefitText}>Weekly payouts</Text>
        </View>
      </View>
    </View>
  );
};

export default WelcomeVideoStep;
