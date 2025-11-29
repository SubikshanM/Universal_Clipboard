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
        className="avatar-btn btn"
        style={{ ...styles.avatarButton, background: avatarBg, color: isDark ? '#fff' : 'white' }}
        title={email}
      >
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
            <button
              aria-label="Close profile"
              onClick={() => { setProfileOpen(false); try { avatarBtnRef.current && avatarBtnRef.current.focus(); } catch(e) {} }}
              title="Close"
              style={{
                position: 'absolute',
                right: 10,
                top: 8,
                background: 'rgba(255,255,255,0.10)',
                border: 'none',
                color: '#fff',
                fontSize: 20,
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 8,
                lineHeight: 1,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
            >
              ×
            </button>
            <h3 style={{ marginTop: 0, textAlign: 'center', marginBottom: 12, fontSize: 20, fontWeight: 700 }}>Your Profile</h3>
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
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: {
    position: 'relative',
    width: 520,
    maxWidth: '94%',
    background: 'linear-gradient(135deg, #0b1220 0%, #123169 60%)',
    color: '#fff',
    borderRadius: 10,
    padding: 20,
    boxShadow: '0 30px 70px rgba(2,6,23,0.6)'
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
    <div>
      <div style={{ marginBottom: 8 }}>
        <strong style={{ color: 'inherit' }}>Email:</strong>
        <div style={{ marginTop: 4, color: 'inherit', wordBreak: 'break-all', fontWeight: 500 }}>{profile.email}</div>
        <div style={{ marginTop: 8, color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontWeight: 600, color: 'inherit' }}>Username:</strong>
          {profile.username ? (
            <>
              <span style={{ marginLeft: 6, fontWeight: 600, color: 'inherit' }}>{profile.username}</span>
              <button
                type="button"
                onClick={() => {
                  setEditingUsername(true);
                  // set username state to current profile username before editing
                  setUsername(profile.username || '');
                  // focus after state update
                  setTimeout(() => usernameInputRef.current && usernameInputRef.current.focus(), 0);
                }}
                className="btn"
                aria-label="Edit username"
                style={{ marginLeft: 6, padding: '4px 8px', fontSize: 13 }}
              >
                {/* Pencil SVG icon */}
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
              className="btn btn-secondary"
              style={{ marginLeft: 6, padding: '6px 12px', fontSize: 13 }}
            >
              Add username
            </button>
          )}
        </div>

        {/* Username edit container: hidden until user clicks edit */}
        {editingUsername && (
          <div style={{ marginBottom: 8, marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 4, color: 'rgba(255,255,255,0.9)' }}>Username</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={usernameInputRef}
                placeholder="(empty)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ padding: 8, width: '100%', boxSizing: 'border-box', background: '#fff', color: '#000', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }}
              />
            </div>
          </div>
        )}

        {/* Save and Cancel buttons for username editing */}
        {editingUsername && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <button onClick={saveUsername} className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setEditingUsername(false); setUsername((profile && profile.username) || ''); setNotice(null); }} className="btn" style={{ background: '#dc3545', border: '1px solid #dc3545', color: 'white' }} disabled={loading}>Cancel</button>
          </div>
        )}
        
        {/* Change password button - positioned after username section */}
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowPasswordForm(true)} className="btn btn-secondary" disabled={loading || showPasswordForm} style={{ fontSize: 14 }}>Change password</button>
        </div>
      </div>

      {/* Password area is hidden until user requests to change password */}
      {showPasswordForm && (
        <div>
          <hr />
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4, color: 'rgba(255,255,255,0.9)' }}>Current password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ padding: 8, width: '100%', boxSizing: 'border-box', background: '#fff', color: '#000', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }}
                autoComplete="current-password"
                aria-label="Current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(s => !s)}
                className="btn"
                style={{ padding: '6px 10px', alignSelf: 'center', color: 'inherit', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)' }}
                aria-pressed={showCurrentPassword}
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
              >
                {showCurrentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4, color: 'rgba(255,255,255,0.9)' }}>New password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ padding: 8, width: '100%', boxSizing: 'border-box', background: '#fff', color: '#000', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }}
                autoComplete="new-password"
                aria-label="New password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(s => !s)}
                className="btn"
                style={{ padding: '6px 10px', alignSelf: 'center', color: 'inherit', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)' }}
                aria-pressed={showNewPassword}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
        {showPasswordForm && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={changePassword} className="btn btn-primary" disabled={loading}>{loading ? 'Working...' : 'Update password'}</button>
            <button onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setNotice(null); }} className="btn" style={{ background: '#dc3545', border: '1px solid #dc3545', color: 'white' }} disabled={loading}>Cancel</button>
          </div>
        )}
      </div>

      {notice && (
        <div style={{ marginTop: 10, marginLeft: 'auto', marginRight: 'auto', padding: 10, borderRadius: 8, background: notice.type === 'error' ? 'rgba(255,69,58,0.12)' : 'rgba(34,197,94,0.08)', color: notice.type === 'error' ? '#ffb4b4' : '#bbf7d0', textAlign: 'center', maxWidth: 'fit-content' }}>{notice.text}</div>
      )}
      
      {/* Delete account section */}
      <hr style={{ marginTop: 12, borderColor: 'rgba(255,255,255,0.08)' }} />
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <button onClick={() => { setShowDeleteConfirm(true); setNotice(null); }} className="btn" style={{ background: '#9b1c1c', color: 'white', padding: '8px 12px', fontWeight: 700 }}>Delete account</button>
      </div>

      {/* Delete confirmation dialog (inline) */}
      {showDeleteConfirm && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Confirm account deletion</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>To permanently delete your account and all data, type <strong>DELETE</strong> below and manually enter your current password — saved password autofill will be ignored.</div>

          <div style={{ marginBottom: 8, color: 'inherit', fontSize: 13 }}>
            <strong>Email:</strong>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{profile.email}</div>
          </div>

          <input placeholder="Current password (enter manually)" type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} autoComplete="new-password" name="confirm_delete_password" spellCheck={false} style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }} />
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

