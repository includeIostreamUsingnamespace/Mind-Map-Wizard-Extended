// chat-ui.js addSystemMessage XSS 回归测试
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

let cm;
beforeAll(async () => {
  await loadApp();
  cm = window.chatManager;
});

describe('addSystemMessage', () => {
  it('聊天管理器在 DOMContentLoaded 后创建', () => {
    expect(cm).toBeTruthy();
    expect(cm.messagesContainer).toBeTruthy();
  });

  it('普通文本正常显示', () => {
    cm.addSystemMessage('你好，世界');
    const last = cm.messagesContainer.lastElementChild;
    expect(last.textContent).toContain('你好，世界');
  });

  it('HTML 内容以纯文本显示，不生成元素（防 XSS）', () => {
    cm.addSystemMessage('<img src=x onerror=window.__pwned=1>');
    const last = cm.messagesContainer.lastElementChild;
    // 攻击 payload 不应被执行成 img 元素
    expect(last.querySelector('img')).toBeNull();
    // 文本按字面量保留
    expect(last.textContent).toContain('<img src=x onerror=window.__pwned=1>');
    expect(window.__pwned).toBeUndefined();
  });

  it('错误消息带 error 样式类', () => {
    cm.addSystemMessage('出错了', true);
    const last = cm.messagesContainer.lastElementChild;
    expect(last.className).toContain('error');
  });

  it('空消息不抛错', () => {
    expect(() => cm.addSystemMessage('')).not.toThrow();
    expect(() => cm.addSystemMessage(null)).not.toThrow();
  });
});
