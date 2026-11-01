'use strict';
const crypto=require('node:crypto');
const {create}=require('./minigame-core.js');
const items=require('./items.js'),roster=require('./roster.js'),economy=require('./match-economy.cjs');
const KINDS=['stack','zones','divide','bomb','quiz'];
function open(players,kind=KINDS[crypto.randomInt(5)],now=Date.now()){
 if(!KINDS.includes(kind)||players.length<1||players.length>8)throw Error('실험 편성 오류');
 // No simulated participants. An odd solo seat gets an interactive personal game or a bye.
 const order=[...players].sort(()=>0);for(let i=order.length-1;i>0;i--){const j=crypto.randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
 // Distribute the odd-seat bye to the least-bye player rather than repeating it.
 if(order.length%2===1){
  const candidates=order.map((p,i)=>({p,i,count:p.m807ExperimentByes||0}));
  const minByes=Math.min(...candidates.map(x=>x.count));
  const chosen=candidates.find(x=>x.count===minByes);
  const [solo]=order.splice(chosen.i,1);order.push(solo);
  solo.m807ExperimentByes=(solo.m807ExperimentByes||0)+1;
 }
 const enc={kind,groups:[],settled:false,awards:{},now,version:0};
 for(let i=0;i<order.length;i+=2){
  const seed=crypto.randomInt(1,2147483647),slots=[order[i].slot,order[i+1]?.slot??null];
  const solo=slots[1]===null;
  if(solo&&['bomb','divide'].includes(kind)){
   const reward={credits:4,exp:kind==='divide'?4:2,items:[items.baseNames[crypto.randomInt(items.baseNames.length)]]};
   enc.groups.push({slots,bye:true,reward,engine:null,seq:{},lastAction:{}});
   continue;
  }
  const engine=create({kind,seed,online:true,items,roster,clock:{now:()=>enc.now}});
  const group={slots,solo,engine,seq:{},lastAction:{}};enc.groups.push(group);
  if(solo)engine.disconnect('B'); // Personal mode: no simulated player actions.
 }
 return enc;
}
function locate(enc,slot){const group=enc.groups.find(g=>g.slots.includes(slot));if(!group)throw Error('실험 참가자가 아니야');return {group,role:group.slots[0]===slot?'A':'B'};}
function tick(enc,now=Date.now()){
 enc.now=now;
 for(const group of enc.groups)if(!group.bye)group.engine.tick();
 enc.version++;
 return enc.groups.every(g=>g.bye||g.engine.snapshot().game.finished);
}
const allowed={stack:['contract','left','right','down','rotate','drop','stackStop'],zones:['zone','walk','inspect','retreat'],divide:['offer','accept','reject','chat'],bomb:['defuse','chat'],quiz:['quizAnswer','codexTab','search']};
function action(enc,slot,body,now=Date.now()){
 tick(enc,now);if(enc.settled)throw Error('정산된 실험');
 const {group,role}=locate(enc,slot);if(group.bye)throw Error('부전승 참가자는 조작할 수 없어');const g=group.engine.snapshot().game;
 if(g.finished)throw Error('종료된 실험');
 if(!Number.isSafeInteger(body.seq)||body.seq<1||body.seq<=(group.seq[slot]||0))throw Error('중복 또는 지난 동작');
 if(!allowed[enc.kind].includes(body.action))throw Error('허용되지 않은 실험 동작');
 if(now-(group.lastAction[slot]??-Infinity)<40)throw Error('동작이 너무 빨라');
 if(body.value!=null&&String(body.value).length>32)throw Error('동작 값 초과');
 if(body.action==='offer'&&(!Number.isInteger(body.credits)||!Number.isInteger(body.exp)||body.credits<0||body.exp<0||body.credits>g.pool.credits||body.exp>g.pool.exp||!Array.isArray(body.items)||body.items.some(i=>!Number.isInteger(i)||i<0||i>=g.pool.items.length)))throw Error('분배안 오류');
 if(body.answer!=null&&(typeof body.answer!=='string'||body.answer.length>100))throw Error('답안 오류');
 if(body.text!=null&&(typeof body.text!=='string'||body.text.length>160))throw Error('채팅 오류');
 group.seq[slot]=body.seq;group.lastAction[slot]=now;
 if(body.action==='search'){const p=g.players[role];p.search=String(body.text||'').slice(0,80);}
 else group.engine.dispatch(role,body.action,String(body.value??''),body);
 enc.version++;
}
function disconnect(enc,slot){
 const {group,role}=locate(enc,slot);
 if(group.bye||group.engine.snapshot().game.finished)return;
 if(['divide','bomb'].includes(enc.kind)){
  // The remaining participant should not lose every reward because their partner left.
  const other=group.slots.find(s=>s!==slot&&s!==null);
  if(other!==undefined){group.engine.disconnect(role);group.bye=true;group.byeReason='teammate-left';group.reward={credits:4,exp:enc.kind==='divide'?4:2,items:[items.baseNames[crypto.randomInt(items.baseNames.length)]]};}
  else group.engine.disconnect(role);
 }else{group.engine.disconnect(role);group.solo=true;}
 enc.version++;
}
function view(enc,slot){
 const {group,role}=locate(enc,slot);
 if(group.bye)return {kind:enc.kind,version:enc.version,deadline:enc.now,finished:true,bye:true,solo:true,seq:0,html:'<section class="qa-console"><h3>부전승</h3><p>'+(group.byeReason==='teammate-left'?'상대 참가자가 퇴장해서 자동 통과했어.':'실제 참가자 수가 홀수라 자동 통과했어. 별도의 가상 참가자는 없어.')+'</p><p>보상: '+group.reward.credits+'C · 숙련도 '+group.reward.exp+' EXP · 기본 재료 1개</p></section>',award:enc.awards[slot]||null};
 const g=group.engine.snapshot().game;
 return {kind:enc.kind,version:enc.version,deadline:g.deadline,finished:g.finished,solo:!!group.solo,seq:group.seq[slot]||0,html:group.engine.renderFor(role),award:enc.awards[slot]||null};
}
function settle(r){const enc=r.game.experiment;if(!enc||enc.settled)return false;if(!enc.groups.every(g=>g.bye||g.engine.snapshot().game.finished))return false;
 for(const p of r.players.values()){
  const group=enc.groups.find(g=>g.slots.includes(p.slot));if(!group||!p.assets||r.game.hp[p.slot]<=0)continue;
  const role=group.slots[0]===p.slot?'A':'B',reward=group.bye?group.reward:group.engine.snapshot().game.rewards[role];
  const grants=[{type:'credits',value:reward.credits||0},{type:'exp',value:reward.exp||0},...(reward.items||[]).map(n=>({type:'basic',value:items.baseNames.indexOf(n)}))];
  grants.forEach((x,i)=>economy.grant(p.assets,x,`r${r.game.round}:experiment:${p.slot}:${i}`));
  p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;enc.awards[p.slot]=reward;
 }
 enc.settled=true;return true;
}
module.exports={KINDS,open,tick,action,view,settle,disconnect};
