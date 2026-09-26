// sound.ts
// Short sound effects (Kenney, CC0). Playing is best effort: a browser that
// blocks audio or can't decode it just stays quiet.
import { useCallback } from "react";
import diceSound from "./assets/sounds/dice.ogg";
import cardDealSound from "./assets/sounds/card-deal.ogg";
import cardPlaySound from "./assets/sounds/card-play.ogg";
import stampSound from "./assets/sounds/stamp.ogg";
import { useSettings } from "./settings";

const SOUNDS = {
  dice: diceSound,
  cardDeal: cardDealSound,
  cardPlay: cardPlaySound,
  stamp: stampSound,
} as const;

export type SoundName = keyof typeof SOUNDS;

const players = new Map<SoundName, HTMLAudioElement>();

export function playSound(name: SoundName): void {
  try {
    let audio = players.get(name);
    if (!audio) {
      audio = new Audio(SOUNDS[name]);
      players.set(name, audio);
    }
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  } catch {
    // No audio support
  }
}

/** Plays a sound only when the player has sound turned on */
export function useSound(): (name: SoundName) => void {
  const { settings } = useSettings();
  return useCallback((name: SoundName) => {
    if (settings.sound) playSound(name);
  }, [settings.sound]);
}
