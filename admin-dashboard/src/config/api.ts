// API Configuration for Admin Dashboard
const API_CONFIG = {
  // Development environment
  development: {
    baseURL: 'http://localhost:3190',
    apiPath: '/shieldapi'
  },
  // Production environment
  production: {
    baseURL: '',
    apiPath: '/shieldapi'
  }
};

// Get current environment
const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
const config = isDevelopment ? API_CONFIG.development : API_CONFIG.production;

// Export API base URL
export const API_BASE_URL = `${config.baseURL}${config.apiPath}/`;

// Helper function to convert old API paths to new ones
function convertApiPath(path: string): string {
  // Convert /api/... to just ... (remove /api/ prefix)
  if (path.startsWith('/api/')) {
    return path.slice(5); // Remove '/api/'
  }
  // Remove leading / if present for proper URL construction
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  return path;
}

// Helper for making API calls
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Convert old API paths to new ones
  const convertedEndpoint = convertApiPath(endpoint);
  const url = `${API_BASE_URL}${convertedEndpoint}`;

  // Add authentication header if token exists
  const token = localStorage.getItem('adminToken');

  // Properly merge headers - ensure auth token is always included
  const finalOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers as Record<string, string>),
    },
  };

  try {
    const response = await fetch(url, finalOptions);
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}