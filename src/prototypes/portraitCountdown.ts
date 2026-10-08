import './portraitCountdown.css';

const stages = [
  { label: '3', duration: 700 },
  { label: '2', duration: 700 },
  { label: '1', duration: 700 },
  { label: 'GO!', duration: 350 },
] as const;

export class PortraitCountdown {
  private readonly root = document.createElement('div');
  private readonly label = document.createElement('div');
  private readonly resizeObserver: ResizeObserver;
  private readonly heldKeys = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private complete?: () => void;
  private cancelled?: () => void;
  active = false;

  constructor(private readonly band: HTMLElement) {
    this.root.id = 'portrait-countdown';
    this.root.hidden = true;
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.label.className = 'portrait-countdown-label';
    this.root.append(this.label);
    document.body.append(this.root);
    this.resizeObserver = new ResizeObserver(this.align);
    this.resizeObserver.observe(band);
    window.addEventListener('resize', this.align);
    window.visualViewport?.addEventListener('resize', this.align);
    window.visualViewport?.addEventListener('scroll', this.align);
    window.addEventListener('pagehide', this.cancel);
  }

  start(complete: () => void, cancelled: () => void): void {
    if (this.active) return;
    this.active = true;
    this.complete = complete;
    this.cancelled = cancelled;
    this.root.hidden = false;
    this.root.focus({ preventScroll: true });
    window.addEventListener('keydown', this.blockKey, true);
    window.addEventListener('keyup', this.releaseKey, true);
    this.align();
    this.showStage(0);
  }

  private showStage(index: number): void {
    const stage = stages[index];
    const number = document.createElement('span');
    number.className = 'portrait-countdown-number';
    number.textContent = stage.label;
    this.root.dataset.stage = stage.label;
    this.root.dataset.go = String(index === 3);
    this.label.replaceChildren(number);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.active) return;
      if (index + 1 < stages.length) this.showStage(index + 1);
      else {
        const complete = this.complete;
        this.hide();
        this.detachReleasedKeys();
        complete?.();
      }
    }, stage.duration);
  }

  private readonly align = (): void => {
    if (!this.active) return;
    const bounds = this.band.getBoundingClientRect();
    this.label.style.left = `${bounds.left + bounds.width / 2}px`;
    this.label.style.top = `${bounds.top + bounds.height / 2}px`;
  };

  // Held keys remain consumed after GO until release, including repeat events.
  private readonly blockKey = (event: KeyboardEvent): void => {
    if (!this.active && !this.heldKeys.has(event.code)) return;
    this.heldKeys.add(event.code);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly releaseKey = (event: KeyboardEvent): void => {
    if (!this.active && !this.heldKeys.has(event.code)) return;
    this.heldKeys.delete(event.code);
    event.preventDefault();
    event.stopImmediatePropagation();
    this.detachReleasedKeys();
  };

  private detachReleasedKeys(): void {
    if (this.active || this.heldKeys.size) return;
    window.removeEventListener('keydown', this.blockKey, true);
    window.removeEventListener('keyup', this.releaseKey, true);
  }

  private hide(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.active = false;
    this.root.hidden = true;
    this.complete = undefined;
    this.cancelled = undefined;
  }

  readonly cancel = (): void => {
    const cancelled = this.cancelled;
    this.hide();
    this.heldKeys.clear();
    this.detachReleasedKeys();
    cancelled?.();
  };

  destroy(): void {
    this.cancel();
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.align);
    window.visualViewport?.removeEventListener('resize', this.align);
    window.visualViewport?.removeEventListener('scroll', this.align);
    window.removeEventListener('pagehide', this.cancel);
    this.root.remove();
  }
}
