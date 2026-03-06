import {
  Component,
  computed,
  effect,
  forwardRef,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

export interface SelectOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-select-dropdown',
  imports: [LucideAngularModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectDropdownComponent),
      multi: true,
    },
  ],
  templateUrl: './select-dropdown.component.html',
  styleUrl: './select-dropdown.component.scss',
})
export class SelectDropdownComponent implements ControlValueAccessor {
  readonly options = input<SelectOption[]>([]);
  readonly currentValue = input<string | null>(null);
  readonly placeholder = input('Odaberi');
  readonly variant = input<'filter' | 'form'>('filter');
  readonly showAllOption = input(false);
  readonly allOptionLabel = input('Sve');
  readonly allOptionCount = input<number | null>(null);
  readonly invalid = input(false);
  readonly actionOption = input<string | null>(null);

  readonly selectionChange = output<string | null>();
  readonly actionSelected = output<void>();

  readonly internalValue = signal<string | null>(null);
  readonly isOpen = signal(false);
  readonly isDisabled = signal(false);

  readonly displayLabel = computed(() => {
    const id = this.internalValue();
    if (!id) return this.showAllOption() ? this.allOptionLabel() : this.placeholder();
    return this.options().find((o) => o.id === id)?.label ?? this.placeholder();
  });

  readonly triggerClasses = computed(() =>
    this.variant() === 'form'
      ? 'bg-bg-surface rounded-lg focus:border-border-focus focus:outline-none'
      : 'bg-bg-card rounded-xl',
  );

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private hasFormValue = false;

  constructor() {
    effect(() => {
      const external = this.currentValue();
      untracked(() => {
        if (!this.hasFormValue) this.internalValue.set(external);
      });
    });
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isDisabled()) this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectAction(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.set(false);
    this.actionSelected.emit();
  }

  select(optionId: string | null, event: MouseEvent): void {
    event.stopPropagation();
    this.internalValue.set(optionId);
    this.onChange(optionId);
    this.onTouched();
    this.selectionChange.emit(optionId);
    this.isOpen.set(false);
  }

  writeValue(value: string | null): void {
    this.hasFormValue = true;
    this.internalValue.set(value ?? null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
