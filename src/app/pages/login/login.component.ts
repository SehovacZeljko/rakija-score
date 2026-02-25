import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.form.getRawValue();

    try {
      await this.authService.login(email, password);
      await firstValueFrom(this.authService.currentUser$.pipe(filter((u) => u !== null)));

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl) {
        this.router.navigateByUrl(returnUrl);
      } else {
        const role = this.authService.currentUser()?.role;
        this.router.navigate([role === 'admin' ? '/admin' : '/dashboard']);
      }
    } catch {
      this.errorMessage.set('Pogrešni podaci za prijavu.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
