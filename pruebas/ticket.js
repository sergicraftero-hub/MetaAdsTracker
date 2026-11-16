// Petición de corrección de un fichaje: la abre el trabajador, le llega a dirección, y se cierra al corregir.
const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2] || __dirname + '/capturas';
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); });
  await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const ok = (name, cond, extra = '') => { console.log(cond ? 'bien ' : 'MAL  ', name, extra); if (!cond) process.exitCode = 1; };
(async () => { const b = await chromium.launch(); const ana = await ctx(b, 'ana@demo.com'), luis = await ctx(b, 'luis@demo.com'), dir = await ctx(b, 'demo@demo.com');
  await req(ana, 'POST', '/api/portal/fichaje', { action: 'entrar' }); await req(ana, 'POST', '/api/portal/fichaje', { action: 'salir' });
  await ana.reload(); await ana.click('.tab:has-text("Portal")'); await ana.waitForSelector('tbody >> text=Pedir corrección'); await ana.locator('tbody >> text=Pedir corrección').last().click();
  await ana.fill('.dialog textarea', 'Olvidé fichar la salida; salí a las 18:00'); await ana.click('.dialog .btn.primary'); await ana.waitForSelector('tbody .pill:has-text("Corrección pedida")'); await ana.screenshot({ path: S + '/k-pedida.png' });
  const mine = (await req(ana, 'GET', '/api/portal/fichaje'))[1].shifts.find(s => s.ticket); ok('el registro queda marcado y sin cambiar', !!mine && /18:00/.test(mine.ticket) && !mine.edits);
  ok('otro comercial no puede pedirla sobre un fichaje ajeno', (await req(luis, 'PUT', '/api/portal/fichaje', { id: mine.id, text: 'Cámbialo, por favor' }))[0] === 403);
  ok('el comercial no puede corregirlo él mismo', (await req(ana, 'PATCH', '/api/portal/fichaje', { id: mine.id, end: new Date().toISOString(), reason: 'yo mismo' }))[0] === 403);
  const av = (await req(dir, 'GET', '/api/portal/avisos'))[1]; ok('a dirección le llega el aviso', av.tickets.length === 1 && /18:00/.test(av.tickets[0].text), JSON.stringify(av.tickets[0]));
  ok('al comercial no le llegan peticiones', ((await req(luis, 'GET', '/api/portal/avisos'))[1].tickets ?? []).length === 0);
  await dir.reload(); await dir.click('.bell-btn'); await dir.waitForSelector('.bell-panel >> text=pide corregir'); await dir.screenshot({ path: S + '/k-campana.png' }); await dir.click('.bell-panel >> text=pide corregir');
  await dir.waitForSelector('.clock'); await dir.selectOption('.filters select', 'ana@demo.com'); await dir.waitForSelector('tbody .pill:has-text("Corrección pedida")'); await dir.locator('tr:has(.pill:has-text("Corrección pedida")) >> text=Corregir').click();
  await dir.waitForSelector('.modal .notice'); ok('dirección ve la petición al corregir', /18:00/.test(await dir.locator('.modal .notice').innerText())); await dir.screenshot({ path: S + '/k-corregir.png' });
  { const v = await dir.inputValue('.modal input >> nth=0'); const d = new Date(v); d.setHours(d.getHours() - 2); const z = n => String(n).padStart(2, '0'); await dir.fill('.modal input >> nth=0', `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`); }
  await dir.fill('.modal textarea', 'Salida real a las 18:00, según petición'); await dir.click('text=Guardar corrección'); await dir.waitForSelector('tbody .pill:has-text("Corregido")');
  const after = (await req(ana, 'GET', '/api/portal/fichaje'))[1].shifts.find(s => s.id === mine.id); ok('al corregir, la petición se cierra y queda en el historial', !after.ticket && /petición/.test(after.edits) && after.valid);
  ok('ya no hay aviso pendiente', (await req(dir, 'GET', '/api/portal/avisos'))[1].tickets.length === 0);
  console.log('errores:', ana.errs, dir.errs); if (ana.errs.length || dir.errs.length) process.exitCode = 1; await b.close(); })().catch(e => { console.error(e); process.exit(1); });
