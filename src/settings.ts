// settings.ts
// Per-device preferences (not game state): the visual look, sound and language.
import { createContext, useContext } from "react";
import { DEFAULT_LOOK, LookId, isLookId } from "./looks/looks";
import { Lang, detectLang, isLang } from "./i18n/lang";

export interface Settings {
  look: LookId;
  /** Sound effects; off by default, tablets are often used in quiet rooms */
  sound: boolean;
  language: Lang;
}

export const DEFAULT_SETTINGS: Settings = { look: DEFAULT_LOOK, sound: false, language: "es" };

/** Settings from storage, with anything missing or unknown replaced by the default (the language: the browser's) */
export const normalizeSettings = (value: unknown): Settings => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    look: isLookId(saved.look) ? saved.look : DEFAULT_SETTINGS.look,
    sound: typeof saved.sound === "boolean" ? saved.sound : DEFAULT_SETTINGS.sound,
    language: isLang(saved.language) ? saved.language : detectLang(),
  };
};

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export const useSettings = () => useContext(SettingsContext);
