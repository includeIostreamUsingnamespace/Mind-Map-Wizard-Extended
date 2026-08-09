// Vitest 全局 setup：补足 jsdom 缺少的浏览器 API
import { beforeEach } from 'vitest';

const testFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [] })
});
window.fetch = testFetch;
globalThis.fetch = testFetch;

beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; }
    });
  }
  // 单元测试不发起真实网络请求（避免挂起/污染）
  window.fetch = testFetch;
  globalThis.fetch = testFetch;
  window.__MMW_TEST__ = true;
});
