# 今日热搜 · my-app（MVP 第一版）

> Day 7 产出 · 2026-09-30 · 技术路线 A：纯 HTML + CSS + JavaScript（无框架、无构建、无后端）

## 这是什么

「今日热搜」MVP：一个网页，打开 3 秒内看到微博、知乎、百度三栏热搜榜单；点条目看详情、跳原文；可收藏并写备注（存在浏览器本地）。

- 需求依据：`../PRD.md`（F1 榜单 / F2 详情 / F3 收藏备注）
- 技术依据：`../TECH_DESIGN.md`（技术路线与数据流）

## 文件说明

| 文件 | 作用 |
|---|---|
| `index.html` | 页面结构：三栏榜单 + 刷新按钮 + 我的收藏面板 |
| `style.css` | 全部样式：三栏并排、<768px 变单列、详情卡片、收藏面板 |
| `app.js` | 全部逻辑：拉取数据、渲染榜单、详情展开、收藏与备注（localStorage） |

## 怎么启动（运行命令存档）

在本文件夹（`my-app/`）里任选一条命令启动本地静态服务：

```bash
# 方式一：Python（本机已装 3.13）
python -m http.server 8000

# 方式二：Node（本机已装 22）
npx serve -l 8000 .
```

然后浏览器打开：**http://localhost:8000**

> 注意：不能直接双击 index.html 用 file:// 协议打开——部分浏览器会限制本地文件发网络请求，用 localhost 服务打开才和真实使用一致。

## 数据来源

使用开源项目 **60s API**（https://60s-api.viki.moe ，作者 vikiboss/60s）的公开接口：

| 平台 | 端点 |
|---|---|
| 微博热搜 | `GET /v2/weibo` |
| 知乎热榜 | `GET /v2/zhihu` |
| 百度热搜 | `GET /v2/baidu/hot` |

- 接口带 `Access-Control-Allow-Origin: *`（跨域允许），前端可直接调用，无需代理
- 2026-09-30 实测三个端点全部可用；原候选 DailyHotApi（dailyhot-api.imsyy.top）域名已失效，已按 TECH_DESIGN.md 备选方案切换（详见 TECH_DESIGN.md 第二节说明）

## 已知限制

- 收藏数据存浏览器 localStorage：换浏览器 / 清缓存会丢收藏（PRD 附注已知且可接受）
- 数据来自第三方公开接口，接口挂了页面会显示失败提示 + 重试按钮
- 仅在 Chrome / Edge 最新版验证
