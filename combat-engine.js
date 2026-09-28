// Shared deterministic combat runtime: DOM-independent.
(function(root){'use strict';
const {byId}=typeof module!=='undefined'&&module.exports?require('./roster.js'):root.ERRoster;
const BOARD_W=6,BOARD_H=3,DT=.05,QA={moveInterval:.5,rioDistance:{1:1,2:2/3,3:1/3},marcusCc:1};
const coefficients={
 shurin:{aoe:[2,2.5,4.5],resolve:[1,1.5,2.5]},
 marcus:{quake:[1.5,2,3],shock:[1.5,2,3.5]},
 yumin:{start:[1,1.5,2.5],windDot:[.4,.6,1],windExtra:[.75,1,2]},
 nicky:{hot:[.2,.3,.5],guardChance:[.2,.2,.4],counter:[.75,1,2]},
 rio:{shot:[3,4,7],kaeyumiMax:[.3,.4,.7]},
 justina:{bomb:[.7,.95,1.7],boost:[.35,.5,.9]}
};
const growth={hp:[1,1.7,2.8],atk:[1,1.7,2.8],amp:[1,1.7,2.8],def:[1,1.15,1.4],as:[1,1.05,1.15]};
function toCombatPosition(team,x,y){return{x:team==='A'?x:5-x,y}}
function validateConfig(input){
 const config=JSON.parse(JSON.stringify(input));
 for(const team of ['A','B']){
  const entries=config['team'+team];
  if(!Array.isArray(entries)||entries.length>3)throw new Error(team+'팀은 최대 3명입니다.');
  const ids=new Set(),cells=new Set();
  for(const e of entries){
   if(!byId[e.characterId])throw new Error('알 수 없는 실험체: '+e.characterId);
   if(ids.has(e.characterId))throw new Error('같은 팀 실험체 중복은 불가합니다.');ids.add(e.characterId);
   if(![1,2,3].includes(e.star))throw new Error('별 단계는 1~3입니다.');
   if(![e.x,e.y].every(n=>Number.isInteger(n)&&n>=0&&n<=2))throw new Error('배치는 팀별 3×3 좌표여야 합니다.');
   const key=e.x+','+e.y;if(cells.has(key))throw new Error('배치 칸이 중복됩니다.');cells.add(key);
  }
  const key='mastery'+team;config[key]??=1;
  if(!Number.isInteger(config[key])||config[key]<1||config[key]>20)throw new Error('숙련도는 1~20입니다.');
 }
 config.seed??=24004;if(!Number.isInteger(config.seed))throw new Error('Seed는 정수여야 합니다.');
 config.moveInterval??=QA.moveInterval;if(!Number.isFinite(config.moveInterval)||config.moveInterval<=0)throw new Error('이동 간격은 양수여야 합니다.');
 config.targetStats??=true;return config;
}
function CombatEngine(input){
 const config=validateConfig(input);let units=[],time=0,running=false,battleOver=false,prepared=false,outcome=null;
 let stage={A:{},B:{}},shared={A:{swim:0},B:{swim:0}},rng=seeded(config.seed);const events=[],targetActivations=new WeakMap();
 const log=message=>events.push({time,type:'log',message}),flash=(unit,amount)=>events.push({time,type:'damage',unitId:unit.id,amount});
 function makeUnit(characterId,star,team,mastery,pos){
  const r=byId[characterId],m=1+(mastery-1)*.01,u={id:team+':'+characterId,characterId,name:r.name,team,role:r.role,aff:[...r.affiliations],range:r.baseStats.range,main:r.main,star,x:pos.x,y:pos.y,initialX:pos.x,initialY:pos.y};
  u.coefficients=Object.fromEntries(Object.entries(coefficients[characterId]||{}).map(([k,v])=>[k,v[star-1]]));
  u.base=Object.fromEntries(Object.entries(growth).map(([k,v])=>[k,r.baseStats[k]*v[star-1]*m]));resetCombatState(u);return u;
 }
 const sourceCatalog={'슈린':{결심응진:'passive',만검귀종:'skill'},'마커스':{지각변동:'skill','전사의 투지':'passive'},'유민':{풍류운산:'skill','풍류운산 행동 불능':'skill','바람 지속 피해':'passive','바람 추가 피해':'passive'},'니키':{'가드&카운터':'passive',다혈질:'passive'},'리오':{정사필중:'skill','정사필중 정신 집중':'skill'},'유스티나':{'섬멸 포격':'skill','강화 기본 공격':'passive'}};
 function sourceStats(u,n,k){if(!u.damageSources[n])u.damageSources[n]={kind:k,activations:0,hits:0,raw:0,dealt:0,targets:Object.create(null)};return u.damageSources[n]}
 function activateSource(u,n,k){sourceStats(u,n,k).activations++}
 function recordSourceDamage(u,n,k,raw,dealt,target){let e=sourceStats(u,n,k);e.raw+=raw;e.dealt+=dealt;if(dealt>0)e.hits++;if(target&&config.targetStats){let s=e.targets[target.id]||(e.targets[target.id]={activations:0,hits:0,raw:0,dealt:0}),seen=targetActivations.get(e);if(!seen){seen=new Map();targetActivations.set(e,seen)}if(seen.get(target.id)!==e.activations){s.activations++;seen.set(target.id,e.activations)}s.raw+=raw;s.dealt+=dealt;if(dealt>0)s.hits++}}
 function resetSourceStats(u){u.damageSources=Object.create(null);sourceStats(u,'기본 공격','basic');for(const[n,k]of Object.entries(sourceCatalog[u.name]||{}))sourceStats(u,n,k);for(const n of u.aff)if(n==='수영복'||n==='바니걸')sourceStats(u,n,'synergy')}
 function seeded(seed){let x=seed|0;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
 function resetCombatState(u){u.maxHp=u.base.hp;u.hp=u.maxHp;u.atk=u.base.atk;u.def=u.base.def;u.as=u.base.as;u.amp=u.base.amp;u.basicCount=0;u.nextAttack=Infinity;u.nextMove=config.moveInterval;u.damage={basic:0,skill:0,passive:0,synergy:0};resetSourceStats(u);u.dead=false;u.ccUntil=0;u.channel=null;u.hot=false;u.boost=false;u.shurin={phase:'normal',normalAttacks:0,resolveUses:0,burstUntil:0,totalResolveUses:0,totalAoeUses:0};u.wind={};u.nextWindTick=1;u.yuminCcDone=false;u.nextQuake=10;u.shock=false;u.nextShot=8}
 function roleBuff(u){let d=u.team==='A'?u.initialX:5-u.initialX;if(u.role==='전사'&&d>=1){u[u.main==='atk'?'atk':'amp']*=1.15;u.as*=1.10;u.def+=10;u.maxHp*=1.10;u.hp=u.maxHp}if(u.role==='탱커'&&d===2){u.def+=20;u.maxHp*=1.20;u.hp=u.maxHp;u.as*=1.10}if(u.role==='원거리 평타'&&d<=1){u.atk*=1.20;u.as*=1.20}if(u.role==='원거리 스킬'&&d<=1){u.amp*=1.25;u.as*=1.10}}
 function lockSynergies(){for(const team of ['A','B']){let own=units.filter(u=>u.team===team);stage[team]={수영복:own.filter(u=>u.aff.includes('수영복')).length,바니걸:own.filter(u=>u.aff.includes('바니걸')).length};shared[team]={swim:0}}}
 const dist=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)),adjacent=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1,enemies=u=>units.filter(v=>!v.dead&&v.team!==u.team);
 function target(u,ignoreRange=false){let es=enemies(u).filter(v=>ignoreRange||dist(u,v)<=u.range);if(!es.length)return null;es.sort((a,b)=>(a.y===u.y?0:1)-(b.y===u.y?0:1)||dist(u,a)-dist(u,b)||a.hp-b.hp||a.def-b.def||(b.y-a.y));return es[0]}
 function nearestEnemy(u){return enemies(u).sort((a,b)=>dist(u,a)-dist(u,b)||a.hp-b.hp||a.def-b.def||(b.y-a.y))[0]||null}
 const actual=(raw,def)=>raw*100/(100+Math.max(0,def)),currentAtk=u=>u.atk*(u.name==='니키'&&u.hot?1+(u.coefficients.hot||0):1),currentAmp=u=>u.amp*(u.name==='니키'&&u.hot?1+(u.coefficients.hot||0):1),adaptive=u=>u.main==='atk'?currentAtk(u):currentAmp(u);
 function currentAs(u,t){let a=u.as;if(u.name==='니키'&&u.hot)a*=1+u.coefficients.hot;if(u.name==='리오'&&t)a*=1+u.coefficients.kaeyumiMax*(QA.rioDistance[dist(u,t)]||0);return Math.min(4,a)}
 function applyCC(u,dur){u.ccUntil=Math.max(u.ccUntil,time+dur);if(u.channel){log(`${u.name} 정신 집중 <b>중단</b>`);if(u.name==='리오')u.nextShot=time+8;u.channel=null}}
 function damage(src,dst,raw,kind='basic',fixed=false,opt={}){if(dst.dead)return 0;let r=raw;if(!fixed&&opt.guardable!==false&&dst.name==='니키'&&(kind==='basic'||kind==='skill')&&rng()<dst.coefficients.guardChance){r*=.20;activateSource(dst,'가드&카운터','passive');let cr=currentAmp(dst)*dst.coefficients.counter,c=actual(cr,src.def),ce=Math.min(src.hp,c);src.hp-=c;dst.damage.passive+=ce;recordSourceDamage(dst,'가드&카운터','passive',cr,ce,src);flash(src,Math.round(ce));if(src.hp<=0){src.hp=0;src.dead=true}}let d=fixed?r:actual(r,dst.def),eff=Math.min(Math.max(0,dst.hp),d);dst.hp-=d;src.damage[kind]+=eff;recordSourceDamage(src,opt.sourceName||({basic:'기본 공격',skill:'스킬',passive:'패시브',synergy:'시너지'}[kind]),kind,raw,eff,dst);flash(dst,Math.round(eff));if(dst.name==='니키'&&!dst.hot&&dst.hp>0&&dst.hp<=dst.maxHp*.5){dst.hot=true;activateSource(dst,'다혈질','passive')}if(dst.hp<=0){dst.hp=0;dst.dead=true;log(`${src.name} → <b>${dst.name}</b> 처치`)}return eff}
 const heal=(u,a)=>{if(!u.dead)u.hp=Math.min(u.maxHp,u.hp+a)};
 function bunny(u,t){let c=stage[u.team].바니걸||0;if(!u.aff.includes('바니걸')||c<2||t.dead)return;let ch=c>=3?.35:.20,ra=c>=3?.50:.40;if(rng()<ch){activateSource(u,'바니걸','synergy');damage(u,t,adaptive(u)*ra,'synergy',false,{guardable:false,sourceName:'바니걸'})}}
 function swimsuit(u){let c=stage[u.team].수영복||0;if(!u.aff.includes('수영복')||c<2)return;shared[u.team].swim++;let need=c>=3?15:20,ra=c>=3?.05:.03;if(shared[u.team].swim>=need){shared[u.team].swim=0;activateSource(u,'수영복','synergy');for(const e of enemies(u))damage(u,e,e.maxHp*ra,'synergy',true,{guardable:false,sourceName:'수영복'})}}
 function shurinBasic(u,t){let s=u.shurin;if(s.phase==='burst'&&time>=s.burstUntil){s.phase='normal';s.normalAttacks=0;s.burstUntil=0}if(s.phase==='normal'){s.normalAttacks++;if(s.normalAttacks===3)s.phase='ready';return}activateSource(u,'결심응진','passive');let dealt=damage(u,t,currentAtk(u)*u.coefficients.resolve,'passive',false,{guardable:false,sourceName:'결심응진'});heal(u,dealt*.5);s.totalResolveUses++;if(s.phase==='burst')return;s.normalAttacks=0;s.resolveUses++;if(s.resolveUses<3){s.phase='normal';return}s.resolveUses=0;s.phase='burst';s.burstUntil=time+3;s.totalAoeUses++;activateSource(u,'만검귀종','skill');for(const e of enemies(u).filter(e=>adjacent(u,e)))damage(u,e,currentAtk(u)*u.coefficients.aoe,'skill',false,{guardable:true,sourceName:'만검귀종'})}
 function basicAttack(u,t){u.basicCount++;activateSource(u,'기본 공격','basic');damage(u,t,currentAtk(u),'basic',false,{guardable:true,sourceName:'기본 공격'});bunny(u,t);swimsuit(u);if(u.name==='유민'&&!t.dead){let before=u.wind[t.id]||0;if(before>=2){activateSource(u,'바람 추가 피해','passive');damage(u,t,currentAmp(u)*u.coefficients.windExtra,'passive',false,{guardable:false,sourceName:'바람 추가 피해'})}u.wind[t.id]=Math.min(2,before+1)}if(u.name==='유스티나'){if(u.boost&&!t.dead){activateSource(u,'강화 기본 공격','passive');damage(u,t,currentAmp(u)*u.coefficients.boost,'passive',false,{guardable:false,sourceName:'강화 기본 공격'});u.boost=false}if(u.basicCount>=2){u.basicCount=0;activateSource(u,'섬멸 포격','skill');for(const e of enemies(u).filter(e=>e.y===t.y))damage(u,e,currentAmp(u)*u.coefficients.bomb,'skill',false,{guardable:true,sourceName:'섬멸 포격'});u.boost=true}}if(u.name==='슈린')shurinBasic(u,t);if(u.name==='마커스'&&t.shock&&!t.dead){t.shock=false;activateSource(u,'전사의 투지','passive');damage(u,t,currentAtk(u)*u.coefficients.shock,'passive',false,{guardable:false,sourceName:'전사의 투지'});applyCC(t,.5)}}
 function move(u){let t=nearestEnemy(u);if(!t||target(u))return;let dir=u.team==='A'?1:-1,nx=u.x+dir,vacant=(x,y)=>x>=0&&x<BOARD_W&&y>=0&&y<BOARD_H&&!units.some(v=>!v.dead&&v.x===x&&v.y===y);if((t.x-u.x)*dir>0&&vacant(nx,u.y)){u.x=nx;return}let ny=u.y+Math.sign(t.y-u.y);if(ny!==u.y&&vacant(u.x,ny))u.y=ny}
 function periodicAndSkills(){for(const u of units){if(u.dead)continue;if(u.name==='유민'){if(!u.yuminCcDone&&time>=1){u.yuminCcDone=true;activateSource(u,'풍류운산 행동 불능','skill');for(const e of enemies(u))applyCC(e,.5)}if(time+1e-9>=u.nextWindTick){while(time+1e-9>=u.nextWindTick)u.nextWindTick+=1;if(enemies(u).some(e=>(u.wind[e.id]||0)>0))activateSource(u,'바람 지속 피해','passive');for(const e of enemies(u))if((u.wind[e.id]||0)>0)damage(u,e,currentAmp(u)*u.coefficients.windDot,'passive',false,{guardable:false,sourceName:'바람 지속 피해'})}}if(u.name==='마커스'&&time+1e-9>=u.nextQuake&&u.ccUntil<=time){u.nextQuake+=10;activateSource(u,'지각변동','skill');for(const e of enemies(u)){damage(u,e,currentAtk(u)*u.coefficients.quake,'skill',false,{guardable:true,sourceName:'지각변동'});if(!e.dead){applyCC(e,QA.marcusCc);e.shock=true}}}if(u.name==='리오'){if(u.channel&&u.channel.type==='shot'&&time+1e-9>=u.channel.ends){let t=nearestEnemy(u);u.channel=null;if(t){activateSource(u,'정사필중','skill');damage(u,t,currentAtk(u)*u.coefficients.shot,'skill',false,{guardable:true,sourceName:'정사필중'});for(const e of enemies(u).filter(e=>e!==t&&adjacent(e,t)))damage(u,e,currentAtk(u)*u.coefficients.shot*.5,'skill',false,{guardable:true,sourceName:'정사필중'})}}else if(!u.channel&&time+1e-9>=u.nextShot&&u.ccUntil<=time){u.nextShot+=8;activateSource(u,'정사필중 정신 집중','skill');u.channel={type:'shot',ends:time+.5}}}}}
 function prepareBattle(){if(prepared)return;if(!units.some(u=>u.team==='A')||!units.some(u=>u.team==='B'))throw new Error('양 팀에 최소 1명을 선택하세요.');prepared=true;running=true;units.forEach(roleBuff);lockSynergies();for(const u of units)u.nextAttack=1/currentAs(u,null);for(const u of units.filter(u=>u.name==='유민')){activateSource(u,'풍류운산','skill');for(const e of enemies(u))damage(u,e,u.amp*u.coefficients.start,'skill',false,{guardable:true,sourceName:'풍류운산'})}}
 function timeoutResult(){let a=units.filter(u=>u.team==='A').reduce((s,u)=>s+Math.max(0,u.hp)/u.maxHp,0),b=units.filter(u=>u.team==='B').reduce((s,u)=>s+Math.max(0,u.hp)/u.maxHp,0);return Math.abs(a-b)<1e-9?'무승부':a>b?'A팀 승리':'B팀 승리'}
 function tick(dt){if(battleOver)return;time+=dt;periodicAndSkills();for(const u of units.filter(u=>!u.dead)){if(u.dead||u.ccUntil>time||u.channel)continue;let t=target(u);if(t&&time+1e-9>=u.nextAttack){basicAttack(u,t);u.nextAttack=time+1/currentAs(u,t)}else if(!t&&time+1e-9>=u.nextMove){move(u);u.nextMove=time+config.moveInterval}}let a=units.some(u=>u.team==='A'&&!u.dead),b=units.some(u=>u.team==='B'&&!u.dead);if(!a||!b||time>=60){battleOver=true;running=false;outcome=!a&&!b?'무승부':a?'A팀 승리':b?'B팀 승리':timeoutResult();log(`<b>${outcome}</b> · ${time.toFixed(1)}초`)}}
 for(const team of ['A','B'])for(const e of config['team'+team])units.push(makeUnit(e.characterId,e.star,team,config['mastery'+team],toCombatPosition(team,e.x,e.y)));
 const getResult=()=>JSON.parse(JSON.stringify({time,battleOver,outcome,units}));
 const api={start:prepareBattle,step(){prepareBattle();tick(DT);return getResult()},run(){prepareBattle();while(!battleOver)tick(DT);return getResult()},getResult,drainEvents(){return events.splice(0)}};
 api.runtime={makeUnit,resetCombatState,roleBuff,lockSynergies,prepareBattle,seeded,sourceStats,activateSource,recordSourceDamage,dist,adjacent,enemies,target,nearestEnemy,actual,currentAs,applyCC,shurinBasic,move,periodicAndSkills,tick,timeoutResult};
 return api;
}
const api={CombatEngine,toCombatPosition,validateConfig,DT};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ERCombat=api;
})(globalThis);
