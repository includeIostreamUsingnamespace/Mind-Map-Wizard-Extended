// Vitest 全局 setup：补足 jsdom 缺少的浏览器 API
import { beforeEach } from 'vitest';

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
  window.fetch = () => Promise.reject(new Error('network disabled in unit tests'));
  window.__MMW_TEST__ = true;
});
