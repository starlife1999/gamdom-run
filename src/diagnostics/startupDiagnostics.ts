import Phaser from 'phaser';

type Row = Record<string, unknown>;
interface PlayerState { onGround: boolean; jumpCount: number; sliding: boolean; fastFalling: boolean; pose: string }
interface ObservedRunner {
  runElapsed: number; distance: number; speed: number; running: boolean; paused: boolean; dead: boolean;
  player?: PlayerState; playerSprite?: Phaser.GameObjects.Sprite;
  children: Phaser.GameObjects.DisplayList;
}
interface InputSample {
  eventAt: number | null; domHandlerAt: number | null; handlerAt: number | null;
  command: string; commandAt: number; stateChangedAt: number | null; state?: PlayerState;
  renderSubmittedAt?: number; renderedPose?: string; renderedFrame?: string;
}
interface Run {
  index: number; kind: string; startedAt: number; finishedAt?: number; playEventAt: number | null;
  frames: Row[]; inputs: InputSample[]; work: Row[]; firstAppearances: Row[];
  interruptions: string[]; touches: number; textureInventory: Row[]; summary?: Row;
}
declare global {
  interface Window {
    startupDiagnostics?: { version: number; installedAt: number; runs: Run[]; export: () => string; summary: () => string };
  }
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function installStartupDiagnostics(game: Phaser.Game): void {
  if (window.startupDiagnostics) return;
  const installedAt = performance.now();
  const runs: Run[] = [];
  let runCounter = 0;
  const browserWork: Row[] = [];
  let active: Run | undefined;
  let runner: ObservedRunner;
  let lastFrameAt = 0;
  let lastDom: { eventAt: number; handlerAt: number } | undefined;
  let inputContext: { handlerAt: number; eventAt: number | null; domHandlerAt: number | null } | undefined;
  let pendingInputs: InputSample[] = [];
  let currentFrame: Row | undefined;
  let appearances = new Set<string>();
  let lastObjectFrames = new WeakMap<object, unknown>();
  let mutations = 0;
  let mutationBase = 0;
  const observers: PerformanceObserver[] = [];
  const cleanups: Array<() => void> = [];
  const info: Row = {
    userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    viewport: [innerWidth, innerHeight], devicePixelRatio,
    mode: location.pathname.includes('portrait') ? 'portrait' : 'production',
    supportedPerformanceEntryTypes: typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes ?? [],
    caveats: ['Opt-in instrumentation has overhead. No GPU completion/presentation timing.',
      'POST_RENDER measures render submission, not photons or touch hardware.',
      'Fresh navigation is not proof that OS, disk or GPU caches are cold.',
      'Recorder does not warm assets or change gameplay state. Normal Boot mask preparation runs in both modes.'],
  };
  const exportReport = (): string => JSON.stringify({ version: 1, installedAt, info, runs, browserWork }, null, 2);
  const summaryReport = (): string => JSON.stringify({ version: 1, info, runs: runs.map(run => ({
    index: run.index, kind: run.kind, touches: run.touches, interruptions: run.interruptions, summary: run.summary,
    inputs: run.inputs.map(input => ({ command: input.command,
      eventToCommandMs: input.eventAt === null ? null : input.commandAt - input.eventAt,
      domHandlerToCommandMs: input.domHandlerAt === null ? null : input.commandAt - input.domHandlerAt,
      pointerHandlerToCommandMs: input.handlerAt === null ? null : input.commandAt - input.handlerAt,
      commandToStateMs: input.stateChangedAt === null ? null : input.stateChangedAt - input.commandAt,
      commandToRenderSubmissionMs: input.renderSubmittedAt === undefined ? null : input.renderSubmittedAt - input.commandAt,
      renderedPose: input.renderedPose, renderedFrame: input.renderedFrame })),
  })) }, null, 2);
  window.startupDiagnostics = { version: 1, installedAt, runs, export: exportReport, summary: summaryReport };

  // Diagnostic UI is opt-in, hidden throughout capture, and never controls Runner.
  const style = document.createElement('style');
  style.textContent = `.startup-report-button{position:fixed;right:12px;bottom:calc(6px + env(safe-area-inset-bottom,0px));z-index:1000;padding:8px 12px;background:#142f32;color:#fff;border:1px solid #81aa9c;border-radius:4px;font:12px Arial}
    .startup-report-dialog{position:fixed;inset:8% 12px;z-index:1001;max-width:640px;margin:auto;padding:16px;background:#102326;color:#fff;border:1px solid #81aa9c;border-radius:4px;overflow:auto;font:13px Arial}
    .startup-report-dialog textarea{width:100%;height:55%;min-height:160px;resize:none;background:#071517;color:#fff;font:11px monospace}
    .startup-report-dialog button{margin:8px 8px 0 0;padding:10px;border:1px solid #81aa9c;border-radius:4px;background:#173b35;color:#fff}
    .startup-report-button[hidden],.startup-report-dialog[hidden]{display:none}`;
  const button = document.createElement('button');
  button.className = 'startup-report-button'; button.textContent = 'Startup report'; button.type = 'button';
  const panel = document.createElement('section');
  panel.className = 'startup-report-dialog'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Startup timing report');
  const title = document.createElement('h2'); title.textContent = 'Startup timing';
  const note = document.createElement('p');
  note.textContent = 'Use PLAY normally. Record one untouched run, then TRY AGAIN with touches. Only the first 8 seconds are recorded. Copy summary or download raw JSON. The recorder does not alter gameplay; normal HQ mask preparation runs in Boot.';
  const area = document.createElement('textarea'); area.readOnly = true; area.setAttribute('aria-label', 'Timing summary');
  const copy = document.createElement('button'); copy.textContent = 'Copy summary';
  const download = document.createElement('button'); download.textContent = 'Download raw JSON';
  const close = document.createElement('button'); close.textContent = 'Close';
  panel.append(title, note, area, copy, download, close); document.head.append(style); document.body.append(button, panel);
  const showReport = (): void => { area.value = summaryReport(); panel.hidden = false; };
  button.addEventListener('click', showReport);
  close.addEventListener('click', () => panel.hidden = true);
  copy.addEventListener('click', () => {
    area.value = summaryReport(); area.focus(); area.select();
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(area.value).catch(() => area.select());
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportReport()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'startup-timing.json'; link.click();
    // Keep the URL alive until teardown to avoid racing phone download handling.
    cleanups.push(() => URL.revokeObjectURL(url));
  });

  for (const type of ['longtask', 'long-animation-frame']) {
    if (typeof PerformanceObserver === 'undefined') break;
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) continue;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (browserWork.length < 1000) {
          const detail = entry as PerformanceEntry & { blockingDuration?: number; renderStart?: number; styleAndLayoutStart?: number };
          browserWork.push({ type, at: entry.startTime, duration: entry.duration,
            blockingDuration: detail.blockingDuration, renderStart: detail.renderStart, styleAndLayoutStart: detail.styleAndLayoutStart });
        }
      }
    });
    observer.observe({ type, buffered: true }); observers.push(observer);
  }
  const hud = document.getElementById('portrait-hud');
  const mutationObserver = hud ? new MutationObserver(records => mutations += records.length) : undefined;

  const eventTime = (event: Event): number => event.timeStamp > 1e12 ? event.timeStamp - performance.timeOrigin : event.timeStamp;
  const pointerDown = (event: PointerEvent): void => {
    lastDom = { eventAt: eventTime(event), handlerAt: performance.now() };
    if (active) active.touches++;
  };
  const keyDown = (event: KeyboardEvent): void => { lastDom = { eventAt: eventTime(event), handlerAt: performance.now() }; };
  const visibility = (): void => { if (active && document.hidden) active.interruptions.push('document-hidden'); };
  window.addEventListener('pointerdown', pointerDown, { capture: true, passive: true });
  window.addEventListener('keydown', keyDown, { capture: true, passive: true });
  document.addEventListener('visibilitychange', visibility);
  const state = (): PlayerState | undefined => runner.player ? { onGround: runner.player.onGround, jumpCount: runner.player.jumpCount,
    sliding: runner.player.sliding, fastFalling: runner.player.fastFalling, pose: runner.player.pose } : undefined;
  const stateKey = (value: PlayerState | undefined): string => value ? `${value.onGround}:${value.jumpCount}:${value.sliding}:${value.fastFalling}` : '';

  const inventory = (): Row[] => (Object.values(game.textures.list) as Phaser.Textures.Texture[]).flatMap(texture => texture.source.map(source => ({
    key: texture.key, width: source.width, height: source.height, hasGlTexture: !!source.glTexture,
  })));
  const begin = (): void => {
    if (active) active.interruptions.push('restart-before-eight-seconds');
    const now = performance.now();
    active = { index: ++runCounter, kind: runCounter > 1 ? 'warm-restart' : 'fresh-navigation', startedAt: now,
      playEventAt: lastDom && now - lastDom.handlerAt < 1000 ? lastDom.eventAt : null,
      frames: [], inputs: [], work: [], firstAppearances: [], interruptions: [], touches: 0, textureInventory: inventory() };
    runs.push(active); if (runs.length > 6) runs.shift();
    lastFrameAt = now; currentFrame = undefined; pendingInputs = []; appearances = new Set(); lastObjectFrames = new WeakMap(); mutationBase = mutations;
    button.hidden = true; panel.hidden = true;
    if (hud) mutationObserver?.observe(hud, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  const finish = (): void => {
    if (!active) return;
    const gaps = active.frames.map(frame => Number(frame.gapMs));
    const firstFive = active.frames.filter(frame => Number(frame.wallMs) <= 5000);
    const worst = active.frames.reduce<Row | undefined>((result, frame) => !result || Number(frame.gapMs) > Number(result.gapMs) ? frame : result, undefined);
    const counts = (frames: Row[]): Row => Object.fromEntries([33, 50, 100, 250].map(limit => [`over${limit}ms`, frames.filter(frame => Number(frame.gapMs) > limit).length]));
    const methods: Record<string, { calls: number; totalMs: number; maxMs: number }> = {};
    for (const work of active.work) {
      const method = String(work.method); const aggregate = methods[method] ??= { calls: 0, totalMs: 0, maxMs: 0 };
      aggregate.calls++; aggregate.totalMs += Number(work.duration); aggregate.maxMs = Math.max(aggregate.maxMs, Number(work.duration));
    }
    active.finishedAt = performance.now();
    active.summary = { frames: gaps.length, medianGapMs: percentile(gaps, 0.5), p95GapMs: percentile(gaps, 0.95),
      firstEight: counts(active.frames), firstFive: counts(firstFive), worst,
      endRunElapsed: runner.runElapsed, hudMutationRecords: mutations - mutationBase,
      methods, durationMs: active.finishedAt - active.startedAt };
    active = undefined; mutationObserver?.disconnect(); button.hidden = false;
  };

  // Wrappers preserve original arguments, receiver, return value and exceptions.
  // They are installed only for the explicit query flag; normal runs never load this module.
  const wrap = (object: object, name: string, callback: (original: (...args: unknown[]) => unknown, receiver: unknown, args: unknown[]) => unknown): void => {
    const target = object as Record<string, unknown>;
    if (typeof target[name] !== 'function') return;
    const original = target[name] as (...args: unknown[]) => unknown;
    target[name] = function (this: unknown, ...args: unknown[]): unknown { return callback(original, this, args); };
    cleanups.push(() => target[name] = original);
  };
  const recordWork = (method: string, start: number): void => {
    if (active && active.work.length < 6000) active.work.push({ method, at: start, duration: performance.now() - start });
  };
  const setup = (): void => {
    const scene = game.scene.getScene('Runner'); runner = scene as unknown as ObservedRunner;
    info.renderer = game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas';
    wrap(game.scene.getScene('Boot'), 'create', (original, receiver, args) => {
      const start = performance.now();
      try { return original.apply(receiver, args); }
      finally { info.bootCreateAt = start; info.bootCreateMs = performance.now() - start; }
    });
    wrap(scene, 'init', (original, receiver, args) => { begin(); const start = performance.now(); try { return original.apply(receiver, args); } finally { recordWork('Runner.init', start); } });
    for (const name of ['create', 'renderBackground', 'renderPlayer', 'renderItems', 'updateHud', 'spawnPattern']) {
      wrap(scene, name, (original, receiver, args) => {
        if (!active) return original.apply(receiver, args);
        const start = performance.now(); try { return original.apply(receiver, args); }
        finally {
          recordWork(`Runner.${name}`, start);
          if (active && name === 'renderPlayer') for (const input of pendingInputs) {
            const now = state(), expected = input.state;
            if (input.renderSubmittedAt === undefined && expected && now && stateKey(expected) === stateKey(now)) {
              input.renderedPose = now.pose; input.renderedFrame = String(runner.playerSprite?.frame.name ?? '');
            }
          }
        }
      });
    }
    wrap(scene, 'handlePointerDown', (original, receiver, args) => {
      const pointer = args[0] as Phaser.Input.Pointer;
      const previous = inputContext;
      inputContext = { handlerAt: performance.now(), eventAt: pointer.event ? eventTime(pointer.event) : null,
        domHandlerAt: lastDom && performance.now() - lastDom.handlerAt < 250 ? lastDom.handlerAt : null };
      try { return original.apply(receiver, args); } finally { inputContext = previous; }
    });
    for (const name of ['jump', 'slide', 'setSlideKey']) {
      wrap(scene, name, (original, receiver, args) => {
        if (!active) return original.apply(receiver, args);
        const before = stateKey(state()), commandAt = performance.now(); const result = original.apply(receiver, args);
        if (active) {
          const after = state(); const input: InputSample = { command: name, commandAt,
            eventAt: inputContext?.eventAt ?? null, domHandlerAt: inputContext?.domHandlerAt ?? null,
            handlerAt: inputContext?.handlerAt ?? null,
            stateChangedAt: before !== stateKey(after) ? performance.now() : null, state: after };
          if (active.inputs.length < 200) active.inputs.push(input);
          if (input.stateChangedAt !== null) pendingInputs.push(input);
        }
        return result;
      });
    }
    wrap(scene, 'update', (original, receiver, args) => {
      if (!active) return original.apply(receiver, args);
      const start = performance.now(), previousDistance = runner.distance;
      const result = original.apply(receiver, args);
      if (active && active.frames.length < 2000) {
        currentFrame = { at: start, wallMs: start - active.startedAt, rafTimestamp: args[0], deltaMs: args[1],
          rawDeltaMs: game.loop.rawDelta, gapMs: start - lastFrameAt,
          elapsed: runner.runElapsed, speed: runner.speed, worldStep: runner.distance - previousDistance,
          distanceIncrement: runner.distance - previousDistance, distance: runner.distance,
          updateMs: performance.now() - start, running: runner.running, paused: runner.paused, dead: runner.dead,
          children: runner.children.length, playerFrame: runner.playerSprite?.frame.name,
          physicsDeltaMs: Math.min(Math.max(0, Number(args[1])), 1000 / 30) };
        const timing = game.loop as unknown as { _coolDown: number; inFocus: boolean; _min: number; _target: number; smoothStep: boolean };
        currentFrame.smoothing = { coolDownFrames: timing._coolDown, inFocus: timing.inFocus,
          minFpsDeltaMs: timing._min, targetDeltaMs: timing._target, enabled: timing.smoothStep };
        active.frames.push(currentFrame); lastFrameAt = start;
        if ((runner.paused || runner.dead) && !active.interruptions.includes('paused-or-dead')) active.interruptions.push('paused-or-dead');
      }
      return result;
    });
    const renderer = game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      for (const method of ['createTextureFromSource', 'createCanvasTexture']) wrap(renderer, method, (original, receiver, args) => {
        if (!active) return original.apply(receiver, args);
        const start = performance.now(); try { return original.apply(receiver, args); } finally { recordWork(`renderer.${method}`, start); }
      });
    }
    const preRender = (): void => { if (active && currentFrame) currentFrame.preRenderAt = performance.now(); };
    const postRender = (): void => {
      if (!active) return;
      if ((runner.paused || runner.dead) && !active.interruptions.includes('paused-or-dead')) active.interruptions.push('paused-or-dead');
      const now = performance.now();
      if (currentFrame && currentFrame.renderSubmittedAt === undefined) currentFrame.renderSubmittedAt = now;
      for (const input of pendingInputs) if (input.renderedFrame !== undefined && input.renderSubmittedAt === undefined) input.renderSubmittedAt = now;
      pendingInputs = pendingInputs.filter(input => input.renderSubmittedAt === undefined && now - input.commandAt < 1000);
      // Record first use of texture/frame pairs without allocating new game objects.
      for (const object of scene.children.list) {
        const image = object as Phaser.GameObjects.Image;
        if (!image.visible || !image.texture || !image.frame || lastObjectFrames.get(image) === image.frame) continue;
        lastObjectFrames.set(image, image.frame);
        const key = `${image.texture.key}:${image.frame.name}`;
        if (!appearances.has(key)) {
          appearances.add(key);
          if (active.firstAppearances.length < 250) active.firstAppearances.push({ at: now, wallMs: now - active.startedAt,
            key, x: image.x, y: image.y, note: 'Visible flag/texture submission candidate; may be outside camera or ignored.' });
        }
      }
      if (now - active.startedAt >= 8000) finish();
    };
    game.events.on(Phaser.Core.Events.PRE_RENDER, preRender); game.events.on(Phaser.Core.Events.POST_RENDER, postRender);
    cleanups.push(() => { game.events.off(Phaser.Core.Events.PRE_RENDER, preRender); game.events.off(Phaser.Core.Events.POST_RENDER, postRender); });
    if (game.scene.isActive('Runner')) {
      begin(); active!.kind = 'late-attachment'; active!.interruptions.push('recorder-attached-after-run-start');
    }
  };
  if (game.scene.isBooted) setup(); else game.events.once(Phaser.Core.Events.READY, setup);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observers.forEach(observer => observer.disconnect()); mutationObserver?.disconnect();
    window.removeEventListener('pointerdown', pointerDown, true); window.removeEventListener('keydown', keyDown, true);
    document.removeEventListener('visibilitychange', visibility); cleanups.reverse().forEach(cleanup => cleanup());
    style.remove(); button.remove(); panel.remove(); game.events.off(Phaser.Core.Events.READY, setup);
    delete window.startupDiagnostics;
  });
}
