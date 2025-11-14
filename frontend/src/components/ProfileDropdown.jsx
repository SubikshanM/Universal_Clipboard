import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
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
          <div style={styles.row}>
            {/* Use a span with a class so we can force-override dark-mode rules when necessary */}
            <span className="dropdown-heading" style={{ fontSize: 14, fontWeight: 700, color: textColor }}>Signed in as</span>
          </div>
          <div className="dropdown-email" style={{ ...styles.email, color: textColor }}>{email}</div>
          <div style={styles.actions}>
            <button onClick={() => { logout(); setOpen(false); }} className="btn btn-danger" style={{ ...styles.logoutBtn }}>
              Logout
            </button>
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

