// settings.ts
// Per-device preferences (not game state): the visual look and sound.
import { createContext, useContext } from "react";
import { DEFAULT_LOOK, LookId, isLookId } from "./looks/looks";

export interface Settings {
  look: LookId;
  /** Sound effects; off by default, tablets are often used in quiet rooms */
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = { look: DEFAULT_LOOK, sound: false };

/** Settings from storage, with anything missing or unknown replaced by the default */
export const normalizeSettings = (value: unknown): Settings => {
  const saved = (typeof value === "object" && value !== null ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    look: isLookId(saved.look) ? saved.look : DEFAULT_SETTINGS.look,
    sound: typeof saved.sound === "boolean" ? saved.sound : DEFAULT_SETTINGS.sound,
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
