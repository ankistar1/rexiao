// 今日热搜 · 逻辑（Day 7 第 2 步：接入 60s API 数据）
// 数据源：60s API（https://60s-api.viki.moe，开源项目 vikiboss/60s）

const API_BASE = "https://60s-api.viki.moe";

// ===== mock 模式（Day 8 板块③）：URL 带 ?mock=1 就用本地假数据，不发任何请求 =====
// 用法：http://localhost:8000/?mock=1          → 三栏假数据
//       http://localhost:8000/?mock=1&empty=1  → 知乎栏演示「暂无数据」空状态
const urlParams = new URLSearchParams(location.search);
const MOCK_MODE = urlParams.has("mock");
const MOCK_EMPTY = urlParams.has("empty");

// 三个平台的配置：接口路径 + 字段映射。
// 各平台返回的字段名不一样（微博是 hot_value、知乎是 hot_value_desc、百度是 score_desc），
// 这里统一映射成 PRD 六节定义的字段：id / rank / title / hotValue / url。
const PLATFORMS = [
  {
    id: "weibo",
    name: "微博热搜",
    path: "/v2/weibo",
    map: (item, index) => ({
      id: "weibo-" + index,
      rank: index + 1,
      title: item.title,
      hotValue: formatHot(item.hot_value),
      url: item.link,
      platform: "微博",
    }),
  },
  {
    id: "zhihu",
    name: "知乎热榜",
    path: "/v2/zhihu",
    map: (item, index) => ({
      id: "zhihu-" + index,
      rank: index + 1,
      title: item.title,
      hotValue: item.hot_value_desc || "",
      url: item.link,
      platform: "知乎",
    }),
  },
  {
    id: "baidu",
    name: "百度热搜",
    path: "/v2/baidu/hot",
    map: (item, index) => ({
      id: "baidu-" + index,
      rank: item.rank || index + 1,
      title: item.title,
      hotValue: item.score_desc || "",
      url: item.url,
      platform: "百度",
    }),
  },
];

const MAX_ITEMS = 20; // PRD F1：每栏 15~20 条

// 把纯数字热度值换成「xxxx 万」更好读；没有热度值的平台就不显示（PRD：有则显示）
function formatHot(value) {
  if (!value && value !== 0) return "";
  if (value >= 10000) return (value / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
  return String(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 带自动重试的请求（Day 7 补）：实测本机网络会「成片地」瞬断（IPv6 走不通 + 外部链路不稳），
// 一次失败不代表真失败。最多试 3 次，间隔 400ms / 1200ms，仍然失败才交给外层显示失败态。
async function fetchJsonRetry(path, attempts = 3) {
  const waits = [400, 1200];
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(API_BASE + path);
      if (!response.ok) throw new Error("HTTP " + response.status); // 非 200 算失败
      // 注意：「接口返回 0 条」不算失败，原样返回 —— 由 loadBoard 显示「暂无数据」（Day 8：空数据是独立状态）
      return await response.json();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(waits[i]); // 最后一次失败就直接抛，不再等
    }
  }
  throw lastError;
}

// ===== 上次成功数据兜底（Day 7 补）：接口失败时显示 localStorage 里的上次数据，而不是直接失败 =====

const CACHE_PREFIX = "rexiao_cache_"; // localStorage 缓存键前缀，如 rexiao_cache_weibo

// 把一次成功的数据存起来：条目列表 + 抓取时间
function saveBoardCache(platformId, items) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + platformId,
      JSON.stringify({ savedAt: Date.now(), items: items })
    );
  } catch {
    // localStorage 写不进去（比如隐私模式）就算了，不影响主流程
  }
}

// 读上次缓存；没有或已损坏返回 null
function readBoardCache(platformId) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + platformId) || "null");
  } catch {
    return null;
  }
}

