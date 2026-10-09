// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import QRCode from 'qrcode';
export const templates = [
  {id:'porcelain',name:'Roses',detail:'Soft roses in glazed porcelain.',short:'01 / ROSES',icon:'♧'},
  {id:'meadow',name:'Daisies',detail:'Airy daisies, a little sunshine.',short:'02 / DAISIES',icon:'✳'},
  {id:'rose',name:'Tulips',detail:'Graceful cups of spring.',short:'03 / TULIPS',icon:'❋'},
  {id:'moon',name:'Dahlias',detail:'A bouquet of sculpted petals.',short:'04 / DAHLIAS',icon:'☾'},
] as const;
export const palettes = [
  {name:'Petal',colours:['#f3a9bd','#e56379','#fff0ce','#b94366','#f3b16c','#d999bd','#ed7657','#fffaf0'],dark:'#815168',qrLight:'#b96f7c',accent:'#c96d77'},
  {name:'Apricot',colours:['#ffc28d','#f19462','#fff1c3','#d96846','#f3ce63','#e78e9c','#bc5d57','#fff4e3'],dark:'#956044',qrLight:'#b77b58',accent:'#ca7855'},
  {name:'Lilac',colours:['#c6b1e9','#9880c4','#f3e6ff','#7555a0','#e89fb9','#f4c6a2','#fff3d7','#bd688a'],dark:'#69577e',qrLight:'#9b78ad',accent:'#9480b4'},
  {name:'Ivory',colours:['#fff5db','#ecd8a8','#ffffff','#d6b976','#e8bfbb','#f4d5a7','#c6ce9f','#fff1e9'],dark:'#536b57',qrLight:'#8b9063',accent:'#a69b73'},
  {name:'Cherry',colours:['#c44356','#a62c46','#fff0db','#df6a70','#e99593','#d65564','#842d44','#f4b6aa'],dark:'#773b4d',qrLight:'#ad5e6a',accent:'#aa4458'},
] as const;
export interface StudioState {url:string;template:number;palette:number;wind:boolean;}
export const defaults = ():StudioState => ({url:'https://www.aib.vote/',template:0,palette:0,wind:true});
export function normalizeUrl(value:string):string {
  const text=value.trim();
  if (!text) throw new Error('Add a link for your flowers to carry.');
  let url:URL;
  try { url=new URL(/^https?:\/\//i.test(text)?text:`https://${text}`); } catch {throw new Error('Enter a complete website address.');}
  if (!['http:','https:'].includes(url.protocol)||!url.hostname.includes('.')||url.username||url.password) throw new Error('Use a public http or https link without login details.');
  if (new TextEncoder().encode(url.href).length>180) throw new Error('Keep your link under 180 bytes for a clearer floral QR.');
  return url.href;
}
export function matrixFor(url:string):{size:number;data:Uint8Array} {
  const code=QRCode.create(normalizeUrl(url),{errorCorrectionLevel:'H'});
  return {size:code.modules.size,data:new Uint8Array(code.modules.data)};
}
export function restore(fragment:string):StudioState {
  const p=new URLSearchParams(fragment.replace(/^#/,''));
  const state=defaults();
  if(p.has('url')) state.url=normalizeUrl(p.get('url')!);
  for(const key of ['template','palette'] as const){const n=Number(p.get(key)??0);if(!Number.isInteger(n)||n<0||n>=(key==='template'?templates.length:palettes.length))throw new Error('This garden link has invalid settings.');state[key]=n;}
  state.wind=p.get('wind')!=='0';return state;
}
export function fragment(state:StudioState):string {return new URLSearchParams({url:normalizeUrl(state.url),template:String(state.template),palette:String(state.palette),wind:state.wind?'1':'0'}).toString();}

// A continuous botanical ink gradient stays dark enough for QR thresholding.
export function qrColour(palette:number,x:number,y:number,size:number):number[] {
  const p=palettes[palette]!,t=(x+y)/Math.max(1,2*(size-1));
  const rgb=[1,3,5].map(i=>Math.round(parseInt(p.dark.slice(i,i+2),16)*(1-t)+parseInt(p.qrLight.slice(i,i+2),16)*t));
  // Leave headroom for the export emboss under local adaptive thresholding.
  const luminance=(77*rgb[0]!+150*rgb[1]!+29*rgb[2]!)/256;
  return rgb.map(c=>Math.round(c*Math.min(1,108/luminance)));
}
