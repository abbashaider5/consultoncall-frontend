/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false, // 🚨 very important
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
