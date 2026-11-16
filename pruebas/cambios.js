// Pausa con ventana, fichar salida desde Llamar, estados a la vista, lista de leads y embudo del comercial, recuento de bonos oculto y claves por código.
const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2] || __dirname + '/capturas';
const req = (p, m, url, body) => p.evaluate(([m, u, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(async r => [r.status, await r.json().catch(() => ({}))]), [m, url, body]);
async function ctx(b, email, opts) { const c = await b.newContext({ locale: 'es-ES', timezoneId: 'Europe/Madrid', ...opts }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); });
  await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); return p; }
const ok = (name, cond, extra = '') => { console.log(cond ? 'bien ' : 'MAL  ', name, extra); if (!cond) process.exitCode = 1; };
(async () => { const b = await chromium.launch();
  const a = await ctx(b, 'demo@demo.com', { viewport: { width: 1280, height: 900 } });
  // dirección pone las claves del Código 1
  await a.click('.tab:has-text("Claves")'); await a.waitForSelector('.code-card input'); const card = a.locator('.code-card').first();
  await card.locator('input').nth(0).fill('usuario-prueba'); await card.locator('input').nth(1).fill('Clave-Secreta-1'); await card.locator('input').nth(2).fill('https://portal.example.com'); await card.locator('button.primary').click(); await a.waitForSelector('.toast:has-text("guardadas")'); await a.screenshot({ path: S + '/x-claves.png' });
  const rec = (await req(a, 'GET', '/api/ventas/opciones'))[1].recommended.Movistar;
  const todas = (await req(a, 'GET', '/api/claves'))[1].codes; ok('dirección ve las claves guardadas', todas[0].user === 'usuario-prueba' && todas[0].password === 'Clave-Secreta-1');
  // comercial en móvil
  const m = await ctx(b, 'ana@demo.com', { ...devices['iPhone 13'] });
  ok('comercial no puede listar ni cambiar claves', (await req(m, 'GET', '/api/claves'))[0] === 403 && (await req(m, 'PUT', '/api/claves', { real: todas[0].real, user: 'x' }))[0] === 403);
  const una = (await req(m, 'GET', '/api/claves?codigo=' + encodeURIComponent('Código 1')))[1]; ok('por alias recibe la clave sin el nombre real', una.key?.user === 'usuario-prueba' && !JSON.stringify(una).includes(todas[0].real));
  ok('sin pestañas Embudo ni Claves', await m.locator('.tab:has-text("Embudo")').count() === 0 && await m.locator('.tab:has-text("Claves")').count() === 0);
  await m.waitForSelector('.call-start'); await m.click('.call-start button'); await m.waitForSelector('.call-start .code-hint.big'); await m.waitForSelector('.bonus');
  ok('bono de fibras sin recuento', await m.locator('.bonus:has-text("fibras") .bonus-num').count() === 0 && await m.locator('.bonus:has-text("llamadas") .bonus-num').count() === 1);
  ok('botón de fichar salida en el inicio', await m.locator('.call-start .clock-out').count() === 1); await m.waitForTimeout(800); await m.screenshot({ path: S + '/x-inicio.png', fullPage: true });
  await m.click('.call-start .btn.primary.big'); await m.waitForSelector('.call-card'); const nombre = await m.locator('.call-card .lead-name').innerText();
  const estados = await m.$$eval('.results .res b', x => x.map(e => e.innerText)); ok('todos los estados a la vista', estados.includes('No interesado') && estados.includes('Interesado') && await m.locator('.results details').count() === 0, estados.join(', '));
  await m.locator('.results').screenshot({ path: S + '/x-estados.png' });
  // claves desde la ficha
  if (rec === 'Código 1') { await m.click('.code-btn'); await m.waitForSelector('.key-list'); ok('el botón del código enseña usuario y contraseña', /usuario-prueba/.test(await m.locator('.key-modal').innerText()) && /Clave-Secreta-1/.test(await m.locator('.key-modal').innerText()));
    await m.screenshot({ path: S + '/x-clave.png' }); await m.click('.key-modal >> text=Cerrar'); } else console.log('(recomendado', rec, ': no se prueba el botón)');
  // pausa
  await m.click('.call-bar >> text=Pausar'); await m.waitForSelector('.pause-modal'); await m.waitForTimeout(1200); await m.screenshot({ path: S + '/x-pausa.png' });
  const tapado = await m.evaluate(() => { const r = document.querySelector('.res').getBoundingClientRect(); const el = document.elementFromPoint(r.x + 5, r.y + 5); return !!el && !!el.closest('.pause-layer'); });
  ok('en pausa no se puede tocar nada', tapado && await m.locator('.call-card').count() === 1);
  await m.click('.pause-modal .btn'); await m.waitForSelector('.pause-modal', { state: 'detached' }); ok('al reanudar sigue el mismo lead', await m.locator('.call-card .lead-name').innerText() === nombre);
  // lista de leads: solo los suyos ya llamados
  await m.click('.res:has-text("Ilocalizable")'); await m.waitForTimeout(900);
  await m.click('.tab:has-text("Más")'); await m.click('.more-item:has-text("Leads")'); await m.waitForTimeout(700);
  const lista = (await req(m, 'GET', '/api/leads'))[1]; const esperados = lista.leads.filter(l => l.f.estado && l.f.comercial === 'ANA').length; const filas = await m.locator('.rows > li, .rows .row').count();
  ok('en Leads solo salen los suyos ya llamados', filas > 0 && filas <= esperados && !/Sin contactar/.test(await m.locator('.filters').innerText()), `${filas} de ${lista.leads.length}`);
  // dirección activa el embudo a Ana
  const users = (await req(a, 'GET', '/api/users'))[1].users; const ana = users.find(u => u.email === 'ana@demo.com'); await req(a, 'PATCH', '/api/users/' + ana.id, { embudo: true });
  ok('con permiso, el servidor le abre el Embudo', (await req(m, 'GET', '/api/leads'))[1].embudo === true);
  // fichar salida desde Llamar
  await m.reload(); await m.waitForSelector('.call-start .clock-out'); await m.click('.clock-out'); await m.click('.dialog .btn.primary'); await m.waitForSelector('.toast:has-text("Salida")'); await m.waitForSelector('text=Ficha la entrada para empezar');
  ok('fichar salida desde el inicio', (await req(m, 'GET', '/api/leads'))[1].clockedIn === false);
  console.log('errores:', m.errs, a.errs); if (m.errs.length || a.errs.length) process.exitCode = 1; await b.close(); })().catch(e => { console.error(e); process.exit(1); });
