'use client';

import type { TtsEngine, TtsVoice, SpeakOptions } from './types';

// Chrome/Edge silently truncate utterances longer than ~200 chars.
// We split internally so each SpeechSynthesisUtterance stays within this limit.
const MAX_UTT = 200;

function splitForSynth(text: string): string[] {
  if (text.length <= MAX_UTT) return [text];

  const re = /[^.!?]*[.!?]+[)"']?\s*/g;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  // Merge tiny parts up to MAX_UTT to avoid excessive queue size
  const merged: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (cur.length + p.length <= MAX_UTT) {
      cur += p;
    } else {
      if (cur) merged.push(cur);
      cur = p.length > MAX_UTT ? p.slice(0, MAX_UTT) : p;
    }
  }
  if (cur) merged.push(cur);
  return merged.length ? merged : [text.slice(0, MAX_UTT)];
}

export class WebSpeechEngine implements TtsEngine {
  readonly name = 'System voice';

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getVoices(): TtsVoice[] {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices().map((v) => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
    }));
  }

  speak(text: string, opts: SpeakOptions): void {
    if (!this.isSupported()) {
      opts.onError('Speech synthesis is not supported in this browser.');
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const parts = splitForSynth(text.trim());
    let idx = 0;

    const speakNext = () => {
      if (idx >= parts.length) {
        opts.onEnd();
        return;
      }
      const utt = new SpeechSynthesisUtterance(parts[idx]);
      utt.rate = opts.rate ?? 1;
      if (opts.voiceId) {
        const v = synth.getVoices().find((v) => v.voiceURI === opts.voiceId);
        if (v) utt.voice = v;
      }
      utt.onend = () => {
        idx++;
        speakNext();
      };
      utt.onerror = (e) => {
        // 'interrupted' fires when synth.cancel() is called — that's expected
        if (e.error !== 'interrupted') opts.onError(e.error);
      };
      synth.speak(utt);
    };

    speakNext();
  }

  pause(): void {
    if (this.isSupported()) window.speechSynthesis.pause();
  }

  resume(): void {
    if (this.isSupported()) window.speechSynthesis.resume();
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}

export const webSpeechEngine = new WebSpeechEngine();
