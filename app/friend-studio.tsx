'use client';
import { useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { DEFAULT_PLACEMENT, drawFriend, friendBounds, harmonizeFriend, sampleLight, type FriendCutout, type FriendPlacement } from '../lib/friend-composite';
import { drawPhotoCaption, type PhotoCaption } from '../lib/photo-caption';
import { drawCover } from '../lib/photo-effects';

type Props = { video: RefObject<HTMLVideoElement | null>; ready: boolean; busy: boolean; person: FriendCutout | null; placement: FriendPlacement; onPerson: (person: FriendCutout | null) => void; onPlacement: (placement: FriendPlacement) => void; onProcessing: (processing: boolean) => void; caption: PhotoCaption; onCaption: (caption: PhotoCaption) => void };
export default function FriendStudio(props: Props) {
  const latest = useRef(props); latest.current = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const captionDrag = useRef<{x:number;y:number;caption:PhotoCaption} | null>(null);
  const [captionOptions, setCaptionOptions] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const pointers = useRef(new Map<number,{x:number;y:number}>());
  const gesture = useRef<{x:number;y:number;distance:number;placement:FriendPlacement;resize:boolean} | null>(null);

  useEffect(() => {
    let animation = 0, last = 0, litAt = -Infinity;
    let matched: HTMLCanvasElement | undefined, previous: FriendCutout | null = null, match = -1;
    function paint(time: number) {
      const p = latest.current;
      const ctx = canvas.current?.getContext('2d');
      const video = p.video.current;
      if (ctx && time-last > 40) {
        ctx.fillStyle='#292724'; ctx.fillRect(0,0,900,675);
        if (p.ready && video && video.readyState >= 2) drawCover(ctx,video,video.videoWidth,video.videoHeight,0,0,900,675,true);
        if (p.person) {
          if (p.person !== previous || match !== p.placement.match || time-litAt > 700) {
            matched = p.ready ? harmonizeFriend(p.person,sampleLight(ctx.canvas,900,675),p.placement.match) : p.person.canvas;
            previous=p.person;match=p.placement.match;litAt=time;
          }
          drawFriend(ctx,p.person,p.placement,matched);
        }
        drawPhotoCaption(ctx,p.caption);
        last=time;
      }
      animation=requestAnimationFrame(paint);
    }
    animation=requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(animation); operation.current++; latest.current.onProcessing(false); };
  }, []);

  async function upload(file?: File) {
    if(!file || props.busy) return;
    const token=++operation.current;
    setProcessing(true);props.onProcessing(true);setError('');
    try {
      const { cutOutPerson } = await import('../lib/person-cutout');
      const person=await cutOutPerson(file,(text)=>{if(token===operation.current)setStatus(text);});
      if(token!==operation.current)return;
      props.onPerson(person);props.onPlacement({...DEFAULT_PLACEMENT});setStatus('Your person is ready. Drag them a little closer.');
    } catch(error) {
      if(token===operation.current)setError(error instanceof Error?error.message:'The cutout failed. Please try again.');
    } finally {
      if(token===operation.current){setProcessing(false);props.onProcessing(false);}
      if(input.current) input.current.value='';
    }
  }
  function base(resize=false) {
    const points=[...pointers.current.values()];
    if(!points.length){gesture.current=null;return;}
    const x=points.reduce((sum,p)=>sum+p.x,0)/points.length;
    const y=points.reduce((sum,p)=>sum+p.y,0)/points.length;
    const distance=points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):1;
    gesture.current={x,y,distance,placement:latest.current.placement,resize};
  }
  function down(event:PointerEvent<HTMLDivElement>) {
    if(!props.person||props.busy||processing)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    base((event.target as HTMLElement).closest('[data-resize]')!==null);
  }
  function move(event:PointerEvent<HTMLDivElement>) {
    const g=gesture.current,rect=stage.current?.getBoundingClientRect();
    if(!g||!rect||!pointers.current.has(event.pointerId)||props.busy)return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...pointers.current.values()];
    const x=points.reduce((sum,p)=>sum+p.x,0)/points.length;
    const y=points.reduce((sum,p)=>sum+p.y,0)/points.length;
    const scale=g.resize?g.placement.scale+(x-g.x)/rect.width*2:points.length>1?g.placement.scale*Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)/Math.max(1,g.distance):g.placement.scale;
    props.onPlacement({...g.placement,x:Math.max(-.3,Math.min(1.3,g.placement.x+(g.resize?0:(x-g.x)/rect.width))),y:Math.max(-.3,Math.min(1.3,g.placement.y+(g.resize?0:(y-g.y)/rect.height))),scale:Math.max(.2,Math.min(1.8,scale))});
  }
  function up(event:PointerEvent<HTMLDivElement>) { pointers.current.delete(event.pointerId);base(); }
  const bounds=props.person?friendBounds(props.person,props.placement,100,100):null;
  // CSS percentages use the real 4:3 stage ratio for the portrait's width.
  const width=props.person?props.placement.scale*100*.75*props.person.canvas.width/props.person.canvas.height:0;
  return <div className={`friend-studio ${captionOptions ? 'caption-options-open' : ''}`}>
    <div className={`friend-stage ${props.busy?'locked':''}`} ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} tabIndex={props.person?0:-1} role="group" aria-label="Photo frame. Drag to move, pinch to resize, or use arrow keys and plus or minus." onKeyDown={(event)=>{
      if(!props.person||props.busy)return;
      const p={...props.placement};
      if(event.key==='ArrowLeft')p.x-=.02;else if(event.key==='ArrowRight')p.x+=.02;else if(event.key==='ArrowUp')p.y-=.02;else if(event.key==='ArrowDown')p.y+=.02;else if(event.key==='+'||event.key==='=')p.scale=Math.min(1.8,p.scale+.05);else if(event.key==='-')p.scale=Math.max(.2,p.scale-.05);else return;
      event.preventDefault();props.onPlacement(p);
    }}>
      <canvas ref={canvas} width={900} height={675} aria-label="Live photo preview with your long-distance friend"/>
      {props.person&&bounds&&!props.busy&&<div className="friend-selection" style={{left:`${props.placement.x*100-width/2}%`,top:`${props.placement.y*100-props.placement.scale*50}%`,width:`${width}%`,height:`${props.placement.scale*100}%`}}><span className="friend-resize" data-resize aria-hidden="true"><span className="glitter-text">↘</span></span></div>}
      {!props.person&&!processing&&<button className="friend-empty" disabled={props.busy} onPointerDown={(e)=>e.stopPropagation()} onClick={()=>input.current?.click()}><span className="friend-heart"><span className="glitter-text">♡</span></span><strong><span className="glitter-text">miss u bitch</span></strong><span><span className="glitter-text">YOUR PERSON. RIGHT BESIDE YOU.</span></span><span className="friend-upload-pill"><span className="glitter-text">+ Add your person</span></span></button>}
      {props.caption.text.trim()&&!props.busy&&<button className="caption-move" aria-label="Move caption by dragging or using arrow keys" style={{left:`${props.caption.x*100}%`,top:`${props.caption.y*100}%`}} onPointerDown={(event)=>{event.stopPropagation();event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);captionDrag.current={x:event.clientX,y:event.clientY,caption:{...props.caption}};}} onPointerMove={(event)=>{event.stopPropagation();const start=captionDrag.current,rect=stage.current?.getBoundingClientRect();if(!start||!rect)return;props.onCaption({...start.caption,x:Math.max(.06,Math.min(.94,start.caption.x+(event.clientX-start.x)/rect.width)),y:Math.max(.08,Math.min(.92,start.caption.y+(event.clientY-start.y)/rect.height))});}} onPointerUp={(event)=>{event.stopPropagation();captionDrag.current=null;}} onPointerCancel={()=>{captionDrag.current=null;}} onKeyDown={(event)=>{event.stopPropagation();const c={...props.caption};if(event.key==='ArrowLeft')c.x=Math.max(.06,c.x-.02);else if(event.key==='ArrowRight')c.x=Math.min(.94,c.x+.02);else if(event.key==='ArrowUp')c.y=Math.max(.08,c.y-.02);else if(event.key==='ArrowDown')c.y=Math.min(.92,c.y+.02);else return;event.preventDefault();props.onCaption(c);}}><span className="glitter-text">✥ TEXT</span></button>}
      {processing&&<div className="friend-progress" role="status"><span className="friend-spinner"/><span><span className="glitter-text">{status}</span></span><button onClick={()=>{operation.current++;setProcessing(false);props.onProcessing(false);setStatus('');}}><span className="glitter-text">Cancel</span></button></div>}
    </div>
    <input className="sr-only" tabIndex={-1} ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label="Choose a photo of your person" disabled={props.busy||processing} onChange={(event)=>void upload(event.target.files?.[0])}/>
    {props.person?<div className="friend-tools">
      <div className="friend-tool-row"><span><span className="glitter-text">DRAG · PINCH TO RESIZE</span></span><button disabled={props.busy||processing} onClick={()=>input.current?.click()}><span className="glitter-text">Replace</span></button><button disabled={props.busy} onClick={()=>props.onPlacement({...props.placement,flip:!props.placement.flip})}><span className="glitter-text">Flip</span></button><button disabled={props.busy} onClick={()=>props.onPlacement({...DEFAULT_PLACEMENT})}><span className="glitter-text">Reset</span></button><button aria-label="Remove your person" disabled={props.busy||processing} onClick={()=>{props.onPerson(null);setError('');}}><span className="glitter-text">×</span></button></div>
      <label><span className="glitter-text">Person size</span><input type="range" aria-label="Person size" min="20" max="180" value={Math.round(props.placement.scale*100)} disabled={props.busy} onChange={(e)=>props.onPlacement({...props.placement,scale:Number(e.target.value)/100})}/><span><span className="glitter-text">{Math.round(props.placement.scale*100)}</span><span className="glitter-text">%</span></span></label>
      <label><span className="glitter-text">Light blend</span><input type="range" aria-label="Light matching strength" min="0" max="100" value={Math.round(props.placement.match*100)} disabled={props.busy} onChange={(e)=>props.onPlacement({...props.placement,match:Number(e.target.value)/100})}/><span><span className="glitter-text">{Math.round(props.placement.match*100)}</span><span className="glitter-text">%</span></span></label>
    </div>:<p className="friend-upload-note"><span className="glitter-text">CLEAR PORTRAIT · AUTO CUTOUT · ON YOUR DEVICE</span></p>}
    <div className="caption-tools">
      <div className="caption-input-row"><span aria-hidden="true"><span className="glitter-text">Tt</span></span><input aria-label="Photo caption" type="text" maxLength={80} placeholder="Say something to your person…" value={props.caption.text} disabled={props.busy} onChange={(e)=>props.onCaption({...props.caption,text:e.target.value})}/><button aria-label="Caption style" aria-expanded={captionOptions} disabled={props.busy} onClick={()=>setCaptionOptions(!captionOptions)}><span className="glitter-text">Style </span><span className="glitter-text">{captionOptions?'−':'＋'}</span></button></div>
      {captionOptions&&<div className="caption-style-row"><label><span className="glitter-text">Size</span><input aria-label="Caption size" type="range" min="3" max="11" step=".5" value={props.caption.size*100} disabled={props.busy} onChange={(e)=>props.onCaption({...props.caption,size:Number(e.target.value)/100})}/></label><div role="group" aria-label="Caption color">{['#ff58bc','#ffffff','#151015'].map((color)=><button key={color} aria-label={color==='#ff58bc'?'Pink glitter':color==='#ffffff'?'Silver glitter':'Dark glitter'} aria-pressed={props.caption.color===color} disabled={props.busy} style={{background:color}} onClick={()=>props.onCaption({...props.caption,color})}/>)}</div></div>}
      {props.caption.text&&<span className="caption-hint"><span className="glitter-text">DRAG ✥ TEXT TO MOVE · INCLUDED IN YOUR SAVED PHOTO</span></span>}
    </div>
    {error&&<p className="friend-error" role="alert"><span className="glitter-text">{error}</span> <button onClick={()=>input.current?.click()}><span className="glitter-text">Choose another</span></button></p>}
  </div>;
}
