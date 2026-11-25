// M9-07: deterministic purple-combat modifiers. No DOM or network access.
// Some complex cards require economic/server-side integration; this runtime owns battle effects.
(function(root){'use strict';
function create(ctx){
 const {config,rng,log,emit,damage,heal,applyCC,dist,makeUnit,resetCombatState,itemDB}=ctx;
 const ids={A:new Set(config.augmentsA||[]),B:new Set(config.augmentsB||[])};
 const has=(t,id)=>ids[t]?.has(id)||false,now=()=>ctx.time(),units=()=>ctx.units();
 const allies=(t,alive=true)=>units().filter(u=>u.team===t&&u.role!=='소환수'&&(!alive||!u.dead)&&!u.purpleMerged);
 const foes=(t,alive=true)=>allies(t==='A'?'B':'A',alive);
 const all=(t,alive=true)=>units().filter(u=>u.team===t&&(!alive||!u.dead)&&!u.purpleMerged);
 const st={A:{},B:{}};
 const once=(t,k)=>{if(st[t][k])return false;st[t][k]=true;return true};
 const icon=(t,id,detail='',u=null)=>{const meta=(typeof module!=='undefined'&&module.exports?require('./purple-cards.js'):root.LIVEPurpleCards)?.byId?.[id];emit({type:'augment',time:now(),team:t,id,name:meta?.name||id,detail,x:u?.x,y:u?.y});log(`<b>[보라 · ${meta?.name||id}]</b> ${detail}`)};
 const mark=(u,k)=>{u.purple??={};return u.purple[k]??={};};
 const protect=(u,amount)=>{if(u.dead||amount<=0)return 0;u.skill.shield=(u.skill.shield||0)+amount;return amount};
 const recover=(u,amount)=>{if(u.dead||amount<=0)return 0;return heal(u,amount,u)};
 const extra=(src,dst,raw,fixed=false,id='purple')=>{
  if(!src||!dst||dst.dead||raw<=0)return 0;
  return damage(src,dst,raw,'synergy',fixed,{sourceName:id,purpleBonus:true,skipHooks:true,skipItemHit:true,guardable:false,arenaFollowup:true});
 };
 const hitTeam=(t,scale,fixed,id)=>{for(const e of foes(t))extra(allies(t)[0]||units().find(u=>u.team===t),e,typeof scale==='function'?scale(e):scale,fixed,id)};
 const normal=(t)=>allies(t,false).filter(u=>!u.dead);
 const depth=u=>u.team==='A'?u.initialX:5-u.initialX;
 const tile=u=>[u.team==='A'?u.x:5-u.x,u.y].join(',');
 const isRear=u=>depth(u)===0;
 const cd={A:Object.create(null),B:Object.create(null)};
 const ready=(t,key,period,initialDelay=period)=>{const first=initialDelay===true?0:initialDelay;const c=cd[t][key]??first;if(now()+1e-7<c)return false;cd[t][key]=now()+period;return true};
 const chosen=(t,k,defaultValue)=>config.purpleChoices?.[t]?.[k]??defaultValue;
 const matchOwned=(u,id)=>{const v=String(id??'');return !!v&&(u.id===v||u.id===v.replace(/^[AB]:/,u.team+':')||u.id.endsWith(':'+v));}; // Each player's local UI stores A:UID, even when the server simulates them on team B.
 function beforeSynergies(){
  for(const t of ['A','B']){
   if(has(t,'P08')){const aff=chosen(t,'affiliation',allies(t,false)[0]?.aff?.[0]||'수영복');for(const u of allies(t,false))if(!u.aff.includes(aff))u.aff.push(aff);st[t].extraAff=aff;}
   if(has(t,'P33')){
    const group=allies(t,false);const by=new Map();for(const u of group){const key=u.characterId;by.set(key,(by.get(key)||[]).concat(u))}
    const triple=[...by.values()].find(v=>v.length>=3)||group.filter(u=>u.star>=2).slice(0,1);
    if(triple?.length){const lead=triple[0];lead.purpleSynergyCopies=3;st[t].p33=triple;}
   }
  }
  // Block one enemy affiliation *before* the authoritative synergy lock.
  for(const t of ['A','B'])if(has(t,'P34')){
   const enemy=foes(t,false),counts=new Map();for(const e of [...new Map(enemy.map(u=>[u.characterId,u])).values()])for(const aff of e.aff||[])counts.set(aff,(counts.get(aff)||0)+(e.purpleSynergyCopies||1));
   const ranked=[...counts].map(([name,count])=>({name,count,tier:(ctx.affiliationTier?.(name,count)??(count>=2?count:0))})).filter(x=>x.tier>0).sort((a,b)=>b.tier-a.tier||b.count-a.count||a.name.localeCompare(b.name));
   const top=ranked[0];const tied=top?ranked.filter(x=>x.tier===top.tier&&x.count===top.count):[];const choice=tied.length?tied[Math.floor(rng()*tied.length)].name:null;
   if(choice){st[t].bannedAff=choice;for(const e of enemy)if(e.aff.includes(choice)){mark(e,'banned').until=60;e.aff=e.aff.filter(k=>k!==choice)}}
  }
 }
 function stat(u,key,ratio){if(key==='hp'){u.maxHp*=ratio;u.hp*=ratio}else u[key]*=ratio}
 function applyItemStats(u,name,m=.75){const data=itemDB.all?.[name];if(!data)return;const v=data.stats||{};for(const k of ['hp','atk','amp','def']){if(v[k]){if(k==='hp'){u.maxHp+=v[k]*m;u.hp+=v[k]*m}else u[k]+=v[k]*m}}
  if(v.as)u.as=m<0?u.as/(1-v.as*m):u.as*(1+v.as*m);if(v.crit)u.critChance=(u.critChance||0)+v.crit*m;
 }
 function start(){
  for(const t of ['A','B']){
   const a=allies(t),enemy=foes(t);
   if(!a.length)continue;
   for(const u of a){mark(u,'start').hp=u.hp;}
   if(has(t,'P01')&&a.length>=4){const u=a[3];for(const k of ['hp','atk','amp'])stat(u,k,.8);icon(t,'P01','추가 출전 실험체 약화 보정',u)}
   if(has(t,'P02')){const u=a.find(x=>matchOwned(x,chosen(t,'transcendId',null)))||a[0];if(u){mark(u,'star').start=u.star;ctx.promoteCombatStar(u);mark(u,'transcend').active=true;icon(t,'P02',u.name+' 초월',u)}}
   if(has(t,'P39')){const keys=['maxHp','atk','amp','def','as','range'];const highest=Object.fromEntries(keys.map(k=>[k,Math.max(...a.map(u=>u[k]||0))]));for(const u of a){for(const k of keys){const original=u[k];let wanted=highest[k];if(k==='range')wanted=Math.min(original+2,wanted);else wanted=Math.min(original*1.75,wanted);if(k==='maxHp'){u.hp+=Math.max(0,wanted-original)}u[k]=Math.max(original,wanted)}}icon(t,'P39','최고 능력치 공유')}
   if(has(t,'P35')){const round=config.round||1,r=round>=16?2:round>=6?1.8:1.6;for(const u of a)if(!(u.equipment||[]).some(i=>itemDB.all?.[i]&&!itemDB.all[i].basic)){for(const k of ['hp','atk','amp'])stat(u,k,r)}icon(t,'P35',`맨손 강화 ×${r}`)}
   if(has(t,'P03')){const items=a.flatMap(u=>(u.equipment||[]).filter(i=>itemDB.all?.[i]&&!itemDB.all[i].basic&&!i.startsWith('초월:')).map(i=>({u,item:i})));const pick=items.find(x=>x.item===chosen(t,'item',null))||items[0];if(pick&&!pick.item.startsWith('초월:')){for(const u of a.filter(u=>u!==pick.u)){applyItemStats(u,pick.item,.75);u.itemEffects??={};u.itemEffects[pick.item]??={count:0,until:0,next:1,readyAt:0,delayed:[],targets:{},bonusApplied:false};}st[t].copiedItem=pick.item;icon(t,'P03',`${pick.item} 능력치 75% · 고유효과 복제`)}}
   if(has(t,'P04')){for(const u of a){const roleFactor=k=>u.role===k?.30:.80;
  // One pass through the five positional role bonuses; independent of board position.
  const warrior=roleFactor('전사'),tank=roleFactor('탱커'),ranged=roleFactor('원거리 평타'),caster=roleFactor('원거리 스킬'),melee=roleFactor('근거리 스킬');
  stat(u,u.main==='atk'?'atk':'amp',1+.15*warrior);stat(u,'hp',1+.1*warrior+.20*tank+.05*roleFactor('서포터'));u.def+=10*warrior+20*tank;
  stat(u,'atk',1+.20*ranged);stat(u,'amp',1+.25*caster+.20*melee+.05*roleFactor('서포터'));
  u.as*=1+.10*warrior+.10*tank+.20*ranged+.10*caster+.15*melee+.05*roleFactor('서포터');mark(u,'allRoles').assassin=roleFactor('암살자');
 }icon(t,'P04','7역할 시너지 · 위치 무시 적용')}
   if(has(t,'P11')&&!has(t,'P24')&&a.length>=2){const trio=a.slice(0,3),max=trio.reduce((s,u)=>s+u.maxHp,0)*1.5;st[t].heart={ids:trio.map(u=>u.id),shares:Object.fromEntries(trio.map(u=>[u.id,u.maxHp*1.5])),max,hp:max};for(const u of trio)mark(u,'heart').active=true;icon(t,'P11','공유 HP '+Math.round(max))}
   if(has(t,'P24')&&a.length>=3){const lead=a[0],rest=a.slice(1,3);const old=lead.maxHp;lead.maxHp=a.slice(0,3).reduce((s,u)=>s+u.maxHp,0)*1.25;lead.hp=lead.maxHp;lead.atk=a.slice(0,3).reduce((s,u)=>s+u.atk,0)*.85;lead.amp=a.slice(0,3).reduce((s,u)=>s+u.amp,0)*.85;lead.purpleFusion={parts:a.slice(0,3).map(u=>u.characterId),cool:3};for(const u of rest){u.purpleMerged=true;u.dead=true;u.hp=0}icon(t,'P24',lead.name+' 키메라 융합',lead)}
   if(has(t,'P33')&&!has(t,'P24')&&st[t].p33){const three=st[t].p33,lead=three[0];lead.maxHp=Math.max(lead.maxHp,three.length===1?(ctx.byId?.[lead.characterId]?.baseStats?.hp||lead.maxHp)*3:three.reduce((s,u)=>s+u.maxHp,0));lead.hp=lead.maxHp;lead.atk=Math.max(...three.map(u=>u.atk))*1.6;lead.amp=Math.max(...three.map(u=>u.amp))*1.6;for(const u of three.slice(1)){u.dead=true;u.purpleMerged=true;u.hp=0}lead.purpleSynergyCopies=3;icon(t,'P33','특수 합성: 시너지 3인 취급',lead)}
   if(has(t,'P20')){for(const u of a)u.range=5;icon(t,'P20','전원 사거리 5 · 후열 우선')}
   if(has(t,'P23'))icon(t,'P23','행동불능 저항 활성');
   for(const u of a)if(u.equipment?.includes('초월:수호')){protect(u,u.maxHp*.18);mark(u,'forgeGuard').next=5;icon(t,'P19','초월 수호 보호막',u)}
   if(has(t,'P25')){const cells=chosen(t,'tiles',a.slice(0,2).map(u=>[depth(u),u.initialY]));st[t].tileSet=new Set(cells.map(v=>v.join(',')));icon(t,'P25','강화칸 2개 활성')}
   if(has(t,'P27')){const credits=Math.min(30,Math.max(0,Number(config.purpleCredits?.[t]??config.credits?.[t]??0)));for(const u of a){stat(u,'atk',1+credits*.02);stat(u,'amp',1+credits*.02)}icon(t,'P27',`남은 크레딧 ${credits}C 전투 강화`)}
   if(has(t,'P31')){const spent=Math.min(20,Math.max(0,Number(config.purpleSpent?.[t]||0)));for(const u of a)protect(u,u.maxHp*.008*spent);hitTeam(t,e=>e.maxHp*.012*spent,true,'현금 소각');icon(t,'P31',`${spent}C 연소 · 최대 HP 피해와 보호막`)}
   if(has(t,'P37')&&enemy.length){const best=[...enemy].sort((a,b)=>(b.main==='atk'?b.atk:b.amp)-(a.main==='atk'?a.atk:a.amp))[0];const k=best.main==='atk'?'atk':'amp';const amount=best[k]*(best.role==='보스'?.15:.30);if(best.role!=='보스')best[k]-=amount;const receivers=allies(t);for(const u of receivers)u[u.main==='atk'?'atk':'amp']+=amount/receivers.length;icon(t,'P37',best.name+' 주능력치 탈취')}
   if(has(t,'P38')){for(const u of a)u.critChance=(u.critChance||0)+.35;icon(t,'P38','스킬 치명타 개방')}
   if(has(t,'P41')){const tactic=chosen(t,'tactic','rush');st[t].tactic=tactic;if(tactic==='shield'){for(const u of a)protect(u,u.maxHp*.4)}icon(t,'P41',tactic==='rush'?'전격전':tactic==='shield'?'철벽전':'장기전')}
   if(has(t,'P42')){const moved=[];for(const e of enemy){const ownX=depth(e);if(ownX===0||ownX===2){const endOwn=2-ownX;e.x=e.team==='A'?endOwn:5-endOwn;moved.push(e)}else mark(e,'unmoved').until=6}for(const e of moved)extra(a[0],e,e.maxHp*.15,true,'뒤집힌 무대');icon(t,'P42','적 전열·후열 반전')}
   if(has(t,'P43')){const wanted=String(chosen(t,'baitId',''));const selected=a.find(u=>matchOwned(u,wanted))||a[0];mark(selected,'bait').until=10;icon(t,'P43',selected.name+' 10초 피해 경감',selected)}
   if(has(t,'P49')){const items=enemy.flatMap(e=>(e.equipment||[]).map(name=>({e,name})));if(items.length){const target=items[Math.floor(rng()*items.length)];const star=Math.max(...a.map(u=>u.star)),receiver=a.filter(u=>u.star===star)[Math.floor(rng()*a.filter(u=>u.star===star).length)];applyItemStats(receiver,target.name,1);receiver.itemEffects??={};receiver.itemEffects[target.name]??={count:0,until:0,next:1,readyAt:0,delayed:[],targets:{},bonusApplied:false};
    // The victim temporarily loses the item's stats and active effects; no ownership transfer.
    applyItemStats(target.e,target.name,-1);const gearIndex=target.e.equipment.indexOf(target.name);if(gearIndex>=0)target.e.equipment.splice(gearIndex,1);receiver.equipment.push(target.name);if(target.e.itemEffects&&!target.e.equipment.includes(target.name))delete target.e.itemEffects[target.name];
    mark(target.e,'confiscated').item=target.name;icon(t,'P49',`${target.name} 능력치·고유효과 압수`,receiver)}}
   if(has(t,'P10')){const strongest=[...a].sort((u,v)=>v.atk-u.atk)[0];for(let x=t==='A'?0:3;x<=(t==='A'?2:5);x++)for(let y=0;y<3;y++){if(units().some(u=>!u.dead&&u.x===x&&u.y===y))continue;const dummy=makeUnit(strongest.characterId,1,t,1,{x,y},`dummy:${x}:${y}`);dummy.role='소환수';dummy.name='황제의 병사';dummy.aff=[];dummy.maxHp=Math.max(1,strongest.maxHp*.2);dummy.hp=dummy.maxHp;dummy.atk=Math.max(1,strongest.atk*.2);dummy.amp=dummy.atk;dummy.as=.65;dummy.range=1;dummy.equipment=[];dummy.purpleDummy=true;const gear=chosen(t,'soldierItems',{})[[depth(dummy),y].join(',')];if(gear&&itemDB.all?.[gear]&&!itemDB.bloodInfo?.(gear)){dummy.equipment=[gear];ctx.applyEquipment(dummy);}units().push(dummy)}icon(t,'P10','빈칸 병사 소환')}
   if(has(t,'P07'))cd[t].dice=1.5;
   if(has(t,'P12')&&enemy.length){st[t].infected=new Set([enemy[0].id]);mark(enemy[0],'infected').active=true;st[t].infectionNext=6;icon(t,'P12',enemy[0].name+' 최초 감염')}
   if(has(t,'P22'))st[t].explosion={next:3,records:Object.create(null)};
   if(has(t,'P26'))st[t].retaliation={next:3,pool:0};
   if(has(t,'P28'))st[t].attacks=0;
   if(has(t,'P36')){const loss=Math.min(5,Number(config.purpleLosingStreak?.[t]||0));st[t].losingBoost=loss*.1;if(loss)icon(t,'P36',`${loss}연패 · 피해 +${loss*10}%`)}
   if(has(t,'P40')&&enemy.length){const counts=new Map();for(const e of enemy)counts.set(e.initialY,(counts.get(e.initialY)||0)+1);st[t].corrosionRow=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];for(const e of enemy.filter(e=>e.y===st[t].corrosionRow))extra(a[0],e,e.maxHp*.12,false,'침식 지대');icon(t,'P40',`침식 지대 ${st[t].corrosionRow+1}행`)}
   if(has(t,'P34')&&(st[t].bannedAff||st[t].bannedRole))icon(t,'P34',(st[t].bannedAff||st[t].bannedRole)+' 시너지 무효화')
   if(has(t,'P17'))cd[t].bell=3;
   if(has(t,'P18'))cd[t].bench=1.5;
   if(has(t,'P44'))cd[t].rewind=4;
   if(has(t,'P48'))cd[t].swap=3;
   if(has(t,'P13'))cd[t].reserve=3.5;
   if(has(t,'P21'))icon(t,'P21','연쇄 타격 준비');
  }
 }
 function isInvulnerable(dst){return has(dst.team,'P25')&&st[dst.team].tileSet?.has(tile(dst))&&now()<2}
 function modify(src,dst,raw,kind,opt={}){
  const t=src?.team;if(!t||raw<=0)return raw;
  // Defensive modifiers also apply to follow-up damage.
  if(has(dst.team,'P23'))raw*=.9;
  if(isInvulnerable(dst))return 0;
  raw*=buffs(dst).mitigation;
  if(opt.purpleBonus)return raw;
  const boost=buffs(src);raw*=boost.attackMult;if(kind==='skill')raw*=1+boost.spellMult;
  if(src.purpleMerged||src.dead)return 0;
  if((has(t,'P20')&&kind==='basic')&&isRear(dst))raw*=1.2;
  if(has(t,'P04')&&src.purple?.allRoles?.assassin&&(kind==='basic'||kind==='skill')&&isRear(dst))raw*=1+.3*src.purple.allRoles.assassin;
  if(has(t,'P25')&&(kind==='basic'||kind==='skill')&&st[t].tileSet?.has(tile(src)))raw*=1.3;
  if(has(t,'P41')&&st[t].tactic==='rush'&&now()<5)raw*=1.5;
  if(st[t].losingBoost&&(kind==='basic'||kind==='skill'))raw*=1+st[t].losingBoost;
  if(src.purpleExecutorUntil>now())raw*=1.2;
  if(src.purpleUnarmedBonusUntil>now())raw*=1.2;
  if(dst.purple?.unmoved?.until>now())raw*=1.3;
  if(has(t,'P34')&&dst.purple?.banned?.until>now())raw*=1.15;
  const srcRow=(src.team==='A'?src.team:src.team);const other=dst.team==='A'?'B':'A';
  if(st[other].corrosionRow!==undefined&&dst.y===st[other].corrosionRow)raw*=1.1;
  if(dst.purple?.bait?.until>now())raw*=.3;
  if(has(t,'P38')&&kind==='skill'&&!opt.purpleBonus&&!opt.itemDamage){const crit=Math.min(1,Math.max(0,src.critChance||0));if(rng()<crit){raw*=(src.critDamage||2)+Math.max(0,(src.critChance||0)-1)*.5;opt.critical=true}}
  return raw;
 }
 function sharedDamageCap(dst){const h=st[dst?.team]?.heart;return dst?.purple?.heart?.active&&h?h.hp:null}
 function heartOf(u){const h=st[u?.team]?.heart;return u?.purple?.heart?.active&&h?h:null}
 function syncHeart(u,h){for(const m of allies(u.team,false).filter(x=>h.ids.includes(x.id)&&!x.dead))m.hp=h.hp>0?Math.min(m.maxHp,m.maxHp*h.hp/h.max):0}
 // Execution removes only its target's share, not every member's remaining life.
 function detachHeart(u){const h=heartOf(u);if(!h)return;const share=Math.min(h.max,h.shares?.[u.id]??u.maxHp*1.5),ratio=h.max>0?h.hp/h.max:0;h.ids=h.ids.filter(id=>id!==u.id);h.max=Math.max(0,h.max-share);h.hp=h.max*ratio;u.purple.heart.active=false;syncHeart(u,h)}
 function debitHeart(src,dst,eff){const h=heartOf(dst);if(!h)return false;h.hp=Math.max(0,h.hp-eff);syncHeart(dst,h);if(h.hp<=0){const members=allies(dst.team,false).filter(u=>h.ids.includes(u.id)&&!u.dead);icon(dst.team,'P11','공유 생명력 소진');for(const u of members){u.purple.heart.active=false;u.pendingLethal=true}h.ids=[];h.max=0;for(const u of members){if(!u.dead&&u.hp<=0)ctx.resolveLethal(src,u,{sourceName:'하나의 심장',sharedDepletion:true});u.pendingLethal=false}return 'depleted'}return true}
 function clearInfection(u){for(const t of ['A','B'])st[t].infected?.delete(u.id)}
 function healHeart(u,amount){const h=heartOf(u);if(!h)return null;if(h.hp<=0)return 0;const before=h.hp;h.hp=Math.min(h.max,h.hp+amount);syncHeart(u,h);return Math.max(0,h.hp-before)}
 function afterDamage(src,dst,eff,kind,opt={}){
  if(eff<=0||opt.purpleBonus||dst.dead)return;
  const t=src?.team,other=dst.team;
  if(t&&has(t,'P22')&&(kind==='basic'||kind==='skill')&&!opt.itemDamage){const v=st[t].explosion;if(v)v.records[dst.id]=(v.records[dst.id]||0)+eff}
  if(t&&has(t,'P21')&&(kind==='basic'||kind==='skill')&&!opt.itemDamage){for(const e of foes(t).filter(u=>u!==dst))extra(src,e,eff*.3,true,'연쇄 판결')}
  if(has(other,'P26')&&dst.role!=='소환수'){const v=st[other].retaliation;if(v)v.pool+=eff}
  if(t&&has(t,'P19')&&kind==='basic'&&src.equipment?.includes('초월:공격')){const v=mark(src,'forgeAtk');v.count=(v.count||0)+1;if(v.count>=3){v.count=0;extra(src,dst,src.atk*.9,false,'초월:공격');icon(t,'P19','초월 공격 추가타',src)}}
  if(t&&has(t,'P28')&&kind==='basic'&&src.role!=='소환수'&&!opt.itemDamage){st[t].attacks=(st[t].attacks||0)+1;if(st[t].attacks>=8){st[t].attacks=0;const sum=allies(t).reduce((s,u)=>s+u.atk*Math.max(.1,u.as),0);extra(src,dst,sum*.8,false,'동시의 박자');icon(t,'P28','8회 적중 연계 타격',src)}}
  if(t&&has(t,'P12')&&st[t].infected?.has(dst.id)&&(kind==='basic'||kind==='skill'))recover(src,eff*.25);
  if(t&&has(t,'P29')&&kind==='basic'&&!dst.dead&&dst.hp>0&&dst.hp/dst.maxHp<.15&&dst.role!=='보스'&&ctx.executeTarget(src,dst,'집행자의 명령')){src.purpleExecutorUntil=now()+4;icon(t,'P29',dst.name+' 처형',src)}

 }
 function onDeath(src,dst){const t=src?.team,other=dst.team;
  if(t&&has(t,'P32')&&dst.role!=='소환수'&&dst.role!=='보스'&&st[t].summons!==3){const allSummons=all(t).filter(u=>u.purpleGhost&&!u.dead);if(allSummons.length<3){const occupied=new Set(units().filter(u=>!u.dead).map(u=>`${u.x},${u.y}`));let cells=[];for(let x=0;x<6;x++)for(let y=0;y<3;y++)if(!occupied.has(`${x},${y}`))cells.push({x,y,dist:Math.abs(dst.x-x)+Math.abs(dst.y-y)});cells.sort((a,b)=>a.dist-b.dist);if(cells.length){const loc=cells[0],g=makeUnit(dst.characterId,Math.min(3,dst.star),t,1,loc,'ghost:'+dst.id);g.role='소환수';g.aff=[];g.name='징집 망령';g.maxHp=Math.max(1,dst.maxHp*.55);g.hp=g.maxHp;g.atk=dst.atk*.55;g.amp=0;g.range=dst.range;g.purpleGhost=true;g.equipment=[];g.nextAttack=now()+1/Math.max(.1,g.as);units().push(g);icon(t,'P32',dst.name+' 망령 징집',g)}}}
  if(has(other,'P05')&&!st[other].revived&&allies(other,false).every(u=>u.dead)){st[other].revived=true;for(const u of allies(other,false)){if(u.purpleMerged)continue;u.dead=false;u.hp=Math.max(1,u.maxHp*.25);u.ccUntil=now()}icon(other,'P05','전원 부활')}
 }
 function onSkill(u){const t=u.team;if(has(t,'P19')&&u.equipment?.includes('초월:주문')){const v=mark(u,'forgeSpell');v.count=(v.count||0)+1;if(v.count>=2){v.count=0;for(const e of foes(t))extra(u,e,u.amp*.8,false,'초월:주문');icon(t,'P19','초월 주문 광역효과',u)}}
 if(!has(t,'P02')&&!has(t,'P24')&&!has(t==='A'?'B':'A','P15'))return;
  if(has(t,'P02')&&u.purple?.transcend?.active&&u.star===4){for(const e of foes(t).slice(0,3))extra(u,e,(u.main==='atk'?u.atk:u.amp)*.5,false,'초월자');icon(t,'P02','초월 스킬 여파',u)}

 }
 function cancelSkill(u){const other=u.team==='A'?'B':'A';if(!has(other,'P15')||(st[other].censors||0)>=2)return false;st[other].censors=(st[other].censors||0)+1;for(const a of allies(other)){protect(a,a.maxHp*.1);ctx.reduceSkillCooldown(a,1.5)}icon(other,'P15',u.name+' 스킬 검열',u);return true}
 function beforeCC(u,duration){const t=u.team;if(has(t,'P23')){const last=mark(u,'cc');if((last.next||0)<=now()){protect(u,u.maxHp*.15);last.next=now()+4;icon(t,'P23',u.name+' 행동불능 방어',u)}return duration*.5}return duration}
 function beforeTarget(u,es){if(!has(u.team,'P20')||u.role==='소환수')return es;return [...es].sort((a,b)=>{const ad=a.team==='A'?a.initialX:5-a.initialX,bd=b.team==='A'?b.initialX:5-b.initialX;return ad-bd||dist(u,a)-dist(u,b)})}
 function tick(){for(const t of ['A','B']){
  const a=allies(t),es=foes(t);if(!a.length||!es.length)continue;
  if(has(t,'P19'))for(const u of a)if(u.equipment?.includes('초월:수호')){const v=mark(u,'forgeGuard');if(now()>=(v.next||5)){protect(u,u.maxHp*.18);v.next=now()+5;icon(t,'P19','초월 수호 재보호막',u)}}
  if(has(t,'P06')){const line=st[t].line;if(line?.kind==='h'&&ready(t,'trip',6,true)){hitTeam(t,a.reduce((s,u)=>s+u.atk,0)*1.3,false,'삼목의 왕');icon(t,'P06','가로 포격')}if(line?.kind==='v'&&ready(t,'trip',5)){for(const u of a)recover(u,u.maxHp*.15);icon(t,'P06','세로 회복')}}
  if(has(t,'P07')&&ready(t,'dice',7,1.5)){const roll=Math.floor(rng()*6);if(roll===0)hitTeam(t,e=>e.maxHp*.12,true,'신의 주사위');else if(roll===1)a.forEach(u=>recover(u,u.maxHp*.2));else if(roll===2)a.forEach(u=>protect(u,u.maxHp*.25));else if(roll===3)es.forEach(u=>applyCC(u,.8,a[0]));else if(roll===4){st[t].diceDamageUntil=now()+4}else{const dead=allies(t,false).find(u=>u.dead&&!u.purpleMerged);if(dead){dead.dead=false;dead.hp=dead.maxHp*.25;const h=heartOf(dead);if(h){h.hp=Math.max(h.hp,h.max*.25);syncHeart(dead,h)}}else a.forEach(u=>protect(u,u.maxHp*.15))}icon(t,'P07',`신의 주사위: ${['적 전체 피해','아군 전체 회복','아군 전체 보호막','적 전체 행동불능','아군 피해량 증가','아군 부활 또는 보호막'][roll]}`)}
  if(has(t,'P12')&&ready(t,'infectionDot',1)){for(const e of es.filter(x=>st[t].infected?.has(x.id)))extra(a[0],e,e.maxHp*.05,false,'붉은 전염')}if(has(t,'P12')&&st[t].infectionNext<=now()){const candidates=es.filter(u=>!st[t].infected.has(u.id));if(candidates.length){st[t].infected.add(candidates[0].id);mark(candidates[0],'infected').active=true;icon(t,'P12',candidates[0].name+' 감염 확산')}st[t].infectionNext=now()+6}
  if(has(t,'P13')&&ready(t,'reserve',1000,3.5)){const reserves=[...(config['reserves'+t]||[])];for(const u of a.slice(0,3)){const reserve=reserves.shift?.();if(!reserve||!ctx.byId?.[reserve.characterId])continue;const pos={x:u.x,y:u.y};const r=makeUnit(reserve.characterId,reserve.star||1,t,config['mastery'+t]||1,pos,'reserve:'+u.id);r.equipment=[...(reserve.items||[])];r.nextAttack=now()+1/Math.max(.1,r.as);u.dead=true;u.purpleMerged=true;u.hp=0;units().push(r)}icon(t,'P13','예비대 차원 교대')}
  if(has(t,'P17')&&ready(t,'bell',1000,3)){hitTeam(t,e=>e.maxHp*.12,true,'황혼의 종');es.forEach(e=>applyCC(e,.8,a[0]));icon(t,'P17','황혼의 종 발동')}
  if(has(t,'P18')&&ready(t,'bench',3,1.5)){const ben=(config['reserves'+t]||[]).slice(0,3);for(const [i,o] of ben.entries()){const r=ctx.byId?.[o.characterId];if(!r)continue;const victim=es[i%es.length],source=a[i%a.length];const reserve=makeUnit(o.characterId,o.star||1,t,config['mastery'+t]||1,{x:source.x,y:source.y},'bench-support');reserve.equipment=[...(o.items||[])];ctx.applyEquipment(reserve);extra(source,victim,reserve.atk*1.1,false,'관중석의 영웅들')}icon(t,'P18','벤치 지원 사격')}
  if(has(t,'P22')&&st[t].explosion&&st[t].explosion.next<=now()){const x=st[t].explosion;for(const e of es){const n=x.records[e.id]||0;if(n>0)extra(a[0],e,n*.4,true,'시간차 폭발')}x.records={};x.next=now()+3;icon(t,'P22','시간차 폭발')}
  if(has(t,'P26')&&st[t].retaliation&&st[t].retaliation.next<=now()){const x=st[t].retaliation;if(x.pool>0){for(const e of es)extra(a[0],e,x.pool*.5/es.length,false,'반격 공식');icon(t,'P26','저장 피해 반격')}x.pool=0;x.next=now()+3}
  if(has(t,'P40')&&ready(t,'corrosion',1)){for(const e of es.filter(u=>u.y===st[t].corrosionRow))extra(a[0],e,e.maxHp*.03,false,'침식 지대')}
  if(has(t,'P41')&&st[t].tactic==='long'&&ready(t,'long',3)){for(const u of a){recover(u,u.maxHp*.12);mark(u,'long').stacks=Math.min(3,(mark(u,'long').stacks||0)+1)}icon(t,'P41','장기전 강화')}
  if(has(t,'P44')&&ready(t,'rewind',1000,4)){for(const u of a){ctx.clearDebuffs(u);const h=heartOf(u);if(h){h.hp=h.max;syncHeart(u,h)}else u.hp=Math.min(u.maxHp,Math.max(u.hp,u.purple?.start?.hp||u.maxHp));}icon(t,'P44','HP 및 해로운 상태 초기화')}
  if(has(t,'P48')&&ready(t,'swap',4,3)&&a.length>=2){const order=[...a].sort((u,v)=>u.hp/u.maxHp-v.hp/v.maxHp),lo=order[0],hi=order[order.length-1];const [x,y]=[lo.x,lo.y];lo.x=hi.x;lo.y=hi.y;hi.x=x;hi.y=y;for(const u of [lo,hi]){recover(u,u.maxHp*.15);mark(u,'swap').until=now()+1.5}icon(t,'P48','생명선 교차',lo)}
 }}
 function startFinal(){for(const t of ['A','B']){
  const a=allies(t,false);if(has(t,'P06')){const lines=[...Array(3)].flatMap((_,i)=>[{kind:'h',cells:[[0,i],[1,i],[2,i]]},{kind:'v',cells:[[i,0],[i,1],[i,2]]}]).concat([{kind:'d',cells:[[0,0],[1,1],[2,2]]},{kind:'d',cells:[[0,2],[1,1],[2,0]]}]);const coords=a.filter(u=>!u.purpleMerged).map(u=>[u.team==='A'?u.initialX:5-u.initialX,u.initialY].join(','));let line=lines.find(l=>l.cells.every(([x,y])=>coords.includes(`${x},${y}`)));if(line){st[t].line=line;if(line.kind==='v'){for(const u of a)protect(u,u.maxHp*.35)}if(line.kind==='d'){for(const u of a){u.purpleSpellBoost=.4}}icon(t,'P06',line.kind==='h'?'가로 삼목':'v'===line.kind?'세로 삼목':'대각선 삼목')}}
 }}
 function buffs(u){const t=u.team;return {attackMult:(st[t].diceDamageUntil>now()?1.35:1)*(1+(u.purple?.long?.stacks||0)*.08),spellMult:u.purpleSpellBoost||0,mitigation:u.purple?.swap?.until>now()?.55:1}}
 function result(){return {A:{ids:[...ids.A],...st.A},B:{ids:[...ids.B],...st.B}}}
 return {has,ids,st,beforeSynergies,start,startFinal,modify,isInvulnerable,detachHeart,sharedDamageCap,debitHeart,healHeart,clearInfection,afterDamage,onDeath,onSkill,cancelSkill,beforeCC,beforeTarget,tick,buffs,result,icon};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LIVEPurpleCombat=api;
})(globalThis);
