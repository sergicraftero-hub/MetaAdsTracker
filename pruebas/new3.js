const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
async function ctx(b, email, opts) { const c = await b.newContext({ locale: 'es-ES', timezoneId: 'Europe/Madrid', ...opts }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
(async () => { const b = await chromium.launch(); const a = await ctx(b, 'ana@demo.com', { viewport: { width: 1280, height: 900 } });
  // ---- 5 intentos -> PERDIDO
  await req(a, 'POST', '/api/portal/fichaje', { action: 'entrar' }); const leads = (await req(a, 'GET', '/api/leads'))[1].leads; const L = leads.find(l => !l.f.estado && !l.f.comercial);
  const seq = []; for (let i = 0; i < 5; i++) { const r = (await req(a, 'POST', `/api/leads/${L.id}/llamada`, { fields: { estado: 'ILOCALIZABLE' }, shownAt: new Date().toISOString() }))[1].lead; seq.push(`${r.f.intentos}:${r.f.estado}`); }
  console.log('5 intentos sin localizar:', seq.join(' → '));
  const M = leads.find(l => !l.f.estado && !l.f.comercial && l.id !== L.id); const seq2 = []; for (let i = 0; i < 5; i++) { const r = (await req(a, 'POST', `/api/leads/${M.id}/llamada`, { fields: { estado: i === 4 ? 'CONTACTADO E INTERESADO' : 'ILOCALIZABLE' }, shownAt: new Date().toISOString() }))[1].lead; seq2.push(`${r.f.intentos}:${r.f.estado}`); }
  console.log('contesta al 5.º:', seq2[4]);
  // ---- mensajes preparados
  await a.reload(); await a.click('.tab:has-text("WhatsApp")'); await a.waitForSelector('.wa-list'); await a.locator('.chat-item').first().click(); await a.waitForSelector('.tpl-row .tag');
  console.log('plantillas:', await a.$$eval('.tpl-row .tag', x => x.map(e => e.innerText)));
  await a.click('.tpl-row .tag >> nth=0'); console.log('pegado (sin enviar):', JSON.stringify(await a.inputValue('.chat-row textarea')), '| mensajes enviados:', await a.locator('.msg.me:has-text("no he podido localizarte")').count());
  await a.screenshot({ path: S + '/t-plantilla.png' });
  await a.click('.tpl-row >> text=Mis mensajes'); await a.waitForSelector('.modal.wide'); await a.fill('.tpl-edit >> nth=0 >> textarea', 'Hola {nombre}! Soy {yo}, te llamé y no te pillé 🙂'); await a.screenshot({ path: S + '/t-editar.png' }); await a.click('.modal.wide >> text=Guardar'); await a.waitForSelector('.toast:has-text("guardados")');
  await a.fill('.chat-row textarea', ''); await a.click('.tpl-row .tag >> nth=0'); console.log('tras editar:', JSON.stringify(await a.inputValue('.chat-row textarea')));
  const l = await ctx(b, 'luis@demo.com', { viewport: { width: 1280, height: 900 } }); console.log('Luis sigue con las suyas:', (await req(l, 'GET', '/api/plantillas'))[1].templates[0].text.slice(0, 40), '| Ana guardadas:', (await req(a, 'GET', '/api/plantillas'))[1].saved);
  // ---- agenda calendario
  await a.click('.tab:has-text("Agenda")'); await a.waitForSelector('.agenda-cal'); await a.click('.filters >> text=Global'); await a.waitForTimeout(300);
  console.log('días con rellamadas:', await a.locator('.agenda-cal .cal-count').count(), '| atrasadas (rojo):', await a.locator('.agenda-cal .cal-count.late').count()); await a.screenshot({ path: S + '/t-agenda.png' });
  const chip = a.locator('.agenda-cal .chip[draggable]').first(); const name = (await chip.innerText()).trim(); const target = a.locator('.agenda-cal .cal-day:not(.out)').nth(27);
  await chip.dragTo(target); await a.waitForSelector('.toast:has-text("Guardado")'); console.log('arrastrada', JSON.stringify(name), '-> día destino ahora tiene:', await target.locator('.chip').allInnerTexts());
  const m = await ctx(b, 'ana@demo.com', devices['iPhone 13']); await m.click('.tab:has-text("Agenda")'); await m.waitForSelector('.agenda-cal'); await m.screenshot({ path: S + '/t-agenda-m.png' }); console.log('overflow móvil:', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), '| errores:', a.errs, l.errs, m.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
