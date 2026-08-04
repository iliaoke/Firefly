---
title: "学习笔记 | GKI 内核不完全编译实战"
published: 2025-12-05
description: "以 GKI 5.10+ 为例，记录 Android 内核“不完全编译”的完整流程：环境依赖、编译链选择、编译命令到 AnyKernel3 打包刷入，并附常见坑与排查思路。"
tags: ["Android", "内核", "Gki", "指南"]
category: "学习笔记"
slug: android-gki-kernel-compile
---

## Android内核编译

**以编译5.10以上的内核为例,所需资源:**
1. 一台配置较好的电脑
2. linux系统
3. 内核源代码
4. 编译链工具
### linux系统
- 各大Linux系统(Ubuntu系/arch系/fedora系/Wsl2)都可以，网上教程多以Ubuntu lts版本为例(**便于找依赖和教程**)  

 ### 内核源代码
 从github上搜索自己机型的内核源代码  
如`https://github.com/Evolution-X-Devices/kernel_xiaomi_sm8450`(**项目名一般采用   kernel_厂家名_芯片组代号   的形式,5.10之后都是gki内核,所以内核名称基本是以芯片组命名如sm8450,有些项目也可能是按机型代号命名，而不是芯片组**)  
  
### 编译链工具
5.10以上的内核一般采用纯clang/llvm进行编译(低版本内核也可尝试，但有可能能成功编译但会开不了机)
#### Clang/llvm
Clang 一般情况下采用的是[google](https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+/refs/heads/main)的正式分支,也可以采用[测试分支](https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+/refs/heads/mirror-goog-main-prebuilts)  

### 编译过程
#### 更新环境依赖
以Ubuntu24.04为例,执行以下命令安装依赖
```bash  
sudo apt-get install git-core gnupg flex bison build-essential zip curl zlib1g-dev gcc-multilib g++-multilib libc6-dev-i386 libncurses5 lib32ncurses5-dev x11proto-core-dev libx11-dev lib32z1-dev libgl1-mesa-dev libxml2-utils xsltproc tar xz-utils cpio findutils
``` 
#### 克隆内核源代码和编译链工具  
内核:`git clone https://github.com/Evolution-X-Devices/kernel_xiaomi_sm8450.git --depth=1`  
编译链工具:`git clone https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86.git --depth=1`  
**depth=1**只拉取文件，不拉取历史提交，可以极大减少下载时间  
如果想拉取其他的测试分支，也可以在后面加`-b 测试分支名字`  
如拉取测试版的编译链则添加`-b mirror-goog-main-prebuilts`  
#### 设置环境变量  
注:`以下操作需要在同一个终端环境下执行，因为添加的变量是临时变量`  
此时在你的工作目录下面应该会有两个文件夹，一是`内核文件夹`，二是`编译链工具文件夹`  
打开终端,执行`cd 编译链工具文件夹路径`,当前目录下应该会有若干个`clang-rxxxx`子文件夹，选择后缀数字最大的最新版本即可,将它下面的/bin添加到环境变量中  
```bash
export PATH="$PATH:/../../编译链工具文件夹/clang-rxxxx/bin"
```
然后再`cd 内核源代码文件夹`  
设置编译环境变量
```bash
export ARCH="arm64"
export SUBARCH="arm64"
export CC="clang"
export LLVM=1
export LLVM_IAS=1
export HOSTCC=clang
export LD=ld.lld
export CLANG_TRIPLE="aarch64-linux-gnu-"
```
如果电脑的内存不太够，可以额外设置
```bash
export LTO=thin
```
#### 执行编译命令
```bash
make ARCH="arm64" gki_defconfig
make -j$(nproc --all)
```
第一行命令是加载配置文件gki_defconfig,他所在的目录是`/内核源代码/arch/arm64/configs/gki_defconfig`（可以自行修改里面的配置项）  
编译出来的内核二进制文件会在`/内核源代码/arch/arm64/boot/Image`  
### 打包内核
由于没有编译kernel-devicetree,也没ramdisk,所以无法和内核二进制文件打包成boot.img刷入手机分区(也可以用magiskboot把手机原本的boot.img进行解包，把其中的内核二进制文件替换之后,再打包就行了)  
这个时候就需要[AnyKernel3](https://github.com/osm0sis/AnyKernel3)对内核二进制文件进行打包  
详细教程参考  
https://github.com/tiann/KernelSU/discussions/952  
### 刷入内核
可以在twrp或一些用于刷写内核的app中刷入打包后的AnyKernel3.zip

### 注意  
**不同型号内核以及不同版本的编译器，可能对依赖和代码语法要求也有所不同，需要自行解决。**
