import React, { useState, useEffect } from 'react';
import './TermsModal.css';

export default function TermsModal({ open, onClose, onAccept }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) {
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // Restore background scrolling
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      className="terms-modal-overlay"
      onClick={onClose}
    >
      <div className="terms-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="terms-modal-header">
          <div style={{ flex: 1 }}>
            <strong className="terms-modal-title">Terms & Conditions</strong>
            <p style={{ fontSize: '13px', color: '#ffd6ff', marginTop: '6px', marginBottom: 0, fontStyle: 'italic', fontWeight: 500, textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}>Last Updated: December 24, 2025</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="terms-modal-close">✕</button>
        </div>
        <div className="terms-modal-content-wrapper">
          <div className="terms-modal-content">
            <p style={{ marginTop: 0, marginBottom: '8px', fontWeight: 500 }}>
              By accessing or using the Universal Clipboard application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, then you may not access the Service.
            </p>

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#764ba2', marginTop: '10px', marginBottom: '6px' }}>1. Service Description</h3>
            <p style={{ marginBottom: '8px' }}>
              Universal Clipboard is a data synchronization tool designed to securely transfer short, temporary text and links between a user's logged-in devices. Data is stored encrypted and automatically expires after a period set by the user.
            </p>

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#764ba2', marginTop: '10px', marginBottom: '6px' }}>2. User Responsibilities</h3>
            <p style={{ marginBottom: '8px' }}>
              You agree not to use the Service for any unlawful activities or to transmit any material that is libelous, defamatory, or otherwise objectionable. You are responsible for maintaining the security of your account and password.
            </p>

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#764ba2', marginTop: '10px', marginBottom: '6px' }}>3. Data Privacy and Security</h3>
            <p style={{ marginBottom: '6px' }}>
              We prioritize the security and privacy of your data. <strong>All clipboard messages you send are end-to-end encrypted</strong>, meaning we cannot access, read, or view the content of your messages. We store the following non-encrypted information:
            </p>
            <ul style={{ marginLeft: '20px', marginBottom: '8px', lineHeight: '1.5' }}>
              <li>Your email address (for login/OTP).</li>
              <li>Your account's unique identifier (UID).</li>
              <li>Timestamp of terms acceptance.</li>
            </ul>
            <p style={{ marginBottom: '8px' }}>
              Your encrypted clipboard content is stored temporarily on our servers and is automatically purged upon expiration. We have no technical capability to decrypt or access your clipboard data.
            </p>

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#764ba2', marginTop: '10px', marginBottom: '6px' }}>4. Account Termination</h3>
            <p style={{ marginBottom: '8px' }}>
              You may delete your account at any time through the application settings. We do not automatically terminate accounts. However, we reserve the right to suspend or terminate accounts that violate these Terms or engage in activities that compromise the security or integrity of the Service.
            </p>

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#764ba2', marginTop: '10px', marginBottom: '6px' }}>5. Governing Law</h3>
            <p style={{ marginBottom: '8px' }}>
              These Terms shall be governed and construed in accordance with the laws of the jurisdiction where the Service is operated, without regard to its conflict of law provisions.
            </p>

            <p style={{ marginTop: '10px', padding: '10px', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))', borderRadius: '10px', borderLeft: '3px solid #667eea', fontWeight: 600, fontSize: '13px' }}>
              By continuing with the registration process, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
            <div className="terms-modal-checkbox-wrapper">
              <label 
                className="terms-modal-checkbox-label"
                onClick={(e) => {
                  if (e.target.tagName !== 'INPUT') {
                    setChecked(!checked);
                  }
                }}
              >
                <input 
                  type="checkbox" 
                  checked={checked} 
                  onChange={(e) => setChecked(e.target.checked)} 
                  className="terms-modal-checkbox"
                />
                <span className="terms-modal-checkbox-text">I have read and accept the Terms & Conditions</span>
              </label>
            </div>
          </div>
        </div>
        <div className="terms-modal-footer">
          <button onClick={onClose} className="terms-modal-button-cancel">Cancel</button>
          <button onClick={() => { if (checked) onAccept(); }} disabled={!checked} className="terms-modal-button-accept">Accept</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000,
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
};
const modalStyle = {
  width: 'min(680px, 90%)', maxHeight: '82vh', background: 'linear-gradient(135deg, #ff6b35 0%, #ff8c42 50%, #ffa726 100%)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.3)', padding: 0, border: '2px solid rgba(255,255,255,0.4)'
};
const headerStyle = { padding: '16px 20px', borderBottom: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(10px)' };
const closeBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'white', fontWeight: 'bold', lineHeight: 1 };
const innerCardStyle = { padding: 20, background: '#ffffff', borderRadius: 12, margin: 16, flex: '1 1 auto', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const contentStyle = { padding: '8px 0', overflow: 'auto', lineHeight: 1.7, color: '#1a1a1a', fontSize: 15 };
const footerStyle = { padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)' };
const footerBtnStyle = { padding: '10px 18px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500, color: '#333' };
