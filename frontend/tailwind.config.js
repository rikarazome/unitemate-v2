/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: {
            light: "#ffb380",
            DEFAULT: "#ffa366",
          },
          purple: {
            light: "#b380d3",
            DEFAULT: "#9966cc",
          },
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #ffb380 0%, #ffa366 25%, #b380d3 75%, #9966cc 100%)",
      },
    },
  },
  plugins: [],
};
