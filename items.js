"use strict";
// L.I.V.E. 아이템 정본 2026-10-07 + M0 후속 확정 규칙
(function(root){
 const basics=[['검집',{atk:10}],['금팔찌',{amp:15}],['방탄 조끼',{hp:100}],['사슬 갑옷',{def:10}],['화살통',{as:.10}],['전자 부품',{crit:.10}],['철사',{penFlat:8}]];
 const recipes=[
 ['오토-암즈',0,0,{atk:25}],['블레이드 부츠',0,1,{atk:10,amp:35}],['스펙터',0,2,{atk:20,hp:150}],['아오자이',0,3,{atk:20,def:20}],['미스릴 퀴버',0,4,{atk:15,as:.20}],['레이더',0,5,{atk:10,crit:.20,as:.20}],['서슬가시 체인',0,6,{atk:20,penFlat:15}],
 ['임세티',1,1,{amp:40}],['레버넌트',1,2,{amp:35,hp:150}],['요명월',1,3,{amp:30,def:20}],['텔루리안 타임피스',1,4,{amp:30,as:.20}],['천룡잠',1,5,{amp:25,crit:.20}],['용의 비늘',1,6,{amp:30,penFlat:15}],
 ['미스릴 크롭',2,2,{hp:400}],['배틀 슈트',2,3,{hp:250,def:20}],['팬텀 자켓',2,4,{hp:200,as:.20}],['타이탄 아머',2,5,{hp:200,crit:.20}],['유령 신부의 드레스',2,6,{hp:200,penFlat:15}],
 ['가디언 슈트',3,3,{def:40}],['길리 슈트',3,4,{def:20,as:.20}],['화령장',3,5,{def:20,crit:.20}],['슈팅스타의 자켓',3,6,{def:20,penFlat:15}],
 ['살라딘의 화살통',4,4,{as:.40}],['레가투스',4,5,{as:.20,crit:.40}],['블래스터 헬멧',4,6,{as:.30,penFlat:15}],
 ['운명의 주사위',5,5,{crit:.40}],['프시케의 칼날',5,6,{crit:.20,penFlat:20}],['아이언 메이든',6,6,{penFlat:30}]
 ];
 const baseNames=basics.map(x=>x[0]);const all={};basics.forEach(([name,stats])=>all[name]={name,basic:true,stats,effectId:null});
 const recipeMap={};const key=(a,b)=>[a,b].sort().join('|');
 recipes.forEach(([name,a,b,stats])=>{all[name]={name,basic:false,stats,effectId:name,materials:[baseNames[a],baseNames[b]]};recipeMap[key(baseNames[a],baseNames[b])]=name});
 // Blood Moon keys serialize the absorbed stats, so each copy remains independent across inventory/equipment/network.
 const BLOOD='혈색반월';const STAT_KEYS=['hp','atk','amp','def','as','crit','penFlat'];
 function bloodInfo(name){if(name===BLOOD)return {level:0,stats:{}};const m=/^혈색반월\+(\d+)~([a-zA-Z0-9_=.,-]+)$/.exec(name||'');if(!m||!Number.isSafeInteger(+m[1]))return null;const stats={};for(const pair of m[2].split(',')){const [k,v]=pair.split('=');if(!STAT_KEYS.includes(k)||!Number.isFinite(+v)||+v<0||+v>100000||k in stats)return null;stats[k]=+v}return {level:+m[1],stats}}
 const bloodItem=name=>{const info=bloodInfo(name);return info?{name,basic:false,stats:info.stats,effectId:'혈색반월',bloodMoon:true}:null};
 all[BLOOD]=bloodItem(BLOOD);
 const db=new Proxy(all,{get(obj,k){if(typeof k!=='string')return obj[k];return obj[k]||(k.startsWith(BLOOD)?bloodItem(k):null)}});
 function makeBlood(info){const stats=Object.entries(info.stats).filter(([,v])=>v>1e-9).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${+v.toFixed(6)}`).join(',')||'atk=0';return `${BLOOD}+${info.level}~${stats}`}
 const displayName=name=>{const b=bloodInfo(name);return b?`${BLOOD} +${b.level}`:name};
 const craft=(a,b)=>{const ba=bloodInfo(a),bb=bloodInfo(b);if(ba||bb){if(ba&&bb)return null;const info=ba||bb,other=db[ba?b:a];if(!other||other.bloodMoon)return null;const stats={...info.stats};for(const [k,v]of Object.entries(other.stats||{}))stats[k]=(stats[k]||0)+v*.5;return makeBlood({level:info.level+1,stats})}return recipeMap[key(a,b)]||null};
 const api={baseNames,all:db,craft,recipes,bloodInfo,displayName};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LIVEItems=api;
})(typeof globalThis!=='undefined'?globalThis:this);
