// Headless capture of scroll transitions over CDP. Usage (preview on 4331 running):
//   node scripts/capture.mjs <url> <out-prefix> <css-selector> [delays-ms=0,250,600,2500] [w=1440] [h=900]
// Scrolls the selector to 25% down the viewport, then screenshots <out-prefix>-<delay>.png per delay.
// HOVER=<selector> moves the mouse onto that element before capturing.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [,, url, out, selector, delays='0,250,600,2500', w='1440', h='900'] = process.argv;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', `--window-size=${w},${h}`, '--hide-scrollbars', '--user-data-dir=' + process.env.TEMP + '/cdp-prof', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) { try { const t = await (await fetch('http://127.0.0.1:9333/json')).json(); const p = t.find((x) => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
await send('Page.navigate', { url });
await sleep(2500);
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
// scroll in small steps like a reader, ending with the selector's top ~25% down the viewport
await ev(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});const end=el.getBoundingClientRect().top+scrollY-innerHeight*0.25;for(let y=scrollY;y<end;y+=120){scrollTo(0,y);await new Promise(r=>requestAnimationFrame(()=>r()));}scrollTo(0,end);})()`);
if (process.env.HOVER) { await sleep(2600); const r = await ev(`(()=>{const b=document.querySelector(${JSON.stringify(process.env.HOVER)}).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`); await sleep(2600); await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r[0],y:r[1]}); }
let last = 0;
for (const d of delays.split(',').map(Number)) {
  await sleep(d - last); last = d;
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${out}-${d}.png`, Buffer.from(shot.data, 'base64'));
}
console.log(await ev(`JSON.stringify([...document.querySelectorAll('[data-reveal]')].map(s=>(s.id||s.className.slice(0,10))+':'+s.dataset.reveal))`));
ws.close(); chrome.kill();
