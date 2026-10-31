import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function browser() {
  const executable = process.env.CHROME_BIN || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome',
    '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync)
  if (!executable) throw new Error('Set CHROME_BIN to an installed Chrome executable')
  const port = Number(process.env.CHROME_DEBUG_PORT || 9351)
  await mkdir('.preview', { recursive: true })
  const chrome = spawn(executable, ['--headless=new', '--disable-extensions', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.resolve('.preview/effects-test-browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let tabs
  for (let i = 0; i < 40; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await wait(250) } }
  if (!tabs) { chrome.kill(); throw new Error('Chrome did not start') }
  const ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  let id = 0
  const pending = new Map(), errors = []
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const task = pending.get(message.id); pending.delete(message.id)
      if (task) clearTimeout(task.timer)
      if (message.error) task?.reject(message.error); else task?.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description))
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Chrome timed out: ${method}`)) }, 45000)
    pending.set(key, { resolve, reject, timer })
    ws.send(JSON.stringify({ id: key, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await send('Runtime.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  return { send, evaluate, errors,
    capture: async name => { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(`.preview/${name}.png`, Buffer.from(shot.data, 'base64')) },
    close: async () => { ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); await wait(100); ws.close(); chrome.kill() },
  }
}
