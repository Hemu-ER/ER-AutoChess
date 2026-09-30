"use strict";
(() => {
  const STYLE_ID="live-intro-style", ROOT_ID="live-intro";
  if(document.getElementById(ROOT_ID))return;
  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  #${ROOT_ID}{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:#030607;color:#e9f3f0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:1;visibility:visible;transition:opacity .45s ease,visibility .45s ease;cursor:pointer;touch-action:manipulation}
  #${ROOT_ID}.live-exit{opacity:0;visibility:hidden;pointer-events:none}
  #${ROOT_ID} .live-tablet{position:absolute;inset:clamp(12px,3vw,38px);overflow:hidden;border:1px solid #34474a;border-radius:clamp(10px,1.5vw,18px);background:radial-gradient(circle at 50% 48%,rgba(109,160,151,.055),transparent 42%),linear-gradient(180deg,#050a0b,#030607);box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),inset 0 0 55px rgba(103,156,147,.025);animation:liveBorder 3s ease-in-out infinite}
  #${ROOT_ID} .live-tablet:before{content:"";position:absolute;inset:10px;border:1px solid rgba(166,211,203,.13);border-radius:calc(clamp(10px,1.5vw,18px) - 5px);pointer-events:none}
  #${ROOT_ID} .live-terminal{position:absolute;left:30px;top:29px;color:#708681;font-size:9px;letter-spacing:.18em}
  #${ROOT_ID} .live-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:58px 18px;text-align:center}
  #${ROOT_ID} .live-logo{font-size:clamp(58px,12vw,128px);font-weight:650;letter-spacing:.14em;line-height:1;color:#f4faf8;text-shadow:0 0 18px rgba(221,247,240,.11);opacity:0;transform:translateY(5px);animation:liveIn .8s .15s ease forwards}
  #${ROOT_ID} .live-ko{margin-top:12px;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;font-size:clamp(11px,1.4vw,15px);letter-spacing:.28em;color:#9baea9;opacity:0;animation:liveIn .7s .42s ease forwards}
  #${ROOT_ID} .live-enter{position:absolute;left:0;right:0;bottom:31px;text-align:center;color:#71847f;font-size:9px;letter-spacing:.18em;opacity:0;animation:liveIn .7s .85s ease forwards}
  @keyframes liveIn{to{opacity:1;transform:translateY(0)}}@keyframes liveBorder{0%,100%{border-color:#34474a}50%{border-color:#718b85;box-shadow:inset 0 0 42px rgba(181,225,216,.04),0 0 18px rgba(122,172,162,.05)}}
  @media(max-width:600px){#${ROOT_ID} .live-tablet{inset:8px}#${ROOT_ID} .live-terminal{left:22px;top:22px;font-size:7px}#${ROOT_ID} .live-logo{font-size:clamp(52px,18vw,82px)}}
  @media(prefers-reduced-motion:reduce){#${ROOT_ID} *{animation-duration:.001ms!important;animation-delay:0ms!important;transition-duration:.001ms!important}}`;
  document.head.appendChild(style);
  const root=document.createElement("section");
  root.id=ROOT_ID;root.tabIndex=0;root.setAttribute("role","button");root.setAttribute("aria-label","LIVE 시작 화면. 클릭하면 계속합니다.");
  root.innerHTML=`<div class="live-tablet"><div class="live-terminal">AGLAIA // VIRTUAL EXPERIMENT TERMINAL</div><div class="live-stage"><div class="live-logo">LIVE</div><div class="live-ko">루미아 섬 가상 실험</div></div><div class="live-enter">CLICK / TAP TO CONTINUE</div></div>`;
  document.body.appendChild(root);
  let closing=false;
  function finish(ev){if(closing)return;closing=true;ev?.preventDefault?.();ev?.stopPropagation?.();root.classList.add("live-exit");setTimeout(()=>{root.remove();style.remove()},480)}
  root.addEventListener("pointerup",finish);
  root.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" ")finish(ev)});
  requestAnimationFrame(()=>root.focus({preventScroll:true}));
})();
