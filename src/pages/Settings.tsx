import { useState } from 'react'
import { useActivityStore } from '../stores/activityStore'
import type { UserSettings } from '../types/garmin'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-800/80">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="divide-y divide-slate-700/40">{children}</div>
    </div>
  )
}

function FieldRow({
  label, hint, unit, value, min, max, onChange,
}: {
  label: string; hint?: string; unit: string
  value: number; min: number; max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-slate-200">{label}</div>
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
        <div className="flex items-center gap-1.5 ml-6 shrink-0">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 text-center tabular-nums focus:outline-none focus:border-primary transition-colors"
          />
          <span className="text-xs text-slate-500 w-8">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-blue-500 cursor-pointer"
        style={{ background: `linear-gradient(to right, var(--color-primary) ${((value - min) / (max - min)) * 100}%, #1e293b ${((value - min) / (max - min)) * 100}%)` }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-slate-600">{min}</span>
        <span className="text-xs text-slate-600">{max}</span>
      </div>
    </div>
  )
}

export default function Settings() {
  const settings = useActivityStore(s => s.settings)
  const updateSettings = useActivityStore(s => s.updateSettings)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleImport() {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch('/api/import-settings', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const partial: Partial<UserSettings> = {}
      if (data.maxHR) partial.maxHR = data.maxHR
      if (data.lthrRunning) partial.lthrRunning = data.lthrRunning
      if (Object.keys(partial).length > 0) {
        updateSettings(partial)
        const labels: Record<string, string> = { maxHR: 'FC Máx', lthrRunning: 'LTHR' }
        const imported = Object.keys(partial).map(k => `${labels[k]} = ${partial[k as keyof typeof partial]}`).join(', ')
        const warn = data.warnings?.length ? ` · ${data.warnings[0]}` : ''
        setImportMsg({ ok: true, text: `Importado: ${imported}${warn}` })
      } else {
        setImportMsg({ ok: false, text: data.warnings?.join('; ') || 'No se encontraron datos en Garmin' })
      }
    } catch (e) {
      setImportMsg({ ok: false, text: (e as Error).message })
    } finally {
      setImporting(false)
    }
  }

  function set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    updateSettings({ [key]: value })
  }

  const paceMin = Math.floor(settings.thresholdPace / 60)
  const paceSec = settings.thresholdPace % 60

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Ajustes</h1>
      <p className="text-sm text-slate-500 mb-6">Parámetros fisiológicos para el cálculo de zonas y TSS.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* Left: Physiology */}
        <Section title="Fisiología">
          <FieldRow
            label="FC Máxima"
            hint="Usada para calcular zonas Z1–Z5"
            unit="bpm"
            value={settings.maxHR}
            min={140} max={220}
            onChange={v => set('maxHR', v)}
          />
          <FieldRow
            label="FC Umbral Láctico · Running"
            hint="Suele ser el 87–93 % de FC máx"
            unit="bpm"
            value={settings.lthrRunning}
            min={120} max={200}
            onChange={v => set('lthrRunning', v)}
          />
          <FieldRow
            label="FTP · Ciclismo"
            hint="Potencia que mantienes ~1 hora"
            unit="W"
            value={settings.ftp}
            min={100} max={500}
            onChange={v => set('ftp', v)}
          />
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-slate-200">Ritmo en Umbral · Running</div>
                <div className="text-xs text-slate-500 mt-0.5">Ritmo láctico para calcular TSS</div>
              </div>
              <div className="flex items-center gap-1.5 ml-6 shrink-0">
                <input
                  type="number"
                  value={paceMin}
                  min={3} max={8}
                  onChange={e => set('thresholdPace', Number(e.target.value) * 60 + paceSec)}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 text-center tabular-nums focus:outline-none focus:border-primary transition-colors"
                />
                <span className="text-xs text-slate-500">:</span>
                <input
                  type="number"
                  value={String(paceSec).padStart(2, '0')}
                  min={0} max={59}
                  onChange={e => set('thresholdPace', paceMin * 60 + Number(e.target.value))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 text-center tabular-nums focus:outline-none focus:border-primary transition-colors"
                />
                <span className="text-xs text-slate-500">/km</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Right column */}
        <div className="space-y-4">

          {/* Appearance */}
          <Section title="Apariencia">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-700/40">
              <div className="text-sm font-medium text-slate-200">Tema</div>
              <div className="flex bg-slate-900 rounded-lg p-0.5 gap-0.5">
                {(['dark', 'light'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => set('theme', t)}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                      settings.theme === t ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-slate-200">Color primario</div>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: '#3b82f6', label: 'Azul' },
                    { color: '#6366f1', label: 'Índigo' },
                    { color: '#8b5cf6', label: 'Violeta' },
                    { color: '#ec4899', label: 'Rosa' },
                    { color: '#ef4444', label: 'Rojo' },
                    { color: '#f97316', label: 'Naranja' },
                    { color: '#eab308', label: 'Amarillo' },
                    { color: '#22c55e', label: 'Verde' },
                    { color: '#14b8a6', label: 'Turquesa' },
                    { color: '#64748b', label: 'Gris' },
                  ].map(({ color, label }) => (
                    <button
                      key={color}
                      title={label}
                      onClick={() => set('primaryColor', color)}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: color,
                        outline: settings.primaryColor === color ? `2px solid ${color}` : '2px solid transparent',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={e => set('primaryColor', e.target.value)}
                    title="Color personalizado"
                    className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full" style={{ background: settings.primaryColor }} />
                Color actual: <code className="text-slate-400">{settings.primaryColor}</code>
              </div>
            </div>
          </Section>

          {/* Import from Garmin */}
          <Section title="Importar desde Garmin">
            <div className="px-5 py-4">
              <p className="text-sm text-slate-400 mb-4">
                Importa automáticamente la FC máxima y el umbral láctico desde tu historial de Garmin Connect.
              </p>
              {importMsg && (
                <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs border ${
                  importMsg.ok
                    ? 'bg-green-950/40 border-green-800/50 text-green-300'
                    : 'bg-red-950/40 border-red-800/50 text-red-300'
                }`}>
                  {importMsg.text}
                </div>
              )}
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {importing ? 'Importando…' : 'Importar parámetros'}
              </button>
            </div>
          </Section>

          <p className="text-xs text-slate-600 px-1">
            Los ajustes se guardan en <code className="text-slate-500">public/data/settings.json</code> y afectan retroactivamente a todos los cálculos.
          </p>

        </div>
      </div>
    </div>
  )
}
