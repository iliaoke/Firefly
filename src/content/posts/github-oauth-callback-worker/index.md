---
title: "学习笔记 | 简单设计一个OAuth认证回调服务器"
published: 2026-07-28
description: "使用 Cloudflare Worker 实现一个无状态的 GitHub OAuth 回调服务器，完成 code 换取 access_token，并通过自定义 App Scheme 返回移动端，分析这种方案的实现原理、优缺点及适用场景。"
tags: ["网络"]
category: "学习笔记"
slug: github-oauth-callback-worker
---

## 前言
暑假待在家里没得事做，想做一个移动端的博客写作客户端,由于我的博客内容是储存在github上的,所以在开发的过程中，我需要学习一下github OAuth认证流程。简单的了解了一下 github的OAuth认证流程大致是当用户认证成功之后，会下发一个code给认证地址,然后通过code和客户端id以及客户端密钥向github发起请求,便可以得到用户的access token。我一开始以为这个code到access token的流程必须要一个服务器才可以完成，但是突然想到这种流程化的事情，不需要保存状态的,像cloudflare worker这样的serverless平台,应该也可以办到,于是用cloudflare worker简单的做了一个认证回调服务器。

## 代码


先解析 URL 上的参数:`code`、`state`,还有可能出现的 `error`。这里有个容易漏掉的点——用户在授权页点"取消"的时候,GitHub 不会给 `code`,而是直接带 `error=access_denied` 跳回来,所以必须先判断 `errorParam`,不然后面拿着空 `code` 去请求 GitHub,只会得到一个莫名其妙的报错。

```js
if (errorParam) {
  return redirectToApp(env, {
    error: errorParam,
    error_description: errorDescription || "",
    state: state || "",
  });
}
```

拿到正常的 `code` 之后,就是 POST 请求打到 `https://github.com/login/oauth/access_token`,body 里带上 `client_id`、`client_secret`、`code`、`redirect_uri`,这一步是服务端对服务端换 token,`client_secret` 只能放在这里,绝对不能出现在 App 里,不然反编译一下就全露了。这里踩了个小坑:请求头一定要加 `Accept: application/json`,不加的话 GitHub 默认返回的是 `key=value&key2=value2` 这种查询字符串格式,还得自己手动解析,挺麻烦的。

换完之后,不管是换 token 失败、GitHub 返回业务错误（比如 `bad_verification_code`，也就是 code 过期或者已经被用过了）、还是成功拿到了 `access_token`,最后都统一走 `redirectToApp` 这一个函数 302 回 App:

``` js
function redirectToApp(env, params) {
  const target = new URL(env.APP_SCHEME);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      target.searchParams.set(k, v);
    }
  }
  return Response.redirect(target.toString(), 302);
}
```

这样设计的好处是,App 那边只需要检查跳转回来的 URL 上有没有 `access_token`,就能判断整个流程走没走通,完全不用关心中间到底是哪个环节出的问题。

## 后记
弄完之后，才发现其实连服务器都不需要,浏览器是支持输入应用app scheme的,在浏览器通过这个跳转到应用内部，让应用接收code，然后在应用内部实现code转access token的过程。不过这样的话，就得把客户端id和客户端密钥写进应用内部，如果被人反编译出来，就会有密钥泄露的风险。而且如果是设计更复杂的应用，涉及到第三方账号的绑定，数据库的查询读写，这些操作都应该放到云端认证回调服务器上去执行，而不应该放在本地客户端里面。把认证回调服务器写成本地APP scheme这种方案只能临时用于没有服务器的情况，不能放在正式的生产环境。

