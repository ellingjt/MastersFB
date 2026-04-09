import doorOpenUrl from './assets/sounds/door-open.mp3';
import canOpenUrl from './assets/sounds/can-open.mp3';
import golfClapUrl from './assets/sounds/golf-clap.mp3';

const MUTE_KEY = 'masters-sound-muted';
let muted = localStorage.getItem(MUTE_KEY) !== 'false';

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, String(muted));
  return muted;
}

function play(url: string, volume = 0.5) {
  if (muted) return;
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}

export function playDoorOpen() { play(doorOpenUrl, 0.4); }
export function playBeerSound() { play(canOpenUrl, 0.5); }
export function playCrowdRoar() { play(golfClapUrl, 0.5); }
