import React, { useState, useEffect, useRef } from 'react';
import AuthScreen from '../components/AuthScreen';
import Header from '../components/Header';
import './landing.css';

export default function Landing() {
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [showAuthMobile, setShowAuthMobile] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);

  // Mouse parallax effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.feature-card, .stat-card').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // 3D Tilt effect on feature cards
  useEffect(() => {
    const cards = document.querySelectorAll('[data-tilt]');

    cards.forEach((card) => {
      const handleMouseMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        card.style.setProperty('--rotate-x', `${rotateX}deg`);
        card.style.setProperty('--rotate-y', `${rotateY}deg`);
      };

      const handleMouseLeave = () => {
        card.style.setProperty('--rotate-x', '0deg');
        card.style.setProperty('--rotate-y', '0deg');
      };

      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', handleMouseLeave);
      };
    });
  }, []);

  return (
    <div className="landing-root">
      {/* Animated floating particles */}
      <div className="particles-container">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${15 + Math.random() * 10}s`
          }} />
        ))}
      </div>
      
      <Header onChangeMode={(m) => setMode(m)} />
      <div className="landing-container">
        <div className="hero" ref={heroRef}>
          <div className="hero-badge" style={{
            transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)`
          }}>✨ Secure & Instant</div>
          <h1 className="hero-title" style={{
            transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`
          }}>
            <span className="gradient-text typing-animation">Universal</span> Clipboard
          </h1>
          <p className="hero-sub" style={{
            transform: `translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)`
          }}>Copy on one device, paste anywhere. Secure, encrypted, and instant.</p>
          
          <div className="feature-cards">
            <div className="feature-card" data-tilt>
              <div className="feature-icon-wrapper">
                <svg className="feature-icon animated-icon lock-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="lockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#667eea"/>
                      <stop offset="50%" stopColor="#764ba2"/>
                      <stop offset="100%" stopColor="#f093fb"/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <circle className="icon-bg-circle" cx="40" cy="40" r="36" fill="url(#lockGradient)" opacity="0.1"/>
                  <circle className="icon-outer-ring rotating-ring" cx="40" cy="40" r="32" stroke="url(#lockGradient)" strokeWidth="2.5" fill="none" strokeDasharray="8 4" opacity="0.5"/>
                  
                  <g filter="url(#glow)">
                    <rect className="lock-body" x="26" y="36" width="28" height="24" rx="4" fill="url(#lockGradient)"/>
                    <path className="lock-shackle" d="M30 36V28C30 22.477 34.477 18 40 18C45.523 18 50 22.477 50 28V36" stroke="url(#lockGradient)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                    <circle className="lock-keyhole" cx="40" cy="48" r="3" fill="white" opacity="0.9"/>
                    <rect className="lock-keyhole-slot" x="38.5" y="48" width="3" height="6" rx="1.5" fill="white" opacity="0.9"/>
                  </g>
                  
                  <g className="sparkle-group">
                    <circle cx="20" cy="20" r="2" fill="#fff" opacity="0.8">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="60" cy="22" r="1.5" fill="#fff" opacity="0.6">
                      <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.5s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="58" cy="60" r="2" fill="#fff" opacity="0.7">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
                    </circle>
                  </g>
                </svg>
                <div className="feature-icon-glow"></div>
              </div>
              <h3 className="feature-title">End-to-End Encrypted</h3>
              <p className="feature-desc">Your data is encrypted before leaving your device</p>
              <div className="feature-shimmer"></div>
            </div>
            <div className="feature-card" data-tilt>
              <div className="feature-icon-wrapper">
                <svg className="feature-icon animated-icon hourglass-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="hourglassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#667eea">
                        <animate attributeName="stop-color" values="#667eea;#764ba2;#f093fb;#667eea" dur="4s" repeatCount="indefinite"/>
                      </stop>
                      <stop offset="50%" stopColor="#764ba2">
                        <animate attributeName="stop-color" values="#764ba2;#f093fb;#667eea;#764ba2" dur="4s" repeatCount="indefinite"/>
                      </stop>
                      <stop offset="100%" stopColor="#f093fb">
                        <animate attributeName="stop-color" values="#f093fb;#667eea;#764ba2;#f093fb" dur="4s" repeatCount="indefinite"/>
                      </stop>
                    </linearGradient>
                    <linearGradient id="sandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffd700"/>
                      <stop offset="50%" stopColor="#ffb84d"/>
                      <stop offset="100%" stopColor="#ff9500"/>
                    </linearGradient>
                    <radialGradient id="glowGradient" cx="50%" cy="50%">
                      <stop offset="0%" stopColor="#667eea" stopOpacity="0.8"/>
                      <stop offset="50%" stopColor="#764ba2" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
                    </radialGradient>
                    <filter id="glowHourglass">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feComponentTransfer in="coloredBlur" result="brighterBlur">
                        <feFuncA type="linear" slope="2"/>
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="brighterBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="innerGlow">
                      <feGaussianBlur stdDeviation="2" result="blur"/>
                      <feComposite in="blur" in2="SourceAlpha" operator="in" result="inGlow"/>
                      <feComponentTransfer in="inGlow">
                        <feFuncA type="linear" slope="1.5"/>
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="inGlow"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Outer glow circle */}
                  <circle cx="40" cy="40" r="38" fill="url(#glowGradient)" opacity="0.3">
                    <animate attributeName="opacity" values="0.2;0.4;0.2" dur="3s" repeatCount="indefinite"/>
                  </circle>
                  
                  <circle className="icon-bg-circle" cx="40" cy="40" r="36" fill="url(#hourglassGradient)" opacity="0.15">
                    <animate attributeName="opacity" values="0.15;0.25;0.15" dur="4s" repeatCount="indefinite"/>
                  </circle>
                  
                  {/* Multiple pulse rings */}
                  <g className="hourglass-pulse-ring">
                    <ellipse cx="40" cy="40" rx="28" ry="32" stroke="url(#hourglassGradient)" strokeWidth="2.5" fill="none" opacity="0.4">
                      <animate attributeName="opacity" values="0.4;0.15;0.4" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="rx" values="28;32;28" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="ry" values="32;36;32" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="strokeWidth" values="2.5;1.5;2.5" dur="2s" repeatCount="indefinite"/>
                    </ellipse>
                    <ellipse cx="40" cy="40" rx="24" ry="28" stroke="url(#hourglassGradient)" strokeWidth="1.5" fill="none" opacity="0.3">
                      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2.5s" repeatCount="indefinite"/>
                      <animate attributeName="rx" values="24;26;24" dur="2.5s" repeatCount="indefinite"/>
                      <animate attributeName="ry" values="28;30;28" dur="2.5s" repeatCount="indefinite"/>
                    </ellipse>
                  </g>
                  
                  <g filter="url(#glowHourglass)">
                    {/* Hourglass frame with enhanced styling */}
                    <path className="hourglass-frame" d="M 30 18 L 50 18 L 50 22 L 46 22 L 46 30 L 40 36 L 46 42 L 46 50 L 50 50 L 50 54 L 30 54 L 30 50 L 34 50 L 34 42 L 40 36 L 34 30 L 34 22 L 30 22 Z" 
                      stroke="url(#hourglassGradient)" strokeWidth="3" fill="rgba(102, 126, 234, 0.05)" strokeLinecap="round" strokeLinejoin="round">
                      <animate attributeName="strokeWidth" values="3;3.5;3" dur="2s" repeatCount="indefinite"/>
                    </path>
                    {/* Inner shadow/depth */}
                    <path d="M 30 18 L 50 18 L 50 22 L 46 22 L 46 30 L 40 36 L 46 42 L 46 50 L 50 50 L 50 54 L 30 54 L 30 50 L 34 50 L 34 42 L 40 36 L 34 30 L 34 22 L 30 22 Z" 
                      stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
                    
                    {/* Top sand with enhanced gradient */}
                    <g className="sand-top">
                      <path d="M 35 23 L 45 23 L 45 28 L 40 33 L 35 28 Z" fill="url(#hourglassGradient)" opacity="0.95">
                        <animate attributeName="d" 
                          values="M 35 23 L 45 23 L 45 28 L 40 33 L 35 28 Z;M 35 23 L 45 23 L 43 25 L 40 28 L 37 25 Z;M 35 23 L 45 23 L 41 24 L 40 24 L 39 24 Z" 
                          dur="4s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.95;1;0.95" dur="2s" repeatCount="indefinite"/>
                      </path>
                      {/* Top sand shimmer */}
                      <ellipse cx="40" cy="25" rx="4" ry="1.5" fill="rgba(255, 255, 255, 0.5)" opacity="0.6">
                        <animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite"/>
                      </ellipse>
                    </g>
                    
                    {/* Falling sand particles - enhanced with glow */}
                    <g className="sand-particles">
                      <circle cx="40" cy="36" r="1.2" fill="url(#glowGradient)" filter="url(#innerGlow)">
                        <animate attributeName="cy" values="28;36;36" dur="1.5s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="1;1;0" dur="1.5s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="1.2;0.8;0.6" dur="1.5s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="38.5" cy="36" r="1" fill="url(#glowGradient)" filter="url(#innerGlow)">
                        <animate attributeName="cy" values="30;36;36" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.9;0.9;0" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="1;0.7;0.5" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="41.5" cy="36" r="1" fill="url(#glowGradient)" filter="url(#innerGlow)">
                        <animate attributeName="cy" values="29;36;36" dur="1.3s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.9;0.9;0" dur="1.3s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="1;0.7;0.5" dur="1.3s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="39.5" cy="36" r="0.9" fill="url(#glowGradient)" filter="url(#innerGlow)">
                        <animate attributeName="cy" values="31;36;36" dur="1.6s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.8;0.8;0" dur="1.6s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="40.5" cy="36" r="0.8" fill="url(#glowGradient)" filter="url(#innerGlow)">
                        <animate attributeName="cy" values="30;36;36" dur="1.4s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.7;0.7;0" dur="1.4s" repeatCount="indefinite"/>
                      </circle>
                    </g>
                    
                    {/* Bottom sand accumulation with enhanced gradient */}
                    <g className="sand-bottom">
                      <path d="M 35 48 L 40 42 L 45 48 L 45 51 L 35 51 Z" fill="url(#hourglassGradient)" opacity="0.95">
                        <animate attributeName="d" 
                          values="M 35 51 L 40 51 L 45 51 L 45 51 L 35 51 Z;M 35 50 L 40 47 L 45 50 L 45 51 L 35 51 Z;M 35 48 L 40 42 L 45 48 L 45 51 L 35 51 Z" 
                          dur="4s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.95;1;0.95" dur="2s" repeatCount="indefinite"/>
                      </path>
                      {/* Bottom sand highlight */}
                      <ellipse cx="40" cy="49" rx="4" ry="1" fill="rgba(255, 255, 255, 0.4)" opacity="0.5">
                        <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1.8s" repeatCount="indefinite"/>
                      </ellipse>
                    </g>
                    
                    {/* Center neck glow - enhanced */}
                    <circle cx="40" cy="36" r="3" fill="url(#glowGradient)" opacity="0.5" filter="url(#innerGlow)">
                      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="r" values="3;3.5;3" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="40" cy="36" r="1.5" fill="rgba(255, 255, 255, 0.8)" opacity="0.8">
                      <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  </g>
                  
                  {/* Sparkles - premium enhanced */}
                  <g className="sparkle-group">
                    <g>
                      <circle cx="20" cy="25" r="2.5" fill="url(#hourglassGradient)" opacity="0.9">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="2.5;3;2.5" dur="1.5s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="20" cy="25" r="1.2" fill="#fff" opacity="1">
                        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite"/>
                      </circle>
                    </g>
                    <g>
                      <circle cx="62" cy="28" r="2" fill="url(#hourglassGradient)" opacity="0.8">
                        <animate attributeName="opacity" values="0.3;0.95;0.3" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="2;2.5;2" dur="2s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="62" cy="28" r="1" fill="#fff" opacity="0.9">
                        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
                      </circle>
                    </g>
                    <g>
                      <circle cx="60" cy="58" r="2.2" fill="url(#hourglassGradient)" opacity="0.85">
                        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="2.2;2.8;2.2" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="60" cy="58" r="1.1" fill="#fff" opacity="0.95">
                        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                    </g>
                    <g>
                      <circle cx="18" cy="52" r="1.8" fill="url(#hourglassGradient)" opacity="0.75">
                        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite"/>
                        <animate attributeName="r" values="1.8;2.3;1.8" dur="2.2s" repeatCount="indefinite"/>
                      </circle>
                      <circle cx="18" cy="52" r="0.9" fill="#fff" opacity="0.85">
                        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite"/>
                      </circle>
                    </g>
                  </g>
                </svg>
                <div className="feature-icon-glow"></div>
              </div>
              <h3 className="feature-title">Auto-Expiry</h3>
              <p className="feature-desc">Time-limited clips with automatic cleanup</p>
              <div className="feature-shimmer"></div>
            </div>
            <div className="feature-card" data-tilt>
              <div className="feature-icon-wrapper">
                <svg className="feature-icon animated-icon email-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="emailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#667eea"/>
                      <stop offset="50%" stopColor="#764ba2"/>
                      <stop offset="100%" stopColor="#00f2fe"/>
                    </linearGradient>
                    <filter id="glow3">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  <circle className="icon-bg-circle" cx="40" cy="40" r="36" fill="url(#emailGradient)" opacity="0.1"/>
                  
                  <g className="email-waves">
                    <path d="M15 40 Q27.5 35, 40 40 T65 40" stroke="url(#emailGradient)" strokeWidth="1.5" fill="none" opacity="0.3">
                      <animate attributeName="d" values="M15 40 Q27.5 35, 40 40 T65 40;M15 40 Q27.5 45, 40 40 T65 40;M15 40 Q27.5 35, 40 40 T65 40" dur="3s" repeatCount="indefinite"/>
                    </path>
                    <path d="M15 45 Q27.5 40, 40 45 T65 45" stroke="url(#emailGradient)" strokeWidth="1.5" fill="none" opacity="0.2">
                      <animate attributeName="d" values="M15 45 Q27.5 40, 40 45 T65 45;M15 45 Q27.5 50, 40 45 T65 45;M15 45 Q27.5 40, 40 45 T65 45" dur="3s" repeatCount="indefinite" begin="0.5s"/>
                    </path>
                  </g>
                  
                  <g filter="url(#glow3)">
                    <rect className="email-body" x="18" y="28" width="44" height="28" rx="3" fill="none" stroke="url(#emailGradient)" strokeWidth="3"/>
                    
                    <path className="email-flap" d="M18 28 L40 44 L62 28" stroke="url(#emailGradient)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                      <animate attributeName="d" values="M18 28 L40 44 L62 28;M18 28 L40 40 L62 28;M18 28 L40 44 L62 28" dur="2s" repeatCount="indefinite"/>
                    </path>
                    
                    <path className="email-top-flap" d="M18 28 L40 38 L62 28" fill="url(#emailGradient)" opacity="0.3">
                      <animate attributeName="opacity" values="0.3;0.5;0.3" dur="2s" repeatCount="indefinite"/>
                    </path>
                  </g>
                  
                  <g className="email-badge">
                    <circle cx="58" cy="32" r="8" fill="#ff3d7f">
                      <animate attributeName="r" values="8;9;8" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                    <path d="M55 32 L57 34 L61 29" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </g>
                  
                  <g className="sparkle-group">
                    <circle cx="22" cy="20" r="2" fill="#fff" opacity="0.8">
                      <animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="58" cy="58" r="1.5" fill="#fff" opacity="0.6">
                      <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.8s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="24" cy="60" r="2" fill="#fff" opacity="0.7">
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
                    </circle>
                  </g>
                </svg>
                <div className="feature-icon-glow"></div>
              </div>
              <h3 className="feature-title">Email-Based Auth</h3>
              <p className="feature-desc">Secure signup with password reset support</p>
              <div className="feature-shimmer"></div>
            </div>
          </div>
          
          {/* Mobile-only CTAs */}
          <div className="mobile-ctas" aria-hidden={false}>
            <button className="mobile-cta-btn mobile-login" onClick={() => { setMode('login'); setShowAuthMobile(true); }}>
              🚀 Login
              <span className="btn-ripple"></span>
            </button>
            <button className="mobile-cta-btn mobile-signup" onClick={() => { setMode('signup'); setShowAuthMobile(true); }}>
              ✨ Signup
              <span className="btn-ripple"></span>
            </button>
          </div>
        </div>
        
        <div className={`auth-panel ${showAuthMobile ? 'mobile-show' : ''}`}>
          <AuthScreen key={mode} initialMode={mode} />
        </div>
      </div>
      {/* Mobile auth modal - only rendered when triggered */}
      {/* No separate modal: auth is shown inline inside `.auth-panel` on mobile when requested. */}
      <div className="dev-info">
        <div className="dev-content">
          <span className="dev-meta">💻 Crafted with ❤️ by <strong>Subikshan Mani</strong></span>
          <div className="dev-links">
            <a className="dev-link" href="https://github.com/SubikshanM" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
              <svg className="dev-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 2.01-.27c.68 0 1.36.09 2.01.27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span className="dev-link-text">GitHub</span>
            </a>
            <a className="dev-link" href="https://www.linkedin.com/in/subikshan-mani-ba0321290/" target="_blank" rel="noopener noreferrer" aria-label="View on LinkedIn">
              <svg className="dev-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.79-1.75-1.764 0-.974.784-1.764 1.75-1.764s1.75.79 1.75 1.764c0 .974-.784 1.764-1.75 1.764zm13.5 11.268h-3v-5.604c0-1.337-.026-3.059-1.864-3.059-1.865 0-2.151 1.454-2.151 2.96v5.703h-3v-10h2.881v1.367h.041c.401-.76 1.379-1.562 2.838-1.562 3.037 0 3.6 2.001 3.6 4.6v5.595z"/>
              </svg>
              <span className="dev-link-text">LinkedIn</span>
            </a>
            <a className="dev-link" href="mailto:subikshan.mailbox@gmail.com" aria-label="Send email">
              <svg className="dev-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5L4 8V6l8 5 8-5v2z" />
              </svg>
              <span className="dev-link-text">Email</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
