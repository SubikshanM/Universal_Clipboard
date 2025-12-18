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
  const { user, logout, token, updateUser, refreshUserProfile } = useAuth();
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

  // Close modal on Escape key when profile modal is open
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    if (profileOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileOpen]);

  // Refresh user profile when component mounts to get latest data including username
  useEffect(() => {
    if (token && (!user || !user.username)) {
      refreshUserProfile();
    }
  }, [token, refreshUserProfile]);

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
  // Use username first letter if available, otherwise use email first letter
  const displayName = user?.username || email;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarBg = isDark ? '#1f2937' : '#333';
  // Always use a white dropdown background as requested, with black text for maximum contrast
  const dropdownBg = 'white';
  const textColor = '#000';
  const avatarBtnRef = useRef();

  return (
    <div ref={ref} style={styles.container}>
      <button
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        ref={avatarBtnRef}
        className="avatar-btn btn profile-avatar-enhanced"
        style={{ 
          ...styles.avatarButton,
          background: isDark 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'visible'
        }}
        title={email}
      >
        {/* Animated gradient border ring */}
        <span className="avatar-ring"></span>
        {/* Glowing pulse effect */}
        <span className="avatar-glow"></span>
        {/* Status indicator dot */}
        <span className="avatar-status-dot"></span>
        <span style={styles.avatarText}>{initial}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Profile menu" style={{ ...styles.dropdown, background: 'linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe)', backgroundSize: '300% 300%', animation: 'gradientShift 4s ease infinite', borderColor: '#4f46e5', boxShadow: '0 10px 25px rgba(79, 70, 229, 0.3)' }}>
          <style>{`
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { setProfileOpen(true); setOpen(false); }} className="btn btn-primary" style={{ padding: '8px 12px', width: '100%', background: 'rgba(255,255,255,0.9)', color: '#4338ca', border: 'none', fontWeight: '600' }}>Profile</button>
            <button onClick={() => { logout(); setOpen(false); }} className="btn btn-danger" style={{ padding: '8px 12px', width: '100%', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', fontWeight: '600' }}>Logout</button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileOpen && (
        <div role="dialog" aria-modal="true" style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <style>{`
              @keyframes modalSlideIn {
                from {
                  opacity: 0;
                  transform: scale(0.95) translateY(-20px);
                }
                to {
                  opacity: 1;
                  transform: scale(1) translateY(0);
                }
              }
            `}</style>
            <button
              aria-label="Close profile"
              onClick={() => { setProfileOpen(false); try { avatarBtnRef.current && avatarBtnRef.current.focus(); } catch(e) {} }}
              title="Close"
              style={{
                position: 'absolute',
                right: 20,
                top: 20,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontSize: 22,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 10,
                lineHeight: 1,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease',
                fontWeight: '300'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.25)';
                e.target.style.transform = 'scale(1.1) rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.15)';
                e.target.style.transform = 'scale(1) rotate(0deg)';
              }}
            >
              ×
            </button>
            <div style={{
              textAlign: 'center',
              marginBottom: 28
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                fontWeight: '700',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.3)'
              }}>
                {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h3 style={{ 
                margin: 0, 
                fontSize: 24, 
                fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}>Your Profile</h3>
            </div>
            <ProfileForm token={token} user={user} onClose={() => setProfileOpen(false)} updateUser={updateUser} />
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
  backdrop: { 
    position: 'fixed', 
    inset: 0, 
    background: 'rgba(0,0,0,0.6)', 
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 2000,
    padding: '20px'
  },
  modal: {
    position: 'relative',
    width: 540,
    maxWidth: '94%',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
    color: '#fff',
    borderRadius: 20,
    padding: 32,
    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    animation: 'modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

// Attach modal styles to exported styles for reuse
styles.modalBackdrop = modalStyles.backdrop;
styles.modal = modalStyles.modal;

function ProfileForm({ token, user, onClose, updateUser }) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  // Initialize displayed profile from client-side AuthContext user so email shows immediately
  const [profile, setProfile] = useState({ email: (user && user.email) || '', username: (user && user.username) || '' });
  const [username, setUsername] = useState((user && user.username) || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const usernameInputRef = React.useRef();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        if (status === 404) {
          setNotice({ type: 'error', text: 'Profile endpoint not found - backend needs to be redeployed with new endpoints.' });
        } else if (status === 500) {
          setNotice({ type: 'error', text: 'Server error - backend may need to be redeployed.' });
        } else {
          setNotice({ type: 'error', text: `Failed to load profile${status ? ` (status ${status})` : ''}.` });
        }
      } finally { setLoading(false); }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [token]);

  const saveUsername = async () => {
    if (!username || username.trim().length === 0) { setNotice({ type: 'error', text: 'Username cannot be empty.' }); return; }
    setLoading(true);
    try {
      console.log('[ProfileForm] Attempting to save username:', username.trim(), 'to URL:', `${API_URL}/update-username`);
      const res = await axios.post(`${API_URL}/update-username`, { username: username.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setNotice({ type: 'success', text: res.data.message || 'Username updated.' });
      // Update the profile state to reflect the new username
      setProfile(prev => ({ ...prev, username: username.trim() }));
      // Hide the edit form
      setEditingUsername(false);
      // Update the AuthContext user data so the avatar initial updates immediately
      updateUser({ username: username.trim() });
      } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      console.error('[ProfileForm] saveUsername error', status, serverMsg || err && err.toString && err.toString());
      console.error('[ProfileForm] Full error object:', err);
      
      if (status === 500) {
        setNotice({ type: 'error', text: 'Server error - the backend may not be updated with the new profile endpoints. Please redeploy the backend.' });
      } else if (status === 409 || (serverMsg && serverMsg.toLowerCase().includes('username') && (serverMsg.toLowerCase().includes('exist') || serverMsg.toLowerCase().includes('taken')))) {
        setNotice({ type: 'error', text: 'This username already exists. Please pick a new one.' });
      } else {
        setNotice({ type: 'error', text: serverMsg ? `${serverMsg} (status ${status})` : `Failed to update username${status ? ` (status ${status})` : ''}.` });
      }
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
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      console.error('[ProfileForm] changePassword error', status, serverMsg || err && err.toString && err.toString());
      setNotice({ type: 'error', text: serverMsg ? `${serverMsg} (status ${status})` : `Failed to change password${status ? ` (status ${status})` : ''}.` });
    } finally { setLoading(false); }
  };

  const deleteAccount = async () => {
    // Require confirmation phrase and current password
    if (deleteConfirmText !== 'DELETE') {
      setNotice({ type: 'error', text: "Type 'DELETE' in the confirmation box to proceed." });
      return;
    }
    if (!deletePassword) {
      setNotice({ type: 'error', text: 'Please enter your current password to confirm.' });
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await axios.post(`${API_URL}/delete-account`, { currentPassword: deletePassword }, { headers: { Authorization: `Bearer ${token}` } });
      // On success, logout and close modal
      try { logout(); } catch (e) {}
      setNotice({ type: 'success', text: res.data.message || 'Account deleted.' });
      setTimeout(() => {
        onClose && onClose();
      }, 800);
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      console.error('[ProfileForm] deleteAccount error', status, serverMsg || err && err.toString && err.toString());
      setNotice({ type: 'error', text: serverMsg ? `${serverMsg} (status ${status})` : `Failed to delete account${status ? ` (status ${status})` : ''}.` });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '20px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            fontSize: '13px', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '8px'
          }}>📧 Email</label>
          <div style={{ 
            padding: '12px 16px', 
            background: 'rgba(255,255,255,0.12)', 
            borderRadius: '10px',
            wordBreak: 'break-all', 
            fontWeight: 500,
            fontSize: '15px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>{profile.email}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            fontSize: '13px', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '8px'
          }}>👤 Username</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {profile.username ? (
              <>
                <div style={{ 
                  flex: 1,
                  padding: '12px 16px', 
                  background: 'rgba(255,255,255,0.12)', 
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '15px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>{profile.username}</div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUsername(true);
                    setUsername(profile.username || '');
                    setTimeout(() => usernameInputRef.current && usernameInputRef.current.focus(), 0);
                  }}
                  aria-label="Edit username"
                  style={{ 
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                    <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.41l-2.34-2.34a1.003 1.003 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingUsername(true);
                  setUsername('');
                  setTimeout(() => usernameInputRef.current && usernameInputRef.current.focus(), 0);
                }}
                style={{ 
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
              >
                ➕ Add username
              </button>
            )}
          </div>
        </div>

        {/* Username edit container */}
        {editingUsername && (
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <input
              ref={usernameInputRef}
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ 
                padding: '12px 16px', 
                width: '100%', 
                boxSizing: 'border-box', 
                background: 'rgba(255,255,255,0.95)', 
                color: '#111', 
                borderRadius: '10px', 
                border: '2px solid rgba(59, 130, 246, 0.5)',
                fontSize: '15px',
                fontWeight: '500',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(59, 130, 246, 0.8)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button 
                onClick={saveUsername} 
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: loading ? '#666' : 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
              >{loading ? '💾 Saving...' : '✓ Save'}</button>
              <button 
                onClick={() => { setEditingUsername(false); setUsername((profile && profile.username) || ''); setNotice(null); }} 
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(255,255,255,0.15)')}
                onMouseLeave={(e) => !loading && (e.target.style.background = 'rgba(255,255,255,0.1)')}
              >✕ Cancel</button>
            </div>
          </div>
        )}
        
        {/* Change password button */}
        {!editingUsername && (
          <div style={{ marginTop: 16 }}>
            <button 
              onClick={() => setShowPasswordForm(true)} 
              disabled={loading || showPasswordForm} 
              style={{ 
                width: '100%',
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '10px',
                color: '#1e40af',
                fontWeight: '600',
                fontSize: '14px',
                cursor: (loading || showPasswordForm) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: (loading || showPasswordForm) ? 0.5 : 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                if (!(loading || showPasswordForm)) {
                  e.target.style.background = '#ffffff';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!(loading || showPasswordForm)) {
                  e.target.style.background = 'rgba(255,255,255,0.95)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }
              }}
            >🔐 Change password</button>
          </div>
        )}
      </div>

      {/* Password form */}
      {showPasswordForm && (
        <div style={{
          marginTop: 16,
          padding: '20px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              fontSize: '13px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'rgba(255,255,255,0.7)'
            }}>Current password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ 
                  padding: '12px 75px 12px 16px', 
                  width: '100%',
                  boxSizing: 'border-box', 
                  background: 'rgba(255,255,255,0.95)', 
                  color: '#111', 
                  borderRadius: '10px', 
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  fontSize: '15px',
                  outline: 'none'
                }}
                autoComplete="current-password"
                aria-label="Current password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrentPassword(s => !s)}
                style={{ 
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '6px 12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                aria-pressed={showCurrentPassword}
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.25)';
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.15)';
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }}
              >
                {showCurrentPassword ? '👁️' : '👁️'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: 8, 
              fontSize: '13px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'rgba(255,255,255,0.7)'
            }}>New password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ 
                  padding: '12px 75px 12px 16px', 
                  width: '100%',
                  boxSizing: 'border-box', 
                  background: 'rgba(255,255,255,0.95)', 
                  color: '#111', 
                  borderRadius: '10px', 
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  fontSize: '15px',
                  outline: 'none'
                }}
                autoComplete="new-password"
                aria-label="New password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNewPassword(s => !s)}
                style={{ 
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '6px 12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                aria-pressed={showNewPassword}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.25)';
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(59, 130, 246, 0.15)';
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }}
              >
                {showNewPassword ? '👁️' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button 
              onClick={changePassword} 
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: loading ? '#666' : 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
            >{loading ? '⏳ Working...' : '✓ Update password'}</button>
            <button 
              onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setNotice(null); }} 
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.background = 'rgba(255,255,255,0.15)')}
              onMouseLeave={(e) => !loading && (e.target.style.background = 'rgba(255,255,255,0.1)')}
            >✕ Cancel</button>
          </div>
        </div>
      )}

      {notice && (
        <div style={{ 
          marginTop: 16, 
          padding: '12px 16px', 
          borderRadius: '10px', 
          background: notice.type === 'error' 
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))' 
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))', 
          color: notice.type === 'error' ? '#fecaca' : '#d1fae5', 
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '14px',
          border: `1px solid ${notice.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          boxShadow: notice.type === 'error' 
            ? '0 4px 12px rgba(239, 68, 68, 0.2)' 
            : '0 4px 12px rgba(16, 185, 129, 0.2)'
        }}>
          {notice.type === 'error' ? '⚠️ ' : '✓ '}{notice.text}
        </div>
      )}
      
      {/* Delete account section */}
      <div style={{ 
        marginTop: 20, 
        paddingTop: 20,
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button 
          onClick={() => { setShowDeleteConfirm(true); setNotice(null); }} 
          style={{ 
            width: '100%',
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
            color: 'white', 
            padding: '12px 20px', 
            fontWeight: 700,
            fontSize: '14px',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
          }}
        >🗑️ Delete account</button>
      </div>

      {/* Delete confirmation dialog (inline) */}
      {showDeleteConfirm && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Confirm account deletion</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>To permanently delete your account and all data, type <strong>DELETE</strong> below and enter your current password (you can use saved password autofill).</div>

          <div style={{ marginBottom: 8, color: 'inherit', fontSize: 13 }}>
            <strong>Email:</strong>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{profile.email}</div>
          </div>

          <input 
            placeholder="Current password" 
            type="password" 
            value={deletePassword} 
            onChange={e => setDeletePassword(e.target.value)} 
            autoComplete="current-password" 
            name="password"
            id="delete-password-field"
            spellCheck={false} 
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }} 
          />
          <input placeholder="Type DELETE to confirm" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={deleteAccount} className="btn btn-danger" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm delete'}</button>
            <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); }} className="btn">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

