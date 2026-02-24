import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { username, email, password } = this.form.getRawValue();

    try {
      await this.authService.register(email, password, username);
      this.router.navigate(['/login']);
    } catch (err: any) {
      this.errorMessage.set(this.mapError(err?.code));
    } finally {
      this.isLoading.set(false);
    }
  }

  private mapError(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Email adresa je već u upotrebi.';
      case 'auth/invalid-email':
        return 'Email adresa nije ispravna.';
      case 'auth/weak-password':
        return 'Lozinka mora imati najmanje 6 karaktera.';
      default:
        return 'Došlo je do greške. Pokušajte ponovo.';
    }
  }
}
