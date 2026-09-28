"use strict";
const {roster,byId}=ERRoster;
const {CombatEngine,DT}=ERCombat;
const $=s=>document.querySelector(s),board=$("#board"),expandedMeters=new Set();
let teams={A:[],B:[]},battle=null,units=[],running=false,paused=false,time=0;
let speed=1,last=0,accumulator=0,frame=null;
const filters={A:{q:"",cost:"all",role:"all",aff:"all",status:"all"},B:{q:"",cost:"all",role:"all",aff:"all",status:"all"}};

function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function config(seed=+$("#seed").value){return {teamA:teams.A,teamB:teams.B,masteryA:+$("#masteryA").value,masteryB:+$("#masteryB").value,seed,moveInterval:+$("#moveInterval").value}}
function showError(e){$("#status").textContent=e.message}
function statusLabel(r){return r.implemented?"SKILL READY":"SKILL PENDING"}
function unique(field){return [...new Set(roster.flatMap(r=>field==="aff"?r.affiliations:[r[field]]))]}

function reset(){
 if(frame!==null)cancelAnimationFrame(frame); frame=null;
 running=false;paused=false;accumulator=0;time=0;battle=null;
 $("#pause").textContent="Ⅱ 일시정지";$("#clock").textContent="0.0s";$("#log").innerHTML="";
 try{units=new CombatEngine(config()).getResult().units;$("#status").textContent="배치 단계"}catch(e){units=[];showError(e)}
 renderTeams();render();meters();
}

function rosterFiltered(team){
 const f=filters[team];
 return roster.filter(r=>{
  const text=(r.name+" "+r.role+" "+r.affiliations.join(" ")).toLowerCase();
  return (!f.q||text.includes(f.q.toLowerCase())) &&
   (f.cost==="all"||r.cost===+f.cost) &&
   (f.role==="all"||r.role===f.role) &&
   (f.aff==="all"||r.affiliations.includes(f.aff)) &&
   (f.status==="all"||(f.status==="ready")===!!r.implemented);
 });
}
function selectOptions(values,current,allLabel){
 return `<option value="all">${allLabel}</option>`+values.map(v=>`<option value="${esc(v)}" ${String(current)===String(v)?"selected":""}>${esc(v)}</option>`).join("");
}
function teamSlot(team,e,i,disabled){
 const r=byId[e.characterId];
 return `<div class="team-slot">
  <div class="slot-id"><span class="mini-portrait">${r.name.slice(0,1)}</span><div><b>${esc(r.name)}</b><small>${r.cost}C · ${esc(r.role)}</small></div></div>
  <label>별<select data-star="${i}" ${disabled}>${[1,2,3].map(v=>`<option value="${v}" ${v===e.star?"selected":""}>${v}★</option>`).join("")}</select></label>
  <label>깊이<select data-x="${i}" ${disabled}>${["후열","중열","전열"].map((v,j)=>`<option value="${j}" ${j===e.x?"selected":""}>${v}</option>`).join("")}</select></label>
  <label>라인<select data-y="${i}" ${disabled}>${["왼쪽","중앙","오른쪽"].map((v,j)=>`<option value="${j}" ${j===e.y?"selected":""}>${v}</option>`).join("")}</select></label>
  <button class="remove" data-remove="${i}" ${disabled}>×</button>
 </div>`;
}
function rosterCard(team,r){
 const used=teams[team].some(e=>e.characterId===r.id),full=teams[team].length>=3;
 return `<button class="roster-card ${r.implemented?"ready":"pending"}" data-pick="${r.id}" ${running||used||full?"disabled":""}>
   <span class="portrait-placeholder" data-character="${r.id}"><span>${esc(r.name.slice(0,1))}</span></span>
   <span class="roster-info"><b>${esc(r.name)}</b><small>${r.cost}C · ${esc(r.role)}</small><small>${esc(r.affiliations.join(" / "))}</small></span>
   <span class="impl">${statusLabel(r)}</span>
 </button>`;
}
function renderTeams(){
 for(const team of ["A","B"]){
  const panel=$("#team"+team),f=filters[team],disabled=running?"disabled":"";
  panel.innerHTML=`<div class="team-head"><div><span>TEAM ${team}</span><h2>${team==="A"?"ALLY":"ENEMY"} SQUAD</h2></div><strong>${teams[team].length}/3</strong></div>
   <div class="selected-squad">${teams[team].length?teams[team].map((e,i)=>teamSlot(team,e,i,disabled)).join(""):`<div class="empty-squad">실험체를 선택해 팀을 편성해.</div>`}</div>
   <div class="roster-tools">
    <input class="search" data-filter="q" value="${esc(f.q)}" placeholder="이름 / 역할 / 소속 검색">
    <select data-filter="cost">${selectOptions([1,2,3],f.cost,"코스트 전체")}</select>
    <select data-filter="role">${selectOptions(unique("role"),f.role,"역할 전체")}</select>
    <select data-filter="aff">${selectOptions(unique("aff"),f.aff,"소속 전체")}</select>
    <select data-filter="status">${selectOptions(["ready","pending"],f.status,"구현 상태 전체").replace(">ready<",">스킬 구현<").replace(">pending<",">스킬 미구현<")}</select>
   </div>
   <div class="roster-grid">${rosterFiltered(team).map(r=>rosterCard(team,r)).join("")}</div>`;
  panel.querySelectorAll("[data-filter]").forEach(el=>el.onchange=el.oninput=()=>{filters[team][el.dataset.filter]=el.value;renderTeams()});
  panel.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{
   if(running||teams[team].length>=3)return;
   const id=b.dataset.pick;if(teams[team].some(e=>e.characterId===id))return;
   const pos=[2,1,0].flatMap(x=>[0,1,2].map(y=>({x,y}))).find(p=>!teams[team].some(e=>e.x===p.x&&e.y===p.y));
   teams[team].push({characterId:id,star:2,...pos});reset();
  });
  panel.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(!running){teams[team].splice(+b.dataset.remove,1);reset()}});
  for(const field of ["star","x","y"])panel.querySelectorAll(`[data-${field}]`).forEach(s=>s.onchange=()=>{
   if(running)return;
   const i=+s.dataset[field],updated={...teams[team][i],[field]:+s.value};
   if(teams[team].some((e,j)=>j!==i&&e.x===updated.x&&e.y===updated.y)){renderTeams();showError(new Error("이미 사용 중인 배치 칸입니다."));return}
   teams[team][i]=updated;reset();
  });
 }
 for(const id of ["masteryA","masteryB","moveInterval","seed","fixedSeed","batch"])$("#"+id).disabled=running;
}

