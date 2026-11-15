// Service worker: permite instalar la app y abrirla sin conexión (solo lectura).
const CACHE = "but-calls-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // los datos se guardan en la propia app, no aquí

  // Ficheros estáticos con nombre único: primero la caché
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res.clone();
          }),
      ),
    );
    return;
  }

  // Páginas: primero la red; si no hay conexión, la última copia
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res.clone();
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});

// Notificaciones push: solo lo importante (rellamada que toca, fin de jornada, jornada sin cerrar)
self.addEventListener("push", (e) => {
  let msg = { title: "BUT Calls", body: "", tag: "but-calls" };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      renotify: true,
    }),
  );
});

// Al tocar la notificación se abre la app (o se trae al frente si ya estaba abierta)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
