import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export const ThemeProvider = ({ children }) => {
  const authContext = useAuth();
  const { user, token } = authContext || {}; // Safe destructuring with fallback
  const [isDark, setIsDark] = useState(false); // Default to light mode

  // Load theme preference when user changes
  useEffect(() => {
    if (user && user.email) {
      // Use user-specific theme key
      const themeKey = `theme_${user.email}`;
      const stored = localStorage.getItem(themeKey);
      setIsDark(stored === 'dark');
    } else {
      // No user logged in - always light mode
      setIsDark(false);
    }
  }, [user]);

  // Save theme preference and apply to body
  useEffect(() => {
    if (user && user.email) {
      // Save user-specific theme preference
      const themeKey = `theme_${user.email}`;
      localStorage.setItem(themeKey, isDark ? 'dark' : 'light');
      
      // Only apply dark mode to body when user is authenticated
      if (isDark) document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
    } else {
      // Remove dark mode when no user is logged in
      document.body.classList.remove('dark-mode');
    }
  }, [isDark, user]);

  const toggleTheme = () => {
    // Only allow theme toggle when user is authenticated
    if (user && token) {
      setIsDark(v => !v);
    }
  };

  const value = { 
    isDark: user && token ? isDark : false, 
    toggleTheme,
    isAuthenticated: !!(user && token)
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
