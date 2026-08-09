// 将完整应用加载进 jsdom：构建 index.html DOM 并按依赖顺序执行所有业务脚本
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

// index.html 中 script 的加载顺序（剔除 .min.js 第三方库与依赖 indexedDB 的 image-handler.js）
const SCRIPT_ORDER = [
  'scripts/mm-rendering/notes.js',
  'scripts/squircles.js',
  'scripts/chat-edits.js',      // ESM：动态 import 加载
  'scripts/chat-ui.js',
  'scripts/mm-utils.js',
  'scripts/mmw.js',
  'scripts/new.js',
  'scripts/xmind-ai.js',
  'scripts/mm-rendering/renderer.js',
  'scripts/mm-rendering/interaction.js'
];

export function buildDom() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  const parser = new DOMParser();
  const newDoc = parser.parseFromString(html, 'text/html');
  const newRoot = document.importNode(newDoc.documentElement, true);
  document.replaceChild(newRoot, document.documentElement);
}

export async function loadScripts(scriptList = SCRIPT_ORDER, { skip = [] } = {}) {
  const loaded = [];
  // 第三方库最小桩：jspdf 仅在下载功能用到，测试不覆盖
  window.jspdf = { jsPDF: class {} };
  for (const rel of scriptList) {
    if (skip.includes(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const code = fs.readFileSync(abs, 'utf-8');
    // ESM 模块（含 export）用动态 import 加载，其余用全局执行
    if (/\bexport\b/.test(code)) {
      await import(pathToFileURL(abs).href + `?v=${Date.now()}`);
    } else {
      vm.runInThisContext(code, { filename: rel });
    }
    loaded.push(rel);
  }
  // 业务脚本大多监听 DOMContentLoaded 做初始化；有的挂在 document、有的挂在 window，
  // 两个对象都要派发
  document.dispatchEvent(new Event('DOMContentLoaded'));
  window.dispatchEvent(new Event('DOMContentLoaded'));
  return loaded;
}

export async function loadApp(options = {}) {
  buildDom();
  return loadScripts(SCRIPT_ORDER, options);
}
