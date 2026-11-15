const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
async function ctx(b, email) { const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('dialog', d => d.accept()); await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
const leadsOf = async p => (await req(p, 'GET', '/api/leads'))[1];
(async () => { const b = await chromium.launch(); const ana = await ctx(b, 'ana@demo.com'), luis = await ctx(b, 'luis@demo.com');
  await ana.waitForSelector('.call-start'); console.log('sin fichar:', await ana.locator('.call-start h2').innerText());
  const d0 = await leadsOf(ana); const free = d0.leads.find(l => !l.f.estado && !l.f.comercial);
  console.log('reservar sin fichar ->', (await req(ana, 'POST', `/api/leads/${free.id}/reservar`))[0], '| working:', d0.working, '| clockedIn:', d0.clockedIn);
  await ana.screenshot({ path: S + '/s-fichar.png' });
  await ana.click('text=Fichar entrada'); await ana.waitForSelector('text=Empezar a llamar'); await new Promise(r => setTimeout(r, 300));
  const d1 = await leadsOf(ana); console.log('Ana ficha -> working:', d1.working, '| ve', d0.leads.length, '->', d1.leads.length, 'leads; de LUIS sin contactar/ilocalizables visibles:', d1.leads.filter(l => l.f.comercial === 'LUIS' && (!l.f.estado || l.f.estado === 'ILOCALIZABLE')).length);
  await ana.click('text=Empezar a llamar'); await ana.waitForSelector('.call-card'); const phone = await ana.locator('.call-card .lead-name + p').innerText();
  const cur = async () => (await leadsOf(ana)).leads.find(l => phone.startsWith(l.f.telefono));
  console.log('en pantalla, sin pulsar Llamar -> comercial:', (await cur()).f.comercial);
  await ana.click('.call-card button:has-text("Llamar")'); await ana.waitForTimeout(800); console.log('tras pulsar Llamar -> comercial:', (await cur()).f.comercial);
  // Luis está ausente: Ana atiende un ilocalizable suyo y se lo queda
  const iloc = d1.leads.find(l => l.f.comercial === 'LUIS' && l.f.estado === 'ILOCALIZABLE');
  console.log('Ana guarda resultado en ilocalizable de Luis ->', (await req(ana, 'POST', `/api/leads/${iloc.id}/llamada`, { fields: { estado: 'CONTACTADO E INTERESADO' }, shownAt: new Date().toISOString() }))[1].lead.f.comercial);
  // Luis ficha: lo suyo vuelve a ser solo suyo
  await luis.click('text=Fichar entrada'); await luis.waitForSelector('text=Empezar a llamar'); await new Promise(r => setTimeout(r, 300)); await ana.waitForTimeout(21000);
  const d2 = await leadsOf(ana); console.log('Luis ficha -> working:', d2.working, '| ilocalizables de LUIS que ve Ana:', d2.leads.filter(l => l.f.comercial === 'LUIS' && (!l.f.estado || l.f.estado === 'ILOCALIZABLE') && !l.f.rellamada).length);
  console.log('errores:', ana.errs, luis.errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
