/* ================================================================
   GameRank · 游戏资讯排行榜站 - 核心 JS
   3重筛选(榜单×平台×类型) + 搜索 + 排序 + 收藏 + 主题 + 弹窗
   ================================================================ */

(function () {
  'use strict';

  // ------------------------------------------------------------
  // 1. 全局状态
  // ------------------------------------------------------------
  const STATE = {
    allGames: [],          // 全部游戏原始数据
    filtered: [],          // 当前筛选结果
    listTab: 'weekly',     // 榜单Tab
    platform: 'all',       // 平台
    genre: 'all',          // 类型
    sort: 'hot',           // 排序: hot / rating / date
    searchTerm: '',        // 搜索词
    favorites: new Set(),  // 收藏夹ID
    favoritesOnly: false,  // 是否仅显示收藏
    currentModalId: null,  // 当前弹窗游戏ID
    searchTimer: null,     // 防抖定时器
    dataLoaded: false,
  };

  const STORAGE_KEY = 'gamerank:favorites:v1';
  const THEME_KEY = 'gamerank:theme:v1';

  // ------------------------------------------------------------
  // 2. 工具函数: resolveDataPath - 兼容多种路径环境
  // ------------------------------------------------------------
  function resolveDataPath() {
    try {
      const loc = window.location;
      const basePath = loc.pathname.substring(0, loc.pathname.lastIndexOf('/'));
      // 尝试多种路径，兼容 file:// / dev server / github pages / sub-path
      const candidates = [
        './data/data.json',
        (basePath ? basePath + '/' : '') + 'data/data.json',
        loc.origin + (basePath ? basePath + '/' : '/') + 'data/data.json',
      ];
      // 去重后返回第一个，失败时依次回退
      return [...new Set(candidates)];
    } catch (e) {
      return ['./data/data.json'];
    }
  }

  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function formatNumber(n) {
    if (!n && n !== 0) return '-';
    if (n >= 10000) {
      return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    }
    return n.toLocaleString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '待定';
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ------------------------------------------------------------
  // 3. Toast 提示
  // ------------------------------------------------------------
  let toastTimer = null;
  function showToast(msg, type = 'info', duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, duration);
  }

  // ------------------------------------------------------------
  // 4. 主题管理
  // ------------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    }

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
        showToast(`已切换到${next === 'dark' ? '暗色' : '亮色'}主题`, 'info', 1500);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ------------------------------------------------------------
  // 5. 收藏夹 localStorage
  // ------------------------------------------------------------
  function loadFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          STATE.favorites = new Set(arr);
        }
      }
    } catch (e) {
      STATE.favorites = new Set();
    }
    updateFavCount();
  }

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...STATE.favorites]));
    } catch (e) {
      showToast('收藏保存失败', 'error');
    }
  }

  function toggleFavorite(id) {
    id = Number(id);
    if (STATE.favorites.has(id)) {
      STATE.favorites.delete(id);
      showToast('已取消收藏', 'info');
    } else {
      STATE.favorites.add(id);
      showToast('已加入收藏夹 ❤️', 'success');
    }
    saveFavorites();
    updateFavCount();
    return STATE.favorites.has(id);
  }

  function isFavorite(id) {
    return STATE.favorites.has(Number(id));
  }

  function updateFavCount() {
    const el = document.getElementById('fav-count');
    if (el) el.textContent = STATE.favorites.size;
  }

  // ------------------------------------------------------------
  // 6. 数据加载
  // ------------------------------------------------------------
  async function loadGameData() {
    setLoading(true);
    const paths = resolveDataPath();
    let lastErr = null;

    for (const path of paths) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.games)) {
            STATE.allGames = json.games;
            STATE.dataLoaded = true;
            setLoading(false);
            return true;
          }
        }
      } catch (e) {
        lastErr = e;
      }
    }

    // 全部失败：使用内置示例数据兜底
    console.warn('数据加载失败，使用示例数据兜底', lastErr);
    STATE.allGames = FALLBACK_GAMES;
    STATE.dataLoaded = true;
    setLoading(false);
    showToast('数据加载使用本地示例', 'info', 2500);
    return false;
  }

  function setLoading(isLoading) {
    const grid = document.getElementById('game-grid');
    const loading = document.getElementById('loading-state');
    if (!grid || !loading) return;
    if (isLoading) {
      grid.innerHTML = '';
      grid.appendChild(loading);
      loading.classList.remove('hidden');
    } else {
      loading.classList.add('hidden');
    }
  }

  // ------------------------------------------------------------
  // 7. 筛选逻辑（3重：榜单 × 平台 × 类型 + 搜索 + 收藏）
  // ------------------------------------------------------------
  function applyFilters() {
    const { listTab, platform, genre, searchTerm, favoritesOnly, sort } = STATE;

    let list = STATE.allGames.slice();

    // 榜单Tab筛选
    if (listTab && listTab !== 'weekly') {
      list = list.filter(g =>
        Array.isArray(g.listType) && g.listType.includes(listTab)
      );
    } else if (listTab === 'weekly') {
      // 本周热门榜：优先 isHot + hotRank 排序
      // 不筛选，全量参与排序
    }

    // 收藏夹模式
    if (favoritesOnly) {
      list = list.filter(g => STATE.favorites.has(g.id));
    }

    // 平台筛选
    if (platform && platform !== 'all') {
      list = list.filter(g => {
        if (!Array.isArray(g.platforms)) return false;
        if (platform === 'multi') {
          return g.platforms.length >= 3;
        }
        return g.platforms.includes(platform);
      });
    }

    // 类型筛选
    if (genre && genre !== 'all') {
      list = list.filter(g =>
        Array.isArray(g.genres) && g.genres.includes(genre)
      );
    }

    // 搜索筛选 (匹配 游戏名/英文名/开发商/发行商/类型标签/tags)
    if (searchTerm) {
      const kw = searchTerm.trim().toLowerCase();
      list = list.filter(g => {
        return (
          (g.name && g.name.toLowerCase().includes(kw)) ||
          (g.enName && g.enName.toLowerCase().includes(kw)) ||
          (g.developer && g.developer.toLowerCase().includes(kw)) ||
          (g.publisher && g.publisher.toLowerCase().includes(kw)) ||
          (Array.isArray(g.genres) && g.genres.some(x => x.toLowerCase().includes(kw))) ||
          (Array.isArray(g.tags) && g.tags.some(x => x.toLowerCase().includes(kw)))
        );
      });
    }

    // 排序
    list.sort(makeSortFn(sort, listTab === 'weekly'));

    STATE.filtered = list;
    renderGrid();
    updateResultCount();
  }

  function makeSortFn(sort, isWeekly) {
    const weekBoost = isWeekly ? 1 : 0;
    return (a, b) => {
      switch (sort) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0) || (b.hotRank || 999) - (a.hotRank || 999);
        case 'date':
          // 发售日期新到旧
          return new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0);
        case 'hot':
        default:
          // 热度排序：本周榜使用 hotRank，其他使用 isHot + playerCount
          const aHot = (a.isHot ? -2 : 0) + (weekBoost ? 0 : 0) + (a.hotRank || 999);
          const bHot = (b.isHot ? -2 : 0) + (weekBoost ? 0 : 0) + (b.hotRank || 999);
          if (aHot !== bHot) return aHot - bHot;
          return (b.playerCount || 0) - (a.playerCount || 0);
      }
    };
  }

  function updateResultCount() {
    const el = document.getElementById('result-count');
    if (el) el.textContent = STATE.filtered.length;
  }

  // ------------------------------------------------------------
  // 8. 渲染：游戏卡片
  // ------------------------------------------------------------
  function renderGrid() {
    const grid = document.getElementById('game-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;

    if (!grid.querySelector) return;

    // 清空（保留 loading-state 如果仍在的话）
    grid.innerHTML = '';

    const list = STATE.filtered;
    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const frag = document.createDocumentFragment();
    list.forEach((game, idx) => {
      const card = createGameCard(game, idx + 1);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  function createGameCard(game, displayRank) {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.dataset.id = game.id;

    // 收藏状态
    const favClass = isFavorite(game.id) ? ' active' : '';

    // 前3名金银铜颜色
    const rankClass =
      displayRank === 1 ? ' rank-1' :
      displayRank === 2 ? ' rank-2' :
      displayRank === 3 ? ' rank-3' : '';

    // 平台图标(最多3个)
    const platforms = (game.platforms || []).slice(0, 3).map(p => {
      const label = { pc: 'PC', ps5: 'PS', xbox: 'XB', switch: 'NS', mobile: 'APP', multi: 'MULTI' }[p] || p.toUpperCase();
      return `<span class="platform-icon ${p}" title="${p.toUpperCase()}">${label}</span>`;
    }).join('');

    // 类型标签(最多3个)
    const tags = (game.genres || []).slice(0, 3).map(t =>
      `<span class="genre-tag">${escapeHtml(t)}</span>`
    ).join('');

    // 热门标签
    const hotTag = game.isHot ? `<span class="hot-tag">🔥 HOT</span>` : '';

    // 热度值
    const hotVal = game.hotRank ? `#${game.hotRank}` : formatNumber(game.playerCount);

    card.innerHTML = `
      <div class="card-cover">
        <span class="rank-badge${rankClass}">#${displayRank}</span>
        <button class="card-fav${favClass}" data-action="fav" data-id="${game.id}" title="收藏">
          ${isFavorite(game.id) ? '❤️' : '🤍'}
        </button>
        ${hotTag}
        <img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.opacity=0.5" />
        <div class="card-scores">
          <div class="score-main">
            <div class="score-item rating">
              <span class="icon">⭐</span>
              <span class="value">${(game.rating || 0).toFixed(1)}</span>
            </div>
            <div class="score-item hot">
              <span class="icon">🔥</span>
              <span class="value">${escapeHtml(hotVal)}</span>
            </div>
          </div>
          <div class="card-platforms">${platforms}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(game.name)}</div>
        <div class="card-enname">${escapeHtml(game.enName || '')}</div>
        <div class="card-meta">
          <div class="row">
            <span class="meta-label">发售日</span>
            <span class="meta-value">${formatDate(game.releaseDate)}</span>
          </div>
          <div class="row">
            <span class="meta-label">开发商</span>
            <span class="meta-value">${escapeHtml(game.developer || '未知')}</span>
          </div>
        </div>
        <div class="card-tags">${tags}</div>
      </div>
    `;

    // 点击卡片打开弹窗
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="fav"]');
      if (btn) {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const nowFav = toggleFavorite(id);
        // 更新按钮
        btn.className = 'card-fav' + (nowFav ? ' active' : '');
        btn.innerHTML = nowFav ? '❤️' : '🤍';
        // 如果处于收藏筛选模式且被取消，重新筛选
        if (STATE.favoritesOnly && !nowFav) applyFilters();
        return;
      }
      openModal(game.id);
    });

    return card;
  }

  // ------------------------------------------------------------
  // 9. 弹窗 Modal (三关闭: ×/遮罩/Esc)
  // ------------------------------------------------------------
  const modalState = {
    locked: false,
  };

  function openModal(gameId) {
    const game = STATE.allGames.find(g => g.id === Number(gameId));
    if (!game) return;

    STATE.currentModalId = game.id;
    renderModalContent(game);

    const modal = document.getElementById('game-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // 绑定三关闭
    bindModalCloseHandlers();
  }

  function closeModal() {
    const modal = document.getElementById('game-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    STATE.currentModalId = null;
  }

  function bindModalCloseHandlers() {
    const modal = document.getElementById('game-modal');
    if (!modal || modalState.locked) return;
    modalState.locked = true;

    // 1) 点击关闭按钮 / 遮罩
    modal.addEventListener('click', modalOnClick);
    // 2) Esc
    document.addEventListener('keydown', modalOnKey);
  }

  function unbindModalCloseHandlers() {
    const modal = document.getElementById('game-modal');
    if (modal) modal.removeEventListener('click', modalOnClick);
    document.removeEventListener('keydown', modalOnKey);
    modalState.locked = false;
  }

  function modalOnClick(e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-close')) {
      closeModal();
      unbindModalCloseHandlers();
    }
    // 相关推荐卡片点击
    const rel = e.target.closest('.related-card');
    if (rel && rel.dataset.id) {
      const nextId = Number(rel.dataset.id);
      openModal(nextId);
    }
    // 收藏按钮
    const favBig = e.target.closest('[data-modal-fav]');
    if (favBig) {
      e.stopPropagation();
      const id = Number(favBig.dataset.modalFav);
      const nowFav = toggleFavorite(id);
      // 更新按钮样式
      favBig.className = 'modal-fav-big' + (nowFav ? ' active' : '');
      favBig.querySelector('.txt').textContent = nowFav ? '已收藏' : '加入收藏';
      favBig.querySelector('.icon').textContent = nowFav ? '❤️' : '🤍';
      // 同步主界面卡片
      syncCardFav(id, nowFav);
    }
  }

  function modalOnKey(e) {
    if (e.key === 'Escape') {
      closeModal();
      unbindModalCloseHandlers();
    }
  }

  function syncCardFav(id, nowFav) {
    const grid = document.getElementById('game-grid');
    if (!grid) return;
    const btn = grid.querySelector(`.card-fav[data-id="${id}"]`);
    if (btn) {
      btn.className = 'card-fav' + (nowFav ? ' active' : '');
      btn.innerHTML = nowFav ? '❤️' : '🤍';
    }
  }

  function renderModalContent(game) {
    const wrap = document.getElementById('modal-content');
    if (!wrap) return;

    const fav = isFavorite(game.id);

    // 平台标签
    const platformList = (game.platforms || []).map(p => {
      const name = {
        pc: 'PC', ps5: 'PlayStation 5', xbox: 'Xbox Series X|S',
        switch: 'Nintendo Switch', mobile: 'iOS / Android', multi: '多平台'
      }[p] || p;
      return `<span class="modal-platform-tag">${escapeHtml(name)}</span>`;
    }).join('');

    // IGN/Steam/玩家数
    const playerText = game.playerCount ? `${formatNumber(game.playerCount)}人` : '暂无';

    const ignBox = game.ignScore ? `
      <div class="modal-score-box ign">
        <span class="label">IGN</span>
        <span class="value">${game.ignScore}</span>
      </div>` : '';

    const steamBox = game.steamScore ? `
      <div class="modal-score-box steam">
        <span class="label">Steam</span>
        <span class="value">${game.steamScore}%</span>
      </div>` : '';

    // 基本信息
    const infoGrid = `
      <div class="info-grid">
        <div class="info-item">
          <span class="label">开发商</span>
          <span class="value">${escapeHtml(game.developer || '—')}</span>
        </div>
        <div class="info-item">
          <span class="label">发行商</span>
          <span class="value">${escapeHtml(game.publisher || '—')}</span>
        </div>
        <div class="info-item">
          <span class="label">发售日期</span>
          <span class="value">${formatDate(game.releaseDate)}</span>
        </div>
        <div class="info-item">
          <span class="label">玩家评价</span>
          <span class="value">${playerText}</span>
        </div>
      </div>
    `;

    // 游戏类型标签
    const genreTags = (game.genres || []).map(g =>
      `<span class="modal-genre-tag">${escapeHtml(g)}</span>`
    ).join('');

    // 特色亮点
    const highlights = (game.highlights || []).map(h =>
      `<li>${escapeHtml(h)}</li>`
    ).join('') || '<li>暂无特色亮点信息</li>';

    // 系统需求
    const reqBox = (req, label, cls) => {
      if (!req) return '';
      const fields = [
        ['os', '系统'],
        ['cpu', 'CPU'],
        ['gpu', 'GPU'],
        ['ram', '内存'],
        ['storage', '存储'],
        ['disk', '磁盘'],
      ];
      const items = fields
        .filter(([k]) => req[k])
        .map(([k, label]) => `
          <div class="req-item">
            <span class="k">${label}</span>
            <span class="v">${escapeHtml(req[k])}</span>
          </div>
        `).join('');
      const icon = label === '最低' ? '📋' : '💎';
      return `
        <div class="req-box ${cls}">
          <div class="req-title">${icon} ${label}配置</div>
          <div class="req-list">${items || '<div class="req-item"><span class="v">暂无数据</span></div>'}</div>
        </div>
      `;
    };

    // 媒体评分
    const mediaScores = (game.mediaScores || []).map(m => {
      const s = Number(m.score);
      let cls = 'good';
      if (s < 70) cls = 'bad';
      else if (s < 85) cls = 'mid';
      const displayScore = (s >= 100 || s <= 10) ? (s % 1 === 0 ? String(s) : s.toFixed(1)) : (s % 1 === 0 ? String(s) : s.toFixed(1));
      return `
        <div class="media-item">
          <span class="media-name">${escapeHtml(m.media)}</span>
          <span class="media-score ${cls}">${displayScore}</span>
        </div>
      `;
    }).join('') || '<div class="media-item"><span class="media-name">暂无媒体评分</span></div>';

    // 相关推荐
    const relatedIds = Array.isArray(game.relatedIds) ? game.relatedIds.slice(0, 6) : [];
    const relatedList = relatedIds
      .map(id => STATE.allGames.find(g => g.id === id))
      .filter(Boolean)
      .map(g => `
        <div class="related-card" data-id="${g.id}">
          <div class="related-cover">
            <img src="${escapeHtml(g.cover)}" alt="${escapeHtml(g.name)}" loading="lazy" referrerpolicy="no-referrer" />
          </div>
          <div class="related-info">
            <div class="related-name">${escapeHtml(g.name)}</div>
            <div class="related-rating">⭐ ${(g.rating || 0).toFixed(1)}</div>
          </div>
        </div>
      `).join('');

    wrap.innerHTML = `
      <div class="modal-banner">
        <img src="${escapeHtml(game.banner || game.cover)}" alt="${escapeHtml(game.name)}" referrerpolicy="no-referrer" />
        <div class="modal-banner-info">
          <div class="modal-title-row">
            <div class="modal-titles">
              <h1>${escapeHtml(game.name)}</h1>
              <div class="en-name">${escapeHtml(game.enName || '')}</div>
            </div>
            <button class="modal-fav-big${fav ? ' active' : ''}" data-modal-fav="${game.id}">
              <span class="icon">${fav ? '❤️' : '🤍'}</span>
              <span class="txt">${fav ? '已收藏' : '加入收藏'}</span>
            </button>
          </div>
          <div class="modal-scores-row">
            <div class="modal-score-box rating">
              <span class="label">综合评分</span>
              <span class="value">⭐ ${(game.rating || 0).toFixed(1)}</span>
            </div>
            ${ignBox}
            ${steamBox}
            <div class="modal-score-box players">
              <span class="label">玩家</span>
              <span class="value">👥 ${playerText}</span>
            </div>
          </div>
          <div class="modal-platforms-display">${platformList || '<span class="modal-platform-tag">未公布</span>'}</div>
        </div>
      </div>

      <div class="modal-body">
        <section class="modal-section">
          <h2 class="modal-section-title">🎮 基本信息</h2>
          ${infoGrid}
        </section>

        <section class="modal-section">
          <h2 class="modal-section-title">🏷️ 游戏类型</h2>
          <div class="modal-genre-tags">${genreTags || '<span class="modal-genre-tag">未分类</span>'}</div>
        </section>

        <section class="modal-section">
          <h2 class="modal-section-title">📖 游戏简介</h2>
          <p class="game-description">${escapeHtml(game.description || '暂无简介')}</p>
        </section>

        <section class="modal-section">
          <h2 class="modal-section-title">✨ 特色亮点</h2>
          <ul class="highlights-list">${highlights}</ul>
        </section>

        <section class="modal-section">
          <h2 class="modal-section-title">💻 系统需求</h2>
          <div class="req-grid">
            ${reqBox(game.minReq, '最低', 'min') || '<div class="req-box min"><div class="req-title">📋 最低配置</div><div class="req-list"><div class="req-item"><span class="v">暂无数据</span></div></div></div>'}
            ${reqBox(game.recReq, '推荐', 'rec') || '<div class="req-box rec"><div class="req-title">💎 推荐配置</div><div class="req-list"><div class="req-item"><span class="v">暂无数据</span></div></div></div>'}
          </div>
        </section>

        <section class="modal-section">
          <h2 class="modal-section-title">📰 媒体评分</h2>
          <div class="media-list">${mediaScores}</div>
        </section>

        ${relatedList ? `
        <section class="modal-section">
          <h2 class="modal-section-title">🔗 相关推荐</h2>
          <div class="related-grid">${relatedList}</div>
        </section>
        ` : ''}
      </div>
    `;

    // 回到顶部
    wrap.scrollTop = 0;
  }

  // ------------------------------------------------------------
  // 10. Tab 筛选绑定
  // ------------------------------------------------------------
  function bindTabs() {
    // 榜单Tab
    document.querySelectorAll('#list-tabs .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#list-tabs .tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.listTab = btn.dataset.list;
        STATE.favoritesOnly = false;
        document.getElementById('fav-btn')?.classList.remove('active');
        applyFilters();
        showToast(`切换榜单: ${btn.textContent.trim()}`, 'info', 1200);
      });
    });

    // 平台Tab
    document.querySelectorAll('#platform-tabs .mini-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#platform-tabs .mini-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.platform = btn.dataset.platform;
        applyFilters();
      });
    });

    // 类型Tab
    document.querySelectorAll('#genre-tabs .mini-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#genre-tabs .mini-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.genre = btn.dataset.genre;
        applyFilters();
      });
    });

    // 排序Tab
    document.querySelectorAll('#sort-tabs .sort-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sort-tabs .sort-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.sort = btn.dataset.sort;
        applyFilters();
      });
    });
  }

  // ------------------------------------------------------------
  // 11. 搜索（防抖 300ms）
  // ------------------------------------------------------------
  function bindSearch() {
    const input = document.getElementById('search-input');
    const sbtn = document.querySelector('.search-btn');
    if (!input) return;

    const doSearch = () => {
      STATE.searchTerm = input.value || '';
      applyFilters();
    };

    input.addEventListener('input', debounce(doSearch, 300));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        STATE.searchTerm = input.value || '';
        applyFilters();
      }
    });

    if (sbtn) sbtn.addEventListener('click', doSearch);
  }

  // ------------------------------------------------------------
  // 12. 回到顶部按钮
  // ------------------------------------------------------------
  function bindBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    const check = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      if (y > 400) btn.classList.add('visible');
      else btn.classList.remove('visible');
    };

    window.addEventListener('scroll', check, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ------------------------------------------------------------
  // 13. 收藏夹按钮
  // ------------------------------------------------------------
  function bindFavButton() {
    const btn = document.getElementById('fav-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      STATE.favoritesOnly = !STATE.favoritesOnly;
      btn.classList.toggle('active', STATE.favoritesOnly);
      if (STATE.favoritesOnly) {
        // 同时高亮Tab？不，榜单Tab依然可用，这里只叠加筛选
        showToast(`只看收藏夹（${STATE.favorites.size}个）`, 'info', 1500);
      } else {
        showToast('已取消收藏夹筛选', 'info', 1200);
      }
      applyFilters();
    });
  }

  // ------------------------------------------------------------
  // 14. Logo 点击回到初始状态
  // ------------------------------------------------------------
  function bindLogo() {
    const logo = document.getElementById('logo-home');
    if (!logo) return;
    logo.addEventListener('click', () => {
      // 重置状态
      STATE.listTab = 'weekly';
      STATE.platform = 'all';
      STATE.genre = 'all';
      STATE.sort = 'hot';
      STATE.searchTerm = '';
      STATE.favoritesOnly = false;

      // 重置UI
      document.querySelectorAll('#list-tabs .tab').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('#platform-tabs .mini-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('#genre-tabs .mini-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('#sort-tabs .sort-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      document.getElementById('fav-btn')?.classList.remove('active');

      applyFilters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('已重置所有筛选', 'info', 1500);
    });
  }

  // ------------------------------------------------------------
  // 15. 兜底示例数据（fetch全部失败时用）
  // ------------------------------------------------------------
  const FALLBACK_GAMES = [
    {
      id: 1, name: '艾尔登法环', enName: 'Elden Ring',
      cover: 'https://picsum.photos/seed/fb1/400/560', banner: 'https://picsum.photos/seed/fb1b/1600/600',
      rating: 9.7, ignScore: 10, steamScore: 95, playerCount: 1250000,
      hotRank: 1, listType: ['weekly', 'aaa', 'rpg'],
      platforms: ['pc', 'ps5', 'xbox'], genres: ['动作', 'RPG', '冒险'],
      developer: 'FromSoftware', publisher: 'Bandai Namco',
      releaseDate: '2022-02-25',
      description: '由宫崎英高与乔治·R·R·马丁共同打造的开放世界动作角色扮演游戏。',
      highlights: ['史诗级开放世界设计', '硬核战斗系统', '数十种风格各异的Boss战'],
      minReq: { cpu: 'i5-8400', gpu: 'GTX 1060 3GB', ram: '12 GB', storage: '60 GB', disk: 'SSD', os: 'Windows 10' },
      recReq: { cpu: 'i7-8700K', gpu: 'RTX 2060', ram: '16 GB', storage: '60 GB SSD', disk: 'NVMe SSD', os: 'Windows 11' },
      mediaScores: [{ media: 'IGN', score: 10 }, { media: 'GameSpot', score: 10 }],
      tags: ['开放世界', '魂系', '奇幻'], relatedIds: [2, 3], isHot: true,
    },
    {
      id: 2, name: '塞尔达传说：王国之泪', enName: 'Tears of the Kingdom',
      cover: 'https://picsum.photos/seed/fb2/400/560', banner: 'https://picsum.photos/seed/fb2b/1600/600',
      rating: 9.8, ignScore: 10, steamScore: 0, playerCount: 890000,
      hotRank: 2, listType: ['weekly', 'aaa', 'adventure'],
      platforms: ['switch'], genres: ['动作', '冒险', '解谜'],
      developer: 'Nintendo EPD', publisher: 'Nintendo',
      releaseDate: '2023-05-12',
      description: '在海拉鲁大陆展开全新的冒险，新增究极手、余料建造等能力。',
      highlights: ['革命性物理交互系统', '海陆空立体探索', '100+小时游戏内容'],
      minReq: { cpu: 'Tegra X1', gpu: 'Maxwell', ram: '4 GB', storage: '16 GB', disk: 'eMMC', os: 'Switch' },
      recReq: { cpu: 'Tegra X1', gpu: 'Maxwell', ram: '4 GB', storage: '16 GB', disk: 'MicroSD', os: 'Switch' },
      mediaScores: [{ media: 'Fami通', score: 40 }, { media: 'IGN', score: 10 }],
      tags: ['任天堂', '冒险', '创意'], relatedIds: [1], isHot: true,
    },
    {
      id: 3, name: '博德之门3', enName: 'Baldur\'s Gate 3',
      cover: 'https://picsum.photos/seed/fb3/400/560', banner: 'https://picsum.photos/seed/fb3b/1600/600',
      rating: 9.6, ignScore: 10, steamScore: 96, playerCount: 780000,
      hotRank: 3, listType: ['weekly', 'aaa', 'rpg'],
      platforms: ['pc', 'ps5', 'xbox'], genres: ['RPG', '策略'],
      developer: 'Larian Studios', publisher: 'Larian Studios',
      releaseDate: '2023-08-03',
      description: '基于龙与地下城第五版规则的史诗级RPG。',
      highlights: ['D&D 5e规则完美还原', '17000+选择分支', '最多4人联机'],
      minReq: { cpu: 'i5-4690', gpu: 'GTX 970', ram: '8 GB', storage: '150 GB', disk: 'SSD', os: 'Windows 10' },
      recReq: { cpu: 'i7-8700K', gpu: 'RTX 2060 Super', ram: '16 GB', storage: '150 GB SSD', disk: 'NVMe SSD', os: 'Windows 11' },
      mediaScores: [{ media: 'IGN', score: 10 }, { media: 'PC Gamer', score: 97 }],
      tags: ['D&D', '回合制', '剧情'], relatedIds: [1, 2], isHot: true,
    },
  ];

  // ------------------------------------------------------------
  // 16. 初始化入口
  // ------------------------------------------------------------
  async function init() {
    initTheme();
    loadFavorites();
    bindTabs();
    bindSearch();
    bindBackToTop();
    bindFavButton();
    bindLogo();

    try {
      await loadGameData();
      applyFilters();
    } catch (e) {
      console.error('初始化失败:', e);
      showToast('初始化失败，请刷新重试', 'error', 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露路径兼容函数用于调试
  window.__resolveDataPath = resolveDataPath;
})();