// 拉取一个平台的榜单并画到对应栏里
async function loadBoard(platform) {
  const listEl = document.getElementById("list-" + platform.id);
  const timeEl = document.getElementById("time-" + platform.id);
  // PRD 第七节：请求期间显示「加载中…」（点刷新时各栏也会先回到这个状态）
  listEl.innerHTML = '<li class="placeholder">加载中…</li>';
  timeEl.textContent = "";
  boardRendered[platform.id] = false; // 加载中：不参与筛选（Day 12）
  // mock 模式：直接用 mock.js 里的假数据，不发请求（Day 8 板块③）
  if (MOCK_MODE) {
    await sleep(300); // 短暂等待，让「加载中」状态肉眼可见（也顺便演示状态 ②）
    let items = (window.MOCK_BOARDS && window.MOCK_BOARDS[platform.id]) || [];
    if (MOCK_EMPTY && platform.id === "zhihu") items = []; // &empty=1：知乎栏演示空数据状态
    boardData[platform.id] = items;
    if (!items.length) {
      boardRendered[platform.id] = false; // 空数据：保持独立空态，不参与筛选
      listEl.innerHTML = '<li class="placeholder">暂无数据（mock 演示）</li>';
    } else {
      boardRendered[platform.id] = true;
      renderBoardList(platform); // 走筛选管道（Day 12）
    }
    timeEl.textContent = "演示数据";
    updateFilterCount();
    return;
  }
  try {
    const result = await fetchJsonRetry(platform.path);
    const items = (result.data || []).slice(0, MAX_ITEMS).map(platform.map);
    // 空数据状态（Day 8）：接口正常返回了但一条都没有 —— 这是「正常但没内容」，
    // 和「获取失败」是两回事：不报错、不触发缓存兜底，显示独立文案
    if (!items.length) {
      boardData[platform.id] = [];
      boardRendered[platform.id] = false; // 空数据状态（Day 8）不参与筛选
      listEl.innerHTML =
        '<li class="placeholder">暂无数据 ' +
        '<button class="btn btn-ghost retry-btn" data-platform="' + platform.id + '" type="button">刷新试试</button>' +
        "</li>";
      timeEl.textContent = "更新于 " + formatTime(new Date());
      return;
    }
    boardData[platform.id] = items; // 缓存本栏数据，点条目时用来展开详情（F2）
    saveBoardCache(platform.id, items); // 存进 localStorage，下次失败时兜底
    boardRendered[platform.id] = true;
    renderBoardList(platform); // 走筛选管道（Day 12）
    timeEl.textContent = "更新于 " + formatTime(new Date());
    updateFilterCount();
  } catch (error) {
    // 兜底优先：有上次成功的数据就先显示它（标注可能过期），不直接报失败
    const cache = readBoardCache(platform.id);
    if (cache && cache.items && cache.items.length) {
      boardData[platform.id] = cache.items;
      boardRendered[platform.id] = true; // 兜底数据也参与筛选（Day 12）
      listEl.innerHTML =
        '<li class="placeholder stale">接口暂时拉不到，以下是上次的数据（可能过期） ' +
        '<button class="btn btn-ghost retry-btn" data-platform="' + platform.id + '" type="button">重新拉取</button>' +
        "</li>" +
        filteredItemsHtml(platform);
      timeEl.textContent = "上次更新于 " + formatTime(new Date(cache.savedAt));
      return;
    }
    // 连兜底都没有（第一次用、或从没成功过）：PRD 第七节的失败文案 + 重试
    boardData[platform.id] = [];
    boardRendered[platform.id] = false; // 失败态不参与筛选
    listEl.innerHTML =
      '<li class="placeholder">该平台暂时获取失败 ' +
      '<button class="btn btn-ghost retry-btn" data-platform="' + platform.id + '" type="button">重试</button>' +
      "</li>";
    timeEl.textContent = "";
  }
}

// 各栏数据缓存：{ weibo: [...], zhihu: [...], baidu: [...] }
const boardData = {};

// ===== 关键词筛选（Day 12，按 skills/filter-interaction/SKILL.md 实现）=====
// 筛选只对内存里的 boardData 做过滤，不新增网络请求；
// 三种情况：有结果 / 无结果（空态+出口，不是报错）/ 清空恢复。

let filterKeyword = ""; // 当前筛选词（小写）；空字符串 = 未筛选

// 本栏是否处于「已渲染条目」状态：加载中/失败/空数据的栏不参与筛选重渲染，
// 否则输入筛选词会把「加载中…」占位误刷成「没有匹配」（Skill 坑 1 的变体）
const boardRendered = {};

// 按当前筛选词过滤一栏数据，返回列表 HTML（有结果 / 无结果两种形态）
function filteredItemsHtml(platform) {
  const items = boardData[platform.id] || [];
  if (!filterKeyword) {
    return items.map(renderItem).join("");
  }
  const matched = items.filter((i) => i.title.toLowerCase().includes(filterKeyword));
  if (matched.length) {
    return matched.map(renderItem).join("");
  }
  // 无结果：空态文案（筛选词要转义，Skill 第 4 条）+「清空筛选」出口（Skill 第 2 条）
  return (
    '<li class="placeholder">没有匹配「' + escapeHtml(filterKeyword) + '」的条目 ' +
    '<button class="btn btn-ghost filter-clear" type="button">清空筛选</button>' +
    "</li>"
  );
}

