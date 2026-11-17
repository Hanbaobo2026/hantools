/* HanTools Service Worker
 * 目标：CTF 比赛现场断网 / 内网环境仍可使用已访问过的工具。
 * 原则：
 *  1) 只缓存同源 GET 请求（跨域一律直连，不落缓存，保持隐私承诺）；
 *  2) 带 hash 的 /assets/ 走 cache-first（immutable）；其余同源请求走网络优先，失败回落缓存；
 *  3) 导航请求失败时回退到缓存的 index.html，保证深链在离线状态下也能打开。
 */
const CACHE = 'hantools-v1';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function put(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，离线回退到缓存的 shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => put(request, response))
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/index.html')) || Response.error();
        }),
    );
    return;
  }

  // 带内容 hash 的静态资源：缓存优先
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => put(request, response))),
    );
    return;
  }

  // 其他同源资源：网络优先，失败回退缓存
  event.respondWith(
    fetch(request)
      .then((response) => put(request, response))
      .catch(async () => (await caches.match(request)) || Response.error()),
  );
});
