import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode   = "light" | "dark" | "system";
export type ThemePreset = "ubuntu" | "windows11" | "linux" | "ocean" | "ember" | "custom";

export interface ThemePalette {
  accent:     string;
  accentSoft: string;
  accentAlt:  string;
}

export interface PresetMeta {
  label:       string;
  description: string;
  palette:     ThemePalette;
  ambientA:    string;
  ambientB:    string;
  ambientC:    string;
  darkBg:      string;
  lightBg:     string;
}

export const PRESET_CONFIGS: Record<Exclude<ThemePreset, "custom">, PresetMeta> = {
  ubuntu: {
    label: "Ubuntu", description: "Canonical flame & aubergine",
    palette: { accent: "#e95420", accentSoft: "#f47424", accentAlt: "#772953" },
    ambientA: "#e95420", ambientB: "#772953", ambientC: "#f47424",
    darkBg: "#180600", lightBg: "#fff7f4",
  },
  windows11: {
    label: "Windows 11", description: "Microsoft Fluent UI & Mica glass",
    palette: { accent: "#0078d4", accentSoft: "#1890ff", accentAlt: "#005a9e" },
    ambientA: "#0078d4", ambientB: "#005a9e", ambientC: "#0099bc",
    darkBg: "#202020", lightBg: "#f3f3f3",
  },
  linux: {
    label: "Linux", description: "Cyberpunk neon terminal glow",
    palette: { accent: "#22d3ee", accentSoft: "#a78bfa", accentAlt: "#34d399" },
    ambientA: "#22d3ee", ambientB: "#a78bfa", ambientC: "#34d399",
    darkBg: "#070b12", lightBg: "#edf3fa",
  },
  ocean: {
    label: "Ocean", description: "Deep sea blues & tropical teal",
    palette: { accent: "#0ea5e9", accentSoft: "#38bdf8", accentAlt: "#06b6d4" },
    ambientA: "#0ea5e9", ambientB: "#06b6d4", ambientC: "#38bdf8",
    darkBg: "#030d1f", lightBg: "#f0f9ff",
  },
  ember: {
    label: "Ember", description: "Warm amber & fire hues",
    palette: { accent: "#f59e0b", accentSoft: "#fbbf24", accentAlt: "#ef4444" },
    ambientA: "#f59e0b", ambientB: "#ef4444", ambientC: "#fbbf24",
    darkBg: "#1a0f00", lightBg: "#fffbeb",
  },
};

const FONT_MAP: Record<ThemePreset, string> = {
  ubuntu:    "'Ubuntu', 'Noto Sans', system-ui, sans-serif",
  windows11: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
  linux:     "'Sora', 'DM Sans', system-ui, sans-serif",
  ocean:     "'Inter', 'DM Sans', system-ui, sans-serif",
  ember:     "'Nunito', 'DM Sans', system-ui, sans-serif",
  custom:    "'Sora', 'DM Sans', system-ui, sans-serif",
};

export function getPresetPalette(preset: ThemePreset, custom?: ThemePalette | null): ThemePalette {
  if (preset === "custom" && custom) return custom;
  return PRESET_CONFIGS[preset as Exclude<ThemePreset, "custom">]?.palette ?? PRESET_CONFIGS.linux.palette;
}

interface ThemeConfig { mode: ThemeMode; preset: ThemePreset; }
type CustomPalette = ThemePalette | null;

interface ThemeContextValue {
  mode:   ThemeMode;
  preset: ThemePreset;
  isDark: boolean;
  customPalette: CustomPalette;
  palette: ThemePalette;
  setMode:          (mode: ThemeMode)        => void;
  setPreset:        (preset: ThemePreset)    => void;
  setCustomPalette: (palette: CustomPalette) => void;
}

const STORAGE_KEY       = "pos_theme_config";
const CUSTOM_PALETTE_KEY = "pos_theme_custom_palette";
const DEFAULT_THEME: ThemeConfig = { mode: "system", preset: "windows11" };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return { mode: parsed.mode ?? DEFAULT_THEME.mode, preset: parsed.preset ?? DEFAULT_THEME.preset };
  } catch { return DEFAULT_THEME; }
}

function getSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme]         = useState<ThemeConfig>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);
  const [customPalette, setCustomPaletteState] = useState<CustomPalette>(() => {
    try { const raw = localStorage.getItem(CUSTOM_PALETTE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); }, [theme]);
  useEffect(() => {
    if (customPalette) localStorage.setItem(CUSTOM_PALETTE_KEY, JSON.stringify(customPalette));
    else localStorage.removeItem(CUSTOM_PALETTE_KEY);
  }, [customPalette]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    setSystemDark(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const isDark  = theme.mode === "system" ? systemDark : theme.mode === "dark";
  const palette = customPalette || getPresetPalette(theme.preset);

  useEffect(() => {
    const root = document.documentElement;
    const cfg  = theme.preset !== "custom"
      ? PRESET_CONFIGS[theme.preset as Exclude<ThemePreset, "custom">]
      : null;

    root.style.setProperty("--theme-accent",     palette.accent);
    root.style.setProperty("--theme-accent-soft", palette.accentSoft);
    root.style.setProperty("--theme-accent-alt",  palette.accentAlt);
    root.style.setProperty("--theme-font",        FONT_MAP[theme.preset]);
    root.style.setProperty("--theme-bg",          cfg ? (isDark ? cfg.darkBg : cfg.lightBg) : (isDark ? "#070b12" : "#edf3fa"));
    root.style.setProperty("--theme-ambient-a",   cfg ? cfg.ambientA : palette.accent);
    root.style.setProperty("--theme-ambient-b",   cfg ? cfg.ambientB : palette.accentSoft);
    root.style.setProperty("--theme-ambient-c",   cfg ? cfg.ambientC : palette.accentAlt);
    root.style.setProperty("--theme-surface",     isDark ? "#131c2e" : "#ffffff");
    root.style.setProperty("--theme-text",        isDark ? "#eaf0fb" : "#0f1f38");
    root.style.setProperty("--theme-text-muted",  isDark ? "#9eb0cf" : "#5f7394");
    root.style.setProperty("--theme-border",      isDark ? "#2a3a56" : "#d9e2ee");
    root.style.setProperty("--theme-input",       isDark ? "#0f1728" : "#f7f9fd");
    root.dataset.themeMode     = theme.mode;
    root.dataset.themePreset   = theme.preset;
    root.dataset.themeResolved = isDark ? "dark" : "light";
    root.classList.toggle("dark", isDark);
  }, [theme.mode, theme.preset, isDark, palette]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode:   theme.mode,
    preset: theme.preset,
    isDark,
    customPalette,
    palette,
    setMode:          (mode)    => setTheme((prev) => ({ ...prev, mode })),
    setPreset:        (preset)  => setTheme((prev) => ({ ...prev, preset })),
    setCustomPalette: (p)       => setCustomPaletteState(p),
  }), [theme.mode, theme.preset, isDark, customPalette, palette]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeConfig(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeConfig must be used inside ThemeProvider");
  return ctx;
}
