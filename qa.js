'use strict';
/* M4-12: five interactive QA-only minigames. No account/API/storage mutation. */
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const games=[
 ['stack','보급 적재 작전','SUPPLY / BLOCK STACK','블록 쌓기 · 줄 제거','방향키로 보급 블록을 쌓고 가로줄을 완성해. 철수·가방 배치 대신 직접 조작하는 게임.'],
 ['zones','루미아 섬 탐색 작전','LUMIA / EXPLORATION','4×4 지도 · 경로 · 수색','구역을 선택해 이동·수색하고, 행동력과 위험을 관리해.'],
 ['divide','전리품 분배 협정','TRUST / NEGOTIATION','보상 분배 · 협상','한 명에게 몰린 크레딧·EXP·아이템을 제안하고 상대가 수락할지 결정해.'],
 ['bomb','AGLAIA 폭발물 해체','AGLAIA / DEFUSAL','문양 · 매뉴얼 · 채팅','조작자에게만 보이는 장치와 매뉴얼 담당자에게만 보이는 규칙을 채팅으로 조합해.'],
 ['quiz','이리체스 도감 퀴즈','CODEX / PERSONAL','레시피 · 시너지 · 도감 검색','실제 아이템 조합표와 실험체 정보를 검색하면서 문제를 풀어. 개인형.']
];
const ZONES=['숲','병원','공장','항구','성당','학교','절','연못','번화가','골목길','묘지','호텔'];
const GLYPHS=['◇','⌬','✦','☾','Ψ','△','⊕','⌘','☷','⊗'];
const KEYPAD_COLUMNS=[['⌬','△','◇','✦','☾','Ψ'],['⊕','◇','⌘','☷','✦','⌬'],['Ψ','☾','⊗','⊕','△','☷']];
const TETROS=[[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[0,1],[1,1],[2,1]],[[2,0],[0,1],[1,1],[2,1]]];
let selected='stack',seed=0,game,history=[],rng=Math.random;
const roles=['A','B'];
const R=n=>Math.floor(rng()*n),pick=xs=>xs[R(xs.length)];
function shuffle(xs){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=R(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function seeded(n){let s=n>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
function note(t){history.unshift(String(t));history=history.slice(0,30)}
const emptyReward=()=>({credits:3,exp:0,items:[]});
const basic=()=>pick(LIVEItems.baseNames);
const nonBase=(points)=>points>=6?{credits:0,exp:6,items:[basic()]}:points>=3?{credits:0,exp:4,items:[basic()]}:points>=1?{credits:0,exp:5,items:[]}:{credits:0,exp:0,items:[]};
function addReward(a,b){return {credits:(a.credits||0)+(b.credits||0),exp:(a.exp||0)+(b.exp||0),items:[...(a.items||[]),...(b.items||[])]}}
const rewardText=r=>`${r.credits}C · 숙련도 +${r.exp} EXP${r.items.length?' · '+r.items.join(' · '):''}`;
function finish(label,rewards){game.finished=true;game.message=label;game.rewards={A:addReward(emptyReward(),rewards?.A||{}),B:addReward(emptyReward(),rewards?.B||{})};note(label)}
const btn=(title,action,val='',disabled=false,style='qa-cta secondary')=>`<button type="button" class="${style}" data-action="${action}" data-val="${esc(val)}" ${disabled?'disabled':''}>${title}</button>`;
const stat=(k,v)=>`<div class="qa-statline"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`;
function roleTabs(){return `<div class="qa-role-tabs">${roles.map(r=>`<button data-action="view" data-role="${r}" aria-pressed="${game.view===r}">${r} 화면</button>`).join('')}</div>`}
const target=()=>game.players?.[game.view];
function panel(body){return `<div class="qa-console">${body}</div>${game.finished?`<div class="qa-result"><span class="qa-kicker">QA RESULT / ACCOUNT INDEPENDENT</span><h3>${esc(game.message)}</h3>${roles.map(r=>`<p><strong>플레이어 ${r}</strong> · ${esc(rewardText(game.rewards[r]))}</p>`).join('')}${btn('같은 시드 재시작','replay','',false,'qa-cta')}</div>`:''}`}
function initStack(){game.players={};for(const r of roles){const p={board:Array.from({length:16},()=>Array(10).fill(0)),piece:null,queue:[],lines:0,score:0,done:false,started:false,lastDrop:Date.now()};game.players[r]=p;spawnPiece(p)}}
function spawnPiece(p){while(p.queue.length<3)p.queue.push(R(TETROS.length));const shapeId=p.queue.shift();p.piece={id:shapeId,coords:TETROS[shapeId].map(c=>[...c]),x:3,y:0};if(!canPiece(p,p.piece,p.piece.x,p.piece.y)){p.piece=null;p.done=true;note('보급 적재 공간 부족: 종료')}}
function canPiece(p,piece,x,y,coords=piece.coords){return coords.every(([dx,dy])=>x+dx>=0&&x+dx<10&&y+dy>=0&&y+dy<16&&!p.board[y+dy][x+dx])}
function movePiece(p,dx,dy){if(!p.piece)return false;const n=p.piece;if(canPiece(p,n,n.x+dx,n.y+dy)){n.x+=dx;n.y+=dy;return true}return false}
function rotatePiece(p){if(!p.piece)return;const n=p.piece,rot=n.coords.map(([x,y])=>[-y,x]);const minX=Math.min(...rot.map(v=>v[0])),minY=Math.min(...rot.map(v=>v[1]));const shifted=rot.map(([x,y])=>[x-minX,y-minY]);for(const kick of [0,-1,1,-2,2]){if(canPiece(p,n,n.x+kick,n.y,shifted)){n.x+=kick;n.coords=shifted;break}}}
function lockPiece(p){if(!p.piece)return;for(const [dx,dy] of p.piece.coords)p.board[p.piece.y+dy][p.piece.x+dx]=p.piece.id+1;const keep=p.board.filter(row=>row.some(c=>!c));const removed=16-keep.length;while(keep.length<16)keep.unshift(Array(10).fill(0));p.board=keep;p.lines+=removed;p.score+=(removed?([0,100,250,450,700][removed]||700):5);if(removed)note(`${game.view}: ${removed}줄 적재 정리!`);spawnPiece(p)}
function dropPiece(p){if(!movePiece(p,0,1))lockPiece(p)}
function hardDrop(p){while(movePiece(p,0,1))p.score+=1;lockPiece(p)}
function stackReward(p){return p.lines>=5?{credits:3,exp:7,items:[basic()]}:p.lines>=3?{exp:8,items:[basic()]}:p.lines>=1?{exp:5}: {exp:2}}
function stopStack(){const p=target();p.done=true;p.piece=null;note(`${game.view}: 블록 적재 종료 · ${p.lines}줄`);if(roles.every(r=>game.players[r].done))finish('보급 적재 결과',{A:stackReward(game.players.A),B:stackReward(game.players.B)})}
function stackUI(){const p=target();const show=p.board.map(row=>[...row]);if(p.piece)for(const [dx,dy] of p.piece.coords){const x=p.piece.x+dx,y=p.piece.y+dy;if(y>=0&&y<16&&x>=0&&x<10)show[y][x]=p.piece.id+1}return panel(`${roleTabs()}<span class="qa-kicker">AGLAIA / CARGO STACKING</span><h3 class="qa-question">보급 블록을 쌓고 줄을 완성해.</h3><p class="qa-instructions">← → 이동 · ↑ 회전 · ↓ 한 칸 내리기 · Space 즉시 떨어뜨리기. 모바일에서는 아래 조작 버튼을 사용해.</p><div class="qa-stack-layout"><div class="qa-block-grid">${show.flat().map((n,i)=>`<div class="qa-block ${n?'qa-b'+n:''}" title="${Math.floor(i/10)},${i%10}"></div>`).join('')}</div><div>${stat('정리한 줄',p.lines)}${stat('적재 점수',p.score)}${stat('다음 블록',p.queue.length?`TYPE ${p.queue[0]+1}`:'—')}<div class="qa-control-pad">${btn('←','left','',p.done)}${btn('↻','rotate','',p.done)}${btn('→','right','',p.done)}${btn('↓','down','',p.done)}${btn('즉시 내려놓기','drop','',p.done,'qa-cta')}</div><div class="qa-row">${btn('적재 완료 · 보상 정산','stackStop','',p.done)}</div><p class="qa-caption">줄을 1개만 완성해도 EXP 보상이 추가돼. 3줄 이상이면 기본 아이템 획득 기회가 있어.</p></div></div>`)}
function dist(a,b){return Math.abs(a%4-b%4)+Math.abs(Math.floor(a/4)-Math.floor(b/4))}
function zoneMap(variant=0){
 const profiles=[
  ['supply','supply','rare','scanner','scanner','risk','trace','trace'],
  ['supply','supply','supply','rare','rare','risk','risk','scanner'],
  ['supply','rare','rare','rare','risk','risk','risk','trace']
 ];
 const tiles=shuffle([...profiles[variant%3],...Array(7).fill('empty')]);tiles.splice(12,0,'start');return tiles
}
function reveal(p){for(let i=0;i<16;i++)if(dist(p.pos,i)<=1)p.seen.add(i)}
function initZones(){game.options=shuffle(ZONES).slice(0,3);game.players={};for(const r of roles)game.players[r]={zone:null,map:null,pos:12,ap:8,points:0,risk:0,opened:new Set(),seen:new Set([12,8,13]),visited:new Set([12]),done:false}}
function zoneReward(p){return addReward(nonBase(p.points),p.points>=4&&p.risk<3?{credits:2}:p.points<1?{exp:2}:{})}
function finishIndividuals(name,rewardFn){if(roles.every(r=>game.players[r].done))finish(name,{A:rewardFn(game.players.A),B:rewardFn(game.players.B)})}
function zonesUI(){const p=target();if(!p.zone)return panel(`${roleTabs()}<span class="qa-kicker">LUMIA / AREA SELECT</span><h3 class="qa-question">탐색할 지역을 선택해.</h3><div class="qa-island"><div class="qa-island-caption">지형별 보드 생성용 임시 레이어 · 공식 맵 원본은 아직 미포함</div><div class="qa-region-list">${game.options.map((z,i)=>`<button class="qa-region" data-action="zone" data-val="${i}"><small>AREA 0${i+1}</small><b>${esc(z)}</b><span>${['균형형 탐색','보급품 신호','위험 구역'][i]}</span></button>`).join('')}</div></div>`);
const icons={start:'●',empty:'·',supply:'□',rare:'◇',risk:'△',scanner:'⌁',trace:'⌕'};
return panel(`${roleTabs()}<div class="qa-info-row"><span>LUMIA / ${esc(p.zone)}</span><b>행동력 ${p.ap}/8 · 확보 물자 ${p.points} · 위험 ${p.risk}/3</b></div><div class="qa-two"><div><h3 class="qa-question">탐색 지도 / 4×4</h3><div class="qa-tile-grid">${p.map.map((t,i)=>`<button class="qa-grid-cell ${i===p.pos?'current':p.visited.has(i)?'visited':p.seen.has(i)?'seen':'fog'}" data-action="walk" data-val="${i}" ${p.done?'disabled':''}>${i===p.pos?'◆':p.seen.has(i)?icons[t]:'?'}</button>`).join('')}</div><p class="qa-caption">인접한 칸만 이동할 수 있어. 수색은 현재 칸에서 별도 행동력이 필요해.</p></div><div>${stat('현재 타일',({start:'출발',empty:'일반',supply:'보급 상자',rare:'희귀 상자',risk:'위험',scanner:'탐지 장치',trace:'흔적'})[p.map[p.pos]])}<p class="qa-instructions">□ 일반 보급 / ◇ 희귀 / △ 위험 / ⌁ 지도 개방 / ⌕ 흔적</p><div class="qa-row">${btn('현재 타일 수색·조사','inspect','',p.done||p.ap<=0||p.opened.has(p.pos)||!['supply','rare','trace','scanner'].includes(p.map[p.pos]),'qa-cta')}${btn('탐색 종료','retreat','',p.done)}</div></div></div>`)}
function initDivide(){game.owner=pick(roles);game.receiver=game.owner==='A'?'B':'A';game.pool={credits:6+R(9),exp:4+R(9),items:[basic(),...(R(100)<45?[basic()]:[])]};game.offer=null;game.rejections=0;game.chat=[]}
function divideUI(){
 const owner=game.owner,r=game.view,hasOffer=!!game.offer;
 let controls='';
 if(r===owner&&!hasOffer){
  controls=`<div class="qa-split-panel"><label>상대에게 줄 크레딧: <b id="qaShareOut">0C</b><input type="range" class="qa-input" id="qaShare" min="0" max="${game.pool.credits}" value="0"></label><label>상대에게 줄 EXP: <b id="qaExpOut">0 EXP</b><input type="range" class="qa-input" id="qaExp" min="0" max="${game.pool.exp}" value="0"></label><div><b>상대에게 줄 아이템</b>${game.pool.items.map((item,i)=>`<label class="qa-check-item"><input type="checkbox" name="qaGiveItem" value="${i}">${esc(item)}</label>`).join('')}</div>${btn('분배안 제시','offer','',false,'qa-cta')}</div>`;
 }else if(hasOffer){
  controls=`<div class="qa-offer"><b>${owner}의 분배안</b><p>${owner}: ${esc(rewardText(game.offer[owner]))}</p><p>${game.receiver}: ${esc(rewardText(game.offer[game.receiver]))}</p></div>`;
  controls+=r===game.receiver?`<div class="qa-row">${btn('수락','accept','',false,'qa-cta')}${btn('거절 · 재협상','reject')}</div>`:'<p class="qa-instructions">상대가 응답할 때까지 기다리는 중. A/B 화면을 바꿔봐.</p>';
 }else controls='<p class="qa-hint">전리품 보유자가 먼저 분배안을 제시해야 해.</p>';
 return panel(`${roleTabs()}<div class="qa-info-row"><span>SHARED LOOT / DISTRIBUTION</span><b>전리품 보유자 ${owner} · 제안 ${game.rejections+1}/3</b></div><h3 class="qa-question">전리품을 어떻게 나눌까?</h3><p class="qa-instructions">시스템이 ${owner}에게 전리품을 몰아줬어. ${owner}가 분배안을 제출하면 ${game.receiver}가 수락하거나 거절해. 채팅으로 협상 가능하며, 끝내 합의하지 못하면 추가 전리품은 회수돼.</p><div class="qa-loot-pool">${stat('크레딧',`${game.pool.credits}C`)}${stat('숙련도',`+${game.pool.exp} EXP`)}${stat('기본 아이템',game.pool.items.join(', '))}</div>${controls}${chatUI()}`)
}

const PRIORITY_ODD=['Ψ','☾','◇','⌬','△','✦','⊕','⌘','☷','⊗'];
const PRIORITY_EVEN=['⊗','⊕','☷','✦','⌘','△','⌬','◇','☾','Ψ'];
function initBomb(){game.operator=pick(roles);game.expert=game.operator==='A'?'B':'A';game.serial=10+R(90);game.lamp=R(2);game.wavelength=pick(['▲','▽']);game.module=0;game.strikes=0;game.chat=[];game.deadline=Date.now()+210000;
 const wires=shuffle(GLYPHS).slice(0,5),which=R(3),keys=shuffle(KEYPAD_COLUMNS[which]).slice(0,4);
 const switches=shuffle(['◇','⌬','✦','Ψ']);
 game.modules=[{type:'wires',glyphs:wires,cleared:[],answer:wireAnswer(wires,game.serial,game.lamp)},
 {type:'keypad',glyphs:shuffle(keys),column:which,pressed:[],answer:KEYPAD_COLUMNS[which].filter(s=>keys.includes(s))},
 {type:'switch',glyphs:switches,states:[0,0,0,0],answer:switchAnswer(switches,game.serial,game.wavelength,game.lamp)}];}
function wireAnswer(glyphs,serial,lamp){const pri=serial%2===0?PRIORITY_EVEN:PRIORITY_ODD;const filtered=pri.filter(s=>glyphs.includes(s));return lamp?filtered.slice(0,2).reverse():filtered.slice(0,2)}
function switchAnswer(glyphs,serial,wavelength,lamp){const primary=serial%2===0?['◇','Ψ']:['⌬','✦'];return glyphs.map((glyph,i)=>Number(Boolean(primary.includes(glyph))!==Boolean(wavelength==='▲'&&i===1)!==Boolean(lamp&&i===3)))}
function chatUI(){return `<div class="qa-chat"><div class="qa-panel-heading">테스트 채팅 · 역할별 전송</div><div class="qa-chat-lines">${game.chat.map(x=>`<p><b>${esc(x.from)}:</b> ${esc(x.text)}</p>`).join('')||'<p>서로 정보를 전달해 봐. 실제 멀티채팅은 QA 밖의 별도 기능이야.</p>'}</div><div class="qa-chat-input"><input class="qa-input" id="qaChatText" maxlength="160" autocomplete="off" placeholder="설명·질문·협상 입력">${btn('전송','chat','',false,'qa-cta')}</div></div>`}
function bombManual(m){if(m.type==='wires')return `<div class="qa-manual"><strong>MODULE 01 / 문양 전선 규칙</strong><div>1. 조작자에게 일련번호 끝자리의 홀짝과 표시등 점등 여부, 전선 5개의 문양을 물어봐.</div><div>2. 홀수일 때 우선순위: ${PRIORITY_ODD.join(' › ')}</div><div>3. 짝수일 때 우선순위: ${PRIORITY_EVEN.join(' › ')}</div><div>4. 실제 장치에 존재하는 문양만 남겨서 우선순위 앞의 2개를 선택한다. 표시등이 켜져 있으면 <b>자르는 순서를 뒤집어</b>.</div></div>`;
if(m.type==='keypad')return `<div class="qa-manual"><strong>MODULE 02 / 상형 키패드 규칙</strong><div>조작자에게 보이는 문양 네 개를 확인해. <b>네 문양을 모두 포함하는 열</b> 하나를 찾아 그 열에 적힌 순서대로 4개를 눌러야 해.</div><div class="qa-manual-cols">${KEYPAD_COLUMNS.map((col,i)=>`<div><b>기록 ${i+1}</b>${col.map(s=>`<span>${s}</span>`).join('')}</div>`).join('')}</div></div>`;
return `<div class="qa-manual"><strong>MODULE 03 / 반응기 스위치 규칙</strong><div>조작자에게 일련번호 홀짝, 파장 기호(▲/▽), 표시등 상태와 스위치 문양의 왼쪽부터 순서를 질문해.</div><div>① 일련번호 <b>짝수</b>: ◇, Ψ만 켬. <b>홀수</b>: ⌬, ✦만 켬.</div><div>② 파장이 ▲면 두 번째 스위치 상태를 반전한다.</div><div>③ 표시등이 켜졌으면 네 번째 스위치 상태를 반전한다.</div><div>④ 네 스위치를 모두 맞춘 뒤 **회로 인가** 버튼으로 확인한다.</div></div>`}
function bombUI(){const r=game.view,m=game.modules[game.module]||game.modules[2],op=r===game.operator;let inner='';
if(op){if(m.type==='wires')inner=`<div class="qa-wire-grid">${m.glyphs.map((s,i)=>`<button class="qa-keypad ${m.cleared.includes(s)?'qa-chosen':''}" data-action="defuse" data-val="${i}" ${m.cleared.includes(s)?'disabled':''}><small>${i+1}번 · 전선</small><strong>${s}</strong></button>`).join('')}</div><p class="qa-caption">올바른 전선 2개를 순서대로 절단해야 해.</p>`;
if(m.type==='keypad')inner=`<div class="qa-wire-grid">${m.glyphs.map((s,i)=>`<button class="qa-keypad ${m.pressed.includes(s)?'qa-chosen':''}" data-action="defuse" data-val="${i}" ${m.pressed.includes(s)?'disabled':''}>${s}</button>`).join('')}</div><p class="qa-caption">문양 4개를 특정 순서대로 눌러야 해.</p>`;
if(m.type==='switch')inner=`<div class="qa-wire-grid">${m.glyphs.map((s,i)=>`<button class="qa-lamp" data-action="toggle" data-val="${i}"><b>${s}</b><i class="${m.states[i]?'on':''}"></i><small>${m.states[i]?'ON':'OFF'}</small></button>`).join('')}</div><div class="qa-row">${btn('회로 인가','submitSwitch','',false,'qa-cta')}</div>`;
}else inner=bombManual(m);
return panel(`${roleTabs()}<div class="qa-info-row"><span>AGLAIA / BOMB MODULE ${game.module+1} OF 3</span><b>오작동 ${game.strikes}/3 · <span id="qaTimeLeft">210s</span></b></div><h3 class="qa-question">${op?'조작 장치를 확인해.':'해체 매뉴얼을 해석해.'}</h3><p class="qa-instructions">조작자 ${game.operator}는 장치만, 매뉴얼 담당 ${game.expert}는 규칙만 확인 가능. 채팅으로 서로 설명해야 해. 오조작 3회 또는 시간 초과 시 실패.</p>${op?`<div class="qa-device"><div class="qa-device-label">SERIAL ${game.serial} · 전원등 ${game.lamp?'ON':'OFF'} · 파장 ${game.wavelength}</div>${inner}</div>`:`${inner}<div class="qa-hint">현재 장치의 정답이나 실제 배치는 매뉴얼 담당에게 직접 보이지 않아.</div>`}${chatUI()}`)}
function bombCorrectChoice(m){return m.answer[m.type==='switch'?0:m.type==='wires'?m.cleared.length:m.pressed.length]}
function strike(){game.strikes++;note(`회로 오작동 (${game.strikes}/3)`);if(game.strikes>=3)finish('폭탄 해체 실패 · 오조작 3회',{})}
function advanceBomb(){game.module++;if(game.module>=3){const item=basic();finish('폭발물 해체 성공 · 공동 보상',{A:{credits:3,exp:8,items:[item]},B:{credits:3,exp:8,items:[item]}})}else note(`장치 ${game.module}/3 해체. 다음 모듈로 진행`)}
const roster=typeof ERRoster!=='undefined'?ERRoster.roster.filter(x=>!x.pveOnly&&x.cost>0):[];
function initQuiz(){const qs=[];const rec=shuffle(LIVEItems.recipes).slice(0,3);const chars=shuffle(roster).slice(0,3);for(let i=0;i<5;i++){
 if(i===0){const x=rec[0],materials=LIVEItems.all[x[0]].materials;qs.push({type:'combine',prompt:`${materials[0]} + ${materials[1]} = ?`,answer:x[0],meta:'조합식의 결과 아이템 이름'})}
 if(i===1){const x=rec[1],materials=LIVEItems.all[x[0]].materials;qs.push({type:'reverse',prompt:`${x[0]}의 두 기본 재료를 '+'로 구분해서 입력해.`,answer:materials.join('+'),meta:'재료 순서는 무관'})}
 if(i===2&&chars[0])qs.push({type:'synergy',prompt:`실험체 「${chars[0].name}」의 시너지 중 하나를 입력해.`,answer:chars[0].affiliations,meta:'소속 시너지 1개만 적어도 정답'})
 if(i===3&&chars[1])qs.push({type:'cost',prompt:`실험체 「${chars[1].name}」의 상점 코스트는 몇이야? 숫자로 입력해.`,answer:String(chars[1].cost),meta:'1·2·3 중 하나'})
 if(i===4){const x=rec[2],materials=LIVEItems.all[x[0]].materials;qs.push({type:'combine',prompt:`${materials[0]} + ${materials[1]} = ?`,answer:x[0],meta:'아이템 도감에서 검색할 수 있어'})}
 }game.players={};for(const r of roles)game.players[r]={questions:shuffle(qs),index:0,correct:0,attempts:0,done:false,answers:[],search:'',lookup:'items'};game.quizQuestions=qs}
function normalize(v){return String(v||'').normalize('NFKC').replace(/[\s·\-]+/g,'').toLowerCase()}
function isCorrect(q,answer){if(q.type==='reverse'){const x=answer.split('+').map(normalize).sort().join('|');return x===q.answer.split('+').map(normalize).sort().join('|')}if(Array.isArray(q.answer))return q.answer.some(s=>normalize(s)===normalize(answer));return normalize(q.answer)===normalize(answer)}
function codexUI(p){const query=normalize(p.search);const items=Object.entries(LIVEItems.all).filter(([name,entry])=>!query||normalize(name).includes(query)||entry.materials?.some(s=>normalize(s).includes(query)));
 const chars=roster.filter(x=>!query||normalize(x.name).includes(query)||x.affiliations.some(s=>normalize(s).includes(query)));
return `<div class="qa-codex"><div class="qa-info-row"><b>이리체스 도감 / 실제 데이터</b><span>답은 직접 입력해야 해.</span></div><div class="qa-row">${btn('아이템·조합','codexTab','items',false,p.lookup==='items'?'qa-cta':'qa-cta secondary')}${btn('실험체·시너지','codexTab','chars',false,p.lookup==='chars'?'qa-cta':'qa-cta secondary')}</div><input class="qa-input qa-search" id="qaCodexSearch" placeholder="이름, 재료, 시너지 검색" value="${esc(p.search)}"><div class="qa-codex-results">${p.lookup==='items'?items.map(([name,item])=>`<div class="qa-codex-record"><b>${esc(name)}</b><small>${item.basic?'기본 아이템':`조합: ${esc(item.materials.join(' + '))}`} · ${esc(Object.entries(item.stats||{}).map(([k,v])=>k+' '+v).join(' / '))}</small></div>`).join(''):chars.map(x=>`<div class="qa-codex-record"><b>${esc(x.name)}</b><small>${x.cost}코스트 · ${esc(x.role)} · ${esc(x.affiliations.join(' / '))}</small></div>`).join('')}</div></div>`}
function quizReward(p){return p.correct>=4?{credits:2,exp:8,items:[basic()]}:p.correct>=3?{exp:7,items:[basic()]}:p.correct>=1?{exp:5}: {exp:2}}
function quizUI(){const p=target(),q=p.questions[Math.min(p.index,p.questions.length-1)];return panel(`${roleTabs()}<div class="qa-info-row"><span>CODEX / EXPERIMENT QUIZ</span><b>문제 ${Math.min(p.index+1,p.questions.length)} / ${p.questions.length} · 정답 ${p.correct}</b></div>${p.done?'<h3 class="qa-question">퀴즈 완료. 다른 플레이어의 종료를 기다리는 중.</h3>':`<h3 class="qa-question">${esc(q.prompt)}</h3><p class="qa-instructions">${esc(q.meta)} · 아래 도감은 항상 열려 있어. 미니게임은 개인전이며 답은 상대에게 공개되지 않아.</p><div class="qa-chat-input"><input class="qa-input" id="qaQuizAnswer" autocomplete="off" placeholder="정답 입력">${btn('제출','quizAnswer','',false,'qa-cta')}</div>`}<div class="qa-hint">QA 정답 기록: ${p.answers.map((x,i)=>`#${i+1} ${x?'정답':'오답'}`).join(' · ')||'아직 없음'}</div>${codexUI(p)}`)}
function status(r){if(game.finished)return rewardText(game.rewards[r]);if(selected==='stack')return game.players[r].done?'적재 완료':`${game.players[r].lines}줄 정리`;if(selected==='zones')return game.players[r].done?'탐색 종료':game.players[r].zone?`${game.players[r].zone} / AP ${game.players[r].ap}`:'구역 선택';if(selected==='divide')return r===game.owner?'전리품 보유자':'분배 수령자';if(selected==='bomb')return r===game.operator?'장치 조작자':'매뉴얼 담당';if(selected==='quiz')return game.players[r].done?'퀴즈 종료':`${game.players[r].correct}개 정답`;return '진행 중'}
function render(){const cfg=games.find(x=>x[0]===selected);$('qaGameNav').innerHTML=games.map((x,i)=>`<button type="button" class="qa-game-tab" data-select="${x[0]}" aria-current="${selected===x[0]}"><span class="qa-tab-num">0${i+1} / 05</span><b>${esc(x[1])}</b><small>${esc(x[3])}</small></button>`).join('');$('qaGameType').textContent=cfg[2];$('qaTitle').textContent=cfg[1];$('qaDescription').textContent=cfg[4];$('qaSeedDisplay').textContent='SEED '+seed;$('qaParticipants').innerHTML=roles.map(r=>`<div class="qa-person ${game.finished?'qa-done':''}"><div class="qa-person-top"><b>플레이어 ${r}</b><small>${esc(status(r))}</small></div><p>${['stack','zones','quiz'].includes(selected)?'개인형 · 결과 비교 없음':'정보 분리 · 역할 전환형 QA'}</p></div>`).join('');$('qaHistory').innerHTML=history.map(s=>`<p>${esc(s)}</p>`).join('');$('qaStage').innerHTML=selected==='stack'?stackUI():selected==='zones'?zonesUI():selected==='divide'?divideUI():selected==='bomb'?bombUI():quizUI()}
function newGame(id=selected,forced){selected=id;seed=forced==null?(Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0:forced>>>0;rng=seeded(seed);history=[];game={view:'A',finished:false,rewards:{A:emptyReward(),B:emptyReward()}};if(id==='stack')initStack();if(id==='zones')initZones();if(id==='divide')initDivide();if(id==='bomb')initBomb();if(id==='quiz')initQuiz();note('새 QA 세션 · 실제 계정·재화에 영향 없음');render()}
function action(a,v='',role=null){
 if(a==='replay'){newGame(selected,seed);return}
 if(a==='view'){if(roles.includes(role)){game.view=role;render()}return}
 if(game.finished)return;
 const r=game.view,p=target();
 if(selected==='stack'){
  if(p.done)return;
  if(a==='left')movePiece(p,-1,0);
  if(a==='right')movePiece(p,1,0);
  if(a==='down')dropPiece(p);
  if(a==='rotate')rotatePiece(p);
  if(a==='drop')hardDrop(p);
  if(a==='stackStop')stopStack();
  if(!game.finished&&roles.every(k=>game.players[k].done))finish('보급 적재 결과',{A:stackReward(game.players.A),B:stackReward(game.players.B)});
 }
 if(selected==='zones'){
  if(p.done)return;
  if(a==='zone'&&!p.zone){const option=game.options[Number(v)];if(option){p.zone=option;p.map=zoneMap(game.options.indexOf(option));note(`${r}: ${p.zone} 탐색 시작`)}}
  if(a==='walk'&&p.zone){const n=Number(v);if(n>=0&&n<16&&dist(p.pos,n)===1&&p.ap>0){const cost=1+(p.map[n]==='risk'?1:0);if(p.ap>=cost){p.ap-=cost;p.pos=n;p.visited.add(n);reveal(p);if(p.map[n]==='risk'){p.risk++;note(`${r}: 위험 지형 진입`)}if(p.risk>=3)p.done=true}else note('이동에 필요한 행동력이 부족해')}else note('상하좌우 인접 타일만 이동할 수 있어')}
  if(a==='inspect'&&p.zone&&!p.opened.has(p.pos)&&p.ap>0){const t=p.map[p.pos];if(['supply','rare','trace','scanner'].includes(t)){p.ap--;p.opened.add(p.pos);if(t==='supply')p.points+=2;if(t==='rare'){p.points+=5;p.risk++}if(t==='trace'){p.points++;for(let i=0;i<16;i++)if(dist(p.pos,i)<=2)p.seen.add(i)}if(t==='scanner')for(let i=0;i<16;i++)p.seen.add(i);note(`${r}: ${t} 조사 · 물자 ${p.points}점`)}}
  if(a==='retreat'){p.done=true;note(`${r}: 탐색 종료`)}
  if(p.ap===0||p.risk>=3)p.done=true;
  finishIndividuals('루미아 섬 탐색 종료',zoneReward);
 }
 if(selected==='divide'){
  if(a==='chat'){const t=$('qaChatText')?.value?.trim();if(t){game.chat.push({from:r,text:t.slice(0,160)});note(`${r}: 채팅 전송`)}}
  if(a==='offer'&&r===game.owner&&!game.offer){
   const credits=Math.max(0,Math.min(game.pool.credits,Number($('qaShare')?.value)||0));
   const exp=Math.max(0,Math.min(game.pool.exp,Number($('qaExp')?.value)||0));
   const items=Array.from(document.querySelectorAll?.('input[name="qaGiveItem"]:checked')||[]).map(x=>Number(x.value)).filter(i=>i>=0&&i<game.pool.items.length);
   const receiver={credits,exp,items:game.pool.items.filter((_,i)=>items.includes(i))};
   const owner={credits:game.pool.credits-credits,exp:game.pool.exp-exp,items:game.pool.items.filter((_,i)=>!items.includes(i))};
   game.offer={[game.owner]:owner,[game.receiver]:receiver};note(`${r}: 전리품 분배 제안`);
  }
  if(a==='accept'&&r===game.receiver&&game.offer){finish('전리품 분배 합의',{A:game.offer.A,B:game.offer.B})}
  if(a==='reject'&&r===game.receiver&&game.offer){game.rejections++;game.offer=null;note(`${r}: 분배 거절 (${game.rejections}/3)`);if(game.rejections>=3)finish('합의 실패 · 추가 전리품 회수',{})}
 }
 if(selected==='bomb'){
  if(a==='chat'){const t=$('qaChatText')?.value?.trim();if(t){game.chat.push({from:r,text:t.slice(0,160)});note(`${r}: 채팅 전송`)}}
  if(r===game.operator){const m=game.modules[game.module];if(a==='defuse'&&['wires','keypad'].includes(m.type)){
    const symbol=m.glyphs[Number(v)],expected=bombCorrectChoice(m);
    if(symbol===expected){if(m.type==='wires')m.cleared.push(symbol);else m.pressed.push(symbol);note(`${r}: ${symbol} 조작 성공`);if((m.type==='wires'?m.cleared:m.pressed).length===m.answer.length)advanceBomb()}
    else strike();
   }
   if(a==='toggle'&&m.type==='switch'){const n=Number(v);if(n>=0&&n<4)m.states[n]^=1}
   if(a==='submitSwitch'&&m.type==='switch'){if(m.states.every((x,i)=>x===m.answer[i]))advanceBomb();else strike()}
  }
 }
 if(selected==='quiz'){
  if(a==='codexTab'){p.lookup=v==='chars'?'chars':'items'}
  if(a==='quizAnswer'&&!p.done){const answer=$('qaQuizAnswer')?.value?.trim()||'';if(answer){const q=p.questions[p.index],correct=isCorrect(q,answer);p.answers.push(correct);if(correct)p.correct++;note(`${r}: ${p.index+1}번 문제 ${correct?'정답':'오답'}`);p.index++;if(p.index>=p.questions.length){p.done=true;note(`${r}: 도감 퀴즈 완료 (${p.correct}/${p.questions.length})`)}finishIndividuals('이리체스 도감 퀴즈 종료',quizReward)}}
 }
 render();
}
$('qaGameNav').addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b)newGame(b.dataset.select)});
$('qaStage').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)action(b.dataset.action,b.dataset.val,b.dataset.role)});
$('qaStage').addEventListener('input',e=>{
 if(e.target.id==='qaShare'&&$('qaShareOut'))$('qaShareOut').textContent=e.target.value+'C';
 if(e.target.id==='qaExp'&&$('qaExpOut'))$('qaExpOut').textContent=e.target.value+' EXP';
 if(e.target.id==='qaCodexSearch'&&selected==='quiz'){
  const value=e.target.value,caret=e.target.selectionStart;target().search=value;render();
  const el=$('qaCodexSearch');if(el){el.focus?.();if(typeof el.setSelectionRange==='function'&&typeof caret==='number')el.setSelectionRange(caret,caret)}
 }
});
$('qaStage').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qaChatText')action('chat');if(e.key==='Enter'&&e.target.id==='qaQuizAnswer')action('quizAnswer')});
document.addEventListener('keydown',e=>{
 if(selected!=='stack'||game.finished||target().done||e.target?.matches?.('input, textarea, select'))return;
 const map={'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'rotate','ArrowDown':'down',' ':'drop'};
 if(map[e.key]){e.preventDefault?.();action(map[e.key])}
});
$('qaRestart').addEventListener('click',()=>newGame(selected));
$('qaReplay').addEventListener('click',()=>newGame(selected,seed));
if(typeof setInterval==='function')setInterval(()=>{
 if(!game||game.finished)return;
 if(selected==='bomb'){
  const t=$('qaTimeLeft');if(t)t.textContent=Math.max(0,Math.ceil((game.deadline-Date.now())/1000))+'s';
  if(Date.now()>=game.deadline){finish('폭발물 해체 시간 초과',{});render()}
 }
 if(selected==='stack'){
  const p=target();if(!p.done&&p.piece&&Date.now()-p.lastDrop>=1150){dropPiece(p);p.lastDrop=Date.now();render()}
 }
},250);
window.LIVEQA={select:id=>newGame(id),restart:()=>newGame(selected,seed),snapshot:()=>({selected,seed,game,history}),act:action,internals:{wireAnswer,switchAnswer,isCorrect,movePiece,hardDrop,dropPiece}};
newGame();
})();
