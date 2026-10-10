/**
 * The app runs on Safari 16.2 (iPadOS and macOS) or later, Chrome 111, Firefox 113.
 * An older browser lacks what it's built with, and the game would break off
 * partway: JavaScript from 2022 (`Array.at`, `findLast`, `Object.hasOwn`, here
 * and in three.js and motion), CSS colour mixes (`color-mix()`, all over the
 * looks) and container sizes (the card hand). Checked by feature, not by name.
 */
export function isBrowserTooOld(): boolean {
  if (typeof Array.prototype.at !== "function" || typeof Array.prototype.findLast !== "function" || typeof Object.hasOwn !== "function") {
    return true;
  }
  // Every browser has CSS.supports; jsdom (the tests) doesn't, and is taken as new enough
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  return !CSS.supports("color", "color-mix(in srgb, red, blue)") || !CSS.supports("container-type", "inline-size");
}
