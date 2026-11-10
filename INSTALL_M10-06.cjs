#!/usr/bin/env node
'use strict';
/* L.I.V.E. M10-06 — additive, idempotent and backed-up installer.
   Deliberately avoids shipping a stale index.html: preserves M10-05 portrait
   updates and any other user-supplied scripts. Node.js is already required by
   the existing game server. */
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const index=path.join(root,'index.html');
function fail(s){console.error('M10-06 설치 중단:',s);process.exitCode=1;}
try {
 for(const file of ['m1006-visual-skin.css','m1006-ui-language.js',
 'assets/m10/ui/m1006-card-bezel.svg','assets/m10/ui/m1006-module-corners.svg',
 'assets/m10/ui/m1006-brushed-surface.svg','assets/m10/ui/m1006-button-inset.svg',
 'assets/m10/ui/m1006-slot-reticle.svg']){
  if(!fs.existsSync(path.join(root,file)))throw Error('필수 파일이 없습니다: '+file);
 }
 if(!fs.existsSync(index))throw Error('게임 폴더의 index.html을 찾을 수 없습니다. 게임 최상단 폴더에서 실행하십시오.');
 const before=fs.readFileSync(index,'utf8');
 const hasSkin=before.includes('id="m1006VisualSkin"');
 const hasLanguage=before.includes('src="m1006-ui-language.js"');
 if(hasSkin&&hasLanguage){console.log('M10-06이 이미 설치되어 있습니다. 기존 index.html을 변경하지 않았습니다.');process.exit(0)}
 if(hasSkin!==hasLanguage)throw Error('설치 내용이 일부만 존재합니다. index.html을 확인하십시오. 중복 삽입은 하지 않았습니다.');
 const skinAnchor=/<link\s+[^>]*href\s*=\s*["']m1004-graphic-skin\.css["'][^>]*>/i;
 const jsAnchor=/<script\s+[^>]*src\s*=\s*["']game\.js["'][^>]*>\s*<\/script>/i;
 if(!skinAnchor.test(before)||!jsAnchor.test(before))throw Error('M10-04 스타일 또는 game.js 연결을 찾지 못했습니다. 파일을 수정하지 않았습니다.');
 const skin=`\n<!-- M10-06: visual-only finish; retains the existing M9-10 / M10-05 layout. -->\n<link rel="stylesheet" href="m1006-visual-skin.css" id="m1006VisualSkin">\n<script>\n(function(){\n var s=document.getElementById('m1006VisualSkin');\n var q=new URLSearchParams(location.search).get('m1006skin');\n try {if(q==='0'||q==='1')sessionStorage.setItem('live_m1006_skin',q);\n      if(sessionStorage.getItem('live_m1006_skin')==='0')s.disabled=true;}\n catch(e){if(q==='0')s.disabled=true;}\n})();\n</script>`;
 const lang='\n<script src="m1006-ui-language.js"></script>';
 let after=before.replace(skinAnchor,m=>m+skin).replace(jsAnchor,m=>m+lang);
 // Preserve every original byte as an ordered subsequence around insertions.
 const reversed=after.replace(skin,'').replace(lang,'');
 if(reversed!==before)throw Error('삽입 전후 무결성 검사가 실패했습니다.');
 const time=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
 let backup=path.join(root,`index.M10-06.backup-${time}.html`);
 for(let n=1;fs.existsSync(backup);n++)backup=path.join(root,`index.M10-06.backup-${time}-${n}.html`);
 fs.copyFileSync(index,backup,fs.constants.COPYFILE_EXCL);
 const temp=index+'.m1006.tmp';
 fs.writeFileSync(temp,after,{encoding:'utf8',flag:'wx'});
 try { fs.renameSync(temp,index); }
 catch(err){ fs.rmSync(temp,{force:true});throw Error('파일 교체에 실패했습니다. 원본 백업: '+backup+' / '+err.message); }
 const readback=fs.readFileSync(index,'utf8');
 if(readback!==after)throw Error('설치 후 내용 검사에 실패했습니다. 즉시 원본 백업으로 복구하십시오: '+backup);
 console.log('M10-06 설치 완료! 원본 index.html 백업:',path.basename(backup));
 console.log('기존 초상화 스크립트와 구매·전투 로직을 보존했습니다.');
 console.log('화면 전환: ?m1006skin=0 (끄기), ?m1006skin=1 (켜기)');
} catch(e) {fail(e.message)}
