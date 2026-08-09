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
      issues.push({ kind: `console-${msg.type()}`, label, text: msg.text().slice(0, 600) });
    }
  });
  page.on('pageerror', (err) => {
    issues.push({ kind: 'pageerror', label, text: String(err).slice(0, 600) });
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    issues.push({ kind: 'requestfailed', label, text: `${req.url()} :: ${failure ? failure.errorText : 'unknown'}` });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      issues.push({ kind: `http-${res.status()}`, label, text: res.url() });
    }
  });
}

async function nodeCount(page) {
  return page.locator('#mindmap svg .mm-node').count();
}

async function waitForIdle(page) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('loading-animation');
      return !el || el.style.display === 'none' || getComputedStyle(el).display === 'none';
    },
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(500);
}

async function openContextMenu(page, index, action) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const node = page.locator('#mindmap svg .mm-node').nth(index);
    if ((await node.count()) === 0) return false;
    await node.click({ button: 'right' });
    await page.waitForTimeout(500);
    const target = page.locator(`.context-menu [data-action="${action}"]`);
    if ((await target.count()) > 0 && (await target.isVisible())) {
      return true;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  return false;
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
    // about:blank has no localStorage.
  }
}, { provider: 'ollama', url: OLLAMA, model: MODEL });
const page = await context.newPage();
probe(page, 'ai-features');
page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

