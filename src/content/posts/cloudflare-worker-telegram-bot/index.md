---
title: "开发日记 | 用cloudflare worker实现telegram bot"
published: 2025-10-20
description: "使用Cloudflare Worker和KV数据库实现带有记忆功能的Telegram聊天机器人，无需服务器即可部署AI对话功能"
tags: ["指南"]
category: "开发日记"
slug: cloudflare-worker-telegram-bot
---

这段时间闲着没事，想做一个 Telegram Bot 来玩玩。了解了一下，可实施的开发方案还挺多的，Java/Python 等等都有相对应的库。但是奈何**我没有服务器**，无法进行传统的前后端开发。

于是乎，我想到了另一种开发思路：利用 **Cloudflare 提供的 Serverless 无状态 JavaScript Worker** 以及 **Telegram Bot 官方支持的 Webhook 功能**来实现无服务器聊天机器人。

## 实现原理

我们在聊天机器人的界面发送命令：
```
/chat 聊天内容
```

通过设置 Webhook 地址指向 Worker，Worker 中写好处理指令的代码，截取 `/开始` 后面的文字，然后转发给 **Cloudflare 官方提供的免费的大语言模型后端**，然后再处理返回的信息，最后再通过 **Telegram Bot API** 再返回消息到客户端。

这样便实现了**无服务器的聊天 AI Bot**，但是这有个缺点：用户的每一次聊天都是单独的一次请求，bot没有上下文记忆,因为 Worker 本身是个**无状态的js执行器**，所以这个 Bot 其实相当于是一个**图形化的终端命令请求器**。

## 但是 **Cloudflare 有提供免费的额外的 KV 数据库**，于是我们再改动一下代码：

1. 用户发来的文字不直接请求大语言模型后端
2. 而是先**存入 KV 数据库**
3. 最后将 KV 数据库里的数据一起再发给大语言模型后端
4. 处理返回的信息
5. 返回 Telegram 客户端

于是Worker通过外挂KV数据库，最终便实现了**带有记忆的无服务器聊天 AI 机器人**。

## 实现源代码
```javascript
const TELEGRAM_BOT_TOKEN = "";
const CF_API_TOKEN = "";

async function run(model, input) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/1f5b3d5417456835c8191a2ec42f449e/ai/run/${model}`,
    {
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return await response.json();
}

async function sendTelegramMessage(chat_id, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode: "MarkdownV2", 
      }),
    });
  } catch (err) {
    console.error("发送 Telegram 消息失败:", err);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("ok", { status: 200 });

    try {
      const data = await request.json();
      console.log("Telegram Update:", JSON.stringify(data));

      const message = data.message;
      if (!message?.text) return new Response("ok", { status: 200 });

      const text = message.text;
      const match = text.match(/^\/chat(?:@\w+)?(?:\s+([\s\S]+))?$/);
      const arg = match ? (match[1] || "").trim() : "";

      console.log("完整消息文本:", text);
      console.log("命令参数:", arg);
         
      if (!arg) {
        await sendTelegramMessage(message.chat.id, "请在 /chat 后输入要生成的内容，例如：/chat 写一个小故事");
      } else {
        
        let history = await env.bot.get(message.chat.id);
        history = history ? JSON.parse(history) : [];
        history.push({ role: "user", content: arg });
        await env.bot.put(message.chat.id, JSON.stringify(history));
      
        const aiResponse = await run("@cf/openai/gpt-oss-120b", {
          instructions: '你是liaoke的私人中文AI助手，简洁地回答用户的问题。',
          reasoning: { "effort": "medium" },
          input: history,
        });

        console.log("AI 原始响应:", JSON.stringify(aiResponse));

       
        const reasonText = aiResponse?.result?.output
          ?.filter(o => o.type === "reasoning")
          ?.map(o => o.content?.map(c => c.text).join("\n"))
          .filter(Boolean)
          .join("\n\n") || "AI 无法生成内容";

        const outputText = aiResponse?.result?.output
          ?.filter(o => o.type === "message")
          ?.map(o => o.content?.map(c => c.text).join("\n"))
          .filter(Boolean)
          .join("\n\n") || "AI 无法生成内容";

       
        const escapeMD = (text) => {
          if (!text) return "";
          return text
            .replace(/\\/g, "\\\\")
            .replace(/`/g, "\\`")
            .replace(/_/g, "\\_")
            .replace(/\*/g, "\\*")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
            .replace(/~/g, "\\~")
            .replace(/>/g, "\\>")
            .replace(/#/g, "\\#")
            .replace(/\+/g, "\\+")
            .replace(/-/g, "\\-")
            .replace(/=/g, "\\=")
            .replace(/\|/g, "\\|")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}")
            .replace(/\./g, "\\.")
            .replace(/!/g, "\\!");
        };

     
        const messageMD = `
🧠 推理过程：
\`\`\`
${escapeMD(reasonText)}
\`\`\`

💬 最终回答：
${escapeMD(outputText)}
        `;

   
        await sendTelegramMessage(message.chat.id, messageMD);
        history.push({ role: "assistant", content: outputText });
        await env.bot.put(message.chat.id, JSON.stringify(history));
        console.log("AI 输出发送给用户:", messageMD);
      }

      return new Response("ok", { status: 200 });
    } catch (err) {
      console.error("解析 JSON 或处理失败:", err);
      return new Response("error", { status: 400 });
    }
  },
};

```
