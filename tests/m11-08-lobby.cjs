'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('js/client/multiplayer.js'),html=read('index.html'),css=read('css/m11-main-lobby.css');
const gateMarkup=js.split('gate.innerHTML=`')[1].split('`;document.body.appendChild(gate)')[0];
const ids=[...gateMarkup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'unique gate IDs');
for(const id of ['researchMatches','researchWins','researchHistory','m11CardFinish','idDisplayName','liveAccount','liveNickname','liveNicknameSave','liveLogout','m11Create','m11Join','m11Home','m11Browse','m1009CreatePanel','m1009BrowsePanel','liveWaiting'])assert(ids.includes(id),id);
const home=gateMarkup.split('<div class="m11-home-grid">')[1].split('<section class="m11-panel m11-work"')[0];
assert(home.indexOf('m11-profile')<home.indexOf('m11-record')&&home.indexOf('m11-record')<home.indexOf('m1108-subject')&&home.indexOf('m1108-subject')<home.indexOf('m11Create'));
assert(home.includes('<details class="m1108-profile-edit">'));assert(home.includes('assets/characters/aya.webp'));assert(fs.existsSync(path.join(root,'assets/characters/aya.webp')));assert(fs.existsSync(path.join(root,'assets/backgrounds/common-r6.webp')));
assert(html.indexOf('css/m11-lobby-preview.css')<html.indexOf('css/m11-main-lobby.css'));assert(html.indexOf('css/m11-main-lobby.css')<html.indexOf('js/client/multiplayer.js'));
assert(css.includes('grid-template-columns:minmax(220px'));assert(css.includes('@media(max-width:720px)'));
for(const m of css.matchAll(/#liveGate[^{}]*/g))assert(m[0].startsWith('#liveGate[data-screen="rooms"][data-page="home"]'),`unscoped CSS: ${m[0]}`);
function node(){return {dataset:{},children:[],textContent:'',value:'',append(...n){this.children.push(...n)},replaceChildren(){this.children=[]},get childElementCount(){return this.children.length}}}
const nodes=Object.fromEntries(ids.map(id=>['#'+id,node()])),gate={dataset:{}};
const context=vm.createContext({$:s=>{assert(nodes[s],s);return nodes[s]},gate,document:{createElement:node},Date});
const painter=js.slice(js.indexOf('  const finishes='),js.indexOf('  function setIdentity('));
vm.runInContext(painter,context);
function paint(data){context.data=data;vm.runInContext('paintProfile(data)',context)}
paint({finish:'gold',matches:17,wins:8,recent:['win','loss','draw','win'].map(outcome=>({outcome,endedAt:1700000000000}))});
assert.equal(gate.dataset.finish,'gold');assert.equal(nodes['#m11CardFinish'].value,'gold');assert.equal(nodes['#researchMatches'].textContent,17);assert.equal(nodes['#researchWins'].textContent,8);
assert.deepEqual(nodes['#researchHistory'].children.map(n=>n.children[1].textContent),['승리','패배','무승부']);assert.deepEqual(nodes['#researchHistory'].children.map(n=>n.children[1].dataset.outcome),['win','loss','draw']);
paint({finish:'invalid',matches:0,wins:0,recent:[]});assert.equal(gate.dataset.finish,'cyan');assert.equal(nodes['#researchHistory'].children[0].textContent,'아직 완료한 실험이 없습니다.');
assert(js.includes("api('profile-finish',{finish})"));assert(js.includes("api('profile-finish',{finish:local,migrate:true})"));assert(js.includes("api('profile').then"));
const calls=[];context.m11Page=p=>calls.push(p);context.showRoomTab=p=>calls.push('tab:'+p);vm.runInContext(js.split("  $('#m11Home').onclick=")[1].split('\n')[0].replace(/^/,"$('#m11Home').onclick="),context);
nodes['#m11Create'].onclick();nodes['#m11Join'].onclick();nodes['#m11Home'].onclick();assert.deepEqual(calls,['create','tab:create','browse','tab:browse','home']);
console.log('M11-08 LOBBY PASS: unique IDs, scoped CSS, assets, profile rendering, empty history, room navigation wiring (DOM stub; no browser layout)');
