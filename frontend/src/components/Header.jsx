import React from 'react';

export default function Header({ onChangeMode }) {
  return (
    <header className="site-header" style={styles.header}>
      {/* Absolute logo pinned to the left edge */}
      <div style={styles.logoAbsolute}>
        <img className="site-logo" src="/logo_wb.png" alt="Universal Clipboard logo" style={styles.logoImg} />
      </div>

      <div style={styles.centerRow}>
        <div style={styles.left}>
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
  left: { display: 'flex', flexDirection: 'column' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 16 },
  logoImg: { width: 64, height: 64, objectFit: 'contain', borderRadius: 10, boxShadow: '0 8px 26px rgba(12,20,40,0.08)' },
  logo: { fontSize: 22, fontWeight: 800, marginLeft: 6 },
  // Pin the logo near the top-left corner (slightly inset) so it sits below browser chrome icons
  // Use fixed positioning so the logo is pinned to the viewport's left-top corner
  // (not constrained by the header's centered container). This puts it at the
  // leftmost side of the page even when the header content is centered.
  // Position the fixed logo to align with the header's top padding so it moves up with the header area
  logoAbsolute: { position: 'fixed', left: 8, top: 20, transform: 'none', zIndex: 9999 },
  centerRow: { display: 'flex', alignItems: 'center', gap: 24, width: '100%', justifyContent: 'center', position: 'relative' },
  tagline: { fontSize: 12, color: 'rgba(0,0,0,0.55)' },
  nav: { display: 'flex', gap: 12, alignItems: 'center', position: 'absolute', right: '-392px', top: '50%', transform: 'translateY(-50%)' },
  link: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', fontWeight: 600 },
  cta: { background: 'linear-gradient(90deg,#7c3aed,#06b6d4)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }
};
