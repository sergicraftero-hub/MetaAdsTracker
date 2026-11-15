const { chromium } = require('playwright'); const B = 'http://localhost:3100';
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1280, height: 860 } }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
(async () => { const b = await chromium.launch(); const ana = await ctx(b, 'ana@demo.com'), dir = await ctx(b, 'demo@demo.com');
  for (const [n, p] of [['comercial', ana], ['dirección', dir]]) { await p.click('.tab:has-text("Leads")'); await p.locator('.row-main').first().click(); await p.waitForSelector('.sheet'); console.log(n, '→ botón «Abrir en Notion»:', await p.locator('.sheet >> text=Abrir en Notion').count()); }
  await b.close(); })();
