const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_DURATION_SEC = 180; // 3 minutes
const ALLOWED_TYPES = ["video/mp4", "video/webm"];

export type VideoValidationResult =
  | { valid: true; duration: number }
  | { valid: false; error: string };

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("動画ファイルを読み込めませんでした"));
    };
    video.src = url;
  });
}

export async function validateVideo(file: File): Promise<VideoValidationResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "MP4またはWebM形式の動画のみ対応しています" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `動画は${MAX_SIZE_MB}MB以下にしてください` };
  }

  try {
    const duration = await getVideoDuration(file);
    if (duration > MAX_DURATION_SEC) {
      return { valid: false, error: `動画は${MAX_DURATION_SEC / 60}分以内にしてください` };
    }
    return { valid: true, duration };
  } catch {
    return { valid: false, error: "動画ファイルを読み込めませんでした" };
  }
}
