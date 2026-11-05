// Play offline: sw.js keeps what the game fetches, and the main menu's "Play offline" row downloads all of Adventure mode (offline.json) so a phone can play
// with no connection. Once saved, every launch with a connection quietly fetches whatever changed since.
const OFFLINE = {
  st: 'unknown', p: 0, mb: 0, failed: 0,
  init() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) { this.st = 'unsupported'; return; }
    navigator.serviceWorker.addEventListener('message', e => this.on(e.data || {}));
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(r => { this.sw = r.active; this.sw.postMessage({ t: 'status' }); }).catch(() => this.st = 'unsupported');
    fetch('offline.json', { cache: 'no-cache' }).then(r => r.json()).then(j => { this.mb = Math.round(j.bytes / 1048576); this.version = j.version; }).catch(() => {});
  },
  on(m) {
    if (m.t === 'status') { const was = this.st; this.st = m.saved ? 'saved' : 'none'; if (m.saved) this.mb = Math.round(m.bytes / 1048576);
      if (m.saved && was === 'unknown' && navigator.onLine && m.version !== 'partial') this.sw?.postMessage({ t: 'pack' });   // a quiet update: only files that changed
      if (m.saved && m.version === 'partial') this.st = 'failed'; }
    if (m.t === 'progress') { this.st = 'saving'; this.p = m.p; }
    if (m.t === 'failed') { this.st = 'failed'; this.failed = m.failed || 0; }
  },
  save() {
    if (!this.sw || this.st === 'saving' || this.st === 'unsupported') return;
    if (!navigator.onLine) { this.st = 'offline'; return; }
    navigator.storage?.persist?.();   // ask the browser not to clear it when space runs low
    this.st = 'saving'; this.p = 0; this.sw.postMessage({ t: 'pack' }); uiBlip(700);
  },
  label() {
    return { unknown: '...', unsupported: 'Not here', none: this.mb ? `Save (${this.mb} MB)` : 'Save', saving: `Saving ${this.p}%`, saved: 'Ready', failed: 'Retry', offline: 'Needs wifi' }[this.st];
  },
};
OFFLINE.init();
