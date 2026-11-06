import { glitterFill } from './glitter-fill';
export type PhotoCaption = { text: string; x: number; y: number; size: number; color: string };
export const DEFAULT_CAPTION: PhotoCaption = { text: '', x: .5, y: .86, size: .055, color: '#ff58bc' };

export function captionLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g,'').split('\n')) {
    let line='';
    for (const char of Array.from(paragraph)) {
      if (line && ctx.measureText(line+char).width>maxWidth) { lines.push(line);line=char; }
      else line+=char;
    }
    lines.push(line);
  }
  return lines;
}
export function drawPhotoCaption(ctx: CanvasRenderingContext2D, caption: PhotoCaption) {
  if (!caption.text.trim()) return;
  const width=ctx.canvas.width,height=ctx.canvas.height;
  ctx.save();
  const size=width*caption.size;
  ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const lines=captionLines(ctx,caption.text.slice(0,80),width*.88).slice(0,6);
  const lineHeight=size*1.16;
  const x=Math.max(width*.06,Math.min(width*.94,width*caption.x));
  const halfHeight=lines.length*lineHeight/2;
  const y=Math.max(halfHeight+8,Math.min(height-halfHeight-8,height*caption.y));
  ctx.strokeStyle='#10080fee';ctx.lineWidth=Math.max(2,size*.095);
  ctx.fillStyle=glitterFill(ctx,caption.color);ctx.shadowColor='#0009';ctx.shadowBlur=3;ctx.shadowOffsetY=2;
  lines.forEach((line,index)=>{
    const ly=y+(index-(lines.length-1)/2)*lineHeight;
    ctx.strokeText(line,x,ly);ctx.fillText(line,x,ly);
  });
  ctx.restore();
}
