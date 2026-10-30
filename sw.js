/* DRIVEN v0.8.0 - PWA offline application shell only; map tiles are online-only. */
'use strict';
const CACHE_NAME='driven-app-shell-v0.8.0';
const CACHE_PREFIX='driven-app-shell-';
const SHELL=['./','./index.html','./manifest.webmanifest','./workspace.js','./workspace.css','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)));
  // Do not force activation during an active driving/train recording.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  // Do not intercept/copy OSM tiles or any cross-origin data.
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        // Updating the offline fallback is constrained to this app's index.
        if(response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put('./index.html',response.clone());
        }
        return response;
      }catch(error){
        const cached=await caches.match('./index.html');
        return cached||Response.error();
      }
    })());
    return;
  }
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});
