/**
 * GameRank · scripts/fetch-data.js
 * Node 原生 https 模块拉取游戏数据
 * - 失败时自动生成示例数据（不报错）
 * - 运行: npm run fetch  或  node scripts/fetch-data.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_URLS = [
  // 可以填入真实API，此处为示例地址（404会触发兜底生成）
  'https://api.example.com/gamerank/games.json',
];

const OUTPUT_FILE = path.resolve(__dirname, '..', 'data', 'data.json');

function ensureDir(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function httpsGetJson(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GameRank-Fetch/1.0 (+https://example.local)',
      },
      timeout,
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse: ' + e.message)); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr, n = 1) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(rand(0, copy.length - 1), 1)[0]);
  }
  return out;
}

// 兜底生成示例数据
function generateFallbackGames(count = 70) {
  const names = [
    '星之轨迹', '深空回响', '暗影纪元', '幻影战歌', '龙鳞之地', '赛博先锋', '幻境漫游',
    '钢铁风暴', '苍穹彼岸', '迷雾契约', '黎明远征', '永夜传说', '潮汐守望', '灵能觉醒',
    '废土奇旅', '炽焰之誓', '量子迷宫', '秘境守护者', '赤月狂想', '翠羽森林',
  ];
  const ens = [
    'Star Trail', 'Deep Echo', 'Shadow Era', 'Phantom War', 'Dragon Scale', 'Cyber Vanguard', 'Illusion Rover',
    'Steel Storm', 'Sky Beyond', 'Mist Pact', 'Dawn Crusade', 'Night Legend', 'Tide Watcher', 'Psi Awake',
    'Wasteland Trip', 'Blaze Oath', 'Quantum Maze', 'Realm Keeper', 'Red Moon Rhapsody', 'Verdant Forest',
  ];
  const listTypes = ['weekly', 'steam', 'indie', 'aaa', 'chinese', 'mobile', 'online', 'retro'];
  const platforms = ['pc', 'ps5', 'xbox', 'switch', 'mobile'];
  const genres = ['动作', '冒险', 'RPG', '策略', '射击', '模拟', '竞速', '解谜', '卡牌'];
  const devs = ['Pixel Forge Studio', 'Nova Interactive', 'Stardust Games', 'Ironhide Co.', 'Aurora Soft', 'Tencent Games', 'miHoYo', 'FromSoftware'];
  const pubs = devs.slice().reverse();
  const medias = ['IGN', 'GameSpot', 'PC Gamer', 'Fami通', 'Metacritic', 'Edge', 'GamesRadar+'];
  const tagsPool = ['开放世界', '多人', '单人', '沙盒', '探索', '剧情', '合作', '竞技', '像素', '二次元', '硬核', '奇幻', '科幻', '模拟经营'];

  const games = [];
  for (let i = 1; i <= count; i++) {
    const ni = (i - 1) % names.length;
    const idSuffix = i > names.length ? ` ${Math.ceil(i / names.length)}` : '';
    const name = names[ni] + idSuffix;
    const enName = ens[ni] + (idSuffix ? ' ' + idSuffix.trim() : '');
    const seed = 'g' + i;
    const g_platforms = sample(platforms, rand(1, 4));
    const g_genres = sample(genres, rand(2, 3));
    const g_listType = sample(listTypes, rand(1, 3));
    const rating = (rand(72, 99) / 10).toFixed(1) - 0;
    const ignScore = rand(7, 10);
    const steamScore = rand(68, 99);
    const playerCount = rand(10000, 1500000);
    const dayDelta = rand(0, 1800);
    const date = new Date(Date.now() - dayDelta * 86400000).toISOString().slice(0, 10);

    games.push({
      id: i,
      name,
      enName,
      cover: `https://picsum.photos/seed/${seed}/400/560`,
      banner: `https://picsum.photos/seed/${seed}-banner/1600/600`,
      rating,
      ignScore,
      steamScore,
      playerCount,
      hotRank: i,
      listType: g_listType,
      platforms: g_platforms.length > 3 ? ['pc', 'ps5', 'xbox', 'switch', 'multi'] : g_platforms,
      genres: g_genres,
      developer: devs[i % devs.length],
      publisher: pubs[i % pubs.length],
      releaseDate: date,
      description: `${name}是一款以${g_genres.join('+')}为核心玩法的游戏，在${g_platforms.join('/')}平台推出。带来了令人惊叹的视觉效果和丰富的游戏内容，值得玩家体验。`,
      highlights: [
        `精美绝伦的${g_genres[0]}玩法`,
        `${g_platforms.length > 2 ? '多平台互通进度' : '优化良好的平台体验'}`,
        `沉浸式世界观与剧情`,
        `支持${g_listType.includes('online') || g_listType.includes('multi') ? '多人合作/对战' : '单人深度体验'}`,
        '丰富的角色养成与收集系统',
      ],
      minReq: {
        cpu: 'Intel Core i5-6600 / AMD Ryzen 5 1400',
        gpu: 'NVIDIA GTX 1060 3GB / AMD RX 570',
        ram: '8 GB',
        storage: `${rand(20, 120)} GB`,
        disk: 'HDD or SSD',
        os: 'Windows 10 64-bit',
      },
      recReq: {
        cpu: 'Intel Core i7-8700 / AMD Ryzen 5 3600',
        gpu: 'NVIDIA RTX 2060 / AMD RX 5700 XT',
        ram: '16 GB',
        storage: `${rand(30, 150)} GB SSD`,
        disk: 'NVMe SSD recommended',
        os: 'Windows 10 64-bit / Windows 11',
      },
      mediaScores: sample(medias, rand(3, 5)).map(m => ({
        media: m,
        score: rand(70, 100),
      })),
      tags: sample(tagsPool, rand(3, 5)),
      relatedIds: sample(
        Array.from({ length: count }, (_, k) => k + 1).filter(x => x !== i),
        rand(2, 4)
      ),
      isHot: i <= 25,
    });
  }
  return { games };
}

async function main() {
  ensureDir(OUTPUT_FILE);

  let data = null;
  for (const url of DATA_URLS) {
    try {
      console.log(`[fetch] GET ${url}`);
      const json = await httpsGetJson(url);
      if (json && Array.isArray(json.games)) {
        data = json;
        console.log(`[fetch] ✓ 成功，共 ${data.games.length} 款`);
        break;
      } else {
        console.warn('[fetch] 响应缺少 games 数组，跳过');
      }
    } catch (e) {
      console.warn(`[fetch] ✗ ${url} -> ${e.message}`);
    }
  }

  if (!data) {
    console.log('[fetch] 全部失败，生成示例数据...');
    data = generateFallbackGames(70);
  }

  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  console.log(`[fetch] 已写入 -> ${OUTPUT_FILE}  (${data.games.length} games)`);
}

main().catch(e => {
  console.error('[fetch] 致命错误:', e.message);
  // 即使报错也尝试写入示例
  try {
    ensureDir(OUTPUT_FILE);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(generateFallbackGames(70), null, 2));
    console.log('[fetch] 兜底写入完成');
  } catch (err) {
    console.error('[fetch] 兜底写入失败:', err.message);
    process.exit(1);
  }
});
