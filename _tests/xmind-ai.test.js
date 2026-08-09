// xmind-ai.js 单元测试：parseResponse / escapePrompt / toEditorJson
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

let T;
beforeAll(async () => {
  await loadApp();
  T = window.__mmwTestExports;
});

describe('parseResponse', () => {
  it('空输入返回 null', () => {
    expect(T.parseResponse('', 'brainstorm')).toBeNull();
    expect(T.parseResponse(null, 'brainstorm')).toBeNull();
    expect(T.parseResponse(undefined, 'brainstorm')).toBeNull();
  });

  it('纯 JSON 数组', () => {
    const r = T.parseResponse('["a", "b", "c"]', 'brainstorm');
    expect(r).toEqual(['a', 'b', 'c']);
  });

  it('纯 JSON 对象', () => {
    const r = T.parseResponse('{"groups": [{"name": "x"}]}', 'restructure');
    expect(r.groups).toHaveLength(1);
  });

  it('带 ```json 围栏', () => {
    const r = T.parseResponse('```json\n["x", "y"]\n```', 'brainstorm');
    expect(r).toEqual(['x', 'y']);
  });

  it('带 ``` 围栏（无 json 标记）', () => {
    const r = T.parseResponse('```\n["x"]\n```', 'brainstorm');
    expect(r).toEqual(['x']);
  });

  it('前置散文 + 内嵌 JSON 数组', () => {
    const text = 'Here are some ideas:\n["idea1", "idea2"]\nHope this helps!';
    expect(T.parseResponse(text, 'brainstorm')).toEqual(['idea1', 'idea2']);
  });

  it('字符串内部含花括号/方括号时不误判', () => {
    const text = 'Sure! Here: {"items": ["a {b} [c]", "d"]} Thanks';
    const r = T.parseResponse(text, 'brainstorm');
    expect(r.items[0]).toBe('a {b} [c]');
    expect(r.items[1]).toBe('d');
  });

  it('深嵌套对象正确提取', () => {
    const text = 'Result: {"a": {"b": {"c": [1, 2, {"d": 3}]}}} trailing';
    const r = T.parseResponse(text, 'brainstorm');
    expect(r.a.b.c[2].d).toBe(3);
  });

  it('text 模式（summarize/polish/ask）解析失败时返回原文', () => {
    const text = '这是一个总结，不是 JSON。';
    expect(T.parseResponse(text, 'summarize')).toBe(text);
    expect(T.parseResponse(text, 'polish')).toBe(text);
    expect(T.parseResponse(text, 'ask')).toBe(text);
  });

  it('非 text 模式完全无法解析时退回行列表', () => {
    const text = 'line one\n- line two\n3. third';
    const r = T.parseResponse(text, 'brainstorm');
    expect(Array.isArray(r)).toBe(true);
    expect(r).toEqual(['line one', 'line two', 'third']);
  });

  it('带转义引号的 JSON 字符串', () => {
    const r = T.parseResponse('["he said \\"hi\\""]', 'brainstorm');
    expect(r[0]).toBe('he said "hi"');
  });
});

describe('escapePrompt', () => {
  it('null/undefined 返回空串', () => {
    expect(T.escapePrompt(null)).toBe('');
    expect(T.escapePrompt(undefined)).toBe('');
  });
  it('转义引号和反斜杠', () => {
    expect(T.escapePrompt('a"b\\c')).toBe('a\\"b\\\\c');
  });
  it('换行/制表符替换为空格', () => {
    expect(T.escapePrompt('a\nb\tc')).toBe('a b c');
  });
  it('数字转字符串', () => {
    expect(T.escapePrompt(42)).toBe('42');
  });
});

describe('toEditorJson', () => {
  it('运行时结构 {children:[{text,children}]} 转为 mm-node 格式', () => {
    const data = {
      children: [
        { text: 'Root', children: [
          { text: 'Child', children: [] }
        ]}
      ]
    };
    const parsed = JSON.parse(T.toEditorJson(data));
    expect(parsed['mm-node'].content).toBe('Root');
    expect(parsed['mm-node'].children[0].content).toBe('Child');
  });

  it('空 hierarchy 生成空根节点', () => {
    const parsed = JSON.parse(T.toEditorJson({ children: [] }));
    expect(parsed['mm-node']).toEqual({ content: '', children: [] });
  });

  it('非 hierarchy 数据（无 children 数组）递归去除 parent 引用', () => {
    const data = { text: 'x', parent: { y: 1 }, notes: 'n' };
    const parsed = JSON.parse(T.toEditorJson(data));
    expect(parsed).toEqual({ text: 'x', notes: 'n' });
    expect(JSON.stringify(parsed)).not.toContain('parent');
  });
});

describe('genId / countNodes / findNode', () => {
  it('genId 生成不同 id', () => {
    const a = T.genId();
    const b = T.genId();
    expect(a).not.toBe(b);
  });
  it('countNodes 统计节点数', () => {
    const tree = { id: 1, children: [{ id: 2, children: [{ id: 3, children: [] }] }, { id: 4, children: [] }] };
    expect(T.countNodes(tree)).toBe(4);
  });
  it('findNode 命中嵌套节点', () => {
    const tree = { id: 1, children: [{ id: 2, children: [] }] };
    expect(T.findNode(tree, 2).id).toBe(2);
    expect(T.findNode(tree, 99)).toBeNull();
  });
});
