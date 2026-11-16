const { chromium, devices } = require('playwright'); const S = process.argv[2], PDF = process.argv[3], B = 'http://localhost:3100';
async function login(p, email) { await p.goto(B + '/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'demo'); await p.click('button.primary'); await p.waitForSelector('.shell'); }
(async () => { const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const p = await c.newPage(); await p.addLocatorHandler(p.locator('.code-modal'), async () => { await p.locator('.code-modal .btn').click(); });
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await login(p, 'ana@demo.com'); await p.click('.tab:has-text("WhatsApp")'); await p.waitForSelector('.wa-list'); await p.waitForSelector('.chat-item');
  console.log('chats:', await p.$$eval('.chat-item strong', x => x.length), '| sin leer:', await p.$$eval('.unread', x => x.length));
  await p.locator('.chat-item').first().click(); await p.waitForSelector('.msg');
  await p.fill('.chat-row textarea', 'Te confirmo la oferta: 38 € al mes'); await p.keyboard.press('Enter'); await p.waitForSelector('.msg.me:has-text("38 €")');
  console.log('enviado:', await p.locator('.msg.me').last().innerText().then(t => t.replace(/\n/g, ' | ')));
  await p.screenshot({ path: S + '/w-bandeja.png' });
  // otro usuario ve el mismo chat con el autor
  const c2 = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' }); const m = await c2.newPage(); await m.addLocatorHandler(m.locator('.code-modal'), async () => { await m.locator('.code-modal .btn').click(); }); m.on('pageerror', e => errs.push('m:' + e));
  await login(m, 'demo@demo.com'); await m.click('.tab:has-text("WhatsApp")'); await m.waitForSelector('.wa-list'); await m.waitForSelector('.chat-item'); await m.screenshot({ path: S + '/w-lista-m.png' });
  await m.locator('.chat-item').first().click(); await m.waitForSelector('.msg.me:has-text("38 €")'); console.log('lo ve dirección:', await m.locator('.msg.me').last().locator('.msg-meta').innerText());
  await m.screenshot({ path: S + '/w-chat-m.png' }); await m.click('.chat-head .btn'); await m.waitForSelector('.chat-item'); console.log('volver ok');
  // desde la ficha del lead
  await p.click('.tab:has-text("Leads")'); await p.locator('.row-main').nth(2).click(); await p.waitForSelector('.sheet'); await p.click('.sheet .contact >> text=WhatsApp'); await p.waitForSelector('.chat-sheet .chat');
  await p.setInputFiles('.chat-sheet input[type=file]', PDF); await p.fill('.chat-sheet textarea', 'Te adjunto el contrato'); await p.click('.chat-sheet >> text=Enviar'); await p.waitForSelector('.chat-sheet .msg.me .file');
  console.log('desde ficha:', await p.locator('.chat-sheet .msg.me').last().innerText().then(t => t.replace(/\n/g, ' | '))); await p.screenshot({ path: S + '/w-ficha.png' });
  console.log('casilla WHATSAPP marcada:', await p.evaluate(async () => (await fetch('/api/leads').then(r => r.json())).leads.filter(l => l.f.whatsapp).length > 0));
  console.log('overflow móvil:', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), '| errores:', errs); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
