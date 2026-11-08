"""Optional QA: requires Python Playwright and installed Chromium; Pixi API is simulated because public CDN is unavailable offline."""
from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parent.parent
pixi_stub=r'''(() => {
class Base {constructor(){this.children=[]; this.width=100; this.height=100; this.destroyed=false; this.position={set:(...p)=>{this.pos=p}};this.anchor={set:()=>{}};this.scale={set:()=>{}};this.handlers={};}
 addChild(...a){this.children.push(...a); return a.at(-1)} removeChildren(){return this.children.splice(0)} destroy(){this.destroyed=true;this.children=[]}
 on(k,v){this.handlers[k]=v;return this}}
class Graphics extends Base {roundRect(x,y,w,h){this.width=w;this.height=h;return this} rect(x,y,w,h){this.width=w;this.height=h;return this} moveTo(){return this} lineTo(){return this} stroke(){return this} fill(){return this}}
class Container extends Base { }
class Sprite extends Base {constructor(t){super();this.texture=t}}
class Text extends Base {constructor(o){super();this.text=o.text;this.style=o.style}}
class Application {constructor(){this.stage=new Container();this.canvas=document.createElement('canvas');this.renderer={width:100,height:100,resize:(w,h)=>{this.renderer.width=w;this.renderer.height=h}};window.__lastApp=this;}
 async init(options){this.renderer.width=options.width;this.renderer.height=options.height;}
 destroy(){this.stage.destroy();this.canvas.remove()}}
window.PIXI={Graphics,Container,Sprite,Text,Application,Rectangle:class{constructor(x,y,w,h){Object.assign(this,{x,y,w,h})}},Texture:{EMPTY:{width:1,height:1}},Assets:{load:async()=>({width:832,height:1216})}};
})();'''
html='''<html><head><style>.dock-shop{display:grid}.dock-center{width:820px}#gameBottomDock{width:980px}.game-bottom-dock{width:980px}body{background:#141c27;color:#ddd}</style></head>
<body data-app-mode="game"><section id="gameBottomDock"><div class="dock-center"><div class="dock-shop"><button>기존 구매</button></div><div class="bench-zone">기존 벤치</div></div></section></body></html>'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={"width":1440,"height":900}); errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=(root/'m1001-research-ui.css').read_text())
 page.evaluate(pixi_stub)
 page.evaluate('''window.__buy=[];window.LIVEM10Bridge={snapshot:()=>({mode:'game',phase:'prep',round:2,credits:10,shopLocked:false,offers:Array.from({length:5},(_,i)=>({index:i,name:'수아',role:'전사',cost:i+1,portrait:'assets/characters/sua.png',affiliations:['실험체'],focused:i===0,owned:1}))}),buy:i=>window.__buy.push(i)}''')
 page.add_script_tag(content=(root/'m1001-research-ui.js').read_text())
 page.wait_for_selector('#m1001ModeToggle')
 assert page.locator('#m1001CanvasMount').count()==0
 assert page.locator('.dock-shop').first.is_visible()
 page.locator('#m1001ModeToggle').click(); page.wait_for_selector('#m1001CanvasMount canvas')
 assert page.locator('body.m1001-active').count()==1
 assert page.locator('#gameBottomDock .dock-center > .dock-shop').is_hidden()
 assert page.locator('.m1001-sell-zone.dock-shop').is_visible()
 assert page.locator('.m1001-screen-reader button').count()==5
 page.evaluate("document.querySelectorAll('.m1001-screen-reader button')[2].click()")
 assert page.evaluate('window.__buy')==[2]
 # Render destroy/recreate does not destroy canvas or lose the user option.
 page.evaluate("document.querySelector('.dock-center').innerHTML='<div class=\"dock-shop\"><button>old</button></div><div class=\"bench-zone\">bench</div>';window.dispatchEvent(new Event('live:m10:economy'))")
 page.wait_for_selector('#m1001CanvasMount canvas')
 assert page.locator('.m1001-sell-zone.dock-shop').is_visible()
 assert page.locator('body.m1001-active').count()==1
 page.locator('#m1001ModeToggle').click();page.wait_for_timeout(60)
 assert page.locator('#m1001CanvasMount').count()==0
 assert page.locator('.dock-center > .dock-shop').is_visible()
 assert not errors,errors
 # Separate failure path: if the renderer is missing, the original shop stays operable.
 bare=browser.new_page(viewport={"width":1100,"height":850})
 bare.set_content(html);bare.add_style_tag(content=(root/'m1001-research-ui.css').read_text())
 bare.evaluate("window.LIVEM10Bridge={snapshot:()=>({}),buy:()=>{}}")
 bare.add_script_tag(content=(root/'m1001-research-ui.js').read_text())
 bare.locator('#m1001ModeToggle').click();bare.wait_for_timeout(100)
 assert bare.locator('.dock-center > .dock-shop').is_visible()
 assert bare.locator('#m1001CanvasMount').count()==0
 bare.close()
 print('M10-01 browser mock PASS: opt-in, 5 accessible cards, delegated buy, rerender remount, sell target, fallback; no JS errors')
 browser.close()
