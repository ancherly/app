import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PunchService, Punch } from '../../core/services/punch.service';
import { UserService, GymUser } from '../../core/services/user.service';

interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  punches: Punch[];
}

@Component({
  selector: 'app-admin-employee-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="detail-page">
      <!-- Back -->
      <button class="btn btn-ghost btn-sm back-btn" (click)="goBack()" data-testid="back-button">
        <i class="fas fa-arrow-left"></i> Empleados
      </button>

      @if (employee()) {
        <div class="page-header">
          <div class="employee-header">
            <div class="emp-avatar">{{ (employee()!.full_name || '?')[0].toUpperCase() }}</div>
            <div>
              <h1 class="page-title">{{ employee()!.full_name }}</h1>
              <p class="page-subtitle">{{ employee()!.email }}</p>
            </div>
          </div>
          <button class="btn btn-primary" (click)="openCreatePunch()" data-testid="create-punch-button">
            <i class="fas fa-plus"></i> Añadir fichaje
          </button>
        </div>
      }

      <!-- Month nav -->
      <div class="month-nav card">
        <button class="btn btn-ghost btn-sm" (click)="prevMonth()" data-testid="prev-month-btn">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="month-label">{{ monthLabel() }}</span>
        <button class="btn btn-ghost btn-sm" (click)="nextMonth()" [disabled]="isCurrentMonth()" data-testid="next-month-btn">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Punches list -->
      <div class="card" style="padding:0; overflow:hidden">
        <div class="card-header" style="padding: 16px 20px; margin:0; border-bottom: 1px solid var(--border)">
          <span class="card-title">Fichajes</span>
          <span style="font-size:0.8rem; color: var(--text-secondary)">{{ punches().length }} total</span>
        </div>

        @if (loading()) {
          <div style="padding:40px; text-align:center; color:var(--text-secondary)">
            <span class="spinner"></span>
          </div>
        } @else if (punches().length === 0) {
          <div class="empty-state">
            <i class="fas fa-calendar-xmark"></i>
            <p>Sin fichajes este mes</p>
          </div>
        } @else {
          @for (punch of groupedPunches(); track punch.date) {
            <div class="day-group">
              <div class="day-group-header">{{ formatDate(punch.date) }}</div>
              @for (p of punch.items; track p.id) {
                <div class="punch-row admin-punch" [class]="'punch-' + p.status" [attr.data-testid]="'admin-punch-' + p.id">
                  <div class="punch-times">
                    <div class="time-block">
                      <span class="lbl">Entrada</span>
                      <span class="val green">{{ formatTime(p.check_in_at) }}</span>
                    </div>
                    @if (p.check_out_at) {
                      <i class="fas fa-arrow-right arrow-icon"></i>
                      <div class="time-block">
                        <span class="lbl">Salida</span>
                        <span class="val red">{{ formatTime(p.check_out_at) }}</span>
                      </div>
                      <div class="time-block">
                        <span class="lbl">Duración</span>
                        <span class="val blue">{{ calcDuration(p) }}</span>
                      </div>
                    } @else {
                      <span class="open-pill">Abierto</span>
                    }
                  </div>
                  <div class="punch-meta">
                    <span class="status-badge {{ p.status }}">{{ statusLabel(p.status) }}</span>
                    <div class="punch-actions">
                      <button class="btn btn-ghost btn-sm" (click)="openEditPunch(p)" [attr.data-testid]="'edit-punch-' + p.id">
                        <i class="fas fa-pen"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm danger" (click)="deletePunch(p.id)" [attr.data-testid]="'delete-punch-' + p.id">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  @if (p.check_in_note || p.check_out_note) {
                    <div class="notes">
                      @if (p.check_in_note) { <span class="note"><i class="fas fa-arrow-right-to-bracket"></i> {{ p.check_in_note }}</span> }
                      @if (p.check_out_note) { <span class="note"><i class="fas fa-arrow-right-from-bracket"></i> {{ p.check_out_note }}</span> }
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </div>
    </div>

    <!-- Edit punch modal -->
    @if (showEditModal()) {
      <div class="modal-overlay" (click)="showEditModal.set(false)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3 class="modal-title">{{ isCreating() ? 'Añadir Fichaje' : 'Editar Fichaje' }}</h3>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:20px">Los cambios quedarán marcados como editados por admin (amarillo)</p>

          @if (modalError()) {
            <div class="error-banner"><i class="fas fa-circle-exclamation"></i> {{ modalError() }}</div>
          }

          <div class="edit-form">
            @if (isCreating()) {
              <div class="form-group">
                <label class="form-label">Fecha *</label>
                <input class="form-input" [(ngModel)]="editForm.work_date" type="date" data-testid="punch-date-input" />
              </div>
            }
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Hora entrada *</label>
                <input class="form-input" [(ngModel)]="editForm.check_in_time" type="time" data-testid="punch-checkin-time" />
              </div>
              <div class="form-group">
                <label class="form-label">Hora salida</label>
                <input class="form-input" [(ngModel)]="editForm.check_out_time" type="time" data-testid="punch-checkout-time" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Nota entrada</label>
              <input class="form-input" [(ngModel)]="editForm.check_in_note" placeholder="Opcional..." data-testid="punch-checkin-note" />
            </div>
            <div class="form-group">
              <label class="form-label">Nota salida</label>
              <input class="form-input" [(ngModel)]="editForm.check_out_note" placeholder="Opcional..." data-testid="punch-checkout-note" />
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="showEditModal.set(false)">Cancelar</button>
            <button class="btn btn-primary" (click)="savePunch()" [disabled]="saving()" data-testid="save-punch-button">
              @if (saving()) { <span class="spinner"></span> }
              {{ isCreating() ? 'Crear fichaje' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .detail-page { display: flex; flex-direction: column; gap: 20px; }

    .back-btn { align-self: flex-start; }

    .employee-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .emp-avatar {
      width: 56px;
      height: 56px;
      background: var(--accent-blue);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading);
      font-size: 1.6rem;
      font-weight: 900;
      color: #fff;
      flex-shrink: 0;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .month-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
    }
    .month-label {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .day-group-header {
      padding: 8px 20px;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
    }

    .punch-row {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .punch-row:last-child { border-bottom: none; }

    .punch-edited_admin { border-left: 3px solid var(--status-yellow); }
    .punch-closed_auto { border-left: 3px solid var(--status-red); }
    .punch-closed_manual { border-left: 3px solid var(--status-green); }
    .punch-open { border-left: 3px solid var(--accent-blue); }

    .punch-times {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .time-block { display: flex; flex-direction: column; gap: 2px; }
    .lbl {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
    }
    .val {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 900;
    }
    .val.green { color: var(--status-green); }
    .val.red { color: var(--status-red); }
    .val.blue { color: var(--accent-blue); }

    .arrow-icon { color: var(--text-secondary); font-size: 0.875rem; }

    .open-pill {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent-blue);
      background: rgba(0,122,255,0.1);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(0,122,255,0.3);
    }

    .punch-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .punch-actions { display: flex; gap: 6px; }

    .btn.danger { color: var(--status-red); }
    .btn.danger:hover { background: rgba(239,68,68,0.1); }

    .notes { display: flex; flex-direction: column; gap: 4px; }
    .note {
      font-size: 0.8rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

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
      margin-bottom: 16px;
    }

    .modal-title {
      font-family: var(--font-heading);
      font-size: 1.4rem;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .edit-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
  `]
})
export class AdminEmployeeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private punchService = inject(PunchService);
  private userService = inject(UserService);

  userId = '';
  employee = signal<GymUser | null>(null);
  punches = signal<Punch[]>([]);
  loading = signal(true);
  saving = signal(false);
  showEditModal = signal(false);
  isCreating = signal(false);
  editingPunchId = signal<string | null>(null);
  modalError = signal<string | null>(null);

  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1);

  editForm = {
    work_date: '',
    check_in_time: '',
    check_out_time: '',
    check_in_note: '',
    check_out_note: ''
  };

  monthLabel = computed(() => {
    const d = new Date(this.viewYear(), this.viewMonth() - 1, 1);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  });

  isCurrentMonth = computed(() => {
    const now = new Date();
    return this.viewYear() === now.getFullYear() && this.viewMonth() === (now.getMonth() + 1);
  });

  groupedPunches = computed(() => {
    const map = new Map<string, Punch[]>();
    for (const p of this.punches()) {
      const list = map.get(p.work_date) || [];
      list.push(p);
      map.set(p.work_date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({ date, items }));
  });

  async ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    await Promise.all([this.loadEmployee(), this.loadPunches()]);
  }

  async loadEmployee() {
    try {
      const users = await this.userService.getUsers();
      this.employee.set(users.find(u => u.id === this.userId) || null);
    } catch (e) { console.error(e); }
  }

  async loadPunches() {
    this.loading.set(true);
    try {
      const data = await this.punchService.adminGetPunches(this.userId, this.viewYear(), this.viewMonth());
      this.punches.set(data);
    } catch (e) { console.error(e); }
    finally { this.loading.set(false); }
  }

  goBack() { this.router.navigate(['/admin/users']); }

  async prevMonth() {
    if (this.viewMonth() === 1) { this.viewYear.update(y => y - 1); this.viewMonth.set(12); }
    else { this.viewMonth.update(m => m - 1); }
    await this.loadPunches();
  }

  async nextMonth() {
    if (this.isCurrentMonth()) return;
    if (this.viewMonth() === 12) { this.viewYear.update(y => y + 1); this.viewMonth.set(1); }
    else { this.viewMonth.update(m => m + 1); }
    await this.loadPunches();
  }

  openCreatePunch() {
    this.isCreating.set(true);
    this.editingPunchId.set(null);
    this.modalError.set(null);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    this.editForm = { work_date: today, check_in_time: '09:00', check_out_time: '', check_in_note: '', check_out_note: '' };
    this.showEditModal.set(true);
  }

  openEditPunch(punch: Punch) {
    this.isCreating.set(false);
    this.editingPunchId.set(punch.id);
    this.modalError.set(null);
    this.editForm = {
      work_date: punch.work_date,
      check_in_time: punch.check_in_at ? new Date(punch.check_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '',
      check_out_time: punch.check_out_at ? new Date(punch.check_out_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '',
      check_in_note: punch.check_in_note || '',
      check_out_note: punch.check_out_note || ''
    };
    this.showEditModal.set(true);
  }

  private localDateTimeToISO(date: string, time: string): string {
    if (!time) return '';
    return `${date}T${time}:00+01:00`;
  }

  async savePunch() {
    this.saving.set(true);
    this.modalError.set(null);
    try {
      const date = this.editForm.work_date;
      const checkIn = this.localDateTimeToISO(date, this.editForm.check_in_time);
      const checkOut = this.editForm.check_out_time ? this.localDateTimeToISO(date, this.editForm.check_out_time) : undefined;

      if (this.isCreating()) {
        await this.punchService.adminCreatePunch({
          user_id: this.userId,
          work_date: date,
          check_in_at: checkIn,
          check_out_at: checkOut,
          check_in_note: this.editForm.check_in_note || undefined,
          check_out_note: this.editForm.check_out_note || undefined
        });
      } else {
        await this.punchService.adminUpdatePunch(this.editingPunchId()!, {
          check_in_at: checkIn,
          check_out_at: checkOut,
          check_in_note: this.editForm.check_in_note,
          check_out_note: this.editForm.check_out_note
        });
      }
      this.showEditModal.set(false);
      await this.loadPunches();
    } catch (e: any) {
      this.modalError.set(e?.message || 'Error al guardar fichaje');
    } finally {
      this.saving.set(false);
    }
  }

  async deletePunch(punchId: string) {
    if (!confirm('¿Eliminar este fichaje?')) return;
    try {
      await this.punchService.adminDeletePunch(punchId);
      this.punches.update(list => list.filter(p => p.id !== punchId));
    } catch (e: any) {
      alert(e?.message || 'Error al eliminar');
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  }

  calcDuration(punch: Punch): string {
    if (!punch.check_out_at) return '—';
    const mins = Math.round((new Date(punch.check_out_at).getTime() - new Date(punch.check_in_at).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = { open: 'Abierto', closed_manual: 'Manual', closed_auto: 'Auto', edited_admin: 'Editado' };
    return map[status] || status;
  }
}
