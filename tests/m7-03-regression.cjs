'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=(n)=>fs.readFileSync(path.join(root,n),'utf8');
const m=source('game.js').match(/const MASTERY_EXP_TO_NEXT=(\{[^\n]+\});/);
assert(m,'mastery table found');const needs=Function(`return (${m[1]})`)();
assert.equal(Object.values(needs).reduce((a,b)=>a+b,0),175);
let sum=0;for(let level=1;level<=19;level++){sum+=needs[level];if([4,9,14,19].includes(level))assert.equal(sum,{4:22,9:61,14:110,19:175}[level])}
assert(source('m6-pixi-adapter.css').includes('#board:not(.m6-pixi-active) .sd-slot img.sd-image'),'Pixi fallback must make DOM portraits visible');
assert(source('m6-pixi-adapter.js').includes('revision!==drawVersion'),'Async Pixi update guard required');
assert(source('game.js').includes("roundState.phase='prep';teams.B=[];\n   // Reset battle"),'Prep must be established before fresh board reset');
const os=require('node:os');
process.env.PORT='0';process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m7-03-'));
const {server,drawSupplyChoices,drawSupplyReward,SUPPLY_ODDS}=require('../server.cjs');
const costs=Object.fromEntries(SUPPLY_ODDS);assert.deepEqual(costs,{complete:5,credits:30,exp:20,unit1:25,unit2:20});
const rewardKind=o=>o.type==='unit'?'unit'+o.cost:o.type;
for(let i=0;i<6000;i++){
 const offers=drawSupplyChoices();assert.equal(offers.length,3);assert.equal(new Set(offers.map(rewardKind)).size,3,'Duplicate supply category');
 for(const o of offers){assert.notEqual(o.type,'basic','No stand-alone base item');
  if(o.type==='credits'||o.type==='exp')assert(o.value>=7&&o.value<=10);
  if(o.type==='unit'){assert.equal(o.star,2);assert(o.value);if(o.cost===1)assert(Number.isInteger(o.bonusBasic)&&o.bonusBasic>=0&&o.bonusBasic<7);else assert.equal(o.bonusBasic,undefined)}
 }
}
for(let kind of ['credits','exp','complete','unit1','unit2']){
 for(let j=0;j<15;j++){const o=drawSupplyReward(kind);assert.equal(rewardKind(o),kind==='unit1'||kind==='unit2'?kind:kind)}
}
assert.deepEqual([1,2,3,4].map(()=>drawSupplyReward('credits').value).every(x=>x>=7&&x<=10),true);
const vm=require('node:vm');const src=source('game.js');
const block=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i);return src.slice(i,j)};
const fns=block('function mergeOwnedUnits(){','\nfunction buyShop(')+'\n'+block('function liveFlushSupplyUnitQueue(){','\nfunction liveSupplyUi(')+'\n'+block('function liveApplySupplyReward(net,slot){','\nlet livePreviousUnitStats=');
const gs={credits:0,owned:[],items:[],nextOwnedId:1,message:''};const sandbox={gameState:gs,teams:{A:[]},roundState:{phase:'prep'},GAME_TEMP:{benchSize:8},INVENTORY_LIMIT:12,BASIC_ITEMS:['검집','금팔찌','방탄 조끼','사슬 갑옷','화살통','전자 부품','철사'],LIVEItems:{all:{'오토-암즈':{basic:false}}},byId:{aiden:{id:'aiden',name:'에이든',cost:1},katja:{id:'katja',name:'카티야',cost:2}},displayName:r=>r.name,renderGameEconomy(){},mergePriority:o=>o.uid,liveSupplyApplied:false,livePendingSupplyUnits:[],addMasteryProgress(amount){sandbox.exp=(sandbox.exp||0)+amount},pushItem(name){gs.items.push(name)}};
vm.createContext(sandbox);vm.runInContext(fns,sandbox);
const resolve=(reward)=>{sandbox.liveSupplyApplied=false;sandbox.liveApplySupplyReward({round:5,supplyResolved:[reward,null]},0)};
resolve({type:'unit',cost:1,value:'aiden',star:2,bonusBasic:0});assert.equal(gs.owned.find(o=>o.characterId==='aiden')?.star,2);assert.equal(gs.items[0],'검집');
resolve({type:'unit',cost:2,value:'katja',star:2});assert.equal(gs.owned.find(o=>o.characterId==='katja')?.star,2);assert.equal(gs.items.length,1);
resolve({type:'credits',value:9});assert.equal(gs.credits,9);
resolve({type:'exp',value:7});assert.equal(sandbox.exp,7);
// Bench full: receive material immediately; queue the 2-star unit until a slot opens.
gs.owned.length=0;gs.items.length=0;gs.owned.push(...Array.from({length:8},(_,i)=>({uid:i+20,characterId:'katja',star:1,location:'bench',equipment:[]})));resolve({type:'unit',cost:1,value:'aiden',star:2,bonusBasic:1});assert.equal(sandbox.livePendingSupplyUnits.length,1);assert.equal(sandbox.livePendingSupplyUnits[0].star,2);assert.equal(gs.items[0],'금팔찌');gs.owned.pop();sandbox.liveFlushSupplyUnitQueue();assert.equal(sandbox.livePendingSupplyUnits.length,0);assert.equal(gs.owned.find(o=>o.characterId==='aiden')?.star,2);
// 3 × 2-star copies must merge to 3-star without converting reward to 1-star.
gs.owned.length=0;gs.items.length=0;gs.owned.push({uid:40,characterId:'aiden',star:2,location:'bench',equipment:[]},{uid:41,characterId:'aiden',star:2,location:'bench',equipment:[]});resolve({type:'unit',cost:1,value:'aiden',star:2,bonusBasic:0});assert.equal(gs.owned.length,1);assert.equal(gs.owned[0].star,3);



