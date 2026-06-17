const CACHE_NAME = 'byhs-meal-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Pretendard:wght@400;600;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
];

// 설치 이벤트
self.addEventListener('install', (event) => {
    console.log('Service Worker 설치 중...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('캐시 생성 중:', CACHE_NAME);
            return cache.addAll(URLS_TO_CACHE).catch((err) => {
                console.warn('일부 캐시 추가 실패:', err);
                // 일부 URL 캐시 실패해도 계속 진행
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
    console.log('Service Worker 활성화 중...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('오래된 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch 이벤트
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API 요청은 네트워크 우선
    if (url.hostname === 'open.neis.go.kr' || url.hostname === 'firestore.googleapis.com') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // 성공한 응답을 캐시에 저장
                    if (response.status === 200) {
                        const cache = caches.open(CACHE_NAME);
                        cache.then((c) => c.put(request, response.clone()));
                    }
                    return response;
                })
                .catch(() => {
                    // 네트워크 실패 시 캐시에서 반환
                    return caches.match(request).then((response) => {
                        return response || new Response('오프라인 상태입니다', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
                })
        );
        return;
    }

    // 정적 리소스는 캐시 우선
    event.respondWith(
        caches.match(request).then((response) => {
            return response || fetch(request).then((fetchResponse) => {
                // 200 상태 응답만 캐시
                if (fetchResponse.status === 200 && request.method === 'GET') {
                    const cache = caches.open(CACHE_NAME);
                    cache.then((c) => c.put(request, fetchResponse.clone()));
                }
                return fetchResponse;
            }).catch(() => {
                // 요청 실패 및 캐시 미스인 경우
                return new Response('리소스를 찾을 수 없습니다', {
                    status: 404,
                    statusText: 'Not Found'
                });
            });
        })
    );
});

// 백그라운드 싱크 (옵션)
self.addEventListener('sync', (event) => {
    if (event.tag === 'update-meals') {
        event.waitUntil(
            fetch('/api/update-meals')
                .then(() => console.log('급식 데이터 업데이트 완료'))
                .catch((err) => console.error('급식 데이터 업데이트 실패:', err))
        );
    }
});

// 푸시 알림 (옵션)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {
        title: '부여고 급식 앱',
        body: '새로운 급식 정보가 있습니다.'
    };

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: 'meal-notification',
            requireInteraction: false
        })
    );
});

// 알림 클릭
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (let client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
