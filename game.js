// Browser adapter: team entries always use local 3x3 coordinates.
'use strict';
const {roster,byId}=ERRoster;
const {CombatEngine,DT}=ERCombat;
const $=s=>document.querySelector(s),board=$('#board'),expandedMeters=new Set();
let teams={A:[],B:[]},battle=null,units=[],running=false,paused=false,time=0;
let speed=1,last=0,accumulator=0,frame=null;
function htmlEscape(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function config(seed=+$('#seed').value){return {teamA:teams.A,teamB:teams.B,masteryA:+$('#masteryA').value,masteryB:+$('#masteryB').value,seed,moveInterval:+$('#moveInterval').value}}
function showError(e){$('#status').textContent=e.message}
function reset(){
 if(frame!==null)cancelAnimationFrame(frame);frame=null;
 running=false;paused=false;accumulator=0;time=0;battle=null;
 $('#pause').textContent='Ⅱ 일시정지';$('#clock').textContent='0.0s';$('#log').innerHTML='';
 try{units=new CombatEngine(config()).getResult().units;$('#status').textContent='배치 단계'}catch(e){showError(e)}
 renderTeams();render();meters();
}
function renderTeams(){
 for(const team of ['A','B']){
  const panel=$('#team'+team),disabled=running?'disabled':'';
  panel.innerHTML=`<h2>${team}팀 · ${teams[team].length}/3</h2><label>실험체 <select class="roster-select" aria-label="${team}팀 실험체" ${disabled}><option value="">실험체 선택</option>${roster.map(r=>`<option value="${r.id}" ${!r.implemented||teams[team].some(e=>e.characterId===r.id)?'disabled':''}>${htmlEscape(r.name)} · ${r.cost}코${r.implemented?'':' · 미구현'}</option>`).join('')}</select></label><button class="add-unit" ${running||teams[team].length>=3?'disabled':''}>추가</button><div class="team-slots">${teams[team].map((e,i)=>`<div class="team-slot"><b>${htmlEscape(byId[e.characterId].name)}</b>${[['star','별',[1,2,3]],['x','깊이',['후열','중열','전열']],['y','라인',['왼쪽','중앙','오른쪽']]].map(([field,label,values])=>`<label>${label}<select data-${field}="${i}" aria-label="${team}팀 ${byId[e.characterId].name} ${label}" ${disabled}>${values.map((v,j)=>{const value=field==='star'?v:j;return `<option value="${value}" ${value===e[field]?'selected':''}>${v}${field==='star'?'★':''}</option>`}).join('')}</select></label>`).join('')}<button data-remove="${i}" ${disabled}>제거</button></div>`).join('')}</div>`;
  panel.querySelector('.add-unit').onclick=()=>{
   const characterId=panel.querySelector('.roster-select').value;
   if(running||!byId[characterId]?.implemented||teams[team].length>=3||teams[team].some(e=>e.characterId===characterId))return;
   const pos=[2,1,0].flatMap(x=>[0,1,2].map(y=>({x,y}))).find(p=>!teams[team].some(e=>e.x===p.x&&e.y===p.y));
   teams[team].push({characterId,star:2,...pos});reset();
  };
  panel.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(!running){teams[team].splice(+b.dataset.remove,1);reset()}});
  for(const field of ['star','x','y'])panel.querySelectorAll(`[data-${field}]`).forEach(s=>s.onchange=()=>{
   if(running)return;
   const i=+s.dataset[field],updated={...teams[team][i],[field]:+s.value};
   if(teams[team].some((e,j)=>j!==i&&e.x===updated.x&&e.y===updated.y)){renderTeams();showError(new Error('이미 사용 중인 배치 칸입니다.'));return}
   teams[team][i]=updated;reset();
  });
 }
 for(const id of ['masteryA','masteryB','moveInterval','seed','fixedSeed','batch'])$('#'+id).disabled=running;
}
function buildBoard(){
 board.innerHTML='';for(let y=0;y<3;y++)for(let x=0;x<6;x++){
  const c=document.createElement('div');c.className='cell '+(x<3?'teamA':'teamB')+(x===3?' divider':'');c.dataset.x=x;c.dataset.y=y;
  c.innerHTML=`<span class="coord">${x<3?'A':'B'} ${['왼','중앙','오른'][y]} · ${['후열','중열','전열','전열','중열','후열'][x]}</span>`;
  c.ondragover=e=>e.preventDefault();c.ondrop=e=>drop(e,c);board.appendChild(c);
 }
}
function drop(e,c){
 e.preventDefault();if(running||battle)return;
 const u=units.find(u=>u.id===e.dataTransfer.getData('text/plain'));if(!u)return;
 const globalX=+c.dataset.x,y=+c.dataset.y;if((u.team==='A'&&globalX>2)||(u.team==='B'&&globalX<3))return;
 const x=u.team==='A'?globalX:5-globalX,entry=teams[u.team].find(e=>e.characterId===u.characterId);
 if(teams[u.team].some(e=>e!==entry&&e.x===x&&e.y===y))return;
 Object.assign(entry,{x,y});reset();
}
function render(){
 board.querySelectorAll('.unit').forEach(e=>e.remove());
 for(const u of units){
  const cell=board.querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);if(!cell)continue;
  const e=document.createElement('div');e.className=`unit ${u.team}${u.dead?' dead':''}${u.ccUntil>time?' cc':''}`;e.draggable=!running&&!battle;e.dataset.id=u.id;
  e.innerHTML=`<div><div class="name">${htmlEscape(u.name)} <small>${u.star}★</small></div><div class="meta">${u.role} · 사거리 ${u.range}${u.channel?' · 집중중':''}</div></div><div><div class="hpbar"><i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i></div><div class="hptext">${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}</div></div>`;
  e.ondragstart=event=>event.dataTransfer.setData('text/plain',u.id);cell.appendChild(e);
 }
}
function damageDetails(u){
 const row=(label,s)=>`<tr><th scope="row">${htmlEscape(label)}</th><td>${s.activations}회</td><td>${s.hits}회</td><td>${s.raw.toLocaleString('ko-KR',{maximumFractionDigits:1})}</td><td>${s.dealt.toLocaleString('ko-KR',{maximumFractionDigits:1})}</td></tr>`;
 const rows=Object.entries(u.damageSources).map(([name,s])=>row(name,s)+Object.entries(s.targets||{}).map(([id,t])=>row('↳ '+id,t)).join('')).join('');
 return `<div class="source-scroll"><table class="source-table"><caption>${htmlEscape(u.name)} — 총 피해 ${Object.values(u.damage).reduce((a,b)=>a+b,0).toFixed(1)}</caption><thead><tr><th>피해 출처 / 피격 대상</th><th>발동</th><th>적중</th><th>Raw</th><th>실제</th></tr></thead><tbody>${rows}</tbody></table></div><p class="source-note">대상별 발동은 한 출처 발동이 그 대상에 피해 처리를 시도한 횟수입니다. 적중은 HP 피해가 양수인 이벤트 수입니다.</p>`;
}
function meters(){
 for(const team of ['A','B']){
  const root=$('#meter'+team),arr=units.filter(u=>u.team===team),max=Math.max(1,...arr.map(u=>Object.values(u.damage).reduce((a,b)=>a+b,0)));
  root.innerHTML=arr.map(u=>{const total=Object.values(u.damage).reduce((a,b)=>a+b,0),open=expandedMeters.has(u.id),id=htmlEscape(u.id);return `<div class="meter-row"><button class="meter-toggle" data-unit="${id}" aria-expanded="${open}" aria-controls="sources-${id}">${htmlEscape(u.name)} <span>${open?'접기':'상세'}</span></button><div class="meter-track"><div class="meter-fill" style="width:${total/max*100}%"></div></div><span>${total.toFixed(0)}</span></div><div id="sources-${id}"${open?'':' hidden'}>${damageDetails(u)}</div>`}).join('');
  root.onclick=e=>{const button=e.target.closest('button[data-unit]');if(!button)return;const id=button.dataset.unit;if(expandedMeters.has(id))expandedMeters.delete(id);else expandedMeters.add(id);meters()};
 }
}
function sync(){
 const result=battle.getResult();units=result.units;time=result.time;
 for(const event of battle.drainEvents())if(event.type==='log'){const line=document.createElement('div');line.innerHTML=`[${event.time.toFixed(1)}] ${event.message}`;$('#log').prepend(line)}
 $('#clock').textContent=time.toFixed(1)+'s';if(result.battleOver){running=false;$('#status').textContent=result.outcome;renderTeams()}
 render();meters();
}
function start(){
 if(running)return true;
 try{reset();const seed=$('#fixedSeed').checked?+$('#seed').value:Math.floor(Math.random()*2147483647);battle=new CombatEngine(config(seed));battle.start();running=true;paused=false;$('#status').textContent=`전투 중 · seed ${seed}`;renderTeams();sync();last=performance.now();frame=requestAnimationFrame(loop);return true}catch(e){battle=null;showError(e);return false}
}
function loop(now){
 if(!running){frame=null;return}const elapsed=Math.min(.15,(now-last)/1000)*speed;last=now;
 if(!paused){accumulator+=elapsed;while(accumulator+1e-9>=DT&&running){battle.step();accumulator-=DT;if(battle.getResult().battleOver)break}sync()}
 frame=running?requestAnimationFrame(loop):null;
}
function batch(){try{const counts={'A팀 승리':0,'B팀 승리':0,'무승부':0},base=+$('#seed').value;for(let i=0;i<100;i++)counts[new CombatEngine(config(base+i)).run().outcome]++;$('#batchResult').textContent=`A팀 ${counts['A팀 승리']}% · B팀 ${counts['B팀 승리']}% · 무승부 ${counts['무승부']}%`}catch(e){showError(e)}}
$('#start').onclick=start;$('#pause').onclick=()=>{if(!running)return;paused=!paused;$('#pause').textContent=paused?'▶ 재개':'Ⅱ 일시정지'};
$('#step').onclick=()=>{if(!running&&!start())return;paused=true;$('#pause').textContent='▶ 재개';battle.step();battle.step();sync()};
$('#reset').onclick=reset;$('#speed').onchange=e=>speed=+e.target.value;$('#batch').onclick=batch;
for(const id of ['masteryA','masteryB','moveInterval','seed'])$('#'+id).onchange=reset;
buildBoard();reset();
