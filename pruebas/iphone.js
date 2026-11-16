// Aviso de instalación en iPhone: sale en la pantalla de acceso, no en Android ni en ordenador, y no vuelve tras «Entendido».
const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2] || __dirname + '/capturas';
(async () => { const b = await chromium.launch(); const errs = [];
  const ic = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' }); const p = await ic.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '/login'); await p.waitForSelector('.install'); await p.screenshot({ path: S + '/iphone-acceso.png' });
  console.log('en el acceso (iPhone):', (await p.locator('.install').innerText()).replace(/\n+/g, ' | '));
  await p.click('.install .btn'); console.log('tras Entendido desaparece:', await p.locator('.install').count() === 0);
  await p.reload(); await p.waitForSelector('.login-card'); await p.waitForTimeout(600); console.log('al recargar no vuelve:', await p.locator('.install').count() === 0);
  await p.fill('input[type=email]', 'demo@demo.com'); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); console.log('dentro de la app no estorba:', await p.locator('.install').count() === 0);
  for (const [name, dev] of [['Android', devices['Pixel 7']], ['ordenador', { viewport: { width: 1280, height: 800 } }]]) {
    const c = await b.newContext({ ...dev, locale: 'es-ES' }); const q = await c.newPage(); await q.goto(B + '/login'); await q.waitForSelector('.login-card'); await q.waitForTimeout(500);
    console.log(`en ${name} no sale:`, await q.locator('.install').count() === 0); }
  console.log('errores:', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
