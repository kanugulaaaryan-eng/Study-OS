import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName =
  | "glassmorph-light"
  | "dark-neon"
  | "sky-golden-hour"
  | "sky-morning"
  | "sky-midnight"
  | "sky-dusk";

type ThemeConfig = {
  name: ThemeName;
  label: string;
  description?: string;
  icon: string;
  cssVars: Record<string, string>;
  isDark: boolean;
};

const base = (vars: Record<string, string>) => ({
  "--radius": "0.8rem",
  "--chart-1": vars["--primary"],
  "--chart-2": vars["--primary-soft"],
  "--chart-3": vars["--accent"],
  "--chart-4": vars["--secondary"],
  "--chart-5": vars["--muted-foreground"],
  "--sidebar-primary": vars["--primary"],
  "--sidebar-primary-foreground": vars["--primary-foreground"],
  "--sidebar-accent": vars["--secondary"],
  "--sidebar-accent-foreground": vars["--secondary-foreground"],
  "--sidebar-ring": vars["--ring"],
  ...vars,
});

const themeConfigs: Record<ThemeName, ThemeConfig> = {
  "glassmorph-light": {
    name: "glassmorph-light",
    label: "Glassmorph Light",
    icon: "◐",
    isDark: false,
    cssVars: base({
      "--background": "#FAFAFB",
      "--foreground": "#2A2540",
      "--card": "rgba(255,255,255,0.85)",
      "--card-foreground": "#2A2540",
      "--popover": "rgba(255,255,255,0.95)",
      "--popover-foreground": "#2A2540",
      "--primary": "#6D5DF6",
      "--primary-soft": "#E1DCFC",
      "--primary-foreground": "#FFFFFF",
      "--secondary": "#F0E8F7",
      "--secondary-foreground": "#3A3454",
      "--muted": "#F5F4FA",
      "--muted-foreground": "#75708F",
      "--accent": "#C77DB0",
      "--accent-foreground": "#FFFFFF",
      "--destructive": "#E15B6B",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(109,93,246,0.12)",
      "--input": "rgba(255,255,255,0.85)",
      "--ring": "#6D5DF6",
      "--sidebar": "rgba(255,255,255,0.8)",
      "--sidebar-foreground": "#2A2540",
      "--sidebar-border": "rgba(109,93,246,0.10)",
    }),
  },
  "dark-neon": {
    name: "dark-neon",
    label: "Dark Neon",
    icon: "●",
    isDark: true,
    cssVars: base({
      "--background": "#0A0C16",
      "--foreground": "#F0F1FA",
      "--card": "rgba(15,17,28,0.8)",
      "--card-foreground": "#F0F1FA",
      "--popover": "rgba(15,17,28,0.96)",
      "--popover-foreground": "#F0F1FA",
      "--primary": "#8B7CF6",
      "--primary-soft": "#251F45",
      "--primary-foreground": "#0C0A1C",
      "--secondary": "#161A2C",
      "--secondary-foreground": "#DFE1F2",
      "--muted": "#121526",
      "--muted-foreground": "#9198B8",
      "--accent": "#39D6E8",
      "--accent-foreground": "#06181B",
      "--destructive": "#F0708A",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(139,124,246,0.18)",
      "--input": "rgba(15,17,28,0.8)",
      "--ring": "#8B7CF6",
      "--sidebar": "rgba(8,9,17,0.88)",
      "--sidebar-foreground": "#F0F1FA",
      "--sidebar-border": "rgba(139,124,246,0.12)",
    }),
  },
  "sky-golden-hour": {
    name: "sky-golden-hour",
    label: "Golden Hour",
    icon: "◑",
    isDark: false,
    cssVars: base({
      "--background": "#FDF5E6",
      "--foreground": "#3D2B1F",
      "--card": "rgba(255,250,240,0.88)",
      "--card-foreground": "#3D2B1F",
      "--popover": "rgba(255,250,240,0.96)",
      "--popover-foreground": "#3D2B1F",
      "--primary": "#D48B2A",
      "--primary-soft": "#F7E4C4",
      "--primary-foreground": "#FFFFFF",
      "--secondary": "#F5E6CC",
      "--secondary-foreground": "#4A3A2A",
      "--muted": "#F0E0C8",
      "--muted-foreground": "#8B7A63",
      "--accent": "#E8A83A",
      "--accent-foreground": "#2D1F12",
      "--destructive": "#C85D4A",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(212,139,42,0.18)",
      "--input": "rgba(255,250,240,0.85)",
      "--ring": "#D48B2A",
      "--sidebar": "rgba(253,245,230,0.85)",
      "--sidebar-foreground": "#3D2B1F",
      "--sidebar-border": "rgba(212,139,42,0.12)",
    }),
  },
  "sky-morning": {
    name: "sky-morning",
    label: "Sky Morning",
    icon: "◒",
    isDark: false,
    cssVars: base({
      "--background": "#E8F4FD",
      "--foreground": "#1E3A5C",
      "--card": "rgba(248,252,255,0.88)",
      "--card-foreground": "#1E3A5C",
      "--popover": "rgba(248,252,255,0.96)",
      "--popover-foreground": "#1E3A5C",
      "--primary": "#2E86C1",
      "--primary-soft": "#D6EAF8",
      "--primary-foreground": "#FFFFFF",
      "--secondary": "#D4E6F1",
      "--secondary-foreground": "#2C4A6B",
      "--muted": "#E8F1F8",
      "--muted-foreground": "#6A8CA8",
      "--accent": "#3498DB",
      "--accent-foreground": "#152D42",
      "--destructive": "#C0392B",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(46,134,193,0.16)",
      "--input": "rgba(248,252,255,0.85)",
      "--ring": "#2E86C1",
      "--sidebar": "rgba(240,248,255,0.85)",
      "--sidebar-foreground": "#1E3A5C",
      "--sidebar-border": "rgba(46,134,193,0.10)",
    }),
  },
  "sky-midnight": {
    name: "sky-midnight",
    label: "Midnight Sky",
    icon: "◕",
    isDark: true,
    cssVars: base({
      "--background": "#081028",
      "--foreground": "#F0F4FA",
      "--card": "rgba(18,26,50,0.82)",
      "--card-foreground": "#F0F4FA",
      "--popover": "rgba(18,26,50,0.96)",
      "--popover-foreground": "#F0F4FA",
      "--primary": "#7C9EFC",
      "--primary-soft": "#1E2A5E",
      "--primary-foreground": "#0A0F24",
      "--secondary": "#1A2642",
      "--secondary-foreground": "#E8EDF5",
      "--muted": "#141E3A",
      "--muted-foreground": "#9AA8C8",
      "--accent": "#A8BEFF",
      "--accent-foreground": "#0D1630",
      "--destructive": "#E87A7A",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(124,158,252,0.18)",
      "--input": "rgba(18,26,50,0.82)",
      "--ring": "#7C9EFC",
      "--sidebar": "rgba(8,12,28,0.9)",
      "--sidebar-foreground": "#F0F4FA",
      "--sidebar-border": "rgba(124,158,252,0.12)",
    }),
  },
  "sky-dusk": {
    name: "sky-dusk",
    label: "Dusk Storm",
    icon: "◔",
    isDark: true,
    cssVars: base({
      "--background": "#1A1F2E",
      "--foreground": "#E8EBF0",
      "--card": "rgba(34,40,60,0.84)",
      "--card-foreground": "#E8EBF0",
      "--popover": "rgba(34,40,60,0.96)",
      "--popover-foreground": "#E8EBF0",
      "--primary": "#5B7DBF",
      "--primary-soft": "#2A3454",
      "--primary-foreground": "#FFFFFF",
      "--secondary": "#2D344A",
      "--secondary-foreground": "#D8DBE3",
      "--muted": "#242A3E",
      "--muted-foreground": "#8A92A8",
      "--accent": "#7A9ACC",
      "--accent-foreground": "#181E2E",
      "--destructive": "#C86B6B",
      "--destructive-foreground": "#FFFFFF",
      "--border": "rgba(91,125,191,0.16)",
      "--input": "rgba(34,40,60,0.84)",
      "--ring": "#5B7DBF",
      "--sidebar": "rgba(20,24,36,0.92)",
      "--sidebar-foreground": "#E8EBF0",
      "--sidebar-border": "rgba(91,125,191,0.10)",
    }),
  }
};

