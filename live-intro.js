"use strict";
(() => {
  const STYLE_ID="live-intro-style", ROOT_ID="live-intro";
  if(document.getElementById(ROOT_ID))return;

  const FULL="Lumia Island Virtual Experiment";
  const INITIAL_INDEX=new Set([0,6,13,21]); // L I V E

  const style=document.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
  #${ROOT_ID}{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:#030607;color:#e9f3f0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;opacity:1;visibility:visible;transition:opacity .45s ease,visibility .45s ease;cursor:default;touch-action:manipulation}
  #${ROOT_ID}.live-ready{cursor:pointer}
  #${ROOT_ID}.live-exit{opacity:0;visibility:hidden;pointer-events:none}
  #${ROOT_ID} .live-tablet{position:absolute;inset:clamp(12px,3vw,38px);overflow:hidden;border:1px solid #34474a;border-radius:clamp(10px,1.5vw,18px);background:radial-gradient(circle at 50% 48%,rgba(109,160,151,.055),transparent 42%),linear-gradient(180deg,#050a0b,#030607);box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),inset 0 0 55px rgba(103,156,147,.025);animation:liveBorder 3s ease-in-out infinite}
  #${ROOT_ID} .live-tablet:before{content:"";position:absolute;inset:10px;border:1px solid rgba(166,211,203,.13);border-radius:calc(clamp(10px,1.5vw,18px) - 5px);pointer-events:none}
  #${ROOT_ID} .live-terminal{position:absolute;left:30px;top:29px;color:#708681;font-size:9px;letter-spacing:.18em}
  #${ROOT_ID} .live-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:58px 18px;text-align:center}
  #${ROOT_ID} .live-full{height:1.2em;display:flex;align-items:center;justify-content:flex-start;white-space:pre;font-size:clamp(22px,4vw,48px);font-weight:500;letter-spacing:.025em;line-height:1.2;color:#f4faf8;text-shadow:0 0 14px rgba(221,247,240,.08)}
  #${ROOT_ID} .live-full .ch{display:inline-block;opacity:0;transition:opacity .28s ease,transform .62s cubic-bezier(.2,.75,.2,1)}
  #${ROOT_ID} .live-full .ch.typed{opacity:1}
  #${ROOT_ID} .live-full .ch.fade{opacity:0}
  #${ROOT_ID} .live-full .ch.initial{position:relative;z-index:2}
  #${ROOT_ID} .live-logo{position:absolute;font-size:clamp(58px,12vw,128px);font-weight:650;letter-spacing:.14em;line-height:1;color:#f4faf8;text-shadow:0 0 18px rgba(221,247,240,.11);opacity:0;transform:translateY(4px) scale(.985);transition:opacity .48s ease,transform .48s ease}
  #${ROOT_ID}.show-logo .live-logo{opacity:1;transform:translateY(0) scale(1)}
  #${ROOT_ID} .live-ko{margin-top:calc(clamp(58px,12vw,128px) + 14px);font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;font-size:clamp(11px,1.4vw,15px);letter-spacing:.28em;color:#9baea9;opacity:0;transition:opacity .55s ease}
  #${ROOT_ID}.show-logo .live-ko{opacity:1}
  #${ROOT_ID} .live-enter{position:absolute;left:0;right:0;bottom:31px;text-align:center;color:#71847f;font-size:9px;letter-spacing:.18em;opacity:0;transition:opacity .5s ease}
  #${ROOT_ID}.live-ready .live-enter{opacity:1}
  @keyframes liveBorder{0%,100%{border-color:#34474a}50%{border-color:#718b85;box-shadow:inset 0 0 42px rgba(181,225,216,.04),0 0 18px rgba(122,172,162,.05)}}
  @media(max-width:600px){#${ROOT_ID} .live-tablet{inset:8px}#${ROOT_ID} .live-terminal{left:22px;top:22px;font-size:7px}#${ROOT_ID} .live-full{font-size:clamp(14px,4.4vw,24px)}#${ROOT_ID} .live-logo{font-size:clamp(52px,18vw,82px)}#${ROOT_ID} .live-ko{margin-top:calc(clamp(52px,18vw,82px) + 14px)}}
  @media(prefers-reduced-motion:reduce){#${ROOT_ID} *{transition-duration:.001ms!important;animation-duration:.001ms!important}}`;
  document.head.appendChild(style);

  const root=document.createElement("section");
  root.id=ROOT_ID;
  root.tabIndex=0;
  root.setAttribute("role","button");
  root.setAttribute("aria-label","LIVE 시작 화면. 연출이 끝난 뒤 클릭하면 계속합니다.");

  const chars=[...FULL].map((c,i)=>{
    const cls=INITIAL_INDEX.has(i)?"ch initial":"ch";
    return `<span class="${cls}" data-i="${i}">${c===" "?"&nbsp;":c}</span>`;
  }).join("");

  root.innerHTML=`<div class="live-tablet">
    <div class="live-terminal">AGLAIA // VIRTUAL EXPERIMENT TERMINAL</div>
    <div class="live-stage">
      <div class="live-full" aria-hidden="true">${chars}</div>
      <div class="live-logo">LIVE</div>
      <div class="live-ko">루미아 섬 가상 실험</div>
    </div>
    <div class="live-enter">CLICK / TAP TO CONTINUE</div>
  </div>`;
  document.body.appendChild(root);

  const spans=[...root.querySelectorAll(".live-full .ch")];
  let ready=false, closing=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function play(){
    // 반드시 빈 화면에서 시작한 뒤 풀네임을 왼쪽부터 타이핑.
    await sleep(420);
    for(const s of spans){
      s.classList.add("typed");
      await sleep(s.textContent.trim()?46:24);
    }
    await sleep(620);

    // 이니셜 외 글자만 제자리에서 사라진다.
    for(const s of spans) if(!s.classList.contains("initial")) s.classList.add("fade");
    await sleep(520);

    // 최종 표기는 점 없는 LIVE. 자동 전환하지 않는다.
    root.classList.add("show-logo");
    root.querySelector(".live-full").style.opacity="0";
    await sleep(560);
    ready=true;
    root.classList.add("live-ready");
    root.focus({preventScroll:true});
  }

  function finish(ev){
    if(!ready||closing)return;
    closing=true;
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    root.classList.add("live-exit");
    setTimeout(()=>{root.remove();style.remove()},480);
  }

  root.addEventListener("pointerup",finish);
  root.addEventListener("keydown",ev=>{if((ev.key==="Enter"||ev.key===" ")&&ready)finish(ev)});
  play();
})();