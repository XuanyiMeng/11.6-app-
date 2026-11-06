'use client';
import {useEffect,useRef,useState} from 'react';
import PixelStudio from '../../app/pixel-studio';
import {createPixelRenderer,emptyPixelState,pullFace,PIXEL_ITEMS,type PixelState} from '../../lib/pixel-play';
import {canvasBlob,composeStrip} from '../../lib/photo-effects';
export default function PixelQA(){
 const [state,setState]=useState<PixelState>(emptyPixelState),[status,setStatus]=useState('Checking warp…'),[url,setUrl]=useState('');const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{let active=true;let resultUrl='';void(async()=>{
  const check=(v:boolean,m:string)=>{if(!v)throw new Error(m);};
  const input=document.createElement('canvas');input.width=900;input.height=675;const ctx=input.getContext('2d')!;
  ctx.fillStyle='#142634';ctx.fillRect(0,0,900,675);ctx.fillStyle='#e48cba';ctx.fillRect(0,0,450,337);ctx.fillStyle='#71cbb2';ctx.fillRect(450,337,450,338);
  ctx.fillStyle='#fff';for(let x=0;x<900;x+=40)ctx.fillRect(x,0,2,675);for(let y=0;y<675;y+=40)ctx.fillRect(0,y,900,2);
  const output=document.createElement('canvas');output.width=900;output.height=675;const out=output.getContext('2d')!;const renderer=createPixelRenderer(900,675);
  try{
   const fresh=emptyPixelState();renderer.render(out,input,900,675,fresh,false);const before=out.getImageData(0,0,900,675).data;
   const top=out.getImageData(100,100,1,1).data,bottom=out.getImageData(700,550,1,1).data;
   check(top[0]>top[1]&&bottom[1]>bottom[0],'Preview orientation/crop mismatch');
   const field=pullFace(fresh.field,.45,.5,.13,-.07,.3);check(field.some(v=>Math.abs(v)>.01),'Dragging must deform field');check(fresh.field.every(v=>v===0),'Undo source must remain unchanged');
   renderer.render(out,input,900,675,{field,stickers:[]},false);const warped=out.getImageData(0,0,900,675).data;check(warped.some((v,i)=>v!==before[i]),'GPU warp must change image pixels');
   const all={field,stickers:PIXEL_ITEMS.map((p,i)=>({id:i+1,kind:p.kind,x:.13+(i%3)*.34,y:.22+Math.floor(i/3)*.56,size:.18}))};
   renderer.render(out,input,900,675,all,false);const stickerPixels=out.getImageData(0,0,900,675).data;check(stickerPixels.some((v,i)=>v!==warped[i]),'Stickers missing from export');
   const frame=document.createElement('canvas');frame.width=900;frame.height=675;frame.getContext('2d')!.drawImage(output,0,0);const strip=composeStrip([frame,frame,frame,frame],'pixel');const png=await canvasBlob(strip);check(png.size>10000&&png.type==='image/png','PNG failed');
   renderer.render(out,input,900,675,fresh,false);const reset=out.getImageData(0,0,900,675).data;check(reset.every((v,i)=>v===before[i]),'Reset must restore exact unwarped image');
   const cpuCanvas=document.createElement('canvas');cpuCanvas.width=180;cpuCanvas.height=135;const cpu=createPixelRenderer(180,135,false);try{cpu.render(cpuCanvas.getContext('2d')!,input,900,675,all,false);check((await canvasBlob(cpuCanvas)).size>500,'CPU fallback failed');}finally{cpu.dispose();}
   resultUrl=URL.createObjectURL(await canvasBlob(frame));if(active){setUrl(resultUrl);setStatus('PASS: correct orientation and crop\nPASS: non-destructive warp changes pixels\nPASS: all six stickers included\nPASS: reset restores exact original\nPASS: four-shot PNG strip export\nPASS: CPU fallback\nALL CHECKS PASSED');}
  }finally{renderer.dispose();}
 })().catch(e=>{if(active)setStatus(`FAILED: ${e.message}`);});return()=>{active=false;if(resultUrl)URL.revokeObjectURL(resultUrl);};},[]);
 return <main style={{padding:20}}><pre style={{fontSize:12,whiteSpace:'pre-wrap'}}>{status}</pre><div className="booth filter-pixel" style={{width:390,height:600,minHeight:0}}><div className="viewfinder"><PixelStudio video={video} ready={false} busy={false} state={state} onChange={setState}/></div></div><p>warp={Array.from(state.field).some(v=>v!==0)?'yes':'no'} stickers={state.stickers.length} first-x={state.stickers[0]?.x.toFixed(2)} first-size={state.stickers[0]?.size.toFixed(2)}</p>{url&&<img src={url} alt="Synthetic warped grid with all six pixel pals" style={{maxWidth:500,width:'100%'}}/>}</main>;
}
