import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
function makeAsset(kind) {
 const doc={asset:{version:"2.0",generator:"Educart original model generator v1",extras:{illustrative:true,units:"m",up:"Y"}},scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[]};
 const bytes=[]; const meshes=new Map();
 const append=(values,component,type,min,max)=>{
  while(bytes.length%4)bytes.push(0);
  const offset=bytes.length;
  const arr=component===5126?new Float32Array(values):new Uint16Array(values);
  const view=new DataView(new ArrayBuffer(arr.length*(component===5126?4:2)));
  arr.forEach((v,i)=>component===5126?view.setFloat32(i*4,v,true):view.setUint16(i*2,v,true));
  bytes.push(...new Uint8Array(view.buffer));
  const bv=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:view.byteLength,target:component===5126?34962:34963})-1;
  return doc.accessors.push({bufferView:bv,componentType:component,count:values.length/(type==="VEC3"?3:1),type,...(min?{min,max}: {})})-1;
 };
 const geom=(shape)=>{
  const pos=[],norm=[],idx=[];
  const face=(points,n)=>{const j=pos.length/3;for(const p of points){pos.push(...p);norm.push(...n)}idx.push(j,j+1,j+2,j,j+2,j+3)};
  if(shape==="box"){
   face([[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],[1,0,0]);
   face([[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],[-1,0,0]);
   face([[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],[0,1,0]);
   face([[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],[0,-1,0]);
   face([[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[0,0,1]);
   face([[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[0,0,-1]);
  } else {
   const n=12;
   for(let i=0;i<n;i++){
    const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
    const x=.5*Math.cos(a),z=.5*Math.sin(a),X=.5*Math.cos(b),Z=.5*Math.sin(b),mid=(a+b)/2;
    face([[x,-.5,z],[x,.5,z],[X,.5,Z],[X,-.5,Z]],[Math.cos(mid),0,Math.sin(mid)]);
    for(const sign of [1,-1]){const j=pos.length/3,p=[0,.5*sign,0],q=[x,.5*sign,z],r=[X,.5*sign,Z];for(const v of sign===1?[p,r,q]:[p,q,r]){pos.push(...v);norm.push(0,sign,0)}idx.push(j,j+1,j+2)}
   }
  }
  return {POSITION:append(pos,5126,"VEC3",[-.5,-.5,-.5],[.5,.5,.5]),NORMAL:append(norm,5126,"VEC3"),indices:append(idx,5123,"SCALAR")};
 };
 const boxGeom=geom("box"),cylGeom=geom("cylinder");
 function mat(name,hex,metal=0,rough=.7){const srgb=c=>{const x=c/255;return +(x<=.04045?x/12.92:((x+.055)/1.055)**2.4).toFixed(6)};return doc.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[srgb((hex>>16)&255),srgb((hex>>8)&255),srgb(hex&255),1],metallicFactor:metal,roughnessFactor:rough}})-1}
 const metal=mat("powder-coated-steel",0xadb9c4,.35,.55),dark=mat("graphite",0x374151,.25,.63),rubber=mat("rubber",0x26272b,0,.95),panel=mat("blue-gray-panel",0x586c80,.35,.56),chrome=mat("brushed-metal",0xcdd3d9,.65,.38),cable=mat("insulated-cable",0x262b33,0,.83),screen=mat("display",0x26384b,.1,.36),keys=mat("keys",0x333b45,0,.85),wall=mat("wall-neutral",0xb8bec7,0,.88),floor=mat("floor",0x737b90,0,.9),wood=mat("wood-laminate",0xb6a08a,0,.75),trim=mat("wall-trim",0x8993a1,0,.82),white=mat("pale-label",0xe2e8ef,0,.75);
 const group=(name,parent,t)=>{const i=doc.nodes.push({name,...(t?{translation:t}:{}),children:[]})-1;if(parent!==null)doc.nodes[parent].children.push(i);return i};
 const root=group(kind+"-illustrative-v1",null);
 const part=(name,parent,material,t,s,shape="box",rotation)=>{
  const k=shape+":"+material;let m=meshes.get(k);
  if(m===undefined){const g=shape==="box"?boxGeom:cylGeom;m=doc.meshes.push({name:k,primitives:[{attributes:{POSITION:g.POSITION,NORMAL:g.NORMAL},indices:g.indices,material}]})-1;meshes.set(k,m)}
  const i=doc.nodes.push({name,mesh:m,translation:t,scale:s,...(rotation?{rotation}: {})})-1;doc.nodes[parent].children.push(i);return i
 };
 const b=(name,p,m,x,y,z,w,h,d)=>part(name,p,m,[x,y,z],[w,h,d]);
 if(kind==="cart"){
  b("base",root,metal,0,.23,0,1.24,.10,.83);b("top",root,metal,0,1.82,0,1.24,.08,.83);
  for(const side of [-1,1]){b("side-"+side,root,panel,side*.595,1.02,0,.05,1.5,.81);for(const z of [-.38,.38])b("upright-"+side+"-"+z,root,chrome,side*.59,1.03,z,.045,1.49,.045)}
  b("back",root,dark,0,1.025,-.39,1.14,1.48,.045);
  for(let tier=0;tier<3;tier++){
   const y=.33+tier*.48;
   b("shelf-"+tier,root,metal,0,y,0,1.12,.045,.72);
   for(let i=0;i<11;i++)b("divider-"+tier+"-"+i,root,chrome,-.55+i*.11,y+.075,.03,.012,.13,.60);
   b("charging-rail-"+tier,root,dark,0,y+.26,-.33,1.08,.065,.045);
   for(let i=0;i<10;i++){
    const x=-.495+i*.11;
    const slot=group("illustrative-slot-"+String(tier*10+i+1).padStart(2,"0"),root,[x,y+.024,.035]);
    doc.nodes[slot].extras={illustrative:true,slotKey:"illustrative-"+String(tier*10+i+1).padStart(2,"0"),notPhysicalBinding:true};
    b("connector-"+tier+"-"+i,root,chrome,x,y+.255,-.30,.038,.028,.028);
    b("cable-"+tier+"-"+i,root,cable,x,y+.11,-.30,.012,.27,.012);
   }
  }
  const door=group("door-hinge",root,[-.59,0,.405]);
  b("door-panel",door,panel,.59,1.035,0,1.17,1.46,.045);
  for(const side of [-1,1])for(let i=0;i<7;i++)b("vent-"+side+"-"+i,door,dark,.59+side*.26,1.48-i*.065,.029,.43,.018,.012);
  b("handle",door,chrome,1.07,1.03,.062,.055,.29,.06);
  b("badge",door,white,.4,1.69,.03,.2,.065,.012);
  for(const y of [.46,1.57])part("hinge-"+y,root,chrome,[-.595,y,.409],[.055,.16,.055],"cylinder");
  for(const x of [-.47,.47])for(const z of [-.28,.28]){
   b("caster-bracket-"+x+"-"+z,root,chrome,x,.18,z,.095,.12,.095);
   part("wheel-"+x+"-"+z,root,rubber,[x,.10,z],[.20,.075,.20],"cylinder",[0,0,.7071067812,.7071067812]);
   part("hub-"+x+"-"+z,root,chrome,[x,.10,z],[.075,.082,.075],"cylinder",[0,0,.7071067812,.7071067812]);
   b("brake-"+x+"-"+z,root,dark,x,.17,z+.09,.09,.035,.07);
  }
 }else if(kind==="notebook"){
  // Vertical storage orientation, hinge at rear; reference only, no assignment.
  b("bottom-shell",root,dark,0,.158,0,.042,.316,.49);
  b("lid",root,metal,.034,.158,0,.028,.316,.49);
  b("keyboard",root,keys,.024,.184,-.018,.008,.19,.37);
  b("trackpad",root,chrome,.024,.062,.028,.009,.08,.17);
  b("display-panel",root,screen,.018,.158,0,.008,.274,.445);
  b("hinge",root,chrome,.012,.158,-.243,.07,.26,.021);
  for(let i=0;i<3;i++)b("port-"+i,root,rubber,-.023,.06+i*.044,.13,.009,.023,.045);
 }else if(kind==="room"){
  b("floor",root,floor,0,-.065,0,8,.13,6);
  for(let x=-3;x<=3;x++)b("tile-x-"+x,root,trim,x,.001,0,.012,.004,6);
  for(let z=-2;z<=2;z++)b("tile-z-"+z,root,trim,0,.001,z,8,.004,.012);
  b("rear-wall-left",root,wall,-1.6,.34,-2.94,4.8,.68,.12);
  b("rear-wall-right",root,wall,2.95,.34,-2.94,2.1,.68,.12);
  b("left-wall",root,wall,-3.94,.34,0,.12,.68,6);
  b("baseboard-back",root,trim,0,.055,-2.867,8,.11,.018);
  b("baseboard-left",root,trim,-3.867,.055,0,.018,.11,6);
  const door=group("illustrative-door-frame",root,[1.08,0,-2.94]);
  b("jamb-left",door,wood,-.43,.34,0,.07,.68,.13);b("jamb-right",door,wood,.43,.34,0,.07,.68,.13);
  b("door-leaf-cutaway",door,wood,0,.33,0,.82,.66,.075);b("door-handle",door,chrome,.30,.45,.06,.08,.025,.045);
  const furniture=group("illustrative-furniture-unplaced",root);
  b("desk-top",furniture,wood,-2.4,.76,-1.95,1.65,.075,.8);
  for(const x of [-3.1,-1.7])for(const z of [-2.23,-1.67])b("desk-leg-"+x+"-"+z,furniture,dark,x,.36,z,.055,.72,.055);
  b("monitor",furniture,screen,-2.4,1.10,-2.17,.58,.36,.055);b("stand",furniture,chrome,-2.4,.87,-2.17,.08,.20,.08);
  b("cabinet",furniture,panel,-3.05,.63,.9,1.35,1.26,.55);
  for(const x of [-3.4,-2.7])b("cabinet-handle-"+x,furniture,chrome,x,.7,1.20,.045,.16,.055);
 }else throw Error("Unknown asset");
 for(const n of doc.nodes)if(n.children?.length===0)delete n.children;
 while(bytes.length%4)bytes.push(0);
 doc.buffers.push({byteLength:bytes.length});
 const str=JSON.stringify(doc),json=Array.from(str,c=>c.charCodeAt(0));if(json.some(v=>v>127))throw Error("non ascii");
 while(json.length%4)json.push(32);
 const out=new Uint8Array(12+8+json.length+8+bytes.length),v=new DataView(out.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);out.set(json,20);v.setUint32(20+json.length,bytes.length,true);v.setUint32(24+json.length,0x004e4942,true);out.set(bytes,28+json.length);
 return out;
}
const dir=fileURLToPath(new URL('../src/features/digitalTwin/assets/',import.meta.url));
const manifest=JSON.parse(readFileSync(path.join(dir,'manifest.json'),'utf8'));
for(const [kind,asset] of Object.entries(manifest.assets)){
 const bytes=makeAsset(kind),hash=createHash('sha256').update(bytes).digest('hex');
 if(hash!==asset.sha256||bytes.length!==asset.bytes)throw Error('Manifest mismatch: '+kind);
 if(process.argv.includes('--check')){if(!Buffer.from(bytes).equals(readFileSync(path.join(dir,asset.file))))throw Error('Asset differs: '+kind);}
 else writeFileSync(path.join(dir,asset.file),bytes);
 console.log(kind,bytes.length,hash);
}
