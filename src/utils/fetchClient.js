const API_BASE_URL = '/api';

const getDeviceFingerprint = () => {
  const nav = navigator;
  const screen = window.screen;
  const fingerprint = `${nav.userAgent}-${screen.width}x${screen.height}-${nav.language}`;
  return btoa(fingerprint);
};

const fetchClient = async (endpoint, options = {}) => {
  // Determine which token to use based on endpoint
  let token;
  if (endpoint.startsWith('/admin')) {
    token = localStorage.getItem('adminToken');
  } else {
    token = localStorage.getItem('token');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Fingerprint': getDeviceFingerprint(),
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export default fetchClient;
