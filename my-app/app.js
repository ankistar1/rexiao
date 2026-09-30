// 今日热搜 · 逻辑（Day 7 第 2 步：接入 60s API 数据）
// 数据源：60s API（https://60s-api.viki.moe，开源项目 vikiboss/60s）

const API_BASE = "https://60s-api.viki.moe";

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

// 拉取一个平台的榜单并画到对应栏里
async function loadBoard(platform) {
  const listEl = document.getElementById("list-" + platform.id);
  const timeEl = document.getElementById("time-" + platform.id);
  // PRD 第七节：请求期间显示「加载中…」（点刷新时各栏也会先回到这个状态）
  listEl.innerHTML = '<li class="placeholder">加载中…</li>';
  timeEl.textContent = "";
  try {
    const response = await fetch(API_BASE + platform.path);
    if (!response.ok) throw new Error("HTTP " + response.status); // 非 200 也算失败
    const result = await response.json();
    const items = (result.data || []).slice(0, MAX_ITEMS).map(platform.map);
    if (!items.length) throw new Error("接口没有返回数据"); // 空数据同样走失败提示
    boardData[platform.id] = items; // 缓存本栏数据，点条目时用来展开详情（F2）
    listEl.innerHTML = items.map(renderItem).join("");
    timeEl.textContent = "更新于 " + formatTime(new Date());
  } catch (error) {
    // PRD 第七节：单个平台失败，该栏显示失败文案 + 重试按钮，不影响另外两栏
    boardData[platform.id] = [];
    listEl.innerHTML =
      '<li class="placeholder">该平台暂时获取失败 ' +
      '<button class="btn btn-ghost retry-btn" data-platform="' + platform.id + '" type="button">重试</button>' +
      "</li>";
    timeEl.textContent = "";
  }
}

// 各栏数据缓存：{ weibo: [...], zhihu: [...], baidu: [...] }
const boardData = {};

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
function loadAll() {
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

// 展开 / 收起一条热搜的详情
function toggleDetail(itemEl, platformId) {
  const existing = document.querySelector("#list-" + platformId + " .detail");
  // 已有详情展开：如果是同一条 → 收起；是另一条 → 先关掉旧的再展开新的
  if (existing) {
    const sameItem = existing.previousElementSibling === itemEl;
    existing.remove();
    if (sameItem) return;
  }
  const item = (boardData[platformId] || []).find((i) => i.id === itemEl.dataset.id);
  if (item) {
    itemEl.insertAdjacentHTML("afterend", renderDetail(item));
  }
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
  // 收起
  if (event.target.classList.contains("detail-close")) {
    event.target.closest(".detail").remove();
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

// 展开/收起「我的收藏」面板（顶部固定入口，PRD 五节）
document.getElementById("fav-toggle-btn").addEventListener("click", () => {
  document.getElementById("fav-panel").classList.toggle("hidden");
});

// 画「我的收藏」面板：标题 + 来源 + 备注 + 操作（时间倒序）
function renderFavPanel() {
  const listEl = document.getElementById("fav-list");
  const countEl = document.getElementById("fav-count");
  const list = getFavorites();
  countEl.textContent = list.length ? list.length + " 条" : "";
  if (!list.length) {
    listEl.innerHTML = '<li class="placeholder">暂无收藏，点击榜单条目试试</li>';
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
loadAll();
renderFavPanel(); // 同时把上次的收藏画出来（PRD C2：重开页面收藏仍在）
