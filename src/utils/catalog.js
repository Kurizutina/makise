export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const catalogImageUrl = (path) => {
  if (!path) return null;
  return path.startsWith('/uploads/') ? `${API_BASE_URL}${path}` : path;
};

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
