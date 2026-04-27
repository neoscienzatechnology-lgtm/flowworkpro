export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1a56db", 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 600: "#1a56db", 700: "#1e40af", 800: "#1e3a8a" },
        success: { DEFAULT: "#0ea5e9", 100: "#e0f2fe", 600: "#0284c7" }
      }
    }
  },
  plugins: []
}
