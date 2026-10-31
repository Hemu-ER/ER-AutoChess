'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const client=fs.readFileSync(path.join(root,'game.js'),'utf8');
const multiplayer=fs.readFileSync(path.join(root,'multiplayer.js'),'utf8');
const roster=require('../roster.js').roster;
const boss=require('../match-boss.cjs');
const engine=fs.readFileSync(path.join(root,'combat-engine.js'),'utf8');
for(const id of boss.BOSSES.map(b=>b.id)){assert(roster.some(r=>r.id===id&&r.role==='보스'&&r.pveOnly),'No boss roster or boss accidentally purchasable: '+id)}
for(const str of ["boss.open(g.round,players)","g.region='lab'","boss.settle(r)","boss.view(r.game.boss,p.slot,g.phase)","'/api/boss-done'","g.phase='combat';g.pve=true"]){assert(server.includes(str),'Missing authoritative boss phase: '+str)}
for(const str of ["function liveBossUi(net,slot)","teams.B=[{characterId:net.boss.id", "kind==='boss'?'lab'", "gameState.bossBuffs=pr.bossBuffs||{}", "bossBuffs:gameState.bossBuffs||{}", "liveBossUi(net,slot)","reportBossDone?.(roundState.round)","bossBuffs||{}"]){assert(client.includes(str),'Missing boss client synchronization: '+str)}
assert(multiplayer.includes("api('boss-done',{round})"));
for(const str of ["dst.role==='보스'", "config.boss.stats||{}", "config.persistent?.[u.team]?.bossBuffs||{}", "config.boss.interval", "bossPoisonUntil"]){assert(engine.includes(str),'Missing boss combat runtime: '+str)}
console.log('M8-05 BOSS UI CONTRACT PASS: real engine boss roster, server phase/settlement, correct replay arena/seed, persistent buffs, shared display, endpoint guards');
