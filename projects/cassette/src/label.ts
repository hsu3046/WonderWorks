// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
/** Original label artwork drawn with Canvas 2D. No image assets; the cosmic scene is procedural and seeded. */
export const LABEL_WIDTH=1120,LABEL_HEIGHT=600;
/** Label rectangle in scene units: x, y of the lower-left corner, then width and height. */
export const LABEL_RECT:[number,number,number,number]=[-1.86,-.8,3.72,1.99];
/** Window and hub openings, in scene units, shared by the shell, the label and the slip sheet. */
export const WINDOW={x:0,y:.12,width:2.72,height:.84,radius:.12};
export const HUB={x:.86,y:.12,radius:.31};
function seeded(seed:number){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
export function canvas(width:number,height:number):HTMLCanvasElement{const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
export function context(c:HTMLCanvasElement):CanvasRenderingContext2D{const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas 2D is unavailable.');return ctx;}
function star(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,inner:number){
 ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,d=i%2?inner:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fill();
}
function cloud(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number){
 ctx.beginPath();
 for(const [dx,dy,r] of [[0,0,46],[-52,12,32],[48,10,36],[-20,-24,34],[26,-22,30],[80,22,24],[-84,24,22]])ctx.moveTo(x+dx*scale+r*scale,y+dy*scale),ctx.arc(x+dx*scale,y+dy*scale,r*scale,0,Math.PI*2);
 ctx.fill();
}
/** Draw the complete front label for one title. Sized for a 1120×600 texture. */
export function drawLabel(title:string):HTMLCanvasElement{
 const c=canvas(LABEL_WIDTH,LABEL_HEIGHT),ctx=context(c),W=LABEL_WIDTH,H=LABEL_HEIGHT,random=seeded(20261014);
 const sky=ctx.createLinearGradient(0,0,W,H);
 sky.addColorStop(0,'#ff7cc6');sky.addColorStop(.38,'#ec58b6');sky.addColorStop(.7,'#a365e4');sky.addColorStop(1,'#5a78f0');
 ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W*.5,H*.42,10,W*.5,H*.42,W*.62);
 glow.addColorStop(0,'rgba(255,255,255,.18)');glow.addColorStop(.5,'rgba(255,214,243,.08)');glow.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Fine halftone dots keep the print feeling flat rather than photographic.
 ctx.fillStyle='rgba(255,255,255,.14)';
 for(let y=14;y<H;y+=22)for(let x=14;x<W;x+=22)ctx.beginPath(),ctx.arc(x,y,1.3,0,Math.PI*2),ctx.fill();
 // Distant stars and sparkles.
 for(let i=0;i<70;i++){const x=random()*W,y=random()*H,r=1+random()*2.2;ctx.fillStyle=`rgba(255,255,255,${.45+random()*.5})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 for(let i=0;i<16;i++){const x=random()*W,y=random()*H,r=7+random()*16;ctx.fillStyle=`rgba(255,255,255,${.6+random()*.4})`;star(ctx,x,y,r,r*.32);}
 // Ringed planet, upper right.
 const px=W*.86,py=H*.2;
 ctx.save();ctx.translate(px,py);ctx.rotate(-.35);
 ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,96,24,0,Math.PI*.98,Math.PI*2.02);ctx.stroke();
 const body=ctx.createRadialGradient(-14,-14,6,0,0,46);body.addColorStop(0,'#fff5fb');body.addColorStop(.6,'#ffd0ec');body.addColorStop(1,'#d78de0');
 ctx.fillStyle=body;ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,96,24,0,Math.PI*.02,Math.PI*.98);ctx.stroke();
 ctx.restore();
 // Small moon, upper left.
 ctx.fillStyle='#fff3fb';ctx.beginPath();ctx.arc(W*.1,H*.17,26,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f29ad2';ctx.beginPath();ctx.arc(W*.1+12,H*.17-6,22,0,Math.PI*2);ctx.fill();
 // Clouds anchored along the bottom edge, in front of everything behind the window.
 ctx.fillStyle='rgba(255,255,255,.96)';cloud(ctx,W*.16,H*.86,1.05);cloud(ctx,W*.84,H*.9,.95);
 ctx.fillStyle='rgba(255,255,255,.8)';cloud(ctx,W*.5,H*.98,1.2);
 // Title.
 ctx.textAlign='center';ctx.textBaseline='middle';
 const size=title.length>14?78:title.length>10?92:104;
 ctx.font=`italic 700 ${size}px "Apple Chancery","Snell Roundhand","Brush Script MT","Georgia",serif`;
 ctx.shadowColor='rgba(146,52,140,.55)';ctx.shadowBlur=18;ctx.shadowOffsetY=6;
 ctx.fillStyle='#ffffff';ctx.fillText(title,W*.5,H*.165);
 ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.font='600 19px "DM Sans","Helvetica Neue",Arial,sans-serif';ctx.fillStyle='rgba(255,255,255,.9)';
 ctx.letterSpacing='6px';ctx.fillText('SIDE A  ·  STEREO  ·  60 MIN',W*.5,H*.292);
 // Track lines below the window.
 ctx.letterSpacing='0px';ctx.textAlign='left';ctx.font='500 18px "DM Sans","Helvetica Neue",Arial,sans-serif';
 const tracks=['1. Orbit of Two','2. Paper Moon Drive','3. Velvet Nebula','4. Quiet Satellites'];
 tracks.forEach((name,i)=>{const col=i<2?W*.09:W*.55,row=H*.79+(i%2)*H*.082;ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillText(name,col,row);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(col+ctx.measureText(name).width+12,row+6);ctx.lineTo(col+W*.33,row+6);ctx.stroke();ctx.setLineDash([]);});
 // Side badge.
 ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(W*.5,H*.84,32,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d64fa8';ctx.textAlign='center';ctx.font='800 40px "DM Sans","Helvetica Neue",Arial,sans-serif';ctx.fillText('A',W*.5,H*.84+2);
 ctx.font='500 13px "DM Sans","Helvetica Neue",Arial,sans-serif';ctx.fillStyle='rgba(255,255,255,.75)';ctx.letterSpacing='3px';ctx.fillText('WONDERWORKS · STUDY 015',W*.5,H*.955);
 return c;
}
/** Soft contact shadow texture for the floor. */
export function drawShadow():HTMLCanvasElement{
 const c=canvas(256,256),ctx=context(c),g=ctx.createRadialGradient(128,128,10,128,128,126);
 g.addColorStop(0,'rgba(60,20,50,.55)');g.addColorStop(.45,'rgba(60,20,50,.22)');g.addColorStop(1,'rgba(60,20,50,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,256,256);return c;
}
/** Round "B" badge for the back shell. */
export function drawBadge(color:string):HTMLCanvasElement{
 const c=canvas(128,128),ctx=context(c);
 ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.arc(64,64,60,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 70px "DM Sans","Helvetica Neue",Arial,sans-serif';ctx.fillText('B',64,68);return c;
}
/** Concentric grooves for the tape-pack faces. */
export function drawPackFace():HTMLCanvasElement{
 const c=canvas(256,256),ctx=context(c);
 ctx.fillStyle='#3b2117';ctx.fillRect(0,0,256,256);
 for(let r=4;r<130;r+=3){ctx.strokeStyle=r%2?'rgba(120,70,50,.55)':'rgba(20,10,8,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(128,128,r,0,Math.PI*2);ctx.stroke();}
 return c;
}
