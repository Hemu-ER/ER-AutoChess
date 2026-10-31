'use strict';
const crypto=require('node:crypto');
const {create}=require('./minigame-core.js');
const items=require('./items.js'),roster=require('./roster.js'),economy=require('./match-economy.cjs');
const KINDS=['stack','zones','divide','bomb','quiz'];
function open(players,kind=KINDS[crypto.randomInt(5)],now=Date.now()){
 if(!KINDS.includes(kind)||players.length<1||players.length>8)throw Error('실험 편성 오류');
 // Personal experiments also use two isolated seats; a spare seat is a virtual participant.
 const order=[...players].sort(()=>0);for(let i=order.length-1;i>0;i--){const j=crypto.randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
 const enc={kind,groups:[],settled:false,awards:{},now,version:0};
 for(let i=0;i<order.length;i+=2){
  const seed=crypto.randomInt(1,2147483647),slots=[order[i].slot,order[i+1]?.slot??null];
  const engine=create({kind,seed,online:true,items,roster,clock:{now:()=>enc.now}});
  const group={slots,engine,seq:{},lastAction:{}};enc.groups.push(group);
  if(slots[1]===null&&!['bomb','divide'].includes(kind))engine.disconnect('B');
 }
 return enc;
}
function locate(enc,slot){const group=enc.groups.find(g=>g.slots.includes(slot));if(!group)throw Error('실험 참가자가 아니야');return {group,role:group.slots[0]===slot?'A':'B'};}
function virtualTurn(enc,group){
 if(group.slots[1]!==null||enc.now-(group.botAt||0)<750)return;
 group.botAt=enc.now;group.engine.auto('B');
}
function tick(enc,now=Date.now()){
 enc.now=now;
 for(const group of enc.groups){group.engine.tick();virtualTurn(enc,group);}
 enc.version++;
 return enc.groups.every(g=>g.engine.snapshot().game.finished);
}
const allowed={stack:['contract','left','right','down','rotate','drop','stackStop'],zones:['zone','walk','inspect','retreat'],divide:['offer','accept','reject','chat'],bomb:['defuse','chat'],quiz:['quizAnswer','codexTab','search']};
function action(enc,slot,body,now=Date.now()){
 tick(enc,now);if(enc.settled)throw Error('정산된 실험');
 const {group,role}=locate(enc,slot),g=group.engine.snapshot().game;
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
 virtualTurn(enc,group);enc.version++;
}
function disconnect(enc,slot){const {group,role}=locate(enc,slot);if(!group.engine.snapshot().game.finished)group.engine.disconnect(role);}
function view(enc,slot){
 const {group,role}=locate(enc,slot),g=group.engine.snapshot().game;
 return {kind:enc.kind,version:enc.version,deadline:g.deadline,finished:g.finished,seq:group.seq[slot]||0,virtualPartner:group.slots[1]===null,html:group.engine.renderFor(role),award:enc.awards[slot]||null};
}
function settle(r){const enc=r.game.experiment;if(!enc||enc.settled)return false;if(!enc.groups.every(g=>g.engine.snapshot().game.finished))return false;
 for(const p of r.players.values()){
  const group=enc.groups.find(g=>g.slots.includes(p.slot));if(!group||!p.assets||r.game.hp[p.slot]<=0)continue;
  const role=group.slots[0]===p.slot?'A':'B',reward=group.engine.snapshot().game.rewards[role];
  const grants=[{type:'credits',value:reward.credits||0},{type:'exp',value:reward.exp||0},...(reward.items||[]).map(n=>({type:'basic',value:items.baseNames.indexOf(n)}))];
  grants.forEach((x,i)=>economy.grant(p.assets,x,`r${r.game.round}:experiment:${p.slot}:${i}`));
  p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;enc.awards[p.slot]=reward;
 }
 enc.settled=true;return true;
}
module.exports={KINDS,open,tick,action,view,settle,disconnect};
