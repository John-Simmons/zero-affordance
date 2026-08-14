/**
 * Drive the running dev server in a real browser and take screenshots.
 *
 * Exists so changes can be checked visually rather than reasoned about. Plain
 * `chrome --screenshot` can only capture a URL; anything behind a click — the
 * loading animations, the standings, dark mode — needs an actual session.
 *
 * Zero dependencies: talks the Chrome DevTools Protocol directly over Node's
 * built-in WebSocket, reusing the Chromium that Playwright already cached. That
 * keeps a debugging tool out of package.json and out of CI install time.
 *
 * Usage (note the flag — WebSocket is still experimental on Node 20):
 *
 *   node --experimental-websocket scripts/drive.mjs <url> [step...]
 *
 * Steps, applied in order:
 *
 *   click:TEXT     click the first button/link whose text contains TEXT
 *   wait:MS        pause
 *   shot:NAME      screenshot to .screenshots/NAME.png
 *   size:WxH       emulate a viewport, e.g. size:390x844 for a phone
 *   theme:dark     set the stored theme and reload (also theme:light)
 *   eval:JS        run JS in the page, print the result
 *
 * Example — walk into the first matchup and capture an animation mid-run:
 *
 *   node --experimental-websocket scripts/drive.mjs \
 *     http://localhost:5173/experiments/loading-perception \
 *     'click:Start the experiment' shot:intro \
 *     'click:Start matchup' wait:1200 shot:first-animation
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CHROME = join(
  homedir(),
  '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
)
const PORT = 9333
const OUT = '.screenshots'

if (typeof WebSocket === 'undefined') {
  console.error('No WebSocket. Re-run with: node --experimental-websocket ...')
  process.exit(1)
}
if (!existsSync(CHROME)) {
  console.error(`Chromium not found at ${CHROME}`)
  process.exit(1)
}

const [url, ...steps] = process.argv.slice(2)
if (!url) {
  console.error(
    'Usage: node --experimental-websocket scripts/drive.mjs <url> [step...]',
  )
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1280,1100',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

/** The debugging port isn't up the instant the process starts. */
async function targetUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const page = (await res.json()).find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // not listening yet
    }
    await sleep(100)
  }
  throw new Error('Chrome debugging port never opened')
}

const ws = new WebSocket(await targetUrl())
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

let nextId = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  const entry = pending.get(msg.id)
  if (!entry) return
  pending.delete(msg.id)
  if (msg.error) entry.reject(new Error(msg.error.message))
  else entry.resolve(msg.result)
})

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

/** Evaluate in the page and unwrap the value. */
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.text)
  return result.value
}

async function goto(target) {
  await send('Page.navigate', { url: target })
  // Settle: React has to mount and the initial query has to resolve.
  await sleep(1200)
}

/**
 * Click by visible text rather than by selector — the markup here is Tailwind
 * utility soup, so text is both more readable and more stable.
 */
const CLICK_BY_TEXT = (text) => `
  (() => {
    const needle = ${JSON.stringify(text)}.toLowerCase()
    const el = [...document.querySelectorAll('button, a, [role="button"]')]
      .find((n) => (n.textContent || '').toLowerCase().includes(needle))
    if (!el) return 'NOT_FOUND'
    el.click()
    return 'OK'
  })()
`

await send('Page.enable')
await send('Runtime.enable')
await mkdir(OUT, { recursive: true })
await goto(url)

for (const step of steps) {
  const idx = step.indexOf(':')
  const kind = idx === -1 ? step : step.slice(0, idx)
  const arg = idx === -1 ? '' : step.slice(idx + 1)

  if (kind === 'click') {
    const res = await evaluate(CLICK_BY_TEXT(arg))
    if (res === 'NOT_FOUND') {
      console.error(`  click:${arg} -> NOT FOUND`)
      process.exitCode = 1
    } else {
      console.log(`  click:${arg}`)
    }
    await sleep(350)
  } else if (kind === 'wait') {
    await sleep(Number(arg) || 0)
    console.log(`  wait:${arg}ms`)
  } else if (kind === 'shot') {
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    const file = join(OUT, `${arg || 'shot'}.png`)
    await writeFile(file, Buffer.from(data, 'base64'))
    console.log(`  shot -> ${file}`)
  } else if (kind === 'size') {
    // Tailwind's breakpoints key off width alone, but mobile is a height
    // problem here too: the matchup area is a fixed h-112 whatever the screen,
    // so a short viewport is what squeezes the panels. Both numbers matter.
    const [w, h] = arg.split('x').map(Number)
    if (!w || !h) {
      console.error(`  size:${arg} -> expected WxH`)
      process.exitCode = 1
    } else {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: true,
      })
      console.log(`  size:${w}x${h}`)
    }
  } else if (kind === 'theme') {
    // The provider reads localStorage on mount, so this needs a reload.
    await evaluate(`localStorage.setItem('za.theme', ${JSON.stringify(arg)})`)
    await goto(url)
    console.log(`  theme:${arg}`)
  } else if (kind === 'eval') {
    console.log(`  eval -> ${JSON.stringify(await evaluate(arg))}`)
  } else {
    console.error(`  unknown step: ${step}`)
    process.exitCode = 1
  }
}

ws.close()
chrome.kill()
