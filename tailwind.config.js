/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: '#3D1A24',
        'primary-dark': '#2A1019',
        'primary-light': '#5C2535',
        accent: '#C8D93A',
        'accent-hover': '#A8B82A',
        // Background & surface
        'bg-app': '#F5F0EB',
        'bg-card': '#FFFFFF',
        'bg-surface': '#F0EBE5',
        'bg-header': '#3D1A24',
        // Text
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B6B6B',
        'text-muted': '#9CA3AF',
        'text-on-primary': '#FFFFFF',
        'text-on-accent': '#1A1A1A',
        // Status
        'status-success': '#22C55E',
        'status-pending': '#F59E0B',
        'status-error': '#EF4444',
        'status-info': '#3B82F6',
        'status-locked': '#6B6B6B',
        // Border
        'border-default': '#E5DDD5',
        'border-focus': '#3D1A24',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};
