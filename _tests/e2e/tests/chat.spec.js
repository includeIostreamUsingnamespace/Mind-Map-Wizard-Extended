// 聊天抽屉与消息发送
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

test('聊天抽屉打开、空输入不发送', async ({ page }) => {
  await renderExample(page);
  await page.locator('#chat-toggle-btn').click();
  await expect(page.locator('#chat-drawer')).toBeVisible();
  await expect(page.locator('#chat-input')).toBeVisible();

  // 空输入点击发送：不新增用户消息
  await page.locator('#chat-send-btn').click();
  await page.waitForTimeout(300);
  expect(await page.locator('.chat-message.user').count()).toBe(0);
});

test('未配置密钥发送消息弹出 API 密钥窗口', async ({ page }) => {
  await renderExample(page);
  await page.locator('#chat-toggle-btn').click();
  await page.locator('#chat-input').fill('把导图优化一下');
  await page.locator('#chat-send-btn').click();
  await expect(page.locator('#api-key-popup')).toBeVisible();
});

test('聊天输入支持回车发送', async ({ page }) => {
  await renderExample(page);
  await page.locator('#chat-toggle-btn').click();
  await page.locator('#chat-input').fill('回车发送测试');
  await page.locator('#chat-input').press('Enter');
  await expect(page.locator('#api-key-popup')).toBeVisible();
});
