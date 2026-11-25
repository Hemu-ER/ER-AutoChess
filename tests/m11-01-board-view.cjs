'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {COLS,ROWS,valid,localToGlobal,globalToLocal,projection}=require('../js/client/board-view.js');
let count=0;const eq=(a,b)=>{assert.deepEqual(a,b);count++};const ok=x=>{assert.ok(x);count++};
for(const team of ['A','B'])for(let x=0;x<3;x++)for(let y=0;y<3;y++){
 const global=localToGlobal(team,x,y);eq(global,{x:team==='A'?x:5-x,y});eq(globalToLocal(team,global.x,global.y),{x,y});eq(globalToLocal(team==='A'?'B':'A',global.x,global.y),null);
}
for(const [x,y] of [[-1,0],[6,0],[0,-1],[0,3],[1.5,0],['2',0],[NaN,0]])eq(valid(x,y),false);
eq(localToGlobal('B',3,1),null);eq(globalToLocal('Z',0,0),null);
for(const prep of [true,false])for(const [w,h] of [[900,600],[640,350],[320,260],[1200,800]]){
 const p=projection(w,h,prep),n=prep?3:6;eq(p.n,n);
 const [a,b,c,d]=p.outline;ok(Math.abs(a.y-b.y)<1e-8&&Math.abs(c.y-d.y)<1e-8);ok(c.x-d.x>b.x-a.x);ok(Math.abs(a.x+b.x-w)<1e-7&&Math.abs(c.x+d.x-w)<1e-7);
 ok(p.point(.5,2.5).scale/p.point(.5,.5).scale>1.5);ok(p.point(.5,2.5).scale/p.point(.5,.5).scale<1.53);
 for(let y=0;y<ROWS;y++)for(let x=0;x<n;x++)for(const dx of [.01,.5,.99])for(const dy of [.01,.5,.99]){const q=p.point(x+dx,y+dy);eq(p.locate(q.x,q.y),{x,y});}
 for(const [x,y] of [[-.1,1],[n+.1,1],[1,-.1],[1,3.1]]){const q=p.point(x,y);eq(p.locate(q.x,q.y),null);}
 for(let y=0;y<3;y++)for(let x=0;x<n;x++){const q=p.point(x+.5,y+.5);ok(q.y-161*q.scale>=0);ok(q.y<=h);}
}
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('index.html');
assert(html.indexOf('src="js/client/board-view.js"')<html.indexOf('src="js/client/board-renderer.js"'));assert(html.indexOf('src="js/client/board-renderer.js"')<html.indexOf('src="js/client/game.js"'));
for(const f of ['js/client/m1007-client.js','js/client/m1016-combat-vfx.js'])assert(read(f).includes('boardView.'),f);
assert(!html.includes('pixi.js@')&&!html.includes('m6-pixi-adapter.js'));
assert(!/\b(gameState|roundState|CombatEngine|onlineEconomyAction|fetch)\b/.test(read('js/client/board-renderer.js')));
console.log(`M11-02 BOARD VIEW PASS: ${count} perspective and coordinate assertions; single renderer boundary`);
