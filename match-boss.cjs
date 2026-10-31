'use strict';
// M8-05: shared boss identity per match, independent authoritative team fights.
const crypto=require('node:crypto');
const {CombatEngine}=require('./combat-engine.js');
const economy=require('./match-economy.cjs');
const items=require('./items.js');
const BOSSES=Object.freeze([
 Object.freeze({id:'boss_alpha',name:'알파',weight:40,tier:1,health:6700,attack:105,defense:34,interval:5,pattern:'추적 절단',reward:{credits:5,basics:2,completes:0},buff:{atk:.05}}),
 Object.freeze({id:'boss_omega',name:'오메가',weight:40,tier:2,health:10000,attack:142,defense:49,interval:4,pattern:'충격 파동',reward:{credits:8,basics:2,completes:1},buff:{hp:.08}}),
 Object.freeze({id:'boss_wickeline',name:'위클라인',weight:20,tier:3,health:14200,attack:166,defense:60,interval:3.5,pattern:'맹독 주입',reward:{credits:12,basics:3,completes:2},buff:{amp:.10,as:.05}})
]);
const buffNames=Object.freeze({atk:'공격력 +5%',hp:'최대 HP +8%',amp:'스킬 증폭 +10%',as:'공격 속도 +5%'});
const find=id=>BOSSES.find(b=>b.id===id);
function choose(roll=crypto.randomInt(100)){
 if(!Number.isInteger(roll)||roll<0||roll>=100)throw Error('보스 추첨 범위 오류');
 let x=roll;for(const b of BOSSES){if(x<b.weight)return b;x-=b.weight;}throw Error('보스 추첨 실패');
}
function scaling(round){if(![7,9,11,13,15].includes(round))throw Error('보스 라운드는 특수 라운드에만 등장');return 1+Math.max(0,round-7)*.12}
function publicInfo(b,round){return {id:b.id,name:b.name,tier:b.tier,pattern:b.pattern,health:Math.round(b.health*scaling(round)),attack:Math.round(b.attack*(1+Math.max(0,round-7)*.065)),defense:Math.round(b.defense+(round-7)*2),interval:b.interval,reward:b.reward,buff:b.buff,buffText:Object.keys(b.buff).map(k=>buffNames[k]).join(' · '),round};}
function configFor(p,b,round,seed){const info=publicInfo(b,round);return {teamA:p.team||[],teamB:[{characterId:b.id,star:1,x:2,y:1,items:[]}],masteryA:p.mastery||1,masteryB:1,seed,moveInterval:.5,arenaRegion:'lab',boss:{id:b.id,stats:{hp:info.health,atk:info.attack,def:info.defense},interval:b.interval},persistent:{A:p.progress||{},B:{}}};}
function fight(p,b,round,seed){
 if(!p.team?.length)return {seed,time:0,won:false,bossHp:publicInfo(b,round).health,teamHp:0,empty:true};
 const result=new CombatEngine(configFor(p,b,round,seed)).run();
 const enemy=result.units.find(u=>u.characterId===b.id&&u.team==='B');
 const own=result.units.filter(u=>u.team==='A'&&!u.dead);
 return {seed,time:result.time,won:Boolean(enemy&&enemy.dead),bossHp:Math.round(Math.max(0,enemy?.hp||0)),teamHp:Math.round(own.reduce((s,u)=>s+Math.max(0,u.hp),0)),outcome:result.outcome};
}
function open(round,players,b=choose()){
 const results={};const info=publicInfo(b,round);
 for(const p of players){const seed=crypto.randomInt(1,2147483647);results[p.slot]=fight(p,b,round,seed);}
 return {id:b.id,info,results,settled:false,startedAt:null};
}
function grantOne(p,b,round,result,slot){
 if(!p.assets)return null;
 const key=`r${round}:boss:${slot}`,won=Boolean(result.won);
 const rewards=[];
 const credits=won?b.reward.credits:2;
 const basics=won?b.reward.basics:1;
 const completes=won?b.reward.completes:0;
 rewards.push({type:'credits',value:credits});
 for(let i=0;i<basics;i++)rewards.push({type:'basic',value:crypto.randomInt(items.baseNames.length)});
 for(let i=0;i<completes;i++)rewards.push({type:'complete',value:crypto.randomInt(items.recipes.length)});
 for(let i=0;i<rewards.length;i++)economy.grant(p.assets,rewards[i],`${key}:${i}`);
 if(won){
  p.progress??={};p.progress.bossBuffs??={};
  if(!p.progress.bossAwardKeys?.includes(key)){
   for(const [stat,value] of Object.entries(b.buff))p.progress.bossBuffs[stat]=(p.progress.bossBuffs[stat]||0)+value;
   p.progress.bossAwardKeys??=[];p.progress.bossAwardKeys.push(key);
  }
 }
 p.team=economy.ownTeam(p.assets);p.mastery=p.assets.level;
 return {won,rewards,buff:won?b.buff:null};
}
function settle(r){const g=r.game,enc=g?.boss;if(!enc||enc.settled)return false;const b=find(enc.id);if(!b)throw Error('없는 보스');enc.settled=true;enc.awards={};for(const p of r.players.values())if(g.hp[p.slot]>0&&enc.results[p.slot])enc.awards[p.slot]=grantOne(p,b,g.round,enc.results[p.slot],p.slot);return true;}
function view(enc,slot,phase){if(!enc)return null;return {id:enc.id,info:enc.info,startedAt:enc.startedAt,settled:enc.settled,personal:['combat','result'].includes(phase)?enc.results[slot]||null:null,award:phase==='result'?enc.awards?.[slot]||null:null};}
module.exports={BOSSES,choose,find,scaling,publicInfo,configFor,fight,open,settle,view};
