'use strict';
const crypto=require('node:crypto');
const {roster}=require('./roster.js');
const items=require('./items.js');
const playable=roster.filter(r=>!r.pveOnly&&[1,2,3].includes(r.cost));
const byId=new Map(playable.map(r=>[r.id,r]));
const XP={1:4,2:4,3:4,4:4,5:4,6:4,7:5,8:5,9:5,10:5,11:5,12:5,13:6,14:6,15:6,16:6,17:6,18:6,19:6};
const ODDS=[[3,80,20,0],[6,70,30,0],[9,57,38,5],[12,43,45,12],[15,30,47,23],[18,20,43,37],[19,14,38,48],[20,10,30,60]];
const POOL={1:18,2:15,3:12};
const rnd=n=>crypto.randomInt(n);
const copies=o=>3**(o.star-1);
function init(a){
 a.credits??=5;a.level??=1;a.exp??=0;a.items??=[];a.grants??=[];a.owned??=[];a.nextUid??=1;a.locked??=false;a.shop??=[];a.lastIncomeRound??=1;
 if(!a.shop.length)reroll(a,true);
 return a;
}
function roll(a){let available=playable.filter(r=>(POOL[r.cost]||0)>a.owned.filter(o=>o.characterId===r.id).reduce((s,o)=>s+copies(o),0));if(!available.length)return null;
 const weights=ODDS.find(row=>a.level<=row[0])||ODDS.at(-1);const viable=[1,2,3].filter(cost=>available.some(r=>r.cost===cost)&&weights[cost]>0);
 let ticket=rnd(viable.reduce((s,c)=>s+weights[c],0)),cost=viable.at(-1);for(const c of viable){ticket-=weights[c];if(ticket<0){cost=c;break}}
 available=available.filter(r=>r.cost===cost);return available[rnd(available.length)].id;
}
function reroll(a,free=false){if(!free){if(a.credits<2)throw Error('리롤 크레딧 부족');a.credits-=2}a.shop=Array.from({length:5},()=>roll(a));}
function addExp(a,n){a.exp+=n;while(a.level<20&&a.exp>=XP[a.level]){a.exp-=XP[a.level];a.level++}if(a.level===20)a.exp=0}
function merge(a){for(let count=0;count<30;count++){const grouped=new Map();for(const o of a.owned.filter(o=>o.star<3)){const key=o.characterId+':'+o.star;const arr=grouped.get(key)||[];arr.push(o);grouped.set(key,arr)}const group=[...grouped.values()].find(g=>g.length>=3);if(!group)break;const three=group.slice(0,3);if(three.some(o=>o.items?.length))break;const survivor=three.find(o=>o.location==='board')||three[0];a.owned=a.owned.filter(o=>!three.includes(o)||o===survivor);survivor.star++;}}
function addUnit(a,cid){const r=byId.get(cid);if(!r)throw Error('실험체 없음');const o={uid:a.nextUid++,characterId:cid,star:1,location:'bench',x:null,y:null,items:[]};a.owned.push(o);merge(a);return o}
function team(a){return a.owned.filter(o=>o.location==='board').map(o=>({characterId:o.characterId,x:o.x,y:o.y,star:o.star,items:o.items.slice()}))}
function action(a,cmd,payload={}){
 init(a);
 const locate=()=>{const o=a.owned.find(o=>o.uid===payload.uid);if(!o)throw Error('실험체가 없어');return o};
 if(cmd==='buy'){const i=payload.index;if(!Number.isInteger(i)||i<0||i>4)throw Error('상점 선택 오류');const cid=a.shop[i],r=byId.get(cid);if(!r)throw Error('품절');if(a.credits<r.cost)throw Error('크레딧 부족');if(a.owned.filter(o=>o.location==='bench').length>=8)throw Error('벤치가 가득 찼어');a.credits-=r.cost;addUnit(a,cid);a.shop[i]=null;}
 else if(cmd==='reroll')reroll(a);
 else if(cmd==='lock')a.locked=!a.locked;
 else if(cmd==='invest'){if(a.level>=20||a.credits<2)throw Error('숙련도 투자 불가');a.credits-=2;addExp(a,2)}
 else if(cmd==='deploy'){const o=locate();const {x,y}=payload;if(!Number.isInteger(x)||x<0||x>2||!Number.isInteger(y)||y<0||y>2)throw Error('잘못된 좌표');const existing=a.owned.find(q=>q.location==='board'&&q.x===x&&q.y===y&&q.uid!==o.uid);if(existing){existing.location='bench';existing.x=null;existing.y=null;}if(o.location!=='board'&&a.owned.filter(q=>q.location==='board').length>=3&&!existing)throw Error('출전 최대 3명');o.location='board';o.x=x;o.y=y;}
 else if(cmd==='recall'){const o=locate();if(a.owned.filter(q=>q.location==='bench').length>=8)throw Error('벤치가 가득 찼어');o.location='bench';o.x=null;o.y=null;}
 else if(cmd==='sell'){const o=locate();if(o.items.length)throw Error('장착 장비가 있어 판매 불가');const r=byId.get(o.characterId);a.credits+=o.star===1?r.cost:Math.ceil(r.cost*copies(o)/2);a.owned=a.owned.filter(q=>q!==o);}
 else if(cmd==='equip'){const o=locate();const name=String(payload.item||'');if(!items.all[name]||!a.items.includes(name))throw Error('인벤토리에 장비가 없어');const idx=o.items.findIndex(e=>items.all[e]?.basic&&items.all[name]?.basic&&items.craft(e,name));
 if(idx>=0){const made=items.craft(o.items[idx],name);a.items.splice(a.items.indexOf(name),1);o.items[idx]=made;}
 else{if(o.items.length>=3)throw Error('장비 슬롯 부족');a.items.splice(a.items.indexOf(name),1);o.items.push(name);}}
 else throw Error('알 수 없는 경제 동작');
 return a;
}
function roundIncome(a,round){init(a);if(round<=a.lastIncomeRound)return false;const delta=Math.min(3,Math.floor(a.credits/10));a.credits+=5+delta;addExp(a,4);if(!a.locked)reroll(a,true);a.lastIncomeRound=round;return true;}
module.exports={init,action,team,addExp,addUnit,roundIncome,merge};
