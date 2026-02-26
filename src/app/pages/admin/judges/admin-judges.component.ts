import { NgClass } from '@angular/common';
import { ActiveFestivalBannerComponent } from '../../../components/active-festival-banner/active-festival-banner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, startWith, switchMap } from 'rxjs';

import { Category } from '../../../models/category.model';
import { JudgeAssignment } from '../../../models/judge-assignment.model';
import { CategoryService } from '../../../services/category.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { UserService } from '../../../services/user.service';
import { PAGE_SIZE } from '../../../shared/pagination.constants';

type JudgeFilter = 'unassigned' | 'assigned';

@Component({
  selector: 'app-admin-judges',
  imports: [NgClass, LoadingSpinnerComponent, ActiveFestivalBannerComponent],
  templateUrl: './admin-judges.component.html',
  styleUrl: './admin-judges.component.scss',
})
export class AdminJudgesComponent {
  private readonly ctx = inject(FestivalContextService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);

  readonly PAGE_SIZE = PAGE_SIZE;

  readonly activeFestival = this.ctx.activeFestival;
  readonly activeEvent = this.ctx.activeEvent;
  readonly dataReady = this.ctx.dataReady;

  private readonly categories$ = this.ctx.activeEvent$.pipe(
    switchMap((event) => {
      if (!event) return of([]);
      return this.categoryService.getCategoriesForEvents([event.eventId]).pipe(startWith([]));
    }),
  );

  private readonly assignments$ = this.categories$.pipe(
    switchMap((cats) => {
      const ids = cats.map((c) => c.categoryId);
      return this.categoryService.getAssignmentsForCategories(ids).pipe(startWith([]));
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });
  readonly assignments = toSignal(this.assignments$, { initialValue: [] });
  readonly users = toSignal(this.userService.getAllUsers(), { initialValue: [] });

  readonly categoryMap = computed(
    () => new Map(this.categories().map((c) => [c.categoryId, c.name])),
  );

  private readonly assignedJudgeIds = computed(
    () => new Set(this.assignments().map((a) => a.judgeId)),
  );

  private readonly nonAdminUsers = computed(() => this.users().filter((u) => u.role !== 'admin'));

  readonly searchQuery = signal('');
  readonly activeFilter = signal<JudgeFilter>('unassigned');
  readonly currentPage = signal(1);

  private readonly searchFiltered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.nonAdminUsers();
    return this.nonAdminUsers().filter(
      (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  readonly filteredUsers = computed(() => {
    const assignedIds = this.assignedJudgeIds();
    const users = this.searchFiltered();
    if (this.activeFilter() === 'assigned') {
      return users.filter((u) => assignedIds.has(u.userId));
    }
    return users.filter((u) => !assignedIds.has(u.userId));
  });

  readonly totalPages = computed(() => Math.ceil(this.filteredUsers().length / PAGE_SIZE));

  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filteredUsers().slice(start, start + PAGE_SIZE);
  });

  readonly pageEnd = computed(() =>
    Math.min(this.currentPage() * PAGE_SIZE, this.filteredUsers().length),
  );

  readonly countAll = computed(() => this.nonAdminUsers().length);
  readonly countAssigned = computed(
    () => this.nonAdminUsers().filter((u) => this.assignedJudgeIds().has(u.userId)).length,
  );
  readonly countUnassigned = computed(
    () => this.nonAdminUsers().filter((u) => !this.assignedJudgeIds().has(u.userId)).length,
  );

  readonly selectedUserId = signal<string | null>(null);
  readonly selectedCategoryIds = signal<Set<string>>(new Set());
  readonly isAssigning = signal(false);

  readonly removingKey = signal<string | null>(null);
  readonly removeErrorKey = signal<string | null>(null);

  setFilter(filter: JudgeFilter): void {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.selectedUserId.set(null);
    this.selectedCategoryIds.set(new Set());
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update((p) => p + 1);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  toggleCategorySelection(categoryId: string): void {
    this.selectedCategoryIds.update((prev) => {
      const next = new Set(prev);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  }

  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategoryIds().has(categoryId);
  }

  assignmentKey(judgeId: string, categoryId: string): string {
    return `${judgeId}_${categoryId}`;
  }

  assignmentsForUser(userId: string): JudgeAssignment[] {
    return this.assignments().filter((a) => a.judgeId === userId);
  }

  availableCategoriesForUser(userId: string): Category[] {
    const assigned = new Set(this.assignmentsForUser(userId).map((a) => a.categoryId));
    return this.categories().filter((c) => !assigned.has(c.categoryId));
  }

  toggleAssignForm(userId: string): void {
    if (this.selectedUserId() === userId) {
      this.selectedUserId.set(null);
    } else {
      this.selectedUserId.set(userId);
    }
    this.selectedCategoryIds.set(new Set());
  }

  async assignCategory(): Promise<void> {
    const judgeId = this.selectedUserId();
    const categoryIds = [...this.selectedCategoryIds()];
    if (!judgeId || categoryIds.length === 0) return;

    this.isAssigning.set(true);
    try {
      await Promise.all(
        categoryIds.map((catId) => this.categoryService.assignJudgeToCategory(judgeId, catId)),
      );
      this.selectedCategoryIds.set(new Set());
      this.selectedUserId.set(null);
    } finally {
      this.isAssigning.set(false);
    }
  }

  async removeAssignment(judgeId: string, categoryId: string): Promise<void> {
    const key = this.assignmentKey(judgeId, categoryId);
    this.removingKey.set(key);
    this.removeErrorKey.set(null);
    try {
      await this.categoryService.removeJudgeFromCategory(judgeId, categoryId);
    } catch {
      this.removeErrorKey.set(key);
      setTimeout(() => this.removeErrorKey.set(null), 3000);
    } finally {
      this.removingKey.set(null);
    }
  }
}
