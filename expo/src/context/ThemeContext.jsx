import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getTheme, saveTheme } from "../utils/ipStorage";

const ThemeContext = createContext(null);

const LIGHT_COLORS = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  elevated: "#F8FAFC",

  text: "#0F172A",
  muted: "#64748B",
  subtle: "#94A3B8",

  border: "#E2E8F0",

  accent: "#111827",
  accentText: "#FFFFFF",

  success: "#16A34A",
  successBg: "#ECFDF5",

  danger: "#DC2626",
  dangerBg: "#FEF2F2",

  info: "#2563EB",
  infoBg: "#EFF6FF",

  input: "#F8FAFC",
};

const DARK_COLORS = {
  background: "#07090C",
  surface: "#0E1116",
  card: "#11151B",
  elevated: "#151A21",

  text: "#F8FAFC",
  muted: "#98A2B3",
  subtle: "#667085",

  border: "#232A34",

  accent: "#F8FAFC",
  accentText: "#090B0F",

  success: "#34D399",
  successBg: "#0C2118",

  danger: "#F87171",
  dangerBg: "#281417",

  info: "#60A5FA",
  infoBg: "#101D30",

  input: "#0F141B",
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTheme = async () => {
      const saved = await getTheme();

      if (!active) {
        return;
      }

      if (saved === "dark" || saved === "light") {
        setThemeState(saved);
      }

      setReady(true);
    };

    loadTheme();

    return () => {
      active = false;
    };
  }, []);

  const setTheme = async (value) => {
    if (value !== "dark" && value !== "light") {
      return;
    }

    setThemeState(value);

    await saveTheme(value);
  };

  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const value = useMemo(
    () => ({
      theme,
      colors,
      isDark: theme === "dark",
      ready,
      setTheme,
    }),
    [theme, colors, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return value;
};
