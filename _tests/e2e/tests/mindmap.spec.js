// 思维导图交互：节点选中/右键菜单/编辑/键盘快捷键/撤销重做/缩放/自定义/浏览器回退
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function renderExample(page) {
  await page.locator('a.manual-btn').click();
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
}

async function nodeCount(page) {
  return page.locator('#mindmap svg .mm-node').count();
}

// 单击节点后应用需等待 clickDelay(360ms) 才设置 currentNodeElement（同时弹出菜单），
// 因此选中后需等待一段时间再继续操作
async function selectNode(page, index = 1) {
  await page.locator('#mindmap svg .mm-node').nth(index).click();
  await page.waitForTimeout(500);
}

test('示例渲染出多个节点且可选中', async ({ page }) => {
  await renderExample(page);
  expect(await nodeCount(page)).toBeGreaterThanOrEqual(3);
  await selectNode(page, 0);
  const selectedId = await page.evaluate(() => window.currentNodeElement?.getAttribute('data-node-id'));
  expect(selectedId).toBeTruthy();
});

test('右键节点弹出上下文菜单，可添加分支', async ({ page }) => {
  await renderExample(page);
  const before = await nodeCount(page);
  const node = page.locator('#mindmap svg .mm-node').first();
  await node.click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(page.locator('.context-menu')).toContainText('添加分支');
  await page.locator('.context-menu [data-action="addChildNode"]').click();
  await expect(page.locator('.context-menu')).toBeHidden();
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeGreaterThan(before);
});

test('右键添加同级节点', async ({ page }) => {
  await renderExample(page);
  const before = await nodeCount(page);
  const node = page.locator('#mindmap svg .mm-node').nth(1);
  await node.click({ button: 'right' });
  await expect(page.locator('.context-menu')).toBeVisible();
  await page.locator('.context-menu [data-action="addSiblingNode"]').click();
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeGreaterThan(before);
});

test('双击节点进入编辑并可提交文本', async ({ page }) => {
  await renderExample(page);
  const node = page.locator('#mindmap svg .mm-node').nth(1);
  await node.dblclick();
  const editor = page.locator('.node-edit-fo [contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.fill('被修改的节点');
  await editor.press('Enter');
  await expect(page.locator('.node-edit-fo')).toHaveCount(0);
  await expect(page.locator('#mindmap svg .mm-node').filter({ hasText: '被修改的节点' })).toHaveCount(1);
});

test('Tab 添加子节点', async ({ page }) => {
  await renderExample(page);
  const before = await nodeCount(page);

  // 单击节点会延迟弹出上下文菜单并遮挡节点，后续左键会被菜单拦截；
  // 改用右键选中（同步设置 currentNodeElement），键盘操作会自动关闭菜单
  await page.locator('#mindmap svg .mm-node').nth(1).click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeGreaterThan(before);
});

test('Enter 添加同级节点', async ({ page }) => {
  await renderExample(page);
  const before = await nodeCount(page);

  await page.locator('#mindmap svg .mm-node').nth(1).click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeGreaterThan(before);
});

test('Delete 删除选中节点', async ({ page }) => {
  await renderExample(page);
  const before = await nodeCount(page);

  await page.locator('#mindmap svg .mm-node').nth(1).click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeLessThan(before);
});

test('撤销与重做按钮可用', async ({ page }) => {
  await renderExample(page);
  const undo = page.locator('#mm-undo-btn');
  await expect(undo).toBeDisabled();

  await selectNode(page, 1);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  const afterAdd = await nodeCount(page);

  await expect(undo).toBeEnabled();
  await undo.click();
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBeLessThan(afterAdd);

  const redo = page.locator('#mm-redo-btn');
  await expect(redo).toBeEnabled();
  await redo.click();
  await page.waitForTimeout(300);
  expect(await nodeCount(page)).toBe(afterAdd);
});

test('缩放按钮与适应屏幕', async ({ page }) => {
  await renderExample(page);
  const svg = page.locator('#mindmap svg');
  // 缩放通过 SVG 的 CSS transform scale 实现（viewBox 不变）
  const readTransform = () => svg.evaluate(el => el.style.transform || el.getAttribute('transform') || '');
  const tBefore = await readTransform();
  await page.locator('#zoom-in-btn').click();
  await page.waitForTimeout(400);
  const tAfterIn = await readTransform();
  expect(tAfterIn).not.toBe(tBefore);
  await page.locator('#mm-fit').click();
  await page.waitForTimeout(400);
});

test('自定义面板打开并可调节间距', async ({ page }) => {
  await renderExample(page);
  await page.locator('#customize-mode-button').click();
  await expect(page.locator('#mmCustomizationPanel')).toBeVisible();
  await page.locator('#spacingRange').fill('60');
  await page.locator('#save-edit').click();
  await expect(page.locator('#mmCustomizationPanel')).toBeHidden();
});

test('拖拽节点不报错', async ({ page }) => {
  await renderExample(page);
  const node = page.locator('#mindmap svg .mm-node').first();
  const box = await node.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  // 拖动后页面无错误横幅，导图仍在
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
  await expect(page.locator('#inAppErrorMessage')).toBeHidden();
});

test('浏览器回退最终回到主页', async ({ page }) => {
  await page.goto('/?manual=true');
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
  // 应用打开导图时 pushState 写入 ?id=，需后退两步回到主页
  await page.goBack();
  await page.goBack();
  await expect(page.locator('#header')).toBeVisible();
});
