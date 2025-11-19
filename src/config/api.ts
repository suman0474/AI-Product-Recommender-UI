// src/config/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const getApiUrl = (path: string) => {
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If API_BASE_URL is empty (local dev), return the path as-is for proxy
  if (!API_BASE_URL) {
    return `/${cleanPath}`;
  }
  
  // Otherwise, combine base URL with path
  return `${API_BASE_URL}/${cleanPath}`;
};

export default API_BASE_URL;