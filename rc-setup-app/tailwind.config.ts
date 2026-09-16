import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0B0D0A", // page background
          1: "#14170F", // card
          2: "#1C2016", // raised card / active field
        },
        line: "#262B20",
        accent: "#58D6C4", // telemetry teal — primary readouts
        warn: "#E8A33D", // amber — computed/highlighted values
        ink: {
          primary: "#EDEFE6",
          secondary: "#8B9080",
          muted: "#5B5F53",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
