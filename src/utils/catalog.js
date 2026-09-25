export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

export const getCatalog = async (signal) => {
  const response = await fetch(`${API_BASE_URL}/api/catalog`, { signal });
  if (!response.ok) throw new Error('Unable to load the catalog. Please try again.');
  return response.json();
};

export const getBestSellers = async (signal) => {
  const response = await fetch(`${API_BASE_URL}/api/catalog/best-sellers`, { signal });
  if (!response.ok) throw new Error('Unable to load best sellers.');
  const body = await response.json();
  return body.products || [];
};
