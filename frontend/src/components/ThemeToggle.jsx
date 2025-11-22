import React, { useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

/**
 * Fresh minimal sliding toggle.
 * - single track, single knob
 * - knob contains both sun & moon svgs and CSS controls visibility
 * - accessible (role=switch, aria-checked, keyboard)
 */
const ThemeToggle = ({ size = 'md' }) => {
  const { isDark, toggleTheme } = useTheme();

  const onKeyDown = useCallback((e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleTheme();
    }
  }, [toggleTheme]);

  return (
    <button
      type="button"
      className={`daynight-toggle daynight-${size} ${isDark ? 'is-dark' : 'is-light'}`}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      onKeyDown={onKeyDown}
    >
      <span className="dnt-track" aria-hidden>
        <span className="dnt-knob" aria-hidden>
          {/* sun */}
          <svg className="dnt-icon dnt-icon-sun" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden preserveAspectRatio="xMidYMid meet" focusable="false">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none">
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="M4.22 4.22l1.42 1.42" />
              <path d="M18.36 18.36l1.42 1.42" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="M4.22 19.78l1.42-1.42" />
              <path d="M18.36 5.64l1.42-1.42" />
            </g>
          </svg>

          {/* moon */}
          <svg className="dnt-icon dnt-icon-moon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden preserveAspectRatio="xMidYMid meet" focusable="false">
            <path d="M14.5 3.2a8 8 0 1 0 6.3 11.3 6 6 0 0 1-6.3-11.3z" fill="currentColor" />
          </svg>
        </span>
      </span>
    </button>
  );
};

export default ThemeToggle;