interface ThemeContextType {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  themes: ThemeConfig[];
  glassmorphism: true;
  setGlassmorphism: (enabled: boolean) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement;
  const vars = config.cssVars;
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  root.dataset.theme = config.name;
  root.dataset.themeMode = config.isDark ? "dark" : "light";
  root.classList.toggle("dark", config.isDark);
  root.classList.add("studyos-glass");
}

export function ThemeProvider({
  children,
  defaultThemeName = "glassmorph-light",
  switchable = true,
}: {
  children: React.ReactNode;
  defaultThemeName?: ThemeName;
  switchable?: boolean;
}) {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return defaultThemeName;
    const stored = localStorage.getItem("themeName") as ThemeName | null;
    // Map legacy theme names to new ones
    const legacyMap: Record<string, ThemeName> = {
      "sage-green": "sky-morning",
      "sunset-warm": "sky-golden-hour",
      "slate-professional": "sky-midnight",
      "galaxy-purple": "sky-dusk",
    };
    if (stored && stored in themeConfigs) return stored;
    if (stored && stored in legacyMap) return legacyMap[stored];
    return defaultThemeName;
  });

  const config = useMemo(() => themeConfigs[themeName], [themeName]);

  useEffect(() => {
    applyTheme(config);
    if (switchable && typeof window !== "undefined") {
      localStorage.setItem("themeName", themeName);
      localStorage.setItem("glassmorphism", "true");
    }
  }, [config, themeName, switchable]);

  // Apply theme before first paint to avoid flash
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("themeName") as ThemeName | null;
      const legacyMap: Record<string, ThemeName> = {
        "sage-green": "sky-morning",
        "sunset-warm": "sky-golden-hour",
        "slate-professional": "sky-midnight",
        "galaxy-purple": "sky-dusk",
      };
      let resolved = stored;
      if (stored && stored in legacyMap) resolved = legacyMap[stored];
      if (resolved && resolved in themeConfigs) {
        applyTheme(themeConfigs[resolved]);
      }
    }
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    if (!(name in themeConfigs)) return;
    setThemeNameState(name);
  }, []);
  const setGlassmorphism = useCallback((_enabled: boolean) => {
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    themeName,
    setThemeName,
    themes: Object.values(themeConfigs),
    glassmorphism: true,
    setGlassmorphism,
    switchable,
  }), [themeName, setThemeName, setGlassmorphism, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}