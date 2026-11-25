'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));
const roster=require('../js/shared/roster.js').roster;
const html=read('index.html');
assert(!html.includes('data:image/webp;base64,'),'inline portrait duplication removed');
assert(!html.includes('m1005Upscaled'),'portrait mutation observer removed');
for(const unit of roster){if(unit.asset?.sd)assert(exists(unit.asset.sd),unit.asset.sd);if(!unit.pveOnly)assert(exists(`assets/m10/shop-portraits/${unit.id}.webp`),unit.id)}
for(const zone of ['lab','alley','beach','cemetery','church','estate','forest','hotel','police','temple']){
 for(const folder of ['assets/battlefields/floor','assets/battlefields/pixi-floor'])assert(exists(`${folder}/${zone}.webp`),zone);
 assert(!exists(`assets/battlefields/floor/${zone}.png`));
}
assert(read('js/client/m6-pixi-adapter.js').includes('assets/battlefields/pixi-floor/'));
assert(read('js/qa/qa-combat.js').includes("${$('region').value}.webp"));
for(const folder of ['legacy','js/legacy','css/legacy','assets/m5','assets/battlefields/decor'])assert(!exists(folder)||fs.readdirSync(path.join(root,folder),{recursive:true}).every(p=>fs.statSync(path.join(root,folder,p)).isDirectory()),folder);
const fonts=read('css/base.css').match(/@font-face\{font-family:'Freesentation';/g);assert.equal(fonts.length,9);
console.log('M11-00 CLEANUP PASS: roster, portraits, floor variants, QA path, obsolete trees, font-face deduplication');
