'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { webSpeechEngine } from '@/lib/tts/webSpeechEngine';
import { chunkText } from '@/lib/tts/chunkText';
import type { TtsVoice } from '@/lib/tts/types';

export type TtsStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type UseTtsReturn = ReturnType<typeof useTts>;

const RATE_KEY = 'joshbooks-tts-rate';
const VOICE_KEY = 'joshbooks-tts-voice';
const POS_PREFIX = 'joshbooks-tts-position:';

function ls(key: string): string {
  try { return window.localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function lsSet(key: string, val: string) {
  try { window.localStorage.setItem(key, val); } catch {}
}

export function useTts(fileId: string) {
  const [status, setStatus] = useState<TtsStatus>('idle');
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voice, setVoiceState] = useState('');
  const [rate, setRateState] = useState(1);
  const [chunks, setChunks] = useState<string[]>([]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mutable ref for callback-safe access — updated via event handlers and effects (not during render)
  const inner = useRef({ chunks: [] as string[], index: 0, active: false, rate: 1, voice: '' });

  // Self-referential callback ref to allow recursion without circular useCallback deps
  const speakAtRef = useRef<((idx: number) => void) | null>(null);

  const speakAt = useCallback(
    (idx: number) => {
      if (!inner.current.active) return;
      if (idx >= inner.current.chunks.length) {
        inner.current.active = false;
        setStatus('idle');
        return;
      }
      if (idx < 0) idx = 0;

      inner.current.index = idx;
      setChunkIndex(idx);
      lsSet(POS_PREFIX + fileId, String(idx));
      setStatus('playing');

      webSpeechEngine.speak(inner.current.chunks[idx], {
        rate: inner.current.rate,
        voiceId: inner.current.voice || undefined,
        onEnd: () => speakAtRef.current?.(inner.current.index + 1),
        onError: (msg) => {
          if (!inner.current.active) return;
          setError(msg);
          setStatus('error');
          inner.current.active = false;
        },
      });
    },
    [fileId],
  );

  // Keep speakAtRef current so recursive onEnd calls always use the latest closure
  useEffect(() => {
    speakAtRef.current = speakAt;
  }, [speakAt]);

  // Load voices (async in Chrome — fires voiceschanged after initial empty list)
  useEffect(() => {
    if (typeof window === 'undefined' || !webSpeechEngine.isSupported()) return;
    const load = () => setVoices(webSpeechEngine.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // Restore persisted rate/voice/position and sync into inner ref
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const r = parseFloat(ls(RATE_KEY));
    if (r > 0 && !isNaN(r)) { setRateState(r); inner.current.rate = r; }
    const v = ls(VOICE_KEY);
    if (v) { setVoiceState(v); inner.current.voice = v; }
    const pos = parseInt(ls(POS_PREFIX + fileId), 10);
    if (!isNaN(pos) && pos > 0) { setChunkIndex(pos); inner.current.index = pos; }
  }, [fileId]);

  const play = useCallback((getText: () => string) => {
    webSpeechEngine.cancel();
    setError(null);

    if (!inner.current.chunks.length) {
      setStatus('loading');
      try {
        const text = getText();
        const c = chunkText(text);
        if (!c.length) {
          setError('No readable text found in this document.');
          setStatus('error');
          return;
        }
        setChunks(c);
        inner.current.chunks = c;
      } catch {
        setError('Could not extract text from this document.');
        setStatus('error');
        return;
      }
    }

    inner.current.active = true;
    speakAtRef.current?.(inner.current.index);
  }, []);

  const pause = useCallback(() => {
    webSpeechEngine.pause();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    webSpeechEngine.resume();
    setStatus('playing');
  }, []);

  const stop = useCallback(() => {
    inner.current.active = false;
    webSpeechEngine.cancel();
    setStatus('idle');
  }, []);

  const nextChunk = useCallback(() => {
    inner.current.active = true;
    speakAtRef.current?.(inner.current.index + 1);
  }, []);

  const prevChunk = useCallback(() => {
    inner.current.active = true;
    speakAtRef.current?.(Math.max(0, inner.current.index - 1));
  }, []);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    inner.current.rate = r;
    lsSet(RATE_KEY, String(r));
  }, []);

  const setVoice = useCallback((id: string) => {
    setVoiceState(id);
    inner.current.voice = id;
    lsSet(VOICE_KEY, id);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { inner.current.active = false; webSpeechEngine.cancel(); };
  }, []);

  return {
    status,
    isSupported: webSpeechEngine.isSupported(),
    voices,
    voice,
    rate,
    chunkIndex,
    totalChunks: chunks.length,
    error,
    play,
    pause,
    resume,
    stop,
    nextChunk,
    prevChunk,
    setRate,
    setVoice,
  };
}
