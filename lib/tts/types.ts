export interface TtsVoice {
  id: string;
  name: string;
  lang: string;
}

export interface SpeakOptions {
  rate?: number;
  voiceId?: string;
  onEnd: () => void;
  onError: (err: string) => void;
}

/**
 * Abstraction for a TTS engine — swap implementations without touching UI code.
 *
 * Future engine — KokoroEngine:
 *   Implement `speak()` by lazy-importing kokoro-js / transformers.js, running
 *   inference on the chunk text to produce audio, creating a Blob URL, and
 *   playing it via HTMLAudioElement. Fire onEnd when the element fires "ended".
 *   Pre-generate the next chunk in the background while the current one plays.
 *   Use WebGPU with WASM fallback; report "Loading model…" via a status callback
 *   on the first call. `getVoices()` returns the bundled kokoro speaker list.
 */
export interface TtsEngine {
  readonly name: string;
  isSupported(): boolean;
  getVoices(): TtsVoice[];
  speak(text: string, opts: SpeakOptions): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}
