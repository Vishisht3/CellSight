/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 2007 Windows enterprise silver/blue system palette
        win: {
          // Header gradients
          hdr1: '#dce6f5',
          hdr2: '#b8cfe8',
          hdr3: '#6f9fcf',
          // Panel backgrounds
          panel: '#f0f4f8',
          panelDark: '#d6e0ec',
          // Borders
          border: '#7f9db9',
          borderLight: '#b8cfe8',
          // Active / selected
          active: '#316ac5',
          activeHover: '#4a7fd4',
          // Title bar
          titleStart: '#0a246a',
          titleEnd:   '#a6caf0',
          // Button faces
          btnFace:  '#ece9d8',
          btnHover: '#dff0ff',
          // Text
          text:     '#1a1a1a',
          textMid:  '#4a4a4a',
          textLight:'#6a6a6a',
          // Status colours
          ok:    '#006400',
          warn:  '#b87000',
          error: '#c00000',
          info:  '#316ac5',
        },
      },
      fontFamily: {
        ui: [
          'Tahoma',
          'Segoe UI',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel:  'inset 0 1px 0 #fff, 0 1px 3px rgba(0,0,0,0.25)',
        raised: '2px 2px 4px rgba(0,0,0,0.35)',
        inset:  'inset 1px 1px 3px rgba(0,0,0,0.3)',
        btn:    'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.15), 1px 1px 2px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        win: '3px',
      },
    },
  },
  plugins: [],
};
