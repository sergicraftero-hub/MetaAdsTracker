const { chromium, devices } = require('playwright'); const B = 'http://localhost:3100', S = (process.argv[2] || __dirname + '/capturas');
async function login(p, email) { await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); }
(async () => { const b = await chromium.launch(); const errs = [];
  // --- comercial en móvil
  const mc = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const m = await mc.newPage(); m.on('pageerror', e => errs.push(String(e)));
  await login(m, 'ana@demo.com'); await m.waitForSelector('.call-start'); console.log('lámina antes de fichar:', await m.locator('.poster').count());
  await m.click('.call-start button'); await m.waitForSelector('.code-modal'); console.log('barra en aviso de código:', await m.locator('.code-modal .tierbar').getAttribute('aria-label')); await m.waitForTimeout(1000); await m.screenshot({ path: S + '/n-codigo.png' });
  await m.click('.code-modal .btn'); await m.waitForSelector('.call-start .code-hint.big .tierbar');
  const frase = await m.locator('.poster blockquote').innerText(); await m.waitForTimeout(1600); await m.screenshot({ path: S + '/n-inicio-movil.png', fullPage: true });
  await m.click('.poster-tap'); const frase2 = await m.locator('.poster blockquote').innerText(); console.log('frase:', frase, '→ al tocar:', frase2, '| cambia:', frase !== frase2);
  await m.waitForTimeout(1500); await m.screenshot({ path: S + '/n-lamina2.png', fullPage: true });
  await m.click('.poster-tap'); await m.waitForTimeout(1500); await m.locator('.poster').screenshot({ path: S + '/n-lamina3.png' });
  console.log('comercial ve euros:', /€/.test(await m.locator('body').innerText()));
  // empezar a llamar y firmar
  await m.click('.call-start .btn.primary.big'); await m.waitForSelector('.call-card'); console.log('lámina en la ficha del lead (no debe):', await m.locator('.poster').count());
  await m.click('.res.won'); await m.waitForSelector('.sale-form');
  await m.waitForSelector('.sale-form select'); await m.locator('.sale-form select').first().selectOption({ index: 2 }); await m.addLocatorHandler(m.locator('.code-modal'), async () => { await m.click('.code-modal .btn'); });
  await m.click('.sale-form > .btn.primary'); await m.waitForSelector('.party'); await m.waitForTimeout(450); await m.screenshot({ path: S + '/n-fiesta1.png' }); await m.waitForTimeout(500); await m.screenshot({ path: S + '/n-fiesta2.png' });
  console.log('celebración:', (await m.locator('.party-card').innerText()).replace(/\n+/g, ' | '));
  await m.waitForTimeout(3200); console.log('se va sola:', await m.locator('.party').count() === 0, '| sigue con otro lead:', await m.locator('.call-card').count() === 1);
  // vacíos
  await m.locator('nav button, .tabbar button', { hasText: 'Agenda' }).first().click().catch(() => {}); await m.waitForTimeout(800); await m.screenshot({ path: S + '/n-agenda.png', fullPage: true }); console.log('vacíos en agenda:', await m.locator('.empty').count());
  // --- dirección en ordenador
  const ac = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: 'dark' }); const a = await ac.newPage(); a.on('pageerror', e => errs.push(String(e)));
  await login(a, 'demo@demo.com'); await a.waitForSelector('.code-summary .tierbar'); await a.waitForTimeout(1600); await a.screenshot({ path: S + '/n-inicio-pc.png', fullPage: true });
  await a.click('.code-summary .btn'); await a.waitForSelector('.code-card .tierbar'); await a.waitForTimeout(1200); await a.locator('.codes').screenshot({ path: S + '/n-codigos.png' });
  console.log('barras en contrataciones:', await a.locator('.code-card .tierbar').evaluateAll(n => n.map(x => x.getAttribute('aria-label'))));
  await a.locator('nav button', { hasText: 'WhatsApp' }).click().catch(() => {}); await a.waitForTimeout(1200); await a.screenshot({ path: S + '/n-wa.png' });
  console.log('errores:', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
