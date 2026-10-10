'use strict';
/* M4-10 — Browser-only QA prototypes. This file has no account/network writes.
   Hidden-info games show one player's perspective at a time for manual 2P testing.
   The official multiplayer server does NOT schedule these games yet. */
(()=>{
const $=id=>document.getElementById(id);
const ESC=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GAMES=[
 {id:'recover',title:'금지구역 보급품 회수',type:'RISK / SEARCH',tag:'탐색 · 욕심',desc:'보급품을 더 챙길지, 지금 철수할지. 위험은 누적되지만 기본 보상은 지켜져.'},
 {id:'zones',title:'루미아 섬 탐색 작전',type:'INTEL / CHOICE',tag:'단서 · 선택',desc:'불완전한 탐색 신호를 해석해 어느 구역이 더 가치 있는지 선택하는 작전.'},
 {id:'divide',title:'전리품 분배 협정',type:'TRUST / BLUFF',tag:'협상 · 배신',desc:'상대와 나누거나 혼자 독식하거나. 두 사람이 비공개로 선택하고 동시에 공개해.'},
 {id:'bomb',title:'AGLAIA 폭발물 해체',type:'CO-OP / ASYMMETRY',tag:'채팅 · 정보',desc:'한 명은 폭발물을 조작하고, 한 명은 해체 매뉴얼을 읽어. 믿을지 말지는 각자의 몫.'},
 {id:'ultimatum',title:'생존자 간 크레딧 협상',type:'NEGOTIATION',tag:'분배 · 판단',desc:'공동 크레딧 10C를 누가 얼마나 받을지 제안하고 상대가 수락 또는 거절해.'},
 {id:'craft',title:'긴급 제작 작전',type:'CO-OP / CRAFT',tag:'제작 · 역할 분담',desc:'양쪽에 나뉜 재료를 공동 작업대에 제출해서 목표 장비 2개를 완성해.'}
];
let selected=GAMES[0].id,g=null,history=[],testSeed=0,random=Math.random;
const R=n=>Math.floor(random()*n),pick=a=>a[R(a.length)],roleName=r=>r==='A'?'플레이어 A':'플레이어 B';
const other=r=>r==='A'?'B':'A';
function rngFrom(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function write(msg){history.unshift(msg);history=history.slice(0,22)}
function credits(r){return 3+(g.bonus?.[r]||0)}
function completed(){return !!g.finished}
function done(result,bonus){g.finished=true;g.result=result;g.bonus=bonus;write(result)}
function newGame(id=selected, forcedSeed=null){selected=id;testSeed=forcedSeed===null?(Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0:forcedSeed>>>0;random=rngFrom(testSeed);history=[];
 g={view:'A',finished:false,bonus:{A:0,B:0}};
 if(id==='recover')g.players={A:{count:0,stash:0,bank:0,done:false},B:{count:0,stash:0,bank:0,done:false}};
 if(id==='zones'){
  const values=[1+R(8),1+R(8)];if(values[0]===values[1])values[R(2)]+=2;
  const strongest=values[0]>=values[1]?0:1,signal=random()<.7?strongest:1-strongest;
  g.zones=values;g.hint=signal;g.choices={};
 }
 if(id==='divide')g.choices={};
 if(id==='bomb'){
  g.operator=random()<.5?'A':'B';g.manual=other(g.operator);g.module=pick(['A','B','C']);g.wires=Array.from({length:4},()=>pick(['red','blue','yellow','green']));
  const indices=(c)=>g.wires.flatMap((v,i)=>v===c?[i]:[]);
  g.correct=g.module==='A'?(indices('red').at(-1)??0):g.module==='B'?(indices('blue')[0]??3):(indices('yellow').at(-1)??1);
  g.chat=[];
 }
 if(id==='ultimatum'){g.proposer=random()<.5?'A':'B';g.offer=null}
 if(id==='craft'){
  const basic=LIVEItems.baseNames;
  g.orders=Array.from({length:2},()=>{let a=pick(basic),b=pick(basic);return {a,b,name:LIVEItems.craft(a,b)}});
  g.materials={A:[g.orders[0].a,g.orders[1].a,pick(basic)],B:[g.orders[0].b,g.orders[1].b,pick(basic)]};
  g.orderIndex=0;g.selections={A:null,B:null};g.feedback='양쪽이 각자 재료 하나씩 제출하면 목표 장비를 제작해.';
 }
 write('새로운 미니게임 세션을 시작했어. 결과는 실제 계정에 반영되지 않아.');render();
}
function statusOf(r){if(completed())return g.bonus[r]>0?`기본 3C + 추가 ${g.bonus[r]}C`:'기본 3C 확보';if(selected==='recover')return g.players[r].done?`철수 · 추가 ${g.players[r].bank}C`:`수색 ${g.players[r].count}/4회`;if(selected==='zones'||selected==='divide')return g.choices[r]===undefined?'선택 대기':'선택 완료 · 비공개';if(selected==='bomb')return r===g.operator?'폭탄 조작 담당':'해제 매뉴얼 담당';if(selected==='ultimatum')return r===g.proposer?'분배 제안 담당':'수락 / 거절 담당';if(selected==='craft')return g.selections[r]===null?'재료 선택 가능':'재료 선택 완료';return '테스트 중'}
function frame(inner){return inner+(g.finished?`<div class="qa-divider"></div><div class="qa-result"><span class="qa-kicker">SIMULATION COMPLETE</span><h3>${ESC(g.result)}</h3><p>A · 기본 3C + 추가 ${g.bonus.A}C = ${credits('A')}C　 /　 B · 기본 3C + 추가 ${g.bonus.B}C = ${credits('B')}C</p><p>이 수치는 QA용 가상 보상이며 온라인 계정에는 저장되지 않아.</p><div><button class="qa-cta" data-act="restart">동일 게임 다시 시험 ↻</button></div></div>`:'')}
function roleTabs(){return `<div class="qa-role-tabs" role="group" aria-label="플레이어 화면 전환"><button type="button" data-act="view" data-role="A" aria-pressed="${g.view==='A'}">A 화면</button><button type="button" data-act="view" data-role="B" aria-pressed="${g.view==='B'}">B 화면</button></div>`}
function progress(value,total){return `<div class="qa-progress">${Array.from({length:total},(_,i)=>`<span class="qa-pip ${i<value?'active':''}"></span>`).join('')}</div>`}
function recovery(){let p=g.players[g.view];let pct=[12,24,39,55][Math.min(p.count,3)];const active=!p.done&&!g.finished;
 return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">RESTRICTED ZONE / ${g.view}</span><h3 class="qa-question">수색을 계속할까?</h3><div class="qa-statline"><span>확보한 추가 보상</span><strong>+${p.stash}C</strong></div><div class="qa-statline"><span>현재까지 수색</span><strong>${p.count} / 4</strong></div><div class="qa-statline"><span>다음 수색 위험도</span><strong>${p.count>=4?'수색 종료':pct+'%'}</strong></div>${progress(p.count,4)}<p class="qa-instructions">기본 3C는 언제나 지급. 추가 보상을 쌓고 철수할 수 있지만, 위험에 걸리면 이번 수색의 추가 보상은 잃어.</p><div class="qa-row"><button class="qa-cta" data-act="search" ${active&&p.count<4?'':'disabled'}>보급품 추가 수색</button><button class="qa-cta secondary" data-act="stop" ${active?'':'disabled'}>지금 철수 · +${p.stash}C 확보</button></div></div>`)}
function zoneGame(){const zones=['항구','공장'];return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">ISLAND INTELLIGENCE / RADIO LOG</span><h3 class="qa-question">탐색할 구역을 선택해.</h3><div class="qa-hint">📡 미확인 탐색 신호: <strong>${zones[g.hint]}</strong>에서 가치 높은 보급품이 관측됐어. 단, 신호의 정확도는 약 70%야.</div><p class="qa-instructions">숨겨진 구역별 추가 보상은 1~10C. 양쪽이 각자 선택하면 동시에 공개돼. 기본 3C는 보장돼.</p><div class="qa-choice-grid">${zones.map((z,i)=>`<button class="qa-option" data-act="zone" data-value="${i}" ${g.finished||g.choices[g.view]!==undefined?'disabled':''}><span>${i===0?'⚓':'⌂'}</span><b>${z}</b><small>${g.choices[g.view]===i?'선택 완료 · 비공개':'구역 탐색'}</small></button>`).join('')}</div>${g.finished?`<div class="qa-divider"></div><div class="qa-hint">공개된 전리품: 항구 +${g.zones[0]}C · 공장 +${g.zones[1]}C</div>`:''}</div>`)}
function division(){return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">SURVIVOR / SHARED LOOT</span><h3 class="qa-question">나눌까, 독식할까?</h3><p class="qa-instructions">선택은 비공개. 둘 다 나누면 각각 +4C, 한쪽이 독식하면 그 플레이어 +7C와 상대 +1C, 둘 다 독식하면 추가 보상이 없어. 모두 기본 3C는 확보해.</p><div class="qa-choice-grid"><button class="qa-option" data-act="divide" data-value="share" ${g.choices[g.view]||g.finished?'disabled':''}><span>🤝</span><b>나누기</b><small>협력으로 안정적인 추가 보상</small></button><button class="qa-option" data-act="divide" data-value="grab" ${g.choices[g.view]||g.finished?'disabled':''}><span>◆</span><b>독식</b><small>성공하면 더 많이, 겹치면 없음</small></button></div><p class="qa-caption">${g.choices[g.view]?'선택 완료. 상대 화면으로 바꿔 나머지 선택을 진행해.':'상대의 선택은 결과가 나오기 전까지 공개되지 않아.'}</p>${g.finished?`<p class="qa-hint">A: ${g.choices.A==='share'?'나누기':'독식'} · B: ${g.choices.B==='share'?'나누기':'독식'}</p>`:''}</div>`)}
const WIRE_NAMES={red:'빨간 전선',blue:'파란 전선',yellow:'노란 전선',green:'초록 전선'};
function bomb(){const isOp=g.view===g.operator;
 return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">AGLAIA / DEFUSAL UNIT</span><h3 class="qa-question">${isOp?'전선 절단 장치':'해체 매뉴얼'}</h3>${isOp?`<p class="qa-instructions">모듈 코드 <strong>${g.module}</strong>. 매뉴얼 담당에게 채팅으로 전선 순서와 모듈 코드를 설명하고, 지시를 참고해 하나를 절단해.</p><div class="qa-choice-grid">${g.wires.map((w,i)=>`<button class="qa-option wire" data-act="cut" data-value="${i}" ${g.finished?'disabled':''}><span class="qa-wire ${w}"></span><span><b>${i+1}번 · ${WIRE_NAMES[w]}</b><small>이 전선 절단</small></span></button>`).join('')}</div>`:`<p class="qa-instructions">장치 담당의 전선 순서는 보이지 않아. 채팅으로 모듈 코드를 묻고 아래 규칙을 알려줘. 잘못 알려줘도 시스템이 막지는 않아.</p><div class="qa-manual"><div><b>A형 모듈</b> — 빨간 전선이 있다면 가장 오른쪽 빨간 선. 없으면 1번.</div><div><b>B형 모듈</b> — 파란 전선이 있다면 가장 왼쪽 파란 선. 없으면 4번.</div><div><b>C형 모듈</b> — 노란 전선이 있다면 가장 오른쪽 노란 선. 없으면 2번.</div></div>`}
 <div class="qa-chat"><div class="qa-chat-lines">${g.chat.length?g.chat.map(m=>`<p><b>${m.from}:</b> ${ESC(m.text)}</p>`).join(''):'<p>아직 채팅이 없어. 정보를 주고받아 봐.</p>'}</div><div class="qa-chat-input"><input class="qa-input" id="qaChatText" maxlength="180" placeholder="${g.view}의 메시지 입력" ${g.finished?'disabled':''}><button class="qa-cta secondary" data-act="chat" ${g.finished?'disabled':''}>전송</button></div></div>${g.finished?`<div class="qa-hint">정답은 ${g.correct+1}번 전선이었어. (테스트 종료 후 공개)</div>`:''}</div>`)}
function ultimatum(){const isProp=g.view===g.proposer,chosen=g.offer!==null;let amount=5;
 return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">CREDIT DISPUTE / 10C</span><h3 class="qa-question">${isProp?'크레딧 분배 제안':'분배 제안을 검토해.'}</h3><p class="qa-instructions">제안자: ${roleName(g.proposer)}. 상대가 거절하면 추가 10C는 누구도 못 가져가. 기본 3C는 양쪽 모두 보장돼.</p>${!chosen?(isProp?`<div class="qa-field"><label for="qaShare">제안자가 가져갈 크레딧 <strong id="qaShareOut">5C</strong> / 상대 <strong id="qaOtherOut">5C</strong></label><input id="qaShare" type="range" min="0" max="10" step="1" value="5"></div><div class="qa-row"><button class="qa-cta" data-act="offer">분배 비율 제안</button></div>`:`<div class="qa-hint">제안자가 분배 비율을 정하고 있어. ${roleName(g.proposer)} 화면으로 전환해 줘.</div>`):(!g.finished?`<div class="qa-statline"><span>${roleName(g.proposer)} 몫</span><strong>${g.offer}C</strong></div><div class="qa-statline"><span>${roleName(other(g.proposer))} 몫</span><strong>${10-g.offer}C</strong></div>${isProp?'<p class="qa-instructions">제안을 보냈어. 상대의 결정을 기다려.</p>':'<div class="qa-row"><button class="qa-cta" data-act="accept">수락</button><button class="qa-cta danger" data-act="reject">거절</button></div>'}`:'')}</div>`)}
function craft(){const index=g.orderIndex,order=g.orders[Math.min(index,1)];if(!order)return '완료';const doneCount=Math.min(index,2);
 return frame(`${roleTabs()}<div class="qa-console"><span class="qa-kicker">LUMIA CRAFT / REQUEST ${Math.min(index+1,2)} OF 2</span><h3 class="qa-question">긴급 제작 의뢰</h3>${progress(doneCount,2)}<div class="qa-order"><small class="qa-label">TARGET EQUIPMENT</small><b>${ESC(order.name)}</b><small>이 게임은 실제 아이템 레시피와 동일한 조합 규칙을 사용해.</small></div><p class="qa-instructions">각 플레이어는 자신에게 있는 재료를 하나만 선택해 공동 작업대에 제출해. 둘 다 제출하면 조합을 확인해. 오조합은 재료를 잃지 않고 다시 시도할 수 있어.</p><div class="qa-ingredient-list">${g.materials[g.view].map((name,i)=>`<button class="qa-ingredient ${g.selections[g.view]===i?'selected':''}" data-act="ingredient" data-value="${i}" ${g.finished?'disabled':''}>${g.selections[g.view]===i?'✓ ':''}${ESC(name)}</button>`).join('')}</div><div class="qa-divider"></div><div class="qa-statline"><span>작업대 제출 상태</span><strong>A ${g.selections.A!==null?'완료':'대기'} / B ${g.selections.B!==null?'완료':'대기'}</strong></div><p class="qa-hint">${ESC(g.feedback)}</p>${g.selections.A!==null&&g.selections.B!==null?'<div class="qa-row"><button class="qa-cta" data-act="combine">공동 제작 실행</button></div>':''}</div>`)}
function render(){const info=GAMES.find(x=>x.id===selected);$('qaGameNav').innerHTML=GAMES.map((x,i)=>`<button type="button" class="qa-game-tab" data-select="${x.id}" aria-current="${selected===x.id}"><span class="qa-tab-num">0${i+1} / 06</span><b>${ESC(x.title)}</b><small>${ESC(x.tag)}</small></button>`).join('');$('qaGameType').textContent=info.type;$('qaTitle').textContent=info.title;$('qaDescription').textContent=info.desc;$('qaSeedDisplay').textContent=`SEED ${testSeed}`;
 $('qaParticipants').innerHTML=['A','B'].map(r=>`<div class="qa-person ${g.finished?'qa-done':''}"><div class="qa-person-top"><b>${roleName(r)}</b><small>${g.finished?`${credits(r)}C (가상)`:'진행 중'}</small></div><p>${ESC(statusOf(r))}</p></div>`).join('');$('qaHistory').innerHTML=history.map(h=>`<p>${ESC(h)}</p>`).join('');
 const html=selected==='recover'?recovery():selected==='zones'?zoneGame():selected==='divide'?division():selected==='bomb'?bomb():selected==='ultimatum'?ultimatum():craft();$('qaStage').innerHTML=html;
}
function act(action,node){const v=node.dataset.value,r=g.view;
 if(action==='restart'){newGame(selected,testSeed);return}
 if(action==='view'){g.view=node.dataset.role;render();return}
 if(g.finished)return;
 if(action==='search'&&selected==='recover'){
  const p=g.players[r];if(p.done||p.count>=4)return;const risky=[.12,.24,.39,.55][p.count];p.count++;
  if(random()<risky){p.stash=0;p.bank=0;p.done=true;write(`${roleName(r)}: 금지구역 경보 발동 · 추가 보상 소실`)}
  else{const add=1+R(3);p.stash+=add;write(`${roleName(r)}: 수색 성공 · 추가 +${add}C`);if(p.count>=4){p.bank=p.stash;p.done=true;write(`${roleName(r)}: 최대 탐색 완료 · +${p.bank}C 확보`)}}
  if(g.players.A.done&&g.players.B.done)done('보급품 회수 종료',{A:g.players.A.bank,B:g.players.B.bank});render();return;
 }
 if(action==='stop'&&selected==='recover'){
  const p=g.players[r];if(p.done)return;p.done=true;p.bank=p.stash;write(`${roleName(r)}: 철수 확정 · +${p.bank}C`);if(g.players.A.done&&g.players.B.done)done('보급품 회수 종료',{A:g.players.A.bank,B:g.players.B.bank});render();return;
 }
 if(action==='zone'&&selected==='zones'){
  if(g.choices[r]!==undefined)return;g.choices[r]=Number(v);write(`${roleName(r)}: 구역 선택 완료`);
  if(g.choices.A!==undefined&&g.choices.B!==undefined)done('탐색 완료',{A:g.zones[g.choices.A],B:g.zones[g.choices.B]});render();return;
 }
 if(action==='divide'&&selected==='divide'){
  if(g.choices[r])return;g.choices[r]=v;write(`${roleName(r)}: 비공개 선택 완료`);
  if(g.choices.A&&g.choices.B){const a=g.choices.A,b=g.choices.B;done(a==='share'&&b==='share'?'상호 분배 성공':a==='grab'&&b==='grab'?'서로 독식하여 분배 실패':'일방 독식',a===b?{A:a==='share'?4:0,B:b==='share'?4:0}:{A:a==='grab'?7:1,B:b==='grab'?7:1})}render();return;
 }
 if(action==='chat'&&selected==='bomb'){
  const field=$('qaChatText');const value=field?.value.trim().slice(0,180);if(!value)return;g.chat.push({from:r,text:value});g.chat=g.chat.slice(-14);write(`${roleName(r)}: 메시지 전달`);render();return;
 }
 if(action==='cut'&&selected==='bomb'&&r===g.operator){const wire=Number(v),good=wire===g.correct;done(good?'폭발물 해체 성공':'폭발물 해체 실패',{A:good?6:0,B:good?6:0});render();return}
 if(action==='offer'&&selected==='ultimatum'&&r===g.proposer){g.offer=Number($('qaShare')?.value??5);write(`${roleName(r)}: 분배안 제시`);g.view=other(r);render();return}
 if((action==='accept'||action==='reject')&&selected==='ultimatum'&&r!==g.proposer&&g.offer!==null){const ok=action==='accept';const p=g.proposer;const extra=ok?{[p]:g.offer,[other(p)]:10-g.offer}:{A:0,B:0};done(ok?'분배 협상 성사':'분배 협상 결렬',extra);render();return}
 if(action==='ingredient'&&selected==='craft'){g.selections[r]=Number(v);g.feedback=`${roleName(r)} 재료 선택 완료. ${g.selections[other(r)]===null?'상대 재료도 골라줘.':'이제 공동 제작을 실행할 수 있어.'}`;render();return}
 if(action==='combine'&&selected==='craft'&&g.selections.A!==null&&g.selections.B!==null){const a=g.materials.A[g.selections.A],b=g.materials.B[g.selections.B];const created=LIVEItems.craft(a,b);if(created===g.orders[g.orderIndex].name){write(`공동 제작 성공 · ${created}`);g.materials.A.splice(g.selections.A,1);g.materials.B.splice(g.selections.B,1);g.orderIndex++;g.feedback=`${created} 제작 완료!`;g.selections={A:null,B:null};if(g.orderIndex>=2)done('긴급 제작 의뢰 완료',{A:7,B:7})}
 else{g.feedback=`조합 실패 · ${a} + ${b}${created?' → '+created:' (조합 불가)'} / 목표 장비와 다름. 재료는 유지돼.`;write('조합 실패 · 재료 반환');g.selections={A:null,B:null}}
 render();return}
}
$('qaStage').addEventListener('click',e=>{const btn=e.target.closest('button[data-act]');if(!btn||btn.disabled)return;try{act(btn.dataset.act,btn)}catch(err){console.error(err);write('테스트 오류: '+err.message);render()}});
$('qaStage').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qaChatText'){e.preventDefault();const b=$('qaStage').querySelector('[data-act=chat]');if(b)b.click()}});
$('qaStage').addEventListener('input',e=>{if(e.target.id==='qaShare'){$('qaShareOut').textContent=e.target.value+'C';$('qaOtherOut').textContent=10-Number(e.target.value)+'C'}});
$('qaGameNav').addEventListener('click',e=>{const b=e.target.closest('button[data-select]');if(b)newGame(b.dataset.select)});
$('qaRestart').addEventListener('click',()=>newGame());
$('qaReplay').addEventListener('click',()=>newGame(selected,testSeed));
// Read-only diagnostic surface for browser regression QA; not an online game API.
window.LIVEQA={snapshot:()=>({selected,seed:testSeed,game:JSON.parse(JSON.stringify(g)),history:[...history]}),select:newGame};
newGame('recover');
})();
