/* Experimental GPS-course display only. Never modifies fixes or track data. */
(()=>{
'use strict';
let mode='north',stable=null,displayed=0,target=0,frame=null,lastFrame=null;
const SPEED_MIN=2,ACCURACY_MAX=50,DEADBAND=4;
const delta=(from,to)=>((to-from+540)%360+360)%360-180;
const normalize=n=>((n%360)+360)%360;
const button=document.createElement('button');button.id='orientationToggle';button.type='button';button.textContent='N';button.hidden=true;button.setAttribute('aria-label','北固定。タップでGPS進行方向を上にする');button.setAttribute('aria-pressed','false');document.querySelector('.maptools').append(button);
function label(){button.textContent=mode==='north'?'N':'↑';button.setAttribute('aria-pressed',String(mode==='heading'));button.setAttribute('aria-label',mode==='north'?'北固定。タップでGPS進行方向を上にする':'GPS進行方向が上。タップで北固定に戻す');button.title=mode==='north'?'北固定':stable===null?'進行方向待ち（GPS・速度2m/s以上・accuracy50m以内）':'GPS進行方向が上';}
function animate(now){frame=null;if(mode!=='heading')return;const dt=lastFrame===null?16:Math.min(64,Math.max(1,now-lastFrame));lastFrame=now;const diff=delta(displayed,target),tau=Math.abs(diff)>=60?150:220;displayed+=diff*(1-Math.exp(-dt/tau));if(Math.abs(delta(displayed,target))<.15){displayed+=delta(displayed,target);lastFrame=null;}else frame=requestAnimationFrame(animate);if(typeof draw==='function')draw();}
function moveTo(heading){target=normalize(heading);if(frame===null){lastFrame=null;frame=requestAnimationFrame(animate);}}
function observe(pos){const c=pos.coords;if(!Number.isFinite(c.heading)||c.heading<0||c.heading>=360||!Number.isFinite(c.speed)||c.speed<SPEED_MIN||!Number.isFinite(c.accuracy)||c.accuracy>ACCURACY_MAX)return;const h=normalize(c.heading);if(stable===null||Math.abs(delta(stable,h))>=DEADBAND){stable=h;if(mode==='heading')moveTo(stable);}label();}
function setMode(next){mode=next==='heading'?'heading':'north';if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=null;if(mode==='north'){displayed=0;target=0;}else if(stable!==null)moveTo(stable);label();if(typeof draw==='function')draw();}
button.onclick=()=>setMode(mode==='north'?'heading':'north');
window.DRIVEN_ORIENTATION={observe,setMode,angle:()=>mode==='heading'?displayed:0,visibility(view){button.hidden=view!=='live';},dragDelta(x,y){const live=typeof screen!=='undefined'&&screen==='live',a=live&&mode==='heading'?displayed*Math.PI/180:0;return{x:Math.cos(a)*x-Math.sin(a)*y,y:Math.sin(a)*x+Math.cos(a)*y};},state:()=>({mode,stable,displayed,target})};
})();