function buildBoard(){
 board.innerHTML="";
 for(let y=0;y<3;y++)for(let x=0;x<6;x++){
  const c=document.createElement("div");
  c.className="cell "+(x<3?"teamA":"teamB")+(x===3?" divider":"");
  c.dataset.x=x;c.dataset.y=y;
  c.innerHTML=`<span class="coord">${x<3?"A":"B"} ${["왼","중앙","오른"][y]} · ${["후열","중열","전열","전열","중열","후열"][x]}</span>`;
  c.ondragover=e=>e.preventDefault();c.ondrop=e=>drop(e,c);board.appendChild(c);
 }
}
function drop(e,c){
 e.preventDefault();if(running||battle)return;
 const u=units.find(u=>u.id===e.dataTransfer.getData("text/plain"));if(!u)return;
 const globalX=+c.dataset.x,y=+c.dataset.y;if((u.team==="A"&&globalX>2)||(u.team==="B"&&globalX<3))return;
 const x=u.team==="A"?globalX:5-globalX,entry=teams[u.team].find(e=>e.characterId===u.characterId);
 if(teams[u.team].some(e=>e!==entry&&e.x===x&&e.y===y))return;
 Object.assign(entry,{x,y});reset();
}
function unitMarkup(u){
 const r=byId[u.characterId],hp=Math.max(0,u.hp/u.maxHp*100),low=hp<=30;
 return `<div class="ground-ring"></div>
  <div class="sd-slot" data-asset="${esc(r.asset?.sd||"")}"><div class="sd-silhouette"><span>${esc(u.name.slice(0,1))}</span></div></div>
  <div class="target-marker"></div><div class="hit-vfx"></div><div class="skill-vfx"></div>
  <div class="unit-hud">
   <div class="unit-top"><span class="unit-name">${esc(u.name)}</span><span class="stars">${"★".repeat(u.star)}</span></div>
   <div class="hpbar ${low?"low":""}"><i style="width:${hp}%"></i><em></em></div>
   <div class="unit-sub"><span>${u.role}</span><span>${Math.ceil(u.hp)} / ${Math.ceil(u.maxHp)}</span></div>
   ${!r.implemented?`<span class="pending-tag">SKILL PENDING</span>`:""}
  </div>`;
}
function render(){
 board.querySelectorAll(".unit").forEach(e=>e.remove());
 for(const u of units){
  const cell=board.querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);if(!cell)continue;
  const e=document.createElement("div");
  e.className=`unit ${u.team}${u.dead?" dead":""}${u.ccUntil>time?" cc":""}`;
  e.draggable=!running&&!battle;e.dataset.id=u.id;e.innerHTML=unitMarkup(u);
  e.ondragstart=event=>event.dataTransfer.setData("text/plain",u.id);cell.appendChild(e);
 }
}
function damageDetails(u){
 const row=(label,s)=>`<tr><th>${esc(label)}</th><td>${s.activations}회</td><td>${s.hits}회</td><td>${s.raw.toLocaleString("ko-KR",{maximumFractionDigits:1})}</td><td>${s.dealt.toLocaleString("ko-KR",{maximumFractionDigits:1})}</td></tr>`;
 const rows=Object.entries(u.damageSources).map(([name,s])=>row(name,s)+Object.entries(s.targets||{}).map(([id,t])=>row("↳ "+id,t)).join("")).join("");
 return `<div class="source-scroll"><table class="source-table"><caption>${esc(u.name)} — 총 피해 ${Object.values(u.damage).reduce((a,b)=>a+b,0).toFixed(1)}</caption><thead><tr><th>피해 출처 / 피격 대상</th><th>발동</th><th>적중</th><th>Raw</th><th>실제</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function meters(){
 for(const team of ["A","B"]){
  const root=$("#meter"+team),arr=units.filter(u=>u.team===team),max=Math.max(1,...arr.map(u=>Object.values(u.damage).reduce((a,b)=>a+b,0)));
  root.innerHTML=arr.map(u=>{const total=Object.values(u.damage).reduce((a,b)=>a+b,0),open=expandedMeters.has(u.id),id=esc(u.id);return `<div class="meter-row"><button class="meter-toggle" data-unit="${id}">${esc(u.name)} <span>${open?"접기":"상세"}</span></button><div class="meter-track"><div class="meter-fill" style="width:${total/max*100}%"></div></div><span>${total.toFixed(0)}</span></div><div ${open?"":"hidden"}>${damageDetails(u)}</div>`}).join("");
  root.onclick=e=>{const b=e.target.closest("button[data-unit]");if(!b)return;const id=b.dataset.unit;expandedMeters.has(id)?expandedMeters.delete(id):expandedMeters.add(id);meters()};
 }
}
function sync(){
 const result=battle.getResult();units=result.units;time=result.time;
 for(const event of battle.drainEvents())if(event.type==="log"){const line=document.createElement("div");line.innerHTML=`[${event.time.toFixed(1)}] ${event.message}`;$("#log").prepend(line)}
 $("#clock").textContent=time.toFixed(1)+"s";
 if(result.battleOver){running=false;$("#status").textContent=result.outcome;renderTeams()}
 render();meters();
}
function start(){
 if(running)return true;
 try{reset();const seed=$("#fixedSeed").checked?+$("#seed").value:Math.floor(Math.random()*2147483647);battle=new CombatEngine(config(seed));battle.start();running=true;paused=false;$("#status").textContent=`전투 중 · seed ${seed}`;renderTeams();sync();last=performance.now();frame=requestAnimationFrame(loop);return true}catch(e){battle=null;showError(e);return false}
}
function loop(now){
 if(!running){frame=null;return}
 const elapsed=Math.min(.15,(now-last)/1000)*speed;last=now;
 if(!paused){accumulator+=elapsed;while(accumulator+1e-9>=DT&&running){battle.step();accumulator-=DT;if(battle.getResult().battleOver)break}sync()}
 frame=running?requestAnimationFrame(loop):null;
}
function batch(){try{const counts={"A팀 승리":0,"B팀 승리":0,"무승부":0},base=+$("#seed").value;for(let i=0;i<100;i++)counts[new CombatEngine(config(base+i)).run().outcome]++;$("#batchResult").textContent=`A팀 ${counts["A팀 승리"]}% · B팀 ${counts["B팀 승리"]}% · 무승부 ${counts["무승부"]}%`}catch(e){showError(e)}}
$("#start").onclick=start;$("#pause").onclick=()=>{if(!running)return;paused=!paused;$("#pause").textContent=paused?"▶ 재개":"Ⅱ 일시정지"};
$("#step").onclick=()=>{if(!running&&!start())return;paused=true;$("#pause").textContent="▶ 재개";battle.step();battle.step();sync()};
$("#reset").onclick=reset;$("#speed").onchange=e=>speed=+e.target.value;$("#batch").onclick=batch;
for(const id of ["masteryA","masteryB","moveInterval","seed"])$("#"+id).onchange=reset;
buildBoard();reset();
