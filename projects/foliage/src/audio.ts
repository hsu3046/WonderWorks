// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export function createSound(){
 let context:AudioContext|null=null,gain:GainNode|null=null;
 async function enable(on:boolean){
  if(on&&!context){
   context=new AudioContext();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
   const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),channel=buffer.getChannelData(0);
   for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1)*.4;
   const noise=context.createBufferSource(),filter=context.createBiquadFilter();noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=1400;noise.connect(filter).connect(gain);noise.start();
  }
  if(context){if(on)await context.resume();else await context.suspend();}
 }
 function update(wet:boolean,wind:number){if(gain&&context)gain.gain.setTargetAtTime(wet?.075:.008+wind*.024,context.currentTime,.5);}
 function thunder(){
  if(!context||context.state!=='running')return;
  const ctx=context,buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),channel=buffer.getChannelData(0);
  for(let i=0;i<channel.length;i++){const t=i/channel.length;channel[i]=(Math.random()*2-1)*Math.exp(-t*5)*(1+.3*Math.sin(t*34));}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),volume=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=220;volume.gain.value=.6;
  source.connect(filter).connect(volume).connect(ctx.destination);source.start(ctx.currentTime+.65);source.onended=()=>{source.disconnect();filter.disconnect();volume.disconnect();};
 }
 return {enable,update,thunder,dispose(){void context?.close();}};
}
