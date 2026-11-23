'use strict';
// M10-17: read-only, stage-aware intelligence. No economy commands or drag handlers.
(()=>{
  let data=null, open=false, tab='overview', signature='', root=null;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={supply:'보급',auction:'경매',selection:'선점',experiment:'번외 실험',boss:'보스',shop:'거래 상점'};
  const itemMarkup=item=>`<span class="m1017-item">${item.icon?`<img src="${escapeHtml(item.icon)}" alt="" loading="lazy">`:''}<span>${escapeHtml(item.name)}</span></span>`;
  const star=n=>'★'.repeat(Math.min(3,Math.max(1,Number(n)||1)));
  const equipment=u=>u.equipment?.length?u.equipment.map(itemMarkup).join(''):'<span class="m1017-muted">장비 없음</span>';
  function playerLine(u){
    const coord=u.location==='board'&&Number.isInteger(u.x)&&Number.isInteger(u.y)
      ?`<small>가로 ${u.x+1} · 세로 ${u.y+1}</small>`:'';
    return `<article class="m1017-unit"><div class="m1017-unit-name"><b>${escapeHtml(u.name)} ${star(u.star)}</b><small>${escapeHtml(u.role)}</small>${coord}</div><div class="m1017-equips">${equipment(u)}</div></article>`;
  }
  function shop(){
    return `<div class="m1017-shoplist">${data.shop.map((entry,i)=>entry?
      `<div class="m1017-shoprow"><span class="m1017-order">0${i+1}</span><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.role)}</small><span class="m1017-price">${escapeHtml(entry.cost)}C</span>${entry.owned?`<small>보유 ${entry.owned}</small>`:''}</div>`:
      `<div class="m1017-shoprow m1017-sold"><span class="m1017-order">0${i+1}</span>판매 완료</div>`).join('')||'<p class="m1017-empty">표시할 상점 상품이 없습니다.</p>'}</div>`;
  }
  function squad(){
    const board=data.owned.filter(u=>u.location==='board'),bench=data.owned.filter(u=>u.location==='bench');
    return `<h4>현재 전장 · ${board.length}명</h4>${board.map(playerLine).join('')||'<p class="m1017-empty">배치된 실험체 없음</p>'}
      <h4>벤치 · ${bench.length}/${data.benchCapacity}명</h4>${bench.map(playerLine).join('')||'<p class="m1017-empty">벤치가 비어 있습니다.</p>'}`;
  }
  function inventory(){
    const equipped=data.owned.filter(u=>u.equipment?.length);
    return `<h4>가방 · ${data.items.length}/12 ${data.pendingItems?`(수령 대기 ${data.pendingItems})`:''}</h4>
      <div class="m1017-itemlist">${data.items.map(itemMarkup).join('')||'<p class="m1017-empty">가방에 아이템 없음</p>'}</div>
      <h4>장착한 아이템 · ${equipped.reduce((n,u)=>n+u.equipment.length,0)}개</h4>
      ${equipped.map(u=>`<div class="m1017-equipped"><b>${escapeHtml(u.name)} ${star(u.star)}</b><div>${equipment(u)}</div></div>`).join('')||'<p class="m1017-empty">장착 장비 없음</p>'}`;
  }
  function overview(){
    const board=data.owned.filter(u=>u.location==='board'),bench=data.owned.filter(u=>u.location==='bench');
    const equipped=data.owned.reduce((n,u)=>n+(u.equipment?.length||0),0);
    return `<div class="m1017-metrics">
        <div><small>보유 크레딧</small><strong>${escapeHtml(data.credits)}C</strong></div>
        <div><small>팀 숙련도</small><strong>Lv.${escapeHtml(data.level)}</strong><span>${escapeHtml(data.exp)}/${escapeHtml(data.expMax||'MAX')} EXP</span></div>
        <div><small>편성 / 벤치</small><strong>${board.length} / ${bench.length}</strong><span>벤치 최대 ${data.benchCapacity}명</span></div>
        <div><small>가방 / 장착</small><strong>${data.items.length} / ${equipped}</strong><span>각각의 보유 수량</span></div>
      </div>
      <h4>상점 목록 <small>${data.shopLocked?'상점 고정 중':'상점 고정 해제'} · 조회만 가능</small></h4>${shop()}
      ${data.pendingUnits?`<p class="m1017-waiting">벤치 수령 대기 실험체 ${data.pendingUnits}명</p>`:''}`;
  }
  function draw(){
    if(!root||!data)return;
    const label=labels[data.kind]||labels[data.specialType]||'특수 라운드';
    const name=`R${escapeHtml(data.round)} ${escapeHtml(label)} · 보유 현황`;
    const sum=`${escapeHtml(data.credits)}C · 벤치 ${data.owned.filter(u=>u.location==='bench').length} · 가방 ${data.items.length}`;
    root.classList.toggle('m1017-expanded',open);
    root.innerHTML=`<button type="button" class="m1017-toggle" data-intel-toggle aria-expanded="${open}" aria-controls="m1017IntelBody">
        <span><b>${name}</b><small>${sum}</small></span><span aria-hidden="true">${open?'접기 ▾':'펼치기 ▴'}</span></button>
      <div id="m1017IntelBody" class="m1017-drawer" ${open?'':'hidden'}>
        <header><span>READ ONLY · ${escapeHtml(label)}</span><strong>현재 자산 조회</strong><p>선택에 필요한 정보만 확인할 수 있습니다. 구매와 편성 변경은 준비 단계에서 가능합니다.</p></header>
        <nav class="m1017-tabs" aria-label="보유 정보 항목">${[['overview','요약'],['shop','상점'],['squad','편성'],['items','아이템']].map(([id,label])=>
        `<button type="button" data-intel-tab="${id}" aria-pressed="${tab===id}">${label}</button>`).join('')}</nav>
        <div class="m1017-content">${tab==='shop'?shop():tab==='squad'?squad():tab==='items'?inventory():overview()}</div>
      </div>`;
  }
  function clear(){
    if(root)root.remove();root=null;data=null;signature='';open=false;tab='overview';
  }
  function render(snapshot){
    if(!snapshot||!['supply','special','result'].includes(snapshot.phase))return clear();
    const next=JSON.stringify(snapshot);
    if(!root){
      root=document.createElement('aside');root.id='m1017StageIntel';root.setAttribute('aria-label','특수 라운드 보유 현황');
      root.addEventListener('click',e=>{
        if(e.target.closest('[data-intel-toggle]')){open=!open;draw();return;}
        const t=e.target.closest('[data-intel-tab]');
        if(t&&t.dataset.intelTab!==tab){tab=t.dataset.intelTab;draw();}
      });
      document.body.appendChild(root);
    }
    if(next!==signature){data=snapshot;signature=next;draw();}
  }
  window.LIVEStageIntel={render,clear};
})();
