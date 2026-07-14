import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PunchService, Punch } from '../../core/services/punch.service';
import { GeoService } from '../../core/services/geo.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <div class="dash-header">
        <div>
          <h1 class="page-title">Hola, {{ firstName() }}</h1>
          <p class="page-subtitle">{{ todayLabel() }}</p>
        </div>
        <div class="pairs-info" data-testid="remaining-pairs">
          <span class="pairs-number">{{ remainingPairs() }}</span>
          <span class="pairs-label">pares restantes</span>
        </div>
      </div>

      <!-- Clock display -->
      <div class="clock-display">
        <div class="time-value" data-testid="current-time">{{ currentTime() }}</div>
        <div class="date-value">{{ currentDate() }}</div>
      </div>

      <!-- Status card -->
      <div class="status-card" [class]="statusClass()">
        <div class="status-icon">
          <i [class]="isCheckedIn() ? 'fas fa-circle-check' : 'fas fa-circle'"></i>
        </div>
        <div class="status-info">
          <div class="status-label" data-testid="punch-status-label">
            {{ isCheckedIn() ? 'FICHADO — EN EL GIMNASIO' : 'SIN FICHAR' }}
          </div>
          @if (isCheckedIn() && openPunch()) {
            <div class="status-since">Desde {{ formatTime(openPunch()!.check_in_at) }}</div>
          }
        </div>
      </div>

      <!-- Main punch button -->
      <div class="punch-area">
        @if (loading()) {
          <button class="punch-btn loading" disabled data-testid="punch-button-loading">
            <span class="punch-spinner"></span>
            <span>Obteniendo ubicación...</span>
          </button>
        } @else if (!isCheckedIn()) {
          <button
            class="punch-btn checkin"
            (click)="handleCheckIn()"
            [disabled]="remainingPairs() === 0"
            data-testid="checkin-button"
          >
            <i class="fas fa-right-to-bracket"></i>
            <span>FICHAR ENTRADA</span>
          </button>
        } @else {
          <button class="punch-btn checkout" (click)="showNoteModal.set(true)" data-testid="checkout-button">
            <i class="fas fa-right-from-bracket"></i>
            <span>FICHAR SALIDA</span>
          </button>
        }

        @if (error()) {
          <div class="punch-error" data-testid="punch-error">
            <i class="fas fa-triangle-exclamation"></i>
            {{ error() }}
          </div>
        }

        @if (success()) {
          <div class="punch-success" data-testid="punch-success">
            <i class="fas fa-circle-check"></i>
            {{ success() }}
          </div>
        }
      </div>

      <!-- Today's punches -->
      @if (todayPunches().length > 0) {
        <div class="today-punches card" data-testid="today-punches">
          <div class="card-header">
            <span class="card-title">HOY</span>
            <span class="pairs-badge">{{ todayPunches().length }} fichaje(s)</span>
          </div>
          @for (punch of todayPunches(); track punch.id) {
            <div class="punch-row" [attr.data-testid]="'punch-row-' + punch.id">
              <div class="punch-times">
                <span class="punch-in">
                  <i class="fas fa-arrow-right-to-bracket"></i>
                  {{ formatTime(punch.check_in_at) }}
                </span>
                @if (punch.check_out_at) {
                  <span class="punch-sep">→</span>
                  <span class="punch-out">
                    <i class="fas fa-arrow-right-from-bracket"></i>
                    {{ formatTime(punch.check_out_at) }}
                  </span>
                } @else {
                  <span class="punch-open-badge">Abierto</span>
                }
              </div>
              <span class="status-badge {{ punch.status }}" [attr.data-testid]="'punch-status-' + punch.id">
                {{ statusLabel(punch.status) }}
              </span>
            </div>
          }
        </div>
      }
    </div>

    <!-- Note modal for checkout -->
    @if (showNoteModal()) {
      <div class="modal-overlay" (click)="showNoteModal.set(false)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3 class="modal-title">Fichar Salida</h3>
          <div class="form-group">
            <label class="form-label">Observación (opcional)</label>
            <textarea
              class="form-input"
              [(ngModel)]="checkoutNote"
              placeholder="Ej: Salida por enfermedad..."
              rows="3"
              data-testid="checkout-note-input"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="showNoteModal.set(false)">Cancelar</button>
            <button
              class="btn btn-primary"
              (click)="handleCheckOut()"
              [disabled]="loading()"
              data-testid="checkout-confirm-button"
            >
              @if (loading()) { <span class="spinner"></span> }
              Confirmar salida
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Check-in note modal -->
    @if (showCheckInModal()) {
      <div class="modal-overlay" (click)="showCheckInModal.set(false)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3 class="modal-title">Fichar Entrada</h3>
          <div class="form-group">
            <label class="form-label">Observación (opcional)</label>
            <textarea
              class="form-input"
              [(ngModel)]="checkinNote"
              placeholder="Ej: Entrada anticipada..."
              rows="3"
              data-testid="checkin-note-input"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" (click)="showCheckInModal.set(false)">Cancelar</button>
            <button
              class="btn btn-primary"
              (click)="doCheckIn()"
              [disabled]="loading()"
              data-testid="checkin-confirm-button"
            >
              @if (loading()) { <span class="spinner"></span> }
              Confirmar entrada
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dashboard {
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .dash-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .pairs-info {
      text-align: center;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 14px;
    }
    .pairs-number {
      display: block;
      font-family: var(--font-heading);
      font-size: 1.8rem;
      font-weight: 900;
      color: var(--text-primary);
      line-height: 1;
    }
    .pairs-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }

    .clock-display {
      text-align: center;
      padding: 28px 0 20px;
    }
    .time-value {
      font-family: var(--font-heading);
      font-size: 5rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      line-height: 1;
    }
    .date-value {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 6px;
    }

    .status-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-radius: var(--radius-lg);
      border: 1px solid;
    }
    .status-card.checked-in {
      background: rgba(16, 185, 129, 0.08);
      border-color: rgba(16, 185, 129, 0.3);
    }
    .status-card.checked-out {
      background: rgba(39, 39, 42, 0.6);
      border-color: var(--border);
    }

    .status-icon { font-size: 1.5rem; }
    .status-card.checked-in .status-icon { color: var(--status-green); }
    .status-card.checked-out .status-icon { color: var(--text-secondary); }

    .status-label {
      font-family: var(--font-heading);
      font-size: 1rem;
      font-weight: 900;
      letter-spacing: 0.05em;
    }
    .status-card.checked-in .status-label { color: var(--status-green); }
    .status-card.checked-out .status-label { color: var(--text-secondary); }

    .status-since { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }

    /* ---- Punch button ---- */
    .punch-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .punch-btn {
      width: 100%;
      max-width: 320px;
      height: 100px;
      border-radius: 16px;
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 2px solid;
      cursor: pointer;
      transition: transform 0.1s ease, opacity 0.15s ease;
    }

    .punch-btn:active:not(:disabled) { transform: scale(0.96); }
    .punch-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .punch-btn i { font-size: 1.8rem; }

    .punch-btn.checkin {
      background: var(--status-green);
      border-color: var(--status-green);
      color: #fff;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.25);
    }
    .punch-btn.checkin:hover:not(:disabled) { opacity: 0.92; }

    .punch-btn.checkout {
      background: var(--status-red);
      border-color: var(--status-red);
      color: #fff;
      box-shadow: 0 0 30px rgba(239, 68, 68, 0.25);
    }
    .punch-btn.checkout:hover:not(:disabled) { opacity: 0.92; }

    .punch-btn.loading {
      background: var(--bg-elevated);
      border-color: var(--border);
      color: var(--text-secondary);
      flex-direction: row;
      gap: 10px;
    }

    .punch-spinner {
      width: 22px;
      height: 22px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .punch-error {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius);
      color: var(--status-red);
      font-size: 0.875rem;
      width: 100%;
      max-width: 320px;
      animation: toast-in 0.3s ease;
    }

    .punch-success {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: var(--radius);
      color: var(--status-green);
      font-size: 0.875rem;
      width: 100%;
      max-width: 320px;
      animation: toast-in 0.3s ease;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ---- Today's punches ---- */
    .today-punches { padding: 0; }
    .today-punches .card-header { padding: 16px 20px; margin: 0; }
    .pairs-badge {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--bg-elevated);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
    }

    .punch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      gap: 12px;
    }
    .punch-row:last-child { border-bottom: none; }

    .punch-times {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      flex-wrap: wrap;
    }
    .punch-in { color: var(--status-green); display: flex; align-items: center; gap: 4px; }
    .punch-out { color: var(--status-red); display: flex; align-items: center; gap: 4px; }
    .punch-sep { color: var(--text-secondary); }

    .punch-open-badge {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-blue);
      background: rgba(0,122,255,0.1);
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(0,122,255,0.3);
    }

    .modal-title {
      font-family: var(--font-heading);
      font-size: 1.4rem;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
    }
  `]
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private punchService = inject(PunchService);
  private geoService = inject(GeoService);

  punches = signal<Punch[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showNoteModal = signal(false);
  showCheckInModal = signal(false);
  checkoutNote = '';
  checkinNote = '';

  private clockInterval: any;
  private timeSignal = signal(new Date());

  firstName = computed(() => (this.authService.currentUser()?.full_name || '').split(' ')[0]);

  todayPunches = computed(() => {
    const today = this.getMadridToday();
    return this.punches().filter(p => p.work_date === today);
  });

  openPunch = computed(() => this.todayPunches().find(p => !p.check_out_at) || null);
  isCheckedIn = computed(() => !!this.openPunch());
  remainingPairs = computed(() => {
    const today = this.todayPunches();
    const closedPairs = today.filter(p => p.check_out_at).length;
    return Math.max(0, 3 - closedPairs - (this.isCheckedIn() ? 1 : 0));
  });

  statusClass = computed(() => this.isCheckedIn() ? 'status-card checked-in' : 'status-card checked-out');

  currentTime = computed(() => {
    const d = this.timeSignal();
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Madrid' });
  });

  currentDate = computed(() => {
    const d = this.timeSignal();
    return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Madrid' });
  });

  todayLabel = computed(() => {
    const d = new Date();
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  });

  async ngOnInit() {
    this.clockInterval = setInterval(() => this.timeSignal.set(new Date()), 1000);
    await this.loadPunches();
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  private getMadridToday(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  }

  async loadPunches() {
    try {
      const now = new Date();
      const data = await this.punchService.getMyPunches(
        parseInt(now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).split('-')[0]),
        parseInt(now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }).split('-')[1])
      );
      this.punches.set(data);
    } catch (e: any) {
      console.error('Error loading punches', e);
    }
  }

  async handleCheckIn() {
    this.showCheckInModal.set(true);
  }

  async doCheckIn() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await this.geoService.getCurrentPosition();
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (geoErr: any) {
        this.loading.set(false);
        this.error.set(geoErr.message || 'No se pudo obtener la ubicación');
        this.showCheckInModal.set(false);
        return;
      }
      await this.punchService.checkIn(lat, lng, this.checkinNote || undefined);
      this.success.set('Entrada registrada correctamente');
      this.checkinNote = '';
      this.showCheckInModal.set(false);
      await this.loadPunches();
      setTimeout(() => this.success.set(null), 3000);
    } catch (e: any) {
      this.error.set(e?.error?.detail || 'Error al fichar entrada');
      this.showCheckInModal.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async handleCheckOut() {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await this.geoService.getCurrentPosition();
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (geoErr: any) {
        this.loading.set(false);
        this.error.set(geoErr.message || 'No se pudo obtener la ubicación');
        this.showNoteModal.set(false);
        return;
      }
      const punch = this.openPunch();
      if (!punch) return;
      await this.punchService.checkOut(punch.id, lat, lng, this.checkoutNote || undefined);
      this.success.set('Salida registrada correctamente');
      this.checkoutNote = '';
      this.showNoteModal.set(false);
      await this.loadPunches();
      setTimeout(() => this.success.set(null), 3000);
    } catch (e: any) {
      this.error.set(e?.error?.detail || 'Error al fichar salida');
      this.showNoteModal.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  formatTime(isoStr: string): string {
    return new Date(isoStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      open: 'Abierto',
      closed_manual: 'Cerrado',
      closed_auto: 'Auto',
      edited_admin: 'Editado'
    };
    return map[status] || status;
  }
}
