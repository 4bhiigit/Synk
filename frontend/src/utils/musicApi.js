/**
 * Free Public Music Search & Streaming Utility.
 * Fetches high-quality metadata, artwork, and direct audio stream URLs
 * using resilient multi-tier open public endpoints (JioSaavn API mirrors + iTunes API fallback).
 */

const SAAVN_PRIMARY_MIRRORS = [
  'https://saavn-api-alpha.vercel.app/api/search/songs',
  'https://saavn.me/api/search/songs',
  'https://jiosaavn-api-private-six.vercel.app/api/search/songs',
];

const ITUNES_API_URL = 'https://itunes.apple.com/search';

/**
 * Searches songs by title, artist, movie name, or lyrics keywords.
 * @param {string} query Search keywords
 * @param {number} limit Maximum results to return
 * @returns {Promise<Array>} List of standardized song objects
 */
export async function searchMusic(query, limit = 15) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();

  // 1. Try JioSaavn Open API mirrors first (Full 320kbps/160kbps songs)
  for (const mirrorUrl of SAAVN_PRIMARY_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`${mirrorUrl}?query=${encodeURIComponent(cleanQuery)}&limit=${limit}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const results = data?.data?.results || data?.results || (Array.isArray(data?.data) ? data.data : []);

        if (Array.isArray(results) && results.length > 0) {
          const parsedTracks = results
            .map((item) => {
              // Extract all available download qualities (ordered lowest to highest)
              let streamUrls = [];
              let streamUrl = null;

              if (Array.isArray(item.downloadUrl) && item.downloadUrl.length > 0) {
                streamUrls = item.downloadUrl
                  .map((d) => (typeof d === 'string' ? d : d?.url || d?.link))
                  .filter(Boolean);

                // Prefer 320kbps or 160kbps (highest index)
                streamUrl = streamUrls[streamUrls.length - 1] || null;
              } else if (typeof item.downloadUrl === 'string') {
                streamUrl = item.downloadUrl;
                streamUrls = [item.downloadUrl];
              }

              // Extract best thumbnail image
              let thumbnail = null;
              if (Array.isArray(item.image) && item.image.length > 0) {
                const bestImg = item.image[item.image.length - 1];
                thumbnail = typeof bestImg === 'string' ? bestImg : bestImg?.url || bestImg?.link;
              } else if (typeof item.image === 'string') {
                thumbnail = item.image;
              }

              // Format artists
              let artists = 'Unknown Artist';
              if (item.artists?.primary && Array.isArray(item.artists.primary)) {
                artists = item.artists.primary.map((a) => (typeof a === 'string' ? a : a.name)).join(', ');
              } else if (item.artist) {
                artists = item.artist;
              } else if (item.singers) {
                artists = item.singers;
              }

              return {
                id: String(item.id || item.name || Math.random()),
                title: cleanText(item.name || item.title || 'Untitled Track'),
                artist: cleanText(artists),
                album: cleanText(item.album?.name || item.album || ''),
                duration: Number(item.duration) || 210,
                thumbnail: thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
                streamUrl: streamUrl,
                streamUrls: streamUrls.length > 0 ? streamUrls : (streamUrl ? [streamUrl] : []),
                source: 'saavn',
              };
            })
            .filter((t) => Boolean(t.streamUrl));

          if (parsedTracks.length > 0) {
            return parsedTracks;
          }
        }
      }
    } catch (err) {
      // Continue to next mirror or fallback
      console.warn(`Saavn mirror failed (${mirrorUrl}):`, err.message || err);
    }
  }

  // 2. Fallback to iTunes Search API (100% reliable global search with instant preview streams)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `${ITUNES_API_URL}?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=${limit}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return data.results
          .map((item) => ({
            id: String(item.trackId || Math.random()),
            title: cleanText(item.trackName || 'Untitled Track'),
            artist: cleanText(item.artistName || 'Unknown Artist'),
            album: cleanText(item.collectionName || ''),
            duration: Math.round((item.trackTimeMillis || 180000) / 1000),
            thumbnail: item.artworkUrl100
              ? item.artworkUrl100.replace('100x100bb', '300x300bb')
              : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
            streamUrl: item.previewUrl,
            streamUrls: item.previewUrl ? [item.previewUrl] : [],
            source: 'itunes',
          }))
          .filter((t) => Boolean(t.streamUrl));
      }
    }
  } catch (err) {
    console.error('All music search providers failed:', err);
  }

  return [];
}

/**
 * Helper to clean and decode HTML escaped entities & special chars
 */
function cleanText(str) {
  if (!str) return '';
  try {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();
  } catch {
    return String(str);
  }
}
