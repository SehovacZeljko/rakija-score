import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    filter((user) => user !== null),
    take(1),
    map((user) => {
      if (user.role === 'admin') return true;
      return router.createUrlTree(['/dashboard']);
    }),
  );
};
