'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),game=read('game.js'),ui=read('m1001-research-ui.js'),css=read('m1001-research-ui.css');
let passed=0;
const ok=(v,message)=>{assert.ok(v,message);passed++};
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);passed++};
// The patch is deliberately opt-in and must be able to fail back to M9-10.
ok(html.includes('m1001-research-ui.css')&&html.includes('m1001-research-ui.js'),'assets included in live entry');
ok(html.indexOf('m6-pixi-adapter.js')<html.indexOf('m1001-research-ui.js'),'adapter load order');
ok(ui.includes("const FLAG='live_m1001_optin'")&&ui.includes("forced==='1'")&&ui.includes("forced!=='0'"),'URL force + local preference + off override');
ok(ui.includes('window.LIVEM10UI')&&ui.includes('enable(){')&&ui.includes('disable(){'),'reversible opt-in API');
ok(ui.includes("if(!P()?.Application)")&&ui.includes('old shop restored'),'missing Pixi restores original');
ok(ui.includes('app.destroy(true,{children:true})')&&ui.includes('resizeObserver?.disconnect()'),'GPU resources cleaned on fallback');
ok(css.includes('.dock-center > .dock-shop{display:none!important}'),'only original shop presentation hidden');
ok(css.includes('.m1001-sell-zone.dock-shop'),'drop-to-sell legacy target preserved');
ok(ui.includes('m1001-screen-reader')&&ui.includes('aria-pressed'),'accessibility fallback controls');
ok(ui.includes('prefers-reduced-motion')===false&&css.includes('prefers-reduced-motion'),'global reduced motion stylesheet');
// Presentation reads; authoritative game handles mutations and server requests.
ok(game.includes('window.LIVEM10Bridge=Object.freeze'),'read-only bridge entry registered');
ok(game.includes('snapshot(){return {'),'snapshot exposed for rendering');
ok(game.includes('buy(index){if(Number.isInteger(index)&&index>=0&&index<gameState.shop.length)buyShop(index)}'),'all purchases go through existing buyShop');
ok(game.includes('reroll(){rerollShop()}')&&game.includes('lock(){toggleShopLock()}'),'reroll and lock delegate to original economy');
ok(ui.includes('getBridge()?.buy(offer.index)'),'Pixi cards wired to authoritative purchase');
ok(ui.includes("window.addEventListener('live:m10:economy',sync)"),'shop reacts to server/local rerender');
eq((game.match(/new Event\('live:m10:economy'\)/g)||[]).length,2,'initial or farm removal and normal rerender events');
ok(ui.includes('if(phase===\'prep\')')&&ui.includes('else g.alpha=.55'),'disabled graphics in non-prep phases');
ok(ui.includes('sprite.mask=mask')&&ui.includes("asset('assets/m10/ui/research-mark.svg')"),'actual sprite crop and SVG logo load');
for(const p of ['card-shell.svg','console-header.svg','research-mark.svg']){
 const file=read('assets/m10/ui/'+p);ok(file.startsWith('<svg')&&file.includes('</svg>'),'source-vector asset '+p);
}
// Imported source remains M9-10, not the old project snapshot.
ok(html.includes('L.I.V.E. M9-10')&&html.includes('m910-polish.css'),'M9-10 source base retained');
console.log('M10-01 QA PASS:',passed,'checks; isolated Pixi prototype, opt-in, original economy, failback, accessibility, SVG art sources.');
