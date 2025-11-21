import React, { useEffect, useRef } from 'react';

export default function Header({ onChangeMode }) {
  const leftRef = useRef(null);
  const logoWrapRef = useRef(null);

  useEffect(() => {
    function sync() {
      const left = leftRef.current;
      const wrap = logoWrapRef.current;
      if (!left || !wrap) return;
      const h = Math.round(left.getBoundingClientRect().height || 0);
      if (h > 0) {
        // make wrapper square using left column height
        wrap.style.height = `${h}px`;
        wrap.style.width = `${h}px`;
        // adjust inner img to fit with small padding
        const img = wrap.querySelector('img');
        if (img) {
          const pad = Math.max(6, Math.round(h * 0.08));
          const imgSize = Math.max(32, h - pad * 2);
          img.style.width = `${imgSize}px`;
          img.style.height = `${imgSize}px`;
        }
      }
    }
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return (
    <header className="site-header" style={styles.header}>
      {/* Absolute logo pinned to the left edge */}
      <div style={styles.logoAbsolute}>
        <span className="site-logo-wrap" style={styles.logoWrap} ref={logoWrapRef}>
          <img className="site-logo" src="/logo_wb.png" alt="Universal Clipboard logo" style={styles.logoImg} />
        </span>
      </div>

      <div style={styles.centerRow}>
        <div style={styles.left} ref={leftRef}>
          <div style={styles.logo} aria-hidden>Universal&nbsp;<span style={{ color: '#06b6d4' }}>Clipboard</span></div>
          <div style={styles.tagline}>Paste anywhere, instantly</div>
        </div>
        <nav style={styles.nav}>
          <button className="header-cta" onClick={() => onChangeMode && onChangeMode('login')} style={{ ...styles.cta, marginRight: 8 }}>Login</button>
          <button className="header-cta" onClick={() => onChangeMode && onChangeMode('signup')} style={{ ...styles.cta }}>Signup</button>
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 28px', maxWidth: '1200px', margin: '0 auto' },
  left: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 16 },
    logoImg: { width: 64, height: 64, objectFit: 'contain', borderRadius: 10, boxShadow: '0 8px 26px rgba(12,20,40,0.08)', background: '#fff' },
    logoWrap: { display: 'inline-block', width: 76, height: 76, padding: 6, borderRadius: 14, boxShadow: '0 8px 26px rgba(12,20,40,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 30, fontWeight: 800, marginLeft: 0, textAlign: 'center' },
  // Pin the logo near the top-left corner (slightly inset) so it sits below browser chrome icons
  // Use fixed positioning so the logo is pinned to the viewport's left-top corner
  // (not constrained by the header's centered container). This puts it at the
  // leftmost side of the page even when the header content is centered.
  // Position the fixed logo to align with the header's top padding so it moves up with the header area
  logoAbsolute: { position: 'fixed', left: 8, top: 20, transform: 'none', zIndex: 9999 },
  centerRow: { display: 'flex', alignItems: 'center', gap: 24, width: '100%', justifyContent: 'center', position: 'relative' },
  tagline: { fontSize: 14, color: 'rgba(0,0,0,0.55)' },
  nav: { display: 'flex', gap: 12, alignItems: 'center', position: 'absolute', right: '-392px', top: '50%', transform: 'translateY(-50%)' },
  link: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', fontWeight: 600 },
  cta: { background: 'linear-gradient(90deg,#7c3aed,#06b6d4)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }
};
