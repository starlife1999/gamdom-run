import Phaser from 'phaser';

type FullscreenRoot = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };
type BufferedKeyboardManager = Phaser.Input.Keyboard.KeyboardManager & { queue: KeyboardEvent[] };

const presentations = new WeakMap<Phaser.Game, MobilePresentation>();
const blockedEvents = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel',
  'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
  'click', 'dblclick', 'keydown', 'keyup'];

function isMobilePresentation(): boolean {
  const touch = navigator.maxTouchPoints > 0;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const desktopIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const primaryTouch = touch && (window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches);
  return mobileUserAgent || desktopIPad || primaryTouch;
}

export function requestLandscapePresentation(game: Phaser.Game): void {
  void presentations.get(game)?.requestLandscape();
}

export function installMobilePresentation(game: Phaser.Game): void {
  presentations.set(game, new MobilePresentation(game));
}

class MobilePresentation {
  private readonly shell = document.querySelector<HTMLElement>('#game-shell')!;
  private readonly app = document.querySelector<HTMLElement>('#app')!;
  private readonly overlay = document.querySelector<HTMLElement>('#orientation-overlay')!;
  private readonly resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => this.scheduleUpdate()) : undefined;
  private blocked = false;
  private ownsPause = false;
  private ready: boolean;
  private destroyed = false;
  private frame = 0;
  private requestInFlight = false;
  private inputState?: { pointer: boolean; keyboard: boolean };
  private parentBounds = '';

  constructor(private readonly game: Phaser.Game) {
    this.ready = game.isRunning;
    window.addEventListener('resize', this.scheduleUpdate);
    window.addEventListener('orientationchange', this.scheduleUpdate);
    window.visualViewport?.addEventListener('resize', this.scheduleUpdate);
    window.visualViewport?.addEventListener('scroll', this.scheduleUpdate);
    window.screen.orientation?.addEventListener('change', this.scheduleUpdate);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.addEventListener('fullscreenerror', this.scheduleUpdate);
    for (const name of blockedEvents) {
      window.addEventListener(name, this.blockInput, { capture: true, passive: false });
    }
    game.events.once(Phaser.Core.Events.READY, this.onReady);
    game.events.on(Phaser.Core.Events.RESUME, this.onResume);
    game.events.on('home-visibility', this.scheduleUpdate);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
    this.resizeObserver?.observe(this.app);
    this.update();
  }

  private readonly onReady = (): void => {
    this.ready = true;
    this.parentBounds = '';
    this.update();
  };

  private readonly onResume = (): void => {
    if (this.blocked && !this.game.isPaused) {
      this.ownsPause = true;
      this.game.pause();
    }
  };

  private readonly blockInput = (event: Event): void => {
    if (!this.blocked) return;
    if (event instanceof KeyboardEvent && (event.key === 'Escape' || event.key === 'Tab'
      || event.ctrlKey || event.metaKey || event.altKey)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly scheduleUpdate = (): void => {
    if (this.destroyed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  };

  private readonly onFullscreenChange = (): void => {
    this.parentBounds = '';
    this.update();
    this.scheduleUpdate();
  };

  private update(): void {
    if (this.destroyed) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const properties = { width, height, left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 };
    for (const [name, value] of Object.entries(properties)) {
      const pixels = `${value}px`;
      if (this.shell.style.getPropertyValue(name) !== pixels) this.shell.style.setProperty(name, pixels);
    }

    const homeVisible = document.documentElement.dataset.home === 'true';
    this.setBlocked(!homeVisible && isMobilePresentation() && window.innerHeight > window.innerWidth);
    if (this.ready) {
      const bounds = this.app.getBoundingClientRect();
      const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
      if (key !== this.parentBounds) {
        this.parentBounds = key;
        // FIT reads the safe-area parent, never changes the 960 x 540 game size.
        this.game.scale.getParentBounds();
        this.game.scale.refresh();
      }
    }
  }

  private setBlocked(blocked: boolean): void {
    this.blocked = blocked;
    this.overlay.hidden = !blocked;
    this.app.inert = blocked;
    if (blocked) this.app.setAttribute('aria-hidden', 'true');
    else this.app.removeAttribute('aria-hidden');

    if (blocked) {
      if (!this.game.isPaused) {
        this.ownsPause = true;
        this.game.pause();
      }
      if (this.ready && !this.inputState) {
        const keyboard = this.game.input.keyboard as BufferedKeyboardManager | null;
        this.inputState = { pointer: this.game.input.enabled, keyboard: keyboard?.enabled ?? false };
        this.game.input.enabled = false;
        if (keyboard) {
          keyboard.enabled = false;
          keyboard.queue.length = 0;
        }
      }
    } else {
      if (this.inputState) {
        const keyboard = this.game.input.keyboard as BufferedKeyboardManager | null;
        if (keyboard) {
          keyboard.queue.length = 0;
          keyboard.enabled = this.inputState.keyboard;
        }
        this.game.input.enabled = this.inputState.pointer;
        this.inputState = undefined;
      }
      if (this.ownsPause) {
        this.ownsPause = false;
        if (this.game.isRunning) this.game.loop.resetDelta();
        this.game.resume();
      }
    }
  }

  async requestLandscape(): Promise<void> {
    if (!isMobilePresentation() || this.blocked || this.requestInFlight || this.destroyed) return;
    this.requestInFlight = true;
    try {
      const root = document.documentElement as FullscreenRoot;
      const doc = document as FullscreenDocument;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        const standard = typeof root.requestFullscreen === 'function' && doc.fullscreenEnabled !== false;
        if (standard || typeof root.webkitRequestFullscreen === 'function') {
          try {
            // Invoke before the first await, on the existing PLAY input call stack.
            const entered = standard
              ? root.requestFullscreen({ navigationUI: 'hide' })
              : root.webkitRequestFullscreen!();
            await entered;
          } catch {
            // Denied/unsupported fullscreen leaves the orientation fallback active.
          }
        }
      }
      if (doc.fullscreenElement || doc.webkitFullscreenElement) this.onFullscreenChange();
      const orientation = window.screen.orientation as LockableOrientation | undefined;
      if (typeof orientation?.lock === 'function') {
        try {
          await orientation.lock('landscape');
        } catch {
          // Physical rotation and the blocker remain authoritative.
        }
      }
    } catch {
      // Browser API access can itself fail in restricted contexts.
    } finally {
      this.requestInFlight = false;
      this.scheduleUpdate();
    }
  }

  private readonly destroy = (): void => {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleUpdate);
    window.removeEventListener('orientationchange', this.scheduleUpdate);
    window.visualViewport?.removeEventListener('resize', this.scheduleUpdate);
    window.visualViewport?.removeEventListener('scroll', this.scheduleUpdate);
    window.screen.orientation?.removeEventListener('change', this.scheduleUpdate);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('fullscreenerror', this.scheduleUpdate);
    for (const name of blockedEvents) window.removeEventListener(name, this.blockInput, true);
    this.game.events.off(Phaser.Core.Events.READY, this.onReady);
    this.game.events.off(Phaser.Core.Events.RESUME, this.onResume);
    this.game.events.off('home-visibility', this.scheduleUpdate);
    presentations.delete(this.game);
  };
}
