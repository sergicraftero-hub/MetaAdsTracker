const { chromium, devices } = require('playwright'); const S = process.argv[2], PDF = process.argv[3], B = 'http://localhost:3100';
const out = (...a) => console.log(...a);
async function login(p, email) { await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); await p.evaluate(() => fetch('/api/portal/fichaje', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"entrar"}' })); await p.reload(); await p.waitForSelector('.shell'); }
(async () => { const b = await chromium.launch(); const errs = [];
  const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + e)); p.on('console', m => m.type() === 'error' && errs.push(tag + m.text())); };
  // ---- móvil: comercial ANA
  const mc = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const m = await mc.newPage(); await m.addLocatorHandler(m.locator('.code-modal'), async () => { await m.locator('.code-modal .btn').click(); }); watch(m, 'm:');
  await login(m, 'ana@demo.com'); await m.waitForSelector('.call-start'); await m.waitForSelector('.bonus');
  out('bonos inicio:', await m.$$eval('.bonus strong', e => e.map(x => x.innerText)));
  await m.click('text=Empezar a llamar'); await m.waitForSelector('.call-card');
  const seq = []; const id = () => m.locator('.call-card .lead-name + p').innerText();
  for (let i = 0; i < 7; i++) {
    const cur = await id(); seq.push((await m.locator('.call-bar .pill').innerText()).split(' · ')[0]);
    if (i === 1) { await m.fill('.call-card textarea', 'Quiere que le llamen por la tarde'); await m.click('.res:has-text("Rellamar")'); await m.click('text=Mañana 10:00'); await m.click('text=Guardar y siguiente'); }
    else if (i === 2) { await m.click('.res.won'); await m.waitForSelector('.sale-form select'); await m.selectOption('.sale-form select >> nth=0', 'ftv-600-60-n'); await m.setInputFiles('.sale-form input[type=file]', PDF); await m.waitForTimeout(1500); await m.click('text=Guardar venta y siguiente'); }
    else await m.click('.res:has-text("Ilocalizable")');
    await m.waitForFunction(n => { const e = document.querySelector('.call-card .lead-name + p'); return !e || e.innerText !== n; }, cur, { timeout: 8000 });
  }
  out('secuencia:', seq.join(' | '));
  const chk = await m.evaluate(async () => { const l = (await fetch('/api/leads').then(r => r.json())).leads; const res = {};
    for (const x of l.filter(x => x.f.intento1 && x.f.intento1.includes('/') && ['RELLAMAR', 'FIMADO'].includes(x.f.estado))) { const c = (await fetch(`/api/leads/${x.id}/comentarios`).then(r => r.json())).comments; if (c.length) res[x.f.estado] = [x.f.comercial, x.f.estadoContrato, x.f.comentarios, c.map(k => [k.text, k.files.map(f => f.name)])]; }
    return res; });
  out('notas en comentarios:', JSON.stringify(chk));
  await m.screenshot({ path: S + '/n-llamar.png', fullPage: true });
  await m.click('.tab:has-text("Agenda")'); await m.waitForSelector('.agenda-cal'); await m.click('.filters >> text=Lista'); await m.waitForSelector('.row'); await m.screenshot({ path: S + '/n-agenda-m.png' });
  const mias = await m.$$eval('.row', r => r.length); await m.click('.filters >> text=Lista'); await m.click('.filters >> text=Global'); await m.waitForTimeout(300);
  out('agenda mías / equipo:', mias, await m.$$eval('.row', r => r.length), '| dueños:', [...new Set(await m.$$eval('.row-sub', r => r.map(x => x.innerText.split(' · ').pop())))]);
  // un comercial puede editar la rellamada de otro (agenda compartida) pero no reasignarla
  out('permisos agenda:', JSON.stringify(await m.evaluate(async () => { const l = (await fetch('/api/leads').then(r => r.json())).leads; const o = l.find(x => x.f.comercial === 'LUIS' && x.f.rellamada);
    const j = (b) => fetch('/api/leads/' + o.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: b }) }).then(r => r.status);
    return { veDeLuis: !!o, soloConRellamada: l.filter(x => x.f.comercial === 'LUIS').every(x => x.f.rellamada), editar: await j({ whatsapp: true }), reasignar: await j({ comercial: 'ANA' }) }; })));
  // ---- ordenador: mismo usuario ANA pulsa Llamar -> aviso en el móvil
  const dc = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const d = await dc.newPage(); await d.addLocatorHandler(d.locator('.code-modal'), async () => { await d.locator('.code-modal .btn').click(); }); watch(d, 'd:');
  await login(d, 'ana@demo.com'); await d.click('.tab:has-text("Leads")'); await d.waitForSelector('.row');
  const target = await d.locator('.row strong').first().innerText(); await d.locator('.row .icon-btn').first().click(); await d.waitForSelector('.toast'); out('pc:', await d.locator('.toast').innerText());
  await m.waitForSelector('[role=alertdialog]', { timeout: 9000 }); out('móvil popup:', (await m.locator('[role=alertdialog] h2').innerText()) === target, await m.locator('[role=alertdialog] a').getAttribute('href'));
  await m.screenshot({ path: S + '/n-aviso.png' }); await m.click('[role=alertdialog] >> text=Ignorar'); await m.waitForTimeout(6000); out('popup no reaparece:', !(await m.$('[role=alertdialog]')));
  // ---- dirección
  const ac = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const a = await ac.newPage(); await a.addLocatorHandler(a.locator('.code-modal'), async () => { await a.locator('.code-modal .btn').click(); }); watch(a, 'a:');
  await login(a, 'demo@demo.com'); await a.click('.tab:has-text("Panel")'); await a.waitForSelector('.tile.hero'); await a.screenshot({ path: S + '/n-panel.png', fullPage: true });
  const hero = () => a.locator('.tile.hero').innerText().then(t => t.replace(/\n/g, ' | '));
  out('30d:', await hero()); await a.click('.seg >> text=Máximo'); out('max:', await hero());
  await a.click('.who-filter >> text=LUIS'); out('max LUIS:', await hero()); await a.click('.who-filter >> text=ANA'); out('max LUIS+ANA:', await hero());
  await a.click('.seg >> text=Periodo'); const t = new Date(); const iso = x => x.toISOString().slice(0, 10);
  await a.fill('.dates input >> nth=0', iso(new Date(t - 3 * 864e5))); await a.fill('.dates input >> nth=1', iso(t)); out('periodo 4 días:', await hero(), '| barras:', await a.$$eval('.daychart >> nth=0 >> .day', x => x.length));
  await a.click('.tab:has-text("Leads")'); await a.click('text=Asignar varios'); const boxes = a.locator('.pick'); for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await a.selectOption('.assign select', 'LUIS'); await a.screenshot({ path: S + '/n-asignar.png' }); await a.click('.assign button.primary'); await a.waitForSelector('.toast:has-text("asignados")'); out('bloque:', await a.locator('.toast').innerText());
  await a.click('.tab:has-text("Equipo")'); await a.waitForSelector('.bonus-admin li');
  await a.fill('.newuser >> nth=1 >> input >> nth=0', 'Bono de prueba'); await a.fill('.newuser >> nth=1 >> input[type=number]', '3'); await a.click('text=Crear bono'); await a.waitForSelector('.bonus-admin li:has-text("Bono de prueba")');
  out('bonos admin:', await a.$$eval('.bonus-admin li', l => l.map(x => x.innerText.replace(/\n+/g, ' ').slice(0, 90)))); await a.screenshot({ path: S + '/n-equipo.png', fullPage: true });
  await a.click('.tab:has-text("Leads")'); await a.locator('.row-main').first().click(); await a.waitForSelector('.sheet .notes'); await a.fill('.compose textarea', 'Nota desde la ficha'); await a.click('text=Guardar nota'); await a.waitForSelector('.thread li'); await a.screenshot({ path: S + '/n-ficha.png' });
  out('overflow móvil:', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)); out('errores:', errs); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
