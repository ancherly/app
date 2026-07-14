import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GymSettingsService, GymSettings } from '../../core/services/gym-settings.service';
import { GeoService } from '../../core/services/geo.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1 class="page-title">Configuración</h1>
        <p class="page-subtitle">Gestiona la localización madre y el radio de fichaje</p>
      </div>

      <!-- Localización Madre card -->
      <div class="card">
        <div class="card-header">
          <div class="card-header-left">
            <span class="card-title">Localización Madre</span>
            <p class="card-desc">Coordenadas centrales del gimnasio. Los fichajes se validan contra esta posición.</p>
          </div>
          <div class="header-badges">
            <span class="setting-badge geofencing">GEOFENCING</span>
            <span class="setting-badge gps">GPS</span>
          </div>
        </div>

        @if (success()) {
          <div class="success-banner" data-testid="settings-success">
            <i class="fas fa-circle-check"></i> {{ success() }}
          </div>
        }
        @if (error()) {
          <div class="error-banner" data-testid="settings-error">
            <i class="fas fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        <form (ngSubmit)="saveSettings()" class="settings-form">

          <!-- Info box -->
          <div class="info-box">
            <i class="fas fa-location-crosshairs"></i>
            <div>
              <strong>Punto central de referencia</strong>
              <p>Define el punto GPS del gimnasio. Solo podrán fichar los empleados que estén dentro del radio configurado respecto a esta ubicación.</p>
            </div>
          </div>

          <div class="coords-grid">
            <div class="form-group">
              <label class="form-label">Latitud *</label>
              <input
                class="form-input"
                [(ngModel)]="form.latitude"
                name="latitude"
                type="number"
                step="0.000001"
                placeholder="ej: 40.416775"
                required
                data-testid="latitude-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Longitud *</label>
              <input
                class="form-input"
                [(ngModel)]="form.longitude"
                name="longitude"
                type="number"
                step="0.000001"
                placeholder="ej: -3.703790"
                required
                data-testid="longitude-input"
              />
            </div>
          </div>

          <div class="form-group radius-group">
            <label class="form-label">
              Radio de geofencing:
              <strong class="radius-value">{{ form.radius_meters }}m</strong>
            </label>
            <input
              class="radius-slider"
              [(ngModel)]="form.radius_meters"
              name="radius_meters"
              type="range"
              min="50"
              max="2000"
              step="50"
              data-testid="radius-slider"
            />
            <div class="radius-labels">
              <span>50m (estricto)</span>
              <span>2000m (amplio)</span>
            </div>
          </div>

          <div class="btn-row">
            <button
              type="button"
              class="btn btn-ghost"
              (click)="useMyLocation()"
              [disabled]="locating()"
              data-testid="use-my-location-button"
            >
              @if (locating()) { <span class="spinner"></span> }
              @else { <i class="fas fa-location-dot"></i> }
              Usar mi ubicación actual
            </button>

            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="saving()"
              data-testid="save-settings-button"
            >
              @if (saving()) { <span class="spinner"></span> }
              @else { <i class="fas fa-floppy-disk"></i> }
              Guardar localización
            </button>
          </div>
        </form>
      </div>

      <!-- Configuración actual -->
      @if (settings()) {
        <div class="card" data-testid="current-settings-card">
          <div class="card-header">
            <span class="card-title">Configuración Actual</span>
            <span class="live-badge"><i class="fas fa-circle"></i> EN USO</span>
          </div>
          <div class="config-grid">
            <div class="config-item">
              <span class="config-label">LATITUD (N/S)</span>
              <span class="config-value" data-testid="current-latitude">{{ settings()!.latitude ?? 'No configurada' }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">LONGITUD (E/O)</span>
              <span class="config-value" data-testid="current-longitude">{{ settings()!.longitude ?? 'No configurada' }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">RADIO MÁXIMO</span>
              <span class="config-value" data-testid="current-radius">{{ settings()!.radius_meters }}m</span>
            </div>
            <div class="config-item">
              <span class="config-label">ZONA HORARIA</span>
              <span class="config-value">{{ settings()!.timezone }}</span>
            </div>
          </div>

          <!-- Maps link -->
          @if (settings()!.latitude && settings()!.longitude) {
            <div class="maps-link-row">
              <a
                [href]="'https://maps.google.com/?q=' + settings()!.latitude + ',' + settings()!.longitude"
                target="_blank"
                rel="noopener"
                class="btn btn-ghost btn-sm maps-link"
              >
                <i class="fas fa-map-location-dot"></i>
                Ver en Google Maps
              </a>
            </div>
          }
        </div>
      }

      <!-- Cierre automático -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Cierre Automático</span>
          <span class="setting-badge active">ACTIVO</span>
        </div>
        <div class="auto-close-info">
          <div class="info-row">
            <i class="fas fa-clock"></i>
            <div>
              <strong>23:59:59 — Europe/Madrid</strong>
              <p>Todos los fichajes abiertos se cierran automáticamente cada día a las 23:59:59. Los registros cerrados por el sistema aparecen en <span class="dot-inline dot-auto"></span> rojo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; }

    .card-header-left { flex: 1; }
    .card-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .header-badges { display: flex; gap: 6px; flex-shrink: 0; }

    .setting-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .setting-badge.geofencing {
      background: rgba(0,122,255,0.15);
      color: var(--accent-blue);
      border: 1px solid rgba(0,122,255,0.3);
    }
    .setting-badge.gps {
      background: rgba(16,185,129,0.15);
      color: var(--status-green);
      border: 1px solid rgba(16,185,129,0.3);
    }
    .setting-badge.active {
      background: rgba(16,185,129,0.15);
      color: var(--status-green);
      border: 1px solid rgba(16,185,129,0.3);
    }

    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 4px 10px;
      border-radius: 4px;
      background: rgba(16,185,129,0.15);
      color: var(--status-green);
      border: 1px solid rgba(16,185,129,0.3);

      i { font-size: 0.5rem; animation: pulse 1.5s ease infinite; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: var(--radius);
      color: var(--status-green);
      font-size: 0.875rem;
      margin-bottom: 16px;
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

    .settings-form { display: flex; flex-direction: column; gap: 20px; }

    .info-box {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 0.875rem;
      color: var(--text-secondary);

      i { color: var(--accent-blue); flex-shrink: 0; margin-top: 2px; font-size: 1.1rem; }
      strong { display: block; color: var(--text-primary); margin-bottom: 4px; }
    }

    .coords-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .radius-group {}
    .radius-value { color: var(--accent-blue); }
    .radius-slider {
      width: 100%;
      margin-top: 8px;
      accent-color: var(--accent-blue);
      height: 6px;
    }
    .radius-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .btn-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    /* Config display */
    .config-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .config-item {
      background: var(--bg-elevated);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .config-label {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
    }
    .config-value {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 900;
      color: var(--text-primary);
    }

    .maps-link-row {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .maps-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
    }

    /* Cierre automático */
    .auto-close-info { padding-top: 4px; }
    .info-row {
      display: flex;
      gap: 12px;
      font-size: 0.875rem;
      color: var(--text-secondary);

      i { color: var(--accent-blue); flex-shrink: 0; margin-top: 2px; }
      strong { display: block; color: var(--text-primary); margin-bottom: 4px; }
    }

    .dot-inline {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      vertical-align: middle;
    }
    .dot-auto { background: var(--status-red); }

    @media (max-width: 600px) {
      .coords-grid { grid-template-columns: 1fr; }
      .config-grid { grid-template-columns: repeat(2, 1fr); }
      .header-badges { display: none; }
    }
  `]
})
export class AdminSettingsComponent implements OnInit {
  private settingsService = inject(GymSettingsService);
  private geoService = inject(GeoService);

  settings = signal<GymSettings | null>(null);
  saving = signal(false);
  locating = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  form = { latitude: 40.416775, longitude: -3.703790, radius_meters: 100 };

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const s = await this.settingsService.getSettings();
      this.settings.set(s);
      if (s.latitude !== null && s.longitude !== null) {
        this.form.latitude = s.latitude;
        this.form.longitude = s.longitude;
        this.form.radius_meters = s.radius_meters;
      }
    } catch (e) { console.error(e); }
  }

  async useMyLocation() {
    this.locating.set(true);
    this.error.set(null);
    try {
      const pos = await this.geoService.getCurrentPosition();
      this.form.latitude = pos.latitude;
      this.form.longitude = pos.longitude;
    } catch (e: any) {
      this.error.set(e.message || 'No se pudo obtener la ubicación');
    } finally {
      this.locating.set(false);
    }
  }

  async saveSettings() {
    this.saving.set(true);
    this.success.set(null);
    this.error.set(null);
    try {
      const updated = await this.settingsService.updateSettings({
        latitude: this.form.latitude,
        longitude: this.form.longitude,
        radius_meters: this.form.radius_meters
      });
      this.settings.set(updated);
      this.success.set('✅ Localización madre guardada correctamente');
      setTimeout(() => this.success.set(null), 4000);
    } catch (e: any) {
      this.error.set(e?.message || 'Error al guardar la configuración');
    } finally {
      this.saving.set(false);
    }
  }
}
