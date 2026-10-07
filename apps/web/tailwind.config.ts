import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#009966',
          action: '#007A52',
          ink: '#071F18',
          paper: '#F7F5EF',
          mint: '#EAF7F0',
          secondary: '#587168',
          border: '#DBE3DC',
        },
        emerald: {
          50: '#EAF7F0', 100: '#D8F0E2', 200: '#AFE0C5', 300: '#7BCCAA',
          400: '#30AD7F', 500: '#009966', 600: '#007A52', 700: '#006442',
          800: '#075536', 900: '#06432C',
        },
      },
      fontFamily: { sans: ['Plus Jakarta Sans', 'Inter', 'Arial', 'sans-serif'] },
      borderRadius: { xl: '10px', '2xl': '18px', '3xl': '22px' },
    },
  },
  plugins: [],
};

export default config;
