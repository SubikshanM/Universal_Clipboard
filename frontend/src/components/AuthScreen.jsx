import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// ThemeToggle moved to fixed global position in App.jsx
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// AuthScreen handles Login, Signup (OTP) and Password Reset (OTP) flows
export default function AuthScreen() {
  const { login, signup, loading, error } = useAuth();
  const { isDark } = useTheme();

  const [isLogin, setIsLogin] = useState(true);
  const [isResetFlow, setIsResetFlow] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup states
  const [signupStep, setSignupStep] = useState('enterDetails'); // enterDetails | enterOtp
  const [otp, setOtp] = useState('');

  // Reset states
  const [resetStep, setResetStep] = useState('enterEmail'); // enterEmail | enterOtp
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI helpers
  const [notice, setNotice] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef(null);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => { const id = setTimeout(() => setAnimateIn(true), 16); return () => clearTimeout(id); }, []);

  useEffect(() => {
    return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); };
  }, []);

  // If the user switches to signup or reset flows, clear the email field so saved credentials
  // don't appear in those contexts. Use a small timeout to overwrite browser autofill when it
  // triggers right after paint.
  useEffect(() => {
    if (!isLogin || isResetFlow) {
      const id = setTimeout(() => setEmail(''), 20);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [isLogin, isResetFlow]);

  const apiBase = () => {
    const rawApi = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
      ? import.meta.env.VITE_API_URL
      : 'https://universal-clipboard-q6po.onrender.com';
    return rawApi.endsWith('/api/auth') ? rawApi : (rawApi.replace(/\/+$/,'') + '/api/auth');
  };

  const startResendCooldown = (secs = 60) => {
    setResendCooldown(secs);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(resendTimerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const API_URL = apiBase();
      if (isResetFlow) {
        await axios.post(`${API_URL}/request-password-reset`, { email });
      } else if (!isLogin) {
        // signup resend
        await axios.post(`${API_URL}/request-signup-otp`, { email, password });
      }
      setNotice({ type: 'info', text: 'OTP resent. Check your email.' });
      startResendCooldown(60);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'Failed to resend OTP.' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitState('loading');
    try {
      const API_URL = apiBase();

      // Password reset flow (takes priority when active)
      if (isResetFlow) {
        if (resetStep === 'enterEmail') {
          await axios.post(`${API_URL}/request-password-reset`, { email });
          setNotice({ type: 'info', text: 'If the email exists, an OTP has been sent. Enter it below.' });
          setResetStep('enterOtp');
          startResendCooldown(60);
          setSubmitState('idle');
          return;
        }

        // resetStep === 'enterOtp' -> finalise reset
        if (!newPassword || newPassword.length < 6) {
          setNotice({ type: 'error', text: 'New password must be at least 6 characters.' });
          setSubmitState('idle');
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setNotice({ type: 'error', text: 'Password confirmation does not match.' });
          setSubmitState('idle');
          return;
        }

        await axios.post(`${API_URL}/reset-password`, { email, otp, newPassword });
        setNotice({ type: 'success', text: 'Password reset successful. Please login with your new password.' });
        try { if (window.__showToast) window.__showToast('Password reset successful. Please login.', 'success'); } catch (e) {}
        // Reset UI and return to login
        setTimeout(() => {
          setIsResetFlow(false);
          setIsLogin(true);
          setResetStep('enterEmail');
          setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setPassword('');
          setSubmitState('idle');
        }, 800);
        return;
      }

      // Login
      if (isLogin) {
        const ok = await login({ email, password });
        if (ok) {
          try { localStorage.setItem('justLoggedIn', '1'); } catch (e) {}
          setSubmitState('success');
          setTimeout(() => setSubmitState('idle'), 600);
        } else {
          setSubmitState('idle');
        }
        return;
      }

      // Signup flow
      if (signupStep === 'enterDetails') {
        // show otp input and request otp
        setSignupStep('enterOtp');
        setNotice({ type: 'info', text: 'Requesting OTP — please wait. It may take several seconds to arrive.' });
        await axios.post(`${API_URL}/request-signup-otp`, { email, password });
        setNotice({ type: 'info', text: 'OTP sent to your email. Enter it below to verify.' });
        startResendCooldown(60);
        setSubmitState('idle');
        return;
      }

      // signupStep === 'enterOtp' -> verify
      if (signupStep === 'enterOtp') {
        await axios.post(`${API_URL}/verify-signup-otp`, { email, otp });
        setNotice({ type: 'success', text: 'Signup verified. Please login with your credentials.' });
        try { if (window.__showToast) window.__showToast('Signup successful — Welcome to Universal Clipboard', 'success'); } catch (e) {}
        setTimeout(() => { setIsLogin(true); setSignupStep('enterDetails'); setOtp(''); setPassword(''); setSubmitState('idle'); }, 1200);
        return;
      }

    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'An error occurred.' });
      setSubmitState('idle');
    }
  };

  // UI rendering
  return (
    <div className="auth-wrapper" style={{ ...styles.wrapper, backgroundColor: isDark ? '#071224' : styles.wrapper.backgroundColor, position: 'relative' }}>
      <div aria-hidden className="auth-bg" />
      <div className={"auth-card glass" + (animateIn ? ' drop-spin' : '')} style={{ ...styles.card, zIndex: 1 }}>
        <h2 style={{ ...styles.header, color: isDark ? '#e6eef8' : styles.header.color }}>
          {isResetFlow ? 'Reset your password' : (isLogin ? 'Login to Universal Clipboard' : 'Create an Account')}
        </h2>

        {notice && (
          <div role="status" aria-live="polite" style={{ ...styles.notice, ...(notice.type === 'success' ? styles.noticeSuccess : {}) }}>
            {notice.text}
          </div>
        )}
        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form} autoComplete={isLogin && !isResetFlow ? 'on' : 'off'}>
          {/* When in signup/reset flows, render hidden dummy inputs to absorb browser autofill so
              saved credentials don't populate visible fields. In login mode we DON'T render
              these so browser autofill can still work normally. */}
          {(!isLogin || isResetFlow) && (
            <>
              <input aria-hidden autoComplete="username" name="fake-username" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
              <input aria-hidden autoComplete="current-password" name="fake-password" type="password" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete={isLogin && !isResetFlow ? 'username' : 'off'}
            name={isLogin && !isResetFlow ? 'email' : 'email-nofill'}
            style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}
          />

          {/* Password input hidden when initiating reset (first step) */}
          {!isResetFlow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                name={isLogin ? 'current-password' : 'new-password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}`, flex: 1 }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          )}

          {/* OTP inputs for signup or reset */}
          {((!isLogin && signupStep === 'enterOtp') || (isResetFlow && resetStep === 'enterOtp')) && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="text" placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} required autoComplete="one-time-code" name="otp" style={{ ...styles.input, flex: 1 }} />
              <button type="button" onClick={handleResend} disabled={resendCooldown > 0} style={{ padding: '8px 10px', borderRadius: '4px', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer' }}>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}</button>
            </div>
          )}

          {/* New password fields shown during reset after OTP requested */}
          {isResetFlow && resetStep === 'enterOtp' && (
            <>
              <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" name="new-password" style={{ ...styles.input }} />
              <input type="password" placeholder="Confirm new password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required autoComplete="new-password" name="confirm-new-password" style={{ ...styles.input }} />
            </>
          )}

          {/* Informational note when OTP step is visible */}
          {((!isLogin && signupStep === 'enterOtp') || (isResetFlow && resetStep === 'enterOtp')) && (
            <p style={{ fontSize: '13px', color: '#666666', marginTop: '6px' }}>Please wait for the OTP — it may take several seconds to arrive. If you don't see it, check your spam folder.</p>
          )}

          <button type="submit" disabled={loading || submitState === 'loading'} className={`btn btn-primary submit-btn ${submitState === 'loading' ? 'loading' : ''} ${submitState === 'success' ? 'success' : ''}`} style={{ ...styles.button, padding: '10px 16px' }} aria-live="polite">
            <span className="btn-inner">
              <span className="btn-label">{isResetFlow ? (resetStep === 'enterEmail' ? 'Send OTP' : 'Reset Password') : (isLogin ? 'Login' : (signupStep === 'enterDetails' ? 'Send OTP' : 'Signup'))}</span>
              <svg className="btn-check" viewBox="0 0 24 24" aria-hidden>
                <path d="M20.285 6.708l-11.39 11.39-5.18-5.18 1.414-1.414 3.766 3.766 9.976-9.977z" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </form>

        <div style={styles.switchText}>
          {isLogin && !isResetFlow ? (
            <>
              <div>
                <span>Don't have an account? </span>
                <button onClick={() => {
                    setIsLogin(prev => !prev);
                    setIsResetFlow(false);
                    // clear sensitive fields when switching modes to avoid autofill/populated values
                    setPassword(''); setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setNotice(null);
                  }} style={{ ...styles.switchButton, color: isDark ? '#9fd3ff' : '#007bff' }}>{'Signup'}</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <span>Don't remember your password? </span>
                <button onClick={() => {
                    setIsResetFlow(true);
                    setResetStep('enterEmail');
                    // clear any credentials so the reset flow starts fresh
                    setPassword(''); setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setNotice(null);
                  }} style={{ ...styles.switchButton, marginLeft: 8 }}>{'Forgot password?'}</button>
              </div>
            </>
          ) : isLogin && isResetFlow ? (
            <div>
              <button onClick={() => { setIsResetFlow(false); setResetStep('enterEmail'); setOtp(''); setNewPassword(''); setConfirmNewPassword(''); }} style={{ ...styles.switchButton, marginLeft: 8 }}>Cancel</button>
            </div>
          ) : (
            <div>
              <span>Already have an account? </span>
              <button onClick={() => { setIsLogin(true); setIsResetFlow(false); setPassword(''); setOtp(''); setNotice(null); }} style={{ ...styles.switchButton, color: isDark ? '#9fd3ff' : '#007bff' }}>Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '20px', paddingRight: '20px', paddingTop: '24px', paddingBottom: '24px', backgroundColor: '#ffffff' },
  card: {
    width: '100%',
    maxWidth: '420px',
    margin: 0,
    padding: '20px',
    borderRadius: '8px',
    position: 'relative',
    textAlign: 'center',
    backgroundColor: 'transparent',
    minHeight: '360px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  header: { marginBottom: '20px', color: '#333' },
  error: { color: 'red', marginBottom: '10px', fontWeight: 'bold' },
  notice: { padding: '10px', borderRadius: '6px', marginBottom: '10px', backgroundColor: '#eef6ff', color: '#043a6b', fontWeight: 600 },
  noticeSuccess: { backgroundColor: '#e6ffef', color: '#0b6b3a' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '16px', width: '100%' },
  button: { padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', marginTop: '10px' },
  switchText: { marginTop: '20px', fontSize: '14px' },
  switchButton: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', padding: '0', fontSize: '14px', textDecoration: 'underline' },
  pwdToggle: { padding: '6px 8px', color: '#007bff', cursor: 'pointer', fontSize: '14px', background: 'transparent' }
};