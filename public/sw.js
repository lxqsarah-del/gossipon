// sw.js — 预算管家 Service Worker
const CACHE = 'gossipon-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// 安装：缓存核心资源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 请求拦截：离线优先
self.addEventListener('fetch', e => {
  // API 请求不走缓存（Claude API、定位服务等）
  if (e.request.url.includes('api.anthropic.com') ||
      e.request.url.includes('nominatim.openstreetmap.org')) {
    return
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        // 只缓存同源资源
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone()
          caches.open(CACHE).then(cache => cache.put(e.request, clone))
        }
        return res
      }).catch(() => {
        // 离线时 HTML 请求 fallback 到首页
        if (e.request.destination === 'document') {
          return caches.match('/index.html')
        }
      })
    })
  )
})

// 推送通知（预算提醒）
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || '预算管家', {
      body: data.body || '记得记录今天的支出',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'budget-reminder',
      data: { url: '/' }
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
