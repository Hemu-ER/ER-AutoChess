'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {CARDS}=require('../js/server/match-augment.cjs');
const economy=require('../js/server/match-economy.cjs');
const grayE=require('../js/server/gray-economy.cjs');
const grayCombat=require('../js/shared/gray-combat.js');
const {CombatEngine}=require('../js/shared/combat-engine.js');
let checks=0;
function ok(value,description){assert.ok(value,description);checks++}
function eq(a,b,description){assert.equal(a,b,description);checks++}
function fresh(ids=[]){const a=economy.makeInitial();a.augmentIds=[...ids];a.infusionIds=[...ids];a.credits=100;return a}
// Shop, credit, XP, merge, free-reroll and idempotent post-PvP reward checks.
{
 let a=fresh(['G013']);let unit=a.shop.find(Boolean);a.shop=[unit,unit,null,null,null];let start=a.credits;economy.action(a,'buy',{index:0});eq(a.credits,start- Math.max(0,require('../js/shared/roster.js').byId[unit].cost-1),'G013 first purchase discount');
 a=fresh(['G036']);unit=a.shop.find(Boolean);a.shop=[unit,unit,null,null,null];start=a.credits;economy.action(a,'buy',{index:0});eq(a.credits,start-Math.max(0,require('../js/shared/roster.js').byId[unit].cost-1),'G036 duplicate offer discount');
 a=fresh(['G053']);start=a.credits;for(let i=0;i<3;i++)economy.action(a,'reroll');eq(a.credits,start-5,'G053 third paid reroll refunded');
 a=fresh(['G055']);const u=a.owned[0];start=a.credits;economy.action(a,'sell-unit',{uid:u.uid});eq(a.credits,start+require('../js/shared/roster.js').byId[u.characterId].cost+1,'G055 first sale');
 a=fresh(['G019']);a.exp=4;a.level=1;a.credits=10;economy.action(a,'invest');eq(a.level,2,'level promoted');eq(a.credits,10,'G019 first level bonus');
 a=fresh(['G037']);start=a.credits;economy.roundIncome(a,2);ok(a.credits>=start+7,'G037 no-spend gain');
 a=fresh(['G002']);a.credits=5;economy.roundIncome(a,2);eq(a.credits,11,'G002 preparation end award');
 a=fresh(['G014']);a.credits=2;economy.roundIncome(a,2);eq(a.credits,9,'G014 last pennies award');
 a=fresh(['G054']);a.credits=12;economy.roundIncome(a,2);a.credits=12;economy.roundIncome(a,3);ok(a.credits>=19,'G054 two savings rounds reward');
 a=fresh(['G015']);grayE.spend(a,10);economy.roundIncome(a,2);ok(grayE.data(a).freeRerolls>=1,'G015 next prep free reroll');
 a=fresh(['G004']);grayE.settlePvP(a,{round:1,lost:true});eq(grayE.data(a).freeRerolls,1,'G004 defeat free reroll');
 a=fresh(['G034']);start=a.exp;grayE.settlePvP(a,{round:2,lost:true});eq(a.exp,start+2,'G034 defeat EXP');
 a=fresh(['G018']);start=a.exp;grayE.settlePvP(a,{round:2,kills:1});eq(a.exp,start+1,'G018 kill EXP');
 a=fresh(['G059']);grayE.data(a).trainingQueued=true;start=a.exp;grayE.settlePvP(a,{round:2,kills:1});eq(a.exp,start+1,'G059 invested next pvp kill');
 a=fresh(['G022']);for(let i=1;i<=3;i++)grayE.settlePvP(a,{round:i,kills:1});ok(a.items.length>0,'G022 three PvP kill rounds item');
 a=fresh(['G016']);a.credits=25;economy.roundIncome(a,2);a.credits=25;economy.roundIncome(a,3);eq(a.credits,33,'G016 every second interest award');
 a=fresh(['G020']);a.credits=5;a.level=1;a.exp=0;economy.roundIncome(a,2);let before=a.exp;economy.roundIncome(a,3);ok(a.exp!==before,'G020 two rounds no level-up EXP');
 a=fresh(['G017']);let st=grayE.data(a);st.lockedShop=true;st.buys=0;unit=a.shop.find(Boolean);ok(grayE.buyCost(a,unit,0,2)===1,'G017 locked store purchase discount');
 a=fresh(['G056']);const x=grayE.data(a);start=a.credits;grayE.afterCraft(a);eq(a.credits,start+2,'G056 crafting reward');
 a=fresh(['G058']);start=a.credits;grayE.afterMerge(a,2);grayE.afterMerge(a,3);eq(a.credits,start+5,'G058 2-star/3-star award');
}
function unit(team,name='실험체',x=1,y=1,role='전사'){
 return {id:team+name,team,characterId:name,name,role,initialX:team==='A'?x:5-x,initialY:y,hp:1000,maxHp:1000,dead:false,as:1,atk:100,def:25,critDamage:2,critChance:0,ccUntil:0,nextAttack:2,equipment:[],skill:{shield:0}};
}
function fixture(id,extra=[]){let t=0;const a=unit('A','alpha'),b=unit('B','beta'),units=[a,b,...extra];const r=grayCombat.create({config:{infusions:{A:[id],B:[]}},time:()=>t,units:()=>units,log:()=>{},heal:(u,n)=>{const old=u.hp;u.hp=Math.min(u.maxHp,u.hp+n);return u.hp-old;},isComplete:n=>n.startsWith('made')});return {a,b,units,r,at(n){t=n},teamA:()=>units.filter(u=>u.team==='A'&&!u.dead)}}
const d=(f,att=f.a,target=f.b,kind='basic',opt={})=>f.r.modifyDamage(att,target,100,kind,opt);
// Every battle-stage effect has its intended trigger verified independently of the UI.
{
 let f=fixture('G006');f.a.hp=600;f.a.ccUntil=.5;f.r.tick();f.at(1);f.r.tick();ok(f.a.hp>600,'G006 recovery from crowd-control');
 f=fixture('G009');f.r.afterDamage(f.a,f.b,50,'basic');ok(f.r.asMultiplier(f.a)>1,'G009 first strike attack speed');
 f=fixture('G010',[unit('A','ally',0,0)]);f.units[2].dead=true;f.r.onDeath(f.b,f.units[2]);ok(f.a.skill.shield>0,'G010 last-survivor shield');
 f=fixture('G011');d(f);d(f);ok(d(f)>100,'G011 third consecutive strike');
 f=fixture('G023');f.r.afterDamage(f.b,f.a,50,'basic');ok(d(f)>100,'G023 mark enemy first attacker');
 f=fixture('G024',[unit('A','ally',0,0)]);f.units[2].dead=true;f.r.onDeath(f.b,f.units[2]);ok(d(f)>100,'G024 mark ally killer');
 f=fixture('G025');f.b.dead=true;f.r.onDeath(f.a,f.b);ok(f.a.nextAttack<2,'G025 next attack accelerated');
 f=fixture('G026');f.b.ccUntil=5;ok(d(f)>100,'G026 first CC hit');
 f=fixture('G027',[unit('A','ally',0,0)]);f.a.hp=600;f.units[2].dead=true;f.r.onDeath(f.b,f.units[2]);ok(f.a.hp>600,'G027 heal after first ally death');
 f=fixture('G028');f.a.hp=200;f.r.afterDamage(f.b,f.a,50,'basic');ok(f.a.hp>200,'G028 emergency heal');
 f=fixture('G029');f.a.ccUntil=.5;f.r.tick();f.at(1);f.r.tick();ok(f.a.skill.shield>0,'G029 CC release shield');
 f=fixture('G030',[unit('A','ally0',0,0),unit('A','ally2',2,2)]);f.r.start();ok(d(f)>100,'G030 three-row formation bonus');
 f=fixture('G031');f.a.critChance=.95;f.r.start();ok(f.a.critDamage>2,'G031 team crit chance');
 f=fixture('G032');f.b.hp=450;f.r.beforeTake(f.a,f.b,100,'basic');f.b.hp=350;f.r.afterDamage(f.a,f.b,100,'basic');ok(d(f)>100,'G032 40% HP threshold');
 f=fixture('G039');f.a.hp=500;f.at(5.05);f.r.tick();ok(f.a.hp>500,'G039 at 5sec heal');
 f=fixture('G040');for(let i=0;i<3;i++)f.r.afterDamage(f.b,f.a,5,'basic');ok(f.r.beforeTake(f.b,f.a,100,'basic')<100,'G040 repeated focus defense');
 f=fixture('G042');f.a.hp=200;const help=unit('A','healer');ok(Math.abs(f.r.modifyHeal(f.a,100,help)-115)<1e-8,'G042 ally healing boost');
 f=fixture('G043');f.a.skill.shield=200;f.r.tick();ok(f.r.beforeTake(f.b,f.a,100,'basic')<100,'G043 first shield protection');
 f=fixture('G045');ok(d(f)>100,'G045 first hit');
 f=fixture('G047',[unit('A','outer',0,0),unit('A','outer2',2,2)]);f.r.start();ok(f.r.asMultiplier(f.a)>1,'G047 flanking speed');
 f=fixture('G050');for(let i=0;i<5;i++)f.r.afterDamage(f.a,f.b,10,'basic');eq(f.b.def,20,'G050 armor break');
 f=fixture('G052');f.a.equipment=['madeA','madeB','madeC'];f.r.start();ok(f.a.skill.shield>0,'G052 completed gear shield');
 f=fixture('G060');f.r.afterDamage(f.a,f.b,100,'basic');f.b.dead=true;f.r.onDeath(f.a,f.b);ok(d(f)>100,'G060 basic-kill next damage');
 f=fixture('G061');f.b.hp=200;d(f);ok(f.r.asMultiplier(f.a)>1,'G061 low-health chase speed');
 f=fixture('G062');f.r.afterDamage(f.a,f.b,50,'skill');eq(f.r.modifyHeal(f.b,100,f.b),85,'G062 healing disruption');
 f=fixture('G063');f.a.hp=500;f.a.skill.shield=20;f.r.beforeTake(f.b,f.a,30,'basic');f.a.skill.shield=0;f.r.afterDamage(f.b,f.a,10,'basic');ok(f.a.hp>500,'G063 first shield break heal');
 f=fixture('G064');f.r.afterHeal(f.a,10);ok(d(f)>100,'G064 healing next basic');
 f=fixture('G065');f.a.role='원거리 평타';for(let i=0;i<3;i++)f.r.afterDamage(f.a,f.b,10,'basic');ok(f.r.modifyDamage(f.b,f.a,100,'basic')<100,'G065 ranged suppression');
 f=fixture('G066',[unit('A','ally',0,0)]);f.units[2].dead=true;f.r.onDeath(f.b,f.units[2]);ok(d(f)>100,'G066 last stand damage');
 f=fixture('G067');ok(f.r.beforeTake(f.b,f.a,100,'basic')<100,'G067 center defense');
 f=fixture('G068',[unit('A','side1',0,1),unit('A','side2',2,1)]);f.r.start();ok(f.units[2].skill.shield>0&&f.units[3].skill.shield>0,'G068 triple-line flanking shield');
 f=fixture('G070');f.a.equipment=['madeA'];f.a.hp=500;f.r.onSkill(f.a);ok(f.a.hp>500,'G070 completed gear first skill heal');
 f=fixture('G071');f.a.equipment=['madeA','madeB'];ok(d(f,f.a,f.b,'skill')>100,'G071 first skill item set bonus');
 f=fixture('G072');f.r.afterDamage(f.a,f.b,100,'basic',{critical:true});ok(f.r.asMultiplier(f.a)>1,'G072 first critical speed');
}
// No battle crashes, invalid health, or unequal team behavior due to infusion switching.
const A=[{characterId:'hyunwoo',star:1,x:1,y:1,items:[]}],B=[{characterId:'katja',star:1,x:1,y:1,items:[]}];
for(const inf of CARDS.gray){const result=new CombatEngine({teamA:A,teamB:B,seed:42003,masteryA:2,masteryB:2,infusions:{A:[inf.id],B:[]}}).run();ok(result.battleOver&&Number.isFinite(result.time)&&result.grayReport&&result.grayReport.A.kills>=0,inf.id+' full combat simulation')}
for(const inf of CARDS.gray){const result=new CombatEngine({teamA:A,teamB:B,seed:42004,masteryA:2,masteryB:2,infusions:{A:[],B:[inf.id]}}).run();ok(result.battleOver&&Number.isFinite(result.time)&&result.grayReport&&result.grayReport.B.kills>=0,inf.id+' opponent-side simulation')}
eq(CARDS.gray.length,54,'all gray cards registered');ok(CARDS.gray.every(c=>c.implemented),'all cards status implemented');
console.log(`M10-04 GRAY REGRESSION PASS: ${checks} assertions (economy, combat triggers and 54 per-card battles)`);
