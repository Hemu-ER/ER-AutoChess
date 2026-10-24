'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const game=read('game.js'),pixi=read('m6-pixi-adapter.js'),floor=read('battlefield.js'),server=read('server.cjs');
const {roster}=require('../roster.js');
const playable=roster.filter(r=>r.asset?.sd);
// Assets are part of this *same patch*, never rely on old PNGs for the new optimized URLs.
for(const r of playable){assert.match(r.asset.sd,/\.webp$/);assert.ok(fs.statSync(path.join(root,r.asset.sd)).size>1000,'missing optimized sprite: '+r.asset.sd)}
for(const region of ['lab','alley','beach','cemetery','church','estate','forest','hotel','police','temple']){
 for(const folder of ['assets/m5/floor','assets/battlefields/floor'])assert.ok(fs.statSync(path.join(root,folder,region+'.webp')).size>1000);
}
assert.match(floor,/battlefields\/floor\/\$\{key\}\.webp/);
assert.match(pixi,/m5\/floor\/\$\{floorId\}\.webp/);
assert.match(server,/file\.endsWith\('\.webp'\)\?'public, max-age=86400'/);
// Only display sale amount during a dragging pointer inside the ordinary shop hitbox.
assert.doesNotMatch(game,/name\)\} · 판매 \+\$\{itemSalePrice\(name\)\}C/);
assert.doesNotMatch(game,/\| 판매 시 \+\$\{itemSalePrice/);
assert.match(game,/shop\.dataset\.sellHint=item\?`판매 \+\$\{itemSalePrice\(item\)\}C`/);
assert.match(game,/document\.body\.classList\.toggle\('shop-sell-active',!!shop\)/);
assert.match(game,/function cancelItemPointerDrag\([^)]*\)\{[^}]*classList\.remove\('shop-sell-active'\)/);
// R5 cards / result wait and non-combat special/intro are own-team formation, not 3x6.
assert.match(game,/\['prep','intro','supply','special'\]\.includes\(roundState\.phase\)/);
assert.match(game,/roundState\.phase==='result'&&liveRoundKind\(roundState\.round\)==='보급'/);
assert.match(game,/board\.classList\.toggle\('formation-board',prep\)/);
// Dead team / reset restores DOM art regardless of Pixi asynchronous state.
assert.match(pixi,/function showDomIfFormation/);
assert.match(pixi,/board\.classList\.remove\('m6-pixi-active'\)/);
assert.match(pixi,/if\(!list\.length\)\{board\.classList\.remove\('m6-pixi-active'\)/);
// Enemy equipment should render only in combat, from authoritative opponent team items.
assert.match(game,/u\.team==='B'&&roundState\.phase==='combat'/);
assert.match(game,/equippedSlots\(\{equipment:foe\.items\}\)/);
// Fallback large alpha analysis must be limited to <=240 sample width.
assert.match(game,/w=Math\.min\(240,ow\)/);
console.log('M8-03 VISUAL CONTRACT PASS: asset refs, sale drag-only, opponent gear, R5 wait layout, Pixi wipe recovery, pixel-scan cap');
