import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8333';
const shotDir = fileURLToPath(new URL('./audit-shots/', import.meta.url));
fs.mkdirSync(shotDir, { recursive: true });

const issues = [];
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) {
    issues.push({ kind: 'audit-fail', label: name, text: detail });
  }
}

function probe(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      issues.push({ kind: `console-${msg.type()}`, label, text: msg.text().slice(0, 600) });
    }
  });
  page.on('pageerror', (err) => {
    issues.push({ kind: 'pageerror', label, text: String(err).slice(0, 600) });
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    issues.push({
      kind: 'requestfailed',
      label,
      text: `${req.url()} :: ${failure ? failure.errorText : 'unknown'}`,
    });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      issues.push({ kind: `http-${res.status()}`, label, text: res.url() });
    }
  });
}

async function duplicateIds(page) {
  return page.evaluate(() => {
    const counts = new Map();
    document.querySelectorAll('[id]').forEach((el) => {
      counts.set(el.id, (counts.get(el.id) || 0) + 1);
    });
    return [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([id, n]) => ({ id, n }));
  });
}

async function layoutIssues(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = [];
    const docOverflow = document.documentElement.scrollWidth - vw;
    const bodyOverflow = document.body.scrollWidth - vw;
    if (docOverflow > 2) out.push({ type: 'doc-horizontal-overflow', overflow: docOverflow });
    if (bodyOverflow > 2) out.push({ type: 'body-horizontal-overflow', overflow: bodyOverflow });

    const ignored = /chat-drawer|leftSidebar|rightSidebar|info-menu|context-menu|search-mindmaps-popup-overlay|download-options-popup|share-overlay|api-key-popup|keyboard-shortcuts-popup|license-popup|help-popup|clearHistoryPopup/;
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0 &&
        !ignored.test(`${el.id || ''} ${el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || ''}`)
      );
    };
    const els = [...document.querySelectorAll('body *')].filter(visible);
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
      const label = `${el.tagName.toLowerCase()}#${el.id || ''}.${String(cls).split(/\s+/).slice(0, 2).join('.')}`;
      if (rect.right > vw + 2 && rect.left < vw) {
        out.push({ type: 'element-overflow-right', label, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
      }
      if (rect.left < -2 && rect.right > 0) {
        out.push({ type: 'element-overflow-left', label, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
      }
      if (rect.bottom > vh + 2 && rect.top < vh) {
        out.push({ type: 'element-overflow-bottom', label, top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) });
      }
    }
    for (const el of els) {
      if (['svg', 'textarea', 'input', 'select', 'body', 'html'].includes(el.tagName.toLowerCase())) continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
        const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
        out.push({
          type: 'text-overflow',
          label: `${el.tagName.toLowerCase()}#${el.id || ''}.${String(cls).split(/\s+/).slice(0, 2).join('.')}`,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        });
      }
    }
    return out.slice(0, 100);
  });
}

async function openHome(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#header', { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function renderExample(page) {
  await page.locator('a.manual-btn').click();
  await page.waitForSelector('#mindmap svg .mm-node', { timeout: 10000 });
  await page.waitForTimeout(300);
}

async function nodeCount(page) {
  return page.locator('#mindmap svg .mm-node').count();
}

async function openContextMenu(page, index = 1) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const node = page.locator('#mindmap svg .mm-node').nth(index);
    if ((await node.count()) === 0) return false;
    await node.click({ button: 'right' });
    await page.waitForTimeout(600);
    if (await page.locator('.context-menu').isVisible().catch(() => false)) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  const diag = await page.evaluate(() => ({
    menuCount: document.querySelectorAll('.context-menu').length,
    editorCount: document.querySelectorAll('.node-edit-fo').length,
    bodyChildCount: document.body.children.length,
    suppress: window.__mmwSuppressNodeClickUntil || 0,
    now: Date.now(),
  }));
  await page.screenshot({ path: path.join(shotDir, 'debug-context-menu.png') });
  console.log('CONTEXT_MENU_DIAG', JSON.stringify(diag));
  return false;
}

const browser = await chromium.launch({ headless: true });

