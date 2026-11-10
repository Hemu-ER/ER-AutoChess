'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const globals={LIVEFormalText:{formal:text=>text.replace(/해(?=[.!?]|$)/g,'합니다').replace(/늘어나(?=[.!?]|$)/g,'늘어납니다')}};
const sandbox={globalThis:globals,document:{readyState:'loading',addEventListener(){}},MutationObserver:class{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../m1007-client.js'),'utf8'),sandbox);
const {terms,polite,summary}=globals.LIVEM1007;
const tests=[
 ['2행에 위치','2번째 가로줄에 위치'],['3열에 위치','3번째 세로줄에 위치'],
 ['가로로 2행','가로로 2번째 가로줄'],['전열에 있어','전열에 있어'],
 ['행동 불능','행동 불능'],['열정적인 연구','열정적인 연구'],
];for(const [v,w] of tests)assert.equal(terms(v),w);
assert(polite('피해.')==='피해 · 효과는 조건에 따라 적용됩니다.');
assert(polite('적에게 30% 추가 피해.').includes('추가 피해 · 효과는'));
assert(polite('회복해.').includes('회복합니다.'));
assert.notEqual(summary({description:'피해가 발생할 때 +1C 획득. 자세한 조건은 3초마다'},'전체 상세'), '전체 상세');
console.log('M10-07 Korean UI language QA PASS',tests.length+4,'checks');
