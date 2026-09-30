// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export function createTaskPool(limit:number){
 if(!Number.isInteger(limit)||limit<1)throw new Error('Invalid asset concurrency');
 let active=0;const queue:(()=>void)[]=[];
 return async function run<T>(work:()=>Promise<T>):Promise<T>{
  await new Promise<void>(resolve=>{queue.push(()=>{active++;resolve();});if(active<limit)queue.shift()!();});
  try{return await work();}finally{active--;queue.shift()?.();}
 };
}

export async function settleAll<T>(tasks:Promise<T>[]):Promise<T[]>{
 const results=await Promise.allSettled(tasks);const failure=results.find(r=>r.status==='rejected');
 if(failure?.status==='rejected')throw failure.reason;
 return results.map(r=>(r as PromiseFulfilledResult<T>).value);
}
