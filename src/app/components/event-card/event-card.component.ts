import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, of, startWith, switchMap } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

import { InlineSpinnerComponent } from '../inline-spinner/inline-spinner.component';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';
import { Category } from '../../models/category.model';
import { FestivalEvent } from '../../models/event.model';
import { JudgeAssignment } from '../../models/judge-assignment.model';
import { User } from '../../models/user.model';
import { CategoryService } from '../../services/category.service';
import { EventService } from '../../services/event.service';
import { ProducerService } from '../../services/producer.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-event-card',
  imports: [InlineSpinnerComponent, RouterLink, LucideAngularModule, DecimalPipe, SelectDropdownComponent],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
})
export class EventCardComponent {
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly producerService = inject(ProducerService);
  private readonly userService = inject(UserService);

  readonly event = input.required<FestivalEvent>();
  readonly categories = input.required<Category[]>();
  readonly festivalId = input.required<string>();
  readonly festivalName = input.required<string>();

  private readonly samples$ = toObservable(this.categories).pipe(
    map((cats) => cats.map((c) => c.categoryId)),
    switchMap((ids) => (ids.length ? this.sampleService.getSamplesForCategories(ids) : of([]))),
    startWith([]),
  );

  private readonly scores$ = this.samples$.pipe(
    map((samples) => samples.map((s) => s.sampleId)),
    switchMap((ids) => (ids.length ? this.scoreService.getScoresForSampleIds(ids) : of([]))),
    startWith([]),
  );

  private readonly samples = toSignal(this.samples$, { initialValue: [] });
  private readonly scores = toSignal(this.scores$, { initialValue: [] });

  readonly categoryStats = computed(() => {
    const result = new Map<string, { totalSamples: number; avgGrade: number | null }>();

    const samplesByCategory = new Map<string, string[]>();
    for (const sample of this.samples()) {
      const list = samplesByCategory.get(sample.categoryId) ?? [];
      list.push(sample.sampleId);
      samplesByCategory.set(sample.categoryId, list);
    }

    for (const [categoryId, sampleIds] of samplesByCategory) {
      const sampleIdSet = new Set(sampleIds);
      const categoryScores = this.scores().filter((score) => sampleIdSet.has(score.sampleId));
      const avgGrade =
        categoryScores.length > 0
          ? categoryScores.reduce(
              (sum, score) =>
                sum + score.color + score.clarity + score.typicality + score.aroma + score.taste,
              0,
            ) / categoryScores.length
          : null;
      result.set(categoryId, { totalSamples: sampleIds.length, avgGrade });
    }

    for (const category of this.categories()) {
      if (!result.has(category.categoryId)) {
        result.set(category.categoryId, { totalSamples: 0, avgGrade: null });
      }
    }

    return result;
  });

  private readonly producers = toSignal(this.producerService.getAllProducers(), { initialValue: [] });
  readonly producerOptions = computed(() =>
    this.producers().map((p) => ({ id: p.producerId, label: p.name })),
  );

  // Judge assignments
  private readonly assignments$ = toObservable(this.categories).pipe(
    map((cats) => cats.map((c) => c.categoryId)),
    switchMap((ids) =>
      ids.length ? this.categoryService.getAssignmentsForCategories(ids) : of([]),
    ),
    startWith([]),
  );
  private readonly assignments = toSignal(this.assignments$, { initialValue: [] });

  private readonly allUsers = toSignal(this.userService.getAllUsers(), { initialValue: [] });
  readonly judgeUsers = computed(() => this.allUsers().filter((u) => u.role !== 'admin'));
  readonly judgeMap = computed(() => new Map(this.judgeUsers().map((u) => [u.userId, u])));

  readonly assignmentsByCategoryId = computed(() => {
    const map = new Map<string, JudgeAssignment[]>();
    for (const assignment of this.assignments()) {
      const list = map.get(assignment.categoryId) ?? [];
      list.push(assignment);
      map.set(assignment.categoryId, list);
    }
    return map;
  });

