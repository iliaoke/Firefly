---
title: "方案分析 | Android Root 的演进与抉择"
published: 2025-12-09
description: "从技术路线与时间线梳理 Android Root 的演进：用户态/内核态/漏洞 Root 的差异与适用条件，并对 KingRoot、SuperSU、Magisk、KernelSU、APatch 等方案做原理拆解与优缺点对比，给出选择建议。"
tags: ["Android", "Gki", "root", "指南"]
category: "方案分析"
slug: Android-root
---

## Android Root 发展历程和方案分析

Android Root 顾名思义即给安卓系统获取根权限，让用户拥有系统级权限，极大提升系统可玩性。  
一般来说，Root 需要先解锁 bootloader（BL），解锁的目的，是让用户有权限刷写各个分区，从而能：

- 更换系统（system / vendor / product 等）
- 更换内核（boot ）
- 注入 Root / 模块方案

**注意：解锁 BL ≠ 必然 Root**，也可以只刷机不 Root。  
主流 Root 方案按时间大致可以排成这样：

> **KingRoot → SuperSU → Magisk → SKRoot（小众） → KernelSU → APatch**

---

### 一、Root 实现思路：按技术路线分类

#### 用户态 Root（User-space Root）

- 不直接修改内核代码  
- 修改 **boot.img → ramdisk → init 脚本**，在早期启动阶段插入自己的用户态 root 程序  
- 通过 **用户态守护进程** 管理权限（例如 `magiskd`）  
- 一般依赖一个 **管理 App** 配合使用（授权弹窗、模块管理等）  
- **代表方案：Magisk**  
- **优点**：对内核无强依赖，兼容面最广  
- **缺点**：本质不在内核，某些内核安全策略/厂商定制下会有局限

#### 内核态 Root（Kernel-space Root）

- 直接在内核中 **Hook 权限相关函数 / LSM / syscall**  
- 在内核层修改 `cred`、`capabilities` 等结构，获得最高权限  
- 部分方案需要内核源码（早期 KernelSU），部分不需要（APatch、SKRoot）  
- **代表方案：KernelSU、APatch、SKRoot**  
- **优点**：权限层级最高，可做更“隐蔽”和细粒度的控制  
- **缺点**：与内核版本/厂商定制强相关，适配成本较高

#### 漏洞 Root（Exploit-based Root）

- 利用系统或内核漏洞临时/半永久获取 Root  
- 通常依赖特定 Android / 内核版本，系统一更新就失效  
- **代表方案：KingRoot 等一键 Root 工具**  
- **优点**：用户体验简单，历史上对锁 BL 的机器也有机会  
- **缺点**：完全吃漏洞红利，维护性差，安全风险高

---

### 二、按时间线看典型方案

#### KingRoot：漏洞驱动的早期 Root

- 主要活跃在 **Android 4.4 ~ 6.0** 时代  
- 通过 **内核 / 系统漏洞**（如提权漏洞）获得 Root  
- 多为 **临时或半永久 Root**，重启或 OTA 后经常失效  
- 随着漏洞不断被修复，这类方案很快被淘汰

**定位**：  
完全基于漏洞的时代产物，如今更多是历史意义。

---

#### SuperSU：system 分区注入 su 的经典方案

- 思路：直接修改 `system.img`，在 `/system/bin` 或 `/system/xbin` 注入 `su` 二进制  
- 通过 `su` 的 setuid 机制实现提权  
- 典型适用 **Android 4.x ~ 6.x**，system 还比较“好改”的时代  
- 随着：
  - system 分区逐渐只读 / 受更严格完整性保护  
  - **Magisk 引入 systemless Root**  

SuperSU 很快失去优势。

**定位**：  
传统“改 system.img 注入 su”的代表

---

####  [Magisk](https://github.com/topjohnwu/Magisk)：用户态 systemless Root 的时代

Magisk 把 Root 方式拉到了一个新高度。

#####  核心实现

- 修改 **boot.img → ramdisk → init**：
  - 用 `magiskinit` 接管早期启动，作为“第一个用户态进程”
  - 启动 root 守护进程 `magiskd`
- `/system/bin/su` 在 Magisk 中 **只是前端/中转**：
  - 解析参数 → 连接 `magiskd` → 由 `magiskd` 以 root fork/exec 真正的命令  
  - **提权的决策和执行**在 `magiskd` 中完成，而不是在 `su` 本身
