'use strict';
const assert=require('node:assert/strict');
const boss=require('../match-boss.cjs');
const {roster}=require('../roster.js');
const byId=Object.fromEntries(roster.map(x=>[x.id,x]));
const gear=id=>byId[id].main==='amp'?['임세티','텔루리안 타임피스','요명월']:['오토-암즈','레이더','레가투스'];
const plans=[
 {label:'초기 무장비 1성',round:7,star:1,mastery:3,items:false},
 {label:'중간 무장비 2성',round:9,star:2,mastery:6,items:false},
 {label:'중간 완성템 1개 2성',round:11,star:2,mastery:9,items:1},
 {label:'후반 완성템 3개 3성',round:15,star:3,mastery:15,items:3}
];
const lineups=[
 ['cathy','rio','sua'],['yumin','marcus','shurin'],['nadine','bernice','johann'],['isol','chloe','sua'],['alex','elena','silvia'],['mirka','aya','rozzi'],['jenny','rio','nicky'],['adela','yuki','hyunwoo']
];
let results=[];let total=0;
for(const p of plans)for(const b of boss.BOSSES){let wins=0,meanTime=0,meanBossHealth=0,meanTeamHealth=0;
 for(let i=0;i<lineups.length;i++)for(let seed=0;seed<8;seed++){
  const t=lineups[i].map((id,j)=>({characterId:id,star:p.star,x:byId[id].role.includes('원거리')?0:byId[id].role==='서포터'?1:2,y:j,items:p.items?gear(id).slice(0,p.items):[]}));
  const outcome=boss.fight({team:t,mastery:p.mastery,progress:{exploration:{visited:[],stacks:0}}},b,p.round,13091+seed*101+i*701);
  if(outcome.won)wins++;meanTime+=outcome.time;meanBossHealth+=outcome.bossHp;meanTeamHealth+=outcome.teamHp;total++;
 }
 const n=lineups.length*8;
 results.push({round:p.round,stage:p.label,boss:b.name,kills:wins,n,rate:+(100*wins/n).toFixed(1),avgTime:+(meanTime/n).toFixed(1),bossHp:+(meanBossHealth/n).toFixed(0),teamHp:+(meanTeamHealth/n).toFixed(0)});
}
assert.equal(total,4*3*8*8);assert(results.every(x=>Number.isFinite(x.avgTime)&&x.avgTime>0&&x.avgTime<=60.1));
console.log('BOSS BALANCE / 3v3 / 8 seeded lineups x 8 seeds (indicative, not real player meta)');for(const r of results)console.log(`${r.stage} ${r.boss.padEnd(6)} : ${String(r.kills).padStart(2)}/64 (${r.rate}%); time=${r.avgTime}; remain=${r.bossHp}`);
console.log('M8-05 BOSS BALANCE QA PASS:',total,'authoritative PvE matches');
