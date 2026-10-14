'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {CombatEngine}=require('../combat-engine.js');
const {roster}=require('../roster.js');
const items=require('../items.js');
const src=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
assert.equal(items.baseNames.length,7);
assert.equal(items.recipes.length,28);
assert.match(src('m5-systems.js'),/star:o\.star,items:\[\.\.\.\(o\.equipment\|\|\[\]\)\]/);
assert.match(src('m5-online.js'),/api\('team',\{team,mastery\}\)/);
assert.match(src('m5-preview.js'),/masteryA:sorted\[0\]\?\.mastery\|\|1/);
assert.match(src('server.cjs'),/validRoster\.has\(u\.characterId\)/);
assert.match(src('server.cjs'),/LIVEItems\.all\[item\]/);
let count=0;
for(const u of roster.filter(r=>!r.pveOnly)){
 const result=new CombatEngine({teamA:[{characterId:u.id,x:1,y:1,star:1,items:['오토-암즈']}],teamB:[{characterId:'aya',x:1,y:1,star:1}],masteryA:5,masteryB:1,seed:100,moveInterval:.5,arenaRegion:'lab'}).run();
 assert.ok(result.outcome,`outcome ${u.id}`);count++;
}
console.log(`M5-12 regression PASS: ${count} playable combat engine smoke + items + integration source guards`);
