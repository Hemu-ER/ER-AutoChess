/* M10-06: Korean honorific presentation pass.
   Presentation only. No game state, network payloads, combat descriptions, player
   names, chat messages, prices, character names or identifiers are rewritten. */
(function (root) {
 'use strict';
 const SCOPE = '#gameBottomDock, #roundModePanel, #liveItemsPanel, #currentSynergyPanel, #m809LiveHpStandings, #m809DamagePanel, #liveAugmentPanel, #liveSupplyPanel, #liveSelectionPanel, #liveAuctionPanel, #liveMarketPanel, #liveGate, #liveRooms, .m807-loading, #status';
 const SKIP = 'script,style,textarea,input,[contenteditable="true"],.chat-message,.live-chat-message';
 const rewrites = [
  ['벤치가 비어 있어.', '벤치가 비어 있습니다.'],
  ['벤치 자리를 비워줘.', '벤치 자리를 비워 주세요.'],
  ['서버가 지급한 첫 실험체를 동기화했어.', '서버가 지급한 첫 실험체를 동기화했습니다.'],
  ['리롤할 크레딧이 부족해.', '상점을 새로고침할 크레딧이 부족합니다.'],
  ['상점을 새로고침했어.', '상점을 새로고침했습니다.'],
  ['전장에 실험체를 최소 1명 배치해야 해.', '전장에 실험체를 최소 1명 배치해야 합니다.'],
  ['라운드 모드에서는 준비 완료 버튼으로 전투를 시작해.', '라운드 모드에서는 준비 완료 버튼으로 전투를 시작해 주세요.'],
  ['온라인 준비 · 서버가 동시에 전투를 시작해.', '온라인 준비 · 서버에서 전투를 동시에 시작합니다.'],
  ['에셋 로딩이 끝나지 않았어:', '에셋 로딩이 완료되지 않았습니다:'],
  ['1코스트 실험체 풀이 비어 있어 게임을 시작할 수 없어.', '1코스트 실험체가 없어 게임을 시작할 수 없습니다.'],
  ['PvP 상대는 현재 임시 AI야.', '현재 PvP 상대는 임시 AI입니다.'],
  ['대전 상대를 기다리는 중…', '대전 상대를 기다리고 있습니다…'],
  ['드래그해서 배치 / 상점에 놓아 판매', '드래그하여 배치하세요. 상점에 놓으면 판매됩니다.'],
  ['드래그하여 배치 / 상점에 놓아 판매', '드래그하여 배치하세요. 상점에 놓으면 판매됩니다.'],
  ['아이템을 선택해 장착·조합·판매', '아이템을 선택해 장착·조합·판매할 수 있습니다.'],
  ['아이템을 선택해 장착·조합·판매해', '아이템을 선택해 장착·조합·판매할 수 있습니다.'],
  ['준비가 완료되면 자동으로 시작해', '준비가 완료되면 자동으로 시작됩니다.'],
  ['대전 데이터를 동기화하고 있어', '대전 데이터를 동기화하고 있습니다.'],
  ['아직 실행 안 함', '아직 실행하지 않았습니다.'],
  ['다른 참가자 클릭 시 정찰', '다른 참가자를 선택하면 정찰할 수 있습니다.'],
  ['전장에 최소 1명 배치해', '전장에 최소 1명 배치해 주세요.'],
  ['게임이 종료됐어. 새 방을 만들거나 참가할 수 있어.', '게임이 종료되었습니다. 새 방을 만들거나 참가할 수 있습니다.'],
  ['생존자가 없어 무승부로 종료됐어.', '생존자가 없어 무승부로 종료되었습니다.'],
  ['마지막까지 살아남았어!', '마지막까지 생존했습니다!'],
  ['상대 플레이어가 최후의 생존자야.', '상대 플레이어가 최후의 생존자입니다.'],
  ['모두 준비 완료! 방장이 게임을 시작할 수 있어.', '모두 준비했습니다! 방장이 게임을 시작할 수 있습니다.'],
  ['참가자 모두 준비해야 시작할 수 있어.', '참가자 모두 준비해야 시작할 수 있습니다.'],
  ['닉네임을 변경했어.', '닉네임을 변경했습니다.'],
  ['방에서 퇴장했어.', '방에서 퇴장했습니다.'],
  ['보급 지급 완료 · 서버 소유 상태에 반영됐어.', '보급 지급이 완료되어 서버 보유 상태에 반영되었습니다.'],
  ['온라인 방에 접속했어. 두 명이 준비하면 시작할 수 있어.', '온라인 방에 접속했습니다. 두 명이 준비하면 시작할 수 있습니다.'],
  ['온라인 방에서 나왔어.', '온라인 방에서 나왔습니다.'],
  [' 계정으로 로그인했어.', ' 계정으로 로그인했습니다.'],
  ['상대 편성과 전투 데이터를 동기화하고 있어', '상대 편성과 전투 데이터를 동기화하고 있습니다.'],
  ['서버 전투 결과를 확인하고 있어', '서버 전투 결과를 확인하고 있습니다.']
 ];
 const active = s => (s && s.nodeType === 1 && s.matches && (s.matches(SCOPE) || s.closest(SCOPE)));
 function honor(text) {
  let v = text;
  for (const [from,to] of rewrites) if (v.includes(from)) v = v.split(from).join(to);
  return v;
 }
 function scopeOf(n) {
  let e=n.nodeType===1?n:n.parentElement;
  if (!e || e.closest(SKIP)) return false;
  return active(e);
 }
 function writeText(n) {
  if (!n || !n.nodeValue || !scopeOf(n)) return;
  const next=honor(n.nodeValue);
  if(next!==n.nodeValue)n.nodeValue=next;
 }
 function scan(el) {
  if(!el)return;
  if(el.nodeType===3){writeText(el);return;}
  if(el.nodeType!==1 || el.matches(SKIP) || !scopeOf(el))return;
  for(const name of ['title','aria-label','placeholder'])if(el.hasAttribute(name)){
   const old=el.getAttribute(name),next=honor(old);
   if(old!==next)el.setAttribute(name,next);
  }
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())writeText(walker.currentNode);
  for(const child of el.querySelectorAll('[title],[aria-label],[placeholder]')){
   if(child.closest(SKIP))continue;
   for(const name of ['title','aria-label','placeholder'])if(child.hasAttribute(name)){
    const old=child.getAttribute(name),next=honor(old);
    if(old!==next)child.setAttribute(name,next);
   }
  }
 }
 function onMutation(list){
  for(const m of list){
   if(m.type==='characterData'){writeText(m.target);continue;}
   for(const n of m.addedNodes)scan(n);
  }
 }
 function start(){
  for(const el of document.querySelectorAll(SCOPE))scan(el);
  new MutationObserver(onMutation).observe(document.body,{childList:true,characterData:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
 root.LIVEM1006Text=Object.freeze({honor});
})(globalThis);
