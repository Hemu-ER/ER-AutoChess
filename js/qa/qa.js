'use strict';
(()=>{
 const $=id=>document.getElementById(id),names={stack:'보급 적재',zones:'섬 탐색',divide:'전리품 협상',bomb:'폭탄 해체',quiz:'도감 퀴즈'};
 let kind='stack',seed=1,engines=[],group=0,role='A',count=2;
 const current=()=>engines[group];
 function render(){const lab=current(),g=lab.snapshot().game;
 $('qaGameNav').innerHTML=Object.entries(names).map(([k,n])=>`<button data-select="${k}" class="qa-game-tab">${n}</button>`).join('');$('qaTitle').textContent=names[kind];$('qaGameType').textContent='M8-06 / SHARED RULES';$('qaDescription').textContent='2~8인 가상 참가자 · 역할별 조작 · 서버와 동일한 판정';$('qaSeedDisplay').textContent='SEED '+seed;
 $('qaParticipants').innerHTML=engines.map((e,i)=>`<button class="qa-cta secondary" data-group="${i}">조 ${i+1} · P${i*2+1} / ${i*2+2<=count?'P'+(i*2+2):'가상 파트너'}</button>`).join('');
 const focused=document.activeElement,values=[...($('qaStage').querySelectorAll?.('input')||[])].map(e=>({id:e.id,value:e.value,checked:e.checked,name:e.name,focus:e===focused,pos:e.selectionStart}));
 $('qaStage').innerHTML=lab.renderFor(role);$('qaHistory').innerHTML=lab.snapshot().history.map(t=>`<p>${String(t).replace(/</g,'&lt;')}</p>`).join('');
 for(const v of values){const el=v.id?$(v.id):[...document.querySelectorAll('input')].find(e=>e.name===v.name&&e.value===v.value);if(el){el.value=v.value;el.checked=v.checked;if(v.focus){el.focus?.();try{el.setSelectionRange?.(v.pos,v.pos)}catch{}}}}
 const t=$('qaTimeLeft');if(t)t.textContent=Math.max(0,Math.ceil((g.deadline-Date.now())/1000))+'s';
 }
 function start(k=kind,s){kind=k;seed=s??((Date.now()^Math.floor(Math.random()*2147483647))>>>0);group=0;role='A';$('qaStage').innerHTML='';engines=Array.from({length:Math.ceil(count/2)},(_,i)=>LIVEMinigame.create({kind,seed:seed+i,items:LIVEItems,roster:ERRoster}));render()}
 function act(a,v='',r){if(a==='view'){role=r;render();return}if(a==='replay'){start(kind,seed);return}const read=id=>$(id)?.value||'';current().dispatch(role,a,v,{credits:Number(read('qaShare')),exp:Number(read('qaExp')),items:[...document.querySelectorAll('input[name="qaGiveItem"]:checked')].map(e=>Number(e.value)),answer:read('qaQuizAnswer'),text:read('qaChatText')});render()}
 $('qaGameNav').addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b)start(b.dataset.select)});
 $('qaParticipants').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){group=Number(b.dataset.group);role='A';render()}});
 $('qaStage').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)act(b.dataset.action,b.dataset.val,b.dataset.role)});
 $('qaStage').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qaQuizAnswer')act('quizAnswer');if(e.key==='Enter'&&e.target.id==='qaChatText')act('chat')});
 $('qaStage').addEventListener('input',e=>{if(e.target.id==='qaCodexSearch'){current().snapshot().game.players[role].search=e.target.value;render()}if(e.target.id==='qaShare')$('qaShareOut').textContent=e.target.value+'C';if(e.target.id==='qaExp')$('qaExpOut').textContent=e.target.value+' EXP'});
 document.addEventListener('keydown',e=>{if(kind!=='stack'||e.target?.matches?.('input,textarea,select'))return;const a={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop'}[e.key];if(a){e.preventDefault?.();act(a)}});
 $('qaRestart').addEventListener('click',()=>start());$('qaReplay').addEventListener('click',()=>start(kind,seed));
 const select=$('qaPlayerCount');if(select)select.addEventListener('change',()=>{count=Number(select.value);start()});
 if(typeof setInterval==='function')setInterval(()=>{if(!current())return;for(const e of engines){e.tick();if($('qaBots')?.checked)e.auto('B')}if(count%2)engines.at(-1).auto('B');if(!document.activeElement?.matches?.('input,textarea,select'))render();else {const t=$('qaTimeLeft');if(t)t.textContent=Math.max(0,Math.ceil((current().snapshot().game.deadline-Date.now())/1000))+'s'}},250);
 window.LIVEQA={select:k=>start(k),restart:()=>start(kind,seed),snapshot:()=>current().snapshot(),act,participants:n=>{count=n;start()},repeat:(n=100)=>{const results=[];for(let i=0;i<n;i++){let time=0;const e=LIVEMinigame.create({kind,seed:seed+i,items:LIVEItems,roster:ERRoster,clock:{now:()=>time}});for(let j=0;j<100&&!e.snapshot().game.finished;j++){time=j*1000;e.tick();e.auto('A');e.auto('B')}results.push(e.snapshot().game.rewards)}return results},get internals(){return current().internals}};
 start();
})();
