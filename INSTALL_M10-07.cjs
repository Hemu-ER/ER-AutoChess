'use strict';
/* Transactional, source-preserving installer for a user's evolving GitHub checkout. */
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),self=__dirname;
const ops=JSON.parse(fs.readFileSync(path.join(self,'m1007-patches.json'),'utf8'));
const files=new Map();
function read(rel){const p=path.join(root,rel);if(!fs.existsSync(p))throw Error('필수 파일을 찾을 수 없습니다: '+rel);return fs.readFileSync(p,'utf8')}
function stage(rel,content){files.set(rel,content)}
try{
 for(const o of ops){let s=files.has(o.file)?files.get(o.file):read(o.file);
  const occurrences=s.split(o.old).length-1;
  if(s.includes(o.new))continue; // Already patched — including when the new block contains old text.
  if(!occurrences||(!o.all&&occurrences!==1))throw Error(`${o.file}: ${o.label} 호환성 검사 실패 (일치 ${occurrences}개). 파일은 변경되지 않았습니다.`);
  s=o.all?s.split(o.old).join(o.new):s.replace(o.old,o.new);
  stage(o.file,s);
 }
 let html=read('index.html');
 if(!html.includes('<script src="game.js"></script>'))throw Error('현재 index.html에서 game.js 로딩 순서를 찾지 못했습니다. 안전하게 중단합니다.');
 if(!html.includes('m1004-graphic-skin.css'))throw Error('M10-04 이후의 소스에서만 적용할 수 있습니다.');
 const link=(href,id)=>`<link rel="stylesheet" href="${href}" id="${id}">`;
 const script=name=>`<script defer src="${name}"></script>`;
 const newLinks=[];
 if(!html.includes('m1006-visual-skin.css')&&fs.existsSync(path.join(root,'m1006-visual-skin.css')))newLinks.push(link('m1006-visual-skin.css','m1006GraphicSkin'));
 if(!html.includes('m1007-graphics.css'))newLinks.push(link('m1007-graphics.css','m1007GraphicSkin'));
 if(newLinks.length)html=html.replace('</head>',newLinks.join('\n')+'\n</head>');
 const newScripts=[];
 if(!html.includes('m1006-ui-language.js')&&fs.existsSync(path.join(root,'m1006-ui-language.js')))newScripts.push(script('m1006-ui-language.js'));
 if(!html.includes('m1007-client.js'))newScripts.push(script('m1007-client.js'));
 if(newScripts.length)html=html.replace('</body>',newScripts.join('\n')+'\n</body>');
 // When a user opted out from old M10-06 styles, leave that opt-out intact.
 if(html!==read('index.html'))stage('index.html',html);
 const staticFiles=['m1007-graphics.css','m1007-client.js','m1007-board-engraving.svg','m1007-slot-mark.svg','tests/m10-07-regression.cjs','tests/m10-07-api.cjs','tests/m10-07-language.cjs'];
 for(const f of staticFiles){const source=fs.readFileSync(path.join(self,f));const dest=path.join(root,f);if(!fs.existsSync(dest)||!fs.readFileSync(dest).equals(source))stage(f,source)}
 if(!files.size){console.log('M10-07: 이미 설치된 상태입니다.');process.exit(0)}
 const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
 const backup=path.join(path.dirname(root),`${path.basename(root)}-M10-07-backup-${stamp}`);
 fs.mkdirSync(backup,{recursive:true});
 for(const file of files.keys()){const p=path.join(root,file);if(fs.existsSync(p)){const to=path.join(backup,file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(p,to)}}
 for(const [file,content] of files){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});const temp=dest+'.m1007-tmp';fs.writeFileSync(temp,content);fs.renameSync(temp,dest)}
 console.log(`M10-07 설치 완료: ${files.size}개 파일. 원본 백업: ${backup}`);
 console.log('게임 서버 재시작 및 Ctrl+F5 후, GitHub 반영을 원하면 변경 파일을 커밋해 주세요.');
}catch(e){console.error('M10-07 안전 설치 중단:',e.message);process.exitCode=1}
