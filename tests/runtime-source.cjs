const fs=require('node:fs'),path=require('node:path');
module.exports=()=>{
 const root=path.join(__dirname,'..');
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const ui=read('game.js');
 const meterFunctions=ui.slice(ui.indexOf('function htmlEscape'),ui.indexOf('function config'))+ui.slice(ui.indexOf('function damageDetails'),ui.indexOf('function sync'));
 return read('roster.js')+'\n'+read('combat-engine.js')+'\n'+read('tests/legacy-adapter.js')+'\n'+meterFunctions;
};
