const { chromium } = require('playwright'); const B = 'http://localhost:3100';
async function ctx(b, email) { const c = await b.newContext(); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); await p.evaluate(() => fetch('/api/portal/fichaje', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"entrar"}' })); await p.reload(); await p.waitForSelector('.shell'); return p; }
const post = (p, url, body) => p.evaluate(([u, b]) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(async r => [r.status, (await r.json().catch(() => ({}))).error || '']), [url, body]);
(async () => { const b = await chromium.launch(); const [ana, luis, dir] = await Promise.all([ctx(b, 'ana@demo.com'), ctx(b, 'luis@demo.com'), ctx(b, 'demo@demo.com')]);
  const leads = (await dir.evaluate(() => fetch('/api/leads').then(r => r.json()))).leads; const free = leads.filter(l => !l.f.estado && !l.f.comercial); const L = free[0].id, M = free[1].id, N = free[2].id;
  console.log('a la vez (Ana, Luis, Dirección):', JSON.stringify(await Promise.all([post(ana, `/api/leads/${L}/reservar`), post(luis, `/api/leads/${L}/reservar`), post(dir, `/api/leads/${L}/reservar`)])));
  console.log('Ana repite (sigue siendo suyo):', JSON.stringify(await post(ana, `/api/leads/${L}/reservar`)));
  console.log('Dirección primero, luego Ana:', JSON.stringify([await post(dir, `/api/leads/${M}/reservar`), await post(ana, `/api/leads/${M}/reservar`)]));
  console.log('Dirección guarda resultado y libera:', JSON.stringify(await post(dir, `/api/leads/${M}/llamada`, { fields: { estado: 'ILOCALIZABLE' }, shownAt: new Date().toISOString() })));
  // rellamada compartida: dueño LUIS; Ana y Dirección no pueden cogerla a la vez
  const cb = leads.find(l => l.f.comercial === 'LUIS' && l.f.rellamada);
  console.log('rellamada de Luis, Ana y Dirección a la vez:', JSON.stringify(await Promise.all([post(ana, `/api/leads/${cb.id}/reservar`), post(dir, `/api/leads/${cb.id}/reservar`)])));
  // cola real en paralelo: nadie ve el mismo lead
  const start = async p => { await p.click('.tab:has-text("Llamar")'); await p.click('text=Empezar a llamar'); await p.waitForSelector('.call-card'); return p.locator('.call-card .lead-name + p').innerText(); };
  const seen = { ana: [], luis: [] };
  for (let i = 0; i < 6; i++) { const [a, l] = await Promise.all(i === 0 ? [start(ana), start(luis)] : [ana.locator('.call-card .lead-name + p').innerText(), luis.locator('.call-card .lead-name + p').innerText()]); seen.ana.push(a); seen.luis.push(l);
    await Promise.all([ana, luis].map(async (p, k) => { const cur = k ? l : a; await p.click('.res:has-text("Ilocalizable")'); await p.waitForFunction(n => { const e = document.querySelector('.call-card .lead-name + p'); return !e || e.innerText !== n; }, cur, { timeout: 10000 }); })); }
  console.log('leads distintos en paralelo:', seen.ana.length + seen.luis.length, '| repetidos entre los dos:', seen.ana.filter(x => seen.luis.includes(x)).length, '| lead N sin usar:', !!N); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
