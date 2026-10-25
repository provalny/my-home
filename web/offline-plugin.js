// Cache this build's application shell, never bulk-download external map tiles.
import {createHash} from 'node:crypto';
export function offlineShell(){return {name:'inventory-offline-shell',apply:'build',generateBundle(_,bundle){
 const files=Object.keys(bundle).filter(f=>/\.(js|css|woff2?|png|svg)$/.test(f));files.push('index.html','plans/home.json');
 const version=createHash('sha256').update(files.join('|')).digest('hex').slice(0,12);
 const source=`const CACHE='life-assistant-shell-${version}',FILES=${JSON.stringify(files)};const scope=new URL(self.registration.scope);self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(p=>new URL(p,scope).href)))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('life-assistant-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==scope.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(new URL('index.html',scope).href,{ignoreVary:true}))));return;}if(FILES.some(p=>new URL(p,scope).href===u.href))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request,{ignoreVary:true}))||fetch(e.request)));});`;
 this.emitFile({type:'asset',fileName:'sw.js',source});
 }};}
