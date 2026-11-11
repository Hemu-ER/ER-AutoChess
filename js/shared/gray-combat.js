// M10-04 / 1st stage infusions. Pure battle-local deterministic hooks.
(function(root){'use strict';
function create(ctx){
 const config=ctx.config||{};
 const ids={A:new Set(config.infusions?.A||config.augmentsA||[]),B:new Set(config.infusions?.B||config.augmentsB||[])};
 const has=(t,id)=>ids[t]?.has(id)||false,now=()=>ctx.time(),all=()=>ctx.units();
 const allies=t=>all().filter(u=>u.team===t&&!u.dead&&u.role!=='소환수');
 const enemies=t=>all().filter(u=>u.team!==t&&!u.dead);
 const st=u=>u.gray||(u.gray={});
 const team={A:{firstHit:false,firstAllyDeath:false,firstDeathMarker:false,firstHitEnemy:false,rows:false,flanks:false,crit:false,killCount:0,firstKill:false,lastStand:false,emergency:false},B:{firstHit:false,firstAllyDeath:false,firstDeathMarker:false,firstHitEnemy:false,rows:false,flanks:false,crit:false,killCount:0,firstKill:false,lastStand:false,emergency:false}};
 const log=(t,id,msg)=>ctx.log?.(`<b>[회색 ${id}]</b> ${t}팀 · ${msg}`);
 const shield=(u,ratio,dur)=>{const n=u.maxHp*ratio;u.skill.shield=(u.skill.shield||0)+n;if(dur){const s=st(u);(s.expiringShields??=[]).push({until:now()+dur,amount:n});}return n};
 const heal=(u,a,source=u)=>ctx.heal(u,a,source);
 const logicalX=u=>u.team==='A'?u.initialX:5-u.initialX;
 const isCore=(kind,opt)=>!opt.skipHooks&&(kind==='basic'||kind==='skill');
 function start(){
   for(const t of ['A','B']){
     const units=allies(t),g=team[t];g.rows=[0,1,2].every(y=>units.some(u=>u.initialY===y));g.flanks=units.some(u=>logicalX(u)===0)&&units.some(u=>logicalX(u)===2);
     g.crit=units.reduce((n,u)=>n+(u.critChance||0),0)>=.9;
     if(has(t,'G031')&&g.crit)for(const u of units)u.critDamage+=.10;
     if(has(t,'G052'))for(const u of units)if(new Set((u.equipment||[]).filter(n=>ctx.isComplete(n))).size>=3)shield(u,.06,5);
     if(has(t,'G068'))for(const y of [0,1,2]){const row=units.filter(u=>u.initialY===y);if(row.length===3&&[0,1,2].every(x=>row.some(u=>logicalX(u)===x)))for(const u of row.filter(u=>logicalX(u)!==1))shield(u,.08,4)}
   }
 }
 function asMultiplier(u){const s=st(u),t=now();let factor=1;
   if(s.firstHitAsUntil>t)factor*=1.15;
   if(s.lowHpAsUntil>t)factor*=1.15;
   if(s.critAsUntil>t)factor*=1.08;
   if(has(u.team,'G047')&&team[u.team].flanks&&t<4)factor*=1.12;
   return factor;
 }
 function modifyDamage(src,dst,r,kind,opt={}){
   if(!src||!dst||!isCore(kind,opt))return r;
   const t=src.team,s=st(src),d=st(dst),ts=now();
   if(has(t,'G030')&&team[t].rows&&ts<5)r*=1.08;
   if(has(t,'G045')&&!s.firstDamage)r*=1.10
   if(has(t,'G066')&&s.lastStandUntil>ts)r*=1.10;
   if(has(t,'G011')&&kind==='basic'){s.combo=dst.id===s.comboTarget?(s.combo||0)+1:1;s.comboTarget=dst.id;if(s.combo>=3){r*=1.15;s.combo=0}}
   if(has(t,'G026')&&dst.ccUntil>ts&&!d.ccBonusTeams?.[t]){(d.ccBonusTeams??={})[t]=true;r*=1.15}
   if(has(t,'G032')&&d.next40Team===t){r*=1.12;d.next40Team=null}
   if(has(t,'G060')&&kind==='basic'&&s.nextKillBasic){r*=1.15;s.nextKillBasic=false}
   if(has(t,'G064')&&kind==='basic'&&s.nextHealBasic){r*=1.10;s.nextHealBasic=false}
   if(has(t,'G061')&&dst.hp<=dst.maxHp*.25&&!s.lowHpTarget?.[dst.id]){(s.lowHpTarget??={})[dst.id]=true;s.lowHpAsUntil=ts+3}
   if(has(t,'G071')&&kind==='skill'&&!s.firstSkillDamage&&new Set((src.equipment||[]).filter(n=>ctx.isComplete(n))).size>=2)r*=1.08
   if(has(t,'G023')&&d.markFirstHit?.[t])r*=1.05;
   if(has(t,'G024')&&d.markFirstKill?.[t])r*=1.08;
   if(kind==='basic'&&s.weakBasicUntil>ts){r*=.80;s.weakBasicUntil=0}
   return r;
 }
 function beforeTake(src,dst,d,kind,opt={}){
   if(!src||!dst||!isCore(kind,opt))return d;
   const s=st(dst),t=now();s.shieldBefore=dst.skill.shield||0;s.preHitHp=dst.hp;
   if(has(dst.team,'G040')&&s.focusDefenseUntil>t)d*=.92;
   if(has(dst.team,'G043')&&s.firstShield&&dst.skill.shield>0)d*=.95;
   if(has(dst.team,'G067')&&logicalX(dst)===1&&dst.initialY===1&&t<5)d*=.92;
   return d;
 }
 function afterDamage(src,dst,eff,kind,opt={}){
   if(!src||!dst||eff<=0||!isCore(kind,opt))return;
   const ts=now(),t=src.team,s=st(src),d=st(dst);s.lastKind=kind;if(has(t,'G045'))s.firstDamage=true;if(has(t,'G071')&&kind==='skill'&&new Set((src.equipment||[]).filter(n=>ctx.isComplete(n))).size>=2)s.firstSkillDamage=true;
   if(!team[t].firstHit&&has(t,'G009')){team[t].firstHit=true;s.firstHitAsUntil=ts+4;log(t,'G009',`${src.name} 선봉대 발동`)}
   if(has(dst.team,'G023')&&!team[dst.team].firstHitEnemy){team[dst.team].firstHitEnemy=true;(s.markFirstHit??={})[dst.team]=true}
   if(has(dst.team,'G028')&&dst.hp<=dst.maxHp*.30&&!d.emergency){d.emergency=true;heal(dst,dst.maxHp*.10,dst)}
   if(has(t,'G032')&&d.preHitHp>dst.maxHp*.4&&dst.hp>0&&dst.hp<=dst.maxHp*.4&&!d.crossed40?.[t]){(d.crossed40??={})[t]=true;d.next40Team=t}
   if(has(dst.team,'G040')){const key=src.id,prev=d.focusSrc===key?d.focusCount||0:0;d.focusSrc=key;d.focusCount=prev+1;if(d.focusCount>=3&&!d.focusUsed){d.focusUsed=true;d.focusDefenseUntil=ts+3}}
   if(has(t,'G050')&&kind==='basic'){d.armorHits=(d.armorHits||0)+1;if(d.armorHits>=5&&!d.armorUntil){dst.def=Math.max(0,dst.def-5);d.armorUntil=ts+3;d.armorDebuff=5;d.armorHits=0}}
   if(has(t,'G062')&&kind==='skill')d.healWeakenUntil=ts+5;
   if(has(t,'G065')&&kind==='basic'&&src.role.startsWith('원거리')){s.rangedHits=s.rangedTarget===dst.id?(s.rangedHits||0)+1:1;s.rangedTarget=dst.id;if(s.rangedHits>=3){s.rangedHits=0;d.weakBasicUntil=ts+10}}
   if(has(t,'G072')&&opt.critical&&!s.critBuffUsed){s.critBuffUsed=true;s.critAsUntil=ts+3}
   if(has(dst.team,'G063')&&d.shieldBefore>0&&dst.skill.shield<=0&&!d.shieldBrokenOnce){d.shieldBrokenOnce=true;heal(dst,dst.maxHp*.05,dst)}
   if(has(t,'G023')&&s.markFirstHit?.[dst.team]){} // target-side mark is owned by attacker, no global side effects.
 }
 function onDeath(src,dst){
   if(!src||!dst)return;const t=src.team,other=dst.team,ts=now(),s=st(src);
   if(dst.role!=='소환수'&&dst.role!=='야생동물')team[t].killCount++;
   if(has(t,'G060')&&s.lastKind==='basic')s.nextKillBasic=true;
   if(has(t,'G025'))src.nextAttack=Math.min(src.nextAttack||ts+1,ts+Math.max(.05,(src.nextAttack-ts)*.5));
   if(has(other,'G024')&&!team[other].firstDeathMarker){team[other].firstDeathMarker=true;(s.markFirstKill??={})[other]=true}
   if(has(other,'G027')&&!team[other].firstAllyDeath){team[other].firstAllyDeath=true;for(const u of allies(other))heal(u,u.maxHp*.05,u)}
   const survivors=allies(other);
   if(survivors.length===1){const u=survivors[0],d=st(u);
     if(has(other,'G010')&&!team[other].lastStand){team[other].lastStand=true;shield(u,.12,0)}
     if(has(other,'G066')&&!d.lastStandUntil)d.lastStandUntil=ts+3;
   }
 }
 function modifyHeal(u,a,source){const s=st(u);if(s.healWeakenUntil>now()){s.healWeakenUntil=0;a*=.85}
   if(source&&source!==u&&source.team===u.team&&has(u.team,'G042')&&u.hp<=u.maxHp*.30)a*=1.15;
   return a;
 }
 function afterHeal(u,amount){if(amount>0&&has(u.team,'G064'))st(u).nextHealBasic=true}
 function onSkill(u){const s=st(u);if(has(u.team,'G070')&&!s.gearSkillHeal&&u.equipment?.some(n=>ctx.isComplete(n))){s.gearSkillHeal=true;heal(u,u.maxHp*.04,u)}}
 function tick(){const ts=now();for(const u of all()){
   const s=st(u);
   if(s.armorUntil&&ts>=s.armorUntil){u.def+=s.armorDebuff||0;s.armorUntil=0;s.armorDebuff=0}
   if(s.expiringShields?.length){s.expiringShields=s.expiringShields.filter(v=>{if(ts<v.until)return true;u.skill.shield=Math.max(0,(u.skill.shield||0)-v.amount);return false})}
   const active=!!(u.ccUntil>ts);if(s.wasCc&&!active&&!u.dead){if(has(u.team,'G006')&&!s.ccRecovered){s.ccRecovered=true;heal(u,(u.maxHp-u.hp)*.12,u)}if(has(u.team,'G029')&&!s.ccShielded){s.ccShielded=true;shield(u,.05,3)}}s.wasCc=active;
   if(has(u.team,'G043')&&u.skill.shield>0&&!team[u.team].firstShield){team[u.team].firstShield=true;s.firstShield=true}
 }
 for(const t of ['A','B'])if(has(t,'G039')&&!team[t].emergency&&ts>=5){team[t].emergency=true;const weak=allies(t).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(weak)heal(weak,weak.maxHp*.08,weak)}
 }
 const snapshot=()=>({A:{kills:team.A.killCount},B:{kills:team.B.killCount}});
 return {start,asMultiplier,modifyDamage,beforeTake,afterDamage,onDeath,modifyHeal,afterHeal,onSkill,tick,snapshot,ids};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LIVEGrayCombat=api;
})(globalThis);
