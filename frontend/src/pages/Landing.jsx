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
      <div className="dev-info">
        <span className="dev-meta">Developed by <strong>Subikshan Mani</strong></span>
        <span className="dev-sep">•</span>
        <a className="dev-link" href="https://github.com/SubikshanM" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
          <svg className="dev-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 2.01-.27c.68 0 1.36.09 2.01.27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span className="dev-link-text">GitHub</span>
        </a>
        <span className="dev-sep">•</span>
        <a className="dev-link" href="https://www.linkedin.com/in/subikshan-mani-ba0321290/" target="_blank" rel="noopener noreferrer" aria-label="View on LinkedIn">
          <svg className="dev-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.79-1.75-1.764 0-.974.784-1.764 1.75-1.764s1.75.79 1.75 1.764c0 .974-.784 1.764-1.75 1.764zm13.5 11.268h-3v-5.604c0-1.337-.026-3.059-1.864-3.059-1.865 0-2.151 1.454-2.151 2.96v5.703h-3v-10h2.881v1.367h.041c.401-.76 1.379-1.562 2.838-1.562 3.037 0 3.6 2.001 3.6 4.6v5.595z"/>
          </svg>
          <span className="dev-link-text">LinkedIn</span>
        </a>
        <span className="dev-sep">•</span>
        <a className="dev-link" href="mailto:subikshan.mailbox@gmail.com" aria-label="Send email">
          <svg className="dev-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5L4 8V6l8 5 8-5v2z" />
          </svg>
          <span className="dev-link-text">Email</span>
        </a>
      </div>
    </div>
  );
}
