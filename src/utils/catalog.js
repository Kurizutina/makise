export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const apiAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('/uploads/')) return `${API_BASE_URL}${path}`;

  // Older payment records stored a full URL using the uploading device's
  // localhost. Keep the file path, but always use this device's API host.
  try {
    const url = new URL(path);
    if (url.pathname.startsWith('/uploads/')) return `${API_BASE_URL}${url.pathname}${url.search}`;
  } catch {
    // Data URLs and other non-URL values are already directly renderable.
  }

  return path;
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
