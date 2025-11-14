import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

// 1. Create the Context
const AuthContext = createContext();

// 2. Custom hook to use the context easily
export function useAuth() {
  return useContext(AuthContext);
}

// Base URL for your Node.js Backend API
const API_URL = 'http://localhost:5000/api/auth';

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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const contextValue = {
    token,
    user,
    loading,
    error,
    login: (credentials) => authenticate('login', credentials),
    signup: (credentials) => authenticate('signup', credentials),
    logout,
  };

  // Provide the context value to child components
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};