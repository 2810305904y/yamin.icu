# 个人主页 V1 数据文件化原型

V1 的重点不是新增复杂后台，而是先把内容从页面里拆出来。

## 主要文件

```txt
content/site-data.mjs      项目、待办、奇怪念头、自媒体链接
scripts/render-site.mjs    把数据渲染成页面
index.html                 页面结构
styles.css                 视觉样式
tests/render-site.test.mjs 数据渲染测试
```

## 怎么改内容

现在先改：

```txt
content/site-data.mjs
```

后续 `/admin` 后台也应该围绕同一份数据结构来做。

## 检查命令

```txt
node --test v1/tests/render-site.test.mjs
```

## 本地预览

V1 使用浏览器模块读取数据文件。最稳的预览方式是启动本地预览服务：

```txt
node v1/server.mjs
```

然后打开：

```txt
http://127.0.0.1:4173/
```