// 重画一栏（只对已渲染条目的栏生效）
function renderBoardList(platform) {
  document.getElementById("list-" + platform.id).innerHTML = filteredItemsHtml(platform);
}

// 反馈（Skill 第 3 条）：实时计数「匹配数/总数」，状态翻转式反馈
function updateFilterCount() {
  let total = 0;
  let matched = 0;
  PLATFORMS.forEach((p) => {
    if (!boardRendered[p.id]) return;
    const items = boardData[p.id] || [];
    total += items.length;
    if (filterKeyword) {
      matched += items.filter((i) => i.title.toLowerCase().includes(filterKeyword)).length;
    }
  });
  document.getElementById("filter-count").textContent = filterKeyword ? matched + "/" + total + " 条" : "";
}

// 应用筛选到所有已渲染的栏
function applyFilter() {
  PLATFORMS.forEach((p) => {
    if (boardRendered[p.id]) renderBoardList(p);
  });
  updateFilterCount();
}

// 输入实时过滤（Skill 第 6 条）；空字符串等同清空，走恢复逻辑
document.getElementById("filter-input").addEventListener("input", (event) => {
  filterKeyword = event.target.value.trim().toLowerCase();
  applyFilter();
});


// 一条榜单条目的 HTML：排名 + 标题 + 热度
function renderItem(item) {
  const hot = item.hotValue ? '<span class="hot">' + escapeHtml(item.hotValue) + "</span>" : "";
  return (
    '<li class="item" data-id="' + item.id + '">' +
    '<span class="rank rank-' + Math.min(item.rank, 4) + '">' + item.rank + "</span>" +
    '<span class="title">' + escapeHtml(item.title) + "</span>" +
    hot +
    "</li>"
  );
}

function formatTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

// 防止标题里带特殊字符（如 < > &）破坏页面结构
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// 三个平台同时拉取，互不等待，谁先回来谁先显示
// 刷新时清空筛选（Skill 第 6 条：筛选状态默认不跨刷新保留，简单优先）
function loadAll() {
  filterKeyword = "";
  document.getElementById("filter-input").value = "";
  updateFilterCount();
  PLATFORMS.forEach(loadBoard);
}

// ===== F2 详情查看：点条目展开详情，再点或点「收起」关闭 =====

// 给三栏的列表统一装点击监听（事件委托：列表只挂一个监听器，点哪条算哪条）
PLATFORMS.forEach((platform) => {
  document.getElementById("list-" + platform.id).addEventListener("click", (event) => {
    const itemEl = event.target.closest(".item");
    if (!itemEl) return; // 点的不是条目（比如点在详情区域）就不处理
    toggleDetail(itemEl, platform.id);
  });
});

// 展开 / 收起一条热搜的详情（Day 11：加动画收起 + 展开条目高亮反馈）
function toggleDetail(itemEl, platformId) {
  const existing = document.querySelector("#list-" + platformId + " .detail:not(.closing)");
  // 已有详情展开：如果是同一条 → 收起；是另一条 → 先关掉旧的再展开新的
  if (existing) {
    const sameItem = existing.previousElementSibling === itemEl;
    closeDetail(existing);
    if (sameItem) return;
  }
  const item = (boardData[platformId] || []).find((i) => i.id === itemEl.dataset.id);
  if (item) {
    itemEl.insertAdjacentHTML("afterend", renderDetail(item));
    itemEl.classList.add("active"); // 展开条目保持高亮，状态翻转式反馈
  }
}

// 动画式收起：先播收起动效，动画结束（或有 300ms 兜底）再从 DOM 移除（Day 11）
function closeDetail(detailEl) {
  const item = detailEl.previousElementSibling;
  if (item && item.classList.contains("item")) item.classList.remove("active");
  detailEl.classList.add("closing");
  detailEl.addEventListener("animationend", () => detailEl.remove(), { once: true });
  setTimeout(() => {
    if (detailEl.isConnected) detailEl.remove(); // 兜底：动画事件万一没触发
  }, 300);
}

// 详情区域 HTML：完整标题 + 排名/热度/来源 + 查看原文 + 收起 + 收藏（F3）
function renderDetail(item) {
  const hot = item.hotValue ? " · 热度 " + escapeHtml(item.hotValue) : "";
  const fav = getFavorite(item.id);
  return (
    '<li class="detail">' +
    '<p class="detail-title">' + escapeHtml(item.title) + "</p>" +
    '<p class="detail-meta">第 ' + item.rank + " 名 · 来自" + escapeHtml(item.platform) + hot + "</p>" +
    '<div class="detail-actions">' +
    '<button class="btn ' + (fav ? "btn-starred" : "btn-ghost") + ' fav-btn" type="button" data-id="' + item.id + '">' +
    (fav ? "★ 已收藏" : "☆ 收藏") +
    "</button>" +
    '<a class="btn btn-primary" href="' + item.url + '" target="_blank" rel="noopener">查看原文</a>' +
    '<button class="btn btn-ghost detail-close" type="button">收起</button>' +
    "</div>" +
    '<div class="fav-note hidden" data-id="' + item.id + '">' +
    '<input type="text" class="note-input" placeholder="给这条收藏写点备注（可留空）…" maxlength="100">' +
    '<button class="btn btn-ghost note-save" type="button">保存备注</button>' +
    "</div>" +
    "</li>"
  );
}

