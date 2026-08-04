---
title: "学习笔记 | Hugo自动修正文章最后修改时间的最佳方案"
published: 2026-01-25
description: "面向 Serverless/CI 自动部署场景，分析 Hugo 获取 lastmod 的几种方式（:filemodtime/:git/lastmod/date）的坑点，并给出“用 Git 提交时间回写文件时间戳 + :filemodtime”的稳定方案与脚本思路。"
tags: ["hugo", "博客", "指南"]
category: "学习笔记"
slug: hugo-add-lastmod-to-posts
---

# Hugo 全自动修正文章修改时间的最佳实践（Serverless 场景）

在使用 Hugo 构建静态博客时，**文章的修改时间（Last Modified Time）** 是一个非常重要但又容易踩坑的问题，尤其是在 **Serverless / CI 自动部署** 场景下。

Hugo 官方目前提供了多种用于确定文章修改时间的方式：

## Hugo 支持的修改时间来源

- **`:filemodtime`**  
  使用文件本身的最后修改时间作为文章的修改时间。

- **`lastmod`**  
  需要在文章 Front Matter 中手动维护 `lastmod` 字段。

- **`:git`**  
  使用 Git 中该文件的**最后一次提交时间**作为修改时间（依赖 `gitinfo`）。

- **`date`**  
  使用文章的发布时间作为修改时间。

---

## 各方案的自动化可行性分析

在上述方案中：

- ✅ **可自动化**
  - `:filemodtime`
  - `:git`

- ❌ **不适合全自动**
  - `lastmod`（需要人工维护）
  - `date`（语义不符）

---

## :filemodtime 在 Serverless 场景下的问题

使用 Hugo 的一个重要原因，正是为了 **方便地将网站部署到 Serverless 平台**（如 Cloudflare Pages、Vercel、Netlify 等）。

然而在 Serverless / CI 场景中：

- 每次部署都会重新 `git clone` 仓库
- 所有文件的 **文件系统修改时间** 都会变成「拉取时间」
- 这会导致：
  - 所有文章的修改时间被错误地更新为“本次部署时间”
  - 完全失去文章真实修改时间的意义

因此，**`:filemodtime` 在默认情况下并不适合 Serverless 场景**。

---

## :git 方案的现实问题

理论上，`:git` 是最理想的方案：

- 修改时间与 Git 提交严格一致
- 完全自动化
- 不依赖文件系统时间戳

但在实际使用中：

- 即使开启了 `enableGitInfo = true`
- 某些情况下 `:git` **无法正确生效**
- 在 CI / Serverless 环境中尤为明显

不确定这是环境限制、Git shallow clone、还是 Hugo 本身的 Bug，但结果是：**该方案在实践中不够稳定**。

---

## 最终解决方案：修改文件时间戳为Git 提交时间 + :filemodtime

综合以上问题，我最终总结出了一套**最适合 Serverless 管理的全自动方案**：

### 核心思路

>**在 Hugo 构建之前，将文件的修改时间戳“伪装”为 Git 最后提交时间。**

具体流程如下：

1. Hugo 中使用 `:filemodtime` 作为文章修改时间来源
```
[frontmatter]
lastmod = [':fileModTime']
```
2. 将脚本放在文件夹根目录
3. 将自动执行脚本的命令和正式部署命令合二为一(**这里需要注意的是一般的serverless平台拉取项目只是浅层克隆不会把文件的最后提交信息给拉取过来，所以我们要在最前面要执行完整的拉取命令。**)
```
git fetch --unshallow && chmod +x 1.sh && ./1.sh && hugo
```
4. Serverless平台设置环境变量TZ为Asia/Shanghai(不然的话，一般Serverless平台默认应该是美国的时间,会影响构建出来的网站的文章的最后修改日期的准确性)
 
这样就可以做到：

- ✅ 修改时间与 Git 提交时间一致
- ✅ 完全自动化
- ✅ 与 Serverless / CI 环境完美兼容

---

## 自动同步 Git 提交时间到文件修改时间的脚本

下面的脚本用于：

> **将当前目录下所有文件的最后修改时间，统一修改为对应的 Git 最后提交时间**

```bash
# （此处放置你的脚本内容）
#!/bin/bash
# git-set-filetime.sh
# 功能：将 git 仓库中所有被追踪文件的修改时间改为最后一次提交时间

# 确保当前目录是 git 仓库
if [ ! -d ".git" ]; then
    echo "Error: 当前目录不是 git 仓库根目录"
    exit 1
fi

# 获取所有被追踪文件（包含特殊字符/空格/中文）
git ls-files -z | while IFS= read -r -d '' file; do
    # 获取最后一次提交的 Unix 时间戳
    timestamp=$(git log -1 --format="%ct" -- "$file")
    
    if [ -n "$timestamp" ]; then
        # 使用 touch 修改文件修改时间
        # -d "@$timestamp" 表示从 Unix 时间戳设置时间
        touch -d "@$timestamp" "$file"
        echo "Updated: $file -> $(date -d "@$timestamp" '+%Y-%m-%d %H:%M:%S')"
    else
        echo "Skipped (not tracked): $file"
    fi
done

echo "All tracked files' modification times updated."
```
