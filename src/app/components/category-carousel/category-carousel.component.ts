import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface CategoryCarouselCard {
  categoryId: string;
  name: string;
  sampleCount: number;
  scoredCount: number;
  isLocked: boolean;
}

const PEEK = 20; // px of adjacent card visible on each side
const GAP = 12; // px gap between cards (matches gap-3)
const SWIPE_THRESHOLD = 50; // min px delta to register a swipe

@Component({
  selector: 'app-category-carousel',
  templateUrl: './category-carousel.component.html',
  styleUrl: './category-carousel.component.scss',
})
export class CategoryCarouselComponent implements AfterViewInit, OnDestroy {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly cards = input.required<CategoryCarouselCard[]>();
  readonly activeCategoryId = input.required<string>();
  readonly cardClick = output<string>();

  readonly activeIndex = computed(() =>
    Math.max(0, this.cards().findIndex((c) => c.categoryId === this.activeCategoryId())),
  );

  readonly focusedIndex = signal(0);
  readonly dragOffset = signal(0);
  readonly isDragging = signal(false);

  private readonly containerWidth = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  readonly cardWidth = computed(() => Math.max(0, this.containerWidth() - 2 * PEEK));

  readonly trackTransform = computed(() => {
    const width = this.cardWidth();
    if (!width) return 'translateX(0px)';
    const index = this.focusedIndex();
    const drag = this.dragOffset();
    return `translateX(${PEEK - index * (width + GAP) + drag}px)`;
  });

  private startX = 0;
  private startY = 0;
  private isHorizontalSwipe: boolean | null = null;
  private hasSwiped = false;
  private isPointerDown = false;
  private activePointerId = -1;

  // Use Pointer Events so the same code handles touch AND mouse drag
  private readonly boundPointerDown = this.handlePointerDown.bind(this);
  private readonly boundPointerMove = this.handlePointerMove.bind(this);
  private readonly boundPointerUp = this.handlePointerUp.bind(this);

  constructor() {
    effect(() => {
      this.focusedIndex.set(this.activeIndex());
    });
  }

  ngAfterViewInit(): void {
    const el = this.hostEl.nativeElement;

    this.containerWidth.set(el.getBoundingClientRect().width);

    this.resizeObserver = new ResizeObserver(() => {
      this.containerWidth.set(el.getBoundingClientRect().width);
    });
    this.resizeObserver.observe(el);

    el.addEventListener('pointerdown', this.boundPointerDown, { passive: true });
    el.addEventListener('pointermove', this.boundPointerMove, { passive: true });
    el.addEventListener('pointerup', this.boundPointerUp, { passive: true });
    el.addEventListener('pointercancel', this.boundPointerUp, { passive: true });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    const el = this.hostEl.nativeElement;
    el.removeEventListener('pointerdown', this.boundPointerDown);
    el.removeEventListener('pointermove', this.boundPointerMove);
    el.removeEventListener('pointerup', this.boundPointerUp);
    el.removeEventListener('pointercancel', this.boundPointerUp);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return;
    this.isPointerDown = true;
    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.isHorizontalSwipe = null;
    this.hasSwiped = false;
    this.isDragging.set(false);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!event.isPrimary || !this.isPointerDown) return;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    if (this.isHorizontalSwipe === null) {
      if (Math.abs(deltaX) > Math.abs(deltaY) + 5) {
        this.isHorizontalSwipe = true;
        // Capture only on confirmed horizontal swipe — keeps pointermove firing
        // if the pointer exits element bounds, without stealing the click event
        // on a clean tap (captured element receives the synthesized click)
        try {
          this.hostEl.nativeElement.setPointerCapture(this.activePointerId);
        } catch {
          // ignore — not all environments support pointer capture
        }
      } else if (Math.abs(deltaY) > Math.abs(deltaX) + 5) {
        this.isHorizontalSwipe = false;
      } else {
        return;
      }
    }

    if (!this.isHorizontalSwipe) return;

    this.hasSwiped = true;
    this.isDragging.set(true);

    const index = this.focusedIndex();
    const maxIndex = this.cards().length - 1;

    const clampedDelta =
      index === 0 && deltaX > 0
        ? Math.min(deltaX * 0.3, PEEK * 2)
        : index === maxIndex && deltaX < 0
          ? Math.max(deltaX * 0.3, -PEEK * 2)
          : deltaX;

    this.dragOffset.set(clampedDelta);
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!event.isPrimary) return;
    this.isPointerDown = false;

    if (this.hasSwiped) {
      const offset = this.dragOffset();
      const index = this.focusedIndex();
      const maxIndex = this.cards().length - 1;

      if (offset < -SWIPE_THRESHOLD && index < maxIndex) {
        this.focusedIndex.set(index + 1);
      } else if (offset > SWIPE_THRESHOLD && index > 0) {
        this.focusedIndex.set(index - 1);
      }
    }

    this.dragOffset.set(0);
    this.isDragging.set(false);
    this.isHorizontalSwipe = null;
  }

  onCardClick(categoryId: string): void {
    // hasSwiped stays true until the next pointerdown, blocking any
    // synthetic click events that fire after a drag gesture
    if (this.hasSwiped) return;
    this.cardClick.emit(categoryId);
  }

  onDotClick(index: number): void {
    this.focusedIndex.set(index);
  }

  badgeClass(isFocused: boolean, isAllScored: boolean): string {
    if (isFocused) {
      return isAllScored ? 'bg-white text-primary' : 'bg-primary-light text-white';
    }
    return isAllScored ? 'bg-status-success text-white' : 'bg-bg-surface text-text-secondary';
  }

  trackBgClass(isFocused: boolean): string {
    return isFocused ? 'bg-primary-light' : 'bg-bg-surface';
  }
}
