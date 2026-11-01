'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const server=source('server.cjs'),ui=source('game.js'),css=source('live-gate.css'),net=source('multiplayer.js'),engine=source('combat-engine.js');
assert.equal((server.match(/g\.endsAt=Date\.now\(\)\+15000/g)||[]).length,2,'15-second selection in start and next slot');
assert(!server.includes('g.endsAt=Date.now()+25000'));
assert(net.includes('<b>채팅</b>')&&!net.includes('LIVE · ROOM <span id="liveGameCode"'));
for(const marker of ['m809TopButtons','m809SelectionCollapsed','m809LiveHpStandings','m809ShowResult','m809DamageRows','m809EffectIcon','m809DrawAreaHits','m809ShiftHeld'])assert(ui.includes(marker),marker);
assert(css.includes('#liveSelectionPanel.m809-collapsed .live-selection-card'));
assert(css.includes('.shop-portrait img,.bench-portrait img'));
assert(css.includes('#liveMarketPanel .m808-special-toggle,#liveAuctionPanel .m808-special-toggle{display:none!important}'));
assert(css.includes('#m809LiveHpStandings')&&css.includes('#m809MatchResult'));
assert(engine.includes("type:'area-hit'"),'area effect event');
const {CombatEngine}=require('../combat-engine.js');
let count=0;
for(let seed=1;seed<=14;seed++){
 const combat=new CombatEngine({teamA:[{characterId:'aya',star:1,x:2,y:1},{characterId:'haze',star:1,x:1,y:0},{characterId:'alex',star:1,x:1,y:2}],teamB:[{characterId:'alex',star:1,x:2,y:1},{characterId:'marcus',star:1,x:1,y:0},{characterId:'yumin',star:1,x:1,y:2}],masteryA:2,masteryB:2,moveInterval:.5,seed});
 combat.run();const events=combat.drainEvents();count+=events.filter(e=>e.type==='area-hit').length;
 for(const e of events.filter(e=>e.type==='area-hit')){assert(Number.isInteger(e.x)&&e.x>=0&&e.x<=5);assert(Number.isInteger(e.y)&&e.y>=0&&e.y<=2);assert(typeof e.skill==='string');}
}
assert(count>0,'AoE effects emitted from actual battle hits');
console.log('M8-09 QA PASS: 15s selection, chat header, HUD/Shift/portrait/overlay/auction glyph hooks and '+count+' AoE tile hits');
