const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
(async () => { const b = await chromium.launch(); const a = await ctx(b, 'demo@demo.com'), ana = await ctx(b, 'ana@demo.com');
  // velocidad de respuesta
  await a.click('.tab:has-text("Panel")'); await a.waitForSelector('text=Velocidad de respuesta'); const card = a.locator('section:has(h2:has-text("Velocidad de respuesta"))');
  console.log('velocidad:', await card.locator('.tile').evaluateAll(t => t.map(x => x.innerText.replace(/\n/g, ' | ')))); await card.locator('summary').click(); console.log('por comercial:', await card.locator('tbody tr').evaluateAll(r => r.map(x => x.innerText.replace(/\s+/g, ' ')))); await card.screenshot({ path: S + '/k-velocidad.png' });
  // catálogo editable
  const t0 = (await req(a, 'GET', '/api/ventas'))[1]; console.log('antes: lotes', t0.totals.lots, '| comercial accede al catálogo:', (await req(ana, 'GET', '/api/ventas/catalogo'))[0], (await req(ana, 'PUT', '/api/ventas/catalogo', {}))[0]);
  await a.click('.tab:has-text("Contratos")'); await a.waitForSelector('.code-card'); await a.click('summary:has-text("Catálogo y comisiones")'); await a.waitForSelector('.cat-table');
  console.log('productos en el editor:', await a.locator('.cat-table tbody tr').count());
  const row = a.locator('.cat-table tbody tr', { has: a.locator('input[value="600 Mb + 60 GB + M+ y Netflix"]') }); await row.locator('input[type=number]').nth(1).fill('150');
  const lot = a.locator('.tier-row').first(); await lot.locator('input').nth(1).fill('999');
  await a.screenshot({ path: S + '/k-catalogo.png', fullPage: true }); await a.click('text=Guardar catálogo'); await a.waitForSelector('.toast:has-text("Catálogo guardado")');
  const t1 = (await req(a, 'GET', '/api/ventas'))[1]; const p = t1.catalog.find(x => x.id === 'ftv-600-60-n'); console.log('después: comisión del producto', p.commission, '| lotes', t1.totals.lots, '| ventas existentes conservan comisión:', t1.totals.commission === t0.totals.commission);
  const o = (await req(ana, 'GET', '/api/ventas/opciones'))[1]; console.log('comercial sigue sin ver comisiones:', !('commission' in o.catalog[0]));
  // una venta nueva usa la comisión nueva
  const leads = (await req(ana, 'GET', '/api/leads'))[1].leads; const L = leads.find(l => !l.f.comercial);
  await ana.evaluate(async (id) => { const f = new FormData(); f.append('leadId', id); f.append('products', JSON.stringify(['ftv-600-60-n'])); f.append('origin', 'Movistar'); f.append('primary', 'true'); f.append('code', 'Código 1'); await fetch('/api/ventas', { method: 'POST', body: f }); }, L.id);
  const t2 = (await req(a, 'GET', '/api/ventas'))[1]; console.log('venta nueva con comisión:', t2.sales.find(s => s.leadId === L.id).commission);
  await a.reload(); await a.click('.tab:has-text("Contratos")'); await a.click('summary:has-text("Catálogo y comisiones")'); await a.waitForSelector('.cat-table'); await a.click('text=Restaurar el de partida'); await a.click('.dialog .danger-solid'); await a.waitForSelector('.toast:has-text("restaurado")');
  console.log('restaurado: lotes', (await req(a, 'GET', '/api/ventas'))[1].totals.lots, '| errores:', a.errs, ana.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
