// Turns the rooms + openings of a plan into floors, walls and windows.
import * as THREE from 'three';
import { roomPoints, contourArea } from '../geometry/room.js';
import { box, mat, at, floorMesh } from './kit.js';

const EXT_T = 0.2;   // exterior wall thickness
const INT_T = 0.1;   // interior wall thickness
const CURB = 0.14;   // height of the cut-away walls on the camera side
const EPS = 1e-4;

const key = (v) => Math.round(v * 1000);

// Splits every room edge into wall segments, classifying each as exterior / interior
// and attaching the opening (door, window, ...) that covers it, if any.
export function wallSegments(config) {
  const lines=new Map();
  const add=(from,to,edge=null,opening=null)=>{
    let dx=to[0]-from[0],dz=to[1]-from[1],len=Math.hypot(dx,dz);if(len<EPS)return;
    let ux=dx/len,uz=dz/len;if(ux<-EPS||Math.abs(ux)<EPS&&uz<0){ux=-ux;uz=-uz;}
    const nx=-uz,nz=ux,c=nx*from[0]+nz*from[1];
    const id=[key(ux),key(uz),key(c)].join(':');
    if(!lines.has(id))lines.set(id,{ux,uz,nx,nz,c,edges:[],openings:[]});
    const l=lines.get(id),v1=ux*from[0]+uz*from[1],v2=ux*to[0]+uz*to[1],range={a:Math.min(v1,v2),b:Math.max(v1,v2)};
    if(edge)l.edges.push({...range,...edge});if(opening)l.openings.push({...opening,...range});
  };
  for(const room of config.rooms){const ps=roomPoints(room),sign=Math.sign(contourArea(ps));for(let i=0;i<ps.length;i++){
    const a=ps[i],b=ps[(i+1)%ps.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    add(a,b,{roomId:room.id,outX:sign*(b[1]-a[1])/len,outZ:-sign*(b[0]-a[0])/len});
  }}
  for(const o of config.openings)add(o.from,o.to,null,o);
  const result=[];
  for(const l of lines.values()){
    const points=[...new Set([...l.edges,...l.openings].flatMap(e=>[key(e.a),key(e.b)]))].sort((a,b)=>a-b).map(v=>v/1000);
    const run=[];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],mid=(a+b)/2,covering=l.edges.filter(e=>e.a<mid&&mid<e.b);if(!covering.length)continue;
      const kind=new Set(covering.map(e=>e.roomId)).size>1?'interior':'exterior',opening=l.openings.find(o=>o.a<mid&&mid<o.b)||null;
      const prev=run.at(-1);
      if(prev&&Math.abs(prev.b-a)<EPS&&prev.kind===kind&&prev.opening===opening)prev.b=b;
      else run.push({...l,a,b,kind,opening,outX:covering[0].outX,outZ:covering[0].outZ});
    }
    run.forEach((s,i)=>{s.freeA=!(run[i-1]&&Math.abs(run[i-1].b-s.a)<EPS);s.freeB=!(run[i+1]&&Math.abs(run[i+1].a-s.b)<EPS);});
    result.push(...run);
  }
  return result;
}

export function buildHouse(config, camDir) {
  const group = new THREE.Group();
  const floors = [],walls=[];
  const H = config.wallHeight;
  const Hi = Math.min(config.interiorWallHeight, H);
  const { minX, minZ, maxX, maxZ } = config.bounds;

  // Plinth the model stands on.
  const plinth = box(maxX - minX + 0.7, 0.3, maxZ - minZ + 0.7, mat('#141927', { rough: 0.9 }), { r: 0.12 });
  at(plinth, (minX + maxX) / 2, -0.305, (minZ + maxZ) / 2);
  plinth.receiveShadow = true;
  group.add(plinth);

  for (const room of config.rooms) {
    const floor = floorMesh(room, room.floor);
    floor.userData = { kind: 'room', id: room.id };
    floors.push(floor);
    group.add(floor);
  }

  const wallBody = mat('#e7e3db', { rough: 0.95 });
  const wallCap = mat('#262b3a', { rough: 0.8 });
  const wallMats = [wallBody, wallBody, wallCap, wallBody, wallBody, wallBody];
  const blocker = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const glass = new THREE.MeshStandardMaterial({
    color: '#9cc0ff', roughness: 0.08, transparent: true, opacity: 0.22,
    emissive: '#3d5fae', emissiveIntensity: 0.5,
  });
  const frame = mat('#2c3142', { rough: 0.6 });

  // A wall piece running from a..b along its axis, between heights y0..y1.
  const piece = (s, a, b, y0, y1, t, materials = wallMats) => {
    const len = b - a;
    const geo = new THREE.BoxGeometry(len, y1 - y0, t);
    const m = new THREE.Mesh(geo, materials);
    const mid = (a + b) / 2;
    m.position.set(s.ux*mid+s.nx*s.c, (y0+y1)/2, s.uz*mid+s.nz*s.c);
    m.rotation.y=-Math.atan2(s.uz,s.ux);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    if(materials!==blocker)walls.push(m);
    return m;
  };

  for (const s of wallSegments(config)) {
    const exterior = s.kind === 'exterior';
    const t = exterior ? EXT_T : INT_T;
    // Outward normal of an exterior wall points away from its room.
    const nx = s.outX;
    const nz = s.outZ;
    const near = exterior && nx * camDir.x + nz * camDir.z > 0.15;
    const a = s.a - (s.freeA ? EXT_T / 2 : 0);
    const b = s.b + (s.freeB ? EXT_T / 2 : 0);
    const type = s.opening?.type;

    if (near) {
      if (type !== 'door') piece(s, a, b, 0, CURB, t);
      continue;
    }
    if (type === 'door' || type === 'open') continue;

    const height = exterior ? H : Hi;
    if (type === 'window' && exterior) {
      const { sill, head } = s.opening;
      piece(s, a, b, 0, sill, t);
      piece(s, a, b, Math.min(head, H), H, t);
      const pane = piece(s, a, b, sill, head, 0.03, glass);
      pane.castShadow = false;
      const fw = 0.05;
      const bars = [[a, a + fw, sill, head], [b - fw, b, sill, head], [a, b, sill, sill + fw], [a, b, head - fw, head]];
      if (b - a > 1.2) bars.push([(a + b) / 2 - fw / 2, (a + b) / 2 + fw / 2, sill, head]);
      for (const [fa, fb, y0, y1] of bars) piece(s, fa, fb, y0, y1, 0.07, frame);
      continue;
    }
    if (type === 'window') continue; // a window in an interior wall is just a gap

    piece(s, a, b, 0, height, t);
    // Interior walls are drawn cut low, but lamps should still be contained by the
    // real, full-height wall: an invisible shadow caster fills in the missing part.
    if (!exterior && Hi < H) piece(s, a, b, Hi, H, 0.04, blocker).receiveShadow = false;
  }

  return { group, floors, walls };
}
