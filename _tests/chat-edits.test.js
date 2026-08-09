// chat-edits.js 树操作单元测试：正常路径 + 边界（空值/不存在/根节点/深层嵌套）
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

let T;
beforeAll(async () => {
  await loadApp();
  T = window.__mmwChatEditTestExports;
});

function mkTree() {
  return {
    'mm-node': {
      id: 'r1', content: 'Root', children: [
        { id: 'a1', content: 'A', children: [
          { id: 'a1a', content: 'A1', children: [] }
        ]},
        { id: 'b1', content: 'B', children: [] }
      ]
    }
  };
}

describe('findNode', () => {
  const root = mkTree()['mm-node'];

  it('命中根节点', () => {
    expect(T.findNode(root, 'r1').id).toBe('r1');
  });
  it('命中深层子节点', () => {
    expect(T.findNode(root, 'a1a').content).toBe('A1');
  });
  it('未找到返回 null', () => {
    expect(T.findNode(root, 'zzz')).toBeNull();
  });
  it('空树/undefined 不抛异常', () => {
    expect(T.findNode(undefined, 'x')).toBeNull();
    expect(T.findNode({ id: 'x' }, 'y')).toBeNull();
  });
});

describe('findParent', () => {
  const root = mkTree()['mm-node'];

  it('找到直接子节点的父节点', () => {
    expect(T.findParent(root, 'b1').id).toBe('r1');
  });
  it('找到深层孙节点的父节点', () => {
    expect(T.findParent(root, 'a1a').id).toBe('a1');
  });
  it('根节点无父节点', () => {
    expect(T.findParent(root, 'r1')).toBeNull();
  });
  it('未找到返回 null', () => {
    expect(T.findParent(root, 'nope')).toBeNull();
  });
  it('无 children 的节点返回 null 且不抛错', () => {
    expect(T.findParent({ id: 'leaf' }, 'anything')).toBeNull();
  });
});

describe('execDeleteNode', () => {
  it('删除叶子节点', () => {
    const t = mkTree();
    expect(T.execDeleteNode(t['mm-node'], 'b1')).toBe(true);
    expect(T.findNode(t['mm-node'], 'b1')).toBeNull();
    expect(t['mm-node'].children).toHaveLength(1);
  });
  it('删除子树（连同后代）', () => {
    const t = mkTree();
    expect(T.execDeleteNode(t['mm-node'], 'a1')).toBe(true);
    expect(T.findNode(t['mm-node'], 'a1a')).toBeNull();
  });
  it('根节点不可删除返回 false', () => {
    const t = mkTree();
    expect(T.execDeleteNode(t['mm-node'], 'r1')).toBe(false);
  });
  it('不存在的节点返回 false 且不改动树', () => {
    const t = mkTree();
    expect(T.execDeleteNode(t['mm-node'], 'ghost')).toBe(false);
    expect(T.findNode(t['mm-node'], 'a1a')).not.toBeNull();
  });
});

describe('execUpdateNode', () => {
  it('更新 content/notes/branchColor/collapsed/checked', () => {
    const t = mkTree();
    const ok = T.execUpdateNode(t['mm-node'], 'a1', {
      content: 'A-updated',
      notes: 'note',
      branchColor: '#ff0000',
      collapsed: true,
      checked: true
    });
    expect(ok).toBe(true);
    const n = T.findNode(t['mm-node'], 'a1');
    expect(n).toMatchObject({ content: 'A-updated', notes: 'note', branchColor: '#ff0000', collapsed: true, checked: true });
  });
  it('仅更新提供的字段，其余字段保持不变', () => {
    const t = mkTree();
    T.execUpdateNode(t['mm-node'], 'b1', { content: 'B-new' });
    const n = T.findNode(t['mm-node'], 'b1');
    expect(n.content).toBe('B-new');
    expect(n.children).toEqual([]);
  });
  it('更新 citations（数组）', () => {
    const t = mkTree();
    T.execUpdateNode(t['mm-node'], 'a1', { citations: [{ url: 'https://x.com' }] });
    expect(T.findNode(t['mm-node'], 'a1').citations).toEqual([{ url: 'https://x.com' }]);
  });
  it('不存在的节点返回 false', () => {
    const t = mkTree();
    expect(T.execUpdateNode(t['mm-node'], 'ghost', { content: 'x' })).toBe(false);
  });
  it('未找到节点时不抛错', () => {
    const t = mkTree();
    expect(() => T.execUpdateNode(t['mm-node'], undefined, { content: 'x' })).not.toThrow();
    expect(T.execUpdateNode(t['mm-node'], undefined, { content: 'x' })).toBe(false);
  });
});

