/**
 * theme.ts — Global theme system for POS
 * Drives colors, dark/light mode, and presets across ALL components.
 * Persists to localStorage. React context provided via ThemeProvider.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

/* ── Preset palettes ──────────────────────────── */
export type ThemePreset  = "ubuntu" | "windows11" | "linux" | "ocean" | "ember" | "custom";
export type ThemeMode    = "light" | "dark" | "system";

export interface Palette {
  accent:      string;   // primary CTA / active
  accentSoft:  string;   // secondary / hover
  accentAlt:   string;   // tertiary accent
  accentText:  string;   // text on accent background
}

const PRESETS: Record<ThemePreset, Palette> = {
  ubuntu: {
    accent:     "#e95420",
    accentSoft: "#f47424",
    accentAlt:  "#772953",
    accentText: "#ffffff",
  },
  windows11: {
    accent:     "#0078d4",
    accentSoft: "#106ebe",
    accentAlt:  "#005a9e",
    accentText: "#ffffff",
  },
  linux: {
    accent:     "#22d3ee",
    accentSoft: "#a78bfa",
    accentAlt:  "#34d399",
    accentText: "#0b0f18",
  },
  ocean: {
    accent:     "#0ea5e9",
    accentSoft: "#38bdf8",
    accentAlt:  "#06b6d4",
    accentText: "#ffffff",
  },
  ember: {
    accent:     "#f59e0b",
    accentSoft: "#fbbf24",
    accentAlt:  "#ef4444",
    accentText: "#ffffff",
  },
  custom: {
    accent:     "#22d3ee",
    accentSoft: "#a78bfa",
    accentAlt:  "#34d399",
    accentText: "#ffffff",
  },
};

export function getPresetPalette(preset: ThemePreset): Palette {
  return PRESETS[preset] ?? PRESETS.linux;
}

/* ── Theme context ────────────────────────────── */
interface ThemeCtx {
  mode:          ThemeMode;
  preset:        ThemePreset;
  isDark:        boolean;
  palette:       Palette;
  customPalette: Palette | null;
  setMode:       (m: ThemeMode)    => void;
  setPreset:     (p: ThemePreset)  => void;
  setCustomPalette: (p: Palette | null) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: "system", preset: "linux", isDark: false,
  palette: PRESETS.linux, customPalette: null,
  setMode: () => {}, setPreset: () => {}, setCustomPalette: () => {},
});

export function useThemeConfig() {
  return useContext(ThemeContext);
}

/* ── CSS variable injection ───────────────────── */
function applyCSS(palette: Palette, dark: boolean) {
  const root = document.documentElement;
  root.style.setProperty("--accent",       palette.accent);
  root.style.setProperty("--accent-soft",  palette.accentSoft);
  root.style.setProperty("--accent-alt",   palette.accentAlt);
  root.style.setProperty("--accent-text",  palette.accentText);
  root.style.setProperty("--page-bg",      dark ? "#070b12"   : "#edf3fa");
  root.style.setProperty("--card-bg",      dark ? "rgba(15,18,28,0.76)" : "rgba(255,255,255,0.86)");
  root.style.setProperty("--card-border",  dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)");
  root.style.setProperty("--text",         dark ? "#f8fafc"   : "#0f172a");
  root.style.setProperty("--text-muted",   dark ? "#7f8ea3"   : "#64748b");
  root.style.setProperty("--divider",      dark ? "rgba(255,255,255,0.07)" : "#e9eef5");
  root.style.setProperty("--sidebar-bg",   dark ? "rgba(10,13,20,0.76)" : "rgba(255,255,255,0.78)");
  root.classList.toggle("dark", dark);
}

/* ── Provider ─────────────────────────────────── */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode,          setModeState]          = useState<ThemeMode>("system");
  const [preset,        setPresetState]        = useState<ThemePreset>("linux");
  const [customPalette, setCustomPaletteState] = useState<Palette | null>(null);
  const [sysDark,       setSysDark]            = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_theme");
      if (saved) {
        const { mode: m, preset: p, custom } = JSON.parse(saved);
        if (m) setModeState(m);
        if (p) setPresetState(p);
        if (custom) setCustomPaletteState(custom);
      }
    } catch {}
  }, []);

  // System dark mode listener
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = mode === "dark" ? true : mode === "light" ? false : sysDark;
  const palette: Palette = customPalette ?? getPresetPalette(preset);

  // Apply CSS variables whenever theme changes
  useEffect(() => { applyCSS(palette, isDark); }, [palette, isDark]);

  const save = useCallback((m: ThemeMode, p: ThemePreset, custom: Palette | null) => {
    localStorage.setItem("pos_theme", JSON.stringify({ mode: m, preset: p, custom }));
  }, []);

  const setMode = (m: ThemeMode) => { setModeState(m); save(m, preset, customPalette); };
  const setPreset = (p: ThemePreset) => { setPresetState(p); setCustomPaletteState(null); save(mode, p, null); };
  const setCustomPalette = (p: Palette | null) => {
    setCustomPaletteState(p);
    if (p) setPresetState("custom");
    save(mode, p ? "custom" : preset, p);
  };

  return React.createElement(ThemeContext.Provider, {
    value: { mode, preset, isDark, palette, customPalette, setMode, setPreset, setCustomPalette },
    children,
  });
};