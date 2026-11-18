import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {overviewStatuses,type OverviewLayout,type SceneCart} from './overviewLayout';

type Props={layout:OverviewLayout;selectedId:string|null;focusId:string|null;reset:number;onPick:(id:string)=>void;quality:'low'|'high'};
function box(root:THREE.Object3D,w:number,h:number,d:number,color:number,x:number,y:number,z:number,metalness=0){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.72,metalness}));
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
function cartMesh(cart:SceneCart){
 const root=new THREE.Group();root.position.set(cart.x,cart.y,cart.z);root.rotation.y=cart.yaw*Math.PI/180;
 root.userData.cartId=cart.id;
 const w=cart.width,d=cart.depth,h=1.7;
 box(root,w,h,d,0x46566b,0,h/2+.17,0,.35);
 box(root,w*.94,.075,d*.94,0x707e93,0,h+.18,0,.4);
 box(root,w*.94,h*.87,.04,0x354254,0,h/2+.17,d/2+.025,.25);
 for(let i=0;i<4;i++)box(root,w*.66,.025,.02,0x202937,0,h*.72-i*.095,d/2+.05);
 box(root,.07,.26,.07,0xb8c2d4,w*.36,h*.53,d/2+.06,.6);
 const status=overviewStatuses[cart.status];
 box(root,w*.83,.08,.025,status.color,0,h+.06,d/2+.062);
 for(const x of [-w*.36,w*.36])for(const z of [-d*.34,d*.34]){
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.095,10),new THREE.MeshStandardMaterial({color:0x1e2430}));
  wheel.rotation.z=Math.PI/2;wheel.position.set(x,.11,z);root.add(wheel);
 }
 const tag=label(cart.code+' · '+status.label,status.color,Math.max(2.6,w*1.2));
 if(tag){tag.position.set(0,h+.58,0);root.add(tag);}
 const radius=Math.max(.75,Math.hypot(w,d)/2+.16);
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.095,32),new THREE.MeshBasicMaterial({color:0xd0b6ff,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.visible=false;root.add(ring);
 return {root,ring,cart};
}

export default function EnvironmentCanvas(props:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const synchronise=useRef<(()=>void)|null>(null);
 const cameraMemory=useRef<{position:THREE.Vector3;target:THREE.Vector3;zoom:number;focusId:string|null;reset:number}|null>(null);
 const [unavailable,setUnavailable]=useState(false);
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
  for(const zone of props.layout.zones){
   box(scene,zone.width,.11,zone.depth,zone.unplaced?0x49485c:0x697483,zone.x,-.065,zone.z);
   if(!zone.unplaced){
    box(scene,zone.width,.55,.13,0x8994a8,zone.x,.27,zone.z-zone.depth/2);
    box(scene,.13,.55,zone.depth,0x8994a8,zone.x-zone.width/2,.27,zone.z);
   }
   const name=label(zone.label,zone.unplaced?0xc7a3ff:0xa5b8cf,Math.min(Math.max(3.5,zone.width*.8),12));
   if(name){name.position.set(zone.x,.7,zone.z+zone.depth/2+.45);scene.add(name);}
  }
  const carts=props.layout.carts.map(cartMesh);for(const c of carts)scene.add(c.root);
  let lost=false,lastFocus:string|null|undefined=undefined,lastReset=-1;
  function render(){if(lost)return;renderer.render(scene,camera);canvas.dataset.drawCalls=String(renderer.info.render.calls);}
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
   const focus=focused?.cart.id??null;
   if(lastReset!==state.reset||lastFocus!==focus){
    lastReset=state.reset;lastFocus=focus;
    if(focused){const c=focused.cart;controls.target.set(c.x,.85,c.z);camera.position.set(c.x+distance*.5,distance*.76,c.z+distance*.65);
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
   const hit=ray.intersectObjects(carts.map(c=>c.root),true).find(h=>h.object instanceof THREE.Mesh&&h.object.visible);
   let obj:THREE.Object3D|null=hit?.object??null;
   while(obj&&!obj.userData.cartId)obj=obj.parent;
   if(obj)latest.current.onPick(obj.userData.cartId as string);
  };
  const cancel=()=>{start=null;};
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;setUnavailable(true);};
  const restored=()=>{lost=false;setUnavailable(false);resize();update();};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',restored);
  const change=()=>{saveCamera();render();};controls.addEventListener('change',change);
  const observer=new ResizeObserver(resize);observer.observe(host);synchronise.current=update;update();resize();
  return ()=>{
   saveCamera();synchronise.current=null;observer.disconnect();controls.removeEventListener('change',change);controls.dispose();
   canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);
   canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',restored);
   scene.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.geometry.dispose();
    if(obj instanceof THREE.Mesh||obj instanceof THREE.Sprite){const materials=Array.isArray(obj.material)?obj.material:[obj.material];
     for(const material of materials){if(material instanceof THREE.SpriteMaterial)material.map?.dispose();material.dispose();}}});
   renderer.dispose();canvas.remove();
  };
 },[props.layout,props.quality]);
 useEffect(()=>{synchronise.current?.();},[props.selectedId,props.focusId,props.reset]);
 return <div><div className="dt-stage dt-overview-stage" ref={mount} role="img" aria-label="Ambientes esquemáticos e carrinhos cadastrados. Use a lista para seleção por teclado."/>
  {unavailable&&<p role="status" className="notice warning">WebGL indisponível. Todos os carrinhos continuam acessíveis pela lista.</p>}</div>;
}
