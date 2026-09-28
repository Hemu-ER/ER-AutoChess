// ER Auto Chess combat sandbox v0.2 — six-unit audited build.
// Source basis: character detail v1.1 + integrated v0.2 coefficients + later QA changes.
// IMPORTANT: movement interval, Rio distance curve, Marcus quake CC duration remain QA provisional.
const BOARD_W=6, BOARD_H=3, DT=.05;
const roster={
 '슈린':{team:'A',cost:3,role:'전사',aff:['수영복'],hp:965,atk:80,def:31,as:.98,amp:34,range:1,main:'atk'},
 '마커스':{team:'A',cost:2,role:'탱커',aff:['수영복'],hp:1260,atk:60,def:53,as:.75,amp:24,range:1,main:'atk'},
 '유민':{team:'A',cost:2,role:'원거리 스킬',aff:['수영복'],hp:755,atk:48,def:20,as:.80,amp:122,range:3,main:'amp'},
 '니키':{team:'B',cost:3,role:'전사',aff:['바니걸'],hp:1010,atk:62,def:38,as:.86,amp:104,range:1,main:'amp'},
 '리오':{team:'B',cost:2,role:'원거리 평타',aff:['바니걸'],hp:735,atk:76,def:18,as:1.08,amp:24,range:3,main:'atk'},
 '유스티나':{team:'B',cost:1,role:'원거리 스킬',aff:['바니걸','에레보스'],hp:770,atk:51,def:21,as:.84,amp:112,range:3,main:'amp'}
};
const starts={슈린:[2,1],마커스:[2,0],유민:[0,2],니키:[3,1],리오:[4,0],유스티나:[5,2]};
const star2={hp:1.7,atk:1.7,amp:1.7,def:1.15,as:1.05};
const QA={moveInterval:.5,rioDistance:{1:1,2:2/3,3:1/3},marcusCc:1.0};
const coef={
 슈린:{aoe:2.50,resolve:1.50},
 마커스:{quake:2.00,shock:2.00},
 유민:{start:1.50,windDot:.60,windExtra:1.00},
 니키:{hot:.30,guardChance:.20,counter:1.00},
 리오:{shot:4.00,kaeyumiMax:.40},
 // QA nerf confirmed in conversation after v0.2 document
 유스티나:{bomb:.95,boost:.50}
};
// Source metadata only; recording/rendering work for every unit through the same API.
const sourceCatalog={
 '슈린':{결심응진:'passive',만검귀종:'skill'},
 '마커스':{지각변동:'skill','전사의 투지':'passive'},
 '유민':{풍류운산:'skill','풍류운산 행동 불능':'skill','바람 지속 피해':'passive','바람 추가 피해':'passive'},
 '니키':{'가드&카운터':'passive',다혈질:'passive'},
 '리오':{정사필중:'skill','정사필중 정신 집중':'skill'},
 '유스티나':{'섬멸 포격':'skill','강화 기본 공격':'passive'}
};
function sourceStats(u,sourceName,kind){
 if(!u.damageSources[sourceName])u.damageSources[sourceName]={kind,activations:0,hits:0,raw:0,dealt:0};
 return u.damageSources[sourceName];
}
function activateSource(u,sourceName,kind){sourceStats(u,sourceName,kind).activations++}
function recordSourceDamage(u,sourceName,kind,raw,dealt){
 let entry=sourceStats(u,sourceName,kind);
 entry.raw+=raw;entry.dealt+=dealt;if(dealt>0)entry.hits++;
}
function resetSourceStats(u){
 u.damageSources=Object.create(null);
 sourceStats(u,'기본 공격','basic');
 for(let [name,kind] of Object.entries(sourceCatalog[u.name]||{}))sourceStats(u,name,kind);
 for(let name of u.aff)if(name==='수영복'||name==='바니걸')sourceStats(u,name,'synergy');
}
const expandedMeters=new Set();
let units=[],time=0,running=false,paused=false,last=0,speed=1,rng=Math.random,battleOver=false,silent=false;
let stage={A:{},B:{}},shared={A:{swim:0},B:{swim:0}};
const $=s=>document.querySelector(s),board=$('#board');
function seeded(seed){let x=seed|0;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeUnit(n,mastery,pos=starts[n]){let r=roster[n],m=1+(mastery-1)*.01;let u={id:n,name:n,team:r.team,role:r.role,aff:[...r.aff],range:r.range,main:r.main,star:2,x:pos[0],y:pos[1],initialX:pos[0],initialY:pos[1]};u.base={hp:r.hp*star2.hp*m,atk:r.atk*star2.atk*m,def:r.def*star2.def*m,as:r.as*star2.as*m,amp:r.amp*star2.amp*m};resetCombatState(u);return u}
function resetCombatState(u){u.maxHp=u.base.hp;u.hp=u.maxHp;u.atk=u.base.atk;u.def=u.base.def;u.as=u.base.as;u.amp=u.base.amp;u.basicCount=0;u.nextAttack=Infinity;u.nextMove=+($('#moveInterval')?.value||QA.moveInterval);u.damage={basic:0,skill:0,passive:0,synergy:0};resetSourceStats(u);u.dead=false;u.ccUntil=0;u.channel=null;u.hot=false;u.boost=false;u.shurin={phase:'normal',normalAttacks:0,resolveUses:0,burstUntil:0,totalResolveUses:0,totalAoeUses:0};u.wind={};u.nextWindTick=1;u.yuminCcDone=false;u.nextQuake=10;u.shock=false;u.nextShot=8;u.shotTarget=null}
function roleBuff(u){let depth=u.team==='A'?u.initialX:5-u.initialX;if(u.role==='전사'&&depth>=1){u[u.main==='atk'?'atk':'amp']*=1.15;u.as*=1.10;u.def+=10;u.maxHp*=1.10;u.hp=u.maxHp}if(u.role==='탱커'&&depth===2){u.def+=20;u.maxHp*=1.20;u.hp=u.maxHp;u.as*=1.10}if(u.role==='원거리 평타'&&depth<=1){u.atk*=1.20;u.as*=1.20}if(u.role==='원거리 스킬'&&depth<=1){u.amp*=1.25;u.as*=1.10}}
function lockSynergies(){for(let team of ['A','B']){let own=units.filter(u=>u.team===team);stage[team]={수영복:own.filter(u=>u.aff.includes('수영복')).length,바니걸:own.filter(u=>u.aff.includes('바니걸')).length};shared[team]={swim:0}}}
function prepareBattle(){let ma=+$('#masteryA').value,mb=+$('#masteryB').value;let positions=Object.fromEntries(units.map(u=>[u.name,[u.x,u.y]]));units=Object.keys(roster).map(n=>makeUnit(n,roster[n].team==='A'?ma:mb,positions[n]||starts[n]));units.forEach(u=>{u.initialX=u.x;u.initialY=u.y;roleBuff(u)});lockSynergies();for(let u of units)u.nextAttack=1/currentAs(u,null); // first basic occurs after one attack interval
 // Yumin: immediate one-shot start AoE
 for(let u of units.filter(x=>x.name==='유민')){activateSource(u,'풍류운산','skill');for(let e of enemies(u))damage(u,e,u.amp*coef.유민.start,'skill',false,{guardable:true,sourceName:'풍류운산'});log(`${u.name} <b>풍류운산</b> — 적 전체 피해`)}}
function reset(){running=false;paused=false;battleOver=false;time=0;$('#clock').textContent='0.0s';$('#status').textContent='배치 단계';$('#log').innerHTML='';let ma=+$('#masteryA').value,mb=+$('#masteryB').value;units=Object.keys(roster).map(n=>makeUnit(n,roster[n].team==='A'?ma:mb));render();meters()}
function buildBoard(){board.innerHTML='';for(let y=0;y<3;y++)for(let x=0;x<6;x++){let c=document.createElement('div');c.className='cell '+(x<3?'teamA':'teamB')+(x===3?' divider':'');c.dataset.x=x;c.dataset.y=y;c.innerHTML=`<span class=coord>${x<3?'A':'B'} ${['왼','중앙','오른'][y]} · ${depthName(x)}</span>`;c.ondragover=e=>e.preventDefault();c.ondrop=e=>drop(e,c);board.appendChild(c)}}
function depthName(x){return ['후열','중열','전열','전열','중열','후열'][x]}
function render(){if(silent)return;if(!board.children.length)buildBoard();[...board.querySelectorAll('.unit')].forEach(e=>e.remove());for(let u of units){let cell=board.querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);if(!cell)continue;let e=document.createElement('div');e.className=`unit ${u.team}${u.dead?' dead':''}${u.ccUntil>time?' cc':''}`;e.draggable=!running;e.dataset.id=u.id;e.innerHTML=`<div><div class=name>${u.name} <small>2★</small></div><div class=meta>${u.role} · 사거리 ${u.range}${u.channel?' · 집중중':''}</div></div><div><div class=hpbar><i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i></div><div class=hptext>${Math.ceil(Math.max(0,u.hp))} / ${Math.ceil(u.maxHp)}</div></div>`;e.ondragstart=ev=>ev.dataTransfer.setData('text/plain',u.id);cell.appendChild(e)}}
function drop(e,c){if(running)return;let u=units.find(z=>z.id===e.dataTransfer.getData('text/plain')),x=+c.dataset.x,y=+c.dataset.y;if(!u||(u.team==='A'&&x>2)||(u.team==='B'&&x<3)||units.some(z=>z!==u&&!z.dead&&z.x===x&&z.y===y))return;u.x=x;u.y=y;u.initialX=x;u.initialY=y;render()}
function dist(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))}function adjacent(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1}function enemies(u){return units.filter(v=>!v.dead&&v.team!==u.team)}
function target(u,ignoreRange=false){let es=enemies(u).filter(v=>ignoreRange||dist(u,v)<=u.range);if(!es.length)return null;es.sort((a,b)=>{let sameA=a.y===u.y?0:1,sameB=b.y===u.y?0:1;return sameA-sameB||dist(u,a)-dist(u,b)||a.hp-b.hp||a.def-b.def||(b.y-a.y)});return es[0]}
function nearestEnemy(u){return enemies(u).sort((a,b)=>dist(u,a)-dist(u,b)||a.hp-b.hp||a.def-b.def||(b.y-a.y))[0]||null}
function actual(raw,def){return raw*100/(100+Math.max(0,def))}function adaptive(u){return u.main==='atk'?currentAtk(u):currentAmp(u)}function currentAtk(u){return u.atk*(u.name==='니키'&&u.hot?1+coef.니키.hot:1)}function currentAmp(u){return u.amp*(u.name==='니키'&&u.hot?1+coef.니키.hot:1)}
function currentAs(u,t){let a=u.as;if(u.name==='니키'&&u.hot)a*=1+coef.니키.hot;if(u.name==='리오'&&t){let frac=QA.rioDistance[dist(u,t)]||0;a*=1+coef.리오.kaeyumiMax*frac}return Math.min(4,a)}
function applyCC(u,dur){u.ccUntil=Math.max(u.ccUntil,time+dur);if(u.channel){log(`${u.name} 정신 집중 <b>중단</b>`);if(u.name==='리오')u.nextShot=time+8;u.channel=null}}
function damage(src,dst,raw,kind='basic',fixed=false,opt={}){if(dst.dead)return 0;let r=raw;if(!fixed&&opt.guardable!==false&&dst.name==='니키'&&(kind==='basic'||kind==='skill')&&rng()<coef.니키.guardChance){r*=.20;activateSource(dst,'가드&카운터','passive');let counterRaw=currentAmp(dst)*coef.니키.counter,counter=actual(counterRaw,src.def);let ce=Math.min(src.hp,counter);src.hp-=counter;dst.damage.passive+=ce;recordSourceDamage(dst,'가드&카운터','passive',counterRaw,ce);flash(src,Math.round(ce));log(`니키 <b>가드&카운터</b>`);if(src.hp<=0){src.hp=0;src.dead=true;log(`니키 → <b>${src.name}</b> 처치`)}}
 let d=fixed?r:actual(r,dst.def),eff=Math.min(Math.max(0,dst.hp),d);dst.hp-=d;src.damage[kind]+=eff;recordSourceDamage(src,opt.sourceName||({basic:'기본 공격',skill:'스킬',passive:'패시브',synergy:'시너지'}[kind]),kind,raw,eff);flash(dst,Math.round(eff));if(dst.name==='니키'&&!dst.hot&&dst.hp>0&&dst.hp<=dst.maxHp*.5){dst.hot=true;activateSource(dst,'다혈질','passive');log(`니키 <b>다혈질</b> 발동`)}if(dst.hp<=0){dst.hp=0;dst.dead=true;log(`${src.name} → <b>${dst.name}</b> 처치`)}return eff}
