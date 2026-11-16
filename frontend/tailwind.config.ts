import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { paper: "#EEF2F4", ink: "#14202B", slate2: "#1F5666", slatelt: "#D6E4E8", marker: "#F2B33D", pencil: "#C2412D", moss: "#2F7D5B", mute: "#5B6B77" },
    fontFamily: { display: ["var(--font-display)", "Georgia", "serif"], sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
