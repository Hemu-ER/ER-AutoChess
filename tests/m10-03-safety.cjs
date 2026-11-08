'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const index=read('index.html'),game=read('game.js'),skin=read('m1003-industrial-skin.css');
let checked=0;
const check=(value,message)=>{assert.ok(value,message);checked++};
check(index.includes('m910-polish.css'),'M9-10 styling must load');
check(index.includes('m1003-industrial-skin.css'),'cosmetic layer is missing');
check(!/src="m100[12]-/.test(index),'M10-01/02 script still active');
check(!/href="m100[12]-/.test(index),'M10-01/02 CSS still active');
check(!game.includes('LIVEM10PrepBridge'),'M10-02 preparation bridge was not rolled back');
check(!game.includes('LIVEM10Bridge'),'M10-01 shop bridge was not rolled back');
check(game.includes('window.LIVEApplyGame'),'M9-10 online integration missing');
check(game.includes('m910ShopFocusUi()'),'M9-10 focus filter missing');
check(game.includes('function moveOwnedToCell('),'M9-10 drag-and-drop code missing');
check(game.includes('const rem=net.phase===\'augment-sync\'?0:'),'sentinel must not enter round UI countdown');
check(game.includes("augmentSync?'대기':"),'sync step must show waiting, not MAX_SAFE_INTEGER');
check(game.includes('net.earlyEndsAt||Infinity'),'early finish is not accounted for');
check(skin.includes('body[data-app-mode="game"]'),'skin must not globally restyle auth/lobby');
check(skin.includes('pointer-events:none;'),'decorative corners must not steal pointer events');
check(skin.includes('shop-card:has(.m910-focus-mark)'),'M9-10 shop interest marker must remain identifiable');
check(fs.existsSync(path.join(root,'assets/m10/ui/m1003-panel-grain.svg')),'missing SVG material asset');
check(index.includes("sessionStorage.setItem('live_m1003_skin',choice)"),'visual-only client rollback not available');
// Cosmetic changes may change colors, texture, shadow or border but not geometry.
// The only positioned element is a pointer-events:none decorative pseudo-element.
const blocks=skin.matchAll(/([^{}]+)\{([^{}]+)\}/g);
const forbidden=new Set(['display','position','top','right','bottom','left','width','height','min-width','min-height','max-width','max-height','margin','padding','overflow','grid','grid-template-columns','grid-template-rows','flex','align-items','justify-content','transform','box-sizing']);
for(const [,selector,decls] of blocks){
 if(selector.includes('::after')||selector.includes('::before'))continue;
 for(const declaration of decls.split(';')){
  const pos=declaration.indexOf(':');if(pos<0)continue;
  const prop=declaration.slice(0,pos).trim();
  if(forbidden.has(prop))throw Error('layout property in cosmetic skin: '+selector.trim()+' -> '+prop);
 }
}
checked++;
console.log(`M10-03 SAFETY QA PASS: ${checked} checks, M9-10 layout hooks retained, old scene disabled`);
