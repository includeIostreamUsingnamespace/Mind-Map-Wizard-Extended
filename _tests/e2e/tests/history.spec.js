// 历史记录：示例渲染写入历史、侧栏列表、清空历史确认流程
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

test('渲染示例后写入本地历史且重复渲染不重复追加', async ({ page }) => {
  await renderExample(page);
  await page.waitForTimeout(600);

  const count1 = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('mindmap-history') || '[]');
    return h.length;
  });
  expect(count1).toBeGreaterThan(0);

  // 再次渲染相同示例：去重逻辑不应新增条目
  await page.locator('#new-mind-map-button').click();
  await expect(page.locator('#header')).toBeVisible();
  await renderExample(page);
  await page.waitForTimeout(600);
  const count2 = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('mindmap-history') || '[]');
    return h.length;
  });
  expect(count2).toBe(count1);
});

test('左侧栏显示历史列表并可打开', async ({ page }) => {
  await renderExample(page);
  await page.waitForTimeout(600);

  await page.locator('#leftSidebarToggle').click();
  await expect(page.locator('#leftSidebar')).toHaveClass(/open/);
  await expect(page.locator('#leftSidebarMindmapList')).not.toBeEmpty();
});

test('清空历史：确认后本地历史为空', async ({ page }) => {
  await renderExample(page);
  await page.waitForTimeout(600);
  const hasHistory = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('mindmap-history') || '[]');
    return h.length > 0;
  });
  expect(hasHistory).toBe(true);

  // 打开设置菜单 → 清空历史 → 确认（confirmClear 会刷新页面）
  await page.locator('.info-button').click();
  await expect(page.locator('.info-menu')).toHaveClass(/show/);
  await page.locator('.clear-history-button').click();
  await expect(page.locator('#clearHistoryPopup')).toBeVisible();
  await page.locator('#clearHistoryPopup .dialog-button.delete').click();
  await page.waitForLoadState('load');

  const cleared = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('mindmap-history') || '[]');
    return h.length;
  });
  expect(cleared).toBe(0);
});

test('清空历史：取消不删除', async ({ page }) => {
  await renderExample(page);
  await page.waitForTimeout(600);

  await page.locator('.info-button').click();
  await page.locator('.clear-history-button').click();
  await expect(page.locator('#clearHistoryPopup')).toBeVisible();
  await page.locator('#clearHistoryPopup .dialog-button.cancel').click();
  await expect(page.locator('#clearHistoryPopup')).toBeHidden();

  const kept = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('mindmap-history') || '[]');
    return h.length;
  });
  expect(kept).toBeGreaterThan(0);
});
