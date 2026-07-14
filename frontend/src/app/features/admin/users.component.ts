import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { UserService, GymUser } from '../../core/services/user.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, TooltipModule, TagModule],
  template: `
    <div class="users-page">
      <div class="page-header-actions">
        <div>
          <h1 class="page-title">Empleados</h1>
          <p class="page-subtitle">{{ users().length }} usuario(s) en el sistema</p>
        </div>
        <button class="btn btn-primary" (click)="openCreate()" data-testid="create-user-button">
          <i class="fas fa-plus"></i> Nuevo
        </button>
      </div>

      @if (error()) {
        <div class="error-banner"><i class="fas fa-circle-exclamation"></i> {{ error() }}</div>
      }

      <!-- PrimeNG DataTable -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            <span class="spinner"></span>
            <span>Cargando usuarios...</span>
          </div>
        } @else {
          <p-table
            [value]="users()"
            [paginator]="users().length > 8"
            [rows]="8"
            [sortField]="'full_name'"
            [sortOrder]="1"
            dataKey="id"
            styleClass="gym-table"
            data-testid="users-primeng-table"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="full_name">
                  Nombre <p-sortIcon field="full_name"></p-sortIcon>
                </th>
                <th pSortableColumn="email">
                  Email <p-sortIcon field="email"></p-sortIcon>
                </th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-user>
              <tr [attr.data-testid]="'user-row-' + user.id">
                <!-- Nombre -->
                <td>
                  <div class="user-cell">
                    <div class="mini-avatar" [class.admin]="user.role === 'admin'">
                      {{ userInitial(user) }}
                    </div>
                    <span class="user-name" data-testid="user-full-name">{{ user.full_name }}</span>
                  </div>
                </td>

                <!-- Email -->
                <td class="muted">{{ user.email }}</td>

                <!-- Rol -->
                <td>
                  <span class="role-badge" [class.admin]="user.role === 'admin'">
                    <i [class]="user.role === 'admin' ? 'fas fa-shield-halved' : 'fas fa-user'"></i>
                    {{ user.role === 'admin' ? 'Admin' : 'Empleado' }}
                  </span>
                </td>

                <!-- Estado -->
                <td>
                  <span class="active-badge" [class.active]="user.active" [class.inactive]="!user.active">
                    <i [class]="user.active ? 'fas fa-circle-check' : 'fas fa-circle-xmark'"></i>
                    {{ user.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>

                <!-- Acciones -->
                <td>
                  <div class="action-btns">
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="viewHistory(user)"
                      data-testid="view-history-button"
                      pTooltip="Ver historial"
                      tooltipPosition="top"
                    >
                      <i class="fas fa-calendar-days"></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="openEdit(user)"
                      [attr.data-testid]="'edit-user-' + user.id"
                      pTooltip="Editar"
                      tooltipPosition="top"
                    >
                      <i class="fas fa-pen"></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      (click)="openResetPassword(user)"
                      [attr.data-testid]="'reset-pwd-' + user.id"
                      pTooltip="Resetear contraseña"
                      tooltipPosition="top"
                    >
                      <i class="fas fa-key"></i>
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      [class.danger]="user.active"
                      (click)="toggleActive(user)"
                      [attr.data-testid]="'toggle-active-' + user.id"
                      [pTooltip]="user.active ? 'Desactivar usuario' : 'Activar usuario'"
                      tooltipPosition="top"
                    >
                      <i [class]="user.active ? 'fas fa-ban' : 'fas fa-check'"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5">
                  <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No hay usuarios en el sistema</p>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>

    <!-- Create/Edit modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3 class="modal-title">{{ editingUser() ? 'Editar Empleado' : 'Nuevo Empleado' }}</h3>

          @if (modalError()) {
            <div class="error-banner"><i class="fas fa-circle-exclamation"></i> {{ modalError() }}</div>
          }

          <form (ngSubmit)="saveUser()" class="modal-form">
            <div class="form-group">
              <label class="form-label">Nombre completo *</label>
              <input class="form-input" [(ngModel)]="form.full_name" name="full_name"
                placeholder="Nombre Apellido" required data-testid="user-fullname-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input class="form-input" [(ngModel)]="form.email" name="email" type="email"
                placeholder="correo@ejemplo.com" required data-testid="user-email-input" />
            </div>
            @if (!editingUser()) {
              <div class="form-group">
                <label class="form-label">Contraseña *</label>
                <input class="form-input" [(ngModel)]="form.password" name="password" type="password"
                  placeholder="Mínimo 6 caracteres" required data-testid="user-password-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Rol</label>
                <select class="form-input" [(ngModel)]="form.role" name="role" data-testid="user-role-select">
                  <option value="employee">Empleado</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            }
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" (click)="closeModal()" data-testid="modal-cancel-button">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="saving()" data-testid="modal-save-button">
                @if (saving()) { <span class="spinner"></span> }
                {{ editingUser() ? 'Guardar cambios' : 'Crear empleado' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Reset password modal -->
    @if (showResetModal()) {
      <div class="modal-overlay" (click)="showResetModal.set(false)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3 class="modal-title">Resetear Contraseña</h3>
          <p class="modal-subtitle">Para {{ resetUser()?.full_name }}</p>

          @if (modalError()) {
            <div class="error-banner"><i class="fas fa-circle-exclamation"></i> {{ modalError() }}</div>
          }

          <div class="form-group" style="margin-top: 16px">
            <label class="form-label">Nueva contraseña *</label>
            <input class="form-input" [(ngModel)]="newPassword" type="password"
              placeholder="Nueva contraseña" data-testid="new-password-input" />
          </div>
          <div class="modal-actions" style="margin-top: 20px">
            <button class="btn btn-ghost" (click)="showResetModal.set(false)">Cancelar</button>
            <button class="btn btn-primary" (click)="doResetPassword()" [disabled]="saving()" data-testid="reset-password-confirm">
              @if (saving()) { <span class="spinner"></span> }
              Actualizar contraseña
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .users-page { display: flex; flex-direction: column; gap: 20px; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: var(--radius);
      color: var(--status-red);
      font-size: 0.875rem;
    }

    /* PrimeNG table wrapper */
    .table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    /* Override p-table for gym theme */
    :host ::ng-deep .gym-table {
      .p-datatable-header {
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
        padding: 16px 20px;
      }

      .p-datatable-thead > tr > th {
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        border-bottom: 1px solid var(--border);
        padding: 12px 16px;
        border-top: none;
      }

      .p-datatable-tbody > tr > td {
        background: transparent;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border);
        padding: 12px 16px;
        font-size: 0.875rem;
      }

      .p-datatable-tbody > tr:last-child > td { border-bottom: none; }

      .p-datatable-tbody > tr:hover > td { background: var(--bg-elevated); }

      .p-paginator {
        background: var(--bg-surface);
        border-top: 1px solid var(--border);
        padding: 10px 16px;
      }

      .p-paginator-element {
        color: var(--text-secondary);
        border-radius: var(--radius);

        &:hover:not(.p-disabled) { background: var(--bg-elevated); color: var(--text-primary); }
        &.p-highlight { background: rgba(0,122,255,0.15); color: var(--accent-blue); }
      }
    }

    .table-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 48px;
      color: var(--text-secondary);
      justify-content: center;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mini-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--accent-blue);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading);
      font-size: 1rem;
      font-weight: 900;
      flex-shrink: 0;
    }
    .mini-avatar.admin { background: var(--status-yellow); color: #000; }

    .user-name { font-weight: 600; font-size: 0.9rem; }
    .muted { color: var(--text-secondary); font-size: 0.875rem; }

    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(0,122,255,0.15);
      color: var(--accent-blue);
      border: 1px solid rgba(0,122,255,0.3);
    }
    .role-badge.admin {
      background: rgba(245,158,11,0.15);
      color: var(--status-yellow);
      border-color: rgba(245,158,11,0.3);
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .active-badge.active {
      background: rgba(16,185,129,0.15);
      color: var(--status-green);
      border: 1px solid rgba(16,185,129,0.3);
    }
    .active-badge.inactive {
      background: rgba(239,68,68,0.1);
      color: var(--status-red);
      border: 1px solid rgba(239,68,68,0.3);
    }

    .action-btns {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .btn.danger {
      color: var(--status-red);
      border-color: rgba(239,68,68,0.3);
    }

    /* Modals */
    .modal-form { display: flex; flex-direction: column; gap: 16px; }
    .modal-title {
      font-family: var(--font-heading);
      font-size: 1.4rem;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .modal-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 16px; }
    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
  `]
})
export class AdminUsersComponent implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);

  users = signal<GymUser[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  modalError = signal<string | null>(null);
  showModal = signal(false);
  showResetModal = signal(false);
  editingUser = signal<GymUser | null>(null);
  resetUser = signal<GymUser | null>(null);
  newPassword = '';

  form = { full_name: '', email: '', password: '', role: 'employee' };

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    try {
      const data = await this.userService.getUsers();
      this.users.set(data);
    } catch (e: any) {
      this.error.set(e?.message || 'Error al cargar usuarios');
    } finally {
      this.loading.set(false);
    }
  }

  userInitial(user: GymUser): string { return (user.full_name || user.email)[0].toUpperCase(); }

  openCreate() {
    this.editingUser.set(null);
    this.form = { full_name: '', email: '', password: '', role: 'employee' };
    this.modalError.set(null);
    this.showModal.set(true);
  }

  openEdit(user: GymUser) {
    this.editingUser.set(user);
    this.form = { full_name: user.full_name, email: user.email, password: '', role: user.role };
    this.modalError.set(null);
    this.showModal.set(true);
  }

  openResetPassword(user: GymUser) {
    this.resetUser.set(user);
    this.newPassword = '';
    this.modalError.set(null);
    this.showResetModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  async saveUser() {
    this.modalError.set(null);
    this.saving.set(true);
    try {
      if (this.editingUser()) {
        const updated = await this.userService.updateUser(this.editingUser()!.id, {
          full_name: this.form.full_name,
          email: this.form.email
        });
        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
      } else {
        const newUser = await this.userService.createUser(this.form);
        this.users.update(list => [newUser, ...list]);
      }
      this.closeModal();
    } catch (e: any) {
      this.modalError.set(e?.message || 'Error al guardar');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(user: GymUser) {
    try {
      const result = await this.userService.toggleActive(user.id);
      this.users.update(list => list.map(u => u.id === user.id ? { ...u, active: result.active } : u));
    } catch (e: any) {
      this.error.set(e?.message || 'Error al cambiar estado');
    }
  }

  async doResetPassword() {
    if (!this.newPassword) return;
    this.saving.set(true);
    this.modalError.set(null);
    try {
      await this.userService.resetPassword(this.resetUser()!.id, this.newPassword);
      this.showResetModal.set(false);
    } catch (e: any) {
      this.modalError.set(e?.message || 'Error al resetear contraseña');
    } finally {
      this.saving.set(false);
    }
  }

  viewHistory(user: GymUser) {
    this.router.navigate(['/admin/employee', user.id]);
  }
}
