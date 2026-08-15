/**
 * Client-Side Image Compressor using HTML5 Canvas.
 * Compresses large camera photos (e.g. 5MB+) down to ~100-200KB before uploading.
 * 100% browser native with 0 third-party packages.
 */

export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.75,
    outputType = 'image/jpeg',
  } = options;

  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  // If GIF or SVG, don't compress to preserve animations / vector
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down proportionally if larger than maximum bounds
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const compressedName = file.name.replace(/\.[^/.]+$/, '.jpg');
          const compressedFile = new File([blob], compressedName, {
            type: outputType,
            lastModified: Date.now(),
          });

          // If compressed is somehow larger than original, return original
          if (compressedFile.size > file.size) {
            resolve(file);
          } else {
            resolve(compressedFile);
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
};
