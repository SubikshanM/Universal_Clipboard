import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ style }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        /* make circular and set an explicit border/boxShadow in dark mode so it's always visible */
        borderRadius: isDark ? '50%' : 8,
        border: isDark ? '2px solid rgba(255,255,255,0.95)' : undefined,
        boxShadow: isDark ? '0 10px 34px rgba(255,255,255,0.12)' : undefined,
        cursor: 'pointer',
        background: isDark ? '#444' : '#efefef',
        color: isDark ? '#ffd700' : '#333',
        fontSize: 14,
        ...style
      }}
      className={"btn btn-toggle" + (isDark ? ' force-visible' : '')}
    >
      {isDark ? '☀' : '🌙'}
    </button>
  );
};

export default ThemeToggle;
