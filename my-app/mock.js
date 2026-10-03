// 今日热搜 · mock 假数据（Day 8 板块③）
// 用法：页面地址加 ?mock=1（如 http://localhost:8000/?mock=1），
//       三栏全部用下面的假数据渲染，不会请求任何接口 —— 测试、演示、截图都不怕接口抽风。
// 进阶：再加 &empty=1（即 ?mock=1&empty=1），知乎栏会变成「暂无数据」空状态，用来演示四种页面状态里的 ③。
//
// 数据故意塞了各种边界样本：
//   - 超长标题（测省略号截断）
//   - 特殊字符 < > & " '（测 escapeHtml 转义）
//   - 没有热度值的条目（测「有则显示，无则不显示」）
//   - 数字型 / 文字型热度（测两种格式）
//
// 字段和 app.js 内部格式一致：id / rank / title / hotValue / url / platform

window.MOCK_BOARDS = {
  weibo: [
    { id: "weibo-0", rank: 1, title: "今日热搜上线啦", hotValue: "8521 万", url: "https://example.com/1", platform: "微博" },
    { id: "weibo-1", rank: 2, title: "这是一条特别特别特别特别特别特别特别特别特别特别特别长的标题用来测试省略号截断是否正常工作", hotValue: "6320 万", url: "https://example.com/2", platform: "微博" },
    { id: "weibo-2", rank: 3, title: '带特殊字符的标题 <b>加粗</b> & "引号" \'单引号\'', hotValue: "4103 万", url: "https://example.com/3", platform: "微博" },
    { id: "weibo-3", rank: 4, title: "这条没有热度值", hotValue: "", url: "https://example.com/4", platform: "微博" },
    { id: "weibo-4", rank: 5, title: "纯数字热度样式：12345678", hotValue: "1235 万", url: "https://example.com/5", platform: "微博" },
    { id: "weibo-5", rank: 6, title: "中秋国庆双节出行攻略", hotValue: "987 万", url: "https://example.com/6", platform: "微博" },
  ],
  zhihu: [
    { id: "zhihu-0", rank: 1, title: "如何评价今日热搜这个练手项目？", hotValue: "512 万热度", url: "https://example.com/z1", platform: "知乎" },
    { id: "zhihu-1", rank: 2, title: "零基础学编程，第 2 周应该掌握什么？", hotValue: "386 万热度", url: "https://example.com/z2", platform: "知乎" },
    { id: "zhihu-2", rank: 3, title: "网页的四种状态（成功/加载中/空/错误）分别该怎么设计？", hotValue: "203 万热度", url: "https://example.com/z3", platform: "知乎" },
    { id: "zhihu-3", rank: 4, title: "没有热度描述的知乎条目", hotValue: "", url: "https://example.com/z4", platform: "知乎" },
    { id: "zhihu-4", rank: 5, title: "mock 数据到底有什么用？", hotValue: "88 万热度", url: "https://example.com/z5", platform: "知乎" },
  ],
  baidu: [
    { id: "baidu-0", rank: 1, title: "国庆天气", hotValue: "496 万", url: "https://example.com/b1", platform: "百度" },
    { id: "baidu-1", rank: 2, title: "八天假期怎么安排", hotValue: "355 万", url: "https://example.com/b2", platform: "百度" },
    { id: "baidu-2", rank: 3, title: "又一条测试用的超长标题看看百度栏的省略号截断效果到底好不好用呢", hotValue: "287 万", url: "https://example.com/b3", platform: "百度" },
    { id: "baidu-3", rank: 4, title: "高速公路免费时间", hotValue: "201 万", url: "https://example.com/b4", platform: "百度" },
    { id: "baidu-4", rank: 5, title: "假期电影档期", hotValue: "", url: "https://example.com/b5", platform: "百度" },
  ],
};
