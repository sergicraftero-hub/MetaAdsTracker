const { chromium } = require('playwright'); const B = 'http://localhost:3100', S = process.argv[2];
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(B + '/login'); await p.fill('input[type=email]', 'ana@demo.com'); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell');
  await p.click('.tab:has-text("WhatsApp")'); await p.waitForSelector('.wa-list'); await p.click('.wa-list >> text=Global'); await p.waitForSelector('.chat-item');
  const n0 = await p.locator('.unread').count(); await p.locator('.chat-item:has(.unread)').first().click(); await p.waitForSelector('.msg'); const n1 = await p.locator('.unread').count();
  await p.click('.chat-head >> text=No leído'); await p.waitForSelector('.toast:has-text("no leído")'); const n2 = await p.locator('.unread').count();
  await p.check('.small-check input'); await p.waitForTimeout(300); const shown = await p.locator('.chat-item').count(); await p.screenshot({ path: S + '/p-noleidos.png' });
  await p.reload(); await p.click('.tab:has-text("WhatsApp")'); await p.click('.wa-list >> text=Global'); await p.waitForSelector('.chat-item');
  console.log('no leídos: inicio', n0, '| tras abrir', n1, '| tras marcar', n2, '| filtro muestra', shown, '| tras recargar', await p.locator('.unread').count(), '| errores', errs); await b.close(); })().catch(e => { console.error(e); process.exit(1); });
