import assert from 'node:assert/strict'
import { chmod, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createServer } from 'vite'

test('sync exposes completed data updates before the process exits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'garmin-sync-test-'))
  const fakePython = join(directory, 'fake-python')
  const previousPython = process.env.GARMIN_PYTHON
  await writeFile(fakePython, '#!/bin/sh\nprintf SYNC_DATA_\nsleep 1\nprintf "UPDATED\\n"\nsleep 1\nprintf "SYNC_DATA_UPDATED\\n"\nsleep 1\n')
  await chmod(fakePython, 0o700)
  process.env.GARMIN_PYTHON = fakePython
  let server
  let request
  try {
    server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' })
    await server.listen()
    const base = `http://127.0.0.1:${server.httpServer.address().port}`
    const status = async () => {
      const response = await fetch(`${base}/api/sync-status`)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      return response.json()
    }
    const waitForRevision = async revision => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const current = await status()
        if (current.syncing && current.dataRevision === revision) return current
        await delay(50)
      }
      assert.fail(`Revision ${revision} did not arrive`)
    }

    assert.deepEqual(await status(), { syncing: false, dataRevision: 0 })
    request = fetch(`${base}/api/sync`, { method: 'POST' })
    const started = await waitForRevision(0)
    assert.equal(started.syncing, true)
    assert.equal((await waitForRevision(1)).syncing, true)
    assert.equal((await waitForRevision(2)).syncing, true)
    assert.equal((await (await request).json()).ok, true)
    assert.deepEqual(await status(), { syncing: false, dataRevision: 2 })
  } finally {
    if (request) await request.catch(() => {})
    if (server) await server.close()
    if (previousPython === undefined) delete process.env.GARMIN_PYTHON
    else process.env.GARMIN_PYTHON = previousPython
    await unlink(fakePython)
    await rmdir(directory)
  }
})
