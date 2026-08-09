// 主页交互：页面加载、表单、按钮、下拉、快速点击
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('页面加载显示核心元素', async ({ page }) => {
  await expect(page).toHaveTitle(/思维导图/);
  await expect(page.locator('#prompt')).toBeVisible();
  await expect(page.locator('#generate-mindmap-btn')).toBeVisible();
  await expect(page.locator('#new-mind-map-button')).toBeVisible();
  await expect(page.locator('#openSearchPopupBtn')).toBeVisible();
  await expect(page.locator('a.manual-btn')).toHaveText('示例');
  await expect(page.locator('a.upload-pdf-button')).toHaveText('上传');
});

test('输入主题点击生成：无 API 密钥时弹出密钥窗口并可关闭', async ({ page }) => {
  await page.locator('#prompt').fill('JavaScript 学习路线');
  await page.locator('#generate-mindmap-btn').click();
  await expect(page.locator('#api-key-popup')).toBeVisible();
  await expect(page.locator('#api-key-popup')).toContainText('OpenRouter');

  // 关闭弹窗后主页恢复正常
  await page.locator('#close-api-key-popup').click();
  await expect(page.locator('#api-key-popup')).toHaveCount(0);
  await expect(page.locator('#header')).toBeVisible();
});

test('空输入点击生成不弹窗、不崩溃', async ({ page }) => {
  await page.locator('#generate-mindmap-btn').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#api-key-popup')).toHaveCount(0);
  await expect(page.locator('#header')).toBeVisible();
});

test('快速双击生成只出现一个弹窗', async ({ page }) => {
  // 生成按钮在首次点击后即隐藏，改用真实函数连续调用验证防重入
  await page.evaluate(() => {
    window.generateMindmap('重复点击');
    window.generateMindmap('重复点击');
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#api-key-popup')).toHaveCount(1);
});

test('模型下拉可展开并可搜索', async ({ page }) => {
  await page.locator('#model-dropdown-btn').click();
  await expect(page.locator('#model-dropdown')).toHaveClass(/open/);
  await page.locator('#model-search').fill('gpt');
  await expect(page.locator('#model-options')).not.toBeEmpty();

  // 点击空白处收起
  await page.locator('#prompt').click();
  await expect(page.locator('#model-dropdown')).not.toHaveClass(/open/);
});

test('联网搜索开关切换并持久化', async ({ page }) => {
  const checkbox = page.locator('#web-search-checkbox');
  // 复选框视觉隐藏，点击自定义开关 label 触发切换
  const toggle = page.locator('#web-search-toggle .toggle-switch');
  expect(await checkbox.isChecked()).toBe(true);
  await toggle.click();
  expect(await checkbox.isChecked()).toBe(false);
  const stored = await page.evaluate(() => localStorage.getItem('mmw-web-search-enabled'));
  expect(stored).toBe('false');
  await toggle.click();
  expect(await checkbox.isChecked()).toBe(true);
});

test('Enter 键提交生成', async ({ page }) => {
  await page.locator('#prompt').fill('快捷键主题');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#api-key-popup')).toBeVisible();
});

test('点击示例渲染思维导图并显示工具栏', async ({ page }) => {
  await page.locator('a.manual-btn').click();
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
  await expect(page.locator('#button-container')).toBeVisible();
  // 工具栏按钮齐全
  await expect(page.locator('#share-btn')).toBeVisible();
  await expect(page.locator('#download-mindmap-btn')).toBeVisible();
  await expect(page.locator('#regenerate-button')).toBeVisible();
  await expect(page.locator('#help-btn')).toBeVisible();
  await expect(page.locator('#chat-toggle-btn')).toBeVisible();
});

test('新思维导图按钮从已渲染状态返回主页', async ({ page }) => {
  await page.locator('a.manual-btn').click();
  await expect(page.locator('#mindmap svg .mm-node').first()).toBeVisible();
  await page.locator('#new-mind-map-button').click();
  await expect(page.locator('#header')).toBeVisible();
});
