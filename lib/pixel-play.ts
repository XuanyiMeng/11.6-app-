import { drawCover } from './photo-effects';
export const FIELD_W=65, FIELD_H=49;
export type PixelKind='pig'|'cat'|'slime'|'grass'|'mushroom'|'heart';
export type PixelSticker={id:number;kind:PixelKind;x:number;y:number;size:number};
export type PixelState={field:Float32Array;stickers:PixelSticker[]};
export const PIXEL_ITEMS:{kind:PixelKind;name:string}[]=[{kind:'pig',name:'Piggy'},{kind:'cat',name:'Kitty'},{kind:'slime',name:'Slime'},{kind:'grass',name:'Grass block'},{kind:'mushroom',name:'Mushroom'},{kind:'heart',name:'Heart'}];
export const emptyPixelState=():PixelState=>({field:new Float32Array(FIELD_W*FIELD_H*2),stickers:[]});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function fieldAt(field:Float32Array,x:number,y:number,channel:number){
 const gx=clamp(x,0,1)*(FIELD_W-1),gy=clamp(y,0,1)*(FIELD_H-1),ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
 const a=(iy*FIELD_W+ix)*2+channel,b=(iy*FIELD_W+Math.min(ix+1,FIELD_W-1))*2+channel,c=(Math.min(iy+1,FIELD_H-1)*FIELD_W+ix)*2+channel,d=(Math.min(iy+1,FIELD_H-1)*FIELD_W+Math.min(ix+1,FIELD_W-1))*2+channel;
 return (field[a]*(1-fx)+field[b]*fx)*(1-fy)+(field[c]*(1-fx)+field[d]*fx)*fy;
}
/** Inverse-map liquify: compose each drag with the existing deformation. */
export function pullFace(field:Float32Array,x:number,y:number,dx:number,dy:number,radius:number){
 const out=new Float32Array(field);const r=Math.max(.04,radius);
 for(let row=0;row<FIELD_H;row++)for(let col=0;col<FIELD_W;col++){
  const px=col/(FIELD_W-1),py=row/(FIELD_H-1),distance=Math.hypot((px-x)*4/3,py-y)/r;
  if(distance>=1)continue;
  const t=1-distance*distance,weight=t*t;const sx=clamp(px-dx*weight,0,1),sy=clamp(py-dy*weight,0,1),i=(row*FIELD_W+col)*2;
  out[i]=clamp(sx+fieldAt(field,sx,sy,0),0,1)-px;out[i+1]=clamp(sy+fieldAt(field,sx,sy,1),0,1)-py;
 }
 return out;
}
const sprites=new Map<PixelKind,HTMLCanvasElement>();
export function pixelSprite(kind:PixelKind){
 const cached=sprites.get(kind);if(cached)return cached;
 const c=document.createElement('canvas');c.width=32;c.height=32;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const polygon=(points:number[][],color:string)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 if(['pig','cat','slime','grass'].includes(kind)){
  const colors=kind==='pig'?['#fa9cbe','#d9709b','#ffbfd4']:kind==='cat'?['#e5b886','#ad7b57','#f8d4a2']:kind==='slime'?['#80dd75','#43a65a','#b6f890']:['#875b38','#60402c','#78c84b'];
  polygon([[3,10],[12,4],[29,8],[21,14]],colors[2]);polygon([[21,14],[29,8],[29,25],[21,31]],colors[1]);rect(3,10,18,18,colors[0]);
  for(let i=0;i<14;i++){const x=4+(i*7)%16,y=11+(i*11)%15;rect(x,y,2,1,i%2?colors[1]:colors[2]);}
  if(kind==='grass'){rect(3,10,18,5,'#5eb845');rect(3,15,3,3,'#5eb845');rect(12,15,3,2,'#5eb845');polygon([[21,14],[29,8],[29,12],[21,18]],'#398d42');}
  else{
   if(kind==='pig'){rect(3,5,5,6,'#f9adc9');rect(16,5,5,6,'#f9adc9');rect(7,19,11,6,'#ffc5d5');rect(9,21,2,2,'#c86086');rect(14,21,2,2,'#c86086');}
   if(kind==='cat'){rect(3,3,5,8,'#e5b886');rect(16,3,5,8,'#e5b886');rect(4,5,3,4,'#f7a1ba');rect(17,5,3,4,'#f7a1ba');rect(11,21,3,2,'#ad6770');rect(10,24,5,1,'#513e3d');}
   rect(6,15,3,4,'#27302d');rect(16,15,3,4,'#27302d');rect(6,15,1,1,'#fff5e5');rect(16,15,1,1,'#fff5e5');
   if(kind==='slime'){rect(10,22,7,2,'#255e3f');rect(5,21,3,2,'#b4f991');rect(18,21,2,2,'#b4f991');}
  }
 }else if(kind==='heart'){
  const rows=['001110011100','011111111110','111111111111','111111111111','011111111110','001111111100','000111111000','000011110000','000001100000'];
  rows.forEach((row,y)=>Array.from(row).forEach((v,x)=>{if(v==='1')rect(4+x*2,6+y*2,2,2,y>5?'#c7316c':'#fb70ad');}));rect(8,10,4,2,'#ffd6e9');rect(8,12,2,2,'#ffd6e9');
 }else{
  rect(12,17,9,12,'#edd6a9');rect(14,20,3,7,'#fff0c3');rect(5,10,23,10,'#d95877');rect(8,6,17,5,'#ed7594');rect(11,3,11,4,'#ff91ac');rect(9,10,5,4,'#fff0ce');rect(21,12,4,4,'#fff0ce');rect(16,6,3,3,'#fff0ce');rect(6,18,22,3,'#b33b61');rect(13,25,2,2,'#725948');rect(18,25,2,2,'#725948');
 }
 sprites.set(kind,c);return c;
}
export function drawPixelStickers(ctx:CanvasRenderingContext2D,stickers:PixelSticker[]){
 ctx.save();ctx.imageSmoothingEnabled=false;
 for(const sticker of stickers){const side=ctx.canvas.width*sticker.size;ctx.drawImage(pixelSprite(sticker.kind),Math.round(ctx.canvas.width*sticker.x-side/2),Math.round(ctx.canvas.height*sticker.y-side/2),Math.round(side),Math.round(side));}
 ctx.restore();
}
/** CPU fallback, used when WebGL is unavailable. */
function warpCPU(source:HTMLCanvasElement,field:Float32Array,ctx:CanvasRenderingContext2D){
 const w=ctx.canvas.width,h=ctx.canvas.height;const src=source.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,w,h).data,out=ctx.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/Math.max(1,w-1),v=y/Math.max(1,h-1),sx=clamp((u+fieldAt(field,u,v,0))*(w-1),0,w-1),sy=clamp((v+fieldAt(field,u,v,1))*(h-1),0,h-1),ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  const a=(iy*w+ix)*4,b=(iy*w+Math.min(ix+1,w-1))*4,c=(Math.min(iy+1,h-1)*w+ix)*4,d=(Math.min(iy+1,h-1)*w+Math.min(ix+1,w-1))*4,i=(y*w+x)*4;
  for(let channel=0;channel<3;channel++)out.data[i+channel]=(src[a+channel]*(1-fx)+src[b+channel]*fx)*(1-fy)+(src[c+channel]*(1-fx)+src[d+channel]*fx)*fy;
  out.data[i+3]=255;
 }
 ctx.putImageData(out,0,0);
}
export function createPixelRenderer(width:number,height:number,useGPU=true){
 const source=document.createElement('canvas');source.width=width;source.height=height;const sc=source.getContext('2d')!;
 const gpu=document.createElement('canvas');gpu.width=width;gpu.height=height;
 const gl=useGPU?gpu.getContext('webgl',{alpha:false,preserveDrawingBuffer:true}):null;
 let program:WebGLProgram|null=null,videoTex:WebGLTexture|null=null,mapTex:WebGLTexture|null=null;
 const encoded=new Uint8Array(FIELD_W*FIELD_H*4);let lastField:Float32Array|null=null;
 if(gl){
  const compile=(type:number,code:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Shader unavailable');}return s;};
  try{
   const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p,0.,1.);}');
   const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform sampler2D photo;uniform sampler2D field;
   vec2 decode(vec2 cell){vec4 c=texture2D(field,(cell+0.5)/vec2(${FIELD_W}.,${FIELD_H}.));return vec2(c.r*65280.+c.g*255.,c.b*65280.+c.a*255.)/65535.*2.-1.;}
   void main(){vec2 p=vec2(uv.x,1.-uv.y),g=p*vec2(${FIELD_W-1}.,${FIELD_H-1}.),a=floor(g),f=fract(g),b=min(a+1.,vec2(${FIELD_W-1}.,${FIELD_H-1}.));vec2 offset=mix(mix(decode(a),decode(vec2(b.x,a.y)),f.x),mix(decode(vec2(a.x,b.y)),decode(b),f.x),f.y);vec2 s=clamp(p+offset,0.,1.);gl_FragColor=texture2D(photo,vec2(s.x,1.-s.y));}`);
   program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader unavailable');
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   const texture=(unit:number,filter:number)=>{const tex=gl.createTexture();gl.activeTexture(unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tex;};
   videoTex=texture(gl.TEXTURE0,gl.LINEAR);mapTex=texture(gl.TEXTURE1,gl.NEAREST);gl.uniform1i(gl.getUniformLocation(program,'photo'),0);gl.uniform1i(gl.getUniformLocation(program,'field'),1);
  }catch{if(program)gl.deleteProgram(program);program=null;}
 }
 return {
  render(ctx:CanvasRenderingContext2D,input:CanvasImageSource,sw:number,sh:number,state:PixelState,mirror=true){
   sc.clearRect(0,0,width,height);drawCover(sc,input,sw,sh,0,0,width,height,mirror);
   if(gl&&program&&!gl.isContextLost()){
    gl.useProgram(program);gl.viewport(0,0,width,height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,videoTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    if(lastField!==state.field){for(let i=0;i<state.field.length/2;i++){const x=Math.round((clamp(state.field[i*2],-1,1)+1)*32767.5),y=Math.round((clamp(state.field[i*2+1],-1,1)+1)*32767.5);encoded[i*4]=x>>8;encoded[i*4+1]=x&255;encoded[i*4+2]=y>>8;encoded[i*4+3]=y&255;}gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mapTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,FIELD_W,FIELD_H,0,gl.RGBA,gl.UNSIGNED_BYTE,encoded);lastField=state.field;}
    gl.drawArrays(gl.TRIANGLES,0,6);ctx.drawImage(gpu,0,0,ctx.canvas.width,ctx.canvas.height);
   }else warpCPU(source,state.field,ctx);
   drawPixelStickers(ctx,state.stickers);
  },
  dispose(){if(gl){gl.deleteTexture(videoTex);gl.deleteTexture(mapTex);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}}
 };
}
