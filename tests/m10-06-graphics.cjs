'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let count=0;const ok=(v,description)=>{assert.ok(v,description);count++};
const css=read('m1006-visual-skin.css'),js=read('m1006-ui-language.js'),installer=read('INSTALL_M10-06.cjs');
for(const f of ['m1006-card-bezel.svg','m1006-module-corners.svg','m1006-brushed-surface.svg','m1006-button-inset.svg','m1006-slot-reticle.svg']){
 const s=read('assets/m10/ui/'+f);ok(s.includes('<svg')&&s.includes('</svg>'),'invalid SVG '+f);ok(css.includes(f),'SVG not referenced '+f);
}
for(const s of ['.game-bottom-dock','#roundModePanel','#currentSynergyPanel','#liveItemsPanel','#m809LiveHpStandings','.shop-card','.bench-unit','.econ-btn','#board.formation-board'])ok(css.includes(s),'missing visual hook '+s);
for(const s of ['COPYFILE_EXCL','backup-','m1004-graphic-skin','game.js','reversed!==before','m1006skin'])ok(installer.includes(s),'unsafe/absent installer guard '+s);
const noLayout=new Set(['display','position','top','right','left','bottom','width','height','min-width','max-width','min-height','max-height','margin','padding','gap','transform','grid','grid-template-columns','grid-template-rows','flex','align-items','justify-content','overflow','box-sizing']);
for(const [,sel,decl] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)){
 if(sel.includes('::before')||sel.includes('::after'))continue;
 for(const d of decl.split(';')){
  const i=d.indexOf(':');if(i<0)continue;const prop=d.slice(0,i).trim();ok(!noLayout.has(prop),'unexpected geometry change '+sel.trim().slice(0,80)+' '+prop);
 }
}
const sandbox={globalThis:{},document:{readyState:'loading',addEventListener:()=>{}}};vm.runInNewContext(js,sandbox);
const fmt=sandbox.globalThis.LIVEM1006Text?.honor;ok(typeof fmt==='function','polite copy API missing');
for(const [before,after] of [['벤치가 비어 있어.','벤치가 비어 있습니다.'],['서버가 지급한 첫 실험체를 동기화했어.','서버가 지급한 첫 실험체를 동기화했습니다.'],['상대를 기다리는 중…','상대를 기다리는 중…'],['온라인 방에 접속했어. 두 명이 준비하면 시작할 수 있어.','온라인 방에 접속했습니다. 두 명이 준비하면 시작할 수 있습니다.']])ok(fmt(before)===after,'polite translation: '+before);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'live-m1006-'));
try{
 for(const f of ['INSTALL_M10-06.cjs','m1006-visual-skin.css','m1006-ui-language.js'])fs.copyFileSync(path.join(root,f),path.join(tmp,f));
 for(const f of ['m1006-card-bezel.svg','m1006-module-corners.svg','m1006-brushed-surface.svg','m1006-button-inset.svg','m1006-slot-reticle.svg']){
  const dest=path.join(tmp,'assets/m10/ui');fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(path.join(root,'assets/m10/ui',f),path.join(dest,f));
 }
 let original=read('tests/m10-06-fixture.html');
 // Simulate the user's M10-05 face positioning injection: must survive untouched.
 original=original.replace('</body>',"<script id=\"m1005Portraits\">window.LIVEPortraitUserPositions={locked:true};</script></body>");
 fs.writeFileSync(path.join(tmp,'index.html'),original);
 cp.execFileSync(process.execPath,[path.join(tmp,'INSTALL_M10-06.cjs')]);
 const updated=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 const backups=fs.readdirSync(tmp).filter(x=>x.startsWith('index.M10-06.backup-'));
 ok(backups.length===1,'one backup not created');ok(fs.readFileSync(path.join(tmp,backups[0]),'utf8')===original,'backup differs');
 ok(updated.includes('window.LIVEPortraitUserPositions={locked:true}'),'M10-05 face coordinates were lost');
 ok(updated.includes('m1006-visual-skin.css')&&updated.includes('m1006-ui-language.js'),'new files not linked');
 const styleSnippet=updated.match(/\n<!-- M10-06: visual-only finish[\s\S]*?<\/script>/)?.[0]||'';
 const langSnippet='\n<script src="m1006-ui-language.js"></script>';
 ok(updated.replace(styleSnippet,'').replace(langSnippet,'')===original,'installer changed existing game source beyond additive links');
 cp.execFileSync(process.execPath,[path.join(tmp,'INSTALL_M10-06.cjs')]);
 ok(fs.readFileSync(path.join(tmp,'index.html'),'utf8')===updated,'reinstall should be idempotent');
 ok(fs.readdirSync(tmp).filter(x=>x.startsWith('index.M10-06.backup-')).length===1,'reinstall created unnecessary backup');
 // Missing CSS anchor must not modify/index or create backup.
 fs.writeFileSync(path.join(tmp,'index.html'),original.replace('m1004-graphic-skin.css','missing-skin.css'));
 const fail=cp.spawnSync(process.execPath,[path.join(tmp,'INSTALL_M10-06.cjs')]);
 ok(fail.status!==0,'unsafe install accepted unsupported base');
 ok(fs.readFileSync(path.join(tmp,'index.html'),'utf8')===original.replace('m1004-graphic-skin.css','missing-skin.css'),'unsupported index was modified');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log('M10-06 GRAPHICS QA PASS: '+count+' assertions; additive installer, backup, portrait preservation and honorific copy');
