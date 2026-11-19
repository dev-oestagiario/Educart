import {Feedback} from '../../components/Feedback';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {prototypeCarts,statuses,type PrototypeCart} from './prototypeData';

type Props={selectedId:string|null; inspection:boolean; doorOpen:boolean; onPick:(id:string)=>void; quality:'low'|'high'; reset:number};

function box(parent:THREE.Object3D,w:number,h:number,d:number,color:number,x:number,y:number,z:number,metalness=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.73,metalness}));
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function label(text:string,color:string) {
  const surface=document.createElement('canvas');surface.width=512;surface.height=96;
  const ctx=surface.getContext('2d')!;
  ctx.fillStyle='#252033';ctx.fillRect(0,0,512,96);ctx.fillStyle=color;ctx.fillRect(0,0,12,96);
  ctx.fillStyle='#fff';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48,476);
  const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
  sprite.scale.set(2,.375,1);return sprite;
}
function makeCart(cart:PrototypeCart) {
  const group=new THREE.Group();group.position.set(cart.x,0,cart.z);group.userData.cartId=cart.id;
  const frame=0x667386, dark=0x293345;
  box(group,1.24,.11,.83,frame,0,.28,0,.45);
  box(group,1.24,.11,.83,frame,0,1.83,0,.45);
  box(group,.09,1.5,.83,frame,-.575,1.06,0,.45);
  box(group,.09,1.5,.83,frame,.575,1.06,0,.45);
  box(group,1.1,1.5,.06,dark,0,1.06,-.385);
  for(const y of [.78,1.26])box(group,1.1,.065,.77,frame,0,y,0,.3);
  const laptops=new THREE.InstancedMesh(new THREE.BoxGeometry(.072,.32,.53),new THREE.MeshStandardMaterial({color:0x272e3a,metalness:.35,roughness:.6}),cart.capacity);
  const matrix=new THREE.Matrix4();
  for(let i=0;i<cart.capacity;i++)laptops.setMatrixAt(i,matrix.makeTranslation(-.47+(i%10)*.104,.49+Math.floor(i/10)*.48,-.04));
  group.add(laptops);
  for(const x of [-.48,.48])for(const z of [-.28,.28]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.105,12),new THREE.MeshStandardMaterial({color:0x24252d}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.11,z);group.add(wheel);
    box(group,.09,.13,.09,frame,x,.22,z);
  }
  const door=new THREE.Group();door.position.set(-.57,0,.43);group.add(door);
  box(door,1.14,1.46,.065,0x46566b,.57,1.06,0,.36);
  for(let i=0;i<5;i++)box(door,.67,.025,.013,0x283343,.54,1.49-i*.074,.04);
  box(door,.065,.27,.065,0xc5c9d2,1.02,1.06,.075,.5);
  box(group,1.08,.085,.03,statuses[cart.status].color,0,1.76,.46);
  const tag=label(cart.code,'#'+statuses[cart.status].color.toString(16).padStart(6,'0'));tag.position.set(0,2.18,0);group.add(tag);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.82,.94,32),new THREE.MeshBasicMaterial({color:0xbda3ff,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.014;ring.visible=false;group.add(ring);
  return {group,door,ring,tag};
}

export default function PrototypeCanvas(props:Props) {
  const rootRef=useRef<HTMLDivElement>(null);
  const latest=useRef(props);latest.current=props;
  const sync=useRef<(()=>void)|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    const root=rootRef.current;if(!root)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:props.quality==='high'});}catch{setUnavailable(true);return;}
    setUnavailable(false);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x252332);
    const camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,100);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,props.quality==='high'?1.5:1));
    renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
    controls.minZoom=.65;controls.maxZoom=2.8;controls.maxPolarAngle=Math.PI*.48;
    scene.add(new THREE.HemisphereLight(0xe5e7ff,0x71677a,2.1));
    const key=new THREE.DirectionalLight(0xfff4e2,2.3);key.position.set(3,9,6);scene.add(key);
    box(scene,10,.12,7,0x626579,0,-.075,0);
    box(scene,10,1.12,.16,0x929caf,0,.49,-3.42);
    box(scene,.16,1.12,7,0x929caf,-4.92,.49,0);
    // Floor markings are intentionally confined to the room footprint.
    const floorLines=new THREE.Group();
    for(let x=-4;x<=4;x++)box(floorLines,.012,.003,6.8,0x797e8e,x,.002,0);
    for(let z=-3;z<=3;z++)box(floorLines,9.8,.003,.012,0x797e8e,0,.002,z);
    scene.add(floorLines);
    box(scene,1.75,.12,1.1,0x9c846f,-3.1,.86,2);
    for(const x of [-3.8,-2.4])for(const z of [1.6,2.4])box(scene,.09,.8,.09,0x414655,x,.4,z);
    box(scene,.58,.36,.055,0x222936,-3.1,1.12,2.15);box(scene,.09,.2,.08,0x333d4d,-3.1,.96,2.15);
    box(scene,2.1,.014,2,0x464652,3.1,.005,1.4);
    const zone=label('SEM LOCAL DEFINIDO','#bca7f7');zone.position.set(3.1,.22,2.65);zone.scale.set(2.6,.49,1);scene.add(zone);
    const carts=prototypeCarts.map(cart=>({...makeCart(cart),cart}));carts.forEach(c=>scene.add(c.group));
    let lost=false, lastFocus='', lastReset=-1;
    function render(){
      if(lost)return;
      renderer.render(scene,camera);
      renderer.domElement.dataset.drawCalls=String(renderer.info.render.calls);
      renderer.domElement.dataset.triangles=String(renderer.info.render.triangles);
    }
    function resize(){
      const w=Math.max(1,root!.clientWidth),h=Math.max(1,root!.clientHeight);
      const aspect=w/h;const half=Math.max(4.1,6.3/aspect);
      camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
      camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();
    }
    function update(){
      const state=latest.current;
      const target=carts.find(c=>c.cart.id===state.selectedId);
      for(const c of carts){
        c.ring.visible=c===target;
        c.door.rotation.y=state.inspection&&state.doorOpen&&c===target?-Math.PI*.65:0;
        c.tag.visible=!state.inspection||c===target;
      }
      const focus=state.inspection&&target?target.cart.id:'overview';
      if(lastFocus!==focus||lastReset!==state.reset){
        lastFocus=focus;lastReset=state.reset;
        if(state.inspection&&target){
          controls.target.set(target.cart.x,1.02,target.cart.z);camera.position.set(target.cart.x+3.6,3.1,target.cart.z+5.4);camera.zoom=2.4;
        }else{controls.target.set(0,.45,0);camera.position.set(8,10,12);camera.zoom=1;}
        camera.updateProjectionMatrix();controls.update();
      }
      render();
    }
    const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
    let start:{x:number;y:number;id:number}|null=null;
    const down=(e:PointerEvent)=>{if(e.isPrimary&&e.button===0)start={x:e.clientX,y:e.clientY,id:e.pointerId};};
    const pick=(e:PointerEvent)=>{
      const first=start;start=null;if(!first||first.id!==e.pointerId||Math.hypot(e.clientX-first.x,e.clientY-first.y)>5)return;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      ray.setFromCamera(pointer,camera);
      const hit=ray.intersectObjects(carts.map(c=>c.group),true).find(h=>h.object instanceof THREE.Mesh&&h.object.visible);let node:THREE.Object3D|null=hit?.object??null;
      while(node&&!node.userData.cartId)node=node.parent;
      if(node)latest.current.onPick(node.userData.cartId as string);
    };
    const contextLost=(e:Event)=>{e.preventDefault();lost=true;setUnavailable(true);};
    const contextRestored=()=>{lost=false;setUnavailable(false);resize();update();};
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',pick);
    const cancel=()=>{start=null;};canvas.addEventListener('pointercancel',cancel);
    canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
    controls.addEventListener('change',render);
    const observer=new ResizeObserver(resize);observer.observe(root);
    sync.current=update;update();resize();
    return ()=>{
      sync.current=null;observer.disconnect();controls.removeEventListener('change',render);controls.dispose();
      canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',pick);canvas.removeEventListener('pointercancel',cancel);
      canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);
      scene.traverse(obj=>{
        if(obj instanceof THREE.Mesh)obj.geometry.dispose();
        if(obj instanceof THREE.Mesh||obj instanceof THREE.Sprite){
          const materials=Array.isArray(obj.material)?obj.material:[obj.material];
          for(const material of materials){if(material instanceof THREE.SpriteMaterial)material.map?.dispose();material.dispose();}
        }
      });
      renderer.dispose();canvas.remove();
    };
  },[props.quality]);
  useEffect(()=>{sync.current?.();},[props.selectedId,props.inspection,props.doorOpen,props.reset]);
  return <div>
    <div className="dt-stage" ref={rootRef} role="img" aria-label="Sala ilustrativa tridimensional com quatro carrinhos. Use a lista para seleção por teclado."/>
    {unavailable&&<Feedback kind="warning">WebGL indisponível. Continue pela lista de carrinhos abaixo ou desligue a cena.</Feedback>}
  </div>;
}
