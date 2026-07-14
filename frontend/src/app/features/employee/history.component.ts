import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PunchService, Punch } from '../../core/services/punch.service';
import { AuthService } from '../../core/services/auth.service';

interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  punches: Punch[];
  status: 'none' | 'green' | 'red' | 'yellow' | 'blue' | 'mixed';
}

@Component({
  selector: 'app-employee-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page">
      <div class="page-header">
        <h1 class="page-title">Historial</h1>
        <p class="page-subtitle">{{ currentMonthLabel() }}</p>
      </div>

      <!-- Month navigation -->
      <div class="month-nav card">
        <button class="btn btn-ghost btn-sm" (click)="prevMonth()" data-testid="prev-month-button">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="month-label" data-testid="month-label">{{ currentMonthLabel() }}</span>
        <button class="btn btn-ghost btn-sm" (click)="nextMonth()" [disabled]="isCurrentMonth()" data-testid="next-month-button">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- Calendar grid -->
      <div class="calendar card">
        <div class="cal-weekdays">
          @for (day of ['L','M','X','J','V','S','D']; track day) {
            <div class="cal-weekday">{{ day }}</div>
          }
        </div>
        <div class="cal-grid" data-testid="calendar-grid">
          @for (day of calendarDays(); track day.date) {
            <div
              class="cal-day"
              [class.other-month]="!day.inMonth"
              [class.today]="day.date === todayStr()"
              [class.selected]="day.date === selectedDate()"
              [class.has-punches]="day.punches.length > 0"
              (click)="selectDay(day)"
              [attr.data-testid]="'cal-day-' + day.date"
            >
              <span class="day-number">{{ day.day }}</span>
              @if (day.punches.length > 0) {
                <div class="day-dots">
                  @for (p of day.punches.slice(0, 3); track p.id) {
                    <span class="dot" [class]="'dot-' + p.status" [attr.data-testid]="'dot-' + p.id"></span>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Legend -->
        <div class="legend">
          <span class="legend-item"><span class="dot dot-closed_manual"></span> Manual</span>
          <span class="legend-item"><span class="dot dot-closed_auto"></span> Automático</span>
          <span class="legend-item"><span class="dot dot-edited_admin"></span> Editado</span>
          <span class="legend-item"><span class="dot dot-open"></span> Abierto</span>
        </div>
      </div>

      <!-- Selected day punches -->
      @if (selectedDate()) {
        <div class="day-detail card" data-testid="day-detail">
          <div class="card-header">
            <span class="card-title">{{ formatDate(selectedDate()!) }}</span>
            <span class="pairs-count">{{ selectedDayPunches().length }} fichaje(s)</span>
          </div>

          @if (selectedDayPunches().length === 0) {
            <div class="empty-state">
              <i class="fas fa-calendar-xmark"></i>
              <p>Sin fichajes este día</p>
            </div>
          } @else {
            @for (punch of selectedDayPunches(); track punch.id) {
              <div class="detail-punch-row" [attr.data-testid]="'detail-punch-' + punch.id">
                <div class="punch-detail-times">
                  <div class="punch-time-block">
                    <span class="time-label">ENTRADA</span>
                    <span class="time-val in">{{ formatTime(punch.check_in_at) }}</span>
                  </div>
                  @if (punch.check_out_at) {
                    <i class="fas fa-arrow-right time-arrow"></i>
                    <div class="punch-time-block">
                      <span class="time-label">SALIDA</span>
                      <span class="time-val out">{{ formatTime(punch.check_out_at) }}</span>
                    </div>
                    <div class="punch-time-block">
                      <span class="time-label">DURACIÓN</span>
                      <span class="time-val dur">{{ calcDuration(punch) }}</span>
                    </div>
                  } @else {
                    <span class="open-badge">Abierto</span>
                  }
                </div>
                <span class="status-badge {{ punch.status }}">{{ statusLabel(punch.status) }}</span>

                @if (punch.check_in_note || punch.check_out_note) {
                  <div class="punch-notes">
                    @if (punch.check_in_note) {
                      <span class="note-item"><i class="fas fa-arrow-right-to-bracket"></i> {{ punch.check_in_note }}</span>
                    }
                    @if (punch.check_out_note) {
                      <span class="note-item"><i class="fas fa-arrow-right-from-bracket"></i> {{ punch.check_out_note }}</span>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- Monthly summary -->
      @if (monthSummary().totalPairs > 0) {
        <div class="summary-card card" data-testid="monthly-summary">
          <div class="card-header">
            <span class="card-title">RESUMEN DEL MES</span>
          </div>
          <div class="summary-grid">
            <div class="summary-stat">
              <span class="stat-value">{{ monthSummary().totalPairs }}</span>
              <span class="stat-label">Pares total</span>
            </div>
            <div class="summary-stat">
              <span class="stat-value">{{ monthSummary().workedDays }}</span>
              <span class="stat-label">Días trabajados</span>
            </div>
            <div class="summary-stat">
              <span class="stat-value">{{ monthSummary().totalHours }}h</span>
              <span class="stat-label">Horas estimadas</span>
            </div>
            <div class="summary-stat">
              <span class="stat-value stat-auto">{{ monthSummary().autoClosed }}</span>
              <span class="stat-label">Cierres auto</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .history-page { display: flex; flex-direction: column; gap: 20px; }

    .month-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
    }
    .month-label {
      font-family: var(--font-heading);
      font-size: 1.2rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .calendar { padding: 0; overflow: hidden; }

    .cal-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
    }
    .cal-weekday {
      text-align: center;
      padding: 10px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
    }

    .cal-day {
      min-height: 52px;
      padding: 6px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: background-color 0.1s ease;
    }
    .cal-day:hover { background: var(--bg-elevated); }
    .cal-day.other-month { opacity: 0.3; }
    .cal-day.today .day-number {
      background: var(--accent-blue);
      color: #fff;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cal-day.selected { background: rgba(0,122,255,0.1); }

    .day-number {
      font-size: 0.875rem;
      font-weight: 600;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .day-dots {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-closed_manual { background: var(--status-green); }
    .dot-closed_auto { background: var(--status-red); }
    .dot-edited_admin { background: var(--status-yellow); }
    .dot-open { background: var(--accent-blue); }

    .legend {
      display: flex;
      gap: 16px;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.7rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* Day detail */
    .day-detail { padding: 0; }
    .day-detail .card-header { padding: 16px 20px; margin: 0; border-bottom: 1px solid var(--border); }
    .pairs-count {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .detail-punch-row {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .detail-punch-row:last-child { border-bottom: none; }

    .punch-detail-times {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .punch-time-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .time-label {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
    }
    .time-val {
      font-family: var(--font-heading);
      font-size: 1.2rem;
      font-weight: 900;
    }
    .time-val.in { color: var(--status-green); }
    .time-val.out { color: var(--status-red); }
    .time-val.dur { color: var(--accent-blue); }

    .time-arrow { color: var(--text-secondary); font-size: 0.875rem; }

    .open-badge {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent-blue);
      background: rgba(0,122,255,0.1);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(0,122,255,0.3);
    }

    .punch-notes {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .note-item {
      font-size: 0.8rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Summary */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
    }
    .summary-stat {
      background: var(--bg-surface);
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .stat-value {
      font-family: var(--font-heading);
      font-size: 2rem;
      font-weight: 900;
      color: var(--text-primary);
    }
    .stat-value.stat-auto { color: var(--status-red); }
    .stat-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
      text-align: center;
    }

    @media (max-width: 400px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class EmployeeHistoryComponent implements OnInit {
  private punchService = inject(PunchService);
  private authService = inject(AuthService);

  punches = signal<Punch[]>([]);
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth() + 1); // 1-based
  selectedDate = signal<string | null>(null);

  todayStr = signal(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }));

  async ngOnInit() {
    await this.loadPunches();
  }

  async loadPunches() {
    try {
      const data = await this.punchService.getMyPunches(this.viewYear(), this.viewMonth());
      this.punches.set(data);
    } catch (e) {
      console.error(e);
    }
  }

  currentMonthLabel = computed(() => {
    const d = new Date(this.viewYear(), this.viewMonth() - 1, 1);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  });

  isCurrentMonth = computed(() => {
    const now = new Date();
    return this.viewYear() === now.getFullYear() && this.viewMonth() === (now.getMonth() + 1);
  });

  calendarDays = computed<CalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: CalendarDay[] = [];

    // Day of week (0=Sun, adjusted to Mon=0)
    let startDow = (firstDay.getDay() + 6) % 7;

    // Fill previous month days
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, -i);
      days.push({ date: d.toLocaleDateString('sv-SE'), day: d.getDate(), inMonth: false, punches: [], status: 'none' });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayPunches = this.punches().filter(p => p.work_date === date);
      days.push({ date, day: d, inMonth: true, punches: dayPunches, status: this.dayStatus(dayPunches) });
    }

    // Fill next month
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month, d);
      days.push({ date: dt.toLocaleDateString('sv-SE'), day: d, inMonth: false, punches: [], status: 'none' });
    }

    return days;
  });

  selectedDayPunches = computed(() =>
    this.selectedDate() ? this.punches().filter(p => p.work_date === this.selectedDate()) : []
  );

  monthSummary = computed(() => {
    const ps = this.punches();
    const workedDays = new Set(ps.map(p => p.work_date)).size;
    const totalPairs = ps.length;
    const autoClosed = ps.filter(p => p.status === 'closed_auto').length;
    let totalMinutes = 0;
    ps.forEach(p => {
      if (p.check_in_at && p.check_out_at) {
        totalMinutes += (new Date(p.check_out_at).getTime() - new Date(p.check_in_at).getTime()) / 60000;
      }
    });
    return { workedDays, totalPairs, autoClosed, totalHours: Math.round(totalMinutes / 60) };
  });

  private dayStatus(punches: Punch[]): CalendarDay['status'] {
    if (!punches.length) return 'none';
    if (punches.some(p => p.status === 'edited_admin')) return 'yellow';
    if (punches.some(p => p.status === 'closed_auto')) return 'red';
    if (punches.some(p => p.status === 'open')) return 'blue';
    return 'green';
  }

  async prevMonth() {
    if (this.viewMonth() === 1) {
      this.viewYear.update(y => y - 1);
      this.viewMonth.set(12);
    } else {
      this.viewMonth.update(m => m - 1);
    }
    this.selectedDate.set(null);
    await this.loadPunches();
  }

  async nextMonth() {
    if (this.isCurrentMonth()) return;
    if (this.viewMonth() === 12) {
      this.viewYear.update(y => y + 1);
      this.viewMonth.set(1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
    this.selectedDate.set(null);
    await this.loadPunches();
  }

  selectDay(day: CalendarDay) {
    if (!day.inMonth) return;
    this.selectedDate.set(day.date === this.selectedDate() ? null : day.date);
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