async function run() {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#header', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.locator('#prompt').fill('JavaScript ecosystem overview');
  await page.locator('#generate-mindmap-btn').click();
  await page.waitForSelector('#mindmap svg .mm-node', { timeout: 120000 });
  await waitForIdle(page);
  const baseline = await nodeCount(page);
  record('ai: generation baseline', baseline >= 3, `nodes=${baseline}`);

  // UI: AI expand node
  let expandOk = false;
  let expandMenuFound = false;
  for (let i = 1; i < Math.min(12, baseline); i++) {
    if (await openContextMenu(page, i, 'expandMindMapNode')) {
      expandMenuFound = true;
      const beforeExpand = await nodeCount(page);
      const targetId = await page.evaluate(() => window.currentNodeElement?.getAttribute('data-node-id') || '');
      const preDiag = await page.evaluate(() => {
        const el = window.currentNodeElement;
        const hierarchy = typeof currentHierarchy !== 'undefined' ? currentHierarchy : null;
        return {
          id: el ? el.getAttribute('data-node-id') : null,
          text: el && el.querySelector('text') ? el.querySelector('text').textContent : null,
          disableAi: Boolean(window.MMW_DISABLE_AI_FEATURES),
          readOnly: Boolean(window.MMW_READONLY),
          hierarchyId: hierarchy ? hierarchy.id : null,
          hierarchyChildren: hierarchy ? (hierarchy.children || []).length : -1,
          firstChildId: hierarchy && hierarchy.children && hierarchy.children[0]
            ? hierarchy.children[0].id
            : null,
        };
      });
      const beforeChildren = await page.evaluate((id) => {
        const hierarchy = typeof currentHierarchy !== 'undefined' ? currentHierarchy : null;
        const walk = (node) => {
          if (!node) return -1;
          if (node.id === id) return node.children ? node.children.length : 0;
          if (Array.isArray(node.children)) {
            for (const child of node.children) {
              const found = walk(child);
              if (found !== -1) return found;
            }
          }
          return -1;
        };
        return walk(hierarchy);
      }, targetId);
      await page.locator('.context-menu [data-action="expandMindMapNode"]').click();
      await page.waitForFunction(
        () => {
          const loader = document.getElementById('node-expand-loader');
          return !loader || !loader.classList.contains('active');
        },
        null,
        { timeout: 120000 },
      );
      await waitForIdle(page);
      const revertActive = (await page.locator('#revert-changes-container.active').count().catch(() => 0)) > 0;
      const afterExpand = await nodeCount(page);
      const afterChildren = await page.evaluate((id) => {
        const hierarchy = typeof currentHierarchy !== 'undefined' ? currentHierarchy : null;
        const walk = (node) => {
          if (!node) return -1;
          if (node.id === id) return node.children ? node.children.length : 0;
          if (Array.isArray(node.children)) {
            for (const child of node.children) {
              const found = walk(child);
              if (found !== -1) return found;
            }
          }
          return -1;
        };
        return walk(hierarchy);
      }, targetId);
      const snackbarText = await page.locator('.snackbar-message').allTextContents().catch(() => []);
      expandOk = revertActive || afterExpand !== beforeExpand || afterChildren !== beforeChildren;
      record(
        'ai: UI expand node completes',
        expandOk,
        `revert=${revertActive} before=${beforeExpand}/${beforeChildren} after=${afterExpand}/${afterChildren} snackbar=${snackbarText.join(' | ').slice(0, 120)} pre=${JSON.stringify(preDiag)}`,
      );
      break;
    }
  }
  if (!expandMenuFound) record('ai: UI expand node completes', false, 'no eligible node found');

  // UI: AI research node
  const beforeResearch = await nodeCount(page);
  const researchMenu = await openContextMenu(page, 1, 'aiResearchNode');
  if (researchMenu) {
    await page.locator('.context-menu [data-action="aiResearchNode"]').click();
    await waitForIdle(page);
    const afterResearch = await nodeCount(page);
    record('ai: UI research node adds nodes', afterResearch > beforeResearch, `before=${beforeResearch} after=${afterResearch}`);
  } else {
    record('ai: UI research node adds nodes', false, 'context menu action missing');
  }

  // UI: insert submenu -> generate ideas auto
  const beforeIdeas = await nodeCount(page);
  if (await openContextMenu(page, 1, 'showInsertSubmenu')) {
    await page.locator('.context-menu [data-action="showInsertSubmenu"]').hover();
    await page.waitForSelector('#insert-ai-submenu', { timeout: 5000 });
    await page.locator('#insert-ai-submenu .context-menu-button').nth(0).click();
    await waitForIdle(page);
    const afterIdeas = await nodeCount(page);
    record('ai: UI insert ideas auto adds nodes', afterIdeas > beforeIdeas, `before=${beforeIdeas} after=${afterIdeas}`);
  } else {
    record('ai: UI insert ideas auto adds nodes', false, 'submenu missing');
  }

  // UI: insert submenu -> work breakdown
  const beforeWork = await nodeCount(page);
  if (await openContextMenu(page, 1, 'showInsertSubmenu')) {
    await page.locator('.context-menu [data-action="showInsertSubmenu"]').hover();
    await page.waitForSelector('#insert-ai-submenu', { timeout: 5000 });
    await page.locator('#insert-ai-submenu .context-menu-button').nth(2).click();
    await waitForIdle(page);
    const afterWork = await nodeCount(page);
    record('ai: UI work breakdown adds nodes', afterWork > beforeWork, `before=${beforeWork} after=${afterWork}`);
  } else {
    record('ai: UI work breakdown adds nodes', false, 'submenu missing');
  }

  // Direct XMindAI actions against the local model
  const nodeId = await page.evaluate(() => {
    const candidates = [];
    const walk = (node) => {
      if (!node) return;
      if (node.children && node.children.length > 0) candidates.push(node.id);
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    if (window.currentHierarchy) walk(window.currentHierarchy);
    return candidates[0] || document.querySelector('#mindmap svg .mm-node')?.getAttribute('data-node-id');
  });

  const directCases = [
    ['brainstorm', []],
    ['expand', []],
    ['explain', []],
    ['generateIdeasAuto', []],
    ['generateIdeasPrompt', ['focus on web performance']],
    ['generateExplanation', []],
    ['workBreakdown', []],
    ['ask', ['What is the main idea?']],
  ];
  for (const [action, args] of directCases) {
    try {
      const result = await page.evaluate(async ({ action, nodeId, args }) => {
        if (action === 'ask') return window.XMindAI.actions.ask(args[0], nodeId);
        return window.XMindAI.actions[action](nodeId, ...args);
      }, { action, nodeId, args });
      const ok = result && result.success;
      record(`ai: direct ${action}`, ok, JSON.stringify(result).slice(0, 120));
    } catch (err) {
      record(`ai: direct ${action}`, false, String(err).slice(0, 300));
    }
  }

  // Direct actions that need a node with children
  for (const action of ['summarize', 'restructure', 'polish']) {
    try {
      const result = await page.evaluate(async ({ action, nodeId }) => {
        return window.XMindAI.actions[action](nodeId);
      }, { action, nodeId });
      const ok = action === 'summarize'
        ? Boolean(result && result.summary)
        : Boolean(result && result.success);
      record(`ai: direct ${action}`, ok, JSON.stringify(result).slice(0, 120));
    } catch (err) {
      record(`ai: direct ${action}`, false, String(err).slice(0, 300));
    }
  }

  const networkIssues = issues.filter((i) => i.kind.startsWith('http-') || i.kind === 'requestfailed');
  record('ai: no failed requests or 4xx/5xx', networkIssues.length === 0, JSON.stringify(networkIssues.slice(0, 5)));
}

try {
  await run();
} catch (err) {
  issues.push({ kind: 'script-error', label: 'ai-features', text: String(err).slice(0, 800) });
} finally {
  await browser.close().catch(() => {});
  console.log('AI_AUDIT_START');
  console.log(JSON.stringify({ results, issues }, null, 2));
  console.log('AI_AUDIT_END');
}
