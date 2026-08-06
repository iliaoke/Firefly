---
title: "学习笔记 | 头歌破解考试的防复制粘贴"
published: 2026-07-23
description: "从作业到考试，头歌（EduCoder）的防复制粘贴限制分别实现在配置层和事件层，记录一次逆向分析与油猴脚本破解过程。"
tags: ["破解", "网络"]
category: "学习笔记"
slug: educoder-anti-copy-paste-bypass
password: "11112222"  
passwordHint: "该文章有一定法律风险，暂时上锁"
---

## 前言

有段时间被头歌的防复制粘贴搞得挺头痛的。网上能搜到的脚本，基本只能用于作业的防复制粘贴，到了考试就不行了。于是乎趁着一场模拟考试，研究了一下考试的防复制粘贴机制，最后成功写出来了用于考试的破解的油猴脚本(脚本的完整文件在博客末尾)。

## 作业场景：限制只在"配置层面"

**作业页面的复制限制，本质上只是后端下发的一份"权限配置"**，前端页面读到这份配置后，才决定要不要在界面上禁用复制粘贴、右键菜单这些功能。限制并不是靠浏览器事件层面的硬拦截实现的，而是看配置文件——配置说不能复制，页面才会去阻止你。

这种实现方式的好处是开发简单，但坏处也很明显：只要能在配置到达页面**之前**把它篡改掉，页面自然就会"以为"自己是被允许复制的，后面所有的限制逻辑都不会触发。

所以作业脚本的思路就非常直接：拦截页面发出的所有网络请求，找到返回题目/实训配置的那几个接口，把里面跟复制权限相关的字段统一改成"允许"，再把改过的响应交还给页面。整个过程页面完全无感，因为它拿到的还是一份合法的 JSON，只是内容被偷偷换了。

具体做法是重写全局的 `fetch`，在真正请求发出后、页面拿到响应前insert一层处理：

```javascript
function hookFetch() {
    const nativeFetch = window.fetch;
    const hookedFetch = async (...args) => {
      const request = new Request(...args);
      const response = await nativeFetch(...args);
      const clonedResponse = response.clone();
      await saveTaskJson(request, clonedResponse);
      const modifiedResponse = await modifyTaskCopy(request, clonedResponse);
      return modifiedResponse;
    };
    window.fetch = hookedFetch;
}
```

把 `shixun`（实训）和 `challenge`（题目）对象里那些 `forbid_copy`、`can_copy`、`diasble_copy`之类的字段，全部改写成允许复制的状态：

```javascript
if (json.shixun) {
  json.shixun.can_copy = true;
  json.shixun.forbid_copy = false;
  json.shixun.copy_for_exercise = true;
  json.shixun.active_copy = true;
  ...
}
if (json.challenge) {
  json.challenge.diasble_copy = false;
}
```

因为限制只存在于配置层面，所以我们只需要在配置被页面消费之前拦截并篡改它，就能解除限制，不需要碰任何浏览器原生的复制、粘贴、选中事件。

## 考试场景：事件层面的硬拦截

但是头歌的考试模式更为复杂。考试系统显然是在作业限制被人破解过太多次之后专门加固的，它不再只依赖一份后端配置——**即便你把配置改成"允许复制"，考试页面依然会在浏览器事件层面把 `copy`、`cut`、`paste`、`contextmenu` 这些事件死死摁住**。同时还配合了 CSS 的 `user-select: none` 让你连文字都选不中，甚至连 `document.queryCommandSupported('paste')` 这种底层探测接口的返回值也被动了手脚。也就是说，考试限制是"多层设防"的：配置层、CSS 选中层、DOM 事件层，缺一不可。

这就意味着单纯改配置字段是没有用的——页面的编辑器（Monaco Editor）内部有自己的一套事件监听逻辑，考试脚本会在事件冒泡的过程中调用 `preventDefault`、`stopPropagation`、`stopImmediatePropagation`，把复制粘贴事件在到达 Monaco 自己的处理逻辑之前就地"截杀"。所以要破解考试，思路必须从"改数据"转向"改浏览器事件系统本身的行为"：既然网站是靠调用这几个事件方法来实现拦截的，那就在这几个方法上做手脚，让"调用了但没有真正生效"。

