// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const MAX_BYTES=20*1024*1024;
const supported=/^image\/(png|jpeg|webp|avif|gif)$/i;
export async function remoteImage(address:string,signal:AbortSignal):Promise<Blob>{
  const response=await fetch(address,{signal,mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});
  // Rejecting headers must also stop the body; clearing the caller timeout is not cancellation.
  if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES){
    await response.body?.cancel();
    throw new Error(!response.ok?`The image server returned ${response.status}. Try uploading the file instead.`:'Use an image smaller than 20 MB.');
  }
  if(!response.body)throw new Error('The image server returned an empty response.');
  const reader=response.body.getReader(),parts:Uint8Array<ArrayBuffer>[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new Error('Use an image smaller than 20 MB.');parts.push(new Uint8Array(value));}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  return new Blob(parts,{type:response.headers.get('content-type')?.split(';')[0]||'application/octet-stream'});
}
export async function decode(blob:Blob):Promise<HTMLCanvasElement>{
  if(blob.size>MAX_BYTES)throw new Error('Use an image smaller than 20 MB.');
  if(!blob.size)throw new Error('This image is empty.');
  // Octet-stream is common on direct image CDNs; the browser decoder still validates it.
  if(!supported.test(blob.type)&&blob.type!==''&&blob.type!=='application/octet-stream')throw new Error('Choose a JPG, PNG, WebP, AVIF or GIF image.');
  const href=URL.createObjectURL(blob),img=new Image();
  try{
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{img.src='';reject(new Error('The image took too long to decode.'));},15000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('This file could not be read as an image.'));};img.src=href;});
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>80000000)throw new Error('This image is too large to process. Use a smaller copy.');
    const factor=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
    const c=canvas.getContext('2d');if(!c)throw new Error('Your browser could not prepare the image.');
    c.fillStyle='#f7f3ea';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);return canvas;
  }finally{img.onload=null;img.onerror=null;URL.revokeObjectURL(href);}
}
