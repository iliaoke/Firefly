---
title: "学习笔记 | Steam 假入库那些事"
published: 2025-12-03
description: "从 Steam 授权与清单文件机制出发，拆解“假入库”的实现思路（清单/密钥获取、Steamworks API 劫持等），对常见做法的局限与风险做说明，并给出辨别与处理建议。"
tags: ["Steam", "游戏"]
category: "学习笔记"
slug: steam-fake-inventory
---

## Steam假入库到底是什么？

淘宝上有很多低价的steam游戏cdk,但购买之后实际是运行脚本入库(有自己steam账号信息泄露的风险),可以在本地游玩.（**换台设备重新登录账号，假入库游戏将会被清空。**）

**实际上账号并没有拥有游戏,别人是看不到你的账号拥有该游戏的**  

### 假入库原理分析:

 **Steam购买游戏相当于购买游戏的游玩资格，购买完成后，将会下载游戏的清单文件(相当于下载列表),然后steam会用游戏的depot key(正版购买用户自动下发)对清单文件进行解密下载,下载完成后，打开游戏会调用steamwork api进行验证当前运行的steam账号是否拥有该游戏,认证通过后即可正常游玩。**

 我们可以在其中做些手脚,便可以实现假入库。


 
 1. 游戏清单文件是可以公开找到的，但是需要正版账号的depot key解密才可以解密下载(**游戏每一个版本的清单文件对应着一个depot key,所以想要玩到最新的游戏内容，密钥文件也需要及时更新**)。假入库的商家可能会根据爬虫或者其他技术手段(如通过木马病毒从其他steam玩家账号中提取depot key)，可以搞到最新的游戏depot key

 2. 通过解密清单将游戏完整下下来后,通过steamtool/GreenLuma hook注入自己的.dll文件,对steam原有的steamwork api进行劫持,便可以实现让游戏认为账号已经获取了该游戏的游玩权限。

 于是乎通过以上手段，便实现了一套完整的steam游戏假入库

 **在steam游戏破解游玩方面,主要有两种破解方法**
 ### 一是对steam客户端进行crak
  让steam认为你拥有该游戏的游玩权限,再搭配实时获取别人最新的depot key,便可实现几乎与正版购买一致的游戏体验(云存档,成就系统等等)
     
#### 弊端:
   1. 无法使用联机功能
   2. 别人看不到你库中的游戏(无伤大雅,除非你想要通过玩游戏来证明自己的老资历,在某盒软件舆论战中占上风)
   3. 系统重装后，steam假入库游戏入库数据会消失(要玩的时候重新入一下库就行了，问题不大)

#### 典型代表:
   - [steamtool](https://www.steamtools.net) (闭源，国人大佬开发,功能强大)
   - [GreenLuma](https://cs.rin.ru/forum/viewtopic.php?t=103709)(原版纯命令行,操作较难,闭源,外国论坛发布)
   - [GreenLuma_CN](https://github.com/clinlx/CN_GreenLumaGUI)(原版加上前端，方便操作)
   
   

### 二是对游戏文件本身进行修改
   对游戏文件夹本身进行修改,内置一个模仿steam api行为的第三方轻量steam client,实现steam游戏脱离steam官方客户端运行,方便游戏在互联网上传播

#### 弊端:
   1. 不方便游戏新版本的更新和获取
   2. 无法使用steam官方客户端的一些功能

#### 典型代表:
   - [gbe_fork](https://github.com/Detanup01/gbe_fork)
   - [steam-auto-crak](https://github.com/SteamAutoCracks/Steam-auto-crack)

### 其他:
  - steamlan/gbe 通过模仿steam lan api,可以实现游戏在线/离线模式下局域网联机,而不需要走steam官方服务器
  - [steamless](https://github.com/atom0s/Steamless) 移除steam端的d加密(不会绕过游戏游玩验证,并且非steam的d加密无法破解，比如说黑猴,需要使用别人的d加密密钥才可以认证游玩)

### 总结:
   Steam假入库商家通常通过劫持steam根目录的hid.dll文件进行自定义操作,hook核心一般采用steamtool,加上不知道哪里搞来的清单depot key源,由于是黑箱代码,无法准确判断是否含有其他的木马病毒,来获取自己steam的一些信息,对账号造成隐性风险,所以不建议使用淘宝上的 steam假入库。

#### 辨别方法:
  由于steam假入库这件事已经有一定的知名度了,有些商家也学聪明了，把正版的激活流程放在介绍页，然后下面配一行小字，如果正版激活不行(100%是不成功的)，再采用其他方法(他们自己的脚本).

  主要由以下两个方法判断:

  1. cdk价格过低的，100%都是假入库
  2. 直接询问客服是否可以在手机上通过steam客户端cdk激活（假入库的脚本程序无法在手机上运行）

#### 解除假入库
1. 使用[steam解锁文件管理器](https://cloud.ksmlc.cn/home?path=cloudreve%3A%2F%2FPDSB%40share)删除假入库的游戏
2. ~~然后删除steam根目录的hid.dll~~(steam更新64位后,hid.dll劫持的方案已经失效了,换别的方案了)

**最后严肃声明，本文章仅供技术探讨，支持正版从我做起**
