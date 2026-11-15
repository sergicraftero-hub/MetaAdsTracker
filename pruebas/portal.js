const { chromium, devices } = require('playwright'); const S = process.argv[2], PDF = process.argv[3], B = 'http://localhost:3100';
async function login(p, email) { await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); }
const out = (...a) => console.log(...a);
(async () => { const b = await chromium.launch(); const errs = [];
  const watch = (p, t) => { p.on('pageerror', e => errs.push(t + e)); p.on('console', m => m.type() === 'error' && errs.push(t + m.text())); p.on('dialog', d => d.accept()); };
  const mc = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const m = await mc.newPage(); await m.addLocatorHandler(m.locator('.code-modal'), async () => { await m.locator('.code-modal .btn').click(); }); watch(m, 'm:');
  await login(m, 'ana@demo.com'); out('contador llamadas quitado:', !(await m.locator('.call-bar').count()) || !/hechas/.test(await m.locator('body').innerText()));
  await m.click('.tab:has-text("Portal")'); await m.waitForSelector('.clock'); out('estado:', await m.locator('.clock .pill').innerText());
  await m.click('.clock button:has-text("Entrar")'); await m.waitForSelector('.clock >> text=Trabajando'); await m.waitForTimeout(2200); const t1 = await m.locator('.clock-time').innerText();
  await m.click('.clock button:has-text("Empezar descanso")'); await m.waitForSelector('.clock >> text=En descanso'); await m.waitForTimeout(2200); const t2 = await m.locator('.clock-time').innerText();
  await m.screenshot({ path: S + '/p-fichaje-m.png' });
  await m.click('.clock button:has-text("Volver del descanso")'); await m.waitForSelector('.clock >> text=Trabajando'); await m.waitForTimeout(1200);
  out('contador corre:', t1, '| parado en descanso:', t2, await m.locator('.clock-time').innerText());
  await m.click('.clock button:has-text("Salir")'); await m.click('.dialog .btn.primary'); await m.waitForSelector('.clock >> text=Fuera de jornada'); out('fila mes:', await m.locator('tbody tr').first().innerText().then(t => t.replace(/\s+/g, ' ')));
  const csv = await m.evaluate(async () => { const mes = new Date().toISOString().slice(0, 7); return (await fetch('/api/portal/fichaje/export?mes=' + mes).then(r => r.text())).split('\r\n').slice(0, 2); }); out('csv:', csv);
  out('no puede corregir:', await m.evaluate(() => fetch('/api/portal/fichaje', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)));
  // vacaciones
  await m.click('.seg >> text=Vacaciones'); await m.waitForSelector('.cal'); const cells = m.locator('.cal-day:not(.out)'); await cells.nth(20).click(); await cells.nth(24).click();
  out('resumen:', await m.locator('.step h3').innerText()); await m.fill('.step input', 'Viaje familiar'); await m.click('text=Enviar solicitud'); await m.waitForSelector('.chip.c-yellow'); await m.screenshot({ path: S + '/p-vacaciones-m.png', fullPage: true });
  // dirección: campana
  const ac = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const a = await ac.newPage(); await a.addLocatorHandler(a.locator('.code-modal'), async () => { await a.locator('.code-modal .btn').click(); }); watch(a, 'a:');
  await login(a, 'demo@demo.com'); await a.waitForSelector('.badge'); out('campana:', await a.locator('.badge').innerText()); await a.click('.bell-btn'); await a.waitForSelector('.bell-panel li'); await a.screenshot({ path: S + '/p-campana.png' });
  await a.click('.bell-panel >> text=Aprobar'); await a.waitForSelector('.toast:has-text("aprobada")'); await a.waitForFunction(() => !document.querySelector('.badge')); out('aprobada desde la campana');
  await m.reload(); await m.click('.tab:has-text("Portal")'); await m.click('.seg >> text=Vacaciones'); await m.waitForSelector('.chip.c-green'); out('empleado la ve:', await m.locator('.bonus-admin li').first().innerText().then(t => t.replace(/\s+/g, ' ')));
  // nóminas
  await a.click('.tab:has-text("Portal")'); await a.click('.seg >> text=Nóminas'); await a.waitForSelector('form.newuser'); await a.selectOption('form.newuser select', 'ana@demo.com'); await a.setInputFiles('form.newuser input[type=file]', PDF); await a.click('button:has-text("Subir nómina")'); await a.waitForSelector('.bonus-admin li'); await a.screenshot({ path: S + '/p-nominas.png' });
  await m.click('.seg >> text=Nóminas'); await m.waitForSelector('.bonus-admin li'); out('nómina de Ana:', await m.locator('.bonus-admin li').first().innerText().then(t => t.replace(/\s+/g, ' ')));
  const id = await m.evaluate(async () => (await fetch('/api/portal/nominas').then(r => r.json())).payslips[0].id);
  const lc = await b.newContext(); const l = await lc.newPage(); await l.addLocatorHandler(l.locator('.code-modal'), async () => { await l.locator('.code-modal .btn').click(); }); await login(l, 'luis@demo.com');
  out('Luis: ve', await l.evaluate(async () => (await fetch('/api/portal/nominas').then(r => r.json())).payslips.length), 'nóminas; descarga ajena ->', await l.evaluate((i) => fetch('/api/portal/nominas/' + i, { redirect: 'manual' }).then(r => r.status), id), '| Ana descarga ->', await m.evaluate((i) => fetch('/api/portal/nominas/' + i, { redirect: 'manual' }).then(r => r.type + ' ' + r.status), id));
  // dirección corrige un fichaje
  await a.click('.seg >> text=Fichaje'); await a.waitForSelector('.clock'); await a.selectOption('.filters select', 'ana@demo.com'); await a.waitForSelector('tbody >> text=Corregir'); await a.click('tbody >> text=Corregir'); { const v = await a.inputValue('.modal input >> nth=0'); const d = new Date(v); d.setHours(d.getHours() - 2); const z = n => String(n).padStart(2, '0'); await a.fill('.modal input >> nth=0', `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`); } await a.fill('.modal textarea', 'Olvidó fichar la entrada'); await a.click('text=Guardar corrección'); await a.waitForSelector('tbody .pill:has-text("Corregido")'); await a.screenshot({ path: S + '/p-fichaje.png' }); out('corrección registrada:', await a.locator('tbody .pill:has-text("Corregido")').getAttribute('title'));
  // whatsapp: mis chats
  await m.click('.tab:has-text("WhatsApp")'); await m.waitForSelector('.wa-list'); const mine0 = await m.locator('.chat-item').count(); await m.click('.wa-list >> text=Global'); await m.waitForSelector('.chat-item'); const all = await m.locator('.chat-item').count();
  await m.locator('.chat-item').last().click(); await m.waitForSelector('.chat-head .owner'); await m.selectOption('.chat-head .owner', 'ANA'); await m.waitForSelector('.toast:has-text("asignado")'); await m.click('.chat-head .btn'); await m.click('.wa-list >> text=Mis chats'); await m.waitForTimeout(400);
  out('whatsapp mis chats antes/global/después:', mine0, all, await m.locator('.chat-item').count()); await m.screenshot({ path: S + '/p-wa-m.png' });
  out('overflow móvil:', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), '| errores:', errs.filter(e => !/40[34]/.test(e))); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
