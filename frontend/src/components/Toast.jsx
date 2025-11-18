import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', duration = 3500, onClose }) => {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => {
      onClose && onClose();
    }, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bg = type === 'success' ? '#0b6b3a' : type === 'error' ? '#b42318' : '#0f62fe';
  const fg = '#fff';

  const containerStyle = {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 99999,
    minWidth: 220,
    maxWidth: 'calc(100vw - 40px)',
    boxShadow: '0 6px 18px rgba(2,6,23,0.2)',
    borderRadius: 8,
    padding: '10px 14px',
    background: bg,
    color: fg,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxSizing: 'border-box'
  };

  const closeBtn = {
    marginLeft: 'auto',
    background: 'transparent',
    border: 'none',
    color: fg,
    fontSize: 16,
    cursor: 'pointer'
  };

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <div style={{ flex: '1 1 auto' }}>{message}</div>
      <button aria-label="Close" style={closeBtn} onClick={() => onClose && onClose()}>×</button>
    </div>
  );
};

export default Toast;
