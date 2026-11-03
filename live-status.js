/* Display-only accuracy state and elapsed-time gauge. No fix/record/cache changes. */
'use strict';
(()=>{
const STALE_MS=15000,GAUGE_MS=30*60*1000;
let openedAt=null;
const ageLabel=document.createElement('small');ageLabel.id='liveFixAge';ageLabel.textContent='';$('liveAccuracy').after(ageLabel);
$('liveAccuracy').title='Geolocation APIの推定水平位置精度。衛星受信強度ではありません。';
const gauge=document.createElement('div');gauge.id='nelGauge';gauge.setAttribute('role','img');gauge.innerHTML='<span id="nelElapsed">経過 00:00</span><div class="nel-track"><div class="nel-line"></div><span id="nelMonkey" aria-hidden="true">🐒</span><div class="nel-scale" aria-hidden="true"><span>0分</span><span>15分</span><span>30分</span></div></div><span class="nel-sleep" aria-hidden="true">💤</span>';$('liveView').append(gauge);
gauge.title='測位画面を開いてからの経過時間。実際の画面消灯までの残り時間ではありません。';
function refresh(){const now=Date.now(),p=liveFix;const age=p&&Number.isFinite(p.t)&&Number.isFinite(latestReceived)?Math.max(0,now-p.t,now-latestReceived):null;const fresh=screen==='live'&&p&&!liveProblem&&age!==null&&age<STALE_MS&&Number.isFinite(p.acc)&&p.acc>=0;let state='waiting',name='測位待ち';if(fresh){if(p.acc<=5){state='good';name='良好';}else if(p.acc<=10){state='normal';name='普通';}else if(p.acc<=30){state='caution';name='注意';}else{state='unstable';name='不安定';}}const accuracy=$('liveAccuracy');accuracy.dataset.gpsState=state;accuracy.setAttribute('aria-label',name+(p?'、最終の推定水平位置精度±'+p.acc+'メートル':''));ageLabel.textContent=age===null?'待ち':Math.floor(age/1000)+'秒前';ageLabel.title='最終測位からの経過時間（取得日時と受信日時の古い方を基準）';if(!fresh){$('liveSpeed').textContent='-- km/h';if(age!==null&&age>=STALE_MS&&!liveProblem)$('captureState').textContent='測位更新待ち';}const elapsed=screen==='live'&&openedAt!==null?Math.max(0,now-openedAt):0;const progress=Math.min(1,elapsed/GAUGE_MS);gauge.style.setProperty('--nel-progress',String(progress));const seconds=Math.floor(elapsed/1000);$('nelElapsed').textContent='経過 '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');gauge.setAttribute('aria-label',`測位画面を開いてから${Math.floor(seconds/60)}分${seconds%60}秒。ゲージは0〜30分。画面消灯の残り時間ではありません。`);}
const previousRender=renderLiveControls;renderLiveControls=function(){previousRender();refresh();};
const previousEnter=enterLive;enterLive=function(){const wasLive=screen==='live';previousEnter();if(!wasLive&&screen==='live')openedAt=Date.now();refresh();};$('enterLive').onclick=enterLive;
const note=document.createElement('p');note.textContent='精度色：5m以内 緑／10m以内 黄／30m以内 橙／超過 赤。15秒以上更新がない場合や取得エラー時は灰色。数字は最後のAPI推定値です。🐒は測位画面の経過時間0〜30分で、スリープまでの残り時間ではありません。画面維持の状態は別表示です。';$('helpMenu').querySelector('.menu-body').append(note);
refresh();
})();
