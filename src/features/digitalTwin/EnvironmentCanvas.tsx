import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {loadIllustrativeAssets,createRoomVisual,createCartVisual,disposeAssets,type AssetLibrary} from './illustrativeAssets';
import {hotspotForName,type Hotspot} from './inspection';
import {detailIds,frameScheduler,sceneKey} from './renderPolicy';
import {overviewStatuses,type OverviewLayout,type SceneCart} from './overviewLayout';

type Props={layout:OverviewLayout;selectedId:string|null;focusId:string|null;reset:number;onPick:(id:string)=>void;doorOpen:boolean;hotspot:Hotspot|null;onHotspot:(id:string,part:Hotspot)=>void;onInspectionReady:(ready:boolean)=>void;quality:'low'|'high'};
const unitBox=()=>new THREE.BoxGeometry(1,1,1);
function box(root:THREE.Object3D,w:number,h:number,d:number,color:number,x:number,y:number,z:number,metalness=0,pool?:{geometry:THREE.BoxGeometry;materials:Map<string,THREE.MeshStandardMaterial>}){
 const key=color+':'+metalness;let material=pool?.materials.get(key);
 if(!material){material=new THREE.MeshStandardMaterial({color,roughness:.72,metalness});pool?.materials.set(key,material);}
 const mesh=new THREE.Mesh(pool?.geometry??unitBox(),material);mesh.scale.set(w,h,d);
 mesh.position.set(x,y,z);root.add(mesh);return mesh;
}
function label(value:string,color:number,width:number){
 const c=document.createElement('canvas');c.width=768;c.height=112;
 const ctx=c.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#242332';ctx.fillRect(0,0,c.width,c.height);
 ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillRect(0,0,14,c.height);
 ctx.fillStyle='#fff';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 const text=value.length>90?value.slice(0,87)+'…':value;
 ctx.fillText(text,c.width/2,56,710);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
 sprite.scale.set(width,width*112/768,1);sprite.renderOrder=2;return sprite;
}
function cartMesh(cart:SceneCart,pool: {geometry:THREE.BoxGeometry;materials:Map<string,THREE.MeshStandardMaterial>}){
 const root=new THREE.Group();root.position.set(cart.x,cart.y,cart.z);root.rotation.y=cart.yaw*Math.PI/180;
 root.userData.cartId=cart.id;
 const visual=new THREE.Group();root.add(visual);
 const w=cart.width,d=cart.depth,h=1.7;
 // One body and one status strip in far LOD; detailed parts loaded only for nearby carts.
 box(visual,w,h,d,0x46566b,0,h/2+.17,0,.35,pool);
 const status=overviewStatuses[cart.status];
 box(root,w*.83,.08,.025,status.color,0,1.77,d/2+.09,0,pool);
 const tag=label(cart.code+' · '+status.label,status.color,Math.max(2.6,w*1.2));
 if(tag){tag.position.set(0,h+.58,0);root.add(tag);}
 const radius=Math.max(.75,Math.hypot(w,d)/2+.16);
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.095,32),new THREE.MeshBasicMaterial({color:0xd0b6ff,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.visible=false;root.add(ring);
 return {root,ring,cart,visual,detailed:null as ReturnType<typeof createCartVisual>|null};
}

export default function EnvironmentCanvas(props:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const layoutKey=sceneKey(props.layout);
 const synchronise=useRef<(()=>void)|null>(null);
 const cameraMemory=useRef<{position:THREE.Vector3;target:THREE.Vector3;zoom:number;focusId:string|null;reset:number}|null>(null);
 const [unavailable,setUnavailable]=useState(false);
 const [assetState,setAssetState]=useState<'loading'|'detailed'|'fallback'|'economical'>('loading');
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:props.quality==='high'});}catch{setUnavailable(true);return;}
  setUnavailable(false);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x252332);
  const span=Math.max(6,props.layout.width,props.layout.depth),distance=Math.max(12,span*1.65);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,distance*8);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,props.quality==='high'?1.5:1));
  renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.dataset.cartCount=String(props.layout.carts.length);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minZoom=.45;controls.maxZoom=Math.max(8,span/2);
  controls.maxPolarAngle=Math.PI*.48;
  scene.add(new THREE.HemisphereLight(0xe5e7ff,0x766b80,2.1));
  const light=new THREE.DirectionalLight(0xfff1dc,2.1);light.position.set(span/2,span,span/2);scene.add(light);
  const roomVisuals:{zone:OverviewLayout['zones'][number];root:THREE.Group;fallback:THREE.Group}[]=[];
  for(const zone of props.layout.zones){
   const roomRoot=new THREE.Group();roomRoot.position.set(zone.x,0,zone.z);scene.add(roomRoot);
   const fallback=new THREE.Group();roomRoot.add(fallback);roomVisuals.push({zone,root:roomRoot,fallback});
   box(fallback,zone.width,.11,zone.depth,zone.unplaced?0x49485c:0x697483,0,-.065,0);
   if(!zone.unplaced){
    box(fallback,zone.width,.55,.13,0x8994a8,0,.27,-zone.depth/2);
    box(fallback,.13,.55,zone.depth,0x8994a8,-zone.width/2,.27,0);
   }
   const name=label(zone.label,zone.unplaced?0xc7a3ff:0xa5b8cf,Math.min(Math.max(3.5,zone.width*.8),12));
   if(name){name.position.set(zone.x,.7,zone.z+zone.depth/2+.45);scene.add(name);}
  }
  const pool={geometry:unitBox(),materials:new Map<string,THREE.MeshStandardMaterial>()};
  const carts=props.layout.carts.map(c=>cartMesh(c,pool));for(const c of carts)scene.add(c.root);
  const abort=new AbortController();let library:AssetLibrary|null=null;
  let lost=false,lastFocus:string|null|undefined=undefined,lastReset=-1;
  let visible=true,detailSet=new Set<string>();
  function applyLod(){
   if(!library)return;
   const state=latest.current;
   const ppm=host!.clientHeight*camera.zoom/Math.max(.01,camera.top-camera.bottom);
   detailSet=detailIds(props.layout.carts,state.focusId,state.selectedId,controls.target,ppm,detailSet);
   for(const c of carts){const want=detailSet.has(c.cart.id);
    if(want&&!c.detailed){c.detailed=createCartVisual(library,c.cart.width,c.cart.depth);c.root.add(c.detailed.root);}
    if(!want&&c.detailed){c.root.remove(c.detailed.root);c.detailed=null;}
    c.visual.visible=!c.detailed;
    c.detailed?.setCutaway(c.cart.id===state.focusId&&state.doorOpen);
   }
   canvas.dataset.detailCount=String(detailSet.size);
   canvas.dataset.cutawayCart=carts.find(c=>c.cart.id===state.focusId&&c.detailed&&state.doorOpen)?.cart.id??'';
  }
  const scheduler=frameScheduler(()=>{if(lost||!visible||document.hidden)return;applyLod();renderer.render(scene,camera);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.frames=String(Number(canvas.dataset.frames??0)+1);},cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id));
  function render(){scheduler.schedule();}
  function resize(){
   const w=Math.max(1,host!.clientWidth),h=Math.max(1,host!.clientHeight),aspect=w/h;
   const half=Math.hypot(props.layout.width,props.layout.depth)*.68+2;
   const fit=Math.max(half,half/aspect);
   camera.top=fit;camera.bottom=-fit;camera.left=-fit*aspect;camera.right=fit*aspect;
   camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();
  }
  function saveCamera(){cameraMemory.current={position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom,focusId:lastFocus??null,reset:lastReset};}
  const saved=cameraMemory.current;
  if(saved){camera.position.copy(saved.position);controls.target.copy(saved.target);camera.zoom=saved.zoom;lastFocus=saved.focusId;lastReset=saved.reset;}
  function update(){
   const state=latest.current,selected=carts.find(c=>c.cart.id===state.selectedId),focused=carts.find(c=>c.cart.id===state.focusId);
   for(const c of carts)c.ring.visible=c===selected;
   canvas.dataset.selectedCart=selected?.cart.id??'';
   canvas.dataset.cutawayCart=focused?.detailed&&state.doorOpen?focused.cart.id:'';
   canvas.dataset.hotspot=state.hotspot??'';
   const focus=focused?.cart.id??null;
   if(lastReset!==state.reset||lastFocus!==focus){
    lastReset=state.reset;lastFocus=focus;
    if(focused){const c=focused.cart;controls.target.set(c.x,.85,c.z);const angle=c.yaw*Math.PI/180+.35;camera.position.set(c.x+Math.sin(angle)*distance*.8,distance*.36,c.z+Math.cos(angle)*distance*.8);
     camera.zoom=Math.min(controls.maxZoom,Math.max(1,span/(Math.max(3,c.width,c.depth)*1.9)));}
    else {controls.target.set(0,.2,0);camera.position.set(distance*.7,distance*.85,distance);camera.zoom=1;}
    camera.updateProjectionMatrix();controls.update();
   }
   render();
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let start:{x:number;y:number;id:number}|null=null;
  const down=(e:PointerEvent)=>{if(e.isPrimary&&e.button===0)start={x:e.clientX,y:e.clientY,id:e.pointerId};};
  const up=(e:PointerEvent)=>{
   const first=start;start=null;
   if(!first||first.id!==e.pointerId||Math.hypot(e.clientX-first.x,e.clientY-first.y)>5||lost)return;
   const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
   pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
   ray.setFromCamera(pointer,camera);
   const visible=(o:THREE.Object3D)=>{for(let n:THREE.Object3D|null=o;n;n=n.parent)if(!n.visible)return false;return true;};
   const hit=ray.intersectObjects(carts.map(c=>c.root),true).find(h=>h.object instanceof THREE.Mesh&&visible(h.object));
   let obj:THREE.Object3D|null=hit?.object??null;
   while(obj&&!obj.userData.cartId)obj=obj.parent;
   if(obj){const id=obj.userData.cartId as string,state=latest.current;
    if(state.focusId===id){for(let n:THREE.Object3D|null=hit?.object??null;n&&n!==obj;n=n.parent){
     const part=hotspotForName(n.name);if(part){state.onHotspot(id,part);return;}
    }}
    state.onPick(id);
   }
  };
  const cancel=()=>{start=null;};
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;setUnavailable(true);};
  const restored=()=>{lost=false;setUnavailable(false);resize();update();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',restored);
  const change=()=>{saveCamera();render();};controls.addEventListener('change',change);
  const observer=new ResizeObserver(resize);observer.observe(host);synchronise.current=update;update();resize();
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)render();});intersection.observe(host);
  const visibility=()=>{if(!document.hidden)render();};document.addEventListener('visibilitychange',visibility);
  if(props.quality==='low'){setAssetState('economical');canvas.dataset.assetMode='economical';}
  else {
   setAssetState('loading');canvas.dataset.assetMode='loading';
   void loadIllustrativeAssets(abort.signal).then(assets=>{
    if(abort.signal.aborted){disposeAssets(Object.values(assets));return;}
    library=assets;
    for(const r of roomVisuals){if(r.zone.unplaced)continue;const detailed=createRoomVisual(assets,r.zone.width,r.zone.depth);r.root.add(detailed);r.fallback.visible=false;}
    // Detail groups are allocated only in applyLod; far carts keep pooled simple meshes.
    setAssetState('detailed');canvas.dataset.assetMode='detailed';update();
   }).catch(()=>{
    if(abort.signal.aborted)return;
    for(const r of roomVisuals){for(const child of [...r.root.children])if(child!==r.fallback)r.root.remove(child);r.fallback.visible=true;}
    for(const c of carts){if(c.detailed)c.root.remove(c.detailed.root);c.detailed=null;c.visual.visible=true;}
    if(library){disposeAssets(Object.values(library));library=null;}
    setAssetState('fallback');canvas.dataset.assetMode='fallback';update();
   });
  }
  return ()=>{
   abort.abort();scheduler.dispose();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);saveCamera();synchronise.current=null;observer.disconnect();controls.removeEventListener('change',change);controls.dispose();
   canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);
   canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',restored);
   // GLB geometry/materials are shared by clones; dispose each resource once.
   if(library)disposeAssets([...Object.values(library),scene]);else disposeAssets([scene]);
   scene.traverse(obj=>{if(obj instanceof THREE.Sprite){obj.material.map?.dispose();obj.material.dispose();}});
   renderer.dispose();canvas.remove();
  };
 },[layoutKey,props.quality]);
 useEffect(()=>{synchronise.current?.();},[props.selectedId,props.focusId,props.reset,props.doorOpen,props.hotspot]);
 useEffect(()=>{props.onInspectionReady(assetState==='detailed'&&!unavailable);return ()=>props.onInspectionReady(false);},[assetState,unavailable,props.onInspectionReady]);
 return <div><div className="dt-stage dt-overview-stage" ref={mount} role="img" aria-label="Ambientes esquemáticos e carrinhos cadastrados. Use a lista para seleção por teclado."/>
  {unavailable&&<p role="status" className="notice warning">WebGL indisponível. Todos os carrinhos continuam acessíveis pela lista.</p>}
  {!unavailable&&<p className="form-hint" role="status">{assetState==='detailed'?'Modelos GLB ilustrativos verificados. A porta virtual mostra exemplos, não equipamentos presentes.':assetState==='loading'?'Carregando modelos detalhados; geometria simples disponível.':assetState==='fallback'?'Modelos detalhados indisponíveis. Geometria simplificada preservada.':'Qualidade econômica: geometria simplificada.'}</p>}</div>;
}