具体做法是直接重写 `Event.prototype` 上的三个方法，对来自 Monaco 编辑器内部的复制/剪切/粘贴/右键事件做"选择性失效"：

```javascript
Event.prototype.preventDefault = function () {
  const t = this.type;
  if ((t === "copy" || t === "cut") && insideMonaco(this.target)) {
    return; // 中和网站对 copy/cut 的阻止
  }
  return _origPreventDefault.call(this);
};

Event.prototype.stopPropagation = function () {
  const t = this.type;
  if ((t === "paste" || t === "contextmenu" || t === "copy" || t === "cut") && insideMonaco(this.target)) {
    return; // 放行，让事件能继续传播给 Monaco 的正常处理逻辑
  }
  return _origStopPropagation.call(this);
};
```

这里有个很细节但很关键的取舍：为什么 `paste` 和 `contextmenu` 的 `preventDefault` 要原样保留，只中和 `copy`/`cut`？因为 Monaco 的右键菜单是它自己用 JS 画出来的浮层，并不是浏览器原生右键菜单；如果把网站对 `contextmenu` 的 `preventDefault` 也中和掉，浏览器原生菜单和 Monaco 自己的菜单就会同时弹出来，造成"双重菜单"的问题。同理，`paste` 事件如果被完全放行，浏览器会执行一次"裸粘贴"，把内容直接怼进 `textarea`，绕过了 Monaco 自身的格式化粘贴逻辑，导致粘贴进去的代码缩进全部错乱。所以这两个事件只中和网站的 `stopPropagation`（让事件能传到 Monaco 手上），但保留网站对浏览器默认行为的 `preventDefault`（把决定权交还给 Monaco 自己）。

除此之外，脚本还补了两个容易被忽略的口子：一是给整个页面强制注入 CSS，把 Monaco 编辑器相关节点的 `user-select` 都改回 `text`，解决"事件放行了但文字根本选不中"的问题；二是遍历并监听页面里动态插入的 `iframe`，因为考试页面的编辑器很可能是内嵌在 iframe 里加载的，如果只处理主文档，iframe 内部的限制会完全不受影响：

```javascript
function handleIframe(iframe) {
  try {
    const d = iframe.contentDocument || iframe.contentWindow.document;
    injectCSS(d);
    patchQCS(d.constructor.prototype);
  } catch (_) { /* 跨域 */ }
}
```

## 总结

作业和考试的防复制粘贴的实现思路完全不一样：

- **作业**：限制信息完全来自后端下发的配置字段。破解只需要在数据到达页面前把配置篡改成"允许"，一次 `fetch` hook 就能解决所有问题。
- **考试**：在配置层之上又叠了一层针对 DOM 事件的硬编码拦截（`copy`/`cut`/`paste`/`contextmenu`），外加 CSS 选中限制和 iframe 隔离。这时候光改数据没用，必须深入到浏览器事件系统本身，精确地区分"网站到底想阻止浏览器的默认行为，还是想阻止事件冒泡到别的处理器"，才能在解除限制的同时不破坏编辑器自身正常的复制粘贴功能。

