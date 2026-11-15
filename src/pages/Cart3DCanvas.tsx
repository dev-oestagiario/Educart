import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {CartSlot} from '../lib/cartScene';

export default function Cart3DCanvas({slots,onPick}:{slots:CartSlot[];onPick:(position:number)=>void}){
  const rootRef=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const root=rootRef.current;
    if(!root||!slots.length)return;
    setError('');
    let renderer:THREE.WebGLRenderer;
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    }catch{
      setError('A visualização 3D não está disponível neste navegador. Use a lista textual abaixo.');
      return;
    }
    const scene=new THREE.Scene();
    scene.background=new THREE.Color('#f1f6fc');
    const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);
    const camera=new THREE.PerspectiveCamera(47,w/h,0.1,150);
    const cols=Math.min(6,Math.max(1,Math.ceil(Math.sqrt(slots.length))));
    const rows=Math.ceil(slots.length/cols);
    const cartWidth=cols*0.83+0.5;
    const cartDepth=rows*0.78+0.5;
    const maxSpan=Math.max(cartWidth,cartDepth);
    camera.position.set(maxSpan*1.15,Math.max(3.2,maxSpan*.75),maxSpan*1.15);
    camera.lookAt(0,.4,0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
    renderer.setSize(w,h,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);
    const orbit=new OrbitControls(camera,renderer.domElement);
    orbit.enableDamping=true;orbit.dampingFactor=.07;
    orbit.enablePan=false;orbit.minDistance=2.5;orbit.maxDistance=Math.max(14,maxSpan*4);
    orbit.maxPolarAngle=Math.PI*.49;
    const ambient=new THREE.AmbientLight(0xffffff,2.2);scene.add(ambient);
    const mainLight=new THREE.DirectionalLight(0xffffff,1.5);
    mainLight.position.set(4,8,3);scene.add(mainLight);

    const makeBox=(width:number,height:number,depth:number,color:number,x:number,y:number,z:number)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.15}));
      mesh.position.set(x,y,z);scene.add(mesh);return mesh;
    };
    makeBox(cartWidth,.16,cartDepth,0x244765,0,.18,0);
    const legX=cartWidth/2-.13,legZ=cartDepth/2-.13;
    for(const x of [-legX,legX])for(const z of [-legZ,legZ]){
      makeBox(.11,.55,.11,0x163750,x,.4,z);
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.09,12),
        new THREE.MeshStandardMaterial({color:0x172638}));
      wheel.rotation.z=Math.PI/2;
      wheel.position.set(x,.10,z);scene.add(wheel);
    }
    const touchTargets:THREE.Mesh[]=[];
    slots.forEach((slot,index)=>{
      const col=index%cols,row=Math.floor(index/cols);
      const x=(col-(cols-1)/2)*.83;
      const z=(row-(rows-1)/2)*.78;
      const color=slot.reserved?0xe2a15b:0x51a4a1;
      const lid=makeBox(.65,.10,.53,color,x,.40,z);
      lid.userData.position=slot.position;
      touchTargets.push(lid);
      makeBox(.58,.025,.035,0x243b56,x,.48,z-.21);
    });

    const ground=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(14,cartWidth*2),Math.max(14,cartDepth*2)),
      new THREE.MeshStandardMaterial({color:0xe7eef7,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.10;scene.add(ground);
    const raycaster=new THREE.Raycaster();
    const mouse=new THREE.Vector2();
    function handlePick(event:PointerEvent){
      const box=renderer.domElement.getBoundingClientRect();
      mouse.x=((event.clientX-box.left)/box.width)*2-1;
      mouse.y=-((event.clientY-box.top)/box.height)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const hit=raycaster.intersectObjects(touchTargets)[0];
      if(hit&&typeof hit.object.userData.position==='number')onPick(hit.object.userData.position);
    }
    renderer.domElement.addEventListener('pointerup',handlePick);
    let raf=0;
    const animate=()=>{
      raf=window.requestAnimationFrame(animate);
      orbit.update();renderer.render(scene,camera);
    };
    animate();
    const resize=()=>{
      if(!root.clientWidth||!root.clientHeight)return;
      camera.aspect=root.clientWidth/root.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(root.clientWidth,root.clientHeight,false);
    };
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
    observer?.observe(root);
    window.addEventListener('resize',resize);
    return ()=>{
      window.cancelAnimationFrame(raf);
      observer?.disconnect();window.removeEventListener('resize',resize);
      renderer.domElement.removeEventListener('pointerup',handlePick);
      orbit.dispose();
      scene.traverse(obj=>{
        if(obj instanceof THREE.Mesh){
          obj.geometry.dispose();
          const materials=Array.isArray(obj.material)?obj.material:[obj.material];
          materials.forEach(mat=>mat.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  },[slots,onPick]);
  return <div className="cart-scene">
    <div ref={rootRef} className="cart-scene-canvas" role="img" aria-label="Representação 3D interativa do carrinho de notebooks; lista equivalente logo abaixo"/>
    {error&&<p className="notice error" role="status">{error}</p>}
    <p className="form-hint">Arraste para girar, use a roda do mouse ou gesto de pinça para aproximar e toque numa posição para consultar detalhes. A disposição é ilustrativa.</p>
  </div>;
}
