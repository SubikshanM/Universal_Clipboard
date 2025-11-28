import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

// API base used by the frontend. Prefer Vite env `VITE_API_URL`, otherwise fall back
// to the known backend host used during development/testing.
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : 'https://universal-clipboard-q6po.onrender.com/api/auth';

const ProfileDropdown = () => {
  const { user, logout, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // When the dropdown opens, force the heading/email color to black using an inline
  // style with priority 'important' to override any global dark-mode !important rules.
  useEffect(() => {
    if (!open || !ref.current) return;
    const heading = ref.current.querySelector('.dropdown-heading');
    const emailEl = ref.current.querySelector('.dropdown-email');
    try {
      if (heading) heading.style.setProperty('color', '#000', 'important');
      if (emailEl) emailEl.style.setProperty('color', '#000', 'important');
    } catch (err) {
      // ignore in environments that don't support setProperty priority
    }
  }, [open]);

  const { isDark } = useTheme();
  const email = user?.email || 'Unknown';
  const initial = email.charAt(0).toUpperCase();
  const avatarBg = isDark ? '#1f2937' : '#333';
  // Always use a white dropdown background as requested, with black text for maximum contrast
  const dropdownBg = 'white';
  const textColor = '#000';

  return (
    <div ref={ref} style={styles.container}>
      <button
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="avatar-btn btn"
        style={{ ...styles.avatarButton, background: avatarBg, color: isDark ? '#fff' : 'white' }}
        title={email}
      >
        <span style={styles.avatarText}>{initial}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Profile menu" style={{ ...styles.dropdown, background: dropdownBg, borderColor: '#e0e0e0' }}>
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => { setProfileOpen(true); setOpen(false); }} className="btn btn-primary" style={{ padding: '6px 10px', marginRight: 8 }}>Profile</button>
            <button onClick={() => { logout(); setOpen(false); }} className="btn btn-danger" style={{ padding: '6px 10px' }}>Logout</button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileOpen && (
        <div role="dialog" aria-modal="true" style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h3 style={{ marginTop: 0 }}>Your Profile</h3>
            <ProfileForm token={token} user={user} onClose={() => setProfileOpen(false)} onUsernameUpdated={(newName) => {
              // update local storage user preview if present
              try {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const obj = JSON.parse(raw);
                  obj.username = newName;
                  localStorage.setItem('user', JSON.stringify(obj));
                }
              } catch (e) {}
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { position: 'relative', display: 'inline-block' },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: '#333',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  avatarText: { fontWeight: '700' },
  dropdown: {
    position: 'absolute',
    right: 0,
    marginTop: 8,
    minWidth: 220,
    background: 'white',
    border: '1px solid #e0e0e0',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
    borderRadius: 8,
    padding: 12,
    zIndex: 1000,
  },
  row: { marginBottom: 6 },
  email: { fontSize: 13, color: '#000', marginBottom: 12, wordBreak: 'break-all' },
  actions: { display: 'flex', justifyContent: 'flex-end' },
  logoutBtn: { padding: '6px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }
};

export default ProfileDropdown;

// Modal styles and ProfileForm component
const modalStyles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { width: 520, maxWidth: '94%', background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 24px 48px rgba(2,6,23,0.32)' }
};

// Attach modal styles to exported styles for reuse
styles.modalBackdrop = modalStyles.backdrop;
styles.modal = modalStyles.modal;

function ProfileForm({ token, user, onClose, onUsernameUpdated }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  // Initialize displayed profile from client-side AuthContext user so email shows immediately
  const [profile, setProfile] = useState({ email: (user && user.email) || '', username: (user && user.username) || '' });
  const [username, setUsername] = useState((user && user.username) || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    // Diagnostic: log the API_URL and token presence so we can debug deployed env issues
    try { console.info('[ProfileForm] API_URL =', API_URL, ' token-present=', !!token); } catch (e) {}
    let mounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (!mounted) return;
        setProfile(res.data.user || {});
        setUsername((res.data.user && res.data.user.username) || '');
      } catch (err) {
        const status = err.response?.status;
        console.error('[ProfileForm] fetchProfile error', status, err && err.toString && err.toString());
        setNotice({ type: 'error', text: `Failed to load profile${status ? ` (status ${status})` : ''}.` });
      } finally { setLoading(false); }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [token]);

  const saveUsername = async () => {
    if (!username || username.trim().length === 0) { setNotice({ type: 'error', text: 'Username cannot be empty.' }); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/update-username`, { username: username.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setNotice({ type: 'success', text: res.data.message || 'Username updated.' });
      onUsernameUpdated && onUsernameUpdated(username.trim());
    } catch (err) {
      const status = err.response?.status;
      console.error('[ProfileForm] saveUsername error', status, err && err.toString && err.toString());
      setNotice({ type: 'error', text: `Failed to update username${status ? ` (status ${status})` : ''}.` });
    } finally { setLoading(false); }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) { setNotice({ type: 'error', text: 'Current and new passwords are required.' }); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/change-password`, { currentPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      setNotice({ type: 'success', text: res.data.message || 'Password changed.' });
      setCurrentPassword(''); setNewPassword('');
    } catch (err) {
      const status = err.response?.status;
      console.error('[ProfileForm] changePassword error', status, err && err.toString && err.toString());
      setNotice({ type: 'error', text: `Failed to change password${status ? ` (status ${status})` : ''}.` });
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <strong>Email:</strong>
        <div style={{ marginTop: 4, color: '#333', wordBreak: 'break-all' }}>{profile.email}</div>
        {profile.username ? (
          <div style={{ marginTop: 6, color: '#444', fontSize: 13 }}><strong>Username:</strong> <span style={{ marginLeft: 6 }}>{profile.username}</span></div>
        ) : null}
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Username</label>
        <input placeholder="(empty)" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: 8, width: '100%', boxSizing: 'border-box' }} />
      </div>

      {/* Password area is hidden until user requests to change password */}
      {showPasswordForm && (
        <div>
          <hr />
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Current password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ padding: 8, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: 8, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div>
          <button onClick={saveUsername} className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { if (showPasswordForm) { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setNotice(null); } else { onClose(); } }} className="btn" style={{ background: 'transparent' }} disabled={loading}>{showPasswordForm ? 'Cancel' : 'Close'}</button>
          {!showPasswordForm ? (
            <button onClick={() => setShowPasswordForm(true)} className="btn btn-secondary" disabled={loading}>Change password</button>
          ) : (
            <button onClick={changePassword} className="btn btn-primary" disabled={loading}>{loading ? 'Working...' : 'Change password'}</button>
          )}
        </div>
      </div>

      {notice && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: notice.type === 'error' ? '#fee' : '#eef6ff', color: notice.type === 'error' ? '#900' : '#063' }}>{notice.text}</div>
      )}
    </div>
  );
}

