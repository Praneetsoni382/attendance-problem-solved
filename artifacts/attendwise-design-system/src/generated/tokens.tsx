/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#f5f6fb",
      "foreground": "#20243a",
      "border": "#e3e5f0",
      "card": "#ffffff",
      "cardForeground": "#20243a",
      "popover": "#ffffff",
      "popoverForeground": "#20243a",
      "primary": "#303779",
      "primaryForeground": "#fafafa",
      "secondary": "#6a6cb4",
      "secondaryForeground": "#ffffff",
      "muted": "#eff0f7",
      "mutedForeground": "#656a82",
      "accent": "#73cba4",
      "accentForeground": "#173c32",
      "destructive": "#b8424f",
      "destructiveForeground": "#ffffff",
      "input": "#e1e4ef",
      "ring": "#7777c8",
      "chart1": "#303779",
      "chart2": "#7777c8",
      "chart3": "#58a987",
      "chart4": "#966018",
      "chart5": "#c15d69",
      "sidebar": "#fafafa",
      "sidebarForeground": "#393e59",
      "sidebarBorder": "#e3e5f0",
      "sidebarPrimary": "#303779",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#ededf8",
      "sidebarAccentForeground": "#303779",
      "sidebarRing": "#7777c8"
    },
    "dark": {
      "background": "#17192d",
      "foreground": "#f2f3fa",
      "border": "#383b59",
      "card": "#20233b",
      "cardForeground": "#f2f3fa",
      "popover": "#242743",
      "popoverForeground": "#f2f3fa",
      "primary": "#5962b6",
      "primaryForeground": "#ffffff",
      "secondary": "#8b8ddd",
      "secondaryForeground": "#202344",
      "muted": "#2a2d47",
      "mutedForeground": "#b3b6ce",
      "accent": "#73cba4",
      "accentForeground": "#173c32",
      "destructive": "#a13d4a",
      "destructiveForeground": "#ffffff",
      "input": "#414564",
      "ring": "#a0a2ed",
      "chart1": "#a0a2ed",
      "chart2": "#73cba4",
      "chart3": "#e5b96b",
      "chart4": "#c08bd7",
      "chart5": "#e18391",
      "sidebar": "#1a1c32",
      "sidebarForeground": "#e8eaf7",
      "sidebarBorder": "#343752",
      "sidebarPrimary": "#5962b6",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#2a2d49",
      "sidebarAccentForeground": "#c2c5f0",
      "sidebarRing": "#a0a2ed"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Menlo",
      "monospace"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
