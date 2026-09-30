"use strict";
(() => {
  const STYLE_ID = "live-intro-style";
  const ROOT_ID = "live-intro";
  if (document.getElementById(ROOT_ID)) return;

  const css = `
  #${ROOT_ID}{
    position:fixed; inset:0; z-index:100000;
    display:grid; place-items:center;
    background:#030607;
    color:#e9f3f0;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    opacity:1; visibility:visible;
    transition:opacity .55s ease,visibility .55s ease;
  }
  #${ROOT_ID}.live-exit{opacity:0;visibility:hidden;pointer-events:none}
  #${ROOT_ID} .live-tablet{
    position:absolute; inset:clamp(12px,3vw,38px);
    overflow:hidden;
    border:1px solid #34474a;
    border-radius:clamp(10px,1.5vw,18px);
    background:
      radial-gradient(circle at 50% 48%,rgba(109,160,151,.055),transparent 42%),
      linear-gradient(180deg,#050a0b,#030607);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),inset 0 0 55px rgba(103,156,147,.025);
  }
  #${ROOT_ID} .live-tablet::before{
    content:"";position:absolute;inset:10px;border:1px solid rgba(166,211,203,.13);
    border-radius:calc(clamp(10px,1.5vw,18px) - 5px);pointer-events:none
  }
  #${ROOT_ID} .live-tablet::after{
    content:"";position:absolute;left:14px;right:14px;top:-22%;height:18%;
    background:linear-gradient(transparent,rgba(194,231,224,.07),transparent);
    opacity:0;pointer-events:none;animation:liveScan 4.2s 1s ease-in-out 2
  }
  #${ROOT_ID} .live-corner{position:absolute;width:30px;height:30px;opacity:.48}
  #${ROOT_ID} .live-tl{left:22px;top:22px;border-left:2px solid #91aaa5;border-top:2px solid #91aaa5}
  #${ROOT_ID} .live-tr{right:22px;top:22px;border-right:2px solid #91aaa5;border-top:2px solid #91aaa5}
  #${ROOT_ID} .live-bl{left:22px;bottom:22px;border-left:2px solid #91aaa5;border-bottom:2px solid #91aaa5}
  #${ROOT_ID} .live-br{right:22px;bottom:22px;border-right:2px solid #91aaa5;border-bottom:2px solid #91aaa5}
  #${ROOT_ID} .live-terminal{
    position:absolute;left:30px;top:29px;color:#708681;font-size:9px;letter-spacing:.18em
  }
  #${ROOT_ID} .live-stage{
    position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:58px clamp(14px,4vw,48px)
  }
  #${ROOT_ID} .live-line{
    width:100%;min-height:100px;display:flex;align-items:center;justify-content:center;white-space:nowrap
  }
  #${ROOT_ID} .live-typed{
    display:inline-flex;align-items:baseline;
    font-size:clamp(14px,3.3vw,34px);letter-spacing:.025em;
    transition:font-size .95s cubic-bezier(.2,.8,.2,1),letter-spacing .95s cubic-bezier(.2,.8,.2,1)
  }
  #${ROOT_ID} .live-char{
    display:inline-block;opacity:1;max-width:2em;
    transition:opacity .7s ease,filter .7s ease,max-width .9s cubic-bezier(.2,.8,.2,1),width .9s cubic-bezier(.2,.8,.2,1),margin .9s ease
  }
  #${ROOT_ID} .live-char.live-space{width:.55em}
  #${ROOT_ID} .live-char.live-initial{font-weight:700;color:#f4faf8;text-shadow:0 0 14px rgba(221,247,240,.12)}
  #${ROOT_ID}.live-fade-rest .live-char:not(.live-initial){opacity:0;filter:blur(3px)}
  #${ROOT_ID}.live-gather .live-char:not(.live-initial){max-width:0;width:0;margin:0;overflow:hidden}
  #${ROOT_ID}.live-gather .live-typed{font-size:clamp(48px,10vw,104px);letter-spacing:.13em}
  #${ROOT_ID} .live-dot{display:inline-block;opacity:0;max-width:0;overflow:hidden}
  #${ROOT_ID}.live-dotted .live-dot{opacity:1;max-width:1em;transition:opacity .3s ease,max-width .3s ease}
  #${ROOT_ID} .live-cursor{
    display:inline-block;width:2px;height:1.08em;margin-left:5px;background:#d9e8e4;
    animation:liveBlink .62s steps(1) infinite
  }
  #${ROOT_ID}.live-fade-rest .live-cursor{opacity:0}
  #${ROOT_ID} .live-ko{
    margin-top:7px;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif;
    font-size:clamp(11px,1.4vw,15px);letter-spacing:.32em;color:#9baea9;
    opacity:0;transform:translateY(7px)
  }
  #${ROOT_ID}.live-dotted .live-ko{animation:liveUp .75s .3s forwards}
  #${ROOT_ID} .live-ready{
    position:absolute;left:0;right:0;bottom:31px;text-align:center;
    color:#71847f;font-size:9px;letter-spacing:.22em;opacity:0
  }
  #${ROOT_ID}.live-dotted .live-ready{animation:liveUp .7s .72s forwards}
  #${ROOT_ID}.live-dotted .live-tablet{animation:liveBorder 2.6s ease-in-out infinite}
  #${ROOT_ID} .live-skip{
    position:absolute;right:30px;bottom:27px;z-index:3;
    border:1px solid rgba(142,171,165,.28);background:rgba(5,10,11,.6);color:#81958f;
    border-radius:3px;padding:7px 10px;font:9px/1 ui-monospace,monospace;letter-spacing:.12em;
    cursor:pointer;opacity:.62
  }
  #${ROOT_ID} .live-skip:hover,#${ROOT_ID} .live-skip:focus-visible{opacity:1;border-color:#829d97;outline:none}
  @keyframes liveBlink{50%{opacity:0}}
  @keyframes liveScan{0%{top:-22%;opacity:0}12%{opacity:1}88%{opacity:.75}100%{top:108%;opacity:0}}
  @keyframes liveUp{to{opacity:1;transform:translateY(0)}}
  @keyframes liveBorder{0%,100%{border-color:#34474a}50%{border-color:#718b85;box-shadow:inset 0 0 42px rgba(181,225,216,.04),0 0 18px rgba(122,172,162,.05)}}
  @media(max-width:600px){
    #${ROOT_ID} .live-tablet{inset:8px}
    #${ROOT_ID} .live-terminal{left:22px;top:22px;font-size:7px}
    #${ROOT_ID} .live-corner{width:22px;height:22px}
    #${ROOT_ID} .live-tl{left:16px;top:16px} #${ROOT_ID} .live-tr{right:16px;top:16px}
    #${ROOT_ID} .live-bl{left:16px;bottom:16px} #${ROOT_ID} .live-br{right:16px;bottom:16px}
    #${ROOT_ID} .live-typed{font-size:clamp(10px,3.15vw,18px)}
    #${ROOT_ID}.live-gather .live-typed{font-size:clamp(42px,14vw,68px)}
    #${ROOT_ID} .live-skip{right:20px;bottom:19px}
  }
  @media(prefers-reduced-motion:reduce){
    #${ROOT_ID} *{animation-duration:.001ms!important;animation-delay:0ms!important;transition-duration:.001ms!important}
  }`;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.setAttribute("aria-label","L.I.V.E. 시작 인트로");
  root.innerHTML = `
    <div class="live-tablet">
      <span class="live-corner live-tl"></span><span class="live-corner live-tr"></span>
      <span class="live-corner live-bl"></span><span class="live-corner live-br"></span>
      <div class="live-terminal">AGLAIA // VIRTUAL EXPERIMENT TERMINAL</div>
      <div class="live-stage">
        <div class="live-line"><div class="live-typed" aria-live="polite"></div><span class="live-cursor" aria-hidden="true"></span></div>
        <div class="live-ko">루미아 섬 가상 실험</div>
      </div>
      <div class="live-ready">SYSTEM READY · L.I.V.E.</div>
      <button class="live-skip" type="button">SKIP</button>
    </div>`;
  document.body.appendChild(root);

  const typed = root.querySelector(".live-typed");
  const cursor = root.querySelector(".live-cursor");
  const text = "Lumia Island Virtual Experiment";
  const initials = new Set([0,6,13,21]);
  const timers = [];
  const later = (fn,ms) => timers.push(setTimeout(fn,ms));

  function addChar(ch,i){
    const s=document.createElement("span");
    s.className="live-char"+(ch===" "?" live-space":"")+(initials.has(i)?" live-initial":"");
    s.textContent=ch;
    typed.appendChild(s);
  }
  function addDots(){
    [...typed.querySelectorAll(".live-initial")].forEach(c=>{
      const d=document.createElement("span");
      d.className="live-dot";
      d.textContent=".";
      c.after(d);
    });
  }
  function finish(){
    timers.forEach(clearTimeout);
    root.classList.add("live-exit");
    setTimeout(()=>root.remove(),600);
  }

  root.querySelector(".live-skip").addEventListener("click",finish);

  if (matchMedia("(prefers-reduced-motion: reduce)").matches){
    [...text].forEach(addChar);
    root.classList.add("live-fade-rest","live-gather");
    addDots();
    root.classList.add("live-dotted");
    cursor.style.display="none";
    later(finish,1700);
    return;
  }

  let t=500;
  [...text].forEach((ch,i)=>{
    later(()=>addChar(ch,i),t);
    t += ch===" " ? 72 : 48;
  });

  // Full phrase is visible first. Only then does the abbreviation emerge.
  later(()=>root.classList.add("live-fade-rest"),t+720);
  later(()=>root.classList.add("live-gather"),t+1480);
  later(()=>{
    addDots();
    root.classList.add("live-dotted");
    cursor.style.display="none";
  },t+2420);
  later(finish,t+4550);
})();