// 点收藏后星标变化 + 榜单条目加小星标（重画该栏列表和收藏面板）
function refreshAfterFavChange() {
  renderFavPanel();
}

// 「收起」按钮和收藏相关按钮（都在详情/收藏面板里，统一在 document 上委托）
document.addEventListener("click", (event) => {
  // 收起（Day 11：改走动画式收起）
  if (event.target.classList.contains("detail-close")) {
    closeDetail(event.target.closest(".detail"));
    return;
  }
  // 收藏 / 取消收藏（详情里的星标按钮）
  if (event.target.classList.contains("fav-btn")) {
    handleFavToggle(event.target);
    return;
  }
  // 保存备注
  if (event.target.classList.contains("note-save")) {
    handleNoteSave(event.target);
    return;
  }
  // 收藏面板里的取消收藏（带确认，PRD C5：取消收藏弹确认、备注一并删除）
  if (event.target.classList.contains("fav-remove")) {
    if (window.confirm("取消收藏后备注也会一并删除，确定吗？")) {
      removeFavorite(event.target.dataset.id);
    }
    return;
  }
  // 空态里的「清空筛选」出口（Day 12，Skill 第 2 条）
  if (event.target.classList.contains("filter-clear")) {
    const input = document.getElementById("filter-input");
    input.value = "";
    filterKeyword = "";
    applyFilter();
    input.focus();
    return;
  }
  // 单栏失败后的「重试」按钮：只重新拉取该平台（PRD 第七节）
  if (event.target.classList.contains("retry-btn")) {
    const platform = PLATFORMS.find((p) => p.id === event.target.dataset.platform);
    if (platform) loadBoard(platform);
    return;
  }
  // 收藏面板里的「展开详情」
  if (event.target.classList.contains("fav-expand")) {
    const fav = getFavorite(event.target.dataset.id);
    if (fav) {
      window.open(fav.url, "_blank", "noopener");
    }
  }
});

// ===== F3 收藏与备注：localStorage 存/读/删 =====

const FAV_KEY = "rexiao_favorites"; // localStorage 里的键名

// 读全部收藏（按收藏时间倒序，PRD F3-4）
function getFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return list.sort((a, b) => b.collectedAt - a.collectedAt);
  } catch {
    return [];
  }
}

// 读单条收藏
function getFavorite(id) {
  return getFavorites().find((f) => f.itemId === id) || null;
}

// 存全部收藏
function saveFavorites(list) {
  localStorage.setItem(FAV_KEY, JSON.stringify(list));
}

// 点星标：没收藏 → 收藏（写入 itemId/标题/链接/收藏时间）；已收藏 → 取消（弹确认）
function handleFavToggle(btn) {
  const id = btn.dataset.id;
  const fav = getFavorite(id);
  if (fav) {
    // 已收藏：取消要确认（备注会一并删，PRD C5）
    if (window.confirm("取消收藏后备注也会一并删除，确定吗？")) {
      removeFavorite(id);
    }
    return;
  }
  // 找到该条数据（可能来自榜单缓存，也可能来自收藏面板）
  let item = null;
  for (const platformId of Object.keys(boardData)) {
    item = boardData[platformId].find((i) => i.id === id);
    if (item) break;
  }
  if (!item) {
    item = { id, title: "未知条目", url: "", platform: "" };
  }
  const list = getFavorites();
  list.push({
    itemId: item.id,
    title: item.title,
    url: item.url,
    note: "",
    collectedAt: Date.now(),
  });
  saveFavorites(list);
  rerenderDetailFavState(id); // 星标变实心 + 出现备注框
  renderFavPanel();
}

// 取消收藏：从列表删除，星标变回空心（如果详情还开着）
function removeFavorite(id) {
  saveFavorites(getFavorites().filter((f) => f.itemId !== id));
  rerenderDetailFavState(id);
  renderFavPanel();
}

