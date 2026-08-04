---
title: "开发日记 | AutoGlm：用 Chaquopy 把 AI 控制手机的 Python 项目搬进安卓 APP"
published: 2026-07-30
description: "记录将 Open-AutoGLM 这套基于 ADB 的手机自动化控制系统，通过 Chaquopy 嵌入式 Python 和自制 libadb.so 移植进安卓原生 APP 的开发过程与踩坑经历。"
tags: ["AI", "Android"]
category: "开发日记"
slug: autoglm-dev-diary
---

## 前言

几个月前，偶然间发现了一个项目[**Ruto**](https://github.com/iamr0s/Ruto-GLM)，简单来说就是可以用自然语言让AI操控手机进行一些操作，比如说点外卖，给谁发消息之类的。于是乎我突发奇想，想着能不能做一个类似的项目,但是让我从零手搓一套ai控制系统显然是有一点难度的。

## 开发历程

然后我又看到了一个项目[**Open-AutoGLM**](https://github.com/zai-org/Open-AutoGLM),这个项目是在电脑上基于Python，通过有线或者无线ADB连接手机，然后让AI操作手机，是一个现成的操作控制系统，但是我要如何把这套系统移植到安卓手APP上来呢？

### 用 Chaquopy 把 Python 塞进安卓

这个项目是基于Python的，于是我便利用了[**chaquopy**](https://chaquo.com/chaquopy)这个嵌入式Python运行器(因为安卓上没有runtime这个概念,不像windows一样可以装Python运行环境，安卓应用只能使用嵌入式python来运行python代码,且[**chaquopy**](https://chaquo.com/chaquopy)他的Python依赖库不全，而且有些版本有点落后,出现了项目的语法兼容性问题。为了让[**chaquopy**](https://chaquo.com/chaquopy)兼容[**Open-AutoGLM**](https://github.com/zai-org/Open-AutoGLM),当时调试依赖版本，就费了好长的时间)。在 `build.gradle.kts` 里接入：

``` kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    id("com.chaquo.python")
}
```

这样原项目 `phone_agent` 这一整套 Python 包（`agent.py`、`adb/`、`actions/`、`config/` 等）就可以原封不动地放进 `app/src/main/python/` 目录，跟着 APK 一起打包，运行时由 Kotlin 侧直接调用：

``` kotlin
val py = Python.getInstance()
val module = py.getModule("main")

val result = module.callAttr(
    "main",
    "--adb-path", adbPath,
    "--base-url", baseUrl,
    "--model", model,
    "--apikey", apiKey,
    "--device-type", "adb",
    task
)
```

### adb 二进制变成 libadb.so

原项目里面用的是adb命令连接手机，于是我费了九牛二虎之力，终于在github上找到了能在安卓上成功运行起来的adb二进制文件,但是由于在新的安卓开发标准中不允许直接把现成的二进制文件打包进APK里了,必须要把adb命名为adb.so。为了让它落地到真实文件系统而不是留在压缩包里，还得在 `build.gradle.kts` 里强制用 legacy 打包方式：

```kotlin
android {
    packaging {
        jniLibs {
            // 强制将 .so 文件提取到磁盘上，而不是留在 APK 中
            // 这样 context.applicationInfo.nativeLibraryDir 目录下才会有真实文件
            useLegacyPackaging = true
        }
    }
    ...
    defaultConfig {
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
        ...
    }
}
```

### 让 Python 侧的 adb 调用重定向到 libadb.so

但是原项目又是直接调用终端环境中的adb,最后没办法，只能修改源代码，又增加了对adb执行命令的hook，让它自动重定向到我设置目录下的adb.so。

`phone_agent/adb/connection.py`（以及 `screenshot.py`、`input.py`、`device.py`）里的每一处 adb 调用，默认都是直接执行名为 `adb` 的命令：

``` python
class ADBConnection:
    def __init__(self, adb_path: str | None = None):
        self.adb_path = adb_path or os.getenv("PHONE_AGENT_ADB_PATH", "adb")

    def connect(self, address: str, timeout: int = 10) -> tuple[bool, str]:
        ...
        result = subprocess.run(
            [self.adb_path, "connect", address],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
```

好在原作者已经预留了 `PHONE_AGENT_ADB_PATH` 这个环境变量作为覆盖入口，所以我不需要大动干戈改 Python 逻辑，只要在 Kotlin 侧启动 Python 之前，把这个环境变量／命令行参数指向我 APK 私有目录下解压出来的 `libadb.so` 即可：

``` kotlin
private fun runPython(
    context: Context,
    baseUrl: String,
    model: String,
    apiKey: String,
    task: String,
    onLog: (String) -> Unit,
    onFinish: () -> Unit
) {
    thread {
        val wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Python:Run").apply { acquire(15*60*1000L) }
        try {
            val adbPath = File(context.applicationInfo.nativeLibraryDir, "libadb.so").absolutePath
            val py = Python.getInstance()
            val module = py.getModule("main")

            val result = module.callAttr(
                "main",
                "--adb-path", adbPath,
                ...
                task
            )
            onLog("任务结束：\n$result\n")
        } catch (e: Exception) {
            onLog("运行错误：\n${e.message}\n")
        } finally {
            if (wakeLock.isHeld) wakeLock.release()
            onFinish()
        }
    }
}
```

而 `main.py` 里接收到这个参数后，会写回同一个环境变量，`connection.py`、`screenshot.py`、`input.py`、`device.py` 里所有 `os.getenv("PHONE_AGENT_ADB_PATH", "adb")` 的调用就都会统一指向 `libadb.so`，而不是系统里根本不存在的 `adb` 命令：

``` python
os.environ["PHONE_AGENT_ADB_PATH"] = args.adb_path or "adb"
```

另外我还单独封装了一个 `Adb.kt` 工具对象，用来处理无线连接、配对这类交互场景（比如输入配对码），逻辑上和 Python 侧是平行的两条调用链：

``` kotlin
object Adb {
    fun exec(
        ctx: Context,
        args: List<String>,
        input: String? = null,
        onLine: ((String) -> Unit)? = null
    ): String {
        val adbPath = File(ctx.applicationInfo.nativeLibraryDir, "libadb.so").absolutePath
        val process = ProcessBuilder(listOf(adbPath) + args)
            .redirectErrorStream(true)
            .start()
        ...
    }

    fun connect(ctx: Context, addr: String, onLine: ((String) -> Unit)? = null) =
        exec(ctx, listOf("connect", addr), onLine = onLine)

    fun pair(ctx: Context, addr: String, code: String, onLine: ((String) -> Unit)? = null) =
        exec(ctx, listOf("pair", addr), input = code, onLine = onLine)
}
```

这样一来，"电脑上跑的 Python + 命令行 adb"这套控制系统，就被完整地搬进了一个安卓 APP 里：Chaquopy 用于跑 Python 逻辑，`libadb.so` 冒充原生库绕过打包限制，`PHONE_AGENT_ADB_PATH` 这个环境变量作为两边的"接口"，把 Python 里所有原本指向系统 `adb` 命令的调用，重定向到了 APK 自己私有目录下的这个二进制文件上。

## 后记
这种项目本质上是把安卓系统上的操作截图让ai理解，然后**返回相应的指令模拟人为的触屏操作**，这种方法过于低效，而且容易让ai陷入死循环，无法执行正确的决策。不过最新的安卓应用开发标准，已经支持应用对外暴露函数接口和方法让ai智能体直接调用，不需要模拟人为的触屏。相信不久的将来马上会出现更为高效的Ai控制手机的方案。

 
## 项目地址
https://github.com/iliaoke/AutoGlm/tree/main
