import React, { useState, useEffect } from 'react';
// ThemeToggle moved to fixed global position in App.jsx
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Simple Component to handle Login and Signup forms
const AuthScreen = () => {
  // Get authentication functions and state from context
  const { login, signup, loading, error } = useAuth();
  const { isDark } = useTheme();
  
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const switchMode = () => {
    setIsLogin(prev => !prev);
    // Clear form and error when switching
    setEmail('');
    setPassword('');
    // Note: Error is managed by AuthContext, will clear on next attempt
  };

  const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'loading' | 'success'

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitState('loading');
      if (isLogin) {
        await login({ email, password });
      } else {
        await signup({ email, password });
      }
      // if no error thrown, show success briefly
      setSubmitState('success');
      setTimeout(() => setSubmitState('idle'), 1000);
    } catch (err) {
      // login/signup should set error in AuthContext; revert to idle so user can retry
      setSubmitState('idle');
    }
  };

  // Animation trigger for entrance animation when the AuthScreen mounts
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    // small timeout so the animation runs after mount
    const id = setTimeout(() => setAnimateIn(true), 16);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="auth-wrapper" style={{ ...styles.wrapper, backgroundColor: isDark ? '#071224' : styles.wrapper.backgroundColor, position: 'relative' }}>
      {/* animated, low-contrast background behind the auth card */}
      <div aria-hidden className="auth-bg" />

      <div
        className={"auth-card glass" + (animateIn ? ' drop-spin' : '')}
        style={{
          ...styles.card,
          zIndex: 1
        }}
      >
        {/* Theme toggle moved to fixed top-right control for the whole page */}
        <h2 style={{ ...styles.header, color: isDark ? '#e6eef8' : styles.header.color }}>{isLogin ? 'Login to Universal Clipboard' : 'Create an Account'}</h2>

        {/* Display Error Message from Context */}
        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}
          />

          <button
            type="submit"
            disabled={loading || submitState === 'loading'}
            className={`btn btn-primary submit-btn ${submitState === 'loading' ? 'loading' : ''} ${submitState === 'success' ? 'success' : ''}`}
            style={{ ...styles.button, padding: '10px 16px' }}
            aria-live="polite"
          >
            <span className="btn-inner">
              <span className="btn-label">{isLogin ? 'Login' : 'Signup'}</span>
              {/* spinner removed per user request; keep success check */}
              <svg className="btn-check" viewBox="0 0 24 24" aria-hidden>
                <path d="M20.285 6.708l-11.39 11.39-5.18-5.18 1.414-1.414 3.766 3.766 9.976-9.977z" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </form>

        <p style={styles.switchText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={switchMode} style={{ ...styles.switchButton, color: isDark ? '#9fd3ff' : '#007bff' }}>
            {isLogin ? 'Signup' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

// Simple inline styling for a quick interface
const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '20px', paddingRight: '20px', paddingTop: '24px', paddingBottom: '24px', backgroundColor: '#ffffff' },
  card: {
    width: '100%',
    maxWidth: '420px',
    margin: 0,
    padding: '20px',
    borderRadius: '8px',
    // visual chrome (border/shadow/background) is handled by CSS `.auth-card.glass`
    position: 'relative',
    textAlign: 'center',
    backgroundColor: 'transparent',
    // ensure both login and signup variants use the same visual size and avoid layout shift
    minHeight: '360px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  header: {
    marginBottom: '20px',
    color: '#333'
  },
  error: {
    color: 'red',
    marginBottom: '10px',
    fontWeight: 'bold'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  input: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
    width: '100%'
  },
  button: {
    padding: '10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: '10px'
  },
  switchText: {
    marginTop: '20px',
    fontSize: '14px'
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    padding: '0',
    fontSize: '14px',
    textDecoration: 'underline'
  }
};

export default AuthScreen;