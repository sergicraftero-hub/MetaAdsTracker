const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
async function ctx(b, email, opts) { const c = await b.newContext({ locale: 'es-ES', timezoneId: 'Europe/Madrid', ...opts }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
// simula que la app pasa a segundo plano (el marcador del teléfono) durante `ms`
const away = async (p, ms) => { await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(ms); await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }); };
const phoneOf = p => p.locator('.call-card .lead-name + p').innerText();
const next = async (p, cur) => p.waitForFunction(n => { const e = document.querySelector('.call-card .lead-name + p'); return !e || e.innerText !== n; }, cur, { timeout: 10000 });
(async () => { const b = await chromium.launch();
  const m = await ctx(b, 'ana@demo.com', devices['iPhone 13']); await m.route('tel:*', r => r.abort()); await req(m, 'POST', '/api/portal/fichaje', { action: 'entrar' }); await m.reload(); await m.click('text=Empezar a llamar'); await m.waitForSelector('.call-card');
  // 1) llamada real desde el móvil: 4 s fuera de la app
  let cur = await phoneOf(m); await m.evaluate(() => document.querySelector('.call-card a.btn.primary').addEventListener('click', e => e.preventDefault())); await m.click('.call-card a.btn.primary'); await away(m, 4000); await m.click('.res:has-text("Ilocalizable")'); await next(m, cur);
  // 2) marca resultado sin pulsar Llamar
  cur = await phoneOf(m); await m.click('.res:has-text("Ilocalizable")'); await next(m, cur);
  // 3) pulsa Llamar y vuelve en 1 s
  cur = await phoneOf(m); await m.evaluate(() => document.querySelector('.call-card a.btn.primary').addEventListener('click', e => e.preventDefault())); await m.click('.call-card a.btn.primary'); await away(m, 1100); await m.click('.res:has-text("Ilocalizable")'); await next(m, cur);
  await m.click('.tab:has-text("Agenda")');
  // 4) llamada pedida desde el ordenador y aceptada en el móvil
  const d = await ctx(b, 'ana@demo.com', { viewport: { width: 1280, height: 860 } }); await d.click('text=Empezar a llamar'); await d.waitForSelector('.call-card'); const dcur = await phoneOf(d);
  await d.click('.call-card button:has-text("Llamar")'); await m.waitForSelector('[role=alertdialog]', { timeout: 9000 }); await m.evaluate(() => document.querySelector('[role=alertdialog] a').addEventListener('click', e => e.preventDefault())); await m.click('[role=alertdialog] a'); await away(m, 3000); await m.waitForTimeout(600);
  await d.click('.res:has-text("Ilocalizable")'); await next(d, dcur);
  const log = (await req(d, 'GET', '/api/llamadas?dias=1'))[1].calls.filter(c => !c.id.startsWith('log-') || Number(c.id.split('-')[1]) > 99).slice(-4);
  console.log('registro:', log.map(c => ({ llamo: c.called, fuera: c.away, tel: c.phone.slice(0, 6) + '…', origen: c.source })));
  // dirección
  const a = await ctx(b, 'demo@demo.com', { viewport: { width: 1280, height: 900 } }); await a.click('.tab:has-text("Panel")'); await a.waitForSelector('.calllist tbody tr'); await a.locator('.calllist').scrollIntoViewIfNeeded();
  const flags = await a.$$eval('.calllist tbody tr', r => r.slice(0, 4).map(x => [x.children[1].innerText.split(' ')[0], x.children[5].innerText, x.children[4].innerText.replace(/\n/g, ' ')]));
  console.log('lista (últimas 4):', JSON.stringify(flags)); console.log('tiles:', await a.$$eval('.inner-tiles .tile', t => t.slice(-2).map(x => x.innerText.replace(/\n/g, ' | '))));
  await a.check('.calllist .small-check input'); await a.waitForTimeout(200); console.log('solo para revisar:', await a.locator('.calllist tbody tr').count(), 'filas |', await a.locator('.calllist .small-check').innerText());
  await a.screenshot({ path: S + '/a-registro.png', fullPage: true }); await a.locator('.calllist .inline-link').first().click(); await a.waitForSelector('.sheet'); console.log('clic en lead abre ficha: true | errores:', m.errs, d.errs, a.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
