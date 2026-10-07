import Phaser from 'phaser';
import type { PortraitPresentation } from '../prototypes/portraitPresentation';

type Row = Record<string, unknown>;
type Callable = (...args: unknown[]) => unknown;
interface RunnerState {
  runElapsed: number; running: boolean; paused: boolean; dead: boolean;
  items: Array<{ type: string; effect?: string; x: number; y: number }>;
  playerSprite?: Phaser.GameObjects.Sprite;
}
interface EventRow { at: number; elapsed: number; kind: string; duration: number; detail: Row }
interface Work { calls: number; totalMs: number; maxMs: number }
interface Run {
  startedAt: number; finishedAt?: number; frames: Float64Array; count: number; droppedFrames: number;
  maxGapMs: number; over50: number; over100: number; over200: number;
  gaps: Row[]; events: EventRow[]; droppedEvents: number; work: Record<string, Work>;
  dom: Record<string, number>; mutations: number; rafMaxGapMs: number;
}
declare global {
  interface Window {
    portraitFrameDiagnostics?: { export: () => string; download: () => void; summary: () => Row };
  }
}

// Opt-in observation only. Wrappers preserve arguments, return values and exceptions.
export function installPortraitFrameDiagnostics(game: Phaser.Game, presentation: PortraitPresentation): void {
  if (window.portraitFrameDiagnostics) return;
  const capacity = 20000;
  const columns = ['atMs', 'runElapsed', 'phaserDeltaMs', 'rawDeltaMs', 'wallGapMs', 'stepCpuMs', 'renderSubmissionMs', 'domMutationsSincePreviousFrame'];
  const runs: Run[] = [];
  let active: Run | undefined;
  let runner: RunnerState;
  let frameAt = 0;
  let previousAt = 0;
  let previousElapsed = 0;
  let renderAt = 0;
  let phaserDelta = 0;
  let rawDelta = 0;
  let gap = 0;
  let stepCpu = 0;
  let mutationsBefore = 0;
  let frameMutations = 0;
  let rafAt = 0;
  let rafId = 0;
  let gpuUploads = 0;
  let gpuUploadMs = 0;
  let canvasUploads = 0;
  const imageUploads = new Set<string>();
  const cleanups: Array<() => void> = [];
  const observers: PerformanceObserver[] = [];
  const shell = document.querySelector<HTMLElement>('#portrait-shell')!;
  const playerFrames = new WeakMap<object, string | number>();
  const pedestrianNames = Array.from({ length: 12 }, (_, i) => `pedestrian${String(i + 1).padStart(2, '0')}`);
  const pedestrianVisible = new WeakMap<object, boolean>();
  const stats = (name: string, duration: number): void => {
    if (!active) return;
    const work = active.work[name] ??= { calls: 0, totalMs: 0, maxMs: 0 };
    work.calls++; work.totalMs += duration; work.maxMs = Math.max(work.maxMs, duration);
  };
  const event = (kind: string, detail: Row = {}, at = performance.now(), duration = 0): void => {
    if (!active) return;
    if (active.events.length >= 16000) { active.droppedEvents++; return; }
    active.events.push({ at, elapsed: runner?.runElapsed ?? 0, kind, duration, detail });
  };
  const wrap = (target: object, key: string, after?: (args: unknown[], result: unknown, at: number, duration: number) => void, label = key): void => {
    const object = target as Record<string, unknown>;
    const original = object[key];
    if (typeof original !== 'function') return;
    const method = original as Callable;
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      if (!active) return method.apply(this, args);
      const at = performance.now();
      try {
        const result = method.apply(this, args);
        const duration = performance.now() - at;
        stats(label, duration);
        if (duration > 8) event('slow-call', { method: label }, at, duration);
        after?.(args, result, at, duration);
        return result;
      } catch (error) {
        event('instrumented-call-error', { method: label, message: String(error) }, at, performance.now() - at);
        throw error;
      }
    };
    object[key] = wrapped;
    cleanups.push(() => { if (object[key] === wrapped) object[key] = original; });
  };

  const begin = (): void => {
    if (active) { active.finishedAt = performance.now(); active = undefined; }
    runner = game.scene.getScene('Runner') as unknown as RunnerState;
    active = {
      startedAt: performance.now(), frames: new Float64Array(capacity * columns.length), count: 0, droppedFrames: 0,
      maxGapMs: 0, over50: 0, over100: 0, over200: 0, gaps: [], events: [], droppedEvents: 0,
      work: {}, dom: {}, mutations: 0, rafMaxGapMs: 0,
    };
    runs.push(active);
    if (runs.length > 3) runs.shift();
    previousAt = 0; previousElapsed = 0; rafAt = 0; mutationsBefore = 0;
    gpuUploads = 0; gpuUploadMs = 0; canvasUploads = 0; imageUploads.clear();
    button.hidden = true;
    event('play', { visibility: document.visibilityState });
  };
  const play = document.querySelector('#portrait-play')!;
  play.addEventListener('click', begin, true);
  cleanups.push(() => play.removeEventListener('click', begin, true));

  const observedRunner = game.scene.getScene('Runner');
  for (const name of ['update', 'updatePlayer', 'updateWorld', 'handleCollisions', 'handleSpawning',
    'renderBackground', 'renderItems', 'renderPlayer', 'getPrototypeSnapshot', 'updateHud', 'create']) {
    wrap(observedRunner, name, name === 'handleSpawning' ? () => {
      for (const item of runner.items) {
        if (seenItems.has(item)) continue;
        seenItems.add(item);
        event('spawn', { type: item.type, effect: item.effect, x: item.x, y: item.y });
      }
    } : undefined, `Runner.${name}`);
  }
  const seenItems = new WeakSet<object>();
  for (const name of ['applyPower', 'showCashRushActivated', 'showCashRushEnded', 'showCashRushCollection', 'hitObstacle', 'flashStatus']) {
    wrap(observedRunner, name, args => event('effect', { method: name, argument: args[0] }), `Runner.${name}`);
  }
  wrap(observedRunner, 'renderPedestrians', () => {
    const object = observedRunner as unknown as Record<string, Phaser.GameObjects.Sprite>;
    for (const name of pedestrianNames) {
      const sprite = object[name];
      if (!sprite) continue;
      if (pedestrianVisible.get(sprite) !== sprite.visible) {
        pedestrianVisible.set(sprite, sprite.visible);
        if (sprite.visible) event('pedestrian-appearance', { name, texture: sprite.texture.key });
      }
      if (sprite.visible && playerFrames.get(sprite) !== sprite.frame.name) {
        playerFrames.set(sprite, sprite.frame.name);
        event('animation-frame', { name, texture: sprite.texture.key, frame: sprite.frame.name });
      }
    }
  }, 'Runner.renderPedestrians');
  for (const name of ['image', 'sprite', 'text', 'graphics']) {
    wrap(observedRunner.add, name, (args, _result, at, duration) => event('game-object-create', {
      type: name, source: typeof args[2] === 'string' ? args[2] : undefined,
    }, at, duration), `factory.${name}`);
  }
  wrap(observedRunner.tweens, 'add', args => {
    const config = args[0] as { duration?: number; targets?: unknown };
    event('tween-create', { durationMs: config?.duration, targets: Array.isArray(config?.targets) ? config.targets.length : 1 });
  }, 'Tween.add');
  wrap(observedRunner.anims, 'create', args => event('animation-create', { key: (args[0] as { key?: string })?.key }), 'Animation.create');

  // updateHud is already registered as a bound callback; replace that registration only in diagnostic mode.
  const portrait = presentation as unknown as Record<string, Callable>;
  const hud = portrait.updateHud;
  game.events.off(Phaser.Core.Events.POST_STEP, hud);
  wrap(presentation, 'updateHud', undefined, 'Portrait.updateHud');
  game.events.on(Phaser.Core.Events.POST_STEP, portrait.updateHud);
  cleanups.push(() => { game.events.off(Phaser.Core.Events.POST_STEP, portrait.updateHud); game.events.on(Phaser.Core.Events.POST_STEP, hud); });
  for (const name of ['fit', 'showEnd', 'text']) wrap(presentation, name, name === 'fit'
    ? (_args, _result, at, duration) => event('portrait-fit', { width: innerWidth, height: innerHeight }, at, duration)
    : undefined, `Portrait.${name}`);
  wrap(presentation, 'updateDistrictAtmosphere', (_args, _result, at, duration) => {
    const district = shell.dataset.district || 'city';
    if (district !== lastDistrict) {
      event('portrait-atmosphere-switch', { from: lastDistrict, to: district }, at, duration);
      lastDistrict = district;
    }
  }, 'Portrait.updateDistrictAtmosphere');
  let lastDistrict = shell.dataset.district || 'city';

  const mutationObserver = new MutationObserver(records => {
    if (!active) return;
    active.mutations += records.length;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target.id || record.target.tagName : 'text';
      const key = `${target}:${record.attributeName ?? record.type}`;
      active.dom[key] = (active.dom[key] ?? 0) + 1;
    }
    if (records.length > 100) event('large-dom-batch', { mutations: records.length });
  });
  mutationObserver.observe(shell, { subtree: true, attributes: true, childList: true, characterData: true });
  cleanups.push(() => mutationObserver.disconnect());

  const supported = typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes;
  for (const type of ['longtask', 'long-animation-frame', 'resource']) {
    if (!supported.includes(type)) continue;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const run = [...runs].reverse().find(candidate => entry.startTime + entry.duration >= candidate.startedAt
          && entry.startTime <= (candidate.finishedAt ?? performance.now()));
        if (!run) continue;
        if (run.events.length >= 16000) { run.droppedEvents++; continue; }
        run.events.push({ at: entry.startTime, elapsed: runner?.runElapsed ?? 0, kind: type,
          duration: entry.duration, detail: { ...entry.toJSON() as Row, observedAt: performance.now() } });
      }
    });
    observer.observe({ type, buffered: false }); observers.push(observer);
  }
  const onTexture = (key: string): void => event('texture-added', { key });
  game.textures.on(Phaser.Textures.Events.ADD, onTexture);
  cleanups.push(() => game.textures.off(Phaser.Textures.Events.ADD, onTexture));
  const loader = observedRunner.load;
  const loading = (): void => event('loader-start');
  const loaded = (key: string, type: string): void => event('loader-file-complete', { key, type });
  loader.on('start', loading); loader.on('filecomplete', loaded);
  cleanups.push(() => { loader.off('start', loading); loader.off('filecomplete', loaded); });
  wrap(HTMLImageElement.prototype, 'decode', function (_args, result, at) {
    event('explicit-image-decode', {}, at);
    if (result instanceof Promise) void result.then(() => event('explicit-image-decoded', {}, at, performance.now() - at), () => event('image-decode-error'));
  }, 'Image.decode');
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (renderer.gl) for (const name of ['texImage2D', 'texSubImage2D', 'createTexture']) {
    wrap(renderer.gl, name, (args, _result, at, duration) => {
      if (name === 'createTexture') { event('gpu-texture-create', { method: name }, at, duration); return; }
      const source = args[args.length - 1];
      gpuUploads++; gpuUploadMs += duration;
      if (source instanceof HTMLCanvasElement) canvasUploads++;
      if (source instanceof HTMLImageElement) imageUploads.add(source.currentSrc || source.src);
    }, `WebGL.${name}`);
  }
  const contextLost = (): void => event('webgl-context-lost');
  const contextRestored = (): void => event('webgl-context-restored');
  game.canvas.addEventListener('webglcontextlost', contextLost);
  game.canvas.addEventListener('webglcontextrestored', contextRestored);
  cleanups.push(() => {
    game.canvas.removeEventListener('webglcontextlost', contextLost);
    game.canvas.removeEventListener('webglcontextrestored', contextRestored);
  });
  const visibility = (): void => event('visibility', { state: document.visibilityState });
  const blur = (): void => event('window-blur');
  const focus = (): void => event('window-focus');
  const offline = (): void => event('network-state', { online: navigator.onLine });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', blur); window.addEventListener('focus', focus);
  window.addEventListener('online', offline); window.addEventListener('offline', offline);
  cleanups.push(() => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
    window.removeEventListener('online', offline); window.removeEventListener('offline', offline);
  });
  const hotUpdate = (): void => event('vite-hmr-update');
  import.meta.hot?.on('vite:beforeUpdate', hotUpdate);
  cleanups.push(() => import.meta.hot?.off('vite:beforeUpdate', hotUpdate));

  const preStep = (_time: number, delta: number): void => {
    if (!active) return;
    frameAt = performance.now();
    gap = previousAt ? frameAt - previousAt : 0;
    phaserDelta = delta; rawDelta = game.loop.rawDelta;
    frameMutations = active.mutations - mutationsBefore; mutationsBefore = active.mutations;
  };
  const preRender = (): void => {
    if (!active) return;
    renderAt = performance.now(); stepCpu = renderAt - frameAt;
  };
  const postRender = (): void => {
    if (!active || !frameAt) return;
    const renderCpu = performance.now() - renderAt;
    const elapsed = runner.runElapsed;
    if (gpuUploads) {
      event('gpu-uploads-frame', { calls: gpuUploads, cpuMs: gpuUploadMs, canvasUploads, imageSources: [...imageUploads] }, frameAt, performance.now() - frameAt);
      gpuUploads = 0; gpuUploadMs = 0; canvasUploads = 0; imageUploads.clear();
    }
    active.maxGapMs = Math.max(active.maxGapMs, gap);
    if (gap > 50) active.over50++;
    if (gap > 100) active.over100++;
    if (gap > 200) active.over200++;
    if (gap > 50 && active.gaps.length < 1000) active.gaps.push({
      at: frameAt, previousAt, previousElapsed, elapsed, gapMs: gap, phaserDeltaMs: phaserDelta, rawDeltaMs: rawDelta,
      stepCpuMs: stepCpu, renderSubmissionMs: renderCpu, visibility: document.visibilityState,
      paused: runner.paused, crosses25s: previousElapsed < 25 && elapsed >= 25, near25s: Math.abs(elapsed - 25) <= 0.5,
    });
    if (active.count < capacity) {
      const offset = active.count++ * columns.length;
      active.frames[offset] = frameAt; active.frames[offset + 1] = elapsed;
      active.frames[offset + 2] = phaserDelta; active.frames[offset + 3] = rawDelta;
      active.frames[offset + 4] = gap; active.frames[offset + 5] = stepCpu;
      active.frames[offset + 6] = renderCpu; active.frames[offset + 7] = frameMutations;
    } else active.droppedFrames++;
    const sprite = runner.playerSprite;
    if (sprite && playerFrames.get(sprite) !== sprite.frame.name) {
      playerFrames.set(sprite, sprite.frame.name);
      event('animation-frame', { name: 'player', texture: sprite.texture.key, frame: sprite.frame.name });
    }
    if (previousElapsed < 25 && elapsed >= 25) event('district-25s', { previousElapsed });
    previousAt = frameAt; previousElapsed = elapsed;
    if ((!runner.running || runner.dead || !game.scene.isActive('Runner')) && active.count > 1) {
      event('run-ended'); active.finishedAt = performance.now(); active = undefined; button.hidden = false;
    }
  };
  game.events.on(Phaser.Core.Events.PRE_STEP, preStep);
  game.events.on(Phaser.Core.Events.PRE_RENDER, preRender);
  game.events.on(Phaser.Core.Events.POST_RENDER, postRender);
  cleanups.push(() => {
    game.events.off(Phaser.Core.Events.PRE_STEP, preStep); game.events.off(Phaser.Core.Events.PRE_RENDER, preRender);
    game.events.off(Phaser.Core.Events.POST_RENDER, postRender);
  });
  const raf = (): void => {
    const now = performance.now();
    if (active && rafAt) {
      const delta = now - rafAt;
      active.rafMaxGapMs = Math.max(active.rafMaxGapMs, delta);
      if (delta > 50) event('raf-gap', { gapMs: delta, visibility: document.visibilityState });
    }
    rafAt = now; rafId = requestAnimationFrame(raf);
  };
  rafId = requestAnimationFrame(raf);
  cleanups.push(() => cancelAnimationFrame(rafId));

  const summary = (): Row => ({ runs: runs.map(run => ({
    startedAt: run.startedAt, finishedAt: run.finishedAt, frames: run.count, maxGapMs: run.maxGapMs,
    firstFrameAfterPlayMs: run.count ? run.frames[0] - run.startedAt : null,
    over50: run.over50, over100: run.over100, over200: run.over200, rafMaxGapMs: run.rafMaxGapMs,
    droppedFrames: run.droppedFrames, droppedEvents: run.droppedEvents, work: run.work, dom: run.dom,
    gaps: run.gaps.map(row => ({ ...row, nearbyEvents: run.events.filter(event =>
      event.at <= (row.at as number) + 100 && event.at + event.duration >= (row.previousAt as number) - 100) })),
  })) });
  const exportReport = (): string => JSON.stringify({
    version: 1, generatedAt: new Date().toISOString(), timeOrigin: performance.timeOrigin,
    environment: { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      viewport: [innerWidth, innerHeight], devicePixelRatio, visibility: document.visibilityState,
      renderer: renderer.gl ? 'WebGL' : 'Canvas', viteDev: import.meta.env.DEV, online: navigator.onLine, supported },
    caveats: ['Opt-in wrappers and mutation observation add overhead; compare ungated gameplay.',
      'Phaser delta can be smoothed; wallGapMs is measured with performance.now independently.',
      'Render submission and WebGL upload calls are CPU observations, not GPU completion or displayed-frame timings.',
      'Implicit browser image decoding, compositor-only stalls and GC attribution require a browser performance trace.',
      'PerformanceObserver event elapsed is the callback-time Runner elapsed; entry startTime/duration remain authoritative for correlation.',
      'Nearby events are correlations, not proof of causation. Resource durations can overlap without blocking gameplay.',
      'Counts include visible/hidden and paused gaps; use recorded visibility and pause state to separate them.',
      'Capture retains the latest three runs, up to 20000 frames, 16000 events and 1000 significant gaps per run.'],
    frameColumns: columns, summary: summary(),
    runs: runs.map(run => ({ startedAt: run.startedAt, finishedAt: run.finishedAt,
      frames: Array.from(run.frames.subarray(0, run.count * columns.length)), events: run.events })),
  }, null, 2);
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([exportReport()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `portrait-frames-${Date.now()}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Download frame report';
  button.style.cssText = 'position:fixed;right:8px;bottom:4px;z-index:1000;font:11px Arial;padding:6px;background:#123e46;color:white;border:1px solid #5c8c80;border-radius:4px';
  button.addEventListener('click', download); document.body.append(button);
  window.portraitFrameDiagnostics = { export: exportReport, summary, download };
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    for (const observer of observers) observer.disconnect();
    for (const cleanup of cleanups.reverse()) cleanup();
    button.remove();
  });
}
