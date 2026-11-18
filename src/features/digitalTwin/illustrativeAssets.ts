import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import cartUrl from './assets/cart-illustrative-v1.glb?url';
import roomUrl from './assets/room-illustrative-v1.glb?url';
import notebookUrl from './assets/notebook-illustrative-v1.glb?url';
import manifest from './assets/manifest.json';

export type AssetKind=keyof typeof manifest.assets;
export type AssetLibrary=Record<AssetKind,THREE.Group>;
const urls:Record<AssetKind,string>={cart:cartUrl,room:roomUrl,notebook:notebookUrl};
const kinds:AssetKind[]=['cart','room','notebook'];
/** Only bundled, content-bound examples. Never consume database storage paths or URLs. */
export async function readBundledAsset(kind:AssetKind,signal:AbortSignal):Promise<THREE.Group>{
 const expected=manifest.assets[kind];
 const response=await fetch(urls[kind],{signal,credentials:'same-origin'});
 if(!response.ok)throw Error('Asset indisponível.');
 const raw=await response.arrayBuffer();
 if(raw.byteLength!==expected.bytes||raw.byteLength>256*1024)throw Error('Tamanho inválido.');
 if(!globalThis.crypto?.subtle)throw Error('Verificação de integridade indisponível.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==expected.sha256)throw Error('Integridade divergente.');
 const v=new DataView(raw);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==raw.byteLength||v.getUint32(16,true)!==0x4e4f534a)throw Error('GLB inválido.');
 const jsonEnd=20+v.getUint32(12,true);
 if(jsonEnd+8>raw.byteLength||v.getUint32(jsonEnd+4,true)!==0x004e4942||jsonEnd+8+v.getUint32(jsonEnd,true)!==raw.byteLength)throw Error('GLB incompleto.');
 const doc=JSON.parse(new TextDecoder().decode(raw.slice(20,jsonEnd)));
 if(doc.asset?.extras?.illustrative!==true||doc.buffers?.length!==1||'uri' in doc.buffers[0]||doc.images?.length||doc.textures?.length||doc.extensionsUsed?.length||doc.extensionsRequired?.length)throw Error('Asset externo ou incompatível.');
 if(signal.aborted)throw Error('Carga interrompida.');
 const gltf=await new GLTFLoader().parseAsync(raw,'');
 if(signal.aborted){disposeAssets([gltf.scene]);throw Error('Carga interrompida.');}
 if(expected.hotspots.some(name=>!gltf.scene.getObjectByName(name))){disposeAssets([gltf.scene]);throw Error('Manifesto incompatível.');}
 return gltf.scene;
}
export function disposeAssets(roots:THREE.Object3D[]){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 for(const root of roots)root.traverse(obj=>{
  if(obj instanceof THREE.Mesh){geometries.add(obj.geometry);for(const m of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(m);}
 });
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export async function loadIllustrativeAssets(signal:AbortSignal):Promise<AssetLibrary>{
 const results=await Promise.allSettled(kinds.map(k=>readBundledAsset(k,signal)));
 const loaded=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 if(signal.aborted||loaded.length!==kinds.length){disposeAssets(loaded);throw Error('Modelos detalhados indisponíveis.');}
 return Object.fromEntries(kinds.map((k,i)=>[k,loaded[i]])) as AssetLibrary;
}
export function createRoomVisual(library:AssetLibrary,width:number,depth:number){
 const room=library.room.clone(true);
 room.scale.set(width/manifest.assets.room.nominalDimensions[0],1,depth/manifest.assets.room.nominalDimensions[2]);
 // No arbitrary furniture coordinates in rooms with real registered cart positions.
 const furniture=room.getObjectByName('illustrative-furniture-unplaced');
 if(furniture)furniture.visible=false;
 return room;
}
export function createCartVisual(library:AssetLibrary,width:number,depth:number){
 const root=library.cart.clone(true);
 root.scale.set(width/manifest.assets.cart.nominalDimensions[0],1,depth/manifest.assets.cart.nominalDimensions[2]);
 const hinge=root.getObjectByName('door-hinge');
 const exampleNotebooks=new THREE.Group();exampleNotebooks.name='illustrative-notebooks';
 // GLB slot IDs are deliberately not DB slot keys. They prove neither presence nor occupancy.
 const slots:THREE.Vector3[]=[];
 root.traverse(obj=>{if(/^illustrative-slot-\d{2}$/.test(obj.name))slots.push(obj.position.clone());});
 exampleNotebooks.visible=false;
 const modelRoot=root.getObjectByName('cart-illustrative-v1')??root;
 modelRoot.add(exampleNotebooks);
 return {root,setCutaway(open:boolean){
  if(hinge)hinge.visible=!open;
  if(open&&!exampleNotebooks.children.length)for(const position of slots){
   const sample=library.notebook.clone(true);sample.position.copy(position);exampleNotebooks.add(sample);
  }
  if(!open)exampleNotebooks.clear();
  exampleNotebooks.visible=open;
 }};
}
