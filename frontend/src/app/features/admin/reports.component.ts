import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ElementRef, ViewChild, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { PunchService, Punch } from '../../core/services/punch.service';
import { UserService, GymUser } from '../../core/services/user.service';

Chart.register(...registerables);

interface EmployeeReport {
  user_id: string;
  full_name: string;
  total_minutes: number;
  total_hours: string;
  days_worked: number;
  total_punches: number;
  auto_closes: number;
}

interface DailyTotal {
  date: string;
  label: string;
  total_minutes: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title" data-testid="reports-title">Informes</h1>
          <p class="page-subtitle">Análisis de horas trabajadas por el equipo</p>
        </div>
        <div class="period-selector" data-testid="period-selector">
          <select class="select-input" [(ngModel)]="selectedMonth" (ngModelChange)="loadData()" data-testid="month-select">
            @for (m of months; track m.value) {
              <option [value]="m.value">{{ m.label }}</option>
            }
          </select>
          <select class="select-input" [(ngModel)]="selectedYear" (ngModelChange)="loadData()" data-testid="year-select">
            @for (y of years; track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state" data-testid="reports-loading">
          <div class="spinner"></div>
          <span>Cargando datos...</span>
        </div>
      } @else if (error()) {
        <div class="error-banner" data-testid="reports-error">
          <i class="fas fa-triangle-exclamation"></i> {{ error() }}
        </div>
      } @else {
        <!-- Summary Cards -->
        <div class="cards-grid" data-testid="summary-cards">
          <div class="stat-card" data-testid="card-total-hours">
            <div class="stat-icon blue"><i class="fas fa-clock"></i></div>
            <div class="stat-info">
              <div class="stat-value">{{ totalHours() }}</div>
              <div class="stat-label">Horas totales</div>
            </div>
          </div>
          <div class="stat-card" data-testid="card-days-worked">
            <div class="stat-icon green"><i class="fas fa-calendar-check"></i></div>
            <div class="stat-info">
              <div class="stat-value">{{ totalDaysWorked() }}</div>
              <div class="stat-label">Días con fichaje</div>
            </div>
          </div>
          <div class="stat-card" data-testid="card-active-employees">
            <div class="stat-icon purple"><i class="fas fa-users"></i></div>
            <div class="stat-info">
              <div class="stat-value">{{ activeEmployees() }}</div>
              <div class="stat-label">Empleados activos</div>
            </div>
          </div>
          <div class="stat-card" data-testid="card-auto-closes">
            <div class="stat-icon orange"><i class="fas fa-moon"></i></div>
            <div class="stat-info">
              <div class="stat-value">{{ totalAutoCloses() }}</div>
              <div class="stat-label">Cierres automáticos</div>
            </div>
          </div>
        </div>

        @if (employeeReports().length === 0) {
          <!-- Empty state -->
          <div class="empty-state" data-testid="empty-state">
            <div class="empty-icon"><i class="fas fa-chart-bar"></i></div>
            <h3>Sin datos para este período</h3>
            <p>No hay fichajes registrados en {{ monthLabel() }} {{ selectedYear }}.</p>
          </div>
        } @else {
          <!-- Charts Row -->
          <div class="charts-grid">
            <!-- Hours per Employee chart -->
            <div class="chart-card" data-testid="chart-per-employee">
              <div class="chart-header">
                <h2 class="chart-title">
                  <i class="fas fa-person"></i>
                  Horas por empleado
                </h2>
                <span class="chart-subtitle">{{ monthLabel() }} {{ selectedYear }}</span>
              </div>
              <div class="chart-container">
                <canvas #employeeChart></canvas>
              </div>
            </div>

            <!-- Daily evolution chart -->
            <div class="chart-card" data-testid="chart-daily">
              <div class="chart-header">
                <h2 class="chart-title">
                  <i class="fas fa-chart-line"></i>
                  Evolución diaria
                </h2>
                <span class="chart-subtitle">Horas totales del equipo por día</span>
              </div>
              <div class="chart-container">
                <canvas #dailyChart></canvas>
              </div>
            </div>
          </div>

          <!-- Employee detail table -->
          <div class="table-card" data-testid="employee-table">
            <div class="table-header">
              <h2 class="chart-title">
                <i class="fas fa-table"></i>
                Resumen por empleado
              </h2>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th class="text-right">Horas totales</th>
                    <th class="text-right">Días trabajados</th>
                    <th class="text-right">Fichajes</th>
                    <th class="text-right">Cierres auto</th>
                    <th class="text-center">Promedio/día</th>
                  </tr>
                </thead>
                <tbody>
                  @for (emp of employeeReports(); track emp.user_id) {
                    <tr data-testid="employee-row">
                      <td>
                        <div class="employee-cell">
                          <div class="emp-avatar">{{ emp.full_name[0].toUpperCase() }}</div>
                          <span>{{ emp.full_name }}</span>
                        </div>
                      </td>
                      <td class="text-right font-mono">{{ emp.total_hours }}</td>
                      <td class="text-right">{{ emp.days_worked }}</td>
                      <td class="text-right">{{ emp.total_punches }}</td>
                      <td class="text-right">
                        @if (emp.auto_closes > 0) {
                          <span class="badge orange">{{ emp.auto_closes }}</span>
                        } @else {
                          <span class="text-secondary">0</span>
                        }
                      </td>
                      <td class="text-center font-mono">
                        {{ emp.days_worked > 0 ? avgHours(emp) : '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .reports-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-title {
      font-family: var(--font-heading);
      font-size: 1.75rem;
      font-weight: 900;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .page-subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0;
    }

    .period-selector {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .select-input {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      padding: 8px 12px;
      font-size: 0.875rem;
      cursor: pointer;
      outline: none;
    }

    .select-input:focus {
      border-color: var(--accent-blue);
    }

    /* Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .stat-icon.blue   { background: rgba(0,122,255,.15); color: var(--accent-blue); }
    .stat-icon.green  { background: rgba(52,199,89,.15);  color: #34c759; }
    .stat-icon.purple { background: rgba(175,82,222,.15); color: #af52de; }
    .stat-icon.orange { background: rgba(255,149,0,.15);  color: #ff9500; }

    .stat-value {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 900;
      color: var(--text-primary);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    /* Charts */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .chart-card, .table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .chart-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chart-title i {
      color: var(--accent-blue);
      font-size: 0.875rem;
    }

    .chart-subtitle {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-style: italic;
    }

    .chart-container {
      position: relative;
      height: 260px;
    }

    /* Table */
    .table-header {
      margin-bottom: 16px;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .data-table th {
      padding: 10px 14px;
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }

    .data-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text-primary);
    }

    .data-table tr:last-child td { border-bottom: none; }

    .employee-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .emp-avatar {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--accent-blue);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .text-right   { text-align: right; }
    .text-center  { text-align: center; }
    .text-secondary { color: var(--text-secondary); }
    .font-mono { font-family: 'SF Mono', 'Fira Code', monospace; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.orange { background: rgba(255,149,0,.2); color: #ff9500; }

    /* Loading / Error / Empty */
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px;
      color: var(--text-secondary);
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-banner {
      background: rgba(255,59,48,.1);
      border: 1px solid rgba(255,59,48,.3);
      border-radius: var(--radius);
      padding: 14px 18px;
      color: #ff3b30;
      font-size: 0.875rem;
    }

    .empty-state {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 60px 40px;
      text-align: center;
    }

    .empty-icon {
      font-size: 3rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 8px;
    }

    .empty-state p {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0;
    }

    @media (max-width: 1024px) {
      .charts-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .cards-grid { grid-template-columns: repeat(2, 1fr); }
      .page-header { flex-direction: column; }
    }

    @media (max-width: 480px) {
      .cards-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  private punchService = inject(PunchService);
  private userService = inject(UserService);

  @ViewChild('employeeChart') employeeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dailyChart') dailyChartRef!: ElementRef<HTMLCanvasElement>;

  private empChart: Chart | null = null;
  private dayChart: Chart | null = null;

  loading = signal(false);
  error = signal<string | null>(null);

  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth() + 1;

  private allPunches = signal<Punch[]>([]);
  private users = signal<GymUser[]>([]);

  employeeReports = computed<EmployeeReport[]>(() => {
    const punches = this.allPunches();
    const usersMap = new Map(this.users().map(u => [u.id, u.full_name]));

    const map = new Map<string, EmployeeReport>();
    const seenDays = new Map<string, Set<string>>();

    for (const p of punches) {
      if (!map.has(p.user_id)) {
        map.set(p.user_id, {
          user_id: p.user_id,
          full_name: usersMap.get(p.user_id) ?? 'Desconocido',
          total_minutes: 0,
          total_hours: '0h 0m',
          days_worked: 0,
          total_punches: 0,
          auto_closes: 0
        });
        seenDays.set(p.user_id, new Set());
      }

      const r = map.get(p.user_id)!;

      if (p.check_in_at && p.check_out_at) {
        const diff = (new Date(p.check_out_at).getTime() - new Date(p.check_in_at).getTime()) / 60000;
        if (diff > 0) {
          r.total_minutes += diff;
          r.total_punches++;
        }
      }

      seenDays.get(p.user_id)!.add(p.work_date);
      if (p.status === 'closed_auto') r.auto_closes++;
    }

    return Array.from(map.values())
      .map(r => ({
        ...r,
        days_worked: seenDays.get(r.user_id)?.size ?? 0,
        total_hours: this.minutesToLabel(r.total_minutes)
      }))
      .sort((a, b) => b.total_minutes - a.total_minutes);
  });

  dailyTotals = computed<DailyTotal[]>(() => {
    const punches = this.allPunches();
    const map = new Map<string, number>();

    for (const p of punches) {
      if (p.check_in_at && p.check_out_at) {
        const diff = (new Date(p.check_out_at).getTime() - new Date(p.check_in_at).getTime()) / 60000;
        if (diff > 0) {
          map.set(p.work_date, (map.get(p.work_date) ?? 0) + diff);
        }
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, mins]) => ({
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
        total_minutes: mins
      }));
  });

  totalHours = computed(() => {
    const total = this.employeeReports().reduce((s, e) => s + e.total_minutes, 0);
    return this.minutesToLabel(total);
  });

  totalDaysWorked = computed(() =>
    new Set(this.allPunches().map(p => p.work_date)).size
  );

  activeEmployees = computed(() => this.employeeReports().length);

  totalAutoCloses = computed(() =>
    this.allPunches().filter(p => p.status === 'closed_auto').length
  );

  months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  monthLabel() {
    return this.months.find(m => m.value === this.selectedMonth)?.label ?? '';
  }

  avgHours(emp: EmployeeReport): string {
    return this.minutesToLabel(emp.total_minutes / emp.days_worked);
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);
    this.destroyCharts();

    try {
      const [punches, users] = await Promise.all([
        this.punchService.adminGetPunches(undefined, this.selectedYear, this.selectedMonth),
        this.userService.getUsers()
      ]);
      this.allPunches.set(punches);
      this.users.set(users);
      // Charts need DOM to be updated first
      setTimeout(() => this.renderCharts(), 50);
    } catch (e: any) {
      this.error.set(e?.message || 'Error al cargar los informes');
    } finally {
      this.loading.set(false);
    }
  }

  private renderCharts() {
    this.destroyCharts();
    if (!this.employeeChartRef || !this.dailyChartRef) return;

    const reports = this.employeeReports();
    const daily = this.dailyTotals();
    if (reports.length === 0) return;

    const chartDefaults = {
      color: 'rgba(255,255,255,0.7)',
      gridColor: 'rgba(255,255,255,0.06)',
      tickColor: 'rgba(255,255,255,0.4)',
    };

    // ---- Chart 1: Hours per employee (horizontal bar) ----
    const empCtx = this.employeeChartRef.nativeElement.getContext('2d')!;
    this.empChart = new Chart(empCtx, {
      type: 'bar',
      data: {
        labels: reports.map(r => r.full_name),
        datasets: [{
          label: 'Horas',
          data: reports.map(r => +(r.total_minutes / 60).toFixed(2)),
          backgroundColor: reports.map((_, i) => {
            const colors = ['rgba(0,122,255,0.75)', 'rgba(52,199,89,0.75)',
              'rgba(175,82,222,0.75)', 'rgba(255,149,0,0.75)',
              'rgba(255,59,48,0.75)', 'rgba(90,200,250,0.75)'];
            return colors[i % colors.length];
          }),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const mins = Math.round((ctx.raw as number) * 60);
                return ` ${this.minutesToLabel(mins)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: chartDefaults.gridColor },
            ticks: { color: chartDefaults.tickColor, callback: (v) => `${v}h` },
            border: { display: false }
          },
          y: {
            grid: { display: false },
            ticks: { color: chartDefaults.color },
            border: { display: false }
          }
        }
      }
    });

    // ---- Chart 2: Daily evolution (line) ----
    const dayCtx = this.dailyChartRef.nativeElement.getContext('2d')!;
    this.dayChart = new Chart(dayCtx, {
      type: 'line',
      data: {
        labels: daily.map(d => d.label),
        datasets: [{
          label: 'Horas equipo',
          data: daily.map(d => +(d.total_minutes / 60).toFixed(2)),
          borderColor: 'rgba(0,122,255,0.9)',
          backgroundColor: 'rgba(0,122,255,0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: 'rgba(0,122,255,1)',
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const mins = Math.round((ctx.raw as number) * 60);
                return ` ${this.minutesToLabel(mins)} totales`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: chartDefaults.gridColor },
            ticks: { color: chartDefaults.tickColor, maxRotation: 45 },
            border: { display: false }
          },
          y: {
            grid: { color: chartDefaults.gridColor },
            ticks: { color: chartDefaults.tickColor, callback: (v) => `${v}h` },
            border: { display: false }
          }
        }
      }
    });
  }

  private minutesToLabel(mins: number): string {
    const m = Math.round(mins);
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${rem}m`;
  }

  private destroyCharts() {
    this.empChart?.destroy();
    this.dayChart?.destroy();
    this.empChart = null;
    this.dayChart = null;
  }

  ngOnDestroy() {
    this.destroyCharts();
  }
}
