const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
(async () => { const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '/login'); await p.fill('input[type=email]', 'ana@demo.com'); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.call-start');
  console.log('inicio llamar sin contadores:', await p.locator('.call-counts').count() === 0, '|', await p.locator('.call-start p.muted').innerText());
  await p.screenshot({ path: S + '/s-llamar.png' });
  await p.click('.tab:has-text("Panel")'); await p.waitForSelector('.tile.hero'); await p.waitForTimeout(500);
  console.log('panel comercial:', await p.$$eval('.tile', t => t.map(x => x.innerText.replace(/\n/g, ' | '))), '| tablas:', await p.locator('table').count(), '| gráficos:', await p.locator('.daychart').count());
  await p.screenshot({ path: S + '/s-panel.png', fullPage: true }); console.log('errores', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