- 不在 system 分区直接写入文件，做到 **systemless**  
  （实际上是用挂载/覆盖的方式“虚拟出”修改过的系统视图）

##### 关键特点

- **首创 magic mount 模块系统**：
  - 在不实际修改系统文件的情况下，实现对 `/system`、`/vendor` 等目录的文件覆盖
  - 极大提升“玩机模块生态”
- **强兼容性**：
  - 只要能改 boot.img中的init脚本，大多数内核版本都能使用
- **依赖管理 App**（Magisk App）：
  - 管理模块、处理 su 授权弹窗、升级/卸载

##### 局限

- 纯用户态方案，需要搭配app
- 模块生态与内核态模块（如 APatch 的 KPM ）相比，在**内核能力利用上**略逊一筹
- 不支持kernelsu后来的模块webui功能,需要额外安装app解决

---

#### [SKRoot](https://github.com/abcz316/SKRoot-linuxKernelRoot)：早期“内核 Root + su 环境注入”的探索者

- 时间上早于目前主流内核 Root（KernelSU / APatch）  
- **无需内核源码**：
  - 离线分析目标内核镜像（ELF/镜像格式）
  - 找到如 `do_execve` 等关键函数与 `task_struct/cred/seccomp` 的偏移
  - 插入自定义 shellcode 实现内核级提权
- 号称“**隐藏性很强**”：
  - 没有模块系统
  - 常见用法是：针对**单个或少数进程**注入 su 环境
  - 通过 PATH / so 寄生等方式，让特定 APP 获得 su，而不是全局暴露
- 适配范围：**大致 3.10 ~ 6.6 内核**

**优点**：

- 不依赖内核源码，适配范围相对广  
- su 环境可以“定向注入”，对其他进程很隐蔽  

**缺点**：

- 没有完整的模块系统，操作较繁琐  
- 生态小众，文档和社区支持相对较弱  

---

####  [KernelSU](https://github.com/tiann/KernelSU)：主流内核态 Root + overlayfs 模块

#####  基本定位

- 代表性的 **内核态 Root**：
  - 在内核中安装 hook（LSM / cred 修改等）
  - 在执行 `/system/bin/su` 时，内核直接修改进程 cred 实现提权
- `/system/bin/su` 在 KernelSU 中是真正的 **提权入口**：
  - 它触发内核 hook  
  - 提权是在内核里完成的，而不是转发给某个守护进程（区别于 Magisk）

#####  技术路径演进

- 早期：通过 **谷歌GKI 内核（已被官方淘汰） / 内核源码集成（已被官方淘汰）** 集成 KernelSU  
- 现在主流：**LKM（ko 模块）方式**：
  - 把修改封装成内核模块加载进 GKI 内核
  - 同一大版本Gki内核编译出来的ko模块具有一定通用性,所以安装体验上不需要内核源代码
  - 但 **ko 的编译仍依赖内核的源码**，只是这部分由项目方/维护者完成
  - 对用户体验来说“不需要自己改源码”
  
  

##### 模块系统：元模块（支持overlyfs/magic mount或者自定义挂载方式）

- 默认使用 **overlayfs** 实现模块系统(首创)：
  - 支持对 `/system` 等只读分区做“上层覆盖”(模块安装后通常需要 **重启才能生效对/system的修改**)
- 对比 Magisk 的 magic mount：
  - overlayfs 是内核特性，语义更标准
  - 但实时性稍差，多数变更需要重启

##### 特点与限制

- **特点**：
  1. 内核态 su：安全模型清晰，可做细粒度 App profile（按 UID/GID 控制权限大小）  
  2. 官方overlayfs 模块系统：结构正规，可与 GKI 思路统一  

- **限制**：
  - 对低版本 / 非 GKI 内核兼容性差  
  - 一些魔改了内核且不开源的gki设备对谷歌官方gki内核支持差,刷了可能开不了机
  - 官方更推荐搭配 **5.10以上的 GKI 内核搭配ko模块使用**

---

#### [APatch](https://github.com/bmax121/APatch)：无需源码的 kpimg 内核 Root + KPM 模块

