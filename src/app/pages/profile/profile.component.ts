import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { HeaderComponent } from '../../components/header/header.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-profile',
  imports: [HeaderComponent, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly currentUser = this.authService.currentUser;
  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
  });

  get homeRoute(): string {
    return this.authService.currentUser()?.role === 'admin' ? '/admin/festivals' : '/dashboard';
  }

  ngOnInit(): void {
    const username = this.authService.currentUser()?.username ?? '';
    this.form.patchValue({ username });
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const uid = this.authService.currentUser()?.userId;
    if (!uid) return;

    this.isSaving.set(true);
    try {
      const { username } = this.form.getRawValue();
      await this.authService.updateUsername(uid, username);
      this.toastService.show('Korisničko ime je ažurirano');
    } catch {
      this.toastService.show('Greška pri čuvanju. Pokušajte ponovo.', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

}