// Simulate online transition from a result with dead combat units into a fresh preparation board.
const app=src.slice(src.indexOf('window.LIVEApplyGame=function(net,slot,players){'),src.indexOf('\n\nfunction stopRoundMode(){'));
const prepState={active:true,phase:'result',round:5,hp:{A:0,B:0}};
const prepTeams={A:[{characterId:'alex',star:1,x:2,y:1}],B:[{characterId:'garnet',star:1,x:2,y:1}]};
let resetCalls=0,refreshCalls=0;
const win={LIVEOpponentExploration:null,M6PixiAdapter:{refresh(){refreshCalls++}}};
const prepContext={window:win,roundState:prepState,teams:prepTeams,gameState:{exploration:{},infiltrationRewards:0},livePhaseVersion:0,liveCompletedRound:6,clearRoundTimer(){},renderRoundUI(){},renderGameEconomy(){},liveApplySupplyReward(){},liveSupplyUi(){},rollShop(){},addMasteryProgress(){},roundCreditIncome(){return {total:5}},reset(){resetCalls++;assert.equal(prepState.phase,'prep');assert.equal(prepTeams.B.length,0)},$:()=>({textContent:''}),document:{querySelector:()=>null},liveBeep(){},Math,Date};
vm.createContext(prepContext);vm.runInContext(app,prepContext);
win.LIVEApplyGame({round:6,phase:'prep',version:1,endsAt:Date.now()+60000,hp:[100,100],pve:false},0,[{slot:0},{slot:1}]);
assert.equal(resetCalls,1,'Every online prep transition must redraw fresh units');
assert.equal(refreshCalls,1,'Online prep transition must refresh Pixi scene');

server.close(()=>{console.log('M7-03 PASS: client rewards, online dead-unit reset; mastery 175, weighted distinct supply options (6,000 × 3), star2 rewards, bonus materials, Pixi fallback/phase reset guards');process.exit(0)});
