---
title: "方案分析 | 代理工具的选择"
published: 2025-12-03
description: "从“代理核心 + GUI 前端”的视角，介绍并对比 Clash/Mihomo、Sing-Box、V2Ray、Xray、dae 等主流核心的特点与取舍，同时按系统整理常见客户端选择，便于快速完成选型。"
tags: ["网络", "指南"]
category: "方案分析"
slug: proxy-tools
---

## 主流代理核心简介（代理核心 + 前端 UI）

所有代理工具本质上都是 **代理核心 + 前端图形界面（UI）** 组成。  
前端 UI 可以千变万化，但真正承担流量处理的 **代理核心只有少数几种**。

以下是目前主流、最常见的核心介绍。

### [Clash](https://github.com/Dreamacro/clash)(更新停滞)

Clash 是一个最初由 Go 编写的多协议代理核心（原项目已删除）。  
使用广泛，生态庞大。

**特点：**
- 使用统一的 YAML 配置，无需因平台不同而修改  
- GUI 客户端数量最多、生态最大  
- 跨平台兼容性极强  

**缺点：**
- 原项目已停止维护  
- 新协议支持较慢（如 Reality、Hysteria2 等）


### [Mihomo（Clash Meta）](https://github.com/MetaCubeX/mihomo)★★★

MetaCubeX 社区维护的 Clash 增强版，也是目前最主流的 Clash 继承者。

**特点：**
- 完全兼容 Clash 配置  
- 支持现代协议（Reality、Hysteria2、TUIC 等）  
- 活跃维护，性能更高


### [Sing-Box（sb）](https://github.com/SagerNet/sing-box)★★

由 SagerNet 开发的现代化代理核心，目前增长最快、架构最先进。

**特点：**
- 极度轻量，理论性能高  
- 高度可定制的网络与路由配置  
- 支持大量现代协议  
- 跨平台优秀

**缺点：**
- 配置难度高，对新手不友好  
- GUI 生态较少


### [V2Ray](https://github.com/v2fly/v2ray-core)(更新缓慢)

由 v2fly 社区维护的原始 V2Ray 核心。

**特点：**
- 配置灵活  
- 结构成熟  
- 较为轻量

**缺点：**
- 开发速度慢  
- 新协议支持不佳  
- 配置复杂  
- GUI 生态弱


### [Xray](https://github.com/XTLS/Xray-core)

