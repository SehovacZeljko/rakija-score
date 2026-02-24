import { Component, inject, signal, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly isVerifying = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly associatedEmail = signal('');

  private oobCode = '';

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator },
  );

  async ngOnInit(): Promise<void> {
    this.oobCode = this.route.snapshot.queryParamMap.get('oobCode') ?? '';

    if (!this.oobCode) {
      this.errorMessage.set('Link je nevažeći. Zatražite novi link.');
      this.isVerifying.set(false);
      return;
    }

    try {
      const email = await this.authService.verifyResetCode(this.oobCode);
      this.associatedEmail.set(email);
    } catch {
      this.errorMessage.set('Link je istekao ili je već iskorišten. Zatražite novi link.');
    } finally {
      this.isVerifying.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { newPassword } = this.form.getRawValue();

    try {
      await this.authService.confirmPasswordReset(this.oobCode, newPassword);
      this.successMessage.set('Lozinka je uspješno promijenjena.');
    } catch {
      this.errorMessage.set('Link je istekao ili je već iskorišten. Zatražite novi link.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }
}
