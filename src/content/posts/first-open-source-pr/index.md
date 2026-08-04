---
title: "随笔杂谈 | 我的第一个开源 PR：适配 APatch 的 gbl_root_canoe 兼容性修复"
published: 2026-05-24
description: "记录在一加15T上折腾ESP分区漏洞Root方案时，发现模块在APatch上WebUI初始化失败的问题，通过阅读源码定位原因并提交修复，完成了自己的第一个开源项目Pull Request。"
tags: ["Android", "Root"]
category: "随笔杂谈"
slug: first-open-source-pr
---

## 前言
在我初中接触Github并逐渐了解之后，我一直也想为开源社区做份贡献，也想给项目提交Pr。不过受限于自己的技术力还不够，也没有足够的时间与精力，以及合适的项目与机会。不过这个想法一直扎根在我的心头。

## 机会
在上了大学之后，我换了新手机一加15T，芯片骁龙8 Elite5。而在这一代手机刚好引入了esp分区，而且由于高通的疏忽，没有验证esp分区，导致部分版本的系统可以执行任意efi底层代码，于是便有了这个[项目](https://github.com/superturtlee/gbl_root_canoe)。简单来说，这个项目可以在手机启动前无论手机有没有解锁bl，都返回bl已经上锁的信息，来通过手机的keystore效验。于是我尝试了这个项目的magisk模块，但是在[APatch](https://blog.liao-ke.com/p/android-root/)上发现模块的WebUI无法初始化成功。

## 解决
于是乎，我翻了一下[APatch](https://blog.liao-ke.com/p/android-root/)和这个[项目](https://github.com/superturtlee/gbl_root_canoe/blob/main/targets/magisk_module/module/webroot/app.js)的源代码，我发现了问题的原因，这个项目模块在初始化的时候会调用KSU里面内置的一些函数方法，但是[APatch](https://blog.liao-ke.com/p/android-root/)并没有内置这个方法函数，所以会导致在[APatch](https://blog.liao-ke.com/p/android-root/)上面，这个模块会初始化失败，于是乎，我改了一下[项目](https://github.com/superturtlee/gbl_root_canoe/blob/main/targets/magisk_module/module/webroot/app.js)的源代码，当检测到没有这个方法函数的时候，将会采取手动历遍，并且返回相对应的数据结构的方法来兼容[APatch](https://blog.liao-ke.com/p/android-root/)。

## 灵机一动
当我完成了以上事宜之后，突然想到，我做的这些不正好可以提交一个Pr来改进项目吗？于是乎抱着坎坷的心情，我提交了我第1个[Pr](https://github.com/superturtlee/gbl_root_canoe/pull/44#event-25855613583)。

## 结果
在怀着坎坷的心情等了几天之后，原作者受理并成功通过了我的PR请求，这次经历无疑是圆了我初中时一直有的一个愿望。
