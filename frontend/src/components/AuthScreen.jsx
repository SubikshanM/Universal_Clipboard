import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// ThemeToggle moved to fixed global position in App.jsx
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TermsModal from './TermsModal';

// AuthScreen handles Login, Signup (OTP) and Password Reset (OTP) flows
export default function AuthScreen({ initialMode = 'login' }) {
  const { login, signup, loading, error } = useAuth();
  const { isDark } = useTheme();

  // initialMode can be 'login' | 'signup' | 'forgot'
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isResetFlow, setIsResetFlow] = useState(initialMode === 'forgot');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Signup states
  const [signupStep, setSignupStep] = useState('enterEmail'); // enterEmail | enterOtp | enterPassword
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');

  // Reset states
  const [resetStep, setResetStep] = useState('enterEmail'); // enterEmail | enterOtp
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // UI helpers
  const [notice, setNotice] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef(null);
  // Terms modal + consent state for signup final step
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState(null);
  // Removed entrance animation to keep auth panel static on landing page

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

  // If initialMode changes externally, update internal state
  useEffect(() => {
    if (initialMode === 'signup') {
      setIsLogin(false);
      setIsResetFlow(false);
      setSignupStep('enterEmail');
    } else if (initialMode === 'forgot') {
      setIsResetFlow(true);
      setIsLogin(true);
      setResetStep('enterEmail');
    } else {
      setIsLogin(true);
      setIsResetFlow(false);
      setSignupStep('enterEmail');
      setResetStep('enterEmail');
    }
  }, [initialMode]);

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
        // signup resend (email-first flow) - request a signup OTP without password
        await axios.post(`${API_URL}/send-otp`, { email });
      }
      setNotice({ type: 'info', text: 'OTP resent. Check your email.' });
      startResendCooldown(60);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'Failed to resend OTP.' });
    }
  };

  // Verify the password-reset OTP (separate step before entering new password)
  const verifyResetOtp = async () => {
    try {
      setSubmitState('loading');
      const API_URL = apiBase();
      await axios.post(`${API_URL}/verify-password-reset-otp`, { email, otp });
      setNotice({ type: 'success', text: 'OTP verified. Enter your new password below.' });
      setResetStep('enterNewPassword');
      setSubmitState('idle');
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'OTP verification failed.' });
      setSubmitState('idle');
    }
  };

  // Verify signup OTP (email-first flow) before collecting password
  const verifySignupOtp = async () => {
    try {
      setSubmitState('loading');
      const API_URL = apiBase();
      await axios.post(`${API_URL}/verify-signup-otp`, { email, otp });
      setNotice({ type: 'success', text: 'OTP verified. Enter a password to complete signup.' });
      setSignupStep('enterPassword');
      setSubmitState('idle');
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'OTP verification failed.' });
      setSubmitState('idle');
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

      // Signup flow (email-first)
      if (signupStep === 'enterDetails' || signupStep === 'enterEmail') {
        // Request an OTP for the provided email (email-first flow)
        setSignupStep('enterOtp');
        setNotice({ type: 'info', text: 'Requesting OTP — please wait. It may take several seconds to arrive.' });
        await axios.post(`${API_URL}/send-otp`, { email });
        setNotice({ type: 'info', text: 'If the email is valid, an OTP has been sent. Enter it below.' });
        startResendCooldown(60);
        setSubmitState('idle');
        return;
      }

      // signupStep === 'enterOtp' -> verify OTP (do not create user yet)
      if (signupStep === 'enterOtp') {
        await axios.post(`${API_URL}/verify-signup-otp`, { email, otp });
        setNotice({ type: 'success', text: 'OTP verified. Enter a password to complete signup.' });
        setSignupStep('enterPassword');
        setSubmitState('idle');
        return;
      }

      // signupStep === 'enterPassword' -> finalize signup
      if (signupStep === 'enterPassword') {
        // Validate username first
        if (!username || !username.trim()) {
          setNotice({ type: 'error', text: 'Please choose a username.' });
          setSubmitState('idle');
          return;
        }
        // Validate password and confirmation
        if (!password || password.length < 6) {
          setNotice({ type: 'error', text: 'Password must be at least 6 characters.' });
          setSubmitState('idle');
          return;
        }
        if (password !== signupConfirmPassword) {
          setNotice({ type: 'error', text: 'Password and confirmation do not match.' });
          setSubmitState('idle');
          return;
        }

        // Complete signup by sending password + otp + terms acceptance timestamp
  await axios.post(`${API_URL}/complete-signup`, { email, otp, password, username, termsAcceptedAt });
    // Use the user's requested success message
    setNotice({ type: 'success', text: 'Signup successful — welcome to Universal Clipboard' });
    try { if (window.__showToast) window.__showToast('Signup successful — welcome to Universal Clipboard', 'success'); } catch (e) {}
    setTimeout(() => { setIsLogin(true); setSignupStep('enterEmail'); setOtp(''); setPassword(''); setSignupConfirmPassword(''); setUsername(''); setSubmitState('idle'); }, 1200);
        return;
      }

    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error || 'An error occurred.';
      
      // Check for username conflict specifically
      if (status === 409 || (serverMsg && serverMsg.toLowerCase().includes('username') && (serverMsg.toLowerCase().includes('exist') || serverMsg.toLowerCase().includes('taken')))) {
        setNotice({ type: 'error', text: 'This username already exists. Please pick a new one.' });
      } else {
        setNotice({ type: 'error', text: serverMsg });
      }
      setSubmitState('idle');
    }
  };

  // UI rendering
  const isSignupFinal = !isLogin && signupStep === 'enterPassword';

  return (
    <div className="auth-wrapper" style={{ ...styles.wrapper, backgroundColor: isDark ? '#071224' : styles.wrapper.backgroundColor, position: 'relative' }}>
      <TermsModal open={isTermsOpen} onClose={() => setIsTermsOpen(false)} onAccept={() => { setConsentAccepted(true); setTermsAcceptedAt(new Date().toISOString()); setIsTermsOpen(false); }} />
      <div aria-hidden className="auth-bg" />
  <div className={"auth-card"} style={{ ...styles.card, zIndex: 1 }}>
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

          {/* Email field: when in signup flow and past the initial email/OTP steps, show immutable email */}
          {(!isLogin && signupStep !== 'enterEmail') ? (
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: isDark ? '#cfe8ff' : '#333' }}>Email</label>
              <div style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}>{email}</div>
            </div>
          ) : (
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
          )}

          {/* Password input hidden when initiating reset (first step) */}
          {!isResetFlow && (
            isLogin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  name={'current-password'}
                  autoComplete={'current-password'}
                  style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}`, flex: 1 }}
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            ) : (
              // Signup - enter details step shows username then password + confirm password
              signupStep === 'enterPassword' && (
                <>
                  {/* Username - appears between email and password inputs for signup */}
                  <input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    name={'signup-username'}
                    autoComplete={'username'}
                    style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}` }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      name={'signup-password'}
                      autoComplete={'new-password'}
                      style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}`, flex: 1 }}
                    />
                    <button type="button" onClick={() => setShowSignupPassword(s => !s)} aria-pressed={showSignupPassword} aria-label={showSignupPassword ? 'Hide password' : 'Show password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showSignupPassword ? 'Hide' : 'Show'}</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type={showSignupConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                      name={'signup-confirm-password'}
                      autoComplete={'new-password'}
                      style={{ ...styles.input, backgroundColor: isDark ? '#071224' : 'white', color: isDark ? '#e6eef8' : '#111', border: `1px solid ${isDark ? '#18303f' : '#ddd'}`, flex: 1 }}
                    />
                    <button type="button" onClick={() => setShowSignupConfirmPassword(s => !s)} aria-pressed={showSignupConfirmPassword} aria-label={showSignupConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showSignupConfirmPassword ? 'Hide' : 'Show'}</button>
                  </div>
                  {/* Terms & Conditions: open modal and accept to enable signup */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 13, color: isDark ? '#cfe8ff' : '#333' }}>
                      <button type="button" onClick={() => setIsTermsOpen(true)} style={{ ...styles.switchButton, padding: 0 }}>Read Terms & Conditions</button>
                      <span style={{ marginLeft: 8 }}>{consentAccepted ? ' — accepted' : ''}</span>
                    </div>
                    {!consentAccepted && (
                      <div style={{ fontSize: 13, color: '#b33' }}>You must accept to enable Signup</div>
                    )}
                  </div>
                </>
              )
            )
          )}

          {/* OTP inputs for signup or reset */}
          {((!isLogin && signupStep === 'enterOtp') || (isResetFlow && resetStep === 'enterOtp')) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" placeholder="Enter OTP" value={otp} onChange={e => setOtp(e.target.value)} required autoComplete="one-time-code" name="otp" style={{ ...styles.input, flex: 1 }} />
                <button type="button" onClick={handleResend} disabled={resendCooldown > 0} style={{ padding: '8px 10px', borderRadius: '4px', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer' }}>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}</button>
              </div>
              {/* When in reset OTP step, show a Verify OTP button so users must explicitly verify before entering new password */}
              {isResetFlow && resetStep === 'enterOtp' && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {(() => {
                    const isDisabled = submitState === 'loading';
                    // reuse existing btn / btn-primary / submit-btn classes so the button
                    // matches the Send OTP / main CTA styling (landing.css overrides apply)
                    return (
                      <button
                        type="button"
                        onClick={verifyResetOtp}
                        disabled={isDisabled}
                        className={`btn btn-primary submit-btn ${isDisabled ? 'loading' : ''}`}
                        style={{ padding: '8px 16px', minWidth: 140 }}
                      >
                        Verify OTP
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* New password fields shown during reset after OTP verified */}
          {isResetFlow && resetStep === 'enterNewPassword' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type={showNewPassword ? 'text' : 'password'} placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" name="new-password" style={{ ...styles.input, flex: 1 }} />
                <button type="button" onClick={() => setShowNewPassword(s => !s)} aria-pressed={showNewPassword} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showNewPassword ? 'Hide' : 'Show'}</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type={showConfirmNewPassword ? 'text' : 'password'} placeholder="Confirm new password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required autoComplete="new-password" name="confirm-new-password" style={{ ...styles.input, flex: 1 }} />
                <button type="button" onClick={() => setShowConfirmNewPassword(s => !s)} aria-pressed={showConfirmNewPassword} aria-label={showConfirmNewPassword ? 'Hide confirm password' : 'Show confirm password'} style={{ ...styles.pwdToggle, background: 'none', border: 'none' }}>{showConfirmNewPassword ? 'Hide' : 'Show'}</button>
              </div>
            </>
          )}

          {/* Informational note when OTP step is visible */}
          {((!isLogin && signupStep === 'enterOtp') || (isResetFlow && resetStep === 'enterOtp')) && (
            <p style={{ fontSize: '13px', color: '#666666', marginTop: '6px' }}>Please wait for the OTP — it may take several seconds to arrive. If you don't see it, check your spam folder.</p>
          )}

          {!(isResetFlow && resetStep === 'enterOtp') && (
            <button type="submit" disabled={loading || submitState === 'loading' || (isSignupFinal && !consentAccepted)} className={`btn btn-primary submit-btn ${submitState === 'loading' ? 'loading' : ''} ${submitState === 'success' ? 'success' : ''}`} style={{ ...styles.button, padding: '10px 16px' }} aria-live="polite">
              <span className="btn-inner">
                <span className="btn-label">{isResetFlow ? (resetStep === 'enterEmail' ? 'Send OTP' : (resetStep === 'enterNewPassword' ? 'Reset Password' : '')) : (isLogin ? 'Login' : (signupStep === 'enterEmail' || signupStep === 'enterDetails' ? 'Send OTP' : (signupStep === 'enterOtp' ? 'Verify OTP' : 'Signup')))}</span>
                <svg className="btn-check" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20.285 6.708l-11.39 11.39-5.18-5.18 1.414-1.414 3.766 3.766 9.976-9.977z" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          )}
        </form>

        <div style={styles.switchText}>
          {isLogin && !isResetFlow ? (
            <>
              <div style={{ marginTop: 8 }}>
                <span>Don't you remember your password? </span>
                <button onClick={() => {
                    setIsResetFlow(true);
                    setResetStep('enterEmail');
                    // clear any credentials so the reset flow starts fresh
                    setPassword(''); setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setSignupConfirmPassword(''); setNotice(null);
                    setShowSignupPassword(false); setShowSignupConfirmPassword(false);
                  }} style={{ ...styles.switchButton, marginLeft: 8 }}>{'Forgot password?'}</button>
              </div>
            </>
          ) : isLogin && isResetFlow ? (
            <div>
              <button onClick={() => { setIsResetFlow(false); setResetStep('enterEmail'); setOtp(''); setNewPassword(''); setConfirmNewPassword(''); setSignupConfirmPassword(''); setShowSignupPassword(false); setShowSignupConfirmPassword(false); }} style={{ ...styles.switchButton, marginLeft: 8 }}>Cancel</button>
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