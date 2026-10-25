import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { endpoints, readMap, downloadArea } from './services.js';

export function createRouteMap(host,{trip,onPick=()=>{},onMove=()=>{},services={},theme='dark',offline=false,memory=null,onMessage=()=>{}}){
  const map=L.map(host,{zoomControl:false,preferCanvas:false,attributionControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView(memory?.center||[59.65,31.2],memory?.zoom||8);
  map.attributionControl.setPrefix(false);map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors');
  map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Исправить карту</a>');
  L.control.zoom({position:'bottomright',zoomInTitle:'Приблизить',zoomOutTitle:'Отдалить'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  let disposed=false,cached=null,vector=null,area=null,forceOffline=offline,pick=false;
  const tiles=L.tileLayer(endpoints(services).tiles,{maxZoom:19,crossOrigin:true});
  const lineGroup=L.featureGroup().addTo(map),markers=L.featureGroup().addTo(map);
  for(let i=0;i<trip.stops.length;i++){
    const s=trip.stops[i],el=document.createElement('span');el.className='tr-map-pin';el.textContent=String(i+1);
    const marker=L.marker([s.lat,s.lon],{draggable:true,title:s.name,icon:L.divIcon({className:'tr-map-marker',html:el,iconSize:[28,32],iconAnchor:[14,30]})}).addTo(markers);
    const label=document.createElement('span');label.textContent=s.name;marker.bindTooltip(label,{direction:'top'});marker.on('dragend',()=>{const p=marker.getLatLng();onMove(s.id,p.lat,p.lng);});
    if(i){const prev=trip.stops[i-1],r=s.route;L.polyline((r?.coordinates||[[prev.lon,prev.lat],[s.lon,s.lat]]).map(p=>[p[1],p[0]]),{color:r?.manual?'#9eb5d2':'#ffbd65',weight:4,opacity:.95,dashArray:!r||r.manual?'7 8':null}).addTo(lineGroup);}
  }
  function fit(){const bounds=markers.getBounds();const lines=lineGroup.getBounds();if(lines.isValid())bounds.extend(lines);if(bounds.isValid())map.fitBounds(bounds,{padding:[45,45],maxZoom:13});}
  if(!memory&&trip.stops.length)fit();
  function style(feature){const p=feature.properties;return p.natural==='water'?{color:'#447d9c',fillColor:'#346c87',fillOpacity:.6,weight:1}:p.waterway?{color:'#559bb7',weight:2}:p.railway?{color:'#788c9d',weight:1,dashArray:'4 3'}:{color:theme==='dark'?'#73838f':'#9a8b77',weight:/motorway|trunk|primary/.test(p.highway)?2.5:1.2};}
  function refresh(){
    if(disposed)return;const off=forceOffline||!navigator.onLine;host.classList.toggle('is-offline-map',off);host.classList.toggle('is-dark-map',theme==='dark');
    if(off){map.removeLayer(tiles);if(cached&&!vector){vector=L.geoJSON(cached.geojson,{style,pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:2,color:'#9fb6c6'}),onEachFeature:(f,layer)=>{if(f.properties.name){const label=document.createElement('span');label.textContent=f.properties.name;layer.bindTooltip(label,{permanent:f.geometry.type==='Point',direction:'right',className:'tr-map-label'});}}}).addTo(map);area=L.rectangle([[cached.bounds[0],cached.bounds[1]],[cached.bounds[2],cached.bounds[3]]],{color:'#6cbca5',weight:1,fill:false,dashArray:'4 5',interactive:false}).addTo(map);lineGroup.bringToFront();}
      onMessage(cached?'Офлайн-схема · '+cached.detail:'Карта не скачана. Доступны сохранённые точки и путь.');
    }else{vector?.remove();area?.remove();vector=area=null;if(!map.hasLayer(tiles))tiles.addTo(map);onMessage('OpenStreetMap · выберите точку или найдите место');}
  }
  const online=()=>refresh();window.addEventListener('online',online);window.addEventListener('offline',online);
  readMap(trip.id).then(value=>{cached=value;refresh();}).catch(()=>refresh());refresh();
  map.on('click',e=>{if(pick)onPick(e.latlng.lat,e.latlng.lng);});
  const observer=new ResizeObserver(()=>{if(!disposed)map.invalidateSize();});observer.observe(host);requestAnimationFrame(()=>{if(!disposed)map.invalidateSize();});
  return {map,fit,setPicking(value){pick=value;host.classList.toggle('is-picking',pick);},setOffline(value){forceOffline=value;refresh();},snapshot:()=>({center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()}),async download(signal){const b=map.getBounds();const value=await downloadArea(trip.id,[b.getSouth(),b.getWest(),b.getNorth(),b.getEast()],services,signal);cached=value;if(!disposed){vector?.remove();vector=null;area?.remove();area=null;forceOffline=true;refresh();}return value;},dispose(){disposed=true;observer.disconnect();window.removeEventListener('online',online);window.removeEventListener('offline',online);map.stop();map.remove();}};
}
