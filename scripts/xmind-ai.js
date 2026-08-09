/* =====================================================
   XMind AI Module - Compatible with Original Mind-Map-Wizard
   ===================================================== */
(function() {
  'use strict';

  window.XMIND_AI_CONFIG = {
    provider: 'mock',
    apiKey: '',
    apiEndpoint: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
    enabled: true
  };

  const PROMPTS = {
    brainstorm: (topic) => `You are a creative brainstorming assistant. Given the topic "${topic}", generate 5-8 diverse, creative and relevant sub-topics or ideas. Each should be a single concise phrase. Return ONLY a JSON array of strings.`,
    research: (topic) => `You are a research assistant. Research the topic "${topic}" and provide key findings structured as sub-topics. Return ONLY a JSON array of objects with "title" and "detail" fields.`,
    expand: (topic) => `You are a knowledge expansion assistant. Expand on the topic "${topic}" by adding 3-5 detailed sub-topics. Return ONLY a JSON array of objects with "title" and "description" fields.`,
    summarize: (topic, children) => `Summarize the following content about "${topic}":
${children.map(c => '- ' + c).join('\n')}
Provide a concise 2-3 sentence summary. Return ONLY plain text.`,
    explain: (topic) => `Explain the concept "${topic}" in clear, simple terms. Break it down into 2-3 key points. Return ONLY a JSON array of strings.`,
    polish: (text) => `Improve the following text to be more clear, concise, and professional. Return ONLY the improved text as plain string.

Text: "${text}"`,
    restructure: (topic, children) => `Given the topic "${topic}" with these sub-items:
${children.map(c => '- ' + c).join('\n')}
Suggest a better logical grouping. Return ONLY a JSON object with "groups" array, each group has "name" and "items" (array of strings).`,
    ask: (question, topic) => `The user is asking about the topic "${topic}" in a mind map context.

User Question: ${question}

Provide a helpful, accurate, and concise answer. Return plain text.`
  };

  const MOCK_RESPONSES = {
    brainstorm: (topic) => JSON.stringify([
      `${topic} - 核心概念与定义`, `${topic} - 历史发展与演变`,
      `${topic} - 关键技术原理`, `${topic} - 实际应用场景`,
      `${topic} - 行业案例分析`, `${topic} - 未来发展趋势`,
      `${topic} - 常见问题与挑战`, `${topic} - 最佳实践指南`
    ]),
    research: (topic) => JSON.stringify([
      {"title": "核心定义", "detail": `${topic} 是指...`},
      {"title": "关键里程碑", "detail": "重要发展节点与突破"},
      {"title": "主要参与者", "detail": "行业领先企业与研究机构"},
      {"title": "技术架构", "detail": "底层技术框架与组件"},
      {"title": "市场影响", "detail": "对行业与社会的深远影响"}
    ]),
    expand: (topic) => JSON.stringify([
      {"title": "理论基础", "description": "深入理解背后的科学原理与学术支撑"},
      {"title": "实现机制", "description": "具体的技术实现路径与方法论"},
      {"title": "性能优化", "description": "提升效率与效果的关键策略"},
      {"title": "对比分析", "description": "与相关技术或方法的优劣比较"},
      {"title": "前沿进展", "description": "最新的研究成果与突破方向"}
    ]),
    summarize: (topic) => `${topic} 是一个涵盖多维度的重要领域，其核心在于通过系统化的方法实现目标。主要涉及理论基础、实践应用和持续优化三个层面，并在多个行业中展现出显著价值。`,
    explain: (topic) => JSON.stringify([
      `${topic} 本质上是一种系统化的方法论，旨在解决特定领域中的复杂问题。`,
      `其核心原理基于...通过...实现...`,
      `在实际应用中，它能够帮助用户/组织提高效率、降低成本、增强竞争力。`
    ]),
    polish: (text) => text.length > 10 ? text.replace(/的/g, '之').replace(/了/g, '').replace(/很/g, '非常') : `优化后的${text}`,
    restructure: (topic) => JSON.stringify({
      groups: [
        {"name": "基础层", "items": ["概念定义", "历史背景", "核心原理"]},
        {"name": "应用层", "items": ["实际案例", "行业应用", "工具方法"]},
        {"name": "展望层", "items": ["发展趋势", "挑战机遇", "未来方向"]}
      ]
    }),
    ask: (question, topic) => `关于「${topic}」的问题：${question}

这是一个很好的问题。从专业角度来看，${topic} 涉及多个层面的考量。建议您可以进一步细化这个问题，例如从理论角度、实践角度或对比分析的角度来深入探讨。`
  };

  async function callAI(prompt) {
    const cfg = window.XMIND_AI_CONFIG;
    if (cfg.provider === 'mock') {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));
      return { content: null };
    }
    const endpoint = cfg.provider === 'ollama'
      ? (cfg.apiEndpoint || 'http://localhost:11434/api/chat')
      : (cfg.apiEndpoint || 'https://api.openai.com/v1/chat/completions');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.provider !== 'ollama' && cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    const body = cfg.provider === 'ollama'
      ? JSON.stringify({ model: cfg.model || 'llama2', messages: [{role:'user',content:prompt}], stream: false })
      : JSON.stringify({ model: cfg.model, messages: [{role:'user',content:prompt}], temperature: cfg.temperature, max_tokens: cfg.maxTokens });
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const content = cfg.provider === 'ollama' ? data.message?.content : data.choices?.[0]?.message?.content;
      return { content };
    } catch (err) { console.error('AI API Error:', err); throw err; }
  }

  function parseResponse(text, mode) {
    if (!text) return null;
    text = text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    text = text.replace(/^```\s*/, '').replace(/```$/, '').trim();
    try { return JSON.parse(text); } catch (e) {
      if (['summarize','polish','ask'].includes(mode)) return text;
      const starts = ['[', '{'].map(ch => text.indexOf(ch)).filter(i => i !== -1);
      const start = Math.min(...starts);
      if (starts.length > 0) {
        const open = text[start];
        const close = open === '[' ? ']' : '}';
        let depth = 0, inString = false, escaped = false;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
          }
          if (ch === '"') { inString = true; }
          else if (ch === open) { depth++; }
          else if (ch === close && --depth === 0) {
            try { return JSON.parse(text.slice(start, i + 1)); } catch (e2) {}
            break;
          }
        }
      }
      return text.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-•*\d.\s]+/, '').trim()).filter(Boolean);
    }
  }

  // ---- Compatibility with original project ----
  function getData() {
    // Try currentHierarchy first (original runtime data)
    if (typeof currentHierarchy !== 'undefined' && currentHierarchy) {
      return currentHierarchy;
    }
    // Fallback to json-editor
    const ed = document.getElementById('json-editor');
    if (!ed || !ed.value) return null;
    try { return JSON.parse(ed.value); } catch (e) { return null; }
  }

  function stripParentRefs(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripParentRefs);
    const clean = {};
    for (const key in obj) {
      if (key === 'parent') continue;
      if (obj.hasOwnProperty(key)) {
        clean[key] = stripParentRefs(obj[key]);
      }
    }
    return clean;
  }

  // Convert the runtime hierarchy (root wrapper + {text, children}) into the
  // {"mm-node": ...} format expected by the main renderer. Used as a local
  // fallback so we never persist a raw runtime structure to json-editor.
  function toEditorJson(data) {
    function convert(node) {
      const obj = { content: node.text || '', children: [] };
      if (Array.isArray(node.children)) obj.children = node.children.map(convert);
      return obj;
    }
    if (data && Array.isArray(data.children)) {
      const rootNode = data.children.length > 0 ? data.children[0] : { text: '', children: [] };
      return JSON.stringify({ "mm-node": convert(rootNode) }, null, 2);
    }
    return JSON.stringify(stripParentRefs(data), null, 2);
  }

  function setData(data) {
    // Update currentHierarchy (original runtime data)
    if (typeof currentHierarchy !== 'undefined') {
      currentHierarchy = data;
    }
    // Update json-editor: convert runtime hierarchy to the {"mm-node": ...} format
    // expected by the main renderer (updateMindMap/generateSVG)
    const ed = document.getElementById('json-editor');
    if (ed) {
      try {
        let jsonStr;
        if (data && Array.isArray(data.children) && typeof hierarchyToJson === 'function') {
          jsonStr = hierarchyToJson(data);
        } else {
          jsonStr = toEditorJson(data);
        }
        ed.value = jsonStr;
      } catch (e) {
        console.error('[XMind AI] JSON stringify error:', e);
        // fallback: always persist in {"mm-node": ...} format
        try {
          ed.value = toEditorJson(data);
        } catch (e2) {
          ed.value = JSON.stringify(stripParentRefs(data));
        }
      }
    }
    // Trigger update
    if (typeof updateMindMap === 'function') updateMindMap();
    if (typeof triggerAutoSave === 'function') triggerAutoSave();
    if (typeof localStorageKey !== 'undefined' && typeof editor !== 'undefined') {
      localStorage.setItem(localStorageKey, editor.value);
    }
  }

  function findNode(root, id) {
    if (root.id === id) return root;
    if (root.children) for (const c of root.children) { const f = findNode(c, id); if (f) return f; }
    return null;
  }

  function findParent(root, id) {
    if (!root.children) return null;
    for (const c of root.children) { if (c.id === id) return root; const f = findParent(c, id); if (f) return f; }
    return null;
  }

  function genId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

  function countNodes(n) { let c = 1; if (n.children) n.children.forEach(ch => c += countNodes(ch)); return c; }

  async function aiBrainstorm(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 1000));
      result = parseResponse(MOCK_RESPONSES.brainstorm(topic), 'brainstorm');
    } else { const res = await callAI(PROMPTS.brainstorm(topic)); result = parseResponse(res.content, 'brainstorm'); }
    if (!Array.isArray(result)) result = [String(result)];
    if (!node.children) node.children = [];
    result.forEach(t => node.children.push({ id: genId(), text: String(t).replace(/^["']|["']$/g,''), children: [] }));
    setData(data); return { success: true, added: result.length };
  }

  async function aiResearch(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 1200));
      result = parseResponse(MOCK_RESPONSES.research(topic), 'research');
    } else { const res = await callAI(PROMPTS.research(topic)); result = parseResponse(res.content, 'research'); }
    if (!Array.isArray(result)) result = [];
    if (!node.children) node.children = [];
    result.forEach(item => {
      const title = typeof item === 'string' ? item : (item.title || 'Item');
      const detail = typeof item === 'object' ? (item.detail || '') : '';
      node.children.push({ id: genId(), text: title, notes: detail, children: [] });
    });
    setData(data); return { success: true, added: result.length };
  }

  async function aiExpand(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 1000));
      result = parseResponse(MOCK_RESPONSES.expand(topic), 'expand');
    } else { const res = await callAI(PROMPTS.expand(topic)); result = parseResponse(res.content, 'expand'); }
    if (!Array.isArray(result)) result = [];
    if (!node.children) node.children = [];
    result.forEach(item => {
      const title = typeof item === 'string' ? item : (item.title || 'Item');
      const desc = typeof item === 'object' ? (item.description || '') : '';
      node.children.push({ id: genId(), text: title, notes: desc, children: [] });
    });
    setData(data); return { success: true, added: result.length };
  }

  async function aiSummarize(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    const children = (node.children || []).map(c => escapePrompt(c.content || c.text || ''));
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 800));
      result = MOCK_RESPONSES.summarize(topic);
    } else { const res = await callAI(PROMPTS.summarize(topic, children)); result = parseResponse(res.content, 'summarize'); }
    return { success: true, summary: String(result) };
  }

  async function aiExplain(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 900));
      result = parseResponse(MOCK_RESPONSES.explain(topic), 'explain');
    } else { const res = await callAI(PROMPTS.explain(topic)); result = parseResponse(res.content, 'explain'); }
    if (!Array.isArray(result)) result = [String(result)];
    if (!node.children) node.children = [];
    result.forEach(p => node.children.push({ id: genId(), text: String(p).replace(/^["']|["']$/g,''), children: [] }));
    setData(data); return { success: true, added: result.length };
  }

  async function aiPolish(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const text = node.content || node.text || '';
    if (!text.trim()) throw new Error('Node text is empty');
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 600));
      result = MOCK_RESPONSES.polish(text);
    } else { const res = await callAI(PROMPTS.polish(escapePrompt(text))); result = parseResponse(res.content, 'polish'); }
    node.content = String(result); if (node.text !== undefined) node.text = String(result);
    setData(data); return { success: true, original: text, polished: String(result) };
  }

  async function aiRestructure(nodeId) {
    const data = getData(); if (!data) throw new Error('No data');
    const node = findNode(data, nodeId); if (!node) throw new Error('Node not found');
    const topic = escapePrompt(node.content || node.text || 'Topic');
    const children = (node.children || []).map(c => escapePrompt(c.content || c.text || ''));
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 1100));
      result = parseResponse(MOCK_RESPONSES.restructure(topic), 'restructure');
    } else { const res = await callAI(PROMPTS.restructure(topic, children)); result = parseResponse(res.content, 'restructure'); }
    if (!result || !result.groups) return { success: false, error: 'Could not parse' };
    node.children = [];
    result.groups.forEach(g => {
      node.children.push({ id: genId(), text: g.name || 'Group', children: (g.items || []).map(item => ({ id: genId(), text: String(item), children: [] })) });
    });
    setData(data); return { success: true, groups: result.groups };
  }

  async function aiAsk(question, nodeId) {
    const data = getData();
    const node = nodeId && data ? findNode(data, nodeId) : null;
    const topic = node ? escapePrompt(node.content || node.text || 'Topic') : 'General';
    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, 1000));
      result = MOCK_RESPONSES.ask(question, topic);
    } else { const res = await callAI(PROMPTS.ask(question, topic)); result = parseResponse(res.content, 'ask'); }
    return { success: true, answer: String(result) };
  }

  // ---- Security & Utility Helpers ----
  function escapePrompt(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/["\\]/g, '\\$&').replace(/[\r\n\t]/g, ' ');
  }

  async function aiInsertCore(nodeId, promptText, mockResult, parseType, mockDelay, preFetchedNode) {
    const data = getData();
    if (!data) throw new Error('No data');
    const node = preFetchedNode || (data ? findNode(data, nodeId) : null);
    if (!node) return { success: false, error: 'Node not found' };

    let result;
    if (window.XMIND_AI_CONFIG.provider === 'mock') {
      await new Promise(r => setTimeout(r, mockDelay || 1000));
      result = mockResult;
    } else {
      const res = await callAI(promptText);
      result = parseResponse(res.content, parseType);
    }

    if (!Array.isArray(result)) result = [String(result)];
    // 过滤 null/undefined
    result = result.filter(t => t !== null && t !== undefined);
    if (!node.children) node.children = [];
    result.forEach(t => node.children.push({
      id: genId(),
      text: String(t).replace(/^["']|["']$/g, ''),
      children: []
    }));
    setData(data);
    return { success: true, added: result.length };
  }

  // ---- New Insert Menu AI Functions ----
  async function aiGenerateIdeasAuto(nodeId) {
    const data = getData();
    if (!data) throw new Error('No data');
    const node = findNode(data, nodeId);
    const topic = escapePrompt((node || {}).content || (node || {}).text || 'Topic');
    const prompt = `You are a creative brainstorming assistant. Given the topic "${topic}", generate 5-8 diverse, creative and relevant sub-topics or ideas automatically without user input. Each should be a single concise phrase. Return ONLY a JSON array of strings.`;
    return aiInsertCore(nodeId, prompt, parseResponse(MOCK_RESPONSES.brainstorm(topic), 'brainstorm'), 'brainstorm', 1000, node);
  }

  async function aiGenerateIdeasPrompt(nodeId, userPrompt) {
    const cleanPrompt = escapePrompt(userPrompt).slice(0, 500);
    const data = getData();
    if (!data) throw new Error('No data');
    const node = findNode(data, nodeId);
    const topic = escapePrompt((node || {}).content || (node || {}).text || 'Topic');
    const prompt = `You are a creative brainstorming assistant. Given the topic "${topic}" and the user request: "${cleanPrompt}", generate relevant sub-topics or ideas. Each should be a single concise phrase. Return ONLY a JSON array of strings.`;
    return aiInsertCore(nodeId, prompt, parseResponse(MOCK_RESPONSES.brainstorm(topic + ' ' + cleanPrompt), 'brainstorm'), 'brainstorm', 1000, node);
  }

  async function aiWorkBreakdown(nodeId) {
    const data = getData();
    if (!data) throw new Error('No data');
    const node = findNode(data, nodeId);
    const topic = escapePrompt((node || {}).content || (node || {}).text || 'Topic');
    const prompt = `You are a project management assistant. Break down the task "${topic}" into concrete, actionable sub-tasks or work packages. Each should be a single concise phrase. Return ONLY a JSON array of strings.`;
    return aiInsertCore(nodeId, prompt, ['需求分析', '方案设计', '开发实现', '测试验证', '部署上线'], 'brainstorm', 1000, node);
  }

  async function aiGenerateExplanation(nodeId) {
    const data = getData();
    if (!data) throw new Error('No data');
    const node = findNode(data, nodeId);
    const topic = escapePrompt((node || {}).content || (node || {}).text || 'Topic');
    const prompt = `Explain the concept "${topic}" in clear, simple terms suitable for a beginner. Break it down into 3-5 key points. Return ONLY a JSON array of strings.`;
    return aiInsertCore(nodeId, prompt, parseResponse(MOCK_RESPONSES.explain(topic), 'explain'), 'explain', 900, node);
  }

  window.XMindAI = {
    config: window.XMIND_AI_CONFIG,
    actions: { brainstorm: aiBrainstorm, research: aiResearch, expand: aiExpand, summarize: aiSummarize, explain: aiExplain, polish: aiPolish, restructure: aiRestructure, ask: aiAsk, generateIdeasAuto: aiGenerateIdeasAuto, generateIdeasPrompt: aiGenerateIdeasPrompt, workBreakdown: aiWorkBreakdown, generateExplanation: aiGenerateExplanation },
    getNodeText: (id) => { const d = getData(); if (!d) return null; const n = findNode(d, id); return n ? (n.content || n.text) : null; },
    getMindMapData: getData,
    setMindMapData: setData,
    findNode, findParent, genId, countNodes
  };

  window.__mmwTestExports = { parseResponse, escapePrompt, toEditorJson, findNode, genId, countNodes, getData };

  console.log('[XMind AI] Loaded. Actions:', Object.keys(window.XMindAI.actions));
})();
