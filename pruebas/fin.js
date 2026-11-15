const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
(async () => { const b = await chromium.launch(); const ana = await ctx(b, 'ana@demo.com'), dir = await ctx(b, 'demo@demo.com');
  await req(ana, 'POST', '/api/portal/fichaje', { action: 'entrar' }); await ana.reload(); await ana.waitForSelector('text=Empezar a llamar'); console.log('recién fichada: puede llamar; clock.hours =', (await req(ana, 'GET', '/api/leads'))[1].clock.hours);
  await ana.click('text=Empezar a llamar'); await ana.waitForSelector('.call-card');
  const sh = (await req(dir, 'GET', '/api/portal/fichaje?usuario=todos'))[1].shifts.find(s => s.user === 'ana@demo.com' && !s.end);
  await req(dir, 'PATCH', '/api/portal/fichaje', { id: sh.id, start: new Date(Date.now() - (8 * 3600000 - 3 * 60000)).toISOString(), end: null, reason: 'Prueba fin de jornada' });
  await ana.waitForTimeout(21000); await ana.click('text=Actualizar'); await ana.waitForSelector('.toast:has-text("5 minutos")', { timeout: 8000 }); console.log('aviso:', await ana.locator('.toast').innerText());
  console.log('con lead en pantalla sigue pudiendo terminarlo:', await ana.locator('.call-card').count() === 1);
  await ana.click('.res:has-text("Ilocalizable")'); await ana.waitForSelector('.call-start h2'); console.log('tras guardar ->', await ana.locator('.call-start h2').innerText(), '|', await ana.locator('.call-start p').innerText());
  await ana.screenshot({ path: S + '/f-fin.png' }); await ana.click('.bell-btn'); console.log('campana:', await ana.$$eval('.bell-panel li', l => l.map(x => x.innerText.replace(/\n+/g, ' · ').slice(0, 80)))[0]);
  await dir.click('.tab:has-text("Equipo")'); await dir.waitForSelector('table'); console.log('Equipo, columna Jornada:', await dir.$$eval('tbody tr', r => r.slice(0, 2).map(x => x.children[4].innerText)));
  console.log('errores:', ana.errs, dir.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