function heal(u,amt){if(u.dead)return;u.hp=Math.min(u.maxHp,u.hp+amt)}
function flash(u,n){if(silent)return;let el=board.querySelector(`.unit[data-id="${u.id}"]`);if(!el)return;el.classList.add('hit');setTimeout(()=>el.classList.remove('hit'),100);let f=document.createElement('span');f.className='float';f.textContent='-'+n;f.style.left='35%';f.style.top='30%';el.appendChild(f);setTimeout(()=>f.remove(),700)}
function bunny(u,t){let count=stage[u.team].바니걸||0;if(!u.aff.includes('바니걸')||count<2||t.dead)return;let chance=count>=3?.35:.20,ratio=count>=3?.50:.40;if(rng()<chance){activateSource(u,'바니걸','synergy');damage(u,t,adaptive(u)*ratio,'synergy',false,{guardable:false,sourceName:'바니걸'})}}
function swimsuit(u){let count=stage[u.team].수영복||0;if(!u.aff.includes('수영복')||count<2)return;shared[u.team].swim++;let need=count>=3?15:20,ratio=count>=3?.05:.03;if(shared[u.team].swim>=need){shared[u.team].swim=0;activateSource(u,'수영복','synergy');for(let e of enemies(u))damage(u,e,e.maxHp*ratio,'synergy',true,{guardable:false,sourceName:'수영복'});log(`<b>${count}수영복</b> 발동`)}}
function basicAttack(u,t){u.basicCount++;activateSource(u,'기본 공격','basic');let dealt=damage(u,t,currentAtk(u),'basic',false,{guardable:true,sourceName:'기본 공격'});bunny(u,t);swimsuit(u);
 // Yumin passive: attack adds wind; extra damage only if target was already at max stacks.
 if(u.name==='유민'&&!t.dead){let before=u.wind[t.id]||0;if(before>=2){activateSource(u,'바람 추가 피해','passive');damage(u,t,currentAmp(u)*coef.유민.windExtra,'passive',false,{guardable:false,sourceName:'바람 추가 피해'})};u.wind[t.id]=Math.min(2,before+1)}
 // Justina: boosted basic does not alter counter beyond this genuine basic; every 2 basics fires column bombardment.
 if(u.name==='유스티나'){if(u.boost&&!t.dead){activateSource(u,'강화 기본 공격','passive');damage(u,t,currentAmp(u)*coef.유스티나.boost,'passive',false,{guardable:false,sourceName:'강화 기본 공격'});u.boost=false}if(u.basicCount>=2){u.basicCount=0;activateSource(u,'섬멸 포격','skill');for(let e of enemies(u).filter(e=>e.y===t.y))damage(u,e,currentAmp(u)*coef.유스티나.bomb,'skill',false,{guardable:true,sourceName:'섬멸 포격'});u.boost=true;log(`유스티나 <b>섬멸 포격</b> — ${['왼쪽','중앙','오른쪽'][t.y]} 열`)}}
 if(u.name==='슈린')shurinBasic(u,t);
 // Marcus shock consume
 if(u.name==='마커스'&&t.shock&&!t.dead){t.shock=false;activateSource(u,'전사의 투지','passive');damage(u,t,currentAtk(u)*coef.마커스.shock,'passive',false,{guardable:false,sourceName:'전사의 투지'});applyCC(t,.5);log(`마커스 <b>전사의 투지</b> — 충격 소비`)}
}
function shurinBasic(u,t){
 let s=u.shurin;
 if(s.phase==='burst'&&time>=s.burstUntil){
  s.phase='normal';s.normalAttacks=0;s.burstUntil=0;
 }
 if(s.phase==='normal'){
  s.normalAttacks++;
  if(s.normalAttacks===3)s.phase='ready';
  return;
 }
 // Ready/burst attacks never count toward the next three normal basics.
 // A lethal basic still consumes Resolve; only actual extra damage heals.
 activateSource(u,'결심응진','passive');
 let dealt=damage(u,t,currentAtk(u)*coef.슈린.resolve,'passive',false,{guardable:false,sourceName:'결심응진'});
 heal(u,dealt*.5);
 s.totalResolveUses++;
 log(`슈린 <b>결심응진</b> — ${s.totalResolveUses}회 · 추가 피해 ${dealt.toFixed(1)}${s.phase==='burst'?' (만검귀종 강화)':''}`);
 if(s.phase==='burst')return;
 s.normalAttacks=0;s.resolveUses++;
 if(s.resolveUses<3){s.phase='normal';return}
 s.resolveUses=0;s.phase='burst';s.burstUntil=time+3;s.totalAoeUses++;activateSource(u,'만검귀종','skill');
 for(let e of enemies(u).filter(e=>adjacent(u,e)))damage(u,e,currentAtk(u)*coef.슈린.aoe,'skill',false,{guardable:true,sourceName:'만검귀종'});
 log(`슈린 <b>만검귀종</b> — ${s.totalAoeUses}회`);
}
function move(u){
 let t=nearestEnemy(u);
 if(!t||target(u))return;
 let dir=u.team==='A'?1:-1,nx=u.x+dir;
 let vacant=(x,y)=>x>=0&&x<BOARD_W&&y>=0&&y<BOARD_H&&!units.some(v=>!v.dead&&v.x===x&&v.y===y);
 // Prefer forward progress, but never march past the enemy being pursued.
 if((t.x-u.x)*dir>0&&vacant(nx,u.y)){
  u.x=nx;log(`${u.name} 전진`);return;
 }
 // Forward is blocked or cannot approach: change only the lane by one cell.
 let ny=u.y+Math.sign(t.y-u.y);
 if(ny!==u.y&&vacant(u.x,ny)){
  u.y=ny;log(`${u.name} 라인 이동`);
 }
}
function periodicAndSkills(){for(let u of units){if(u.dead)continue;
 // Yumin: 1s delayed global CC and per-second Wind DoT.
 if(u.name==='유민'){if(!u.yuminCcDone&&time>=1){u.yuminCcDone=true;activateSource(u,'풍류운산 행동 불능','skill');for(let e of enemies(u))applyCC(e,.5);log(`유민 <b>풍류운산</b> — 0.5초 행동 불능`)}if(time+1e-9>=u.nextWindTick){while(time+1e-9>=u.nextWindTick)u.nextWindTick+=1;if(enemies(u).some(e=>(u.wind[e.id]||0)>0))activateSource(u,'바람 지속 피해','passive');for(let e of enemies(u)){if((u.wind[e.id]||0)>0)damage(u,e,currentAmp(u)*coef.유민.windDot,'passive',false,{guardable:false,sourceName:'바람 지속 피해'})}}}
 // Marcus: every 10s global quake, CC + Shock.
 if(u.name==='마커스'&&time+1e-9>=u.nextQuake&&u.ccUntil<=time){u.nextQuake+=10;activateSource(u,'지각변동','skill');for(let e of enemies(u)){damage(u,e,currentAtk(u)*coef.마커스.quake,'skill',false,{guardable:true,sourceName:'지각변동'});if(!e.dead){applyCC(e,QA.marcusCc);e.shock=true}}log(`마커스 <b>지각변동</b>`) }
 // Rio: every 8s start 0.5s channel; on completion nearest target + adjacent half damage.
 if(u.name==='리오'){if(u.channel&&u.channel.type==='shot'&&time+1e-9>=u.channel.ends){let t=nearestEnemy(u);u.channel=null;if(t){activateSource(u,'정사필중','skill');damage(u,t,currentAtk(u)*coef.리오.shot,'skill',false,{guardable:true,sourceName:'정사필중'});for(let e of enemies(u).filter(e=>e!==t&&adjacent(e,t)))damage(u,e,currentAtk(u)*coef.리오.shot*.5,'skill',false,{guardable:true,sourceName:'정사필중'});log(`리오 <b>정사필중</b>`)} }else if(!u.channel&&time+1e-9>=u.nextShot&&u.ccUntil<=time){u.nextShot+=8;activateSource(u,'정사필중 정신 집중','skill');u.channel={type:'shot',ends:time+.5};log(`리오 <b>정사필중</b> 정신 집중`)}}
 }}
