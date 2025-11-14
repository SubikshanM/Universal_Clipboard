import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import ProfileDropdown from './components/ProfileDropdown';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import axios from 'axios';
import CryptoJS from 'crypto-js';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:5000/api/clipboard';

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

const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const { isDark } = useTheme();
  
  const [status, setStatus] = useState('Ready to send data.');
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
        setStatus('Fetching secure clip history...');
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
                decrypted_content: decryptContent(item.encrypted_content, encryptionKey),
                display_date: new Date(item.created_at).toLocaleTimeString(),
                expires_at_ts: expiresAt,
            };
        });

        setHistory(decryptedHistory.filter(item => item.decrypted_content !== null)); // Filter out failed decryptions
        setStatus('History loaded successfully.');

    } catch (error) {
      console.error('Error fetching clip history:', error);
      setStatus(`Error loading history. (${error.response?.data?.message || error.message})`);
    }
  }, [token, encryptionKey]);

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

      await axios.post(`${API_BASE_URL}/save`, {
        encrypted_content: encryptedContent,
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
    <div className="app-container" style={{ ...styles.container, backgroundColor: isDark ? '#071224' : '#ffffff', color: isDark ? '#e6eef8' : '#111' }}>
  <div className="app-card" style={{ ...styles.card, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111' }}>
  <div className="header-row" style={styles.headerRow}>
  <h1 className="app-title pop-in" style={styles.header}>Universal Clipboard</h1>
    <div className="header-controls" style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Theme toggle inline in header so it lines up with the profile avatar */}
      <ThemeToggle />
      <ProfileDropdown />
    </div>
  </div>
      
      {/* 1. SEND (PUSH) SECTION */}
  <div className="section-box" style={{ ...styles.sectionBox, backgroundColor: isDark ? '#081522' : '#f9f9f9', border: `1px solid ${isDark ? '#15222e' : '#eee'}` }}>
        <h2>1. Send Data to Cloud</h2>
        <textarea
          placeholder="Enter text to securely send..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows="4"
          style={{ ...styles.textarea, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}
        />
        <div style={styles.ttlRow}>
          <label htmlFor="ttl-select" style={styles.ttlLabel}>Expiration:</label>
          <select
            id="ttl-select"
            value={ttlOption}
            onChange={(e) => setTtlOption(e.target.value)}
            style={{ ...styles.ttlSelect, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ccc'}` }}
            required
          >
            <option value="">-- Select expiration --</option>
            <option value="1hour">1 hour</option>
            <option value="1day">1 day</option>
            <option value="1week">1 week</option>
            <option value="1month">1 month</option>
            <option value="1year">1 year</option>
          </select>
        </div>
        <button onClick={() => syncToServer(inputText)} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 16 }}>
          Encrypt and Send Clip
        </button>
      </div>
      
      {/* Current Status moved here: appears between Send and History */}
  <div className="status-box" style={{ ...styles.statusBox, backgroundColor: isDark ? '#071224' : '#fff', border: `1px dashed ${isDark ? '#15313f' : '#ccc'}` }}>
        <p style={{ ...styles.statusLabel, color: isDark ? '#e6eef8' : '#111' }}>Current Status:</p>
        <p style={{ color: status.includes('Error') || status.includes('failed') ? '#ff6b6b' : '#57a773' }}>{status}</p>
      </div>

      {/* 2. HISTORY (PULL) SECTION */}
  <div className="section-box history-section" style={{ ...styles.sectionBox, backgroundColor: isDark ? '#071824' : '#f9f9f9', border: `1px solid ${isDark ? '#12303b' : '#eee'}`, color: isDark ? '#e6eef8' : '#111' }}>
        <h2 style={{ color: isDark ? '#e6eef8' : '#111' }}>2. Clip History</h2>
        <p style={{ fontSize: '12px', color: isDark ? '#9fb0c6' : '#666' }}>All items below were decrypted on this device.</p>
        
        {history.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#777' }}>No history available. Send your first clip!</p>
        ) : (
            <div className="history-table-container" style={{ ...styles.historyTableContainer, backgroundColor: isDark ? 'transparent' : 'transparent' }}>
              <table className="history-table" style={{ ...styles.historyTable, tableLayout: 'fixed', backgroundColor: 'transparent' }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '15%', textAlign: 'left', backgroundColor: 'transparent', borderBottomColor: isDark ? '#23414b' : '#eee', color: isDark ? '#cfe8ff' : '#111' }}>Time</th>
                    <th style={{ ...styles.th, width: '55%', textAlign: 'left', backgroundColor: 'transparent', borderBottomColor: isDark ? '#23414b' : '#eee', color: isDark ? '#cfe8ff' : '#111' }}>Content</th>
                    <th style={{ ...styles.th, width: '15%', textAlign: 'center', backgroundColor: 'transparent', borderBottomColor: isDark ? '#23414b' : '#eee', color: isDark ? '#cfe8ff' : '#111' }}>Expires In</th>
                    <th style={{ ...styles.th, width: '15%', textAlign: 'center', backgroundColor: 'transparent', borderBottomColor: isDark ? '#23414b' : '#eee', color: isDark ? '#cfe8ff' : '#111' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                      <tr key={item.id} style={styles.tr}>
                        <td data-label="Time" style={{ ...styles.td, color: isDark ? '#cfe8ff' : '#111', borderBottomColor: isDark ? '#0f2a3a' : '#f1f1f1' }}>{item.display_date}</td>
                        <td data-label="Content" style={{ ...styles.td, ...styles.contentTd, color: isDark ? '#cfe8ff' : '#111', borderBottomColor: isDark ? '#0f2a3a' : '#f1f1f1' }} title={item.decrypted_content}>
                          {item.decrypted_content.length > MAX_DISPLAY_LENGTH
                            ? item.decrypted_content.substring(0, MAX_DISPLAY_LENGTH) + '...'
                            : item.decrypted_content}
                        </td>
                        <td data-label="Expires In" style={{ ...styles.td, textAlign: 'center', color: isDark ? '#9fb0c6' : '#111', borderBottomColor: isDark ? '#0f2a3a' : '#f1f1f1' }}>{formatRemaining(item.expires_at_ts ? item.expires_at_ts - now : null)}</td>
                        <td data-label="Actions" style={{ ...styles.td, textAlign: 'center', borderBottomColor: isDark ? '#0f2a3a' : '#f1f1f1' }}>
                          <div className="actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => handleCopyFromHistory(item.decrypted_content)} className="btn btn-amber btn-sm">
                              Copy
                            </button>
                            <button onClick={() => deleteClip(item.id)} className="btn btn-danger btn-sm">
                              Delete
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

// Simple inline styling (kept the same structure but updated names)
const styles = {
  // Full-viewport container — use small horizontal padding so content can be full-bleed
  container: { minHeight: '100vh', display: 'block', paddingLeft: '20px', paddingRight: '20px', paddingTop: '24px', paddingBottom: '24px', backgroundColor: '#ffffff' },
  // Make the card full width (full-bleed) to match the screenshot — remove rounded corners and shadow
  card: { width: '100%', maxWidth: '100%', margin: 0, padding: '20px', border: 'none', borderRadius: 0, boxShadow: 'none', backgroundColor: 'white', textAlign: 'left' },
  header: { flex: 1, textAlign: 'center', margin: '0' },
  headerRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  loggedIn: { fontWeight: 'bold', marginBottom: '30px', textAlign: 'center' },
  sectionBox: { border: '1px solid #eee', padding: '20px', marginBottom: '20px', borderRadius: '6px', backgroundColor: '#f9f9f9' },
  textarea: { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '16px', boxSizing: 'border-box' },
  sendButton: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
  statusBox: { margin: '20px 0', padding: '15px', border: '1px dashed #ccc', borderRadius: '8px', backgroundColor: '#fff', textAlign: 'center' },
  statusLabel: { fontWeight: 'bold', margin: '0 0 5px 0' },
  logoutButton: { padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' },
  historyList: { listStyle: 'none', padding: 0, margin: '15px 0' },
  historyItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', backgroundColor: 'white', marginBottom: '5px', borderRadius: '4px' },
  historyContent: { textAlign: 'left', flexGrow: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  historyTime: { fontSize: '12px', color: '#999', marginRight: '10px' },
  historyTableContainer: { overflowX: 'auto', width: '100%' },
  historyTable: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  contentTd: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  th: { textAlign: 'left', padding: '10px', borderBottom: '2px solid #eee', backgroundColor: '#fafafa', fontWeight: '600' },
  td: { padding: '10px', borderBottom: '1px solid #f1f1f1', verticalAlign: 'top' },
  tr: {},
  deleteButton: { padding: '6px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' },
  ttlRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  ttlLabel: { fontSize: '14px', color: '#333' },
  ttlSelect: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' },
  copyButton: { padding: '5px 10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginLeft: '10px', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }
};

// --- Main App Component ---

function App() {
  const { token } = useAuth();

  return (
    <div className="App">
      {/* When not logged in, show a fixed toggle on the auth screen (so auth still has a top-right toggle).
          When logged in the toggle renders inside the header-controls so it's aligned with the profile avatar. */}
      {!token && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999 }} className="global-theme-toggle">
          <ThemeToggle />
        </div>
      )}
  {/* ClickDesign removed (disabled) per user request */}
      {token ? <Dashboard /> : <AuthScreen />}
    </div>
  );
}

export default App;