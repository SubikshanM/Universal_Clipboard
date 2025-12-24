import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import Landing from './pages/Landing';
import ProfileDropdown from './components/ProfileDropdown';
import ThemeToggle from './components/ThemeToggle';
import Devices from './components/Devices';
import { useTheme } from './context/ThemeContext';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import Toast from './components/Toast';
import { io } from 'socket.io-client';

// --- Configuration ---
// Use hosted backend when available. Vite exposes env vars via import.meta.env.VITE_... in the browser.
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : 'https://universal-clipboard-q6po.onrender.com/api/clipboard';

// Socket.IO server URL (extract base from API_BASE_URL)
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api/clipboard', '');

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
  
  const [activeTab, setActiveTab] = useState('clipboard'); // 'clipboard' or 'devices'
  const [status, setStatus] = useState('Ready to send data.');
  const [statusLockUntil, setStatusLockUntil] = useState(0); // ms timestamp to avoid status overrides (used after login)
  const [inputText, setInputText] = useState(''); 
  const [history, setHistory] = useState([]); // State for the history list
  const [ttlOption, setTtlOption] = useState(''); // user-selected TTL option (mandatory)
  const [now, setNow] = useState(Date.now()); // used for countdown updates
  const [searchQuery, setSearchQuery] = useState(''); // Search filter
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // ID of clip to delete
  const [isSending, setIsSending] = useState(false); // Loading state for send button
  const [showConfetti, setShowConfetti] = useState(false); // Confetti animation trigger
  const encryptionKey = "SecureMasterKeyFromUserPassword"; 
  const MAX_DISPLAY_LENGTH = 70; // Max characters to show in history before truncation
  const socketRef = useRef(null); // Socket.IO connection reference

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

  // Socket.IO connection and real-time event listeners
  useEffect(() => {
    if (!token) return;

    // Get device information
    const getDeviceInfo = () => {
      const userAgent = navigator.userAgent;
      let deviceType = 'Desktop';
      let browser = 'Unknown';
      let os = 'Unknown';

      // Detect device type
      if (/mobile/i.test(userAgent)) deviceType = 'Mobile';
      else if (/tablet/i.test(userAgent)) deviceType = 'Tablet';

      // Detect browser
      if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
      else if (userAgent.indexOf('Safari') > -1) browser = 'Safari';
      else if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
      else if (userAgent.indexOf('Edge') > -1) browser = 'Edge';

      // Detect OS
      if (userAgent.indexOf('Win') > -1) os = 'Windows';
      else if (userAgent.indexOf('Mac') > -1) os = 'macOS';
      else if (userAgent.indexOf('Linux') > -1) os = 'Linux';
      else if (userAgent.indexOf('Android') > -1) os = 'Android';
      else if (userAgent.indexOf('iOS') > -1) os = 'iOS';

      const deviceName = `${browser} on ${os}`;
      
      return { deviceName, deviceType, browser, os };
    };

    const deviceInfo = getDeviceInfo();

    // Register device with backend
    const registerDevice = async () => {
      try {
        await axios.post(`${API_BASE_URL.replace('/clipboard', '/devices')}/register`, deviceInfo, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('[Device] Failed to register device:', err);
      }
    };

    registerDevice();

    // Initialize socket connection with JWT authentication and device info
    const socket = io(SOCKET_SERVER_URL, {
      auth: {
        token: token
      },
      query: deviceInfo,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from server');
    });

    // Listen for new clip events
    socket.on('new_clip', (data) => {
      console.log('[Socket.IO] Received new_clip event:', data);
      
      // Decrypt and add to history
      const decryptedContent = decryptContent(data.encrypted_data, encryptionKey);
      if (decryptedContent) {
        const newClip = {
          id: data.id,
          encrypted_data: data.encrypted_data,
          decrypted_content: decryptedContent,
          created_at: data.created_at,
          display_date: new Date(data.created_at).toLocaleTimeString(),
          expires_at_ts: data.expires_at ? Date.parse(data.expires_at) : null,
        };
        
        setHistory(prevHistory => [newClip, ...prevHistory]);
        
        // Show toast notification
        if (typeof showToast === 'function') {
          showToast('New clip received!', 'success');
        }
      }
    });

    // Listen for clip deleted events
    socket.on('clip_deleted', (data) => {
      console.log('[Socket.IO] Received clip_deleted event:', data);
      
      setHistory(prevHistory => prevHistory.filter(item => String(item.id) !== String(data.id)));
      
      // Show toast notification
      if (typeof showToast === 'function') {
        showToast('Clip deleted on another device', 'info');
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, encryptionKey, showToast]);

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
      setIsSending(true);
      setStatus('Encrypting and sending data...');
      const encryptedContent = encryptContent(content, encryptionKey);
      
      const ttlSeconds = TTL_OPTIONS[ttlOption] || null;
      
      await axios.post(`${API_BASE_URL}/save`, {
        encrypted_data: encryptedContent, 
        ttl_seconds: ttlSeconds,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Trigger confetti animation
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      
      setStatus('Data sent and saved successfully! Refreshing history...');
      setInputText(''); // Clear input
      setTtlOption('');
      setIsSending(false);
      fetchHistory(); // Refresh the history list

    } catch (error) {
      console.error('Error syncing to server:', error);
      setStatus(`Sync error: Could not save data. (${error.message})`);
      setIsSending(false);
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
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    
    try {
      setStatus('Deleting clip...');
      await axios.delete(`${API_BASE_URL}/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Optimistically update UI with fade out animation
      setHistory(prev => prev.filter(item => item.id !== id));
      setStatus('Clip deleted successfully.');
    } catch (error) {
      console.error('Error deleting clip:', error);
      setStatus(`Delete failed: (${error.response?.data?.message || error.message})`);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
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

  // Filter history based on search query
  const filteredHistory = history.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.decrypted_content?.toLowerCase().includes(query) ||
           item.display_date?.toLowerCase().includes(query);
  });


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
    <h1 className="app-title pop-in gradient-text">Universal Clipboard</h1>
    <div className="header-controls" style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
      {/* Theme toggle inline in header so it lines up with the profile avatar */}
      <ThemeToggle />
      <ProfileDropdown />
    </div>
  </div>

  {/* Tab Navigation */}
  <div style={{ display: 'flex', gap: 8, marginTop: 16, borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
    <button
      onClick={() => setActiveTab('clipboard')}
      style={{
        padding: '12px 24px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === 'clipboard' ? `3px solid #667eea` : '3px solid transparent',
        color: activeTab === 'clipboard' ? '#667eea' : (isDark ? '#94a3b8' : '#64748b'),
        fontWeight: activeTab === 'clipboard' ? 600 : 400,
        cursor: 'pointer',
        fontSize: '15px',
        transition: 'all 0.2s ease'
      }}
    >
      📋 Clipboard
    </button>
    <button
      onClick={() => setActiveTab('devices')}
      style={{
        padding: '12px 24px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === 'devices' ? `3px solid #667eea` : '3px solid transparent',
        color: activeTab === 'devices' ? '#667eea' : (isDark ? '#94a3b8' : '#64748b'),
        fontWeight: activeTab === 'devices' ? 600 : 400,
        cursor: 'pointer',
        fontSize: '15px',
        transition: 'all 0.2s ease'
      }}
    >
      💻 Devices
    </button>
  </div>

  {/* Show Devices component when devices tab is active */}
  {activeTab === 'devices' ? (
    <Devices socket={socketRef.current} />
  ) : (
    <>
      {/* Original Clipboard UI */}
      
      {/* 1. SEND (PUSH) SECTION */}
  <div className="section-box holographic glass-reflect" style={{ 
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
          disabled={isSending}
          className="btn btn-primary send-button-enhanced btn-shine ripple-effect btn-liquid btn-magnetic" 
          style={{ 
            padding: '12px 28px', 
            fontSize: '16px',
            fontWeight: '600',
            background: isSending
              ? '#94a3b8'
              : isDark
              ? 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)'
              : 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
            border: 'none',
            boxShadow: isDark
              ? '0 8px 24px rgba(6, 182, 212, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
              : '0 8px 24px rgba(14, 165, 233, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
            transform: 'translateY(0)',
            position: 'relative',
            cursor: isSending ? 'not-allowed' : 'pointer',
            opacity: isSending ? 0.7 : 1
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
          {isSending ? (
            <>
              <span className="spinner"></span>
              Sending...
            </>
          ) : (
            <>🔐 Encrypt and Send Clip</>
          )}
        </button>
      </div>

      {/* Confetti Animation */}
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => (
            <div key={i} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              backgroundColor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)]
            }}></div>
          ))}
        </div>
      )}
      
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
  <div className="section-box history-section holographic" style={{ 
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
          marginBottom: '1rem',
          fontWeight: '500'
        }}>🔓 All items below were decrypted on this device.</p>
        
        {/* Search Bar */}
        {history.length > 0 && (
          <div style={{ 
            marginBottom: '1.5rem',
            position: 'relative'
          }}>
            <input
              type="text"
              placeholder="🔍 Search clips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                width: '100%',
                padding: '12px 16px 12px 45px',
                borderRadius: '10px',
                border: `2px solid ${isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.3)'}`,
                background: isDark ? 'rgba(3, 10, 18, 0.6)' : 'rgba(255, 255, 255, 0.9)',
                color: isDark ? '#e6eef8' : '#111',
                fontSize: '14px',
                fontWeight: '500',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: isDark 
                  ? 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
                  : 'inset 0 2px 8px rgba(0, 0, 0, 0.05)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = isDark ? 'rgba(6, 182, 212, 0.6)' : 'rgba(14, 165, 233, 0.6)';
                e.target.style.boxShadow = isDark 
                  ? '0 0 0 3px rgba(6, 182, 212, 0.1), inset 0 2px 8px rgba(0, 0, 0, 0.3)'
                  : '0 0 0 3px rgba(14, 165, 233, 0.1), inset 0 2px 8px rgba(0, 0, 0, 0.05)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isDark ? 'rgba(6, 182, 212, 0.3)' : 'rgba(14, 165, 233, 0.3)';
                e.target.style.boxShadow = isDark 
                  ? 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
                  : 'inset 0 2px 8px rgba(0, 0, 0, 0.05)';
              }}
            />
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              pointerEvents: 'none'
            }}>🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                ✕
              </button>
            )}
          </div>
        )}
        
        {history.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#777' }}>No history available. Send your first clip!</p>
        ) : filteredHistory.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#777', textAlign: 'center', padding: '20px' }}>
              No clips found matching "{searchQuery}" 🔍
            </p>
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
                  {filteredHistory.map((item, index) => (
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
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="delete-modal" style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
            padding: '32px',
            borderRadius: '20px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: isDark
              ? '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 20px 60px rgba(0, 0, 0, 0.2)',
            border: `1px solid ${isDark ? 'rgba(167, 139, 250, 0.3)' : 'rgba(14, 165, 233, 0.2)'}`,
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ 
              margin: '0 0 12px 0',
              color: isDark ? '#e6eef8' : '#1e293b',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>Delete Clip?</h3>
            <p style={{ 
              margin: '0 0 24px 0',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              This action cannot be undone. The clip will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={cancelDelete}
                className="btn"
                style={{
                  padding: '10px 24px',
                  background: isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: isDark ? '#e6eef8' : '#475569',
                  border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = isDark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.2)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="btn"
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      </>
  )}
      
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
    fontSize: '2.5rem',
    display: 'block',
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'visible'
  },
  headerRow: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    gap: 16, 
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    width: '100%'
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