describe('processChildrenWithIds / execAddNode', () => {
  it('给父节点添加子节点，内容默认为 New Node', () => {
    const t = mkTree();
    const newId = T.execAddNode(t['mm-node'], 'b1', {});
    expect(newId).toBeTruthy();
    const added = T.findNode(t['mm-node'], newId);
    expect(added.content).toBe('New Node');
    expect(added.children).toEqual([]);
  });
  it('添加带 children 的节点时递归生成 id', () => {
    const t = mkTree();
    const newId = T.execAddNode(t['mm-node'], 'b1', {
      content: 'C',
      children: [{ content: 'C1' }, { content: 'C2', children: [{ content: 'C2a' }] }]
    });
    const added = T.findNode(t['mm-node'], newId);
    expect(added.children).toHaveLength(2);
    expect(added.children[0].id).toBeTruthy();
    expect(added.children[0].id).not.toBe(added.children[1].id);
    expect(added.children[1].children[0].id).toBeTruthy();
    expect(added.children[1].children[0].content).toBe('C2a');
  });
  it('父节点不存在返回 null', () => {
    const t = mkTree();
    expect(T.execAddNode(t['mm-node'], 'ghost', {})).toBeNull();
  });
  it('nodeData 为 undefined 时不抛错', () => {
    const t = mkTree();
    expect(() => T.execAddNode(t['mm-node'], 'a1', undefined)).not.toThrow();
    expect(T.execAddNode(t['mm-node'], 'a1', undefined)).toBeTruthy();
  });
});

describe('applyCommands', () => {
  it('空命令返回 success:false 但不改动', () => {
    const t = mkTree();
    const r = T.applyCommands(t, []);
    expect(r.success).toBe(false);
    expect(r.modifiedMmJson).toBe(t);
  });
  it('缺失 mm-node 返回失败', () => {
    const r = T.applyCommands({ foo: 1 }, [{ action: 'delete', id: 'x' }]);
    expect(r.success).toBe(false);
    expect(r.logs[0]).toContain('Invalid Mind Map');
  });
  it('混合命令：成功删除/添加/更新并记录日志', () => {
    const t = mkTree();
    const r = T.applyCommands(t, [
      { action: 'delete', id: 'b1' },
      { action: 'add', id: 'a1', data: { content: 'NewChild' } },
      { action: 'update', id: 'a1', data: { content: 'A-v2' } }
    ]);
    expect(r.success).toBe(true);
    expect(r.logs.filter(l => l.startsWith('Deleted')).length).toBe(1);
    expect(r.logs.filter(l => l.startsWith('Added')).length).toBe(1);
    expect(r.logs.filter(l => l.startsWith('Updated')).length).toBe(1);
    expect(T.findNode(t['mm-node'], 'b1')).toBeNull();
    expect(T.findNode(t['mm-node'], 'a1').content).toBe('A-v2');
  });
  it('删除根节点被拒绝并记录失败', () => {
    const t = mkTree();
    const r = T.applyCommands(t, [{ action: 'delete', id: 'r1' }]);
    expect(r.success).toBe(false);
    expect(r.logs[0]).toContain('Failed to delete');
  });
  it('未知 action 记录日志但不成功', () => {
    const t = mkTree();
    const r = T.applyCommands(t, [{ action: 'explode', id: 'a1' }]);
    expect(r.success).toBe(false);
    expect(r.logs[0]).toContain('Unknown action');
  });
  it('update id=mm-settings 更新全局设置', () => {
    const t = mkTree();
    const r = T.applyCommands(t, [{ action: 'update', id: 'mm-settings', data: { branchWidth: 5 } }]);
    expect(r.success).toBe(true);
    expect(t['mm-settings']).toEqual({ branchWidth: 5 });
  });
  it('update-settings 合并设置', () => {
    const t = mkTree();
    t['mm-settings'] = { spacing: 20 };
    const r = T.applyCommands(t, [{ action: 'update-settings', data: { spacing: 40 } }]);
    expect(r.success).toBe(true);
    expect(t['mm-settings']).toEqual({ spacing: 40 });
  });
  it('命令缺少 id 时不抛错并记录', () => {
    const t = mkTree();
    expect(() => T.applyCommands(t, [{ action: 'delete' }])).not.toThrow();
    const r = T.applyCommands(t, [{ action: 'delete' }]);
    expect(r.logs.some(l => l.includes('Failed to delete'))).toBe(true);
  });
  it('contact-team 视为成功', () => {
    const t = mkTree();
    const r = T.applyCommands(t, [{ action: 'contact-team' }]);
    expect(r.success).toBe(true);
  });
});
