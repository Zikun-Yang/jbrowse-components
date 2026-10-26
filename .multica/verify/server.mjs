// Local dev-server control for manual/integration verification.
// Kept inside the worktree on purpose: the sandbox only allows paths under it.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.VERIFY_PORT ?? 3457)
const root = process.cwd()
const stateDir = path.join(root, '.multica', 'verify')
const pidFile = path.join(stateDir, 'server.pid')
const logFile = path.join(stateDir, 'server.log')

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs = 600_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) {
        return true
      }
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  return false
}

const logTail = (lines = 25) => {
  if (!fs.existsSync(logFile)) {
    return ''
  }
  return fs
    .readFileSync(logFile, 'utf8')
    .split('\n')
    .slice(-lines)
    .join('\n')
}

const command = process.argv[2] ?? 'status'

if (command === 'start') {
  fs.mkdirSync(stateDir, { recursive: true })
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))
    if (alive(pid)) {
      console.log(`already running pid=${pid} port=${PORT}`)
      process.exit(0)
    }
  }
  const log = fs.openSync(logFile, 'a')
  // `pnpm --filter` does not resolve in this sandbox, so run the product's own
  // start script directly: it is exactly what the package.json script runs.
  const child = spawn('node', ['scripts/start.ts'], {
    cwd: path.join(root, 'products', 'jbrowse-web'),
    detached: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      BROWSER: 'none',
    },
  })
  child.unref()
  fs.writeFileSync(pidFile, String(child.pid))
  console.log(`started pid=${child.pid} port=${PORT} log=${logFile}`)
  process.exit(0)
}

if (command === 'wait') {
  const timeoutMs = Number(process.argv[3] ?? 900) * 1000
  const started = Date.now()
  let ready = false
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) {
        ready = true
        break
      }
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, 5_000))
  }
  console.log(
    ready
      ? `ready url=http://localhost:${PORT}/ after ${Math.round((Date.now() - started) / 1000)}s`
      : `timeout after ${Math.round((Date.now() - started) / 1000)}s`,
  )
  console.log('--- server log tail ---')
  console.log(logTail())
  process.exit(ready ? 0 : 1)
}

if (command === 'stop') {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))
    if (alive(pid)) {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        process.kill(pid, 'SIGKILL')
      }
      console.log(`stopped pid=${pid}`)
    } else {
      console.log(`not running pid=${pid}`)
    }
    fs.rmSync(pidFile, { force: true })
  } else {
    console.log('no pid file')
  }
  process.exit(0)
}

if (command === 'status') {
  if (!fs.existsSync(pidFile)) {
    console.log('not started')
    process.exit(0)
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'))
  console.log(`pid=${pid} alive=${alive(pid)} port=${PORT}`)
  process.exit(0)
}
