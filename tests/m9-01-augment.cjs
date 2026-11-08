'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const aug=require('../match-augment.cjs');
let checks=0;
const test=(ok,msg)=>{assert.ok(ok,msg);checks++};
test(aug.CARDS.gray.length===54,'기존 승인 회색 카드 54종');
test(aug.TIERS.length===3&&aug.ROUNDS.join(',')==='1,6,16','등급과 라운드');
for(const t of aug.TIERS){test(aug.CARDS[t].length>=6,`${t} 후보 수`);test(new Set(aug.CARDS[t].map(c=>c.id)).size===aug.CARDS[t].length,`${t} 카드 고유 ID`)}
const distribution={gray:0,blue:0,purple:0};for(let i=0;i<15000;i++)distribution[aug.drawTier()]++;
for(const [tier,n] of Object.entries(distribution))test(n>4600&&n<5400,`${tier} 확률 1/3 범위: ${n}`);
for(let count=2;count<=8;count++){
 for(let round of aug.ROUNDS){
  for(let run=0;run<25;run++){
   const players=Array.from({length:count},(_,slot)=>({slot,augments:[]}));
   const s=aug.open(players,round);
   test(aug.TIERS.includes(s.tier),`${count}인 공통등급`);
   for(const p of players){
    const v=aug.view(s,p.slot);test(v.offers.length===3,'처음 카드 3장');test(new Set(v.offers.map(c=>c.id)).size===3,'처음 3장 중복 방지');
    if(p.slot%2===0){const before=v.offers.map(c=>c.id),after=aug.reroll(s,p).offers.map(c=>c.id);test(after.length===3&&after.every(id=>!before.includes(id)),'무료 새로고침 전체 교체');assert.throws(()=>aug.reroll(s,p),/이미 사용/);checks++}
    const selected=aug.pick(s,p,1);test(p.augments.includes(selected.id),'선택이 소유 내역에 반영');
    assert.throws(()=>aug.pick(s,p,0),/이미 증강/);checks++;
   }
   test(aug.allChosen(s,players),'전원 선택 완료');
  }
 }
}
for(let count of [3,5,7]){
 const players=Array.from({length:count},(_,slot)=>({slot,augments:[]}));const s=aug.open(players,6);
 aug.pick(s,players[0],0);aug.autoPick(s,players);
 test(aug.allChosen(s,players),'홀수 인원 자동 선택');test(players.every(p=>p.augments.length===1),'홀수 인원 보상 정확히 1개');
 aug.autoPick(s,players);test(players.every(p=>p.augments.length===1),'재정산 중복 지급 없음');
}
// Same tier may appear at all three checkpoints: owned IDs must never repeat.
for(const tierIndex of [0,1,2]){
 const p={slot:0,augments:[]};const stableTier=()=>tierIndex;
 for(const round of aug.ROUNDS){
  const state=aug.open([p],round,stableTier);
  test(state.offers[0].every(id=>!p.augments.includes(id)),`${round} 중복 후보 없음`);
  aug.reroll(state,p,stableTier);
  aug.pick(state,p,1);
 }
 test(new Set(p.augments).size===3,'세 번 획득한 증강 모두 서로 다름');
}
const p={slot:0,augments:[]};const state=aug.open([p],1);assert.throws(()=>aug.pick(state,p,NaN));checks++;assert.throws(()=>aug.pick(state,p,-1));checks++;assert.throws(()=>aug.pick(state,p,3));checks++;
const chosen=aug.pick(state,p,0);test(!aug.drawOffers(state.tier,p.augments).includes(chosen.id),'이미 획득한 카드 제외');
test(aug.CARDS.gray.every(c=>c.implemented===false),'회색 M9-01 원형은 구현 상태로 승격하지 않음');test(aug.CARDS.purple.length===46,'승인 46개 보라 인퓨전만 포함');test(aug.CARDS.purple.every(c=>c.implemented===true),'새 보라 인퓨전 카드 상태');
console.log(`M9-01 증강 선택 QA 성공: ${checks.toLocaleString()}개 검사, 등급 분포`,distribution);