## index.js
```js
/**
 * GitHub OAuth 回调 Worker（简化版，仅用于拿到 access_token）
 *
 * 流程：
 * 1. App 用系统浏览器打开 GitHub 授权页
 *    https://github.com/login/oauth/authorize?client_id=...&redirect_uri=<本Worker的/callback地址>&scope=repo&state=xxx
 * 2. 用户同意后，GitHub 302 重定向到本 Worker 的 /callback，带上 code、state
 * 3. 本 Worker 用 code 向 GitHub 换取 access_token（服务端对服务端，带 client_secret）
 * 4. 本 Worker 302 重定向到 App 的自定义 scheme，把 access_token 直接带回去
 *    myapp://oauth/callback?access_token=xxx&state=xxx
 * 5. App 拦截该 scheme，取出 access_token，存到本地安全存储，之后用它直接调 GitHub API
 *
 * 需要在 wrangler 中配置以下变量：
 * - GITHUB_CLIENT_ID      GitHub OAuth App 的 Client ID
 * - GITHUB_CLIENT_SECRET  GitHub OAuth App 的 Client Secret（用 secret 存储）
 * - APP_SCHEME            App 自定义 scheme，例如 "myapp://oauth/callback"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    console.log(`[REQUEST] ${request.method} ${url.pathname}${url.search}`);

    if (url.pathname === "/callback" && request.method === "GET") {
      return handleCallback(request, env);
    }

    console.log(`[REQUEST] 未匹配任何路由，返回默认响应`);
    return new Response("GitHub OAuth callback worker is running.", {
      status: 200,
    });
  },
};

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  console.log(
    `[CALLBACK] 收到回调参数: code=${code ? code.slice(0, 8) + "..." : "null"}, ` +
      `state=${state || "null"}, error=${errorParam || "null"}, ` +
      `error_description=${errorDescription || "null"}`
  );

  // 用户在 GitHub 授权页点击了"取消"
  if (errorParam) {
    console.log(`[CALLBACK] 用户拒绝授权或GitHub返回错误: ${errorParam} - ${errorDescription}`);
    return redirectToApp(env, {
      error: errorParam,
      error_description: errorDescription || "",
      state: state || "",
    });
  }

  if (!code) {
    console.log(`[CALLBACK] 缺少code参数，终止处理`);
    return new Response("缺少 code 参数", { status: 400 });
  }

  try {
    console.log(
      `[TOKEN] 开始向GitHub换取access_token, client_id=${env.GITHUB_CLIENT_ID}, ` +
        `redirect_uri=${url.origin}/callback`
    );

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "cloudflare-worker-github-oauth",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/callback`,
      }),
    });

    console.log(`[TOKEN] GitHub token接口HTTP状态码: ${tokenRes.status}`);

    if (!tokenRes.ok) {
      const bodyText = await tokenRes.text();
      console.log(`[TOKEN] 请求失败，响应体: ${bodyText}`);
      return redirectToApp(env, {
        error: "token_exchange_failed",
        error_description: `GitHub token endpoint returned ${tokenRes.status}`,
        state: state || "",
      });
    }

    const tokenData = await tokenRes.json();

    // 注意：access_token 只打印前几位，避免完整token出现在日志里
    console.log(
      `[TOKEN] GitHub返回内容: ` +
        `access_token=${tokenData.access_token ? tokenData.access_token.slice(0, 8) + "..." : "null"}, ` +
        `scope=${tokenData.scope || "null"}, ` +
        `token_type=${tokenData.token_type || "null"}, ` +
        `error=${tokenData.error || "null"}, ` +
        `error_description=${tokenData.error_description || "null"}`
    );

    if (tokenData.error) {
      // 常见：bad_verification_code（code过期/已用过）、incorrect_client_credentials（client_id或secret错）
      console.log(`[TOKEN] GitHub返回业务错误: ${tokenData.error}`);
      return redirectToApp(env, {
        error: tokenData.error,
        error_description: tokenData.error_description || "",
        state: state || "",
      });
    }

    if (!tokenData.access_token) {
      console.log(`[TOKEN] 异常：GitHub未返回error，但也没有access_token`);
      return redirectToApp(env, {
        error: "no_access_token",
        error_description: "GitHub未返回access_token",
        state: state || "",
      });
    }

    console.log(`[TOKEN] 换取成功，即将302重定向回App`);

    // 直接把 GitHub 的 access_token 带回 App
    // 注意：GitHub 传统 OAuth App 签发的 token 默认长期有效，没有 refresh_token
    return redirectToApp(env, {
      access_token: tokenData.access_token,
      scope: tokenData.scope || "",
      state: state || "",
    });
  } catch (err) {
    console.log(`[ERROR] 处理过程中抛出异常: ${err && err.stack ? err.stack : err}`);
    return redirectToApp(env, {
      error: "internal_error",
      error_description: String(err && err.message ? err.message : err),
      state: state || "",
    });
  }
}

/**
 * 把结果通过 302 重定向带回 App 自定义 scheme
 * env.APP_SCHEME 形如："myapp://oauth/callback"
 */
function redirectToApp(env, params) {
  const target = new URL(env.APP_SCHEME);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      target.searchParams.set(k, v);
    }
  }

  // access_token 是敏感信息，日志里只打印前几位，避免完整token写入日志
  const loggedUrl = target.toString().replace(
    /access_token=([^&]+)/,
    (_, t) => `access_token=${t.slice(0, 8)}...`
  );
  console.log(`[REDIRECT] 302重定向回App: ${loggedUrl}`);

  return Response.redirect(target.toString(), 302);
}
```

## wrangler.toml
```toml
name = 'oauth-woker'
main = "index.js"
compatibility_date = "2026-07-24"
# 非敏感变量可以直接写在这里
[vars]
APP_SCHEME = "xxx://xx/xx"

# 以下敏感信息不要写在 toml 里，改用 wrangler secret 命令设置：
#
#   wrangler secret put GITHUB_CLIENT_ID
#   wrangler secret put GITHUB_CLIENT_SECRET
#
# 设置后 Cloudflare 会加密存储，不会出现在代码仓库或部署日志中
[observability]
enabled = true          # 总开关必须是 true，下面的子配置才会生效

[observability.logs]
enabled = true
head_sampling_rate = 1
invocation_logs = true

[observability.traces]
enabled = false          # 你现在确实不需要traces，关掉没问题
```
