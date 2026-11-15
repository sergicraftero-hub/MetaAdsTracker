const { chromium, devices } = require('playwright'); const S = process.argv[2], B = 'http://localhost:3100';
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await ctx.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(B + '/login'); await p.fill('input[type=email]', 'ana@demo.com'); await p.fill('input[type=password]', 'demo'); await p.click('button.primary');
  await p.waitForSelector('.call-start'); await p.screenshot({ path: S + '/c-inicio.png' });
  await p.click('text=Empezar a llamar'); await p.waitForSelector('.call-card'); await p.screenshot({ path: S + '/c-lead.png', fullPage: true });
  const seq = [];
  const cur = async () => ({ src: (await p.locator('.call-bar .pill').innerText()).split(' · ')[0], name: await p.locator('.call-card .lead-name + p').innerText() });
  for (let i = 0; i < 9; i++) {
    const c = await cur(); seq.push(c.src);
    await p.waitForTimeout(1100);
    if (i === 3) { await p.fill('.call-card textarea', 'Llamar por la tarde'); await p.click('.res:has-text("Rellamar")'); await p.waitForSelector('.step'); await p.screenshot({ path: S + '/c-rellamar.png', fullPage: true }); await p.click('text=Mañana 10:00'); await p.click('text=Guardar y siguiente'); }
    else if (i === 5) { await p.click('.res.won'); await p.setInputFiles('.step input[type=file]', process.argv[3]); await p.click('text=Guardar y siguiente'); }
    else if (i === 6) await p.click('text=Saltar sin llamar');
    else await p.click('.res:has-text("Ilocalizable")');
    await p.waitForFunction(n => { const e = document.querySelector('.call-card .lead-name + p'); return !e || e.innerText !== n; }, c.name, { timeout: 8000 });
    if (!(await p.$('.call-card'))) { seq.push('FIN'); break; }
  }
  console.log('secuencia:', seq.join(' | '));
  const r = await p.evaluate(async () => { const [l, c] = await Promise.all([fetch('/api/leads').then(r => r.json()), fetch('/api/llamadas?dias=1').then(r => r.json())]);
    const mine = c.calls.filter(x => x.id.startsWith('log-1')).slice(-9);
    return { log: mine.map(x => [x.source, x.result, x.seconds, x.called]), firmado: l.leads.filter(x => x.contrato).map(x => [x.f.estado, x.f.estadoContrato, x.contrato, x.f.comercial]),
      rellamar: l.leads.filter(x => x.f.comentarios === 'Llamar por la tarde').map(x => [x.f.estado, x.f.rellamada, x.f.intento1, x.f.intentos, x.f.comercial]) }; });
  console.log(JSON.stringify(r));
  await p.click('.tab:has-text("Panel")'); await p.waitForSelector('.inner-tiles'); await p.screenshot({ path: S + '/c-panel-m.png', fullPage: true });
  console.log('overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const a = await c2.newPage(); await a.addLocatorHandler(a.locator('.code-modal'), async () => { await a.locator('.code-modal .btn').click(); });
  await a.goto(B + '/login'); await a.fill('input[type=email]', 'demo@demo.com'); await a.fill('input[type=password]', 'demo'); await a.click('button.primary');
  await a.waitForSelector('.call-start'); await a.click('.tab:has-text("Panel")'); await a.waitForSelector('.inner-tiles'); await a.screenshot({ path: S + '/c-panel.png' });
  await a.click('.seg button:has-text("7 días") >> nth=0'); await a.waitForSelector('.inner-tiles'); await a.waitForTimeout(300); await a.screenshot({ path: S + '/c-panel7.png' });
  await a.click('.tab:has-text("Llamar")'); await a.click('text=Empezar a llamar'); await a.waitForSelector('.call-card'); await a.screenshot({ path: S + '/c-lead-desktop.png' });
  console.log('errores', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
