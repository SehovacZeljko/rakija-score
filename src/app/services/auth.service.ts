import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  Auth,
  authState,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, of, switchMap, map } from 'rxjs';

import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  readonly currentUser$: Observable<User | null> = authState(this.auth).pipe(
    switchMap((firebaseUser) => {
      if (!firebaseUser) return of(null);
      return (
        docData(doc(this.firestore, `users/${firebaseUser.uid}`)) as Observable<User | undefined>
      ).pipe(map((user) => user ?? null));
    }),
  );

  readonly currentUser: Signal<User | null>;
  readonly isAuthenticated: Signal<boolean>;

  constructor() {
    this.currentUser = toSignal(this.currentUser$, { initialValue: null });
    this.isAuthenticated = computed(() => !!this.currentUser());
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string, username: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await setDoc(doc(this.firestore, `users/${credential.user.uid}`), {
      userId: credential.user.uid,
      username,
      email,
      role: 'judge',
      createdAt: serverTimestamp(),
    });
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async verifyResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, oobCode);
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    await firebaseConfirmPasswordReset(this.auth, oobCode, newPassword);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}
