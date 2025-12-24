import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

// 1. Create the Context
const AuthContext = createContext();

// 2. Custom hook to use the context easily
export function useAuth() {
  return useContext(AuthContext);
}

// Base URL for your Node.js Backend API (use hosted backend by default)
// Vite exposes env vars via import.meta.env.VITE_... in the browser; avoid using process.env directly.
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : 'https://universal-clipboard-q6po.onrender.com/api/auth';

// 3. The Provider Component
export const AuthProvider = ({ children }) => {
  // Check localStorage for an existing token when the app loads
  const initialToken = localStorage.getItem('token');
  const initialUser = localStorage.getItem('user');
  
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(initialUser ? JSON.parse(initialUser) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Authentication Actions ---

  // Function to handle both Login and Signup (they return a JWT)
  const authenticate = async (endpoint, credentials) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/${endpoint}`, credentials);
      
      const newToken = response.data.token;
      
      // Assuming a successful response also gives user data (like username/email)
      // For now, we'll just store a placeholder object
      const userData = { email: credentials.email }; 

      // Store in state and localStorage
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setLoading(false);
      return true; // Success
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Authentication failed.';
      setError(errorMessage);
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setLoading(false);
      return false; // Failure
    }
  };

  const logout = async () => {
    // Disconnect device before logging out
    if (token) {
      try {
        // Get device info
        const userAgent = navigator.userAgent;
        let browser = 'Unknown';
        let os = 'Unknown';

        if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) browser = 'Chrome';
        else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) browser = 'Safari';
        else if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
        else if (userAgent.indexOf('Edg') > -1) browser = 'Edge';

        if (userAgent.indexOf('Win') > -1) os = 'Windows';
        else if (userAgent.indexOf('Mac') > -1 && userAgent.indexOf('iPhone') === -1 && userAgent.indexOf('iPad') === -1) os = 'macOS';
        else if (userAgent.indexOf('Linux') > -1 && userAgent.indexOf('Android') === -1) os = 'Linux';
        else if (userAgent.indexOf('Android') > -1) os = 'Android';
        else if (userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1 || userAgent.indexOf('iPod') > -1) os = 'iOS';

        const deviceName = `${browser} on ${os}`;
        
        // Call disconnect API
        const devicesUrl = API_URL.replace('/auth', '/devices');
        await axios.post(`${devicesUrl}/disconnect`, { deviceName }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to disconnect device:', err);
      }
    }
    
    // Clear user-specific theme preference before logging out
    if (user && user.email) {
      const themeKey = `theme_${user.email}`;
      localStorage.removeItem(themeKey);
    }
    
    // Clear dark mode from body
    document.body.classList.remove('dark-mode');
    
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUserData) => {
    const newUser = { ...user, ...updatedUserData };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const refreshUserProfile = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = response.data.user;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  const contextValue = {
    token,
    user,
    loading,
    error,
    login: (credentials) => authenticate('login', credentials),
    signup: (credentials) => authenticate('signup', credentials),
    logout,
    updateUser,
    refreshUserProfile,
  };

  // Provide the context value to child components
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};