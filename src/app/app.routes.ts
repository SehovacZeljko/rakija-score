import { Routes } from '@angular/router';

import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'category/:categoryId',
    loadComponent: () =>
      import('./pages/category-detail/category-detail.component').then(
        (m) => m.CategoryDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'scoring/:categoryId/:sampleId',
    loadComponent: () =>
      import('./pages/scoring/scoring.component').then((m) => m.ScoringComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: 'festivals',
        loadComponent: () =>
          import('./pages/admin/festivals/admin-festivals.component').then(
            (m) => m.AdminFestivalsComponent,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/admin/categories/admin-categories.component').then(
            (m) => m.AdminCategoriesComponent,
          ),
      },
      {
        path: 'producers',
        loadComponent: () =>
          import('./pages/admin/producers/admin-producers.component').then(
            (m) => m.AdminProducersComponent,
          ),
      },
      {
        path: 'samples',
        loadComponent: () =>
          import('./pages/admin/samples/admin-samples.component').then(
            (m) => m.AdminSamplesComponent,
          ),
      },
      {
        path: 'judges',
        loadComponent: () =>
          import('./pages/admin/judges/admin-judges.component').then(
            (m) => m.AdminJudgesComponent,
          ),
      },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
