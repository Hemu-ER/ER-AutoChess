/* L.I.V.E. M5-07 — isolated, local-only economy & bench.
   M4 numbers/roster/pool odds are reused; no account, server or M4 mutations. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const roster = window.ERRoster?.roster || [];
  const byId = window.ERRoster?.byId || {};
  const live = window.LIVEM5;
  const panel = $('m5-economy-panel');
  if (!panel || !live || !roster.length) return;
  const PLAYABLE = roster.filter(r => !r.pveOnly && [1,2,3].includes(r.cost));
  const ODDS = [[1,3,80,20,0],[4,6,70,30,0],[7,9,57,38,5],[10,12,43,45,12],[13,15,30,47,23],[16,18,20,43,37],[19,19,14,38,48],[20,20,10,30,60]];
  const XP = {1:4,2:4,3:4,4:4,5:4,6:4,7:5,8:5,9:5,10:5,11:5,12:5,13:6,14:6,15:6,16:6,17:6,18:6,19:6};
  const POOL={1:18,2:15,3:12}, MAX_BENCH=8, BOARD_CAP=3;
  const defaultTeam=[['aya',0,0],['bianca',1,1],['isol',2,2]];
  let data, chosenBench=null, chosenBoard=null, dragUid=null, busyOnline=false, syncing=false;
  const meta=id=>byId[id];
  const name=id=>byId[id]?.name||id;
  const copyValue = star => 3**(star-1);
  const bench=()=>data.owned.filter(o=>o.location==='bench');
  const board=()=>data.owned.filter(o=>o.location==='board');
  const ownedByUid=uid=>data.owned.find(o=>o.uid===Number(uid));
  const boardAt=(x,y)=>board().find(o=>o.x===x&&o.y===y);
  const copyCount=id=>data.owned.filter(o=>o.characterId===id).reduce((n,o)=>n+copyValue(o.star),0);
  const odds=()=>{const row=ODDS.find(r=>data.level>=r[0]&&data.level<=r[1])||ODDS.at(-1);return {1:row[2],2:row[3],3:row[4]};};
  const message=t=>{ $('m5-econ-message').textContent=t; };
  const editable=()=>!busyOnline && !live.getCombatState();
  const makeOwned=(characterId,where='bench',x=null,y=null,star=1)=>({uid:data.nextUid++,characterId,star,location:where,x,y,equipment:[]});
  function initial(){
    clearPlacementEcho();
    data={credits:5,round:1,level:1,exp:0,locked:false,nextUid:1,shop:[],owned:[]};
    window.M5Systems?.resetItems?.();
    data.owned=defaultTeam.map(([c,x,y])=>makeOwned(c,'board',x,y));
    rollShop();chosenBench=null;chosenBoard=data.owned[1]?.uid||null;dragUid=null;
    syncBoard();render();message('M4와 분리된 경제 실험실이야. 시작 5C · 5칸 상점 · 8칸 벤치.');
    return true;
  }
  function remaining(id,pending=[]){const r=meta(id);return Math.max(0,(POOL[r?.cost]||0)-copyCount(id)-pending.filter(p=>p===id).length);}
  function pick(pending){
    const o=odds(),costs=[1,2,3].filter(cost=>o[cost]>0&&PLAYABLE.some(r=>r.cost===cost&&remaining(r.id,pending)>0));
    if(!costs.length)return null;
    let ticket=Math.random()*costs.reduce((n,c)=>n+o[c],0),cost=costs.at(-1);
    for(const c of costs){ticket-=o[c];if(ticket<0){cost=c;break;}}
    const options=PLAYABLE.filter(r=>r.cost===cost).map(r=>({id:r.id,weight:remaining(r.id,pending)})).filter(r=>r.weight>0);
    if(!options.length)return null;
    let roll=Math.random()*options.reduce((n,r)=>n+r.weight,0);
    for(const x of options){roll-=x.weight;if(roll<0)return x.id;}
    return options.at(-1).id;
  }
  function rollShop(){data.shop=[];for(let i=0;i<5;i++){data.shop.push(pick(data.shop));}}
  const sortPriority=o=>o.location==='board'?((2-o.x)*10+o.y):100+data.owned.indexOf(o);
  function autoMerge(){
    const notes=[];
    for(let attempts=0;attempts<20;attempts++){
      let group=null;
      for(const star of [2,1]){
        const pairs=new Map();
        for(const o of data.owned.filter(e=>e.star===star)){
          const key=o.characterId+'|'+star;
          if(!pairs.has(key))pairs.set(key,[]);
          pairs.get(key).push(o);
        }
        group=[...pairs.values()].find(a=>a.length>=3);
        if(group)break;
      }
      if(!group)break;
      const three=group.sort((a,b)=>sortPriority(a)-sortPriority(b)).slice(0,3);
      const returns=three.flatMap(o=>o.equipment||[]);
      if(!window.M5Systems?.canAcceptItems?.(returns.length))continue;
      const survivor=three[0];
      if(returns.length)window.M5Systems.addItems(returns,{silent:true});
      survivor.equipment=[];
      data.owned=data.owned.filter(o=>o===survivor||!three.includes(o));
      survivor.star++;
      notes.push(name(survivor.characterId)+' '+ '★'.repeat(survivor.star));
      if(chosenBench&&three.some(o=>o.uid===chosenBench)&&chosenBench!==survivor.uid)chosenBench=survivor.location==='bench'?survivor.uid:null;
      if(chosenBoard&&three.some(o=>o.uid===chosenBoard)&&chosenBoard!==survivor.uid)chosenBoard=survivor.location==='board'?survivor.uid:null;
    }
    return notes;
  }
  function purchase(i){
    if(!editable())return message('전투 중이나 온라인 게임에서는 상점을 사용할 수 없어.');
    const cid=data.shop[i],r=meta(cid);if(!r)return;
    if(data.credits<r.cost)return message('크레딧이 부족해.');
    const immediateMerge=data.owned.filter(o=>o.characterId===cid&&o.star===1).length>=2;
    if(bench().length>=MAX_BENCH&&(!immediateMerge||!window.M5Systems?.canAcceptItems?.(data.owned.filter(o=>o.characterId===cid&&o.star===1).slice(0,2).reduce((n,o)=>n+(o.equipment||[]).length,0))))return message('벤치 또는 인벤토리 공간이 부족해.');
    data.credits-=r.cost;data.owned.push(makeOwned(cid));data.shop[i]=null;
    const merged=autoMerge();
    message(merged.length?`${name(cid)} 구매 · ${merged.join(', ')} 합성 완료!`:`${name(cid)} 구매 · 벤치에 보관했어.`);
    syncBoard();render();
  }
  function reroll(){if(!editable())return;if(data.credits<2)return message('리롤에 필요한 2C가 부족해.');data.credits-=2;rollShop();render();message('상점을 새로고침했어.');}
  function lock(){if(!editable())return;data.locked=!data.locked;render();message(data.locked?'다음 라운드까지 상점을 고정했어.':'상점 고정을 해제했어.');}
  function addExp(n){data.exp+=n;while(data.level<20&&data.exp>=XP[data.level]){data.exp-=XP[data.level];data.level++;}if(data.level===20)data.exp=0;}
  function invest(){if(!editable()||data.level>=20)return;if(data.credits<2)return message('숙련도 투자에 필요한 2C가 부족해.');data.credits-=2;addExp(2);render();message('숙련도 EXP +2');}
  function nextRound(){
    if(!editable())return;
    const interest=Math.min(3,Math.floor(data.credits/10));
    data.credits+=5+interest;data.round++;addExp(4);
    if(!data.locked)rollShop();
    render();message(`오프라인 라운드 R${data.round} · 수입 5C + 이자 ${interest}C · 숙련도 EXP +4`);
  }
  function sellValue(o){const base=(meta(o.characterId)?.cost||1)*copyValue(o.star);return o.star===1?base:Math.ceil(base*.5);}
  function canSell(o){return Boolean(o)&&editable();}
  function sell(uid){
    const o=ownedByUid(uid);if(!canSell(o))return false;
    const returns=o.equipment||[];
    if(returns.length&&!window.M5Systems?.canAcceptItems?.(returns.length))return message('인벤토리 공간이 부족해서 판매할 수 없어.');
    if(returns.length)window.M5Systems.addItems(returns,{silent:true});
    const refunded=sellValue(o);
    data.credits+=refunded;
    data.owned=data.owned.filter(x=>x!==o);
    if(chosenBench===o.uid)chosenBench=null;
    if(chosenBoard===o.uid)chosenBoard=null;
    syncBoard();render();message(`${name(o.characterId)} ${'★'.repeat(o.star)} 판매 · +${refunded}C`);return true;
  }
  function recallUid(uid){
    if(!editable())return false;
    const o=ownedByUid(uid);if(!o||o.location!=='board')return false;
    if(bench().length>=MAX_BENCH){message('벤치에 빈자리가 없어.');return false;}
    o.location='bench';o.x=o.y=null;chosenBench=o.uid;chosenBoard=null;
    syncBoard();render();message(`${name(o.characterId)} 벤치로 회수`);return true;
  }
  function recall(){return recallUid(chosenBoard);}
  let placementEcho=null;
  function clearPlacementEcho(){placementEcho?.remove();placementEcho=null;}
  function showPlacementEcho(o,x,y){
    clearPlacementEcho();
    const stage=$('stage-wrap'),canvas=$('stage')?.querySelector('canvas');
    if(!stage||!canvas)return;
    const canvasRect=canvas.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    if(!canvasRect.width||!canvasRect.height)return;
    const node=document.createElement('div');node.className='m5-placement-echo';
    node.style.left=(canvasRect.left-stageRect.left+canvasRect.width*(x+.5)/3)+'px';
    node.style.top=(canvasRect.top-stageRect.top+canvasRect.height*(y+.87)/3)+'px';
    const im=document.createElement('img');im.src=`assets/characters/${o.characterId}.png`;im.alt='';
    node.appendChild(im);stage.appendChild(node);placementEcho=node;
  }
  function deploy(uid,x,y){
    if(!editable()||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=3||y<0||y>=3)return false;
    const o=ownedByUid(uid);if(!o||o.location!=='bench')return false;
    const occupant=boardAt(x,y);
    if(!occupant&&board().length>=BOARD_CAP){message('전장에는 최대 3명만 배치할 수 있어.');return false;}
    // Replacing an occupied cell returns its previous unit to the vacated bench slot.
    if(occupant){occupant.location='bench';occupant.x=occupant.y=null;}
    o.location='board';o.x=x;o.y=y;
    chosenBench=null;chosenBoard=o.uid;
    showPlacementEcho(o,x,y);
    syncBoard();render();message(occupant?`${name(o.characterId)} 배치 · ${name(occupant.characterId)} 벤치 복귀`:`${name(o.characterId)} 배치 완료`);
    return true;
  }
  function syncBoard(){
    if(busyOnline)return;
    const entries=board().map(o=>({uid:o.uid,characterId:o.characterId,star:o.star,x:o.x,y:o.y}));
    syncing=true;
    Promise.resolve(live.sandboxApplyRoster(entries)).catch(e=>message('전장 스프라이트 연결 실패: '+e.message)).finally(()=>{syncing=false;clearPlacementEcho();});
  }
  function syncBoardPositions(people){
    if(busyOnline||syncing)return;
    for(const u of people){
      const uid=Number(String(u.id).replace(/^owned-/,''));
      const o=ownedByUid(uid);
      if(o&&o.location==='board'){o.x=u.x;o.y=u.y;}
    }
    render();
  }
  function syncSelection(id){
    if(busyOnline)return;
    const uid=Number(String(id||'').replace(/^owned-/,''));
    if(ownedByUid(uid)?.location==='board'){chosenBoard=uid;chosenBench=null;render();}
  }
  function card(id,i){
    if(!id)return `<div class="m5-shop-card m5-shop-sold"><span>판매 완료</span></div>`;
    const r=meta(id),ownedN=data.owned.filter(o=>o.characterId===id).length;
    const badge=ownedN?`<span class="m5-owned-badge">보유 ${ownedN}</span>`:'';
    return `<button class="m5-shop-card" type="button" data-buy="${i}" ${data.credits<r.cost?'disabled':''}>
      ${badge}<img src="assets/characters/${id}.png" alt="" loading="lazy"><span class="m5-shop-tags">${(r.affiliations||[]).slice(0,2).join(' · ')}</span><strong>${name(id)}</strong><span class="m5-shop-price"><small>${r.role||''}</small><b>${r.cost}C</b></span>
    </button>`;
  }
  function benchCard(o,index){
    if(!o)return `<div class="m5-bench-slot m5-empty-slot"><b>${index+1}</b><small>EMPTY</small></div>`;
    const cid=o.characterId;
    return `<button class="m5-bench-slot ${chosenBench===o.uid?'m5-picked':''}" type="button" draggable="false" data-bench="${o.uid}" aria-label="${name(cid)} ${o.star}성, 배치할 실험체 선택">
      <img src="assets/characters/${cid}.png" alt=""><span class="m5-bench-star">${'★'.repeat(o.star)}</span><strong>${name(cid)}</strong>${o.equipment?.length?`<span class="m5-bench-equip-count">장비 ${o.equipment.length}/3</span>`:''}
    </button>`;
  }
  function render(){
    if(!data)return;
    $('m5-credit-count').textContent=data.credits;
    $('m5-market-odds').textContent=`R${data.round} · ${data.level}레벨 상점 확률 `+Object.entries(odds()).map(([k,v])=>`${k}코 ${v}%`).join(' / ');
    $('m5-shop-lock').classList.toggle('m5-locked',data.locked);
    $('m5-shop-lock').textContent=data.locked?'🔒 상점 고정 중':'🔓 상점 고정';
    $('m5-shop-cards').innerHTML=data.shop.map(card).join('');
    const benchList=bench();
    $('m5-bench-count').textContent=`${benchList.length} / ${MAX_BENCH}`;
    $('m5-bench-cards').innerHTML=Array.from({length:MAX_BENCH},(_,i)=>benchCard(benchList[i],i)).join('');
    $('m5-mastery-label').textContent=`Lv.${data.level}`;
    $('m5-mastery-exp').textContent=data.level>=20?'MAX':`${data.exp} / ${XP[data.level]} EXP`;
    const types=new Map();
    for(const o of board())for(const aff of meta(o.characterId)?.affiliations||[]){const set=types.get(aff)||new Set();set.add(o.characterId);types.set(aff,set);}
    const sym=$('m5-synergy-list');sym.replaceChildren();
    if(window.M5Systems?.renderSynergies){window.M5Systems.renderSynergies(board());}else{
    for(const [a,v] of [...types].sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0],'ko'))){const chip=document.createElement('span');chip.textContent=`${a} ${v.size}`;chip.className=v.size>=2?'m5-synergy-active':'';sym.appendChild(chip);}
    if(!types.size)sym.textContent='실험체를 배치해 시너지 확인';
    }
    const selected=ownedByUid(chosenBench)||ownedByUid(chosenBoard);
    window.M5Systems?.renderEquipment?.(data.owned, selected?.uid||null);
    window.M5Systems?.itemRender?.();
    $('m5-econ-selection').textContent=selected?`${name(selected.characterId)} ${'★'.repeat(selected.star)} · ${selected.location==='bench'?'벤치 선택됨 · 칸 터치로 배치':'전장 배치 중'}`:`전장 또는 벤치의 실험체를 선택해 줘`;
    $('m5-econ-recall').disabled=!editable()||selected?.location!=='board';
    $('m5-econ-sell').disabled=!editable()||!selected;
    $('m5-shop-reroll').disabled=!editable()||data.credits<2;
    $('m5-mastery-buy').disabled=!editable()||data.level===20||data.credits<2;
    $('m5-next-round').disabled=!editable();
    $('m5-econ-reset').disabled=!editable();
    panel.querySelectorAll('[data-buy]').forEach(el=>el.disabled ||=!editable());
  }
  // M5-11: Equipment belongs to a *specific owned copy*, not to character ID.
  function equipmentTarget(uid){return ownedByUid(uid)}
  function equip(uid,item){
    if(!editable())return {ok:false,message:'준비 단계에서만 장착할 수 있어.'};
    const o=ownedByUid(uid),db=window.LIVEItems?.all||{},entry=db[item];
    if(!o||!entry)return {ok:false,message:'장비나 실험체를 찾지 못했어.'};
    const eq=o.equipment||(o.equipment=[]);
    const basicIndex=entry.basic?eq.findIndex(v=>db[v]?.basic):-1;
    if(basicIndex>=0){
      const made=window.LIVEItems.craft(eq[basicIndex],item);
      if(!made)return {ok:false,message:'기본 아이템 조합이 올바르지 않아.'};
      eq[basicIndex]=made;
      if(o.location==='board'){chosenBoard=o.uid;chosenBench=null}else{chosenBench=o.uid;chosenBoard=null}
      syncBoard();render();return {ok:true,message:`${name(o.characterId)} · ${made} 완성!`,craft:made};
    }
    if(eq.length>=3)return {ok:false,message:'장착 슬롯은 실험체당 최대 3칸이야.'};
    eq.push(item);
    if(o.location==='board'){chosenBoard=o.uid;chosenBench=null}else{chosenBench=o.uid;chosenBoard=null}
    syncBoard();render();
    const copies=eq.filter(v=>v===item).length;
    return {ok:true,message:`${name(o.characterId)} · ${item} 장착${copies>1&&!entry.basic?' (고유 효과는 중첩되지 않음)':''}`};
  }
  function selectEquipmentTarget(uid){
    const o=ownedByUid(uid);if(!o)return false;
    if(o.location==='bench'){chosenBench=o.uid;chosenBoard=null}
    else{chosenBoard=o.uid;chosenBench=null}
    render();return true;
  }
  function setOnline(on){
    busyOnline=Boolean(on);clearPlacementEcho();panel.hidden=busyOnline;
    document.body.classList.toggle('m5-economy-enabled',!busyOnline);
    if(!busyOnline){initial();}
    else{chosenBench=null;dragUid=null;render();}
  }
  panel.addEventListener('click',e=>{
    const buy=e.target.closest('[data-buy]');if(buy){purchase(Number(buy.dataset.buy));return;}
    const seat=e.target.closest('[data-bench]');if(seat){chosenBench=Number(seat.dataset.bench);chosenBoard=null;render();message('벤치 실험체 선택됨 · 원하는 아군 칸을 터치하거나 드래그해 배치해.');}
  });
  // Unified mouse/pen/touch drag with a real character-image ghost. HTML5
  // native drag is deliberately disabled (no mobile support, opaque preview).
  let benchGesture=null;
  const removeGhost=()=>{sellHover(-1,-1,null);benchGesture?.ghost?.remove();document.querySelectorAll('.m5-bench-grabbed').forEach(x=>x.classList.remove('m5-bench-grabbed'));document.body.classList.remove('m5-is-dragging');$('stage')?.classList.remove('m5-stage-drop-active');live.clearDragPreview?.();};
  const sellButton=$('m5-econ-sell');
  const inside=(r,x,y)=>r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
  const overSell=(x,y)=>inside(sellButton?.getBoundingClientRect(),x,y);
  const sellHover=(x,y,uid)=>{
    const target=overSell(x,y)&&editable();
    sellButton?.classList.toggle('m5-sell-hover',!!target);
    if(sellButton)sellButton.textContent=target?`판매하고 +${sellValue(ownedByUid(uid))}C 받기`:'판매 · 여기로 드래그';
    return target;
  };
  const placeGhost=(g,x,y)=>{if(!g.ghost)return;g.ghost.style.left=x+'px';g.ghost.style.top=y+'px';};
  panel.addEventListener('dragstart',e=>{if(e.target.closest('[data-bench]'))e.preventDefault();});
  panel.addEventListener('pointerdown',e=>{
    const seat=e.target.closest('[data-bench]');
    if(!seat||!editable()||(e.pointerType==='mouse'&&e.button!==0))return;
    const uid=Number(seat.dataset.bench),o=ownedByUid(uid);if(!o)return;
    const ghost=document.createElement('div');ghost.className='m5-drag-ghost m5-drag-pending';
    const img=document.createElement('img');img.src=`assets/characters/${o.characterId}.png`;img.alt='';
    const txt=document.createElement('span');txt.textContent=name(o.characterId);
    ghost.append(img,txt);document.body.appendChild(ghost);
    benchGesture={uid,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,ghost};
    placeGhost(benchGesture,e.clientX,e.clientY);
    seat.classList.add('m5-bench-grabbed');
    if(e.pointerType!=='mouse')e.preventDefault();
  });
  document.addEventListener('pointermove',e=>{
    const g=benchGesture;if(!g||g.pointerId!==e.pointerId)return;
    const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y);
    if(!g.active&&distance>=5){
      g.active=true;dragUid=g.uid;g.ghost?.classList.remove('m5-drag-pending');
      document.body.classList.add('m5-is-dragging');
    }
    placeGhost(g,e.clientX,e.clientY);
    if(!g.active)return;
    e.preventDefault();
    const selling=sellHover(e.clientX,e.clientY,g.uid);
    const cell=selling?null:live.dragPreviewAt?.(e.clientX,e.clientY);
    g.ghost.classList.toggle('m5-over-sell',!!selling);
    g.ghost.classList.toggle('m5-over-board',!!cell);
    g.ghost.classList.toggle('m5-invalid-drop',!cell);
    $('stage')?.classList.toggle('m5-stage-drop-active',!!cell);
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    const g=benchGesture;if(!g||g.pointerId!==e.pointerId)return;
    const dragged=g.active;const selling=overSell(e.clientX,e.clientY);removeGhost();benchGesture=null;dragUid=null;
    if(dragged){
      if(selling){sell(g.uid);suppressBenchClickUntil=performance.now()+260;return;}
      const target=live.cellFromClient?.(e.clientX,e.clientY);
      if(target)deploy(g.uid,target.x,target.y);
      else message('아군 3×3 칸에 놓아야 배치할 수 있어.');
      // Do not fire synthetic click on the bench slot after dragging.
      g.suppressClick=true;
      suppressBenchClickUntil=performance.now()+260;
    }
  });
  document.addEventListener('pointercancel',e=>{if(benchGesture?.pointerId===e.pointerId){removeGhost();benchGesture=null;dragUid=null;}});
  let suppressBenchClickUntil=0;
  panel.addEventListener('click',e=>{if(e.target.closest('[data-bench]')&&performance.now()<suppressBenchClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  $('m5-shop-reroll').addEventListener('click',reroll);
  $('m5-shop-lock').addEventListener('click',lock);
  $('m5-next-round').addEventListener('click',nextRound);
  $('m5-mastery-buy').addEventListener('click',invest);
  $('m5-econ-reset').addEventListener('click',initial);
  $('m5-econ-recall').addEventListener('click',recall);
  $('m5-econ-sell').addEventListener('click',()=>sell(chosenBench||chosenBoard));
  window.M5Economy=Object.freeze({
    enabled:()=>!busyOnline,
    reset:initial,
    setOnline,
    onCellTap:(x,y)=>{if(!chosenBench)return false;deploy(chosenBench,x,y);return true;},
    hasDrag:()=>dragUid!==null,
    recallDraggedUnit:(id)=>recallUid(Number(String(id).replace(/^owned-/,''))),
    drop:(x,y)=>{if(dragUid!==null){const uid=dragUid;dragUid=null;return deploy(uid,x,y);}return false;},
    syncBoardPositions,syncSelection,
    getState:()=>JSON.parse(JSON.stringify(data)),
    equipmentTarget, equip, selectEquipmentTarget, canModify:editable,
    addCredits:(amount)=>{if(!editable())return false;data.credits+=amount;render();return true;},
    sellDraggedUnit:id=>sell(Number(String(id).replace(/^owned-/,''))),
    saleValue:id=>{const o=ownedByUid(Number(String(id).replace(/^owned-/,'')));return o?sellValue(o):0;},
    dragSalePreview:(x,y,id)=>sellHover(x,y,Number(String(id).replace(/^owned-/,''))),
    clearSalePreview:()=>sellHover(-1,-1,null),
    buy:purchase,reroll,deploy,sell,recall,nextRound,invest
  });
  document.body.classList.add('m5-economy-enabled');
  initial();
})();
