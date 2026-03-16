import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_VIDEO_WATCHED_KEY } from '../DriverOnboardingScreen.constants';

export default function useOnboardingVideoState({ userId, videoRef }) {
  const [videoWatched, setVideoWatched] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }

    AsyncStorage.getItem(`${ONBOARDING_VIDEO_WATCHED_KEY}:${userId}`)
      .then((value) => {
        if (value === 'true') {
          setVideoWatched(true);
        }
      })
      .catch(() => {});
  }, [userId]);

  const handleVideoPlaybackStatus = async (status) => {
    if (status.isPlaying !== undefined) {
      setIsVideoPlaying(status.isPlaying);
    }

    if (!status.didJustFinish) {
      return;
    }

    setVideoWatched(true);
    try {
      await AsyncStorage.setItem(`${ONBOARDING_VIDEO_WATCHED_KEY}:${userId}`, 'true');
    } catch (_error) {
      // No-op: local preference persistence failure should not block onboarding.
    }
  };

  const toggleVideoPlayback = async () => {
    if (!videoRef.current) {
      return;
    }

    const status = await videoRef.current.getStatusAsync();
    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
      return;
    }

    if (status.didJustFinish || status.positionMillis === status.durationMillis) {
      await videoRef.current.replayAsync();
      return;
    }

    await videoRef.current.playAsync();
  };

  return {
    videoWatched,
    isVideoPlaying,
    handleVideoPlaybackStatus,
    toggleVideoPlayback,
    setVideoWatched,
  };
}
