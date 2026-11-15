const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
async function login(p, email) { await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); }
(async () => { const b = await chromium.launch(); const errs = [];
  const mc = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' }); const m = await mc.newPage(); m.on('pageerror', e => errs.push(String(e)));
  await login(m, 'ana@demo.com'); await m.waitForSelector('.call-start'); console.log('primera pantalla:', await m.locator('.call-start h2').innerText(), '|', await m.locator('.call-start button').innerText(), '| aviso antes de fichar:', await m.locator('.code-modal').count());
  await m.screenshot({ path: S + '/cd-primera.png' });
  await m.click('.call-start button'); await m.waitForSelector('.code-modal'); console.log('al fichar salta:', (await m.locator('.code-modal').innerText()).replace(/\n+/g, ' | ')); await m.screenshot({ path: S + '/cd-codigo.png' });
  await m.click('.code-modal .btn'); await m.waitForSelector('.call-start .code-hint.big'); console.log('queda a la vista:', (await m.locator('.call-start .code-hint.big').innerText()).replace(/\n+/g, ' | '), '| ve euros:', /€/.test(await m.locator('body').innerText()));
  await m.reload(); await m.waitForSelector('.call-start'); await m.waitForTimeout(1500); console.log('al recargar no vuelve a saltar:', await m.locator('.code-modal').count() === 0);
  // dirección registra ventas hasta completar el tramo del código recomendado
  const ac = await b.newContext(); const a = await ac.newPage(); await login(a, 'demo@demo.com');
  const o = (await req(a, 'GET', '/api/ventas/opciones'))[1]; const code = o.recommended.Movistar, need = o.missing.Movistar; console.log('recomendado', code, '· faltan', need);
  const leads = (await req(a, 'GET', '/api/leads'))[1].leads.filter(l => !l.f.estado).slice(0, need);
  for (const l of leads) await a.evaluate(async ([id, c]) => { const f = new FormData(); f.append('leadId', id); f.append('products', JSON.stringify(['ffm-600-60'])); f.append('origin', 'Movistar'); f.append('primary', 'true'); f.append('code', c); await fetch('/api/ventas', { method: 'POST', body: f }); }, [l.id, code]);
  console.log('tras completar el tramo, recomendado:', (await req(a, 'GET', '/api/ventas/opciones'))[1].recommended.Movistar);
  await m.evaluate(() => window.dispatchEvent(new Event('sales-changed'))); await m.waitForSelector('.code-modal'); console.log('al comercial le salta:', (await m.locator('.code-modal').innerText()).replace(/\n+/g, ' | ')); await m.screenshot({ path: S + '/cd-cambio.png' });
  await m.click('.code-modal .btn'); console.log('dirección no recibe el aviso a pantalla completa:', await a.locator('.code-modal').count() === 0, '| errores:', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