// Desktop audit
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  probe(page, 'desktop');

  await openHome(page);
  record('desktop: home header visible', await page.locator('#header').isVisible());
  record('desktop: home core buttons visible', await page.locator('#generate-mindmap-btn').isVisible() && await page.locator('#openSearchPopupBtn').isVisible());
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.locator('.upload-pdf-button').click();
  const chooser = await chooserPromise;
  record('desktop: upload button opens file picker', !!chooser, chooser ? '' : 'no filechooser event');
  record('desktop: home duplicate ids empty', (await duplicateIds(page)).length === 0, JSON.stringify(await duplicateIds(page)));
  record('desktop: home no layout issues', (await layoutIssues(page)).length === 0, JSON.stringify((await layoutIssues(page)).slice(0, 20)));
  await page.screenshot({ path: path.join(shotDir, 'desktop-home.png') });

  await renderExample(page);
  const count = await nodeCount(page);
  record('desktop: example renders nodes', count >= 3, `nodes=${count}`);
  record('desktop: example duplicate data-node-id empty', (await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#mindmap svg .mm-node')].map((el) => el.getAttribute('data-node-id'));
    return ids.length !== new Set(ids).size;
  })) === false);
  record('desktop: map toolbar visible', await page.locator('#button-container').isVisible() && await page.locator('#share-btn').isVisible() && await page.locator('#download-mindmap-btn').isVisible());
  record('desktop: map no layout issues', (await layoutIssues(page)).length === 0, JSON.stringify((await layoutIssues(page)).slice(0, 20)));
  await page.screenshot({ path: path.join(shotDir, 'desktop-map.png') });

  // Double-click edit
  await page.locator('#mindmap svg .mm-node').nth(1).dblclick();
  await page.waitForSelector('.node-edit-fo [contenteditable="true"]', { timeout: 5000 });
  await page.locator('.node-edit-fo [contenteditable="true"]').fill('Edited Node');
  await page.locator('.node-edit-fo [contenteditable="true"]').press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.node-edit-fo').length === 0, null, { timeout: 5000 });
  record('desktop: double-click edit commits', (await page.locator('#mindmap svg .mm-node', { hasText: 'Edited Node' }).count()) === 1);

  // Right-click add child / sibling / delete
  const beforeAdd = await nodeCount(page);
  const menu1 = await openContextMenu(page, 1);
  if (menu1) await page.locator('.context-menu [data-action="addChildNode"]').click();
  await page.waitForTimeout(350);
  record('desktop: right-click add child', menu1 && (await nodeCount(page)) > beforeAdd, `menu=${menu1} before=${beforeAdd} after=${await nodeCount(page)}`);

  const beforeSibling = await nodeCount(page);
  const menu2 = await openContextMenu(page, 1);
  if (menu2) await page.locator('.context-menu [data-action="addSiblingNode"]').click();
  await page.waitForTimeout(350);
  record('desktop: right-click add sibling', menu2 && (await nodeCount(page)) > beforeSibling, `menu=${menu2} before=${beforeSibling} after=${await nodeCount(page)}`);

  const beforeDelete = await nodeCount(page);
  const menu3 = await openContextMenu(page, 2);
  if (menu3) await page.keyboard.press('Delete');
  await page.waitForTimeout(350);
  record('desktop: delete selected node', menu3 && (await nodeCount(page)) < beforeDelete, `menu=${menu3} before=${beforeDelete} after=${await nodeCount(page)}`);

  // History
  const historyLen = await page.evaluate(() => JSON.parse(localStorage.getItem('mindmap-history') || '[]').length);
  record('desktop: history persisted after render', historyLen > 0, `history=${historyLen}`);
  await page.locator('#leftSidebarToggle').click();
  await page.waitForSelector('#leftSidebar.open', { timeout: 5000 });
  const historyItems = await page.locator('#leftSidebarMindmapList .mindmap-item').count();
  record('desktop: left sidebar history list renders', historyItems > 0, `items=${historyItems}`);
  await page.locator('#leftSidebarToggle').click();
  await page.waitForTimeout(300);

  // Share success path (intercept backend, exercise QR + escaping)
  await page.route('**/share.mindmapwizard.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'audit123' }) }),
  );
  await page.locator('#share-btn').click();
  await page.waitForSelector('.share-dialog.show', { timeout: 5000 });
  await page.waitForSelector('.share-link', { timeout: 8000 });
  const shareUrl = await page.locator('.share-link').inputValue();
  record('desktop: share dialog link generated', shareUrl.includes('view.html?id=audit123'), shareUrl);
  const qrCount = await page.locator('#dialog-qr-code-container img, #dialog-qr-code-container canvas').count();
  record('desktop: share QR rendered', qrCount > 0, `qr=${qrCount}`);
  await page.screenshot({ path: path.join(shotDir, 'desktop-share.png') });
  await page.locator('.share-dialog .dialog-button.cancel').click();
  await page.waitForFunction(() => !document.querySelector('.share-dialog'), null, { timeout: 5000 });

  // Download markdown
  const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.locator('#download-mindmap-btn').click();
  await page.waitForSelector('#download-options-popup.show', { timeout: 5000 });
  await page.locator('#download-format').selectOption('markdown');
  await page.locator('#download-btn').click();
  const download = await downloadPromise;
  await page.waitForTimeout(500);
  record('desktop: download popup closes after export', !(await page.locator('#download-options-popup').getAttribute('class') || '').includes('show'));
  record('desktop: markdown download event fires', !!download, download ? download.suggestedFilename() : 'no download event');

  // Search popup
  await page.locator('#openSearchPopupBtn').click();
  await page.waitForSelector('#searchMindmapsPopupOverlay.active', { timeout: 5000 });
  await page.locator('#popupMindmapSearchInput').fill('test');
  await page.waitForTimeout(300);
  record('desktop: search results area visible', await page.locator('#searchResultsList').isVisible());
  await page.locator('#closeSearchPopupBtn').click();
  await page.waitForTimeout(300);
  record('desktop: search popup closes', !(await page.locator('#searchMindmapsPopupOverlay').getAttribute('class') || '').includes('active'));

  // Chat drawer (last: closing the API key popup returns to the header)
  await page.locator('#chat-toggle-btn').click();
  await page.waitForSelector('#chat-drawer.open', { timeout: 5000 });
  await page.locator('#chat-send-btn').click();
  await page.waitForTimeout(300);
  record('desktop: chat empty input sends nothing', (await page.locator('.chat-message.user').count()) === 0);
  await page.locator('#close-chat-btn').click();
  await page.waitForTimeout(300);
  record('desktop: chat drawer closes via close button', !(await page.locator('#chat-drawer').getAttribute('class')).includes('open'));

  await page.locator('#chat-toggle-btn').click();
  await page.waitForSelector('#chat-drawer.open', { timeout: 5000 });
  await page.locator('#chat-input').fill('hello');
  await page.locator('#chat-send-btn').click();
  await page.waitForSelector('#api-key-popup', { timeout: 5000 });
  record('desktop: chat send without key opens popup', await page.locator('#api-key-popup').isVisible());
  await page.locator('#close-api-key-popup').click();
  await page.waitForTimeout(300);
  record(
    'desktop: closing key popup returns to header and closes chat',
    (await page.locator('#header').isVisible()) && !(await page.locator('#chat-drawer').getAttribute('class')).includes('open'),
  );

  await page.screenshot({ path: path.join(shotDir, 'desktop-final.png') });
  await context.close();
}

// Mobile audit
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  probe(page, 'mobile');

  await openHome(page);
  record('mobile: home duplicate ids empty', (await duplicateIds(page)).length === 0, JSON.stringify(await duplicateIds(page)));
  record('mobile: home no layout issues', (await layoutIssues(page)).length === 0, JSON.stringify((await layoutIssues(page)).slice(0, 20)));
  await page.screenshot({ path: path.join(shotDir, 'mobile-home.png') });

  await renderExample(page);
  record('mobile: example renders nodes', (await nodeCount(page)) >= 3, `nodes=${await nodeCount(page)}`);
  record('mobile: map no layout issues', (await layoutIssues(page)).length === 0, JSON.stringify((await layoutIssues(page)).slice(0, 20)));
  await page.screenshot({ path: path.join(shotDir, 'mobile-map.png') });

  await context.close();
}

await browser.close();

const summary = {
  results,
  issues,
  shots: shotDir,
};
console.log('AUDIT_SUMMARY_START');
console.log(JSON.stringify(summary, null, 2));
console.log('AUDIT_SUMMARY_END');
