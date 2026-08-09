// notes.js XSS 防护函数测试
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

beforeAll(async () => {
  await loadApp();
});

describe('isSafeHttpUrl', () => {
  it('接受 http/https', () => {
    expect(isSafeHttpUrl('http://example.com')).toBe(true);
    expect(isSafeHttpUrl('https://example.com/path?q=1')).toBe(true);
  });
  it('拒绝 javascript: 协议注入', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('JavaScript:alert(1)')).toBe(false);
  });
  it('拒绝其他协议与相对路径', () => {
    expect(isSafeHttpUrl('data:text/html,x')).toBe(false);
    expect(isSafeHttpUrl('ftp://x.com')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeHttpUrl('/relative/path')).toBe(false);
    expect(isSafeHttpUrl('//example.com')).toBe(false);
  });
  it('非字符串/空值返回 false', () => {
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl(123)).toBe(false);
    expect(isSafeHttpUrl('   ')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('转义全部危险字符', () => {
    expect(escapeHtml(`<script>alert("x")</script>'`))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#039;');
  });
  it('普通文本不受影响', () => {
    expect(escapeHtml('hello 世界')).toBe('hello 世界');
  });
});
