/**
 * The card paintings, by name: a painting is `assets/cards/<name>.webp`, made with
 * `npm run card-art`, and a card or action that names it shows it with no code to change
 */
export const PAINTINGS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../assets/cards/*.webp", { eager: true, import: "default" })).map(
    ([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".webp".length), url]
  )
);
