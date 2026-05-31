# Git 与 Vercel 发布准备记录

文档版本：V1.0 草稿  
整理日期：2026-06-01

## 本次目标

把当前个人主页 V1 从本地原型整理成可继续发布的项目形态。

本次不直接部署到 Vercel，也不绑定域名；先完成本地 Git 和 Vercel 静态部署配置。

## 已完成

新增根目录文件：

```txt
.gitignore
README.md
package.json
vercel.json
```

作用：

- `.gitignore`：忽略本地缓存、临时浏览器目录、日志、构建产物、密钥文件。
- `README.md`：说明当前项目入口、内容编辑方式、检查命令和部署方向。
- `package.json`：提供本地预览和检查脚本。
- `vercel.json`：让 Vercel 根路径 `/` 指向 `v1/index.html`。

## 当前脚本

```txt
npm.cmd run check
```

会执行：

```txt
node --check v1/server.mjs
node --check v1/scripts/render-site.mjs
node --test v1/tests/render-site.test.mjs
```

## 检查结果

已运行：

```txt
npm.cmd run check
```

结果：

```txt
4 个测试通过
```

注意：Windows PowerShell 会拦截 `npm.ps1`，所以当前机器上应使用：

```txt
npm.cmd
```

## Git 状态

已初始化本地 Git 仓库。

首个提交：

```txt
90c9ea0 chore: initialize personal homepage prototype
```

本机 Git 操作中遇到 `safe.directory` 提示。处理方式是使用一次性参数：

```txt
git -c safe.directory='D:/Codex Project/个人主页 鸦珉icu' ...
```

没有修改全局 Git 配置。

## 下一步

建议下一步二选一：

1. 推送到 GitHub，再从 Vercel 导入 GitHub 仓库。
2. 直接使用 Vercel CLI 进行一次预览部署。

推荐顺序：

```txt
先 GitHub -> 再 Vercel
```

原因：

- 后续每次修改可以通过 Git 留痕。
- Vercel 可以自动部署。
- 出问题时更容易回滚。

## 还未完成

- 未创建 GitHub 远程仓库。
- 未推送远程仓库。
- 未部署 Vercel。
- 未绑定 `鸦珉.icu`。
- 未设置 `ravenous.top` 跳转和 `send.ravenous.top`。

