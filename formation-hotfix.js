/* ER Auto Chess — formation 3x3 / combat 3x6 + invisible unit hotfix
   Base: main game.js blob 2e9b514289eda49c8c8f54512b5fc18c3da8550f
*/
"use strict";

(() => {
  const style = document.createElement("style");
  style.id = "formation-combat-hotfix-style";
  style.textContent = `
    /* Sprite visibility: undo the over-aggressive battlefield overflow sizing. */
    #board .unit{
      overflow:visible !important;
      z-index:10 !important;
    }
    #board .sd-slot{
      left:-8% !important;
      right:-8% !important;
      top:-38px !important;
      bottom:18px !important;
      overflow:visible !important;
      z-index:3 !important;
      display:flex !important;
      align-items:flex-end !important;
      justify-content:center !important;
      pointer-events:none !important;
    }
    #board .sd-image{
      display:block !important;
      width:100% !important;
      height:100% !important;
      max-width:none !important;
      max-height:none !important;
      object-fit:contain !important;
      object-position:center bottom !important;
      opacity:1 !important;
      visibility:visible !important;
    }

    /* Preparation is one player's 3x3 formation board. */
    #board.formation-board{
      grid-template-columns:repeat(3,minmax(0,1fr)) !important;
      grid-template-rows:repeat(3,150px) !important;
      width:100%;
    }
    #board.formation-board .cell[data-x="3"],
    #board.formation-board .cell[data-x="4"],
    #board.formation-board .cell[data-x="5"]{
      display:none !important;
    }
    #board.formation-board .cell[data-x="0"],
    #board.formation-board .cell[data-x="1"],
    #board.formation-board .cell[data-x="2"]{
      display:block !important;
    }

    /* Combat keeps the full joined 3x6 battlefield. */
    #board.combat-board{
      grid-template-columns:repeat(6,minmax(0,1fr)) !important;
      grid-template-rows:repeat(3,150px) !important;
    }
    #board.combat-board .cell{
      display:block !important;
    }

    body.game-mode.formation-phase .field-b{display:none !important}
    body.game-mode.formation-phase .field-a{
      left:50% !important;
      transform:translateX(-50%);
    }

    @media(max-width:850px){
      #board.formation-board{
        grid-template-rows:repeat(3,118px) !important;
      }
      #board.combat-board{
        grid-template-rows:repeat(3,92px) !important;
      }
      #board .sd-slot{
        top:-24px !important;
      }
    }
  `;
  document.head.appendChild(style);

  function isFormationPhase(){
    return appMode === "game" &&
      roundState &&
      roundState.active &&
      roundState.phase === "prep";
  }

  function applyBoardPhase(){
    if(!board) return;
    const prep = isFormationPhase();

    board.classList.toggle("formation-board", prep);
    board.classList.toggle("combat-board", !prep);
    document.body.classList.toggle("formation-phase", prep);

    const legend = document.querySelector(".arena-top .legend");
    if(legend){
      legend.style.display = prep ? "none" : "";
    }

    const hint = document.querySelector(".arena-card .hint");
    if(hint){
      hint.textContent = prep
        ? "내 진영 3×3 편성 · 드래그로 배치 / 교환 · 전투 시작 시 3×6으로 결합"
        : "양 팀 3×3 결합 전장 · 전투 중 3×6";
    }
  }

  /*
   * In preparation, the persistent formation state is teams.A.
   * Build a render snapshot from that state instead of depending on a stale
   * CombatEngine snapshot. This also guarantees the free starter and newly
   * deployed shop units are visible immediately.
   */
  function formationSnapshot(){
    try{
      return new CombatEngine(config()).getResult().units.filter(u => u.team === "A");
    }catch(err){
      console.error("[formation hotfix] snapshot failed", err);
      return [];
    }
  }

  const originalRender = render;
  render = function(){
    applyBoardPhase();

    if(isFormationPhase()){
      const saved = units;
      const formation = formationSnapshot();

      /* Do not destroy a valid snapshot if a separate QA error occurs. */
      if(formation.length || !teams.A.length){
        units = formation;
      }

      originalRender();

      /* Keep preparation's render snapshot available for pointer drag lookup. */
      if(formation.length || !teams.A.length){
        units = formation;
      }else{
        units = saved;
      }
      return;
    }

    originalRender();
  };

  const originalReset = reset;
  reset = function(){
    originalReset();
    applyBoardPhase();

    /*
     * reset() already renders once. Re-render once more after phase styling is
     * applied so newly granted / newly deployed units cannot remain hidden.
     */
    if(isFormationPhase()){
      const formation = formationSnapshot();
      if(formation.length || !teams.A.length){
        units = formation;
        originalRender();
      }
    }
  };

  /*
   * Combat changes prep -> combat immediately before start().
   * start() calls reset(), and the old reset would otherwise behave as if it
   * were still a preparation render. Re-apply the board phase around start.
   */
  const originalStart = start;
  start = function(){
    applyBoardPhase();
    const ok = originalStart();
    applyBoardPhase();
    return ok;
  };

  /* Phase transitions happen from timers too, so observe the board cheaply. */
  const phaseObserver = new MutationObserver(() => applyBoardPhase());
  phaseObserver.observe(document.body, {subtree:true, childList:true, attributes:false});

  applyBoardPhase();
  if(isFormationPhase()) reset();
})();
