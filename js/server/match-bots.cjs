'use strict';
// M10-19: minimal in-room bot. Actions are sent through the existing server handler.
// No direct economy/augment mutations; no persistent accounts, no fake SSE connections.
const nextAction = (r,p,blocked=()=>false)=>{
 const g=r.game,a=p.assets,slot=p.slot;
 if(!g||g.phase==='finished'||g.hp[slot]<=0)return null;
 if(g.phase==='prep'){
  if(g.augment&&!g.augment.picks[slot])return ['augment-pick',{round:g.round,choice:0}];
  if(g.augment?.picks[slot]&&!g.augment.downloads[slot])return ['augment-assets-ready',{round:g.round}];
  if(!p.roundReady&&a){
   const board=a.owned.filter(o=>o.location==='board');
   const bench=a.owned.filter(o=>o.location==='bench');
   if(board.length<3&&bench.length){
    const open=[[1,1],[0,1],[2,1],[1,0],[1,2]].find(([x,y])=>!board.some(u=>u.x===x&&u.y===y));
    if(open&&!blocked('deploy',bench[0].uid))return ['economy',{cmd:'deploy',uid:bench[0].uid,x:open[0],y:open[1]}];
   }
   // Buy a couple of inexpensive units to keep an active squad. If purchases
   // cannot fit or afford, prefer progress over repeated rejected requests.
   if(board.length<3&&a.owned.length<8){
    const list=a.shop.map((id,i)=>({id,i})).filter(x=>x.id);
    const buy=list.find(o=>!blocked('buy',o.i));
    if(a.credits>=2&&buy)return ['economy',{cmd:'buy',index:buy.i}];
   }
   if(a.items.length){const target=board.find(u=>u.items.length<3);
    if(target&&!blocked('equip',target.uid))return ['economy',{cmd:'equip',uid:target.uid,index:0}];}
   return ['round-ready',{ready:true}];
  }
  return null;
 }
 if(g.phase==='augment'){
  if(g.augment&&!g.augment.picks[slot])return ['augment-pick',{round:g.round,choice:0}];
 }
 if(g.phase==='augment-sync'&&g.augment?.picks[slot]&&!g.augment.downloads[slot])return ['augment-assets-ready',{round:g.round}];
 if(g.phase==='intro'&&!g.introReady?.[slot])return ['intro-complete',{round:g.round}];
 if(g.phase==='supply'&&!g.supplyResolved?.[slot])return ['supply-pick',{choice:0}];
 if(g.phase==='special'){
  if(g.specialType==='selection'&&g.selection){
   const sel=g.selection;
   if(sel.order[sel.wave]===slot&&!sel.resolved?.[slot]){
    const i=sel.candidates.findIndex(c=>c.claimedBy===null);
    if(i>=0)return ['selection-pick',{choice:i}];
   }
  }
  if(g.specialType==='shop'&&g.market&&!g.market.ready?.[slot])return ['market',{cmd:'ready',ready:true}];
  // Auctions permit no bid: passing lets the authoritative timer settle each lot.
 }
 if(g.phase==='combat'&&!p.farmDone&&g.pve){
  const result=g.kind==='boss'?g.boss?.results?.[slot]:g.farmResults?.[slot];
  if(result&&Date.now()-g.combatStartedAt>=Math.max(1000,Math.min(60,result.time)*1000+300))return [g.kind==='boss'?'boss-done':'farm-done',{round:g.round}];
 }
 return null;
};
const pending=new WeakSet();
const attempted=new WeakMap();
const blockedActions=new WeakMap();
async function tick(r,send){
 const g=r.game;if(!g||g.phase==='finished')return;
 for(const bot of r.players.values()){
  if(!bot.isBot||pending.has(bot))continue;
  const block=blockedActions.get(bot);
  const phaseKey=g.round+':'+g.phase;
  if(!block||block.phaseKey!==phaseKey)blockedActions.set(bot,{phaseKey,ids:new Set()});
  const blocked=blockedActions.get(bot);
  const action=nextAction(r,bot,(cmd,target)=>blocked.ids.has(cmd+':'+target));if(!action)continue;
  const [command,body]=action,key=[g.round,g.phase,g.version,command,JSON.stringify(body)].join(':');
  const prev=attempted.get(bot);if(prev?.key===key&&Date.now()-prev.time<2500)continue;
  if(prev&&Date.now()-prev.time<650)continue;
  attempted.set(bot,{key,time:Date.now()});pending.add(bot);
  try{const result=await send(bot,command,body);if(!result.ok){
   if(command==='economy')blocked.ids.add(body.cmd+':'+(body.uid??body.index));
   if(result.status!==409)console.warn('[BOT]',bot.name,command,result.status,result.data.error||'');
  }}
  catch(error){console.warn('[BOT]',bot.name,command,error.message)}
  finally{pending.delete(bot)}
 }
}
module.exports={tick,nextAction};
