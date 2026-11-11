/* Server-authoritative M5 online shop and equipment editor. */
(()=>{'use strict';
 const roster=window.ERRoster?.byId||{};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let send=null,view=null;
 const panel=document.createElement('section');panel.id='m5-online-economy';panel.className='m5-online-economy';panel.hidden=true;
 document.getElementById('m5-economy-panel')?.after(panel);
 const name=id=>roster[id]?.name||id;
 function draw(player,g){view=player;const a=player?.assets;if(!a||!g||g.phase!=='prep'){panel.hidden=true;return;}panel.hidden=false;
 const owns=a.owned||[];
 panel.innerHTML=`<div class="m5-oe-title"><b>ONLINE MARKET · ROUND ${g.round}</b><span>${a.credits}C · 숙련도 Lv.${a.level} (${a.exp} EXP)</span></div>
 <div class="m5-oe-actions"><button data-act="reroll">리롤 2C</button><button data-act="lock">${a.locked?'잠금 해제':'상점 잠금'}</button><button data-act="invest">숙련도 +2EXP / 2C</button></div>
 <div class="m5-oe-shop">${(a.shop||[]).map((id,i)=>`<button data-act="buy" data-index="${i}" ${!id?'disabled':''}>${id?esc(name(id))+' · '+(roster[id]?.cost||1)+'C':'판매 완료'}</button>`).join('')}</div>
 <div class="m5-oe-units">${owns.map(o=>`<div class="m5-oe-unit"><b>${esc(name(o.characterId))} ${'★'.repeat(o.star)}</b><small>${o.location==='board'?`전장 (${o.x+1},${o.y+1})`:'벤치'} · 장비 ${(o.items||[]).map(esc).join(', ')||'없음'}</small><div><button data-act="deploy" data-uid="${o.uid}">배치</button><button data-act="recall" data-uid="${o.uid}">벤치</button><button data-act="sell" data-uid="${o.uid}">판매</button></div></div>`).join('')}</div>
 <div class="m5-oe-items"><b>인벤토리</b> ${(a.items||[]).map((item,i)=>`<button data-item="${esc(item)}" data-i="${i}">${esc(item)} 장착</button>`).join('')||'보유 장비 없음'}</div><p id="m5-oe-status" role="status">유닛 배치/장비 장착 버튼을 누르면 대상을 선택할 수 있어.</p>`;
 panel.querySelectorAll('[data-act]').forEach(b=>b.onclick=async()=>{if(!send)return;let payload={};const cmd=b.dataset.act;if(b.dataset.index!==undefined)payload.index=Number(b.dataset.index);if(b.dataset.uid)payload.uid=Number(b.dataset.uid);
 if(cmd==='deploy'){const chosen=prompt('배치 좌표를 입력해 (열,행 1~3)', '1,1');if(chosen===null)return;const m=/^\s*([1-3])\s*,\s*([1-3])\s*$/.exec(chosen);if(!m){panel.querySelector('#m5-oe-status').textContent='좌표는 1,1 ~ 3,3으로 입력해.';return;}payload.x=+m[1]-1;payload.y=+m[2]-1;}
 try{await send(cmd,payload)}catch(e){panel.querySelector('#m5-oe-status').textContent=e.message;}
 });
 panel.querySelectorAll('[data-item]').forEach(b=>b.onclick=async()=>{if(!send)return;const uid=Number(prompt('장착할 실험체 UID를 입력해',String(owns[0]?.uid||'')));if(!owns.some(o=>o.uid===uid))return;try{await send('equip',{uid,item:b.dataset.item})}catch(e){panel.querySelector('#m5-oe-status').textContent=e.message}});
 }
 window.M5OnlineEconomy={draw,attach:fn=>{send=fn},hide:()=>{panel.hidden=true;}};
})();
