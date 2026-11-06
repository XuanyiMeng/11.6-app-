'use client';
import { useEffect, useRef, useState } from 'react';
import { cutOutPerson } from '../../lib/person-cutout';
import FriendStudio from '../../app/friend-studio';
import type { FriendCutout } from '../../lib/friend-composite';
import { DEFAULT_CAPTION, drawPhotoCaption } from '../../lib/photo-caption';
import { DEFAULT_PLACEMENT, drawFriendPhoto, harmonizeFriend, sampleLight } from '../../lib/friend-composite';
import { canvasBlob, composeStrip } from '../../lib/photo-effects';
export default function FriendQA() {
  const video=useRef<HTMLVideoElement>(null);
  const [person,setPerson]=useState<FriendCutout|null>(null);
  const [caption,setCaption]=useState({...DEFAULT_CAPTION});
  const [placement,setPlacement]=useState({...DEFAULT_PLACEMENT});
  const [processing,setProcessing]=useState(false);
  const [status,setStatus]=useState('Starting segmentation test…');
  const [images,setImages]=useState<string[]>([]);
  useEffect(()=>{let active=true;const urls:string[]=[];void(async()=>{
    const check=(value:boolean,message:string)=>{if(!value)throw new Error(message);};
    const blob=await(await fetch('/qa-portrait.jpg')).blob();
    const person=await cutOutPerson(new File([blob],'reference-person.jpg',{type:'image/jpeg'}),(text)=>{if(active)setStatus(text);});
    const pixels=person.canvas.getContext('2d')!.getImageData(0,0,person.canvas.width,person.canvas.height).data;
    let transparent=0,opaque=0;
    for(let i=3;i<pixels.length;i+=4){if(pixels[i]<20)transparent++;if(pixels[i]>220)opaque++;}
    check(transparent>100&&opaque>100,'Segmentation needs both transparent background and foreground');
    const background=document.createElement('canvas');background.width=900;background.height=675;
    const ctx=background.getContext('2d')!;
    const gradient=ctx.createLinearGradient(0,0,900,675);gradient.addColorStop(0,'#b7c4d4');gradient.addColorStop(1,'#646c7e');ctx.fillStyle=gradient;ctx.fillRect(0,0,900,675);
    const light=sampleLight(background,900,675);
    const zero=harmonizeFriend(person,light,0);
    const zeroPixels=zero.getContext('2d')!.getImageData(0,0,zero.width,zero.height).data;
    check(pixels.every((v,i)=>v===zeroPixels[i]),'Zero matching should preserve original pixels');
    const matched=harmonizeFriend(person,light,1);
    const mp=matched.getContext('2d')!.getImageData(0,0,matched.width,matched.height).data;
    check(mp.some((v,i)=>i%4!==3&&v!==pixels[i]),'Light matching must change RGB');
    check(mp.every((v,i)=>i%4!==3||v===pixels[i]),'Light matching must preserve alpha');
    const frames=[.25,.45,.65,.8].map((x,index)=>{
      const frame=document.createElement('canvas');frame.width=900;frame.height=675;
      drawFriendPhoto(frame.getContext('2d')!,background,900,675,person,{...DEFAULT_PLACEMENT,x,scale:.65+index*.1,flip:index%2===1});
      return frame;
    });
    const strip=composeStrip(frames,'friend');
    const png=await canvasBlob(strip);
    const captioned=document.createElement('canvas');captioned.width=900;captioned.height=675;
    const cc=captioned.getContext('2d')!;cc.drawImage(frames[2],0,0);
    const before=cc.getImageData(0,0,900,675).data;
    drawPhotoCaption(cc,{...DEFAULT_CAPTION,text:'MISS U ★ 想你了',y:.8});
    const after=cc.getImageData(0,0,900,675).data;
    check(after.some((v,i)=>v!==before[i]),'Caption must be baked into exported pixels');
    check((await canvasBlob(captioned)).type==='image/png','Caption PNG export failed');
    check(png.type==='image/png'&&png.size>10000,'Friend strip must export PNG');
    for(const image of [person.canvas,frames[2],strip])urls.push(URL.createObjectURL(await canvasBlob(image)));
    if(active){setPerson(person);setImages([...urls]);setStatus(`PASS: local person segmentation (${person.canvas.width}×${person.canvas.height})\nPASS: transparent background + foreground\nPASS: strength 0 preserves original; strength 1 adjusts RGB and preserves alpha\nPASS: four positions, scales and flips\nPASS: PNG strip ${strip.width}×${strip.height}, ${png.size} bytes\nPASS: custom multilingual caption changes pixels and exports PNG\nALL CHECKS PASSED`);}
  })().catch(error=>{if(active)setStatus(`FAILED: ${error.message}`);});return()=>{active=false;urls.forEach(URL.revokeObjectURL);};},[]);
  return <main style={{padding:24}}><pre style={{fontSize:12,whiteSpace:'pre-wrap'}}>{status}</pre><div className="booth filter-friend" style={{width:390,height:550,minHeight:0}}><div className="viewfinder"><FriendStudio video={video} ready={false} busy={false} person={person} placement={placement} onPerson={setPerson} onPlacement={setPlacement} onProcessing={setProcessing} caption={caption} onCaption={setCaption}/></div><p style={{fontSize:10}}>x={placement.x.toFixed(2)} y={placement.y.toFixed(2)} scale={placement.scale.toFixed(2)} flip={String(placement.flip)} processing={String(processing)}</p></div><div style={{display:'flex',gap:12,alignItems:'flex-start'}}>{images.map((src,i)=><img key={src} src={src} alt={['Automatic transparent person cutout','Light-matched composite on synthetic background','Four-frame exported friend strip'][i]} style={{width:'30%',background:'#524853',borderRadius:8}}/>)}</div></main>;
}
