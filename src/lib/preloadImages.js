// src/lib/preloadImages.js
// Preloads critical above-the-fold images via <link rel="preload">.
import { optimizeImage } from './utils';

/**
 * Preload an array of image URLs by injecting <link rel="preload"> tags.
 * Call once after catalog data loads to preload hero and first products.
 *
 * @param {string[]} urls - Image URLs to preload
 * @param {number} [width=300] - Target width for optimized URL
 */
export function preloadImages(urls, width = 300) {
  if (typeof document === 'undefined') return;

  const head = document.head;
  const fragment = document.createDocumentFragment();

  urls.filter(Boolean).slice(0, 6).forEach((url) => {
    const optimized = optimizeImage(url, { width, quality: 70 });
    // Avoid duplicate preloads
    if (head.querySelector(`link[href="${optimized}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = optimized;
    fragment.appendChild(link);
  });

  head.appendChild(fragment);
}