  availableJudgesForCategory(categoryId: string): User[] {
    const assigned = new Set(
      (this.assignmentsByCategoryId().get(categoryId) ?? []).map((a) => a.judgeId),
    );
    return this.judgeUsers().filter((u) => !assigned.has(u.userId));
  }

  // Judge assignment form
  readonly addingJudgesToCategoryId = signal<string | null>(null);
  readonly selectedJudgeIds = signal<Set<string>>(new Set());
  readonly isAssigningJudges = signal(false);
  readonly removingAssignmentKey = signal<string | null>(null);
  readonly removeAssignmentErrorKey = signal<string | null>(null);

  // Add sample form
  readonly addingSampleToCategoryId = signal<string | null>(null);
  readonly newSampleCode = signal('');
  readonly newSampleProducerId = signal<string | null>(null);
  readonly newSampleYear = signal(new Date().getFullYear());
  readonly newSampleAlcohol = signal(40);
  readonly isSavingSample = signal(false);

  readonly newSampleCodeValid = computed(() => {
    const code = this.newSampleCode().trim();
    if (code.length < 4) return false;
    return !this.samples().some((s) => s.sampleCode === code);
  });

  // Edit mode
  readonly isEditing = signal(false);
  readonly editingName = signal('');
  readonly editingYear = signal(new Date().getFullYear());
  readonly isSavingEdit = signal(false);
  readonly isEditNameValid = computed(() => this.editingName().trim().length >= 3);

  // Transitions
  readonly isActivating = signal(false);
  readonly isFinishing = signal(false);
  readonly isReverting = signal(false);
  readonly isReopening = signal(false);

  // Category form
  readonly showCategoryForm = signal(false);
  readonly newCategoryName = signal('');
  readonly isSavingCategory = signal(false);

  // Category delete
  readonly deletingCategoryId = signal<string | null>(null);
  readonly deleteErrorCategoryId = signal<string | null>(null);

  openAddJudges(categoryId: string): void {
    this.selectedJudgeIds.set(new Set());
    this.addingJudgesToCategoryId.set(categoryId);
  }

  cancelAddJudges(): void {
    this.addingJudgesToCategoryId.set(null);
    this.selectedJudgeIds.set(new Set());
  }

  toggleJudgeSelection(judgeId: string): void {
    const current = new Set(this.selectedJudgeIds());
    current.has(judgeId) ? current.delete(judgeId) : current.add(judgeId);
    this.selectedJudgeIds.set(current);
  }

  async assignJudges(categoryId: string): Promise<void> {
    const judgeIds = [...this.selectedJudgeIds()];
    if (!judgeIds.length) return;
    this.isAssigningJudges.set(true);
    try {
      await Promise.all(
        judgeIds.map((judgeId) => this.categoryService.assignJudgeToCategory(judgeId, categoryId)),
      );
      this.cancelAddJudges();
    } finally {
      this.isAssigningJudges.set(false);
    }
  }

  async removeJudgeAssignment(judgeId: string, categoryId: string): Promise<void> {
    const key = `${judgeId}_${categoryId}`;
    this.removingAssignmentKey.set(key);
    this.removeAssignmentErrorKey.set(null);
    try {
      await this.categoryService.removeJudgeFromCategory(judgeId, categoryId);
    } catch {
      this.removeAssignmentErrorKey.set(key);
      setTimeout(() => this.removeAssignmentErrorKey.set(null), 3000);
    } finally {
      this.removingAssignmentKey.set(null);
    }
  }

  openAddSample(categoryId: string): void {
    this.newSampleCode.set('');
    this.newSampleProducerId.set(null);
    this.newSampleYear.set(this.event().year);
    this.newSampleAlcohol.set(40);
    this.addingSampleToCategoryId.set(categoryId);
  }

  cancelAddSample(): void {
    this.addingSampleToCategoryId.set(null);
    this.newSampleCode.set('');
    this.newSampleProducerId.set(null);
    this.newSampleYear.set(new Date().getFullYear());
    this.newSampleAlcohol.set(40);
  }

