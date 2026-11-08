'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const serverPort=0;
process.env.PORT=String(serverPort);
process.env.LIVE_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'live-m910-qa-'));
const {server,rooms}=require('../server.cjs');
const {CombatEngine}=require('../combat-engine.js');
const aug=require('../match-augment.cjs');
let n=0;const ok=(v,msg)=>{assert.ok(v,msg);n++},eq=(v,w,msg)=>{assert.deepEqual(v,w,msg);n++};
async function main(){
 for(let i=0;i<200&&!server.listening;i++)await new Promise(r=>setTimeout(r,20));ok(server.listening,'M9-10 test server online');
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(route,data={},session='')=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json','x-live-session':session},body:JSON.stringify(data)});return {status:response.status,json:await response.json()}};
 try{
  const us=[];
  for(let i=0;i<3;i++){
   const res=await post('register',{username:'m910roomtest'+i,password:'correct-horse-battery',nickname:'방테스트'+i});eq(res.status,200,'register '+i);us.push(res.json.session);
  }
  const publicRoom=await post('create',{roomName:'친구와 공개 한 판',isPublic:true,maxPlayers:3},us[0]);eq(publicRoom.status,200,'public room created');
  const privateRoom=await post('create',{roomName:'초대 비밀 방',isPublic:false,maxPlayers:2},us[1]);eq(privateRoom.status,200,'private room created');
  const listed=await post('rooms',{},us[2]);eq(listed.status,200,'authenticated room discovery');
  eq(listed.json.rooms.length,1,'list only non-full public waiting room');
  eq(listed.json.rooms[0].name,'친구와 공개 한 판','room title kept');
  eq(listed.json.rooms[0].code,publicRoom.json.room.code,'correct public room code');
  eq((await post('rooms',{})).status,401,'unauthed room list denied');
  const joined=await post('join',{code:publicRoom.json.room.code},us[2]);eq(joined.status,200,'join public room by code');
  const hiddenJoin=await post('join',{code:privateRoom.json.room.code},us[0]);eq(hiddenJoin.status,200,'join private room by code');
  const waitPub=rooms.get(publicRoom.json.room.code);eq(waitPub.players.size,2,'public room player count');
  const listed2=await post('rooms',{},us[2]);eq(listed2.json.rooms[0].playerCount,2,'public list count refreshed');
  const client=read('multiplayer.js'),serverJs=read('server.cjs'),ui=read('game.js'),css=read('m910-polish.css'),html=read('index.html');
  ok(client.includes('liveCopyRoomId')&&client.includes('navigator.clipboard')&&client.includes('livePublicRooms')&&client.includes('data-public-join'),'copy + public browse UI');
  eq(serverJs.match(/if\(url\.pathname==='\/api\/rooms'\)/g).length,1,'no duplicated /api/rooms route');
  ok(ui.includes('m910ShopFocus.size>=3')&&ui.includes('live_m910_shop_focus')&&ui.includes('m910FocusMatches(r)'),'favorite synergies max three persistence and highlighting');
  ok(ui.includes('shop-meta-label')&&css.includes('.shop-synergies{position:static'),'synergy tags below role outside portraits');
  ok(ui.includes('headCenterX')&&ui.includes('normalizePortraitImage'),'portrait forehead-based alignment heuristic');
  ok(ui.includes('data-infusion-id')&&ui.includes("e.key==='Shift'")&&ui.includes('m910-detailed'),'shift hover infusion details');
  ok(ui.includes('m910-collapsed')&&ui.includes('data-m910-collapse'),'collapsible infusion picker');
  ok(ui.includes('m910-scout-item')&&ui.includes('m910-scout-synergy')&&ui.includes('itemIconMarkup(name)'),'scout inventory icon and synergy descriptions');
  ok(ui.includes('m910UnitStatusHtml')&&ui.includes('현재 전투 상태')&&ui.includes('적용 인퓨전'),'combat status integrated in character hover');
  ok(ui.includes('m910-selection-crest')&&css.includes('m910-claim-rise'),'selection stage themed animation');
  ok(css.includes('max-width:760px')&&css.includes('max-width:1120px')&&css.includes('prefers-reduced-motion'),'zoom/responsive & reduced motion');
  ok(html.includes('m909-polish.css')&&html.includes('m910-polish.css')&&html.includes('m910-system-language.js'),'new presentation assets load after prior patch');
  for(const stable of ['m902-download','m904StarBadge','m905-codex-detail','m909-infusion-text.js'])ok(ui.includes(stable)||html.includes(stable),'M9-09 feature preserved '+stable);
  const g={};vm.runInNewContext(read('m909-infusion-text.js'),{globalThis:g});vm.runInNewContext(read('m910-system-language.js'),{globalThis:g});
  const blue=aug.CARDS.blue,purple=aug.CARDS.purple;eq(blue.length,31,'blue infusion count');eq(purple.length,46,'purple infusion count');
  for(const c of [...blue,...purple]){
   const detail=g.LIVEFormalText.infusion(c);ok(detail.length>=50,'complete infusion description '+c.id);
   for(const line of detail.split(/(?<=[.!?])\s+/))if(/[가-힣][.!?]$/.test(line))ok(/(?:니다|세요)[.!?]$/.test(line),'formal system sentence '+c.id+': '+line);
  }
  const a=[{characterId:'marcus',ownedId:'first',star:1,x:0,y:0,items:[]},{characterId:'kenneth',ownedId:'second',star:1,x:1,y:1,items:[]},{characterId:'cathy',ownedId:'third',star:1,x:0,y:2,items:[]}];
  const b=[{characterId:'aya',star:1,x:0,y:1,items:[]},{characterId:'rio',star:1,x:1,y:0,items:[]},{characterId:'alex',star:1,x:1,y:2,items:[]}];
  for(const target of ['A:marcus:first','A:kenneth:second','A:cathy:third']){
   const eng=new CombatEngine({teamA:a,teamB:b,augmentsA:['P43'],purpleChoices:{A:{baitId:target}},round:16,seed:7331});eng.start();const result=eng.getResult().units.filter(u=>u.team==='A');
   eq(result.filter(u=>u.purple?.bait?.until===10).map(u=>u.id),[target],'P43 selected ally exactly one '+target);
  }
  // Server pair simulation uses team B even though its UI always submits A:character:uid.
  const bOwned=b.map((u,i)=>({...u,ownedId:['b-one','b-two','b-three'][i]}));
  const otherSide=new CombatEngine({teamA:a,teamB:bOwned,augmentsB:['P43'],purpleChoices:{B:{baitId:'A:rio:b-two'}},round:16,seed:7331});otherSide.start();
  eq(otherSide.getResult().units.filter(u=>u.team==='B'&&u.purple?.bait?.until===10).map(u=>u.id),['B:rio:b-two'],'P43 local A prefix maps to actual B team correctly');
  const starSide=new CombatEngine({teamA:a,teamB:bOwned,augmentsB:['P02'],purpleChoices:{B:{transcendId:'A:rio:b-two'}},round:16,seed:7331});starSide.start();
  eq(starSide.getResult().units.filter(u=>u.team==='B'&&u.purple?.transcend?.active).map(u=>u.id),['B:rio:b-two'],'P02 local A prefix maps to actual B team correctly');
  const dice=new CombatEngine({teamA:a,teamB:b,augmentsA:['P07'],round:16,seed:2027});dice.run();const diceEvents=dice.drainEvents().filter(e=>e.type==='augment'&&e.id==='P07');ok(diceEvents.length>=1,'dice generates battle event');ok(diceEvents.every(e=>/신의 주사위: (적 전체 피해|아군 전체 회복|아군 전체 보호막|적 전체 행동불능|아군 피해량 증가|아군 부활 또는 보호막)/.test(e.detail)),'dice outcome displayed by effect name');
  ok(ui.includes('if(event?.id!==\'P07\'')&&ui.includes('m910DiceResult'),'dice-only notification preserved');
  console.log('M9-10 QA PASS:',n,'assertions; public/private lobby, P43 chosen ally, P07 result, terminology, shop, scouting, old animations.');
 }finally{rooms.clear();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);server.closeAllConnections();server.close();process.exit(1)});
