import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:8333';
const OLLAMA = 'http://127.0.0.1:11434';
const MODEL = 'sam860/dolphin3-qwen2.5:1.5b';

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
      issues.push({ kind: `console-${msg.type()}`, label, text: msg.text().slice(0, 800) });
    }
  });
  page.on('pageerror', (err) => {
    issues.push({ kind: 'pageerror', label, text: String(err).slice(0, 800) });
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
await context.addInitScript(({ provider, url, model }) => {
  try {
    localStorage.setItem('mmw-ai-provider', provider);
    localStorage.setItem('mmw-ollama-base-url', url);
    localStorage.setItem('preferred-model', model);
    localStorage.setItem('last-used-model', model);
  } catch (err) {
    // about:blank has no localStorage; the real page gets these values.
  }
}, { provider: 'ollama', url: OLLAMA, model: MODEL });
const page = await context.newPage();
probe(page, 'ollama');

async function run() {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#header', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const modelText = await page.locator('#current-model-name').textContent().catch(() => '');
  record('ollama: model selector shows local model', modelText.includes('dolphin3'), modelText);

  await page.locator('#prompt').fill('JavaScript learning roadmap');
  await page.locator('#generate-mindmap-btn').click();

  let generated = true;
  try {
    await page.waitForSelector('#mindmap svg .mm-node', { timeout: 120000 });
  } catch (err) {
    generated = false;
  }
  await page.waitForTimeout(800);
  const nodeCount = generated ? await page.locator('#mindmap svg .mm-node').count() : 0;
  record('ollama: mindmap generated from local model', generated && nodeCount >= 3, `nodes=${nodeCount}`);
  record('ollama: loading animation hidden after generation', !(await page.locator('#loading-animation').isVisible().catch(() => true)));

  if (generated && nodeCount >= 3) {
    try {
      await page.locator('#chat-toggle-btn').click({ timeout: 5000 });
      await page.waitForTimeout(800);
      let drawerClass = (await page.locator('#chat-drawer').getAttribute('class').catch(() => '')) || '';
      if (!drawerClass.includes('open')) {
        const diag = await page.evaluate(() => {
          const btn = document.getElementById('chat-toggle-btn');
          const rect = btn ? btn.getBoundingClientRect() : null;
          const centerEl = rect
            ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
            : null;
          return {
            chatOpen: window.chatManager?.isOpen,
            drawerClass: document.getElementById('chat-drawer')?.className || '',
            centerTag: centerEl ? `${centerEl.tagName.toLowerCase()}#${centerEl.id || ''}.${centerEl.className || ''}` : '',
            buttonRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
            loadingDisplay: document.getElementById('loading-animation')?.style.display || '',
          };
        });
        issues.push({ kind: 'chat-drawer-diag', label: 'ollama', text: JSON.stringify(diag) });
        await page.locator('#chat-toggle-btn').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        drawerClass = (await page.locator('#chat-drawer').getAttribute('class').catch(() => '')) || '';
      }
      record('ollama: chat drawer opens', drawerClass.includes('open'), drawerClass);
      if (!drawerClass.includes('open')) return;
      await page.locator('#chat-input').fill('Reply with exactly one short sentence.');
      await page.locator('#chat-send-btn').click();

      let chatReplied = true;
      try {
        await page.waitForSelector('.chat-message.bot', { timeout: 120000 });
      } catch (err) {
        chatReplied = false;
      }
      const botText = chatReplied
        ? await page.locator('.chat-message.bot').last().textContent().catch(() => '')
        : '';
      record('ollama: chat bot replies', chatReplied && botText.trim().length > 0, botText.slice(0, 120));

      // Notes AI through the local model
      try {
        await page.locator('#close-chat-btn').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        await page.locator('#mindmap svg .mm-node').nth(2).click({ button: 'right' });
        await page.waitForSelector('.context-menu', { timeout: 5000 });
        await page.locator('.context-menu [data-action="openNotesDrawer"]').click();
        await page.waitForSelector('#notes-drawer.open', { timeout: 5000 });
        await page.waitForTimeout(400);
        const aiBtn = page.locator('.notes-ai-research-btn');
        if ((await aiBtn.count()) > 0) {
          await aiBtn.click();
          await page.waitForTimeout(500);
          if ((await page.locator('.notes-ai-confirm-popup').count()) > 0) {
            await page.locator('.notes-ai-confirm-generate').click();
          }
        }
        let notesDone = true;
        try {
          await page.waitForFunction(() => {
            const editor = document.getElementById('notes-drawer-editor');
            const text = editor ? editor.innerText || editor.textContent || '' : '';
            return text.trim().length > 0 && !document.querySelector('.notes-loading-skeleton');
          }, null, { timeout: 120000 });
        } catch (err) {
          notesDone = false;
        }
        const notesText = notesDone
          ? await page.locator('#notes-drawer-editor').innerText().catch(() => '')
          : '';
        record('ollama: notes AI generates', notesDone && notesText.trim().length > 0, notesText.slice(0, 120));
      } catch (err) {
        record('ollama: notes AI flow error', false, String(err).slice(0, 500));
      }
    } catch (err) {
      record('ollama: chat flow error', false, String(err).slice(0, 500));
    }
  } else {
    record('ollama: chat skipped', false, 'no mindmap generated');
    await page.waitForTimeout(3000);
    const popupText = await page.locator('#inAppErrorMessage, .error-popup, #errorPopup, .dialog').allTextContents().catch(() => []);
    issues.push({ kind: 'generation-state', label: 'ollama', text: popupText.join(' | ').slice(0, 800) });
  }

  const networkIssues = issues.filter((i) => i.kind.startsWith('http-') || i.kind === 'requestfailed');
  record('ollama: no failed requests or 4xx/5xx', networkIssues.length === 0, JSON.stringify(networkIssues.slice(0, 5)));
}

try {
  await run();
} catch (err) {
  issues.push({ kind: 'script-error', label: 'ollama', text: String(err).slice(0, 800) });
} finally {
  await browser.close().catch(() => {});
  console.log('OLLAMA_AUDIT_START');
  console.log(JSON.stringify({ results, issues }, null, 2));
  console.log('OLLAMA_AUDIT_END');
}
