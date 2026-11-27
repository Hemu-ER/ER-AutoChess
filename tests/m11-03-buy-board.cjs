'use strict';
const assert=require('node:assert/strict');const E=require('../js/server/match-economy.cjs');
const blank=()=>{const a=E.makeInitial();Object.assign(a,{credits:20,owned:[],shop:['aiden','aiden','aiden','rio','aya'],nextUid:1,items:[],overflowItems:[],pendingUnits:[],augmentIds:[],infusionIds:[]});return a};
const unit=(a,id='hart',loc='bench',x=null,y=null,star=1,items=[])=>a.owned.push({uid:a.nextUid++,characterId:id,location:loc,x,y,star,items});
const buy=(a,opts={})=>E.action(a,'buy-board',{index:0,characterId:'aiden',x:1,y:1,...opts});
let n=0;function test(name,fn){fn();n++;console.log('PASS',name)}
function rejected(a,opts){const snapshot=structuredClone(a);assert.throws(()=>buy(a,opts));assert.deepEqual(a,snapshot)}
test('vacant board purchase',()=>{const a=blank();buy(a);assert.equal(a.credits,19);assert.equal(a.shop[0],null);assert.equal(a.owned[0].location,'board');assert.deepEqual([a.owned[0].x,a.owned[0].y],[1,1]);assert.equal(a.grayState.buys,1)});
test('occupied tile returns previous owner to bench',()=>{const a=blank();unit(a,'hart','board',1,1);buy(a);assert.equal(a.owned[0].location,'bench');assert.equal(a.owned[1].location,'board')});
test('full bench, vacant board',()=>{const a=blank();for(let i=0;i<8;i++)unit(a,'hart','bench',null,null,3);buy(a);assert.equal(E.reserveTeam(a).length,8);assert.equal(E.ownTeam(a).length,1)});
test('full bench, occupied tile rollback',()=>{const a=blank();for(let i=0;i<8;i++)unit(a,'hart','bench',null,null,3);unit(a,'rio','board',1,1);rejected(a)});
test('full board rollback',()=>{const a=blank();for(let i=0;i<3;i++)unit(a,'hart','board',i,0,3);rejected(a)});
test('P01 fourth deployment',()=>{const a=blank();a.augmentIds=['P01'];for(let i=0;i<3;i++)unit(a,'hart','board',i,0,3);buy(a);assert.equal(E.ownTeam(a).length,4)});
test('merge preserves deployed survivor and reward',()=>{const a=blank();a.augmentIds=['G058'];unit(a,'aiden','board',0,0);unit(a,'aiden');buy(a);assert.equal(a.owned.length,1);assert.equal(a.owned[0].star,2);assert.deepEqual([a.owned[0].x,a.owned[0].y],[0,0]);assert.equal(a.credits,21)});
test('merge on full bench',()=>{const a=blank();unit(a,'aiden');unit(a,'aiden');for(let i=0;i<6;i++)unit(a,'hart','bench',null,null,3);buy(a);assert.equal(a.owned.filter(o=>o.characterId==='aiden').length,1);assert.equal(a.owned[0].star,2);assert.equal(a.owned[0].location,'bench')});
test('gray discount once',()=>{const a=blank();a.augmentIds=['G013'];buy(a);assert.equal(a.credits,20);buy(a,{index:1,x:2});assert.equal(a.credits,19)});
test('stale shop and invalid coords rollback',()=>{const a=blank();rejected(a,{characterId:'rio'});rejected(a,{x:3});rejected(a,{index:'0'});rejected(a,{y:0.5})});
test('insufficient credits rollback',()=>{const a=blank();a.credits=0;rejected(a)});
test('P10 soldier gear reclaimed',()=>{const a=blank();a.augmentIds=['P10'];a.soldierItems={'1,1':'검집'};buy(a);assert.deepEqual(a.soldierItems,{});assert.deepEqual(a.items,['검집'])});
console.log('M11-03 BUY BOARD PASS:',n,'cases');
