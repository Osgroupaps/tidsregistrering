const V='tid-v7',SHELL=['./','index.html','style.css','app.js','dinero.js','config.js','manifest.webmanifest'];
const CDN=['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin!==location.origin&&!CDN.includes(u.hostname))return;
 /* Vis den gemte version med det samme, og hent en ny i baggrunden til næste gang */
 const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res});
 e.waitUntil(net.then(()=>{},()=>{}));
 e.respondWith(caches.match(r,{ignoreSearch:u.origin===location.origin}).then(m=>m||net.catch(()=>caches.match('index.html'))))});
