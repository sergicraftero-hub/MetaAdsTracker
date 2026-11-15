const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
(async () => { const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '/login'); await p.fill('input[type=email]', 'ana@demo.com'); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell');
  await p.waitForSelector('.badge'); const n = await p.locator('.badge').innerText(); await p.click('.bell-btn'); await p.waitForSelector('.bell-panel li'); await p.screenshot({ path: S + '/s-avisos.png' });
  console.log('avisos de Ana:', n, await p.$$eval('.bell-panel li', l => l.map(x => x.innerText.replace(/\n/g, ' · '))));
  await p.click('.bell-btn'); await p.waitForTimeout(300); console.log('tras verlos, contador:', await p.locator('.badge').count());
  await p.reload(); await p.waitForSelector('.shell'); await p.waitForTimeout(1200); console.log('tras recargar, contador:', await p.locator('.badge').count(), '| errores', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
