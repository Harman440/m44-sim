// i18n/useI18n.ts
// The player's language in components: their labels, the right text of a
// game object, and a component's own messages.
import { useCallback } from "react";
import { useSettings } from "../settings";
import { LABELS, Labels } from "../labels";
import type { Lang, Localized } from "./lang";

/** A component's texts, one set per language; the English set must match the Spanish one */
export type Messages<T> = Readonly<Record<Lang, T>>;

/**
 * A component's texts in every language, written next to the component. Values
 * are strings, or functions for texts with numbers or names in them
 */
export const defineMessages = <T extends object>(messages: { es: T; en: NoInfer<T> }): Messages<T> => messages;

export const useLang = (): Lang => useSettings().settings.language;

/** The component's texts in the player's language */
export const useMessages = <T>(messages: Messages<T>): T => messages[useLang()];

/** Labels for game enums and objects in the player's language */
export const useLabels = (): Labels => LABELS[useLang()];

/** Picks the player's language out of a game object's text: `tr(card.name)` */
export const useTr = (): ((text: Localized) => string) => {
  const lang = useLang();
  return useCallback((text: Localized) => text[lang], [lang]);
};
