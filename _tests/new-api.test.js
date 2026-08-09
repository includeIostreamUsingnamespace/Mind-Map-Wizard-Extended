// new.js API 密钥/工具函数测试
import { describe, it, expect, beforeAll } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

beforeAll(async () => {
  await loadApp();
});

describe('encryptApiKey / decryptApiKey', () => {
  it('ASCII 密钥往返一致', () => {
    const key = 'sk-or-v1-abcdef1234567890';
    const enc = encryptApiKey(key);
    expect(enc).toBeTruthy();
    expect(decryptApiKey(enc)).toBe(key);
  });
  it('空值处理', () => {
    expect(encryptApiKey('')).toBe('');
    expect(decryptApiKey('')).toBe('');
    expect(decryptApiKey(null)).toBe('');
    expect(decryptApiKey(undefined)).toBe('');
  });
  it('不同密钥加密结果不同', () => {
    expect(encryptApiKey('key1')).not.toBe(encryptApiKey('key2'));
  });
  it('损坏的密文解密不抛异常返回空串', () => {
    expect(decryptApiKey('!!!not-base64!!!')).toBe('');
  });
  it('包含符号的密钥往返一致', () => {
    const key = 'Kb3!@#xYz-098_';
    expect(decryptApiKey(encryptApiKey(key))).toBe(key);
  });
});

describe('safeJsonParse', () => {
  it('合法 JSON 正常解析', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse('[1,2]', [])).toEqual([1, 2]);
    expect(safeJsonParse('"str"', 'fb')).toBe('str');
  });
  it('非法 JSON 返回 fallback', () => {
    expect(safeJsonParse('not json', { fb: 1 })).toEqual({ fb: 1 });
    expect(safeJsonParse('', { fb: 1 })).toEqual({ fb: 1 });
    expect(safeJsonParse(undefined, 'fb')).toBe('fb');
  });
  it('JSON 值为 null 时返回 null（函数仅对 undefined 回退）', () => {
    expect(safeJsonParse('null', 'fb')).toBeNull();
  });
});

describe('escapeHtmlAttr', () => {
  it('转义属性注入字符', () => {
    expect(escapeHtmlAttr('"><img src=x onerror=alert(1)>')).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });
  it('null/undefined 返回空串', () => {
    expect(escapeHtmlAttr(null)).toBe('');
    expect(escapeHtmlAttr(undefined)).toBe('');
  });
  it('数字转字符串', () => {
    expect(escapeHtmlAttr(0)).toBe('0');
  });
});

describe('escapeHtml', () => {
  it('转义 HTML 注入字符', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('转义引号与单引号', () => {
    expect(escapeHtml("a\"b'c&d")).toBe('a&quot;b&#039;c&amp;d');
  });
});

describe('AI provider 配置', () => {
  it('默认 OpenRouter 云端地址', () => {
    localStorage.removeItem('mmw-ai-provider');
    expect(isLocalProvider()).toBe(false);
    expect(getChatCompletionsUrl()).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(aiRequiresApiKey()).toBe(true);
  });
  it('切换到 Ollama 本地', () => {
    localStorage.setItem('mmw-ai-provider', 'ollama');
    expect(isLocalProvider()).toBe(true);
    expect(getChatCompletionsUrl()).toBe('http://localhost:11434/v1/chat/completions');
    expect(aiRequiresApiKey()).toBe(false);
  });
  it('自定义 Ollama 地址并去掉末尾斜杠', () => {
    localStorage.setItem('mmw-ai-provider', 'ollama');
    localStorage.setItem('mmw-ollama-base-url', 'http://192.168.1.10:11434/');
    expect(getOllamaBaseUrl()).toBe('http://192.168.1.10:11434');
    expect(getChatCompletionsUrl()).toBe('http://192.168.1.10:11434/v1/chat/completions');
  });
  it('ollama 模式请求头不含 Authorization', () => {
    localStorage.setItem('mmw-ai-provider', 'ollama');
    const headers = getAiRequestHeaders('secret-key');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });
  it('openrouter 模式请求头含 Bearer 密钥', () => {
    localStorage.setItem('mmw-ai-provider', 'openrouter');
    const headers = getAiRequestHeaders('sk-test');
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(headers['HTTP-Referer']).toBe(window.location.origin);
  });
  it('finalizeAiPayload 对 ollama 剔除云端专属字段', () => {
    localStorage.setItem('mmw-ai-provider', 'ollama');
    const p = finalizeAiPayload({ plugins: { x: 1 }, reasoning: { y: 2 }, messages: [] });
    expect(p.plugins).toBeUndefined();
    expect(p.reasoning).toBeUndefined();
    expect(p.messages).toEqual([]);
  });
  it('finalizeAiPayload 对 openrouter 原样保留', () => {
    localStorage.setItem('mmw-ai-provider', 'openrouter');
    const p = finalizeAiPayload({ plugins: { x: 1 }, messages: [] });
    expect(p.plugins).toEqual({ x: 1 });
  });
});
