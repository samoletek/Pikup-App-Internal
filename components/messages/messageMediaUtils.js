const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)(\?|#|$)/i;
const VIDEO_URL_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;

export const getMessageMediaType = (message) => {
  const normalizedType = String(message?.messageType || "").toLowerCase();
  if (normalizedType === "image" || normalizedType === "video") {
    return normalizedType;
  }

  const content = String(message?.content || "").trim();
  if (!/^https?:\/\//i.test(content)) {
    return null;
  }

  if (VIDEO_URL_PATTERN.test(content)) {
    return "video";
  }

  if (content.includes("/chat-attachments/") || IMAGE_URL_PATTERN.test(content)) {
    return "image";
  }

  return null;
};
