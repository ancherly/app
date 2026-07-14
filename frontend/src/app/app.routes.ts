import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'employee',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/employee/dashboard.component').then(m => m.EmployeeDashboardComponent)
      },
      {
        path: 'history',
        loadComponent: () => import('./features/employee/history.component').then(m => m.EmployeeHistoryComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'users',
        loadComponent: () => import('./features/admin/users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'employee/:id',
        loadComponent: () => import('./features/admin/employee-detail.component').then(m => m.AdminEmployeeDetailComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/admin/settings.component').then(m => m.AdminSettingsComponent)
      },
      { path: '', redirectTo: 'users', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
