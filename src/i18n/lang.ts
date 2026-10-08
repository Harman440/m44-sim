// i18n/lang.ts
// The app's languages, and text written in all of them. Plain TypeScript (no
// React), so game-core and the data files can hold text in every language.

export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/** The language's own name, for the language picker */
export const LANG_NAMES: Record<Lang, string> = { es: "Español", en: "English" };

/** A text in every language; game objects keep these, and the screens show the player's */
export type Localized = Readonly<Record<Lang, string>>;

/** A text built the same way in every language, e.g. from labels: `byLang((lang) => LABELS[lang].units[type])` */
export const byLang = (text: (lang: Lang) => string): Localized => ({ es: text("es"), en: text("en") });

/** A text that is the same in every language: a name, a number */
export const same = (text: string): Localized => ({ es: text, en: text });

/** Whether a saved value is a text in every language */
export const isLocalized = (value: unknown): value is Localized =>
  typeof value === "object" && value !== null && LANGS.every((lang) => typeof (value as Record<string, unknown>)[lang] === "string");

/** The browser's language when it's one of ours: Spanish for any "es-…", English otherwise */
export const detectLang = (): Lang => {
  const language = typeof navigator === "undefined" ? "" : (navigator.language ?? "");
  return language.toLowerCase().startsWith("es") ? "es" : "en";
};
