import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Box3,Mesh} from 'three';
import manifest from './assets/manifest.json';
import {readBundledAsset,loadIllustrativeAssets,createCartVisual,createRoomVisual,disposeAssets,type AssetKind} from './illustrativeAssets';
const kinds:AssetKind[]=['cart','room','notebook'];
const bytes=(kind:AssetKind)=>Uint8Array.from(readFileSync(new URL('./assets/'+manifest.assets[kind].file,import.meta.url)));
function response(kind:AssetKind){return new Response(bytes(kind));}
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
 const kind=kinds.find(k=>String(url).includes(manifest.assets[k].file));
 return kind?response(kind):new Response('',{status:404});
}));});
afterEach(()=>vi.unstubAllGlobals());
describe('F5.3 GLB illustrative assets',()=>{
 it.each(kinds)('loads real %s model, verifies named nodes and materials',async kind=>{
  const root=await readBundledAsset(kind,new AbortController().signal);
  try{let meshes=0;root.traverse(n=>{if(n instanceof Mesh)meshes++;});
   expect(meshes).toBeGreaterThan(0);
   for(const name of manifest.assets[kind].hotspots)expect(root.getObjectByName(name)).toBeDefined();
   const box=new Box3().setFromObject(root);expect(box.isEmpty()).toBe(false);
  }finally{disposeAssets([root]);}
 });
 it('rejects HTTP failure, mutated and truncated content',async()=>{
  const signal=new AbortController().signal;
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
  await expect(readBundledAsset('cart',signal)).rejects.toThrow();
  const altered=bytes('cart');altered[altered.length-1]^=1;
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(altered)));
  await expect(readBundledAsset('cart',signal)).rejects.toThrow('Integridade');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes('cart').slice(0,50))));
  await expect(readBundledAsset('cart',signal)).rejects.toThrow('Tamanho');
 });
 it('rejects interrupted request without exposing a partial library',async()=>{
  const abort=new AbortController();abort.abort();
  await expect(loadIllustrativeAssets(abort.signal)).rejects.toThrow();
 });
 it('uses registered footprint, independent cutaway and no physical binding',async()=>{
  const lib=await loadIllustrativeAssets(new AbortController().signal);
  try{
   const a=createCartVisual(lib,1,.65),b=createCartVisual(lib,1.2,1);
   const bounds=new Box3().setFromObject(a.root);
   expect(bounds.min.x).toBeGreaterThanOrEqual(-.500001);expect(bounds.max.x).toBeLessThanOrEqual(.500001);
   expect(bounds.min.z).toBeGreaterThanOrEqual(-.325001);expect(bounds.max.z).toBeLessThanOrEqual(.325001);
   const examples=a.root.getObjectByName('illustrative-notebooks')!;
   expect(examples.children).toHaveLength(0);expect(a.root.getObjectByName('shelf-0')?.visible).toBe(false);
   a.setCutaway(true);expect(examples.children).toHaveLength(30);
   expect(a.root.getObjectByName('door-hinge')?.visible).toBe(false);
   expect(a.root.getObjectByName('shelf-0')?.visible).toBe(true);
   expect(b.root.getObjectByName('door-hinge')?.visible).toBe(true);
   expect(b.root.getObjectByName('illustrative-notebooks')?.children).toHaveLength(0);
   expect(a.root.getObjectByName('illustrative-slot-01')?.userData.notPhysicalBinding).toBe(true);
   a.setCutaway(false);expect(examples.children).toHaveLength(0);
   expect(a.root.getObjectByName('door-hinge')?.visible).toBe(true);
  }finally{disposeAssets(Object.values(lib));}
 });
 it('does not put illustrative furniture into registered scenes',async()=>{
  const lib=await loadIllustrativeAssets(new AbortController().signal);
  try{const room=createRoomVisual(lib,12,9);
   expect(room.scale.toArray()).toEqual([1.5,1,1.5]);
   expect(room.getObjectByName('illustrative-furniture-unplaced')?.visible).toBe(false);
   expect(lib.room.getObjectByName('illustrative-furniture-unplaced')?.visible).toBe(true);
  }finally{disposeAssets(Object.values(lib));}
 });
});
