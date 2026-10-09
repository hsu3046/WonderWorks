// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import jsQR from 'jsqr';
import { matrixFor, qrColour } from './state.ts';
// Render a four-module quiet zone and keep decorative petals strictly inside dark cells.
export function qrPixels(url:string,palette:number,cell=24):{data:Uint8ClampedArray;width:number;height:number}{
  const {size,data:modules}=matrixFor(url),width=(size+8)*cell;
  const data=new Uint8ClampedArray(width*width*4);data.fill(255);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(modules[y*size+x]){
    const rgb=qrColour(palette,x,y,size);
    for(let yy=0;yy<cell;yy++)for(let xx=0;xx<cell;xx++){
      const p=(((y+4)*cell+yy)*width+(x+4)*cell+xx)*4;
      const dx=(xx+.5)/cell-.5,dy=(yy+.5)/cell-.5;
      // A low-contrast floral emboss never changes the dark/white module classification.
      const petal=Math.cos(Math.atan2(dy,dx)*5)*.055+.23;
      const relief=Math.abs(Math.hypot(dx,dy)-petal)<.035?12:0;
      for(let c=0;c<3;c++)data[p+c]=rgb[c]!+relief;
    }
  }
  return {data,width,height:width};
}
export function verifyPixels(pixels:{data:Uint8ClampedArray;width:number;height:number},url:string):boolean{return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'})?.data===url;}
