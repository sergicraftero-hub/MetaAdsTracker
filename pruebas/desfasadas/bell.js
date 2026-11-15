const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
(async () => { const b = await chromium.launch(); const ana = await ctx(b, 'ana@demo.com'), dir = await ctx(b, 'demo@demo.com');
  await ana.waitForTimeout(1500); console.log('Ana al entrar:', await ana.locator('.badge').count() ? await ana.locator('.badge').innerText() : 0);
  // 1) rellamada de Ana que toca ahora
  const leads = (await req(ana, 'GET', '/api/leads'))[1].leads; const mine = leads.find(l => l.f.comercial === 'ANA' && l.f.estado && !['FIMADO'].includes(l.f.estado) && !l.f.rellamada && l.f.estado === 'RELLAMAR') || leads.find(l => l.f.comercial === 'ANA' && l.f.estado === 'ILOCALIZABLE');
  await req(ana, 'PATCH', '/api/leads/' + mine.id, { fields: { rellamada: new Date(Date.now() - 60000).toISOString(), estado: 'RELLAMAR' } });
  // 3) fichaje abierto hace 11 h
  await req(ana, 'POST', '/api/portal/fichaje', { action: 'entrar' }); const sh = (await req(dir, 'GET', '/api/portal/fichaje?usuario=todos'))[1].shifts.find(s => s.user === 'ana@demo.com' && !s.end);
  console.log('corrección:', (await req(dir, 'PATCH', '/api/portal/fichaje', { id: sh.id, start: new Date(Date.now() - 11 * 3600000).toISOString(), end: null, reason: 'Prueba de jornada larga' }))[0]);
  await ana.click('text=Actualizar'); await ana.reload(); await ana.waitForSelector('.badge'); await ana.click('.bell-btn'); await ana.waitForSelector('.bell-panel li');
  console.log('Ana:', await ana.locator('.badge').innerText(), await ana.$$eval('.bell-panel li', l => l.map(x => x.innerText.replace(/\n+/g, ' · ').slice(0, 90)))); await ana.screenshot({ path: S + '/s-campana-ana.png' });
  await ana.locator('.bell-panel .news').first().click(); await ana.waitForSelector('.sheet'); console.log('clic en rellamada abre la ficha:', await ana.locator('.sheet .lead-name').innerText() === mine.f.nombre);
  await dir.reload(); await dir.waitForSelector('.badge'); await dir.click('.bell-btn'); await dir.waitForSelector('.bell-panel li'); console.log('Dirección:', await dir.$$eval('.bell-panel li', l => l.map(x => x.innerText.replace(/\n+/g, ' · ').slice(0, 90))));
  console.log('pendientes WhatsApp de Ana:', (await req(ana, 'GET', '/api/whatsapp/pendientes'))[1].chats.map(c => [c.name, c.unread]), '| de dirección:', (await req(dir, 'GET', '/api/whatsapp/pendientes'))[1].chats.length);
  console.log('errores:', ana.errs, dir.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
