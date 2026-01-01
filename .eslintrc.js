module.exports = {
  extends: [
    "react-app",
    "react-app/jest"
  ],
  rules: {
    // 🚫 CI breaking rules disable
    "no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn",

    // ✅ allow dev flexibility
    "no-console": "off",

    // optional
    "react/react-in-jsx-scope": "off"
  }
};