## 完整的油猴脚本（脚本仅用于技术交流，禁止用于任何非法途径）
```javascript
// ==UserScript==
// @name         头歌平台 (EduCoder) 解除复制粘贴限制
// @namespace    https://github.com/example/educoder-unlocker
// @version      3.0.1
// @description  解除头歌平台代码编辑器的复制粘贴限制（修复右键双重菜单）
// @author       AI Assistant
// @match        https://www.educoder.net/*
// @run-at       document-start
// @grant        GM_log
// ==/UserScript==

(function () {
  "use strict";

  const TAG = "[EduCoder-Unlocker]";
  const log = (...a) => {
    try { GM_log(TAG + " " + a.join(" ")); } catch (_) { /* noop */ }
    console.log(TAG, ...a);
  };

  log("v3.0.1 启动");

  // ═══════════════════════════════════════════════════════════
  // Tools
  // ═══════════════════════════════════════════════════════════

  function insideMonaco(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(".monaco-editor");
  }


  const _origPreventDefault = Event.prototype.preventDefault;
  const _origStopPropagation = Event.prototype.stopPropagation;
  const _origStopImmediate = Event.prototype.stopImmediatePropagation;

  Event.prototype.preventDefault = function () {
    const t = this.type;
    if ((t === "copy" || t === "cut") && insideMonaco(this.target)) {
      return;
    }
    return _origPreventDefault.call(this);
  };

  Event.prototype.stopPropagation = function () {
    const t = this.type;
    if ((t === "paste" || t === "contextmenu" || t === "copy" || t === "cut") && insideMonaco(this.target)) {
      return;
    }
    return _origStopPropagation.call(this);
  };

  Event.prototype.stopImmediatePropagation = function () {
    const t = this.type;
    if ((t === "paste" || t === "contextmenu" || t === "copy" || t === "cut") && insideMonaco(this.target)) {
      return; 
    }
    return _origStopImmediate.call(this);
  };

  log("✓ 三件套补丁已生效");
  log("  preventDefault:   copy/cut → 中和  |  paste/contextmenu → 保留原始");
  log("  stopPropagation:  全部中和");
  log("  stopImmediate:    全部中和");

  // ═══════════════════════════════════════════════════════════
  // paste 兜底
  // ═══════════════════════════════════════════════════════════

  document.addEventListener("paste", function (e) {
    if (!insideMonaco(e.target)) return;
  
    e.preventDefault();
  }, true);

  log("✓ paste 兜底拦截器已注册");

  // ═══════════════════════════════════════════════════════════
  // CSS
  // ═══════════════════════════════════════════════════════════

  const UNLOCK_CSS = `
    /* [EduCoder-Unlocker] 恢复 Monaco 编辑器文本选择 */
    .monaco-editor,
    .monaco-editor .monaco-scrollable-element,
    .monaco-editor .view-lines,
    .monaco-editor .view-lines .view-line,
    .monaco-editor .view-lines *,
    .monaco-editor .lines-content,
    .monaco-editor .view-overlays,
    .monaco-editor .view-overlays .current-line,
    .monaco-editor .margin-view-overlays,
    .monaco-editor .line-numbers,
    .monaco-editor .margin .line-numbers {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;

  function injectCSS(doc) {
    if (!doc || !doc.head) return;
    if (doc.getElementById("educoder-unlocker-css")) return;
    const s = doc.createElement("style");
    s.id = "educoder-unlocker-css";
    s.textContent = UNLOCK_CSS;
    doc.head.appendChild(s);
    log("✓ CSS 注入: " + (doc === document ? "主文档" : "iframe"));
  }

  // ═══════════════════════════════════════════════════════════
  // queryCommandSupported
  // ═══════════════════════════════════════════════════════════

  function patchQCS(docProto) {
    if (docProto.__unlocker_qcs) return;
    const orig = docProto.queryCommandSupported;
    docProto.queryCommandSupported = function (cmd) {
      if (cmd === "paste") return true;
      return orig.call(this, cmd);
    };
    docProto.__unlocker_qcs = true;
  }

  patchQCS(Document.prototype);

  // ═══════════════════════════════════════════════════════════
  // iframe 支持
  // ═══════════════════════════════════════════════════════════

  function handleIframe(iframe) {
    try {
      const d = iframe.contentDocument || iframe.contentWindow.document;
      if (!d) return;

      function doInject() {
        if (!(d.readyState === "complete" || d.readyState === "interactive")) {
          setTimeout(doInject, 50);
          return;
        }
        injectCSS(d);
        patchQCS(d.constructor.prototype);
      }

      doInject();
    } catch (_) { /* 跨域 */ }
  }

  function scanIframes() {
    document.querySelectorAll("iframe").forEach(handleIframe);
  }

  const mo = new MutationObserver(function (mutations) {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.tagName === "IFRAME") handleIframe(n);
        if (n.querySelectorAll) n.querySelectorAll("iframe").forEach(handleIframe);
      }
    }
  });

  function onDOMReady() {
    scanIframes();
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMReady);
  } else {
    onDOMReady();
  }

  injectCSS(document);

  log("✓ v3.0.1 就绪 — 文本选择 | 复制 | 粘贴(格式正确) | 剪切 | 右键菜单(仅 Monoco)");
})();

```
