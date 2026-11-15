const { chromium, devices } = require('playwright');
const B = process.env.BASE || 'http://localhost:3100', S = process.argv[2];
const log = (...a) => console.log(...a);
async function login(page, email, pw) {
  await page.goto(B + '/login'); await page.fill('input[type=email]', email); await page.fill('input[type=password]', pw);
  await page.click('button.primary'); await page.waitForSelector('.shell');
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage(); await page.addLocatorHandler(page.locator('.code-modal'), async () => { await page.locator('.code-modal .btn').click(); });
  const errs = []; page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/'); log('redirect unauth ->', page.url());
  await page.screenshot({ path: S + '/login.png' });
  await login(page, 'demo@demo.com', 'demo');
  await page.click('.tab:has-text("Hoy")'); await page.waitForSelector('.row'); await page.screenshot({ path: S + '/hoy.png' });
  // abrir primer lead nuevo y registrar intento
  const sec = page.locator('section', { hasText: 'Leads nuevos sin contactar' });
  const name = await sec.locator('.row strong').first().innerText();
  await sec.locator('.row-main').first().click(); await page.waitForSelector('.sheet');
  await page.click('text=No contesta'); await page.waitForSelector('.toast');
  log('toast:', await page.locator('.toast').innerText());
  await page.click('text=Mañana 10:00'); await page.waitForTimeout(600);
  await page.fill('.sheet textarea', 'Prefiere que le llamen por la tarde'); await page.locator('.sheet textarea').blur(); await page.waitForTimeout(600);
  await page.screenshot({ path: S + '/ficha.png' });
  const d = await page.evaluate(() => fetch('/api/leads').then(r => r.json()));
  const l = d.leads.find(x => x.f.nombre === name && x.f.intento1);
  log('lead tras intento:', JSON.stringify({ estado: l.f.estado, i1: l.f.intento1, n: l.f.intentos, fc: l.f.fechaContacto, re: l.f.rellamada, com: l.f.comentarios, comercial: l.f.comercial }));
  await page.keyboard.press('Escape'); await page.waitForSelector('.sheet', { state: 'detached' });
  for (const t of ['Leads', 'Embudo', 'Panel', 'Equipo']) { await page.click(`.tab:has-text("${t}")`); await page.waitForTimeout(500); await page.screenshot({ path: `${S}/${t.toLowerCase()}.png`, fullPage: t === 'Panel' }); }
  // crear usuario
  await page.fill('.newuser input >> nth=0', 'Marta Prueba'); await page.fill('.newuser input[type=email]', 'marta@demo.com');
  await page.fill('.newuser input[list=codes]', 'LUIS'); await page.fill('.newuser input[minlength="8"]', 'secreto123'); await page.click('text=Crear usuario');
  await page.waitForSelector('td:has-text("marta@demo.com")'); log('usuario creado ok');
  // comercial
  const c2 = await b.newContext({ ...devices['iPhone 13'] }); const p2 = await c2.newPage(); await p2.addLocatorHandler(p2.locator('.code-modal'), async () => { await p2.locator('.code-modal .btn').click(); });
  p2.on('pageerror', e => errs.push('m:' + e));
  await login(p2, 'ana@demo.com', 'demo'); await p2.click('.tab:has-text("Hoy")'); await p2.waitForSelector('.row'); await p2.screenshot({ path: S + '/m-hoy.png' });
  const d2 = await p2.evaluate(() => fetch('/api/leads').then(r => r.json()));
  log('comercial ve', d2.leads.length, 'de', d.leads.length, '| comerciales distintos:', [...new Set(d2.leads.map(x => x.f.comercial))]);
  const other = d.leads.find(x => x.f.comercial === 'LUIS'), free = d2.leads.find(x => !x.f.comercial);
  const st = await p2.evaluate(async ([o, f]) => {
    const j = (u, m, b) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.status);
    return { ajeno: await j('/api/leads/' + o, 'PATCH', { fields: { estado: 'FIMADO' } }), reasignar: await j('/api/leads/' + f, 'PATCH', { fields: { comercial: 'LUIS' } }),
      quedarselo: await j('/api/leads/' + f, 'PATCH', { fields: { comercial: 'ANA' } }), users: (await fetch('/api/users')).status, status: (await fetch('/api/status')).status };
  }, [other.id, free.id]); log('permisos comercial:', JSON.stringify(st));
  await p2.locator('.row-main').first().click(); await p2.waitForSelector('.sheet'); await p2.screenshot({ path: S + '/m-ficha.png' });
  await p2.goBack(); await p2.waitForSelector('.sheet', { state: 'detached' }); log('atrás cierra ficha ok');
  await p2.click('.tab:has-text("Embudo")'); await p2.waitForTimeout(400); await p2.screenshot({ path: S + '/m-embudo.png' });
  await p2.click('.tab:has-text("Panel")'); await p2.waitForTimeout(400); await p2.screenshot({ path: S + '/m-panel.png' });
  log('overflow-x móvil:', await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  log('errores consola:', errs);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
