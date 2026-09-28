const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
for(const args of [['--check','roster.js'],['--check','combat-engine.js'],['--check','game.js'],['tests/combat.cjs'],['tests/shurin.cjs'],['tests/damage-stats.cjs'],['tests/sandbox.cjs']]){
 if(args[0]==='--check')new vm.Script(fs.readFileSync(path.join(root,args[1]),'utf8'),{filename:args[1]});
 else require(path.join(root,args[0]));
 console.log('PASS '+args.join(' '));
}
