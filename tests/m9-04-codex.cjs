'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),game=fs.readFileSync(path.join(root,'game.js'),'utf8'),qa=fs.readFileSync(path.join(root,'qa-combat.js'),'utf8'),catalogText=fs.readFileSync(path.join(root,'infusion-catalog.js'),'utf8');
const roster=require('../js/shared/roster.js').roster,items=require('../js/shared/items.js'),aug=require('../js/server/match-augment.cjs'),combat=require('../js/shared/combat-engine.js');
let checks=0;
const catalog=JSON.parse(catalogText.slice(catalogText.indexOf('=')+1).replace(/;\s*$/,'')),actual=Object.values(aug.CARDS).flat();
assert.deepEqual(catalog,actual,'browser codex catalog matches server canonical cards');checks++;
assert.equal(catalog.filter(x=>x.tier==='blue').length,31);checks++;
for(const c of catalog){assert.equal(typeof c.name,'string');assert(c.name.length>0);assert.equal(typeof c.description,'string');checks++}
const synergies=new Set(roster.filter(r=>!r.pveOnly).flatMap(r=>[...(r.affiliations||[]),r.role]).filter(Boolean));const textBlock=game.split('const SYNERGY_EFFECT_TEXT={')[1]?.split('};')[0];assert(textBlock,'synergy text map missing');
for(const s of synergies){assert(textBlock.includes('"'+s+'":')||textBlock.includes("'"+s+"':"),`synergy missing in codex: ${s}`);checks++}
for(const r of roster.filter(r=>!r.pveOnly)){assert(game.includes(r.id+':{active:')||game.includes("'"+r.id+"':{active:"),`no skill description: ${r.id}`);assert(combat.coefficients[r.id],`no skill coefficients ${r.id}`);checks+=2}
for(const [name,obj] of Object.entries(items.all)){if(name.includes('+'))continue;assert(obj.basic||Array.isArray(obj.materials)||name==='혈색반월',`item missing recipe ${name}`);if(obj.materials){assert.equal(items.craft(...obj.materials),name,`recipe mismatch ${name}`);checks+=2}else checks++}
assert(game.includes("'여행자'].includes(name)"),'traveler must use a unique condition, not 2/3');checks++;
assert(qa.includes('qaInfA')&&qa.includes('qaInfB'));checks++;
console.log(`M9-04 CODEX AUDIT PASS ${checks} checks · ${catalog.length} infusions, ${synergies.size} synergies/roles, ${roster.filter(r=>!r.pveOnly).length} player characters, ${Object.keys(items.all).length} inventory items`);
