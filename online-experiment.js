'use strict';
(()=>{
 const panel=document.createElement('section');panel.id='liveExperiment';panel.hidden=true;panel.className='qa-stage';panel.style.cssText='position:fixed;inset:4vh 6vw;z-index:1200;overflow:auto;background:#10191e;color:#e7f0ec;padding:24px;border:1px solid #639c88;border-radius:12px';document.body.appendChild(panel);
 let marker='',busy=false,seq=0;
 function render(){const room=window.LIVEMultiplayer?.getRoom(),g=room?.game,e=g?.experiment,active=g?.phase==='special'&&g.specialType==='experiment'&&!!e;panel.hidden=!active;if(!active){marker='';return}seq=Math.max(seq,e.seq||0);const key=g.round+':'+e.version;if(key===marker)return;marker=key;
 const values=[...panel.querySelectorAll('input')].map(el=>({id:el.id,name:el.name,value:el.value,checked:el.checked,focus:el===document.activeElement,start:el.selectionStart}));
 const scroll=panel.scrollTop;
 panel.innerHTML=`<h2>번외 실험 · ${e.kind}</h2><p>${e.virtualPartner?'가상 파트너와 진행 · ':''}남은 시간 <b>${Math.max(0,Math.ceil((e.deadline-Date.now())/1000))}초</b></p>`+e.html;
 for(const v of values){const el=v.id?panel.querySelector('#'+v.id):[...panel.querySelectorAll('input')].find(x=>x.name===v.name&&x.value===v.value);if(!el)continue;el.value=v.value;el.checked=v.checked;if(v.focus){el.focus();if(el.type==='text'||!el.type)el.setSelectionRange?.(v.start,v.start)}}panel.scrollTop=scroll;
 }
 async function send(action,value=''){
 if(busy)return;const g=window.LIVEMultiplayer?.getRoom()?.game;if(!g?.experiment)return;busy=true;
 const read=id=>panel.querySelector('#'+id)?.value||'';
 const payload={round:g.round,seq:++seq,action,value,credits:Number(read('qaShare')),exp:Number(read('qaExp')),items:[...panel.querySelectorAll('input[name="qaGiveItem"]:checked')].map(e=>Number(e.value)),answer:read('qaQuizAnswer'),text:action==='search'?read('qaCodexSearch'):read('qaChatText')};
 try{const res=await fetch('/api/experiment',{method:'POST',headers:{'content-type':'application/json','x-live-token':window.LIVEMultiplayer.getToken()},body:JSON.stringify(payload)});const result=await res.json();if(!res.ok){let msg=panel.querySelector('.experiment-error');if(!msg){msg=document.createElement('p');msg.className='experiment-error';panel.prepend(msg)}msg.textContent=result.error}}finally{busy=false;}
 }
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)send(b.dataset.action,b.dataset.val)});
 panel.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='qaQuizAnswer')send('quizAnswer');if(e.key==='Enter'&&e.target.id==='qaChatText')send('chat')});
 panel.addEventListener('input',e=>{if(e.target.id==='qaShare')panel.querySelector('#qaShareOut').textContent=e.target.value+'C';if(e.target.id==='qaExp')panel.querySelector('#qaExpOut').textContent=e.target.value+' EXP';});
 let searchTimer;panel.addEventListener('input',e=>{if(e.target.id==='qaCodexSearch'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>send('search'),300)}});
 document.addEventListener('keydown',e=>{if(panel.hidden||e.target.matches('input,textarea,select'))return;const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',' ':'drop'}[e.key];if(action&&window.LIVEMultiplayer.getRoom().game.experiment.kind==='stack'){e.preventDefault();send(action)}});
 setInterval(render,100);
})();
