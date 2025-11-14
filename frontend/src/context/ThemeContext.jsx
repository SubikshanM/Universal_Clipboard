import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export const ThemeProvider = ({ children }) => {
  const stored = localStorage.getItem('theme');
  const [isDark, setIsDark] = useState(stored ? stored === 'dark' : false);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // Also toggle a class on <body> for global CSS if needed
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }, [isDark]);

  const toggleTheme = () => setIsDark(v => !v);

  const value = { isDark, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
