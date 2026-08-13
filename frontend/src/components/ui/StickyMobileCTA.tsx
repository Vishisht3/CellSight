import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StickyMobileCTA() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function check() {
      const isMobile = window.innerWidth < 768;
      const nearBottom =
        window.scrollY + window.innerHeight >= document.body.scrollHeight - 200;
      setVisible(isMobile && !nearBottom);
    }
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#0a246a',
      padding: '12px 16px',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.4)',
    }}>
      <button
        onClick={() => navigate('/signup')}
        style={{
          width: '100%',
          background: '#316ac5',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '12px',
          fontSize: 14,
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
        }}
      >
        Get Started Free
      </button>
    </div>
  );
}