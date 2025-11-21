import React, { useState } from 'react';
import AuthScreen from '../components/AuthScreen';
import Header from '../components/Header';
import './landing.css';

export default function Landing() {
  const [mode, setMode] = useState('login'); // login | signup | forgot

  return (
    <div className="landing-root">
      <Header onChangeMode={(m) => setMode(m)} />
      <div className="landing-container">
        <div className="hero">
          <h1 className="hero-title">Welcome to Universal Clipboard</h1>
          <p className="hero-sub">Copy on one device, paste anywhere. Secure, encrypted, and instant.</p>
          <ul className="hero-features">
            <li>End-to-end encrypted clipboard sharing</li>
            <li>Time-limited clips with automatic expiry</li>
            <li>Email-based secure signup & reset</li>
          </ul>
        </div>
        <div className="auth-panel">
          <AuthScreen initialMode={mode} />
        </div>
      </div>
    </div>
  );
}