[V2Ray](https://github.com/v2fly/v2ray-core) 的增强版核心，由 XTLS 项目维护。

**特点：**
- 完全兼容 V2Ray 配置  
- 支持 Reality  
- 支持 XTLS，性能大幅提升  
- 性能明显高于官方 V2Ray

**缺点：**
- 配置复杂  
- GUI 生态较弱

### [dae](https://github.com/daeuniverse/dae)

基于 eBPF 的 Linux / 路由器高性能代理引擎，更像“下一代分流框架”。

**特点：**
- 基于 eBPF，性能极高  
- 几乎不占 CPU  
- 延迟极低  
- 路由分流能力极强

**缺点：**
- 仅支持 Linux / OpenWRT  
- 配置复杂  
- GUI少

### 各操作系统主流GUI代理客户端(整体按照知名度排序)

#### Windows
- [v2rayN★★](https://github.com/2dust/v2rayN) — 支持 Xray / sing-box / clash/others 内核,支持Windows/Linux/macOS
- [Clash Verge Rev★★](https://github.com/Clash-Verge-rev/clash-verge-rev) — 内置 Mihomo内核,支持 Linux/macOS/Windows
- [Mihomo Party★★★](https://github.com/mihomo-party-org/clash-party)(推荐)  - 支持linux/windows/macos
- [Karing](https://github.com/KaringX/karing) — 基于 sing-box 内核,支持Android/ios/linux/windows/macos
- [Sparkle★★](https://github.com/xishang0128/sparkle) — 基于 Mihomo 内核，支持 Windows / macOS / Linux
- [Clash Mi](https://github.com/KaringX/clashmi) —支持android/ios/Windows / macOS / Linux
- [FlClash](https://github.com/chen08209/FlClash) — 基于 Mihomo 内核,支持Android/linux/windows、macos
- [GUI.for.Clash](https://github.com/GUI-for-Cores/GUI.for.Clash) — Windows / macOS / Linux
- [Pandora-Box](https://github.com/snakem982/Pandora-Box) — 基于 Mihomo 内核,支持linux/windows/macos

#### macOS
- [Surge★★★](https://nssurge.com) — 付费高级客户端,支持ios/macos
- [Quantumult X★★★](https://apps.apple.com/us/app/quantumult-x/id1443988620) — 付费,支持ios/macos
- [Loon](https://apps.apple.com/us/app/loon/id1373567447) —  付费,支持ios/macos
- [v2rayN](https://github.com/2dust/v2rayN) — 支持 Xray / sing-box / clash/others 内核,支持Windows/Linux/macOS
- [Clash Verge Rev](https://github.com/Clash-Verge-rev/clash-verge-rev) — 内置 Mihomo 内核,支持 Linux/macOS/Windows
- [Mihomo Party](https://github.com/mihomo-party-org/clash-party)  - 支持linux/windows/macos
- [Karing](https://github.com/KaringX/karing) — 基于 sing-box 内核,支持Android/ios/linux/windows/macos
- [Sparkle](https://github.com/xishang0128/sparkle) — 基于 Mihomo 内核，支持 Windows / macOS / Linux
- [FlClash](https://github.com/chen08209/FlClash) — 基于 Mihomo 内核,支持Android/linux/windows、macos
- [Clash Mi](https://github.com/KaringX/clashmi) —支持android/ios/Windows / macOS / Linux
- [GUI.for.Clash](https://github.com/GUI-for-Cores/GUI.for.Clash) — Windows / macOS / Linux
- [Stash★★](https://stash.ws) — 基于 sing-box（付费）
- [Pandora-Box](https://github.com/snakem982/Pandora-Box) — 基于 Mihomo 内核,支持linux/windows/macos

#### Linux
- [v2rayN★★](https://github.com/2dust/v2rayN) — 支持 Xray / sing-box / clash/others 内核,支持Windows/Linux/macOS
- [Clash Verge Rev★★](https://github.com/Clash-Verge-rev/clash-verge-rev) — 内置 Mihomo 内核,支持 Linux/macOS/Windows
- [Mihomo Party★★★](https://github.com/mihomo-party-org/clash-party)  - 支持linux/windows/macos
- [Karing](https://github.com/KaringX/karing) — 基于 sing-box 内核,支持Android/ios/linux/windows/macos
- [Sparkle](https://github.com/xishang0128/sparkle) — 基于 Mihomo 内核，支持 Windows / macOS / Linux
- [FlClash](https://github.com/chen08209/FlClash) — 基于 Mihomo 内核,支持Android/linux/windows、macos
- [Clash Mi](https://github.com/KaringX/clashmi) —支持android/ios/Windows / macOS / Linux
- [GUI.for.Clash](https://github.com/GUI-for-Cores/GUI.for.Clash)  — 支持 Linux/macOS/Windows
- [Pandora-Box](https://github.com/snakem982/Pandora-Box) — 基于 Mihomo 内核,支持linux/windows/macos

#### Android
- [Clash Meta for Android★★★](https://github.com/MetaCubeX/ClashMetaForAndroid)(推荐)
- [Karing](https://github.com/KaringX/karing) — 基于 sing-box 内核,支持Android/ios/linux/windows/macos
- [Clash Mi](https://github.com/KaringX/clashmi) —支持android/ios/Windows / macOS / Linux
- [FlClash★★](https://github.com/chen08209/FlClash) — 基于 Mihomo 内核,支持Android/linux/windows、macos

#### iOS
- [Surge★★★](https://nssurge.com) — 付费高级客户端,支持ios/macos
- [Shadowrocket★★★](https://apps.apple.com/us/app/shadowrocket/id932747118) — 付费,支持多协议
- [Quantumult X★★★](https://apps.apple.com/us/app/quantumult-x/id1443988620) — 付费,支持ios/macos
- [Loon](https://apps.apple.com/us/app/loon/id1373567447) —  付费,支持ios/macos
- [Karing](https://github.com/KaringX/karing) — 基于 sing-box 内核,支持Android/ios/linux/windows/macos
- [Clash Mi](https://github.com/KaringX/clashmi) —支持android/ios/Windows / macOS / Linux

#### HarmonyOS NEXT
- [ClashBox](https://github.com/xiaobaigroup/ClashBox) — 独苗这一块

#### 路由器（OpenWRT / Linux）
- [OpenClash★★](https://github.com/vernesong/OpenClash) - OpenWRT 上主流的 Clash 客户端
- [OpenWrt-nikki★★★](https://github.com/nikkinikki-org/OpenWrt-nikki)(推荐) —  基于clash核心
- [daed](https://github.com/daeuniverse/daed) — 基于dae内核
- [Passwall2](https://github.com/xiaorouji/openwrt-passwall)
- [openwrt-nekobox](https://github.com/Thaolga/openwrt-nekobox) — 基于 Sing-box核心

### 总结
 小白无脑选择clash系客户端，有其他要求可自定义选择。
