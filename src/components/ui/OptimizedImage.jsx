// src/components/ui/OptimizedImage.jsx
// Drop-in <img> replacement with lazy loading, srcset, and error handling.
// Falls back to the original (non-transformed) URL if Supabase render fails.
import { useState, useCallback } from 'react';
import { optimizeImage, originalImageUrl, disableImageTransforms } from '../../lib/utils';

/**
 * Generates a srcset string for Supabase Storage images at 1x, 2x, and 3x.
 */
function buildSrcSet(url, baseWidth) {
  if (!url || !baseWidth || !url.includes('/storage/v1/')) return undefined;
  return [1, 2, 3]
    .map(scale => {
      const w = Math.round(baseWidth * scale);
      return `${optimizeImage(url, { width: w })} ${scale}x`;
    })
    .join(', ');
}

/**
 * OptimizedImage — wraps <img> with:
 *  - loading="lazy" (overridable with priority prop)
 *  - decoding="async"
 *  - srcset for 1x/2x/3x density
 *  - Fallback to original URL on error (handles missing Pro plan for transforms)
 *  - Supabase image transform via optimizeImage
 *
 * @param {Object} props
 * @param {string} props.src - Original image URL
 * @param {string} props.alt - Alt text
 * @param {number} [props.width] - Display width (also used for srcset generation)
 * @param {number} [props.height] - Display height
 * @param {boolean} [props.priority] - If true, sets loading="eager" and fetchpriority="high"
 * @param {number} [props.quality] - Supabase quality (default 70)
 * @param {string} [props.className]
 * @param {Object} [props.style]
 */
export default function OptimizedImage({
  src,
  alt = '',
  width,
  height,
  priority = false,
  quality = 70,
  className,
  style,
  ...rest
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleError = useCallback((e) => {
    if (!useFallback) {
      // First error: the render/image URL failed → try original URL
      const orig = originalImageUrl(e.target.src) || src;
      if (orig !== e.target.src) {
        // Disable transforms globally so future images don't even try
        disableImageTransforms();
        setUseFallback(true);
        return;
      }
    }
    // Second error (or non-supabase URL): hide the image
    setHidden(true);
  }, [useFallback, src]);

  if (!src || hidden) return null;

  const currentSrc = useFallback ? src : optimizeImage(src, { width, quality });
  const srcSet = (!useFallback && width) ? buildSrcSet(src, width) : undefined;

  return (
    <img
      src={currentSrc}
      srcSet={srcSet}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={priority ? 'high' : undefined}
      className={className}
      style={style}
      onError={handleError}
      {...rest}
    />
  );
}
