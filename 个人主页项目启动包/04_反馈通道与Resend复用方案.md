# 反馈通道与 Resend 复用方案

整理日期：2026-06-01

## 背景

“睡前咖啡因计算器”已经接入反馈通道，并且通过 Resend 成功把用户反馈发送到：

```txt
2810305904@qq.com
```

现在还希望另一个项目“破茧”也接入同样的反馈工作流：

```txt
https://pojian.space/
```

但 Resend 免费版通常只能验证 1 个 custom domain，因此不适合每个项目都验证自己的产品域名。

## 目标

用一个中立、长期、共享的发信域名作为 Resend verified domain。多个项目共用这个域名，但每个项目保持自己的身份。

推荐域名结构：

```txt
Resend verified domain:
send.revenge.top
```

注意：如果实际长期域名不是 `revenge.top`，替换成真实域名。

## 为什么用子域名

不要直接用根域名：

```txt
revenge.top
```

更推荐用：

```txt
send.revenge.top
```

原因：

- 不影响根域名做个人主页。
- 不影响未来给根域名接真实邮箱。
- 发信声誉和主站隔离。
- 多项目共用时结构更清楚。
- Resend 官方也推荐用子域名来隔离发信用途。

## 多项目配置方式

睡前咖啡因计算器：

```txt
RESEND_API_KEY=睡前项目专用 Key
FEEDBACK_TO_EMAIL=2810305904@qq.com
FEEDBACK_FROM_EMAIL=睡前剩几杯 <sleep@send.revenge.top>
FEEDBACK_PROJECT_NAME=睡前剩几杯
FEEDBACK_EMAIL_SUBJECT=睡前剩几杯，用户反馈
```

破茧：

```txt
RESEND_API_KEY=破茧项目专用 Key
FEEDBACK_TO_EMAIL=2810305904@qq.com
FEEDBACK_FROM_EMAIL=破茧 <pojian@send.revenge.top>
FEEDBACK_PROJECT_NAME=破茧
FEEDBACK_EMAIL_SUBJECT=破茧，用户反馈
```

个人主页项目：

```txt
RESEND_API_KEY=个人主页项目专用 Key
FEEDBACK_TO_EMAIL=2810305904@qq.com
FEEDBACK_FROM_EMAIL=个人主页 <home@send.revenge.top>
FEEDBACK_PROJECT_NAME=个人主页
FEEDBACK_EMAIL_SUBJECT=个人主页，用户反馈
```

## API Key 策略

推荐每个项目单独建一个 Resend API Key。

理由：

- 某个项目出问题时，可以只停掉这个项目的 Key。
- 日志和排查更清楚。
- 以后复制工作流时更干净。

短期也可以共用一个 Key，但长期不推荐。

## 迁移顺序

如果 Resend 免费版只能保留一个 verified domain，而当前已经验证了 `coffeesleep.cn`，切换到 `send.revenge.top` 时可能需要先删除旧 domain。

推荐顺序：

1. 等 `revenge.top` 注册、实名、审核完成。
2. 在 Resend 删除旧的 `coffeesleep.cn` verified domain，如果免费版不允许新增第二个。
3. 在 Resend 添加新域名：

   ```txt
   send.revenge.top
   ```

4. Resend 会生成 DNS 记录。
5. 去阿里云 DNS，为 `revenge.top` 添加这些记录。
6. 回到 Resend 点验证，等状态变成 verified。
7. 在“睡前咖啡因计算器”的 Vercel 环境变量里改：

   ```txt
   FEEDBACK_FROM_EMAIL=睡前剩几杯 <sleep@send.revenge.top>
   FEEDBACK_PROJECT_NAME=睡前剩几杯
   FEEDBACK_EMAIL_SUBJECT=睡前剩几杯，用户反馈
   ```

8. Redeploy 项目。
9. 在网页里提交一条测试反馈。
10. 确认邮件收到后，再接入“破茧”和个人主页。

## 可能的短暂停机

删除旧 Resend domain 到新 domain 验证完成之间，反馈邮件可能短时间发不出去。

这是正常的，因为系统正在换“发信身份证”。

推荐在用户流量较少时操作，并在每一步截图或记录。

## 注意事项

- 不要把 Resend API Key 发到普通对话里。
- 不要把发信域名绑定到一年玩具域名。
- `雅名.icu` 可以用于玩具网站，但不建议做 Resend 发信域名。
- 如果反馈失败，先看 Vercel Function Logs，再看 Resend Logs。
- 如果邮件进垃圾箱，优先检查 SPF、DKIM、DMARC 是否验证通过。

## 用户看到的反馈体验

反馈窗口目前的方向：

- 标题：反馈专区
- 说明：用户写的反馈会直接发到邮箱，可以选填联系方式。
- 占位文案有一点轻微玩笑，例如：

  ```txt
  请不要发送暗恋情书。
  ```

- 成功提示：

  ```txt
  我马上就会看到您的反馈啦~
  ```
