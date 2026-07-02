import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'garmin-sync-api',
      configureServer(server) {
        const settingsPath = resolve(__dirname, 'public/data/settings.json')

        // GET /api/settings — read settings file
        server.middlewares.use('/api/settings', (req, res) => {
          if (res.headersSent) return
          const CT = { 'Content-Type': 'application/json' }
          if (req.method === 'GET') {
            let content = '{}'
            try { content = readFileSync(settingsPath, 'utf-8') } catch { /* no file yet */ }
            res.writeHead(200, CT).end(content)
          } else if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              if (res.headersSent) return
              try {
                const parsed = JSON.parse(body)
                writeFileSync(settingsPath, JSON.stringify(parsed, null, 2))
                res.writeHead(200, CT).end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.writeHead(400, CT).end(JSON.stringify({ error: String(e) }))
              }
            })
          } else {
            res.writeHead(405, CT).end(JSON.stringify({ error: 'Method not allowed' }))
          }
        })

        // POST /api/sync — run sync.py
        server.middlewares.use('/api/sync', (req, res) => {
          if (res.headersSent) return
          const CT = { 'Content-Type': 'application/json' }
          if (req.method !== 'POST') {
            res.writeHead(405, CT).end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const scriptPath = resolve(__dirname, 'fetch/sync.py')
          let proc
          try {
            proc = spawn(process.env.GARMIN_PYTHON ?? 'python3', [scriptPath], {
              cwd: resolve(__dirname),
              env: { ...process.env },
            })
          } catch (e) {
            res.writeHead(500, CT).end(JSON.stringify({ ok: false, log: `Spawn failed: ${String(e)}` }))
            return
          }

          const lines: string[] = []
          proc.stdout.on('data', (d) => lines.push(d.toString()))
          proc.stderr.on('data', (d) => lines.push(d.toString()))
          proc.on('error', (e) => {
            if (res.headersSent) return
            res.writeHead(500, CT)
            res.end(JSON.stringify({ ok: false, log: `Spawn error: ${String(e)}` }))
          })

          proc.on('close', (code) => {
            if (res.headersSent) return
            res.writeHead(code === 0 ? 200 : 500, CT)
            res.end(JSON.stringify({ ok: code === 0, log: lines.join('') }))
          })
        })

        // POST /api/import-settings — fetch physiological data from Garmin
        server.middlewares.use('/api/import-settings', (req, res) => {
          if (res.headersSent) return
          const CT = { 'Content-Type': 'application/json' }
          if (req.method !== 'POST') {
            res.writeHead(405, CT).end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const scriptPath = resolve(__dirname, 'fetch/import_settings.py')
          let proc
          try {
            proc = spawn(process.env.GARMIN_PYTHON ?? 'python3', [scriptPath], {
              cwd: resolve(__dirname),
              env: { ...process.env },
            })
          } catch (e) {
            res.writeHead(500, CT).end(JSON.stringify({ error: `Spawn failed: ${String(e)}` }))
            return
          }

          let stdout = ''
          let stderr = ''
          proc.stdout.on('data', (d) => { stdout += d.toString() })
          proc.stderr.on('data', (d) => { stderr += d.toString() })
          proc.on('error', (e) => {
            if (res.headersSent) return
            res.writeHead(500, CT).end(JSON.stringify({ error: `Spawn error: ${String(e)}` }))
          })

          proc.on('close', (code) => {
            if (res.headersSent) return
            try {
              const data = JSON.parse(stdout)
              res.writeHead(code === 0 ? 200 : 500, CT).end(JSON.stringify(data))
            } catch {
              res.writeHead(500, CT).end(JSON.stringify({ error: stderr || 'Parse error' }))
            }
          })
        })
      },
    },
  ],
})
