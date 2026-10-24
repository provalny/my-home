import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateSurfaceAttachments,furnitureSurface} from './surface-attachment.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
const desk=()=>({id:'desk',type:'desk',pos:[2,3],rot:0});
const laptop=()=>({id:'mac',type:'macBook',pos:[2,3],rot:0,y:.76});
test('MacBook rests on the real desk top, below its decorative monitor',()=>{
 const items=[desk(),laptop()];updateSurfaceAttachments(items,{movingId:'mac'});near(items[1].y,.76);assert.equal(items[1].surfaceAttachment.supportId,'desk');
});
test('MacBook follows its table translation, rotation, height and resizing across JSON saves',()=>{
 let items=[desk(),{...laptop(),pos:[2.3,3.1],rot:15}];updateSurfaceAttachments(items,{movingId:'mac'});items=JSON.parse(JSON.stringify(items));
 items[0].pos=[5,6];items[0].rot=90;items[0].y=.2;updateSurfaceAttachments(items,{movingId:'desk'});
 near(items[1].pos[0],5.1);near(items[1].pos[1],5.7);near(items[1].rot,105);near(items[1].y,.96);
 items[0].width=.5;updateSurfaceAttachments(items,{movingId:'desk'});assert.ok(items[1].surfaceAttachment);assert.ok(items[1].pos[1]>5.75);
});
test('moving to a different table or off furniture updates the support and height',()=>{
 const items=[desk(),{id:'coffee',type:'coffeeTable',pos:[4,3]},laptop()];const mac=items[2];updateSurfaceAttachments(items,{movingId:'mac'});
 mac.pos=[4,3];updateSurfaceAttachments(items,{movingId:'mac'});assert.equal(mac.surfaceAttachment.supportId,'coffee');near(mac.y,.4);
 mac.pos=[8,8];updateSurfaceAttachments(items,{movingId:'mac'});assert.equal(mac.surfaceAttachment,undefined);near(mac.y,0);
});
test('turned tables clamp the whole laptop footprint onto the actual tabletop',()=>{
 const table={id:'table',type:'diningSet',pos:[0,0],rot:90},mac={...laptop(),pos:[.4,.8],rot:90};
 updateSurfaceAttachments([table,mac],{movingId:'mac'});assert.equal(mac.surfaceAttachment.supportId,'table');near(mac.y,.76);assert.ok(Math.abs(mac.surfaceAttachment.z)<=.475-.125+.0001);
});
test('manual placement stays intact and missing or too small supports detach safely',()=>{
 const table=desk(),mac=laptop();mac.surfaceSnap=false;mac.y=1.25;updateSurfaceAttachments([table,mac]);near(mac.y,1.25);assert.equal(mac.surfaceAttachment,undefined);
 mac.surfaceSnap=true;updateSurfaceAttachments([table,mac]);assert.ok(mac.surfaceAttachment);
 updateSurfaceAttachments([mac]);near(mac.y,0);assert.equal(mac.surfaceAttachment,undefined);
 table.width=.1;mac.pos=[2,3];updateSurfaceAttachments([table,mac]);assert.equal(mac.surfaceAttachment,undefined);
});
test('cabinet and raised wall shelf expose their real upper surfaces',()=>{
 for(const type of ['nightstand','dresser','sideboard','printerCabinet','wallShelf']){const support={id:type,type,pos:[1,1],y:.3},mac={...laptop(),pos:[1,1]};updateSurfaceAttachments([support,mac]);assert.equal(mac.surfaceAttachment.supportId,type);near(mac.y,furnitureSurface(support).y+.3);}
});

test('PC and both printers attach to a printer cabinet with no overhang and follow it',()=>{
 for(const type of ['pcCase','printer3dEnclosed','printer3dOpen']){
  const support={id:'cabinet',type:'printerCabinet',pos:[1,2]},device={id:'device',type,pos:[1,2],rot:0};
  updateSurfaceAttachments([support,device],{movingId:'device'});assert.equal(device.surfaceAttachment?.supportId,'cabinet',type);near(device.y,.76);
  support.pos=[3,4];support.rot=90;support.y=.1;updateSurfaceAttachments([support,device],{movingId:'cabinet'});near(device.pos[0],3);near(device.pos[1],4);near(device.y,.86);near(device.rot,90);
  device.pos=[9,9];updateSurfaceAttachments([support,device],{movingId:'device'});assert.equal(device.surfaceAttachment,undefined);near(device.y,0);
  device.surfaceSnap=false;device.y=1.2;updateSurfaceAttachments([device]);near(device.y,1.2);
 }
});

test('RGB desktop kit and desktop monitor attach to a desk; small desk supports a laptop',()=>{
 for(const type of ['gamingDesktop','desktopMonitor','whiteSpeaker']){const table=desk(),device={id:type,type,pos:[2,3],rot:0};updateSurfaceAttachments([table,device],{movingId:type});assert.equal(device.surfaceAttachment?.supportId,'desk');near(device.y,.76);}
 const table={id:'small',type:'smallDesk',pos:[0,0]},mac={...laptop(),pos:[0,0]};updateSurfaceAttachments([table,mac]);assert.equal(mac.surfaceAttachment?.supportId,'small');near(mac.y,.75);
});
