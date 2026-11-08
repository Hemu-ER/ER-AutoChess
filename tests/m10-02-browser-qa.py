"""Browser integration with mocked Pixi 8 API, no CDN/network necessary.
Tests mount, delegated actions, phase change, toggle, and Pixi availability fallback.
This does NOT establish rendered WebGL fidelity.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
stub=r'''(() => {
class Base {
 constructor(){this.children=[];this.destroyed=false;this.position={set:(x,y)=>{this.x=x;this.y=y}};this.scale={set:(x,y)=>{this.sx=x;this.sy=y??x}};this.anchor={set:(x,y)=>{this.ax=x;this.ay=y??x}};this.handlers={};this.width=100;this.height=100;}
 addChild(...a){this.children.push(...a);return a.at(-1)}
 removeChildren(){const a=this.children;this.children=[];return a}
 destroy(){this.destroyed=true;this.children=[]}
 on(k,fn){this.handlers[k]=fn;return this}
}
class Graphics extends Base{
 roundRect(x,y,w,h){this.width=w;this.height=h;return this}
 rect(x,y,w,h){this.width=w;this.height=h;return this}
 moveTo(){return this} lineTo(){return this} stroke(){return this} fill(){return this}
}
class Container extends Base{}
class Text extends Base{constructor(o){super();this.text=o.text;this.style=o.style}}
class Sprite extends Base{constructor(tex){super();this.texture=tex}}
class Application{constructor(){this.stage=new Container();this.renderer={width:1600,height:900,resize:(w,h)=>{this.renderer.width=w;this.renderer.height=h}};this.canvas=document.createElement('canvas');window.__lastPrepApp=this}
 async init(o){this.renderer.resize(o.width,o.height)}
 destroy(){this.canvas.remove();this.stage.destroy()}}
window.PIXI={Graphics,Container,Text,Sprite,Application,Texture:{EMPTY:{width:1,height:1}},
 Rectangle:class{constructor(x,y,w,h){Object.assign(this,{x,y,w,h})}},Assets:{load:async(path)=>({width:832,height:1216,path})}};
})();'''
html='''<!doctype html><html><head></head><body data-app-mode="game"><section id="gameBottomDock"><div class="dock-center"><div class="dock-shop"></div></div></section><button id="roundSkip">준비 완료</button></body></html>'''
initial={
 'mode':'game','phase':'prep','round':1,'remaining':51,'hpA':100,'hpB':100,'credits':5,'interest':0,'shopLocked':False,
 'level':1,'exp':0,'expMax':5,'maxUnits':3,'readyAvailable':True,'readyLabel':'준비 완료','message':'',
 'focus':[],'focusOptions':['수영복','전사'],'synergies':[{'name':'전사','count':1}],
 'offers':[{'index':i,'empty':False,'name':f'실험체{i}','role':'전사','portrait':'x.webp','cost':1,'focused':False,'affiliations':['전사']} for i in range(5)],
 'owned':[{'uid':1,'name':'현우','portrait':'x.webp','star':1,'location':'board','role':'전사','affiliations':['전사'],'x':1,'y':1,'hp':950,'atk':72,'def':40,'as':0.75}],
 'formation':[{'uid':1,'name':'현우','portrait':'x.webp','star':1,'location':'board','role':'전사','affiliations':['전사'],'x':1,'y':1}],
 'bench':[],'items':[{'name':'아이템A','raw':'A','icon':'a.webp'}],'schedule':['R2 결투','R3 파밍','R4 결투']
}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':900});errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(root/'m1002-prep-console.css').read_text())
 page.evaluate(stub)
 page.evaluate('''window.__state = %s; window.__actions=[];
 window.LIVEM10PrepBridge={snapshot:()=>window.__state};
 for(const k of ['buy','reroll','lock','invest','place','deploy','recall','sellUnit','equip','craft','sellItem','focus','ready'])
 window.LIVEM10PrepBridge[k]=(...a)=>window.__actions.push([k,...a]);
 window.LIVEM10UI={disable:()=>window.__actions.push(['m1001off'])};
 document.getElementById('roundSkip').onclick=()=>window.__actions.push(['baseReady']);
 ''' % __import__('json').dumps(initial,ensure_ascii=False))
 page.add_script_tag(content=(root/'m1002-prep-console.js').read_text())
 page.wait_for_selector('#m1002PrepMount canvas',timeout=5000,state='attached')
 assert page.locator('body.m1002-prep-active').count()==1
 assert page.evaluate("document.querySelector('#gameBottomDock')!==null")
 assert page.evaluate("window.LIVEM10PrepUI.active")
 # Find Pixi hit object that has a pointertap and invoke through stub. 5 shop buttons wired to buy(index).
 page.evaluate('''() => {
 const all=[];const visit=n=>{all.push(n);(n.children||[]).forEach(visit)}; visit(window.__lastPrepApp.stage);
 window.__sceneNodes=all;const buying=all.filter(n=>n.handlers?.pointertap?.toString().includes("action('buy'"));
 if(buying.length!==5)throw Error('expected 5 live Pixi shop cards, got '+buying.length);
 buying[1].handlers.pointertap();
 }''')
 page.wait_for_timeout(100)
 assert ['buy',1] in page.evaluate('window.__actions')
 # Drag deployed unit from center board cell to upper-left; call the Pixi pointerdown,
 # then browser-level movement/release (the same adapter the real canvas uses).
 page.evaluate('''() => {
 const unit=window.__sceneNodes.find(n=>n.handlers?.pointerdown?.toString().includes("startDrag(kind,id,e)"));
 if(!unit)throw Error('deployed unit should expose a drag pointerdown');
 unit.handlers.pointerdown({button:0,global:{x:705,y:345},stopPropagation(){}});
 window.dispatchEvent(new PointerEvent('pointermove',{clientX:550,clientY:205,bubbles:true}));
 window.dispatchEvent(new PointerEvent('pointerup',{clientX:550,clientY:205,bubbles:true}));
 }''')
 page.wait_for_timeout(80)
 assert ['place',1,0,0] in page.evaluate('window.__actions'),page.evaluate('window.__actions')
 # A tap (no movement) must select an inventory item; tapping a unit then equips it.
 page.evaluate('''() => {
 const all=[];const visit=n=>{all.push(n);(n.children||[]).forEach(visit)};visit(window.__lastPrepApp.stage);
 const draggables=all.filter(n=>n.handlers?.pointerdown);
 if(draggables.length!==2)throw Error('expected board unit + item draggables, got '+draggables.length);
 draggables[1].handlers.pointerdown({button:0,global:{x:1310,y:620},stopPropagation(){}});
 window.dispatchEvent(new PointerEvent('pointerup',{clientX:1310,clientY:620,bubbles:true}));
 draggables[0].handlers.pointerdown({button:0,global:{x:700,y:330},stopPropagation(){}});
 window.dispatchEvent(new PointerEvent('pointerup',{clientX:700,clientY:330,bubbles:true}));
 }''')
 page.wait_for_timeout(60)
 assert ['equip',1,0] in page.evaluate('window.__actions'),page.evaluate('window.__actions')
 # Existing M9 layout remains available when off.
 page.locator('#m1002Toggle').click()
 page.wait_for_timeout(100)
 assert page.locator('#m1002PrepMount').count()==0
 assert not page.evaluate('window.LIVEM10PrepUI.active')
 assert page.locator('#gameBottomDock').count()==1
 # Re-enable, and make sure phase automatically falls back to original during combat.
 page.locator('#m1002Toggle').click()
 page.wait_for_selector('#m1002PrepMount canvas')
 page.evaluate("window.__state.phase='combat';window.dispatchEvent(new Event('live:m10:economy'))")
 page.wait_for_timeout(100)
 assert page.locator('#m1002PrepMount').count()==0
 # A missing Pixi runtime never hides original M9/10 UI.
 blank=browser.new_page(viewport={'width':1300,'height':900})
 blank.set_content(html)
 blank.evaluate('window.LIVEM10PrepBridge={snapshot:()=>({phase:"prep"})}')
 blank.add_script_tag(content=(root/'m1002-prep-console.js').read_text())
 blank.wait_for_timeout(100)
 assert blank.locator('#m1002PrepMount').count()==0
 assert blank.locator('#gameBottomDock').count()==1
 blank.close()
 assert not errors, errors
 print('M10-02 browser mock PASS: mount; five Pixi buying cards; real buy adapter; opt-out fallback; combat auto-unmount; missing Pixi fallback; no page errors')
 browser.close()
