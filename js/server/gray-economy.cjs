'use strict';
// M10-04: server-authoritative 1st-stage infusion effects, deterministic state on economy assets.
const {CARDS}=require('./match-augment.cjs');
const KNOWN=new Set(CARDS.gray.map(c=>c.id));
function has(a,id){return KNOWN.has(id)&&(a?.augmentIds||a?.infusionIds||[]).includes(id)}
function data(a){
 if(!a.grayState)a.grayState={round:0,roundSpent:0,paidRerolls:0,buys:0,sells:0,crafts:0,firstSale:0,firstCraft:0,purchases:[],boughtUids:[],freeRerolls:0,interestCount:0,flatSavings:0,noLevelRounds:0,levelOnRound:0,savedAtPrep:0,lockedShop:false,killStacks:0,invested:false,investedLast:false,interestBonus:0,prepLevel:a.level||1,trainingQueued:false};
 return a.grayState;
}
function ensure(a){const s=data(a);if(!s.round)s.round=a.lastIncomeRound||1;return s}
function spend(a,n){if(n>0){const s=ensure(a);s.roundSpent+=n;}}
function buyCost(a,id,index,base){const s=ensure(a);let off=0;
 if(has(a,'G013')&&s.buys===0)off++;
 if(has(a,'G017')&&s.lockedShop&&s.buys===0)off++;
 if(has(a,'G036')&&s.buys===0&&(a.shop||[]).filter(x=>x===id).length>=2)off++;
 return Math.max(0,base-off);
}
function afterBuy(a,uid,cost){const s=ensure(a);s.buys++;s.boughtUids.push(uid);spend(a,cost)}
function afterReroll(a,paid){const s=ensure(a);if(paid){s.paidRerolls++;spend(a,2);if(has(a,'G053')&&s.paidRerolls===3)a.credits+=1}}
function takeFreeReroll(a){const s=ensure(a);if(s.freeRerolls>0){s.freeRerolls--;return true;}return false}
function afterInvest(a,oldLevel){const s=ensure(a);spend(a,2);s.invested=true;s.trainingQueued=true;}
function levelUp(a,oldLevel){const s=ensure(a);if(a.level>oldLevel&&has(a,'G019')&&s.levelRewardRound!==s.round){a.credits+=2;s.levelRewardRound=s.round;}}
function afterSell(a,u){const s=ensure(a);if(s.sells++===0&&has(a,'G055')&&!s.boughtUids.includes(u.uid))a.credits++}
function afterCraft(a){const s=ensure(a);if(s.crafts++===0&&has(a,'G056'))a.credits+=2}
function afterMerge(a,newStar){if(has(a,'G058'))a.credits+=newStar===2?2:newStar===3?3:0}
function beforeNextRound(a){const s=ensure(a),credits=a.credits;
 if(has(a,'G002')&&credits<=5)a.credits+=1;
 if(has(a,'G014')&&credits<=2)a.credits+=2;
 if(has(a,'G037')&&s.roundSpent===0)a.credits+=2;
 s.flatSavings=credits>=10?s.flatSavings+1:0;
 if(has(a,'G054')&&s.flatSavings>=2){a.credits+=2;s.flatSavings=0}
 if(has(a,'G015')&&s.roundSpent>=10)s.freeRerolls++;
 s.lockedShop=!!a.locked;
 s.noLevelRounds=(a.level>s.prepLevel)?0:s.noLevelRounds+1;
 if(has(a,'G020')&&s.noLevelRounds>=2){s.noLevelRounds=0;return 2}
 return 0;
}
function afterIncome(a,round,interest){const s=ensure(a);if(interest>0){s.interestCount++;if(has(a,'G016')&&s.interestCount%2===0)a.credits++}
 s.investedLast=s.invested;s.invested=false;s.round=round;s.roundSpent=0;s.paidRerolls=0;s.buys=0;s.sells=0;s.crafts=0;s.boughtUids=[];s.purchases=[];s.levelOnRound=0;s.prepLevel=a.level;}
function settlePvP(a,{round,won=false,lost=false,kills=0}={}){
 const s=ensure(a),key=`pvp:${round}`;if(s.lastPvp===key)return;s.lastPvp=key;
 if(lost&&has(a,'G004'))s.freeRerolls++;
 if(lost&&has(a,'G034')){const addExp=require('./match-economy.cjs').addExp;addExp(a,2)}
 if(kills>0&&has(a,'G018'))require('./match-economy.cjs').addExp(a,1);
 if(kills>0&&has(a,'G059')&&s.trainingQueued)require('./match-economy.cjs').addExp(a,1);s.trainingQueued=false;
 if(kills>0&&has(a,'G022')){s.killStacks++;if(s.killStacks>=3){s.killStacks-=3;const items=require('../shared/items.js');const index=(round+Number(a.nextUid||0))%items.baseNames.length;require('./match-economy.cjs').giveItem(a,items.baseNames[index]);}}
}
module.exports={KNOWN,has,data,ensure,spend,buyCost,afterBuy,afterReroll,takeFreeReroll,afterInvest,levelUp,afterSell,afterCraft,afterMerge,beforeNextRound,afterIncome,settlePvP};
