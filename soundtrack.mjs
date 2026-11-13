export const SOUNDTRACK = Object.freeze({
  title: 'Iridescent Deep — Alternate Loop',
  artist: 'Tsorthan Grove',
  source: 'https://opengameart.org/content/iridescent-deep',
  license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  url: new URL('./assets/music/iridescent-deep-alternate-loop.ogg', import.meta.url).href,
});

/** Uses the operator-unlocked AudioContext; it never changes countdown sound. */
export class ExhibitionSoundtrack {
  constructor(context, { volume = 0.22, url = SOUNDTRACK.url } = {}) {
    this.context = context;
    this.url = url;
    this.volume = this.clampVolume(volume);
    this.muted = false;
    this.recording = false;
    this.error = null;
    this.source = null;
    this.buffer = null;
    this.pending = null;
    this.disposed = false;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(context.destination);
  }

  get playing() {
    return !!this.source && this.context.state === 'running';
  }

  clampVolume(value) {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.min(0.6, Number(value))) : 0.22;
  }

  async start() {
    if (this.disposed || this.context.state !== 'running') return false;
    if (this.source) return true;
    if (this.pending) return this.pending;
    this.pending = this.loadAndStart();
    try { return await this.pending; }
    finally { this.pending = null; }
  }

  async loadAndStart() {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (!this.buffer) {
        const response = await fetch(this.url, { signal: controller.signal });
        if (!response.ok) throw new Error(`배경음악을 불러오지 못했습니다 (${response.status}).`);
        const encoded = await response.arrayBuffer();
        this.buffer = await this.context.decodeAudioData(encoded);
      }
      if (this.disposed || this.context.state !== 'running') return false;
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      source.connect(this.gain);
      source.onended = () => {
        source.disconnect();
        if (this.source === source) this.source = null;
      };
      source.start();
      this.source = source;
      this.error = null;
      this.fadeToTarget(3);
      return true;
    } catch (error) {
      this.error = error;
      return false;
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = null;
    }
  }

  fadeToTarget(seconds = 0.5) {
    if (this.disposed) return;
    const parameter = this.gain.gain;
    const now = this.context.currentTime;
    const target = this.muted ? 0 : this.volume * (this.recording ? 0.3 : 1);
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else {
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(parameter.value, now);
    }
    parameter.linearRampToValueAtTime(target, now + seconds);
  }

  setRecording(recording) {
    this.recording = !!recording;
    this.fadeToTarget(this.recording ? 0.4 : 1.8);
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.fadeToTarget();
    return this.muted;
  }

  setVolume(volume) {
    this.volume = this.clampVolume(volume);
    this.fadeToTarget();
    return this.volume;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller?.abort();
    this.source?.stop();
    this.source = null;
    this.buffer = null;
    this.gain.disconnect();
  }
}