在内核 Root 方案中，APatch 的技术路线是目前**最“工程化 + 通用”的一类**。

##### 核心实现方式

- 仍然是 **内核态 Root**，但：
  - **不需要内核源码**
  - 使用 KernelPatch 工具链解析并 patch 目标内核镜像
- 通过在内核镜像中注入 **`kpimg`**：
  - 修改内核启动入口 / early init 流程
  - 把自定义 hook 注入到内核的启动过程
  - 重启后，`kpimg` 会在早期阶段接管部分逻辑，实现：
    - Root 提权  
    - 内核 hook（supercall / inline hook）  
    - 启动用户态守护/事件（[apd](cci:7://file:///c:/Users/Administrator/Documents/github/APatch/apd:0:0-0:0) 等）

##### 兼容性

- 内核版本范围广：**3.18 ~ 6.12**  
- 不依赖 GKI，不要求厂商公开内核源码  
- 对各家定制内核更友好（因为是直接对内核二进制镜像做符号分析与 patch）

##### 特点

1. **KPM 内核模块**：
   - 在已经被 kpimg 接管的内核里，动态加载 KPM 模块  
   - 支持对内核函数进行 hook，部分 hook 即时生效
   - 无`/system/bin/su`文件，通过监听拦截`/system/bin/su`或`su`指令来实现提权

2. **模块系统 + Lua 脚本**：
   - 用户态 [apd](cci:7://file:///c:/Users/Administrator/Documents/github/APatch/apd:0:0-0:0) 管理模块目录、事件（post-fs-data / boot-completed 等）  
   - 最新版本中可以用 **Lua** 替代传统 shell 脚本，增强复杂逻辑可维护性  

3. **不依赖内核源码的工程化链路**：
   - 用 [tools/kallsym.c](cci:7://file:///c:/Users/Administrator/Documents/github/APatch/1/KernelPatch/tools/kallsym.c:0:0-0:0)、[tools/patch.c](cci:7://file:///c:/Users/Administrator/Documents/github/APatch/1/KernelPatch/tools/patch.c:0:0-0:0) 等做符号解析、patch  
   - 用 [kernel/patch/android/user_init.sh](cci:7://file:///c:/Users/Administrator/Documents/github/APatch/1/KernelPatch/kernel/patch/android/user_init.sh:0:0-0:0) 等把 apd 接到系统启动阶段

4. 支持kernelsu的元模块挂载方案(2026.1.12补)

---

### 三、综合对比与结论

#### 技术路线对比（简表）

| 方案      | 类型             | 是否改内核代码 | 是否需Kernel源码 | 是否依赖 App | su 角色                         | 模块系统            |
|-----------|------------------|----------------|------------|--------------|----------------------------------|---------------------|
| KingRoot  | 漏洞 Root        | 否             | 否         | 需要     | 各家自定义                      | 无 / 简单补丁       |
| SuperSU   | system 注入 su   | 否             | 否         | 可选        | 传统 setuid su                  | 无                  |
| Magisk    | 用户态 Root      | 否（但改boot.img中的ramdisk）| 否        | 强依赖       | `/system/bin/su`中转到 `magiskd`                | magic mount         |
| SKRoot    | 内核 Root        | 是（patch 镜像）| 否        | 有工具/库    | 隐藏 su + 进程定向注入          | 无完整模块系统      |
| KernelSU  | 内核 Root        | 是（源码/GKI/LKM）| 技术层面上需要 | App 非必须 | `/system/bin/su` 触发内核提权   | 元模块      |
| APatch    | 内核 Root        | 是（kpimg patch）| 否       | App 非必须   | 内核 hook su/execve 等          | APM/KPM + Lua       |

#### 目前最主流的三款root方案分析

- **Magisk**：  
  适合追求 **广泛兼容 + 成熟模块生态** 的用户，一般设备能解锁 boot.img 就能用。

- **KernelSU**：  
  适合有 **GKI 内核**，且希望在内核层面细控 Root 权限（App profile）的人，  
  更偏“官方化”的内核模块方案，但对旧机型支持有限
  可以自定义挂载
  
- **APatch**：  
  从技术理念上最“硬核”，不依赖源码、支持广泛内核版本，  
  内核模块 hook + Lua 模块系统，对研究者 / 高级玩家非常友好。
