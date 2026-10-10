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
  #${ROOT_ID} .live-full .ch{display:inline-block;opacity:0;transition:opacity .28s ease;will-change:transform,opacity}
  #${ROOT_ID} .live-full .ch.typed{opacity:1}
  #${ROOT_ID} .live-full .ch.fade{opacity:0}
  #${ROOT_ID} .live-full .ch.initial{position:relative;z-index:4;transform-origin:center center}
  #${ROOT_ID} .live-final-target{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;gap:.14em;font-size:clamp(58px,12vw,128px);font-weight:650;letter-spacing:0;line-height:1;visibility:hidden;pointer-events:none}
  #${ROOT_ID} .live-final-target span{display:inline-block}
  #${ROOT_ID} .live-ko{position:absolute;left:50%;top:calc(50% + clamp(50px,7vw,78px));transform:translateX(-50%);font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;font-size:clamp(11px,1.4vw,15px);letter-spacing:.28em;color:#9baea9;opacity:0;transition:opacity .55s ease;white-space:nowrap}
  #${ROOT_ID}.show-subtitle .live-ko{opacity:1}
  #${ROOT_ID} .live-enter{position:absolute;left:0;right:0;bottom:31px;text-align:center;color:#71847f;font-size:9px;letter-spacing:.18em;opacity:0;transition:opacity .5s ease}
  #${ROOT_ID}.live-ready .live-enter{opacity:1}
  @keyframes liveBorder{0%,100%{border-color:#34474a}50%{border-color:#718b85;box-shadow:inset 0 0 42px rgba(181,225,216,.04),0 0 18px rgba(122,172,162,.05)}}
  @media(max-width:600px){#${ROOT_ID} .live-tablet{inset:8px}#${ROOT_ID} .live-terminal{left:22px;top:22px;font-size:7px}#${ROOT_ID} .live-full{font-size:clamp(14px,4.4vw,24px)}#${ROOT_ID} .live-final-target{font-size:clamp(52px,18vw,82px)}#${ROOT_ID} .live-ko{top:calc(50% + clamp(44px,11vw,62px))}}
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
      <div class="live-final-target" aria-hidden="true"><span>L</span><span>I</span><span>V</span><span>E</span></div>
      <div class="live-ko">루미아 섬 가상 실험</div>
    </div>
    <div class="live-enter">CLICK / TAP TO CONTINUE</div>
  </div>`;
  document.body.appendChild(root);

  const full=root.querySelector(".live-full");
  const spans=[...root.querySelectorAll(".live-full .ch")];
  const initials=spans.filter(s=>s.classList.contains("initial"));
  const targets=[...root.querySelectorAll(".live-final-target span")];
  let ready=false, closing=false, skipped=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function moveInitialsToLogo(){
    // 실제 타이핑된 L/I/V/E를 그대로 최종 LIVE 자리로 이동시킨다.
    // 새 로고를 보여주는 게 아니라 숨겨진 target은 좌표 측정용으로만 사용한다.
    const srcRects=initials.map(s=>s.getBoundingClientRect());
    const dstRects=targets.map(s=>s.getBoundingClientRect());

    initials.forEach((s,i)=>{
      const a=srcRects[i], b=dstRects[i];
      const sx=b.width/Math.max(a.width,.001);
      const sy=b.height/Math.max(a.height,.001);
      const dx=(b.left+b.width/2)-(a.left+a.width/2);
      const dy=(b.top+b.height/2)-(a.top+a.height/2);
      s.style.transition="opacity .28s ease, transform 1.05s cubic-bezier(.16,.84,.22,1)";
      s.style.transform=`translate(${dx}px,${dy}px) scale(${sx},${sy})`;
    });
  }

  async function play(){
    await sleep(420);if(skipped)return;
    for(const s of spans){
      s.classList.add("typed");
      await sleep(s.textContent.trim()?46:24);if(skipped)return;
    }
    await sleep(620);if(skipped)return;

    // L/I/V/E만 남기고 나머지는 제자리에서 사라진다.
    for(const s of spans) if(!s.classList.contains("initial")) s.classList.add("fade");
    await sleep(480);if(skipped)return;

    // 남아 있던 네 글자 자체가 중앙으로 모이며 확대된다.
    moveInitialsToLogo();
    await sleep(1080);if(skipped)return;
    root.classList.add("show-subtitle");
    await sleep(420);if(skipped)return;

    ready=true;
    root.classList.add("live-ready");
    root.focus({preventScroll:true});
  }

  function finish(ev){
    if(closing)return;skipped=true;
    closing=true;
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    root.classList.add("live-exit");
    setTimeout(()=>{root.remove();style.remove()},480);
  }

  root.addEventListener("pointerup",finish);
  root.addEventListener("keydown",ev=>{if((ev.key==="Enter"||ev.key===" "))finish(ev)});
  play();
})();
