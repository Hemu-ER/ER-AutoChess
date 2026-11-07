(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const tabs=[...document.querySelectorAll('[data-qa-tab]')];
 const show=tab=>{for(const b of tabs){const on=b.dataset.qaTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}for(const p of document.querySelectorAll('[data-qa-view]'))p.classList.toggle('active',p.dataset.qaView===tab);};
 tabs.forEach(b=>b.addEventListener('click',()=>show(b.dataset.qaTab)));
 document.querySelectorAll('[data-qa-jump]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.qaJump)));
 let team='A';const search=byId('qaInfSearch'),tier=byId('qaInfTier'),list=byId('qaInfGrid');
 const catalog=window.LIVEInfusionCatalog||[];
 const render=()=>{
  const q=search.value.trim().toLocaleLowerCase('ko'),filter=tier.value;
  const selected=new Set([...byId('qaInf'+team).selectedOptions].map(x=>x.value));
  byId('qaInfCount').textContent=`${team}팀 선택 ${selected.size}종`;
  for(const b of document.querySelectorAll('[data-inf-team]'))b.classList.toggle('active',b.dataset.infTeam===team);
  const items=catalog.filter(c=>(filter==='all'||c.tier===filter)&&[c.name,c.target,c.description,c.id].join(' ').toLocaleLowerCase('ko').includes(q));
  list.replaceChildren();if(!items.length){const m=document.createElement('p');m.textContent='조건에 맞는 인퓨전이 없어.';list.append(m)}
  for(const c of items){const b=document.createElement('button');b.type='button';b.className='qa-inf-option'+(selected.has(c.id)?' selected':'');b.setAttribute('aria-pressed',String(selected.has(c.id)));const id=document.createElement('span');id.className='qa-id';id.textContent=c.id+' · '+({gray:'회색',blue:'파랑',purple:'보라'}[c.tier]||c.tier)+' · '+(c.target||'공통');const n=document.createElement('span');n.className='qa-inf-name';n.textContent=c.name;const d=document.createElement('span');d.className='qa-inf-desc';d.textContent=c.description||'';b.append(id,n,d);b.onclick=()=>{const sel=byId('qaInf'+team);const opt=[...sel.options].find(x=>x.value===c.id);if(!opt)return;opt.selected=!opt.selected;sel.dispatchEvent(new Event('change',{bubbles:true}));render()};list.append(b)}
 };
 document.querySelectorAll('[data-inf-team]').forEach(b=>b.onclick=()=>{team=b.dataset.infTeam;render()});search.oninput=render;tier.onchange=render;
 for(const id of ['qaInfA','qaInfB'])byId(id).addEventListener('change',render);
 for(const id of ['qaClearInf','qaAllBlue'])byId(id).addEventListener('click',()=>setTimeout(render,0));
 byId('qaImport').addEventListener('change',()=>setTimeout(render,120));
 const mirror=byId('qaStatusMirror'),status=byId('status');if(status&&mirror){mirror.textContent=status.textContent;new MutationObserver(()=>mirror.textContent=status.textContent).observe(status,{childList:true,characterData:true,subtree:true})}
 render();show('formation');
})();