  onNewSampleCodeInput(domEvent: Event): void {
    this.newSampleCode.set((domEvent.target as HTMLInputElement).value);
  }

  onNewSampleYearInput(domEvent: Event): void {
    const val = parseInt((domEvent.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.newSampleYear.set(val);
  }

  onNewSampleAlcoholInput(domEvent: Event): void {
    const val = parseFloat((domEvent.target as HTMLInputElement).value);
    if (!isNaN(val)) this.newSampleAlcohol.set(val);
  }

  async saveNewSample(categoryId: string): Promise<void> {
    const producerId = this.newSampleProducerId();
    if (!this.newSampleCodeValid() || !producerId) return;

    const totalSamples = this.categoryStats().get(categoryId)?.totalSamples ?? 0;

    this.isSavingSample.set(true);
    try {
      await this.sampleService.createSample({
        sampleCode: this.newSampleCode().trim(),
        producerId,
        categoryId,
        year: this.newSampleYear(),
        alcoholStrength: this.newSampleAlcohol(),
        order: totalSamples + 1,
      });
      this.cancelAddSample();
    } finally {
      this.isSavingSample.set(false);
    }
  }

  startEdit(): void {
    this.editingName.set(this.event().name);
    this.editingYear.set(this.event().year);
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.editingName.set('');
    this.editingYear.set(new Date().getFullYear());
  }

  onEditNameInput(domEvent: Event): void {
    this.editingName.set((domEvent.target as HTMLInputElement).value);
  }

  onEditYearInput(domEvent: Event): void {
    const val = parseInt((domEvent.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.editingYear.set(val);
  }

  async saveEdit(): Promise<void> {
    const name = this.editingName().trim();
    if (name.length < 3) return;
    this.isSavingEdit.set(true);
    try {
      await this.eventService.updateEvent(this.event().eventId, name, this.editingYear());
      this.isEditing.set(false);
      this.editingName.set('');
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  async activateEvent(): Promise<void> {
    this.isActivating.set(true);
    try {
      await this.eventService.activateEvent(this.festivalId(), this.event().eventId);
    } finally {
      this.isActivating.set(false);
    }
  }

  async revertToStaging(): Promise<void> {
    this.isReverting.set(true);
    try {
      await this.eventService.revertToStaging(this.event().eventId);
    } finally {
      this.isReverting.set(false);
    }
  }

  async finishEvent(): Promise<void> {
    this.isFinishing.set(true);
    try {
      await this.eventService.finishEvent(this.event().eventId);
    } finally {
      this.isFinishing.set(false);
    }
  }

  async reopenEvent(): Promise<void> {
    this.isReopening.set(true);
    try {
      await this.eventService.reopenEvent(this.festivalId(), this.event().eventId);
    } finally {
      this.isReopening.set(false);
    }
  }

  openCategoryForm(): void {
    this.newCategoryName.set('');
    this.showCategoryForm.set(true);
  }

  cancelCategoryForm(): void {
    this.newCategoryName.set('');
    this.showCategoryForm.set(false);
  }

  onCategoryNameInput(domEvent: Event): void {
    this.newCategoryName.set((domEvent.target as HTMLInputElement).value);
  }

  async createCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.isSavingCategory.set(true);
    try {
      await this.categoryService.createCategory(this.event().eventId, name);
      this.newCategoryName.set('');
      this.showCategoryForm.set(false);
    } finally {
      this.isSavingCategory.set(false);
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    this.deletingCategoryId.set(categoryId);
    this.deleteErrorCategoryId.set(null);
    try {
      await this.categoryService.deleteCategory(categoryId);
    } catch {
      this.deleteErrorCategoryId.set(categoryId);
      setTimeout(() => this.deleteErrorCategoryId.set(null), 3000);
    } finally {
      this.deletingCategoryId.set(null);
    }
  }
}
