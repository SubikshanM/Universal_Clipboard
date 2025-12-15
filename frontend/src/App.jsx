import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import Landing from './pages/Landing';
import ProfileDropdown from './components/ProfileDropdown';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import Toast from './components/Toast';

// --- Configuration ---
// Use hosted backend when available. Vite exposes env vars via import.meta.env.VITE_... in the browser.
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : 'https://universal-clipboard-q6po.onrender.com/api/clipboard';

// --- Encryption and Decryption Functions ---
const encryptContent = (content, secretKey) => {
  return CryptoJS.AES.encrypt(content, secretKey).toString();
};
const decryptContent = (encryptedContent, secretKey) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Decryption failed. Key or ciphertext may be incorrect.");
    return null; 
  }
};

// --- Clipboard Dashboard Component (Manual Mode with History) ---

const Dashboard = ({ showToast }) => {
  const { user, token, logout } = useAuth();
  const { isDark } = useTheme();
  
  const [status, setStatus] = useState('Ready to send data.');
  const [statusLockUntil, setStatusLockUntil] = useState(0); // ms timestamp to avoid status overrides (used after login)
  const [inputText, setInputText] = useState(''); 
  const [history, setHistory] = useState([]); // State for the history list
  const [ttlOption, setTtlOption] = useState(''); // user-selected TTL option (mandatory)
  const [now, setNow] = useState(Date.now()); // used for countdown updates
  const encryptionKey = "SecureMasterKeyFromUserPassword"; 
  const MAX_DISPLAY_LENGTH = 70; // Max characters to show in history before truncation

  // TTL options in seconds
  const TTL_OPTIONS = {
    '1hour': 60 * 60,
    '1day': 60 * 60 * 24,
    '1week': 60 * 60 * 24 * 7,
    '1month': 60 * 60 * 24 * 30,
    '1year': 60 * 60 * 24 * 365,
  };

  // --- API Handler: Fetch and Decrypt History ---
  const fetchHistory = useCallback(async () => {
  try {
    if (Date.now() >= statusLockUntil) setStatus('Fetching secure clip history...');
        const response = await axios.get(`${API_BASE_URL}/history`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.length === 0) {
            setHistory([]);
            setStatus('No clip history found.');
            return;
        }

        const decryptedHistory = response.data.map(item => {
            // Compute an expiration timestamp (ms) if provided by backend
            // Backend may return `expires_at` (ISO string) or `ttl`/`ttl_seconds` (seconds)
            let expiresAt = null;
            if (item.expires_at) {
              expiresAt = Date.parse(item.expires_at);
            } else if (item.ttl || item.ttl_seconds) {
              const ttlSeconds = item.ttl || item.ttl_seconds;
              expiresAt = Date.parse(item.created_at) + (ttlSeconds * 1000);
            }

            return {
                ...item,
                // --- FIX: Change item.encrypted_content to item.encrypted_data ---
                decrypted_content: decryptContent(item.encrypted_data, encryptionKey), 
                display_date: new Date(item.created_at).toLocaleTimeString(),
                expires_at_ts: expiresAt,
            };
        });

  setHistory(decryptedHistory.filter(item => item.decrypted_content !== null)); // Filter out failed decryptions
  if (Date.now() >= statusLockUntil) setStatus('History loaded successfully.');

    } catch (error) {
      console.error('Error fetching clip history:', error);
      setStatus(`Error loading history. (${error.response?.data?.message || error.message})`);
    }
  }, [token, encryptionKey]);

  // If the user just logged in, show a brief success status once
  useEffect(() => {
    try {
      const flag = localStorage.getItem('justLoggedIn');
      if (flag && token) {
        setStatus('Login successful. Welcome!');
        // prevent other code from overwriting the status for a short period
        setStatusLockUntil(Date.now() + 3000);
        localStorage.removeItem('justLoggedIn');
        // Clear the status message after a short delay so it doesn't persist
        const t = setTimeout(() => setStatus('Ready to send data.'), 3000);
        // Also show a floating toast if parent provided one (preferred) or via window helper
        try {
          if (typeof showToast === 'function') {
            showToast('Login successful', 'success');
          } else if (window.__showToast) {
            window.__showToast('Login successful', 'success');
          }
        } catch (e) {}
        return () => clearTimeout(t);
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, [token]);

  // --- API Handler: Encrypt and Send to Server (PUSH) ---
  const syncToServer = async (content) => {
    if (!content) {
        setStatus('Error: Please enter text to send.');
        return;
    }
    if (!ttlOption) {
      setStatus('Error: Please select an expiration time.');
      return;
    }
    
    try {
      setStatus('Encrypting and sending data...');
      const encryptedContent = encryptContent(content, encryptionKey);
      
      const ttlSeconds = TTL_OPTIONS[ttlOption] || null;

      // NOTE: The request payload uses 'encrypted_content', which the backend now reads as 'encrypted_data' from req.body.
      // The backend code was fixed to destructure { encrypted_data, ... } from req.body, so this is fine.
      // If the backend had been fixed to expect 'encrypted_data' in the payload, this would need a change:
      // await axios.post(`${API_BASE_URL}/save`, { encrypted_data: encryptedContent, ... 
      // Since the backend fix was to read `encrypted_data` from the request body (which contained `encrypted_content`), 
      // we must ensure the backend is expecting the name in the payload that the frontend sends.
      // The backend was fixed to read { encrypted_data, ... } from req.body, but the frontend sends { encrypted_content: ... }.
      // Let's assume the frontend must be consistent with the database and use encrypted_data in the payload:
      //
      // If your original backend used req.body.encrypted_content, we must change this.
      // Since the database column is encrypted_data, it's safer to send it as such:
      
      await axios.post(`${API_BASE_URL}/save`, {
        // --- FIX: Change payload key to encrypted_data for consistency (Backend should be updated too if it reads encrypted_data from req.body) ---
        encrypted_data: encryptedContent, 
        ttl_seconds: ttlSeconds,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setStatus('Data sent and saved successfully! Refreshing history...');
      setInputText(''); // Clear input
      setTtlOption('');
      fetchHistory(); // Refresh the history list

    } catch (error) {
      console.error('Error syncing to server:', error);
      setStatus(`Sync error: Could not save data. (${error.message})`);
    }
  };


  // --- Clipboard Handler: Copy Clip from History ---
  const handleCopyFromHistory = async (content) => {
      try {
          await navigator.clipboard.writeText(content);
          setStatus('History item copied to your local clipboard (Ctrl+V).');
      } catch (error) {
          // This will still happen if user clicks outside the page
          setStatus('Error: Could not copy to clipboard. Click the page and try again.');
          console.error('Clipboard write error:', error);
      }
  };


  // --- Delete Handler: Remove a clip from server and UI ---
  const deleteClip = async (id) => {
    const confirmed = window.confirm('Delete this clip? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setStatus('Deleting clip...');
      // Assumption: backend supports DELETE /api/clipboard/delete/:id
      await axios.delete(`${API_BASE_URL}/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Optimistically update UI
      setHistory(prev => prev.filter(item => item.id !== id));
      setStatus('Clip deleted successfully.');
    } catch (error) {
      console.error('Error deleting clip:', error);
      setStatus(`Delete failed: (${error.response?.data?.message || error.message})`);
    }
  };


  // Load history on component mount and token change
  useEffect(() => {
    if (token) {
      fetchHistory();
    }
  }, [token, fetchHistory]);

  // Update `now` every second so countdowns refresh in the UI
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Client-side expiration filter - Runs every 2 seconds to remove expired clips from UI instantly
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      setHistory(prev => {
        const now = Date.now();
        const filtered = prev.filter(item => {
          // Keep items that don't have expiration or haven't expired yet
          if (!item.expires_at_ts) return true;
          return item.expires_at_ts > now;
        });
        // Only update state if something was filtered out
        if (filtered.length !== prev.length) {
          console.log(`[Client Filter] Removed ${prev.length - filtered.length} expired clip(s) from UI`);
        }
        return filtered;
      });
    }, 2000); // Check every 2 seconds

    return () => clearInterval(cleanupTimer);
  }, []);

  // Helper to format remaining milliseconds into human-readable text
  const formatRemaining = (ms) => {
    if (ms == null) return 'N/A';
    if (ms <= 0) return 'Expired';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };


  return (
    <div className="app-container" style={{ 
      ...styles.container, 
      background: isDark 
        ? 'linear-gradient(135deg, #0a1525 0%, #071224 50%, #0d1b2e 100%)' 
        : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)',
      color: isDark ? '#e6eef8' : '#111' 
    }}>
  <div className="app-card" style={{ 
    ...styles.card, 
    background: isDark 
      ? 'rgba(10, 21, 37, 0.6)' 
      : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
    boxShadow: isDark 
      ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)'
      : '0 20px 60px rgba(0, 0, 0, 0.08)',
    color: isDark ? '#e6eef8' : '#111' 
  }}>
  <div className="header-row" style={styles.headerRow}>
  <h1 className="app-title pop-in" style={styles.header}>Universal Clipboard</h1>
    <div className="header-controls" style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
      {/* Theme toggle inline in header so it lines up with the profile avatar */}
      <ThemeToggle />
      <ProfileDropdown />
    </div>
  </div>
      
      {/* 1. SEND (PUSH) SECTION */}
  <div className="section-box" style={{ 
    ...styles.sectionBox, 
    background: isDark 
      ? 'linear-gradient(135deg, rgba(8, 21, 34, 0.8) 0%, rgba(10, 25, 40, 0.6) 100%)' 
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(249, 250, 251, 0.8) 100%)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    boxShadow: isDark 
      ? '0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 10px 30px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          marginTop: 0,
          marginBottom: '1.2rem',
          color: isDark ? '#e6eef8' : '#1e293b'
        }}>1. Send Data to Cloud</h2>
        <textarea
          placeholder="Enter text to securely send..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows="4"
          style={{ 
            ...styles.textarea, 
            background: isDark ? 'rgba(3, 10, 18, 0.6)' : 'rgba(255, 255, 255, 0.9)',
            color: isDark ? '#e6eef8' : '#111',
            border: `2px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
            boxShadow: isDark 
              ? 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
              : 'inset 0 2px 8px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s ease',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = isDark ? 'rgba(6, 182, 212, 0.5)' : 'rgba(59, 130, 246, 0.5)';
            e.target.style.boxShadow = isDark 
              ? '0 0 0 3px rgba(6, 182, 212, 0.1), inset 0 2px 8px rgba(0, 0, 0, 0.3)'
              : '0 0 0 3px rgba(59, 130, 246, 0.1), inset 0 2px 8px rgba(0, 0, 0, 0.05)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(59, 130, 246, 0.2)';
            e.target.style.boxShadow = isDark 
              ? 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
              : 'inset 0 2px 8px rgba(0, 0, 0, 0.05)';
          }}
        />
        <div className="ttlRow" style={styles.ttlRow}>
          {/* Clock icon before the label */}
          <svg
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
            style={{ 
              ...styles.ttlClock, 
              color: isDark ? '#06b6d4' : '#0ea5e9',
              filter: 'drop-shadow(0 2px 4px rgba(6, 182, 212, 0.2))'
            }}
          >
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <label htmlFor="ttl-select" style={{
            ...styles.ttlLabel,
            fontWeight: '600',
            color: isDark ? '#e6eef8' : '#334155'
          }}>Expiration:</label>
          <select
            id="ttl-select"
            value={ttlOption}
            onChange={(e) => setTtlOption(e.target.value)}
            style={{ 
              ...styles.ttlSelect, 
              background: isDark 
                ? `rgba(3, 10, 18, 0.6) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2306b6d4' d='M6 9L1 4h10z'/%3E%3C/svg%3E") no-repeat right 12px center`
                : `rgba(255, 255, 255, 0.9) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230ea5e9' d='M6 9L1 4h10z'/%3E%3C/svg%3E") no-repeat right 12px center`,
              color: isDark ? '#e6eef8' : '#111',
              border: `2px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
              boxShadow: isDark 
                ? 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                : 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              paddingRight: '40px',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
            required
          >
            <option value="">-- Select expiration --</option>
            <option value="1hour">⏱️ 1 hour</option>
            <option value="1day">📅 1 day</option>
            <option value="1week">📆 1 week</option>
            <option value="1month">🗓️ 1 month</option>
            <option value="1year">🗓️ 1 year</option>
          </select>
        </div>
        <button 
          onClick={() => syncToServer(inputText)} 
          className="btn btn-primary" 
          style={{ 
            padding: '12px 28px', 
            fontSize: '16px',
            fontWeight: '600',
            background: isDark
              ? 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
            border: 'none',
            boxShadow: isDark
              ? '0 8px 24px rgba(6, 182, 212, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
              : '0 8px 24px rgba(14, 165, 233, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
            transform: 'translateY(0)',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = isDark
              ? '0 12px 32px rgba(6, 182, 212, 0.4), 0 6px 12px rgba(0, 0, 0, 0.3)'
              : '0 12px 32px rgba(14, 165, 233, 0.4), 0 6px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = isDark
              ? '0 8px 24px rgba(6, 182, 212, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
              : '0 8px 24px rgba(14, 165, 233, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)';
          }}
        >
          🔐 Encrypt and Send Clip
        </button>
      </div>
      
      {/* Current Status moved here: appears between Send and History */}
  <div className="status-box" style={{ 
    ...styles.statusBox, 
    background: isDark 
      ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)'
      : 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
    border: `2px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(14, 165, 233, 0.2)'}`,
    borderRadius: '12px',
    boxShadow: isDark
      ? '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
  }}>
        <p style={{ 
          ...styles.statusLabel, 
          color: isDark ? '#06b6d4' : '#0ea5e9',
          fontWeight: '700',
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>⚡ Current Status:</p>
        <p style={{ 
          color: status.includes('Error') || status.includes('failed') 
            ? (isDark ? '#ff6b6b' : '#dc2626') 
            : (isDark ? '#34d399' : '#10b981'),
          fontWeight: '600',
          fontSize: '15px'
        }}>{status}</p>
      </div>

      {/* 2. HISTORY (PULL) SECTION */}
  <div className="section-box history-section" style={{ 
    ...styles.sectionBox, 
    background: isDark 
      ? 'linear-gradient(135deg, rgba(7, 24, 36, 0.8) 0%, rgba(10, 25, 40, 0.6) 100%)' 
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(249, 250, 251, 0.8) 100%)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    color: isDark ? '#e6eef8' : '#111',
    boxShadow: isDark 
      ? '0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 10px 30px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  }}>
        <h2 style={{ 
          color: isDark ? '#e6eef8' : '#1e293b',
          fontSize: '1.5rem',
          fontWeight: '700',
          marginTop: 0,
          marginBottom: '0.5rem'
        }}>2. Clip History</h2>
        <p style={{ 
          fontSize: '13px', 
          color: isDark ? '#94a3b8' : '#64748b',
          marginBottom: '1.5rem',
          fontWeight: '500'
        }}>🔓 All items below were decrypted on this device.</p>
        
        {history.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#777' }}>No history available. Send your first clip!</p>
        ) : (
            <div className="history-table-container" style={{ 
              ...styles.historyTableContainer, 
              backgroundColor: 'transparent',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table className="history-table" style={{ 
                ...styles.historyTable, 
                tableLayout: 'fixed', 
                backgroundColor: 'transparent'
              }}>
                <thead>
                  <tr style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)'
                  }}>
                    <th style={{ 
                      ...styles.th, 
                      width: '15%', 
                      textAlign: 'left', 
                      backgroundColor: 'transparent', 
                      borderBottomColor: isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.2)', 
                      color: isDark ? '#06b6d4' : '#0284c7',
                      fontWeight: '700',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '14px 12px'
                    }}>Time</th>
                    <th style={{ 
                      ...styles.th, 
                      width: '55%', 
                      textAlign: 'left', 
                      backgroundColor: 'transparent', 
                      borderBottomColor: isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.2)', 
                      color: isDark ? '#06b6d4' : '#0284c7',
                      fontWeight: '700',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '14px 12px'
                    }}>Content</th>
                    <th style={{ 
                      ...styles.th, 
                      width: '15%', 
                      textAlign: 'center', 
                      backgroundColor: 'transparent', 
                      borderBottomColor: isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.2)', 
                      color: isDark ? '#06b6d4' : '#0284c7',
                      fontWeight: '700',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '14px 12px'
                    }}>Expires In</th>
                    <th style={{ 
                      ...styles.th, 
                      width: '15%', 
                      textAlign: 'center', 
                      backgroundColor: 'transparent', 
                      borderBottomColor: isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.2)', 
                      color: isDark ? '#06b6d4' : '#0284c7',
                      fontWeight: '700',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '14px 12px'
                    }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => (
                      <tr 
                        key={item.id} 
                        style={{
                          ...styles.tr,
                          transition: 'all 0.3s ease',
                          cursor: 'default'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark
                            ? 'rgba(6, 182, 212, 0.05)'
                            : 'rgba(14, 165, 233, 0.05)';
                          e.currentTarget.style.transform = 'scale(1.01)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <td data-label="Time" style={{ 
                          ...styles.td, 
                          color: isDark ? '#94a3b8' : '#475569',
                          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          fontWeight: '500',
                          fontSize: '14px',
                          padding: '16px 12px'
                        }}>{item.display_date}</td>
                        <td data-label="Content" style={{ 
                          ...styles.td, 
                          ...styles.contentTd, 
                          color: isDark ? '#e2e8f0' : '#1e293b',
                          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          fontWeight: '500',
                          fontSize: '14px',
                          padding: '16px 12px'
                        }} title={item.decrypted_content}>
                          {item.decrypted_content.length > MAX_DISPLAY_LENGTH
                            ? item.decrypted_content.substring(0, MAX_DISPLAY_LENGTH) + '...'
                            : item.decrypted_content}
                        </td>
                        <td data-label="Expires In" style={{ 
                          ...styles.td, 
                          textAlign: 'center', 
                          color: isDark ? '#94a3b8' : '#64748b',
                          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          fontWeight: '600',
                          fontSize: '13px',
                          padding: '16px 12px'
                        }}>{formatRemaining(item.expires_at_ts ? item.expires_at_ts - now : null)}</td>
                        <td data-label="Actions" style={{ 
                          ...styles.td, 
                          textAlign: 'center', 
                          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          padding: '16px 8px'
                        }}>
                          <div className="actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <button onClick={() => handleCopyFromHistory(item.decrypted_content)} className="btn btn-amber btn-sm" aria-label="Copy clip">
                              📋 Copy
                            </button>
                            <button onClick={() => deleteClip(item.id)} className="btn btn-danger btn-sm" aria-label="Delete clip">
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>

      {/* Legacy logout button removed - use profile dropdown to logout */}
      
      </div>
    </div>
  );
};

// Modern inline styling with glassmorphism and gradients
const styles = {
  // Full-viewport container with gradient background
  container: { 
    minHeight: '100vh', 
    display: 'block', 
    padding: '32px 24px', 
    position: 'relative',
    overflow: 'hidden'
  },
  // Glassmorphic card with backdrop blur
  card: { 
    width: '100%', 
    maxWidth: '1400px', 
    margin: '0 auto', 
    padding: '32px', 
    borderRadius: '24px',
    textAlign: 'left',
    position: 'relative',
    zIndex: 1,
    boxSizing: 'border-box'
  },
  header: { 
    flex: 1, 
    textAlign: 'center', 
    margin: '0',
    fontSize: '2.5rem'
  },
  headerRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 16, 
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  loggedIn: { fontWeight: '700', marginBottom: '30px', textAlign: 'center' },
  sectionBox: { 
    padding: '28px', 
    marginBottom: '24px', 
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden'
  },
  textarea: { 
    width: '100%', 
    padding: '14px 16px', 
    marginBottom: '16px', 
    borderRadius: '10px',
    fontSize: '15px', 
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '120px'
  },
  sendButton: { 
    padding: '12px 28px', 
    color: 'white', 
    border: 'none', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    fontSize: '16px',
    fontWeight: '600'
  },
  statusBox: { 
    margin: '24px 0', 
    padding: '20px 24px',
    textAlign: 'center' 
  },
  statusLabel: { 
    fontWeight: '700', 
    margin: '0 0 8px 0',
    fontSize: '12px'
  },
  logoutButton: { 
    padding: '10px 20px', 
    backgroundColor: '#dc3545', 
    color: 'white', 
    border: 'none', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    marginTop: '20px',
    fontWeight: '600'
  },
  historyList: { listStyle: 'none', padding: 0, margin: '15px 0' },
  historyItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '12px', 
    backgroundColor: 'white', 
    marginBottom: '8px', 
    borderRadius: '10px' 
  },
  historyContent: { 
    textAlign: 'left', 
    flexGrow: 1, 
    overflow: 'hidden', 
    whiteSpace: 'nowrap', 
    textOverflow: 'ellipsis' 
  },
  historyTime: { fontSize: '13px', color: '#999', marginRight: '12px' },
  historyTableContainer: { 
    overflowX: 'auto', 
    width: '100%',
    marginTop: '16px'
  },
  historyTable: { 
    width: '100%', 
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: '600px' 
  },
  contentTd: { 
    overflow: 'hidden', 
    whiteSpace: 'nowrap', 
    textOverflow: 'ellipsis',
    maxWidth: 0
  },
  th: { 
    textAlign: 'left', 
    padding: '12px', 
    fontWeight: '700'
  },
  td: { 
    padding: '12px',
    verticalAlign: 'middle' 
  },
  tr: {},
  deleteButton: { 
    padding: '8px 12px', 
    backgroundColor: '#dc3545', 
    color: 'white', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '13px',
    fontWeight: '600'
  },
  ttlRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  ttlLabel: { 
    fontSize: '15px'
  },
  ttlSelect: { 
    padding: '10px 14px', 
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    flex: '1',
    minWidth: '200px'
  },
  ttlClock: { 
    width: '24px', 
    height: '24px', 
    display: 'inline-block', 
    flexShrink: 0 
  },
  copyButton: { 
    padding: '8px 12px', 
    backgroundColor: '#f59e0b', 
    color: 'white', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '13px', 
    marginLeft: '10px', 
    flexShrink: 0,
    fontWeight: '600'
  },
  // Mobile responsive styles
  '@media (max-width: 768px)': {
    container: {
      padding: '12px',
      minHeight: '100vh'
    },
    card: {
      padding: '16px',
      borderRadius: '16px',
      margin: '0',
      maxWidth: '100%'
    },
    header: {
      fontSize: '1.75rem'
    },
    headerRow: {
      flexDirection: 'column',
      gap: 12,
      marginBottom: '20px',
      paddingBottom: '16px'
    },
    sectionBox: {
      padding: '16px',
      marginBottom: '16px'
    },
    textarea: {
      minHeight: '100px',
      fontSize: '14px',
      padding: '12px'
    },
    ttlRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '8px'
    },
    ttlSelect: {
      width: '100%',
      minWidth: 'auto'
    },
    historyTable: {
      minWidth: '100%',
      fontSize: '13px'
    },
    td: {
      padding: '8px'
    },
    th: {
      padding: '10px 8px',
      fontSize: '11px'
    }
  }
};

// --- Main App Component ---

function App() {
  const { token } = useAuth();
  const [toast, setToast] = React.useState(null); // { message, type }
  // Expose helper for child components (Dashboard) to trigger the toast via window
  React.useEffect(() => {
    window.__showToast = (message, type = 'info') => setToast({ message, type });
    return () => { try { delete window.__showToast; } catch (e) {} };
  }, []);

  return (
    <div className="App">
      {/* ClickDesign removed (disabled) per user request */}
      {token ? <Dashboard showToast={(m,t)=>setToast({message:m,type:t})} /> : <Landing />}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;