// renderer.js hierarchyToJson 单元测试
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

beforeAll(async () => {
  await loadApp();
  window.isImageRef = (s) => typeof s === 'string' && s.startsWith('image:');
});

describe('hierarchyToJson', () => {
  it('完整字段序列化', () => {
    const hierarchy = {
      children: [{
        text: 'Root',
        collapsed: true,
        branchColor: '#ff0000',
        notes: 'some note',
        citations: [{ url: 'https://example.com' }],
        checked: true,
        children: [
          { text: 'Leaf', children: [] }
        ]
      }]
    };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    const root = parsed['mm-node'];
    expect(root.content).toBe('Root');
    expect(root.collapsed).toBe(true);
    expect(root.branchColor).toBe('#ff0000');
    expect(root.notes).toBe('some note');
    expect(root.citations).toEqual([{ url: 'https://example.com' }]);
    expect(root.checked).toBe(true);
    expect(root.children[0].content).toBe('Leaf');
  });

  it('空文本/缺失 children 兜底为空串/空数组', () => {
    const hierarchy = { children: [{ text: '', children: [] }] };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    expect(parsed['mm-node']).toEqual({ content: '', children: [] });
  });

  it('checked=false 也保留（不能因 falsy 丢失）', () => {
    const hierarchy = { children: [{ text: 'x', checked: false, children: [] }] };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    expect(parsed['mm-node'].checked).toBe(false);
  });

  it('空 hierarchy 生成空根节点', () => {
    const parsed = JSON.parse(hierarchyToJson({ children: [] }));
    expect(parsed['mm-node']).toEqual({ content: '', children: [] });
  });

  it('imageSize 仅在文本是图片引用且 isImageRef 存在时保留', () => {
    const hierarchy = { children: [{ text: 'image:abc', imageSize: 'medium', children: [] }] };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    expect(parsed['mm-node'].imageSize).toBe('medium');
  });

  it('普通文本节点不保留 imageSize', () => {
    const hierarchy = { children: [{ text: 'plain', imageSize: 'medium', children: [] }] };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    expect(parsed['mm-node'].imageSize).toBeUndefined();
  });

  it('多层级深嵌套正确转换', () => {
    const hierarchy = {
      children: [{
        text: 'L0',
        children: [{
          text: 'L1',
          children: [{ text: 'L2', children: [{ text: 'L3', children: [] }] }]
        }]
      }]
    };
    const parsed = JSON.parse(hierarchyToJson(hierarchy));
    expect(parsed['mm-node'].children[0].children[0].children[0].content).toBe('L3');
  });
});
