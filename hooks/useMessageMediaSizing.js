import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import { getMessageMediaType } from "../components/messages/messageMediaUtils";

const DEFAULT_IMAGE_ASPECT_RATIO = 4 / 3;
const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const MIN_MEDIA_ASPECT_RATIO = 0.45;
const MAX_MEDIA_ASPECT_RATIO = 2.2;

export default function useMessageMediaSizing({
  messages,
  mediaMaxWidth,
  mediaMaxHeight,
}) {
  const [mediaNaturalSizeById, setMediaNaturalSizeById] = useState({});
  const mediaSizeProbeInFlightRef = useRef(new Set());

  const saveMediaNaturalSize = useCallback((messageId, loadedWidth, loadedHeight) => {
    const parsedWidth = Number(loadedWidth || 0);
    const parsedHeight = Number(loadedHeight || 0);

    if (!parsedWidth || !parsedHeight) {
      return;
    }

    const mediaKey = String(messageId);
    setMediaNaturalSizeById((prevSizes) => {
      const existingSize = prevSizes[mediaKey];
      if (
        existingSize?.width === parsedWidth &&
        existingSize?.height === parsedHeight
      ) {
        return prevSizes;
      }

      return {
        ...prevSizes,
        [mediaKey]: { width: parsedWidth, height: parsedHeight },
      };
    });
  }, []);

  const handleImageLoad = useCallback(
    (messageId, event) => {
      const source = event?.nativeEvent?.source;
      saveMediaNaturalSize(messageId, source?.width, source?.height);
    },
    [saveMediaNaturalSize]
  );

  const handleVideoReady = useCallback(
    (messageId, event) => {
      const naturalSize = event?.naturalSize || event?.nativeEvent?.naturalSize;
      saveMediaNaturalSize(messageId, naturalSize?.width, naturalSize?.height);
    },
    [saveMediaNaturalSize]
  );

  const probeMediaSize = useCallback(
    (messageId, uri) => {
      if (typeof uri !== "string" || !uri) {
        return;
      }

      const mediaKey = String(messageId);
      if (
        mediaNaturalSizeById[mediaKey] ||
        mediaSizeProbeInFlightRef.current.has(mediaKey)
      ) {
        return;
      }

      mediaSizeProbeInFlightRef.current.add(mediaKey);
      Image.getSize(
        uri,
        (loadedWidth, loadedHeight) => {
          mediaSizeProbeInFlightRef.current.delete(mediaKey);
          if (!loadedWidth || !loadedHeight) {
            return;
          }

          saveMediaNaturalSize(mediaKey, loadedWidth, loadedHeight);
        },
        () => {
          mediaSizeProbeInFlightRef.current.delete(mediaKey);
        }
      );
    },
    [mediaNaturalSizeById, saveMediaNaturalSize]
  );

  const getMediaDisplaySize = useCallback(
    (messageId, mediaType) => {
      const naturalSize = mediaNaturalSizeById[String(messageId)];
      const hasNaturalSize = !!naturalSize?.width && !!naturalSize?.height;
      const defaultAspectRatio =
        mediaType === "video" ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO;
      const rawAspectRatio = hasNaturalSize
        ? naturalSize.width / naturalSize.height
        : defaultAspectRatio;

      const aspectRatio = Math.min(
        MAX_MEDIA_ASPECT_RATIO,
        Math.max(MIN_MEDIA_ASPECT_RATIO, rawAspectRatio)
      );

      let widthCandidate = mediaMaxWidth;
      let heightCandidate = Math.round(widthCandidate / aspectRatio);
      if (heightCandidate > mediaMaxHeight) {
        heightCandidate = mediaMaxHeight;
        widthCandidate = Math.round(heightCandidate * aspectRatio);
      }

      return {
        width: Math.max(widthCandidate, 1),
        height: Math.max(heightCandidate, 1),
      };
    },
    [mediaMaxHeight, mediaMaxWidth, mediaNaturalSizeById]
  );

  useEffect(() => {
    setMediaNaturalSizeById((prevSizes) => {
      const activeIds = new Set(messages.map((message) => String(message.id)));
      let hasRemovedItems = false;
      const nextSizes = {};

      mediaSizeProbeInFlightRef.current.forEach((mediaId) => {
        if (!activeIds.has(mediaId)) {
          mediaSizeProbeInFlightRef.current.delete(mediaId);
        }
      });

      Object.entries(prevSizes).forEach(([mediaId, size]) => {
        if (activeIds.has(mediaId)) {
          nextSizes[mediaId] = size;
        } else {
          hasRemovedItems = true;
        }
      });

      return hasRemovedItems ? nextSizes : prevSizes;
    });
  }, [messages]);

  useEffect(() => {
    messages.forEach((message) => {
      const mediaType = getMessageMediaType(message);
      if (mediaType === "image") {
        probeMediaSize(message.id, String(message.content || ""));
      }
    });
  }, [messages, probeMediaSize]);

  return {
    getMediaDisplaySize,
    handleImageLoad,
    handleVideoReady,
    saveMediaNaturalSize,
  };
}
