import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { of, startWith, switchMap } from 'rxjs';

import { ActiveFestivalBannerComponent } from '../../../components/active-festival-banner/active-festival-banner.component';
import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Category } from '../../../models/category.model';
import { JudgeAssignment } from '../../../models/judge-assignment.model';
import { CategoryService } from '../../../services/category.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { UserService } from '../../../services/user.service';
import { PAGE_SIZE } from '../../../shared/pagination.constants';
import { LucideAngularModule } from 'lucide-angular';

type JudgeFilter = 'unassigned' | 'assigned';

@Component({
  selector: 'app-admin-judges',
  imports: [
    NgClass,
    LoadingSpinnerComponent,
    InlineSpinnerComponent,
    ActiveFestivalBannerComponent,
    LucideAngularModule,
  ],
  templateUrl: './admin-judges.component.html',
  styleUrl: './admin-judges.component.scss',
})
export class AdminJudgesComponent {
  private readonly ctx = inject(FestivalContextService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);

  readonly PAGE_SIZE = PAGE_SIZE;

  readonly activeFestival = this.ctx.activeFestival;
  readonly adminCurrentEvent = this.ctx.adminCurrentEvent;
  readonly dataReady = this.ctx.dataReady;

  private readonly categories$ = this.ctx.adminCurrentEvent$.pipe(
    switchMap((event) => {
      if (!event) return of([]);
      return this.categoryService.getCategoriesForEvents([event.eventId]).pipe(startWith([]));
    }),
  );

  private readonly assignments$ = this.categories$.pipe(
    switchMap((categories) => {
      const categoryIds = categories.map((category) => category.categoryId);
      return this.categoryService.getAssignmentsForCategories(categoryIds).pipe(startWith([]));
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });
  readonly assignments = toSignal(this.assignments$, { initialValue: [] });
  readonly users = toSignal(this.userService.getAllUsers(), { initialValue: [] });

  readonly categoryMap = computed(
    () => new Map(this.categories().map((category) => [category.categoryId, category.name])),
  );

  private readonly assignedJudgeIds = computed(
    () => new Set(this.assignments().map((assignment) => assignment.judgeId)),
  );

  private readonly nonAdminUsers = computed(() =>
    this.users().filter((user) => user.role !== 'admin'),
  );

  readonly searchQuery = signal('');
  readonly activeFilter = signal<JudgeFilter>('unassigned');
  readonly currentPage = signal(1);

  private readonly searchFiltered = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.nonAdminUsers();
    return this.nonAdminUsers().filter(
      (user) =>
        user.username.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
    );
  });

  readonly filteredUsers = computed(() => {
    const assignedIds = this.assignedJudgeIds();
    const users = this.searchFiltered();
    if (this.activeFilter() === 'assigned') {
      return users.filter((user) => assignedIds.has(user.userId));
    }
    return users.filter((user) => !assignedIds.has(user.userId));
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
    () => this.nonAdminUsers().filter((user) => this.assignedJudgeIds().has(user.userId)).length,
  );
  readonly countUnassigned = computed(
    () => this.nonAdminUsers().filter((user) => !this.assignedJudgeIds().has(user.userId)).length,
  );

  readonly selectedUserId = signal<string | null>(null);
  readonly selectedCategoryIds = signal<Set<string>>(new Set());
  readonly isAssigning = signal(false);

  readonly removingKey = signal<string | null>(null);
  readonly removeErrorKey = signal<string | null>(null);

  readonly assignmentsByUserId = computed(() => {
    const assignmentMap = new Map<string, JudgeAssignment[]>();
    for (const assignment of this.assignments()) {
      const list = assignmentMap.get(assignment.judgeId) ?? [];
      list.push(assignment);
      assignmentMap.set(assignment.judgeId, list);
    }
    return assignmentMap;
  });

  readonly availableCategoriesForSelectedUser = computed(() => {
    const userId = this.selectedUserId();
    if (!userId) return [];
    const assignedCategoryIds = new Set(
      this.assignmentsForUser(userId).map((assignment) => assignment.categoryId),
    );
    return this.categories().filter((category) => !assignedCategoryIds.has(category.categoryId));
  });

  setFilter(filter: JudgeFilter): void {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.selectedUserId.set(null);
    this.selectedCategoryIds.set(new Set());
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((page) => page - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update((page) => page + 1);
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
    return this.assignmentsByUserId().get(userId) ?? [];
  }

  availableCategoriesForUser(userId: string): Category[] {
    const assignedCategoryIds = new Set(
      this.assignmentsForUser(userId).map((assignment) => assignment.categoryId),
    );
    return this.categories().filter((category) => !assignedCategoryIds.has(category.categoryId));
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
        categoryIds.map((categoryId) =>
          this.categoryService.assignJudgeToCategory(judgeId, categoryId),
        ),
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
