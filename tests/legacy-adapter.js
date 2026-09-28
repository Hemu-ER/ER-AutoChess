// Test-only legacy names/configuration retained for the original regression scenarios.
const $=s=>document.querySelector(s),DT=.05,expandedMeters=new Set();
let silent=false,engine;
const legacy={슈린:['shurin','A',2,1],마커스:['marcus','A',2,0],유민:['yumin','A',0,2],니키:['nicky','B',3,1],리오:['rio','B',4,0],유스티나:['justina','B',5,2]};
function makeUnit(name,mastery,pos){const [id,team,x,y]=legacy[name];return engine.runtime.makeUnit(id,2,team,mastery,{x:pos?pos[0]:x,y:pos?pos[1]:y})}
function reset(){
 const config={teamA:[],teamB:[],masteryA:+$('#masteryA').value,masteryB:+$('#masteryB').value,moveInterval:+$('#moveInterval').value};
 for(const [name,[characterId,team,x,y]] of Object.entries(legacy))config['team'+team].push({characterId,star:2,x:team==='A'?x:5-x,y});
 if(!engine)engine=new ERCombat.CombatEngine(config);
 else {
  engine.runtime.units=Object.entries(legacy).map(([name,[id,team,x,y]])=>makeUnit(name,config['mastery'+team],[x,y]));
  Object.assign(engine.runtime,{time:0,running:false,battleOver:false,prepared:false,outcome:null});engine.drainEvents();
 }
 // IDs match the historical fixture for event-by-event equivalence comparisons.
 for(const u of engine.runtime.units)u.id=u.name;
 $('#status').textContent='배치 단계';
}
function prepareBattle(){engine.start()}
function render(){}function flash(){}
function tick(dt){engine.runtime.tick(dt);$('#status').textContent=engine.getResult().outcome||$('#status').textContent;
 const events=engine.drainEvents();if(!silent){for(const event of events)if(event.type==='log'){let d=document.createElement('div');d.innerHTML=event.message;$('#log').prepend(d)}meters()}}
for(const key of ['units','time','running','battleOver','stage','shared','rng','damage','basicAttack'])Object.defineProperty(globalThis,key,{configurable:true,get:()=>engine.runtime[key],set:v=>engine.runtime[key]=v});
for(const key of ['resetCombatState','roleBuff','lockSynergies','seeded','sourceStats','activateSource','recordSourceDamage','dist','adjacent','enemies','target','nearestEnemy','actual','currentAs','applyCC','shurinBasic','move','periodicAndSkills','timeoutResult'])globalThis[key]=(...args)=>engine.runtime[key](...args);
reset();
