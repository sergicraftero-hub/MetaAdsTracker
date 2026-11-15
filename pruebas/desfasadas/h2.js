const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100';
(async () => { const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' }); const m = await c.newPage(); await m.addLocatorHandler(m.locator('.code-modal'), async () => { await m.locator('.code-modal .btn').click(); });
  await m.goto(B + '/login'); await m.fill('input[type=email]', 'ana@demo.com'); await m.fill('input[type=password]', 'demo'); await m.click('button.primary'); await m.waitForSelector('.shell');
  await m.waitForTimeout(1500); console.log('toast al entrar:', await m.locator('.toast').count());
  await m.click('.tab:has-text("Ayuda")'); await m.click('button.guide:has-text("Fichar")'); for (let i = 0; i < 3; i++) await m.click('.guide-open button:has-text("Siguiente")');
  await m.click('.guide-open .btn.primary'); await m.waitForTimeout(500); console.log('storage:', await m.evaluate(() => localStorage.getItem('but-calls-ayuda-hechos')), '| pestaña:', await m.locator('.tab.active').innerText());
  await m.click('.tab:has-text("Ayuda")'); await m.waitForSelector('button.guide'); await m.waitForTimeout(300); console.log('pills:', await m.$$eval('button.guide .pill', x => x.map(e => e.innerText))); await b.close(); })();
