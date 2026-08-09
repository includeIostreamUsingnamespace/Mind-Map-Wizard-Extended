import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:8333';
const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
await context.addInitScript(() => {
  try {
    localStorage.setItem('mmw-ai-provider', 'ollama');
    localStorage.setItem('mmw-ollama-base-url', 'http://127.0.0.1:11434');
    localStorage.setItem('preferred-model', 'sam860/dolphin3-qwen2.5:1.5b');
    localStorage.setItem('last-used-model', 'sam860/dolphin3-qwen2.5:1.5b');
  } catch (err) {
    // about:blank has no localStorage.
  }
});
const page = await context.newPage();
page.on('dialog', (dialog) => dialog.accept().catch(() => {}));

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.locator('a.manual-btn').click();
await page.waitForSelector('#mindmap svg .mm-node', { timeout: 10000 });
await page.waitForTimeout(400);

async function openMenu(index = 1) {
  await page.evaluate(() => {
    document
      .querySelectorAll('.context-menu, #insert-ai-submenu, .polish-direction-popup, .polish-direction-overlay')
      .forEach((el) => el.remove());
  });
  await page.waitForTimeout(200);
  await page.locator('#mindmap svg .mm-node').nth(index).click({ button: 'right' });
  await page.waitForSelector('.context-menu', { timeout: 5000 });
}

// Insert submenu colors
await openMenu(1);
await page.locator('.context-menu [data-action="showInsertSubmenu"]').hover();
await page.waitForSelector('#insert-ai-submenu', { timeout: 5000 });
const submenuStyle = await page.evaluate(() => {
  const menu = document.getElementById('insert-ai-submenu');
  const btn = menu.querySelector('.context-menu-button');
  const menuStyle = getComputedStyle(menu);
  const btnStyle = getComputedStyle(btn);
  return {
    menuBg: menuStyle.backgroundColor,
    menuColor: menuStyle.color,
    btnBg: btnStyle.backgroundColor,
    btnColor: btnStyle.color,
  };
});
record(
  'insert submenu has readable colors',
  submenuStyle.btnColor !== submenuStyle.menuBg && submenuStyle.btnColor !== 'rgb(255, 255, 255)',
  JSON.stringify(submenuStyle),
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Polish direction popup
await openMenu(1);
await page.locator('.context-menu [data-action="aiPolishNode"]').click();
await page.waitForSelector('.polish-direction-popup', { timeout: 5000 });
const polishOptions = await page.locator('.polish-direction-popup [data-direction]').allTextContents();
record(
  'polish direction popup shows options',
  (await page.locator('.polish-direction-popup').isVisible()) && polishOptions.length >= 4,
  polishOptions.join(', '),
);
const polishDialog = page.waitForEvent('dialog', { timeout: 60000 }).catch(() => null);
await page.locator('.polish-direction-popup [data-direction="更精简"]').click();
const polishIndicator = await page
  .waitForSelector('.ai-working-indicator.active', { timeout: 5000 })
  .then(() => true)
  .catch(() => false);
record('polish direction flow shows working indicator', polishIndicator);
await page
  .waitForFunction(() => !document.querySelector('.ai-working-indicator.active'), null, { timeout: 60000 })
  .catch(() => {});
const polishDialogResult = await polishDialog;
record(
  'polish direction flow completes',
  Boolean(polishDialogResult),
  polishDialogResult ? polishDialogResult.message().slice(0, 80) : 'no dialog',
);

// AI working indicator
await page.evaluate(() => window.showAiWorking('AI 正在测试...'));
await page.waitForSelector('.ai-working-indicator.active', { timeout: 3000 });
const workingText = await page.locator('.ai-working-indicator span').textContent();
record('ai working indicator appears', (await page.locator('.ai-working-indicator.active').count()) > 0, workingText);
await page.evaluate(() => window.hideAiWorking());
await page.waitForTimeout(400);
record('ai working indicator hides', (await page.locator('.ai-working-indicator.active').count()) === 0);

// Revert button sizing
const revertBox = await page.evaluate(() => {
  const el = document.getElementById('revert-changes-container');
  el.classList.add('active');
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const result = {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    padding: style.padding,
    minWidth: style.minWidth,
    fontSize: style.fontSize,
  };
  el.classList.remove('active');
  return result;
});
record(
  'revert button has comfortable size',
  revertBox.width >= 220 && revertBox.height >= 40,
  JSON.stringify(revertBox),
);

await browser.close();

console.log('UI_FIX_VERIFY_START');
console.log(JSON.stringify({ results }, null, 2));
console.log('UI_FIX_VERIFY_END');