function tick(dt){if(battleOver)return;time+=dt;periodicAndSkills();let snapshot=units.filter(u=>!u.dead);for(let u of snapshot){if(u.dead||u.ccUntil>time||u.channel)continue;let t=target(u);if(t&&time+1e-9>=u.nextAttack){basicAttack(u,t);u.nextAttack=time+1/currentAs(u,t)}else if(!t&&time+1e-9>=u.nextMove){move(u);u.nextMove=time+(+$('#moveInterval').value||QA.moveInterval)}}
 let a=units.some(u=>u.team==='A'&&!u.dead),b=units.some(u=>u.team==='B'&&!u.dead);if(!a||!b||time>=60){battleOver=true;running=false;let result=!a&&!b?'무승부':a?'A팀 승리':b?'B팀 승리':timeoutResult();$('#status').textContent=result;log(`<b>${result}</b> · ${time.toFixed(1)}초`)}render();meters();if(!silent)$('#clock').textContent=time.toFixed(1)+'s'}
function timeoutResult(){let a=units.filter(u=>u.team==='A').reduce((s,u)=>s+Math.max(0,u.hp)/u.maxHp,0),b=units.filter(u=>u.team==='B').reduce((s,u)=>s+Math.max(0,u.hp)/u.maxHp,0);return Math.abs(a-b)<1e-9?'무승부':a>b?'A팀 승리':'B팀 승리'}
function start(){if(battleOver)reset();if(!running){rng=$('#fixedSeed').checked?seeded(+$('#seed').value):Math.random;prepareBattle();running=true;paused=false;$('#status').textContent='전투 중';log('전투 시작');render();meters();last=performance.now();requestAnimationFrame(loop)}}
function loop(now){if(!running)return;let elapsed=Math.min(.15,(now-last)/1000)*speed;last=now;if(!paused){for(let acc=0;acc<elapsed;acc+=DT)tick(Math.min(DT,elapsed-acc))}requestAnimationFrame(loop)}
function log(s){if(silent)return;let d=document.createElement('div');d.innerHTML=`[${time.toFixed(1)}] ${s}`;$('#log').prepend(d)}
function htmlEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function damageDetails(u){
 let rows=Object.entries(u.damageSources).map(([name,s])=>`<tr><th scope="row">${htmlEscape(name)}</th><td>${s.activations}회</td><td>${s.hits}회</td><td>${s.raw.toLocaleString('ko-KR',{maximumFractionDigits:1})}</td><td>${s.dealt.toLocaleString('ko-KR',{maximumFractionDigits:1})}</td></tr>`).join('');
 return `<div class="source-scroll"><table class="source-table"><caption>${htmlEscape(u.name)} — 총 피해 ${Object.values(u.damage).reduce((a,b)=>a+b,0).toLocaleString('ko-KR',{maximumFractionDigits:1})}</caption><thead><tr><th>피해 출처</th><th>발동</th><th>적중</th><th>Raw</th><th>실제</th></tr></thead><tbody>${rows}</tbody></table></div><p class="source-note">발동은 사용 횟수, 적중은 HP 피해를 준 대상 수입니다. Raw는 경감 전 계산값이며 실제 피해는 남은 HP까지만 집계합니다.</p>`;
}
function meters(){
 if(silent)return;
 let focusedUnit=document.activeElement?.dataset?.unit;
 for(let team of ['A','B']){
  let root=$('#meter'+team),arr=units.filter(u=>u.team===team),max=Math.max(1,...arr.map(u=>Object.values(u.damage).reduce((a,b)=>a+b,0)));
  root.innerHTML=arr.map(u=>{
   let total=Object.values(u.damage).reduce((a,b)=>a+b,0),open=expandedMeters.has(u.id),id=htmlEscape(u.id);
   return `<div class="meter-row"><button class="meter-toggle" data-unit="${id}" aria-expanded="${open}" aria-controls="sources-${id}">${htmlEscape(u.name)} <span>${open?'접기':'상세'}</span></button><div class="meter-track" title="평타 ${u.damage.basic.toFixed(0)} / 스킬 ${u.damage.skill.toFixed(0)} / 패시브 ${u.damage.passive.toFixed(0)} / 시너지 ${u.damage.synergy.toFixed(0)}"><div class="meter-fill" style="width:${total/max*100}%"></div></div><span>${total.toFixed(0)}</span></div><div id="sources-${id}"${open?'':' hidden'}>${damageDetails(u)}</div>`;
  }).join('');
  if(focusedUnit)root.querySelector(`button[data-unit="${focusedUnit}"]`)?.focus({preventScroll:true});
  root.onclick=e=>{
   let button=e.target.closest('button[data-unit]');if(!button)return;
   let id=button.dataset.unit;
   if(expandedMeters.has(id))expandedMeters.delete(id);else expandedMeters.add(id);
   meters();root.querySelector(`button[data-unit="${id}"]`)?.focus();
  };
 }
}
function simulateOnce(seed){silent=true;reset();rng=seeded(seed);prepareBattle();running=true;while(!battleOver&&time<60)tick(DT);let w=units.some(u=>u.team==='A'&&!u.dead)?'A':units.some(u=>u.team==='B'&&!u.dead)?'B':'D';silent=false;return w}
function batch(){let base=+$('#seed').value,a=0,b=0,d=0;for(let i=0;i<100;i++){let w=simulateOnce(base+i);if(w==='A')a++;else if(w==='B')b++;else d++}$('#batchResult').innerHTML=`A팀 <b>${a}%</b> · B팀 <b>${b}%</b> · 무승부 ${d}%`;reset()}
$('#start').onclick=start;$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'▶ 재개':'Ⅱ 일시정지'};$('#step').onclick=()=>{if(!running)start();paused=true;for(let i=0;i<2;i++)tick(.05)};$('#reset').onclick=reset;$('#speed').onchange=e=>speed=+e.target.value;$('#batch').onclick=batch;['masteryA','masteryB'].forEach(id=>$('#'+id).onchange=reset);
buildBoard();reset();
