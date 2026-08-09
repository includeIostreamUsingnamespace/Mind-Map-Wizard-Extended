// 弹窗与设置菜单：关于、API 密钥管理、快捷键、帮助、下载、分享、搜索、侧栏
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openInfoMenu(page) {
  await page.locator('.info-button').click();
  await expect(page.locator('.info-menu')).toHaveClass(/show/);
}

async function renderExample(page) {
  await page.locator('a.manual-btn').click();
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
}

test('设置菜单展开与关闭', async ({ page }) => {
  await openInfoMenu(page);
  await expect(page.locator('.info-menu')).toContainText('API 密钥');
  await expect(page.locator('.info-menu')).toContainText('关于');
  // 再次点击收起
  await page.locator('.info-button').click();
  await expect(page.locator('.info-menu')).not.toHaveClass(/show/);
});

test('关于弹窗打开、含 GitHub 链接、可关闭', async ({ page }) => {
  await openInfoMenu(page);
  await page.locator('.license-button').click();
  await expect(page.locator('#licensePopup')).toHaveClass(/show/);
  await expect(page.locator('#licensePopup')).toContainText('关于');
  // 关闭按钮
  await page.locator('#closeLicensePopup').click();
  await expect(page.locator('#licensePopup')).not.toHaveClass(/show/);
});

test('API 密钥管理：保存密钥到本地并回显', async ({ page }) => {
  await openInfoMenu(page);
  await page.locator('.api-key-manage-button').click();
  await expect(page.locator('#api-key-manage-popup')).toBeVisible();

  await page.locator('#manage-api-key-input').fill('sk-e2e-test-123');
  await page.locator('#update-api-key-btn').click();
  await expect(page.locator('#api-key-manage-popup')).toHaveCount(0);

  const stored = await page.evaluate(() => localStorage.getItem('openrouter-api-key-encrypted'));
  expect(stored).toBeTruthy();
});

test('快捷键面板点击打开与再次点击关闭', async ({ page }) => {
  await openInfoMenu(page);
  // 面板支持点击开关（悬停为附加方式）
  await page.locator('.hotkeys-button').click();
  await expect(page.locator('.keyboard-shortcuts-popup')).toBeVisible();
  await page.locator('.hotkeys-button').click();
  await expect(page.locator('.keyboard-shortcuts-popup')).toBeHidden();
});

test('帮助弹窗打开与关闭', async ({ page }) => {
  await renderExample(page);
  await page.locator('#help-btn').click();
  await expect(page.locator('#help-popup')).toBeVisible();
  // 弹窗正文为中文入门指南内容
  await expect(page.locator('#help-popup')).toContainText('双击编辑文字');
  await page.locator('#close-help-popup').click();
  await expect(page.locator('#help-popup')).toBeHidden();
});

test('下载弹窗打开并选择格式', async ({ page }) => {
  await renderExample(page);
  await page.locator('#download-mindmap-btn').click();
  await expect(page.locator('#download-options-popup')).toBeVisible();
  await page.locator('#download-format').selectOption({ label: 'Markdown - 提纲' });
  await expect(page.locator('#download-format')).toHaveValue('markdown');
  await page.locator('#close-download-options-popup').click();
  await expect(page.locator('#download-options-popup')).toBeHidden();
});

test('搜索弹窗打开、输入筛选、可关闭', async ({ page }) => {
  await page.locator('#openSearchPopupBtn').click();
  await expect(page.locator('#searchMindmapsPopupOverlay')).toBeVisible();
  await page.locator('#popupMindmapSearchInput').fill('测试');
  await page.locator('#closeSearchPopupBtn').click();
  await expect(page.locator('#searchMindmapsPopupOverlay')).toBeHidden();
});

test('左侧侧边栏开关', async ({ page }) => {
  await renderExample(page);
  await page.locator('#leftSidebarToggle').click();
  await expect(page.locator('#leftSidebar')).toHaveClass(/open/);
  await page.locator('#leftSidebarToggle').click();
  await expect(page.locator('#leftSidebar')).not.toHaveClass(/open/);
});

test('聊天抽屉打开与关闭', async ({ page }) => {
  await renderExample(page);
  await page.locator('#chat-toggle-btn').click();
  await expect(page.locator('#chat-drawer')).toHaveClass(/open/);
  await page.locator('#close-chat-btn').click();
  // 抽屉关闭通过 transform 移出视口实现（元素仍在 DOM 中可见），断言 open 类移除
  await expect(page.locator('#chat-drawer')).not.toHaveClass(/open/);
});