// 详情里的星标和备注框跟随收藏状态变化
function rerenderDetailFavState(id) {
  const detail = document.querySelector('.fav-note[data-id="' + id + '"]');
  if (!detail) return; // 详情已关闭，不用刷
  const btn = document.querySelector('.fav-btn[data-id="' + id + '"]');
  const fav = getFavorite(id);
  if (btn) {
    btn.className = "btn " + (fav ? "btn-starred" : "btn-ghost") + " fav-btn";
    btn.textContent = fav ? "★ 已收藏" : "☆ 收藏";
  }
  if (detail) {
    detail.classList.toggle("hidden", !fav); // 取消收藏后备注框收起
  }
}

// 保存备注（PRD C3：可输入、可保存、可再改）
function handleNoteSave(btn) {
  const box = btn.closest(".fav-note");
  const id = box.dataset.id;
  const note = box.querySelector(".note-input").value.trim();
  const list = getFavorites();
  const fav = list.find((f) => f.itemId === id);
  if (fav) {
    fav.note = note;
    saveFavorites(list);
    btn.textContent = "已保存";
    setTimeout(() => (btn.textContent = "保存备注"), 1500);
    renderFavPanel();
  }
}

// ===== hash 路由（Day 13）：三个视图 #/hot #/fav #/about =====
// 选 hash 而不是显隐切换/多 HTML：地址即状态（可直接分享、刷新不丢），
// 后退键天然可用（每条 hash 都进历史记录），且只有 hashchange + location.hash 两个原生 API。
const ROUTES = ["hot", "fav", "about"];

// 从地址栏解析当前视图名；不认识的一律回热榜（含空 hash）
function currentRoute() {
  const name = location.hash.replace(/^#\/?/, "");
  return ROUTES.includes(name) ? name : "hot";
}

// 按当前 hash 切换视图 + 高亮导航（hashchange 和首次打开都走这里）
function renderRoute() {
  const route = currentRoute();
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== "view-" + route);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === route);
  });
  // 刷新按钮已挪到 view-hot 内部，跟着视图一起隐藏，无需单独处理
}

window.addEventListener("hashchange", renderRoute);
// 首次打开：没有 hash 就补一个 #/hot（赋值会自动触发 hashchange），有就直接渲染
if (!location.hash) {
  location.hash = "#/hot";
} else {
  renderRoute();
}

// 画「我的收藏」面板：标题 + 来源 + 备注 + 操作（时间倒序）
function renderFavPanel() {
  const listEl = document.getElementById("fav-list");
  const countEl = document.getElementById("fav-count");
  const list = getFavorites();
  countEl.textContent = list.length ? list.length + " 条" : "";
  if (!list.length) {
    // 空收藏（Day 13 补四态）：不只说「没有」，还给出下一步动作的出口
    listEl.innerHTML =
      '<li class="placeholder">还没有收藏。到' +
      ' <a class="btn btn-ghost" href="#/hot">热榜</a> ' +
      '点开一条热搜，再点「☆ 收藏」试试。</li>';
    return;
  }
  listEl.innerHTML = list
    .map((fav) => {
      const note = fav.note ? escapeHtml(fav.note) : '<span class="no-note">未写备注</span>';
      return (
        '<li class="fav-item">' +
        '<div class="fav-main">' +
        '<p class="fav-title">' + escapeHtml(fav.title) + "</p>" +
        '<p class="fav-meta">' + escapeHtml(favTitlePlatform(fav.itemId)) + " · 收藏于 " + formatTime(new Date(fav.collectedAt)) + " · " + note + "</p>" +
        "</div>" +
        '<div class="fav-actions">' +
        '<button class="btn btn-ghost fav-expand" data-id="' + fav.itemId + '" type="button">查看原文</button>' +
        '<button class="btn btn-ghost fav-remove" data-id="' + fav.itemId + '" type="button">取消收藏</button>' +
        "</div>" +
        "</li>"
      );
    })
    .join("");
}

// 从条目 id 推断平台名（weibo-3 → 微博）
function favTitlePlatform(itemId) {
  const map = { weibo: "微博", zhihu: "知乎", baidu: "百度" };
  return map[itemId.split("-")[0]] || "未知来源";
}

// F1 的「刷新」按钮：重新拉取三个平台
document.getElementById("refresh-btn").addEventListener("click", loadAll);

// 页面打开就加载
if (MOCK_MODE) {
  // mock 模式下在副标题标注，一眼能看出这不是真实数据（截图/演示时不误导人）
  const subtitle = document.querySelector(".subtitle");
  if (subtitle) subtitle.textContent += " · 【演示模式：本地假数据】";
}
loadAll();
renderFavPanel(); // 同时把上次的收藏画出来（PRD C2：重开页面收藏仍在）
