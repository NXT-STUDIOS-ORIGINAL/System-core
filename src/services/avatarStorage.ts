/**
 * Client-Side Profile Picture Storage & Image Compression Service
 * 
 * Provides isolated, persistent browser storage for user avatars.
 * Ensures images are resized and compressed before storage to guarantee
 * fast loading and low storage footprint, completely decoupled from RPG Player State.
 */

const AVATAR_STORAGE_KEY = 'system_core_profile_avatar';
const MAX_DIMENSION = 384; // 384x384 px offers sharp high-DPI rendering under ~30-40KB
const COMPRESSION_QUALITY = 0.85;

export interface ImageProcessingOptions {
  maxDimension?: number;
  quality?: number;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Retrieve saved profile avatar Data URL from isolated storage
 */
export function getSavedAvatar(): string | null {
  try {
    const saved = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (saved && saved.startsWith('data:image/')) {
      return saved;
    }
    return null;
  } catch (err) {
    console.warn('[AvatarStorage] Failed to read avatar from localStorage:', err);
    return null;
  }
}

/**
 * Save profile avatar Data URL to isolated storage
 */
export function saveAvatarToStorage(dataUrl: string): boolean {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
    return true;
  } catch (err) {
    console.error('[AvatarStorage] Failed to save avatar to localStorage:', err);
    return false;
  }
}

/**
 * Remove saved profile avatar from storage
 */
export function removeAvatarFromStorage(): boolean {
  try {
    localStorage.removeItem(AVATAR_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('[AvatarStorage] Failed to remove avatar from localStorage:', err);
    return false;
  }
}

/**
 * Check if a custom avatar is currently stored
 */
export function hasCustomAvatar(): boolean {
  return !!getSavedAvatar();
}

/**
 * Process, crop, and compress an Image or File using HTML5 Canvas
 */
export async function processAndCompressImage(
  imageSource: File | HTMLImageElement | string,
  options: ImageProcessingOptions = {}
): Promise<string> {
  const maxDim = options.maxDimension || MAX_DIMENSION;
  const quality = options.quality || COMPRESSION_QUALITY;
  const zoom = Math.max(1, options.zoom || 1);
  const offsetX = options.offsetX || 0;
  const offsetY = options.offsetY || 0;

  let img: HTMLImageElement;

  if (typeof imageSource === 'string') {
    img = await loadImageFromUrl(imageSource);
  } else if (imageSource instanceof File) {
    const dataUrl = await readFileAsDataUrl(imageSource);
    img = await loadImageFromUrl(dataUrl);
  } else {
    img = imageSource;
  }

  const canvas = document.createElement('canvas');
  canvas.width = maxDim;
  canvas.height = maxDim;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create canvas context for image processing');
  }

  // Determine square crop dimensions with aspect ratio preservation
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  if (!srcWidth || !srcHeight) {
    throw new Error('Invalid image dimensions');
  }

  // Base square crop
  const minDimension = Math.min(srcWidth, srcHeight);
  const cropSize = minDimension / zoom;

  // Center crop with user offset applied
  const baseCropX = (srcWidth - cropSize) / 2;
  const baseCropY = (srcHeight - cropSize) / 2;

  // Clamping crop coordinates
  const maxShiftX = (srcWidth - cropSize) / 2;
  const maxShiftY = (srcHeight - cropSize) / 2;

  const cropX = Math.max(0, Math.min(srcWidth - cropSize, baseCropX + offsetX * maxShiftX));
  const cropY = Math.max(0, Math.min(srcHeight - cropSize, baseCropY + offsetY * maxShiftY));

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw square crop onto canvas
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    maxDim,
    maxDim
  );

  // Try WebP first for optimal compression, fallback to JPEG
  try {
    const webpData = canvas.toDataURL('image/webp', quality);
    if (webpData && webpData.startsWith('data:image/webp')) {
      return webpData;
    }
  } catch {
    // Fallback to JPEG
  }

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Helper to read a File as Data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Helper to load HTMLImageElement from URL
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from source'));
    img.src = url;
  });
}
