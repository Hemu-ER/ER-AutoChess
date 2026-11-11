'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let n=0;const ok=(test,msg)=>{assert.ok(test,msg);n++};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {roster}=require('../js/shared/roster.js');const hart=roster.find(r=>r.id==='hart');ok(hart.affiliations.includes('군악대')&&hart.affiliations.includes('헌신'),'Hart now has devotion and band');
const auction=require('../js/server/match-auction.cjs');const econ=require('../js/server/match-economy.cjs');
const choiceLot={index:0,kind:'unit2',reward:{type:'unit-choice',cost:2,star:1},status:'bidding',bid:3,bidderSlot:0,winnerSlot:null};
const others=[{index:1,kind:'complete',reward:{type:'item',item:'철판'},status:'upcoming',bid:0,bidderSlot:null,winnerSlot:null},{index:2,kind:'unit3',reward:{type:'unit',characterId:'aiden',star:1},status:'upcoming',bid:0,bidderSlot:null,winnerSlot:null}];
const p={slot:0,assets:econ.makeInitial(),team:[],mastery:1};const room={started:true,players:new Map([['x',p]]),game:{round:7,phase:'special',specialType:'auction',hp:[100],auction:auction.open(0,[choiceLot,...others])}};
const result=auction.settle(room,16000);ok(result,'auction settled');
ok(p.assets.auctionChoices?.length===1,'choice credit created');ok(p.assets.auctionChoices[0].cost===2,'correct cost');
const stockBefore=JSON.stringify(p.assets.stock||{});const id=p.assets.auctionChoices[0].id;
assert.throws(()=>auction.chooseUnit(room,p,id,'aiden'));n++; // cost 1 invalid
const unit2=roster.find(x=>x.cost===2&&!x.pveOnly);ok(Boolean(unit2),'unit available');
auction.chooseUnit(room,p,id,unit2.id);ok(p.assets.auctionChoices.length===0,'choice consumed once');
ok(JSON.stringify(p.assets.stock||{})===stockBefore,'shop pool stock unaffected');
ok(p.assets.owned.some(x=>x.characterId===unit2.id&&x.star===1)||p.assets.pendingUnits.some(x=>x.characterId===unit2.id&&x.star===1),'one-star granted to owned or pending');
assert.throws(()=>auction.chooseUnit(room,p,id,unit2.id));n++;
// Deterministic simulation: a P29 kill emits execute, ordinary combat does not.
const {CombatEngine}=require('../js/shared/combat-engine.js');
function runExec(purple){const e=new CombatEngine({teamA:[{characterId:'garnet',star:3,x:2,y:1,items:[]}],teamB:[{characterId:'aiden',star:1,x:2,y:1,items:[]}],masteryA:4,masteryB:1,seed:5,round:17,augmentsA:purple?['P29']:[],augmentsB:[]});e.run();return e.drainEvents()}
const execEvents=runExec(true),normalEvents=runExec(false);
ok(execEvents.some(e=>e.type==='execute'&&e.skill==='집행자의 명령'),'real P29 execution emits specific event');
ok(execEvents.some(e=>e.type==='attack'),'attacks emit source event');
ok(!normalEvents.some(e=>e.type==='execute'),'normal combat does not spoof execution');
// Auction unit3 reward remains unchanged.
const lots=Array.from({length:40},()=>auction.buildLots()).flat();ok(lots.filter(x=>x.kind==='unit3').every(x=>x.reward.star===1&&x.reward.type==='unit'),'unit3 unaffected');
ok(lots.filter(x=>x.kind==='unit2').every(x=>x.reward.type==='unit-choice'&&x.reward.cost===2),'unit2 selection reward');
// Execution event emitted at the true engine cause, not for regular damage.
const combat=read('combat-engine.js');ok(combat.includes("if(opt.sourceName==='집행자의 명령')events.push({time,type:'execute'"),'P29 execute event');ok(combat.includes("skill:'처형식'});"),'Garnet execute event');ok(combat.includes("type:'attack'"),'attack event');
const game=read('game.js');ok(game.includes('LIVEAttackFX?.emit?.(event)'),'attack and execution render hook');ok(!game.includes("window.M6PixiAdapter?.impact?.(event)"),'hit impact suppressed');ok(game.includes('requestAnimationFrame(()=>renderGameEconomy())'),'item equip redraw');ok(game.includes('e.dataset.inspectCharacter=u.characterId'),'favorite synergy board marker');ok(game.includes("전투 시작 후 10초마다 모든 적"),'Isol tooltip fixed');
const js=read('m1007-client.js'),css=read('m1007-graphics.css');ok(js.includes('auctionChooseUnit'),'client auction picker available');ok(css.includes('z-index:100080')&&css.includes('m907PurpleStrategy'),'target picker modal above inventory');ok(css.includes('m1007-board-engraving.svg'),'board graphic');ok(css.includes('shop-owned-count')&&css.includes('m910-focus-mark'),'shop clipping and focus marks');
for(const f of ['m1007-board-engraving.svg','m1007-slot-mark.svg'])ok(read(f).includes('<svg'),'SVG asset '+f);
console.log(`M10-07 QA PASS ${n} assertions; auction choice/stock/idempotency, roles, text, effects, UI safety`);
