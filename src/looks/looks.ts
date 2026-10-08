// looks/looks.ts
// The three visual styles a player can pick in "Ajustes". Each look is plain
// data: theme.ts turns it into an MUI theme and CSS variables (--m44-*), so
// components and the custom CSS (board, cards, dice) follow the chosen look.
import paperTexture from "../assets/textures/paper.webp";
import boardTexture from "../assets/textures/board.webp";
import canvasTexture from "../assets/textures/canvas.webp";
import type { Localized } from "../i18n/lang";

export type LookId = "field" | "box" | "tent";

export interface LookColors {
  /** Page background, under the texture */
  bg: string;
  /** Panels, dialogs and cards */
  paper: string;
  /** Rows and insets inside a panel */
  paperAlt: string;
  ink: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  /** Stamps, destructive actions and the discard pile */
  accent: string;
  onAccent: string;
  success: string;
  warning: string;
  /** Board highlight: can move there and still fire */
  moveAndFire: string;
  /** Board highlight: can move there but won't fire */
  moveOnly: string;
  /** Die faces */
  die: string;
}

export interface Look {
  id: LookId;
  /** Shown in Ajustes */
  name: Localized;
  description: Localized;
  mode: "light" | "dark";
  colors: LookColors;
  fonts: {
    /** Headings, buttons, stamps */
    display: string;
    body: string;
  };
  radius: number;
  /** Thickness of panel and card borders, in px */
  border: number;
  /** Shadow under panels and cards */
  shadow: string;
  texture: string;
  /** How the grayscale texture tile mixes with the background colour */
  textureBlend: "multiply" | "soft-light";
}

export const LOOKS: Record<LookId, Look> = {
  field: {
    id: "field",
    name: { es: "Mapa de campaña", en: "Campaign map" },
    description: {
      es: "Pergamino, verde oliva y sellos de tinta. Como una orden de operaciones.",
      en: "Parchment, olive green and ink stamps. Like an operations order.",
    },
    mode: "light",
    colors: {
      bg: "#e9dfc6",
      paper: "#f4ecd8",
      paperAlt: "#ebe1c8",
      ink: "#2a281f",
      muted: "#5e5642",
      border: "#8a7f63",
      primary: "#4b5320",
      onPrimary: "#f4ecd8",
      accent: "#8f2d1f",
      onAccent: "#f7f1e1",
      success: "#4b5320",
      warning: "#8a5a00",
      moveAndFire: "#3f7d20",
      moveOnly: "#c98a00",
      die: "#fbf7ec",
    },
    fonts: {
      display: "'Stardos Stencil', 'Special Elite', serif",
      body: "'Special Elite', 'Courier New', monospace",
    },
    radius: 2,
    border: 2,
    shadow: "4px 4px 0 rgba(42, 40, 31, 0.25)",
    texture: paperTexture,
    textureBlend: "multiply",
  },
  box: {
    id: "box",
    name: { es: "Caja del juego", en: "Game box" },
    description: {
      es: "Arena, rojo y azul marino con bordes gruesos. Como la caja y las cartas del juego.",
      en: "Sand, red and navy blue with thick borders. Like the game's box and cards.",
    },
    mode: "light",
    colors: {
      bg: "#e3d3a7",
      paper: "#f6ecd0",
      paperAlt: "#ece0bd",
      ink: "#1b2238",
      muted: "#4a4f63",
      border: "#1b2238",
      primary: "#a3202b",
      onPrimary: "#f6ecd0",
      accent: "#a3202b",
      onAccent: "#f6ecd0",
      success: "#3f6b2a",
      warning: "#8a5a00",
      moveAndFire: "#3f7d20",
      moveOnly: "#d18f00",
      die: "#fffaf0",
    },
    fonts: {
      display: "'Black Ops One', 'Barlow Condensed', sans-serif",
      body: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    },
    radius: 12,
    border: 3,
    shadow: "0 5px 0 #1b2238",
    texture: boardTexture,
    textureBlend: "multiply",
  },
  tent: {
    id: "tent",
    name: { es: "Tienda de mando", en: "Command tent" },
    description: {
      es: "Lona oscura bajo una lámpara, ámbar y oliva. Descansa la vista de noche.",
      en: "Dark canvas under a lamp, amber and olive. Easy on the eyes at night.",
    },
    mode: "dark",
    colors: {
      bg: "#16150f",
      paper: "#221f17",
      paperAlt: "#2a261c",
      ink: "#ece3cc",
      muted: "#b3a88c",
      border: "#5a533f",
      primary: "#e3a72f",
      onPrimary: "#1a150a",
      accent: "#d9573b",
      onAccent: "#1a150a",
      success: "#a9bb5c",
      warning: "#e3a72f",
      moveAndFire: "#7fb24a",
      moveOnly: "#e3a72f",
      die: "#efe6cf",
    },
    fonts: {
      display: "'Allerta Stencil', 'IBM Plex Sans Condensed', sans-serif",
      body: "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
    },
    radius: 4,
    border: 1,
    shadow: "0 10px 24px rgba(0, 0, 0, 0.55)",
    texture: canvasTexture,
    textureBlend: "soft-light",
  },
};

export const LOOK_IDS = Object.keys(LOOKS) as LookId[];

/** Closest to the app's original dark theme */
export const DEFAULT_LOOK: LookId = "tent";

export const isLookId = (value: unknown): value is LookId => LOOK_IDS.includes(value as LookId);

/** Base colours for unit tokens, the same in every look so sides are always recognisable */
export const FACTION_COLORS = { Allies: "#5c7a3a", Axis: "#5f6f80" } as const;
