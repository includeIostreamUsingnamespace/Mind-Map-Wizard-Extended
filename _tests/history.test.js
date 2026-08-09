// new.js saveMindmapToHistory 历史记录去重与上限测试
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

const MM = (title) => JSON.stringify({ 'mm-node': { content: title, children: [] } });

beforeAll(async () => {
  await loadApp();
  localStorage.clear();
});

describe('saveMindmapToHistory', () => {
  it('相同内容（结构一致）保存两次只保留一条', () => {
    localStorage.clear();
    saveMindmapToHistory(MM('示例'));
    saveMindmapToHistory(MM('示例'));
    const h = JSON.parse(localStorage.getItem('mindmap-history'));
    expect(h).toHaveLength(1);
  });

  it('仅 mm-settings 不同的相同内容视为重复（去重更新）', () => {
    localStorage.clear();
    const base = MM('主题');
    const withSettings = JSON.stringify({
      'mm-node': { content: '主题', children: [] },
      'mm-settings': { branchWidth: 4 }
    });
    saveMindmapToHistory(base);
    saveMindmapToHistory(withSettings);
    const h = JSON.parse(localStorage.getItem('mindmap-history'));
    expect(h).toHaveLength(1);
  });

  it('不同内容追加为多条', () => {
    localStorage.clear();
    saveMindmapToHistory(MM('A'));
    saveMindmapToHistory(MM('B'));
    const h = JSON.parse(localStorage.getItem('mindmap-history'));
    expect(h).toHaveLength(2);
  });

  it('非法 JSON 时按字符串相等比较，不抛错', () => {
    localStorage.clear();
    expect(() => {
      saveMindmapToHistory('not-json');
      saveMindmapToHistory('not-json');
    }).not.toThrow();
    const h = JSON.parse(localStorage.getItem('mindmap-history'));
    expect(h).toHaveLength(1);
  });

  it('超过 100 条时移除最旧的记录', () => {
    localStorage.clear();
    for (let i = 0; i < 105; i++) {
      saveMindmapToHistory(MM(`主题-${i}`));
    }
    const h = JSON.parse(localStorage.getItem('mindmap-history'));
    expect(h.length).toBe(100);
    expect(h[0].mindmap).toContain('主题-5');
    expect(h[99].mindmap).toContain('主题-104');
  });
});
