const tiles = new Map<string, HTMLCanvasElement>();
/** Deterministic glitter texture shared by live captions and exported lettering. */
export function glitterFill(ctx: CanvasRenderingContext2D, color = '#ff58bc'): CanvasPattern | string {
  const palette = color === '#ffffff' ? 'silver' : color === '#151015' ? 'dark' : 'pink';
  let tile = tiles.get(palette);
  if (!tile) {
    tile = document.createElement('canvas'); tile.width = 96; tile.height = 96;
    const brush = tile.getContext('2d'); if (!brush) return color;
    const tones = palette === 'silver' ? ['#ffffff','#ddd5e3','#ada0b7','#fbe6f4','#ffffff'] : palette === 'dark' ? ['#151015','#483042','#241622','#78516c','#b67ba2'] : ['#a91465','#ff8bd3','#ee48a7','#ffbfe5','#e72c94','#bf126e'];
    brush.fillStyle = tones[0]; brush.fillRect(0,0,96,96);
    let seed=31247;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<6500;i++) {
      brush.fillStyle=tones[Math.floor(random()*tones.length)];
      const x=random()*96,y=random()*96,size=.35+random()*1.55;
      brush.fillRect(x,y,size,size*.7);
    }
    brush.fillStyle=palette==='dark'?'#d3a4c3':'#fff1fb';
    for(const [x,y]of [[12,23],[68,57],[43,84]]){
      brush.beginPath();brush.moveTo(x,y-2.5);brush.lineTo(x+.6,y-.6);brush.lineTo(x+2.5,y);brush.lineTo(x+.6,y+.6);brush.lineTo(x,y+2.5);brush.lineTo(x-.6,y+.6);brush.lineTo(x-2.5,y);brush.lineTo(x-.6,y-.6);brush.closePath();brush.fill();
    }
    tiles.set(palette,tile);
  }
  return ctx.createPattern(tile,'repeat') ?? color;
}
