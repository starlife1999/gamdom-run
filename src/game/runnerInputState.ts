export const JUMP_BUFFER_SECONDS = 0.1;
export const MIN_SLIDE_SECONDS = 0.12;
export const TOUCH_SLIDE_FRACTION = 0.35;

export class RunnerInputState {
  readonly slideKeys = new Set<'S' | 'DOWN'>();
  readonly pointers = new Map<number, 'jump' | 'slide'>();
  jumpBuffer = 0;
  jumpPointerId?: number;

  get slideHeld(): boolean {
    return this.slideKeys.size > 0 || [...this.pointers.values()].some(action => action === 'slide');
  }

  advance(seconds: number): void {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - seconds);
  }

  bufferJump(pointerId?: number): void {
    this.jumpBuffer = JUMP_BUFFER_SECONDS;
    this.jumpPointerId = pointerId;
  }

  clearJump(): void {
    this.jumpBuffer = 0;
    this.jumpPointerId = undefined;
  }

  clearPointers(): void {
    this.pointers.clear();
    if (this.jumpPointerId !== undefined) this.clearJump();
  }

  clear(): void {
    this.slideKeys.clear();
    this.pointers.clear();
    this.clearJump();
  }
}
