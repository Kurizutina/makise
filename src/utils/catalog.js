export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Catalog changes are uncommon compared with browsing. Keep a small in-tab
// cache so returning to Home or reopening a menu is instant, and explicitly
// invalidate it as soon as an admin changes the catalog.
const CATALOG_CACHE_MS = 60 * 1000;
let catalogCache = null;
const brandProductCache = new Map();
export const CATALOG_CHANGED_EVENT = 'otuzan:catalog-changed';
const CATALOG_CHANGED_STORAGE_KEY = 'otuzan:catalog-changed';

const stillFresh = (entry) => entry && (Date.now() - entry.savedAt) < CATALOG_CACHE_MS;

export const apiAssetUrl = (path) => {
  if (!path) return null;
  // Catalog filenames include spaces and some menus use accented names such
  // as "McCafé". Encode a local path before assigning it to an <img> so the
  // request reaches the exact public asset rather than becoming a broken URL.
  // Some seeded catalogs (Jollibee) already store URL-encoded filenames,
  // while others (McDonald's) store readable filenames. Normalize every
  // path segment before encoding it exactly once: decodeURI deliberately
  // leaves reserved escapes such as `%26` intact, which previously became
  // `%2526` and broke every image in an `&` folder name.
  const localAssetUrl = (assetPath) => {
    const encodeSegment = (segment) => {
      try { return encodeURIComponent(decodeURIComponent(segment)); }
      catch { return encodeURIComponent(segment); }
    };
    return assetPath.split('/').map(encodeSegment).join('/');
  };
  if (path.startsWith('/uploads/')) return `${API_BASE_URL}${localAssetUrl(path)}`;

  // Older payment records stored a full URL using the uploading device's
  // localhost. Keep the file path, but always use this device's API host.
  try {
    const url = new URL(path);
    if (url.pathname.startsWith('/uploads/')) return `${API_BASE_URL}${localAssetUrl(url.pathname)}${url.search}`;
  } catch {
    // Data URLs and other non-URL values are already directly renderable.
  }

  return path.startsWith('/') ? localAssetUrl(path) : path;
};

export const catalogImageUrl = apiAssetUrl;

export const broadcastCatalogChanged = () => {
  catalogCache = null;
  brandProductCache.clear();
  window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT));
  try {
    localStorage.setItem(CATALOG_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // The current tab still receives the custom event if storage is blocked.
  }
};

export const invalidateCatalogCache = () => {
  catalogCache = null;
  brandProductCache.clear();
};

export const getCatalog = async (signal) => {
  if (stillFresh(catalogCache)) return catalogCache.data;
  const response = await fetch(`${API_BASE_URL}/api/catalog`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load the catalog. Please try again.');
  const data = await response.json();
  catalogCache = { data, savedAt: Date.now() };
  return data;
};

export const getBrandProducts = async (brandId, signal) => {
  const cached = brandProductCache.get(String(brandId));
  if (stillFresh(cached)) return cached.data;
  const response = await fetch(`${API_BASE_URL}/api/catalog/brands/${brandId}/products`, {
    signal, cache: 'no-store'
  });
  if (!response.ok) throw new Error('This brand is no longer available.');
  const data = await response.json();
  brandProductCache.set(String(brandId), { data, savedAt: Date.now() });
  return data;
};

export const getBestSellers = async (signal) => {
  const response = await fetch(`${API_BASE_URL}/api/catalog/best-sellers`, { signal });
  if (!response.ok) throw new Error('Unable to load best sellers.');
  const body = await response.json();
  return body.products || [];
};
