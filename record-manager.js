/* DRIVEN v0.10.4-trial: record management sidecar; never rewrite observation data when naming/classifying. */
'use strict';
const RECORD_META_KEY='DRIVEN_RECORD_META_v1';
const RECORD_CATEGORIES={unclassified:{label:'未分類',color:'#89949d'},rail:{label:'鉄道',color:'#3a91d8'},car:{label:'クルマ',color:'#ed943c'},station:{label:'駅・定点測位',color:'#49b08a'}};
const managementKey=(type,id)=>type+':'+id;
function emptyManagement(){return {format:'driven-record-management',version:1,records:{}};}
function validateManagement(d){
 if(!d||d.format!=='driven-record-management'||d.version!==1||!d.records||typeof d.records!=='object'||Array.isArray(d.records))throw Error('管理情報の形式が不正です');
 for(const [k,v]of Object.entries(d.records)){
  if(!/^(trip|survey):.+/.test(k)||!v||typeof v!=='object'||Array.isArray(v)||!Object.hasOwn(RECORD_CATEGORIES,v.category)||!/^#[0-9a-f]{6}$/i.test(v.color)||typeof v.displayName!=='string'||v.displayName.length>180||!['car','train','walk','other','survey',undefined].includes(v.exportKind))throw Error('管理情報を確認してください');
 }
 return d;
}
function readManagement(){const raw=localStorage.getItem(RECORD_META_KEY);return raw?validateManagement(JSON.parse(raw)):emptyManagement();}
let managementCache=emptyManagement();try{managementCache=readManagement();}catch(error){toast('管理情報を読めません。上書きせず保持します');}
function recordMetaFor(type,id){return managementCache.records[managementKey(type,id)]||null;}
function recordDisplayName(record,type='trip'){return recordMetaFor(type,record.id)?.displayName||record.name||(type==='survey'?'無名地点':'記録');}
function recordCategory(record,type='trip'){return recordMetaFor(type,record.id)?.category||'unclassified';}
function recordCategoryColor(record,type='trip'){return recordMetaFor(type,record.id)?.color||RECORD_CATEGORIES.unclassified.color;}
function storedRows(type){const rows=JSON.parse(localStorage.getItem(type==='trip'?key:SURVEY_KEY)||'[]');if(!Array.isArray(rows))throw Error('保存記録を読めません');return rows;}
function recordRef(type,id){const rows=type==='trip'?trips:getSurveys(),found=rows.filter(t=>t.id===id);if(found.length!==1||typeof id!=='string'||!id)return null;return {type,id,signature:JSON.stringify(found[0])};}
function checkedRecord(ref){
 if(!ref)throw Error('対象の記録を選び直してください');
 const matches=storedRows(ref.type).filter(t=>t.id===ref.id);
 if(matches.length!==1||JSON.stringify(matches[0])!==ref.signature)throw Error('記録が変わりました。対象を選び直してください');
 return matches[0];
}
function saveRecordMeta(ref,patch){
 const record=checkedRecord(ref),data=readManagement(),k=managementKey(ref.type,ref.id),old=data.records[k]||{displayName:record.name||'記録',category:'unclassified',color:RECORD_CATEGORIES.unclassified.color};
 const next={...data,records:{...data.records,[k]:{...old,...patch}}};validateManagement(next);
 localStorage.setItem(RECORD_META_KEY,JSON.stringify(next));managementCache=next;
 refreshTrips();renderSurveys();refreshCurrentInfo();draw();
}
let managedFocus=null,actionTarget=null,editTarget=null,deleteTarget=null;
let visibleSurveyIds=new Set(getSurveys().map(t=>t.id));const knownSurveyIds=new Set(visibleSurveyIds);
function syncSurveyVisibility(){for(const t of getSurveys())if(!knownSurveyIds.has(t.id)){knownSurveyIds.add(t.id);visibleSurveyIds.add(t.id);}}
function originalRecordFile(t){return t.source?.fileName||t.importedFileName||'端末記録／原本名未保持';}
function recordDetails(t,type){return [type==='trip'?originalRecordFile(t):(t.kilometrage||'キロ程未入力'),stamp(t.started),`${(type==='trip'?t.points:t.samples)?.length||0}点`, '識別 '+String(t.id).slice(-8)].join(' · ');}
function setManagedFocus(ref){managedFocus=ref;draw();}
const recordActionsDialog=sheet('recordActionsDialog','記録の操作','<div id="managedRecordTitle"></div><p id="managedRecordDetails" class="mini-note"></p><div class="compact-buttons"><button id="managedRename">名前変更</button><button id="managedCategory">分類・色変更</button><button id="managedDelete" class="danger">削除</button><button id="managedCancel">キャンセル</button></div>');
const recordEditDialog=sheet('recordEditDialog','表示名・分類','<label id="managedNameLabel">表示名<input id="managedName" maxlength="180"></label><div id="managedCategoryFields"><label>分類<select id="managedCategorySelect"></select></label><label>分類色<input id="managedColor" type="color" value="#89949d"></label><button id="managedDefaultColor">分類の標準色に戻す</button><p class="mini-note">色帯は分類用です。地図の軌跡色は変更しません。</p><details><summary>書き出しの種別</summary><label>ファイル名の種別<select id="managedExportKind"><option value="car">クルマ</option><option value="train">列車</option><option value="walk">徒歩</option><option value="survey">測位</option><option value="other">その他</option></select></label></details></div><p id="managedEditDetails" class="mini-note"></p><div class="controls"><button id="managedEditSave" class="primary">保存</button><button id="managedEditCancel">キャンセル</button></div>');
for(const [value,c]of Object.entries(RECORD_CATEGORIES))$('managedCategorySelect').add(new Option(c.label,value));
const recordCandidatesDialog=sheet('recordCandidatesDialog','操作する記録を選択','<p class="mini-note">この場所に重なる記録があります。対象を選んでください。</p><div id="managedCandidates"></div><button id="managedCandidateCancel">キャンセル</button>');
const recordDeleteDialog=sheet('recordDeleteDialog','記録の削除','<p id="managedDeleteQuestion"></p><p id="managedDeleteDetails" class="mini-note"></p><p class="mini-note">DRIVEN内だけを削除します。端末に書き出したGPXファイルは残ります。</p><div class="controls"><button id="managedDeleteConfirm" class="danger">削除する</button><button id="managedDeleteCancel">キャンセル</button></div>');
const managementDialogs=[recordActionsDialog,recordEditDialog,recordCandidatesDialog,recordDeleteDialog];
function clearManagedFocusIfClosed(){if(!managementDialogs.some(d=>d.open)){managedFocus=null;draw();}}
for(const d of managementDialogs)d.addEventListener('close',()=>queueMicrotask(clearManagedFocusIfClosed));
function openRecordActions(ref){
 try{const t=checkedRecord(ref);actionTarget=ref;setManagedFocus(ref);$('managedRecordTitle').textContent=recordDisplayName(t,ref.type);$('managedRecordDetails').textContent=recordDetails(t,ref.type);for(const d of dialogs)if(d.open)d.close();openSheet(recordActionsDialog);}catch(error){toast(error.message);}
}
function openRecordEdit(ref,mode){
 try{const t=checkedRecord(ref);editTarget=ref;setManagedFocus(ref);$('managedName').value=recordDisplayName(t,ref.type);$('managedCategorySelect').value=recordCategory(t,ref.type);$('managedColor').value=recordCategoryColor(t,ref.type);$('managedExportKind').value=recordMetaFor(ref.type,t.id)?.exportKind||(ref.type==='survey'?'survey':t.kind||'other');$('managedNameLabel').hidden=mode!=='name';$('managedCategoryFields').hidden=mode!=='category';recordEditDialog.querySelector('h2').textContent=mode==='name'?'名前変更':'分類・色変更';recordEditDialog.dataset.mode=mode;$('managedEditDetails').textContent=recordDetails(t,ref.type);for(const d of dialogs)if(d.open)d.close();openSheet(recordEditDialog);}catch(error){toast(error.message);}
}
$('managedRename').onclick=()=>openRecordEdit(actionTarget,'name');$('managedCategory').onclick=()=>openRecordEdit(actionTarget,'category');
$('managedCancel').onclick=()=>recordActionsDialog.close();$('managedEditCancel').onclick=()=>recordEditDialog.close();$('managedCandidateCancel').onclick=()=>recordCandidatesDialog.close();$('managedDeleteCancel').onclick=()=>recordDeleteDialog.close();
$('managedCategorySelect').onchange=()=>{$('managedColor').value=RECORD_CATEGORIES[$('managedCategorySelect').value].color;const kind={rail:'train',car:'car',station:'survey',unclassified:'other'}[$('managedCategorySelect').value];$('managedExportKind').value=kind;};$('managedDefaultColor').onclick=()=>{$('managedColor').value=RECORD_CATEGORIES[$('managedCategorySelect').value].color;};
$('managedEditSave').onclick=()=>{
 try{let patch;if(recordEditDialog.dataset.mode==='name'){const name=$('managedName').value.trim();if(!name)return toast('表示名を入力してください');patch={displayName:name};}else patch={category:$('managedCategorySelect').value,color:$('managedColor').value,exportKind:$('managedExportKind').value};saveRecordMeta(editTarget,patch);recordEditDialog.close();toast('管理情報を保存しました');}catch(error){toast('変更できません。'+error.message);}
};
function requestRecordDelete(ref){try{const t=checkedRecord(ref);deleteTarget=ref;setManagedFocus(ref);$('managedDeleteQuestion').textContent='「'+recordDisplayName(t,ref.type)+'」をDRIVENから削除しますか？';$('managedDeleteDetails').textContent=recordDetails(t,ref.type);for(const d of dialogs)if(d.open)d.close();openSheet(recordDeleteDialog);}catch(error){toast(error.message);}}
$('managedDelete').onclick=()=>requestRecordDelete(actionTarget);
$('managedDeleteConfirm').onclick=()=>{
 if(recording)return toast('記録を終了してから削除してください');
 try{checkedRecord(deleteTarget);const {type,id}=deleteTarget,rows=storedRows(type),next=rows.filter(t=>t.id!==id);localStorage.setItem(type==='trip'?key:SURVEY_KEY,JSON.stringify(next));
  if(type==='trip'){trips=next;visibleIds.delete(id);if(selectedId===id){points=[];selectedId=null;current=null;started=ended=null;overlayMode=true;clearRange();}if(recordMeta?.id===id)recordMeta=null;if(editorSnapshot?.selectedId===id)editorSnapshot=null;}
  else visibleSurveyIds.delete(id);
  refreshTrips();renderSurveys();refreshCurrentInfo();draw();recordDeleteDialog.close();toast('DRIVEN内の記録を削除しました');
 }catch(error){toast('削除していません。'+error.message);}
};
// Existing rename/save/export paths use the same separate metadata store.
const openLabelBeforeManagement=openLabel;
openLabel=function(afterCapture=false){if(!afterCapture){if(overlayMode||!selectedId)return toast('記録を1件表示してください');return openRecordEdit(recordRef('trip',selectedId),'name');}openLabelBeforeManagement(true);const t=activeRecord();if(t){$('labelName').value=recordDisplayName(t);$('labelKind').value=recordMetaFor('trip',t.id)?.exportKind||t.kind||'other';}};
saveLabel=function(){try{const t=activeRecord();if(!t)return false;saveRecordMeta(recordRef('trip',t.id),{displayName:$('labelName').value.trim()||'記録',exportKind:$('labelKind').value});return true;}catch(error){toast('管理情報を保存できません。記録は保持しています');return false;}};
$('editLabel').textContent='名前変更';$('editLabel').onclick=()=>openLabel();$('renameTrip').onclick=()=>openLabel();
const categoryButton=document.createElement('button');categoryButton.id='editCategory';categoryButton.textContent='分類・色変更';categoryButton.onclick=()=>{if(overlayMode||!selectedId)return toast('記録を1件表示してください');openRecordEdit(recordRef('trip',selectedId),'category');};$('editLabel').after(categoryButton);
deleteLocalRecord=function(id){requestRecordDelete(recordRef('trip',id));};
const infoBeforeManagement=refreshCurrentInfo;
refreshCurrentInfo=function(){infoBeforeManagement();const t=activeRecord();if(t&&!recording){$('tripName').value=recordDisplayName(t);$('sourceInfo').textContent=`表示名：${recordDisplayName(t)}\n原本：${originalRecordFile(t)}\n分類：${RECORD_CATEGORIES[recordCategory(t)].label}`;if(!overlayMode)$('openRecords').textContent=recordDisplayName(t)+' ▾';}};
filebase=function(){const t=activeRecord(),meta=t&&recordMetaFor('trip',t.id),category=t&&recordCategory(t),kind=meta?.exportKind||(category==='rail'?'train':category==='car'?'car':category==='station'?'survey':shownKind),type=t?.processing?.type;return namedFile(started,kind,t?recordDisplayName(t):$('tripName').value||'走行記録',type==='trim'?'_区間抽出':type==='exclude'?'_区間除外':'');};
// Lists retain visibility controls and normal taps. A separate button also exposes hold actions.
function decorateManagedRow(row,t,type){
 const ref=recordRef(type,t.id);row.dataset.recordType=type;row.dataset.recordId=t.id;row.classList.add('managed-record-row');row.style.setProperty('--record-category',recordCategoryColor(t,type));
 const title=row.querySelector('.trip-title');if(title)title.textContent=recordDisplayName(t,type);
 const input=row.querySelector('input[type=checkbox]');if(input)input.setAttribute('aria-label',recordDisplayName(t,type)+'を地図に表示');
 const chip=row.querySelector('.kind-chip');if(chip)chip.textContent=RECORD_CATEGORIES[recordCategory(t,type)].label;
 let menu=row.querySelector('.record-row-menu');if(!menu){menu=document.createElement('button');menu.type='button';menu.className='record-row-menu';menu.textContent='⋯';row.append(menu);}menu.setAttribute('aria-label',recordDisplayName(t,type)+'の操作');menu.onclick=e=>{e.preventDefault();e.stopPropagation();openRecordActions(ref);};
}
const surveyRecords=document.createElement('details');surveyRecords.id='surveyRecords';surveyRecords.innerHTML='<summary>地点記録</summary><div id="surveyRecordRows"></div>';$('recordsSlot').after(surveyRecords);
function surveyPosition(t){const p=t.representative;if(p&&validPoint({...p,t:null}))return p;return t.samples?.find(validPoint)||null;}
function renderSurveyRecordRows(){
 syncSurveyVisibility();const container=$('surveyRecordRows');container.replaceChildren();const rows=getSurveys();surveyRecords.hidden=!rows.length;
 for(const t of rows){const row=document.createElement('div');row.className='trip-choice';const check=document.createElement('input');check.type='checkbox';check.checked=visibleSurveyIds.has(t.id);check.onchange=()=>{if(check.checked)visibleSurveyIds.add(t.id);else visibleSurveyIds.delete(t.id);draw();};const title=document.createElement('button');title.type='button';title.className='trip-title';title.onclick=()=>{const p=surveyPosition(t);if(!p)return toast('表示できる座標がありません');visibleSurveyIds.add(t.id);center={lat:p.lat,lon:p.lon};zoom=Math.max(16,zoom);recordsDialog.close();draw();};const chip=document.createElement('span');chip.className='kind-chip';row.append(check,title,chip);decorateManagedRow(row,t,'survey');container.append(row);}
}
const refreshBeforeManagement=refreshTrips;
refreshTrips=function(){refreshBeforeManagement();[...$('tripChecklist').children].forEach((row,i)=>{if(trips[i])decorateManagedRow(row,trips[i],'trip');});for(const option of $('trips').options){const t=trips.find(x=>x.id===option.value);if(t)option.textContent=recordDisplayName(t);}for(const option of $('deleteRecordSelect').options){const t=trips.find(x=>x.id===option.value);if(t)option.textContent=recordDisplayName(t)+' · '+stamp(t.started)+' · '+String(t.id).slice(-8);}$('dataCounter').textContent=trips.length+'記録 · '+getSurveys().length+'地点';renderSurveyRecordRows();};
const surveysBeforeManagement=renderSurveys;
renderSurveys=function(){syncSurveyVisibility();surveysBeforeManagement();[...$('surveyList').children].forEach((row,i)=>{const t=getSurveys()[i];if(!t)return;row.classList.add('managed-record-row');row.dataset.recordType='survey';row.dataset.recordId=t.id;row.style.setProperty('--record-category',recordCategoryColor(t,'survey'));row.firstChild.textContent=recordDisplayName(t,'survey')+' ／ '+(t.kilometrage||'キロ程未入力')+' ／ '+t.count+'点 ／ '+stamp(t.started);const buttons=row.querySelectorAll('button');if(buttons[0])buttons[0].onclick=()=>download(JSON.stringify(t,null,2),namedFile(t.started,'survey',recordDisplayName(t,'survey'))+'.json','application/json');if(buttons[1])buttons[1].onclick=()=>requestRecordDelete(recordRef('survey',t.id));decorateManagedRow(row,t,'survey');});};
for(const [id,all]of[['overlayAll',true],['overlayOff',false]]){const previous=$(id).onclick;$(id).onclick=()=>{previous();if(recording)return;visibleSurveyIds=all?new Set(getSurveys().map(t=>t.id)):new Set();renderSurveyRecordRows();draw();};}
// Include saved point markers when fitting an overlay; single-trip fitting stays unchanged.
const fitBeforeManagement=fit;
fit=function(){
 if(screen!=='editor'||(!overlayMode&&points.length))return fitBeforeManagement();
 const ps=[...activeTrips().flatMap(t=>t.points),...getSurveys().filter(t=>visibleSurveyIds.has(t.id)).map(surveyPosition).filter(Boolean)];if(!ps.length)return fitBeforeManagement();
 const lo=Math.min(...ps.map(p=>p.lon)),hi=Math.max(...ps.map(p=>p.lon)),la=Math.min(...ps.map(p=>p.lat)),ha=Math.max(...ps.map(p=>p.lat));center={lat:(la+ha)/2,lon:(lo+hi)/2};const {w,h}=dimensions();for(let z=18;z>=2;z--){const a=merc(la,lo,z),b=merc(ha,hi,z);if(Math.abs(b.x-a.x)<w*.8&&Math.abs(b.y-a.y)<h*.8){zoom=z;break;}}follow=false;syncFollow();draw();
};$('fit').onclick=()=>fit();
const backupBeforeManagement=$('backupAll').onclick;$('backupAll').onclick=()=>{try{backupBeforeManagement();}catch(error){toast('バックアップできません。'+error.message);}};
// Pick only paths actually drawn. Gaps are never used as selectable connecting lines.
function visibleTripRecords(){if(overlayMode)return trips.filter(t=>visibleIds.has(t.id));const t=activeRecord();return t?[t]:[];}
function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);}
function mapRecordHits(clientX,clientY){
 if(screen!=='editor'||!center||editMode)return[];const rect=canvas.getBoundingClientRect(),c=merc(center.lat,center.lon,zoom),point={x:clientX-rect.left,y:clientY-rect.top},xy=p=>{const q=merc(p.lat,p.lon,zoom);return {x:q.x-c.x+rect.width/2,y:q.y-c.y+rect.height/2};},hits=[];
 for(const t of visibleTripRecords()){let distance=Infinity,prev;const ps=(!overlayMode&&t.id===selectedId)?points:t.points;ps.forEach((p,i)=>{const q=xy(p);distance=Math.min(distance,Math.hypot(q.x-point.x,q.y-point.y));if(prev&&!isTrackBreak(ps,i))distance=Math.min(distance,pointSegmentDistance(point,prev,q));prev=q;});if(distance<=22){const ref=recordRef('trip',t.id);if(ref)hits.push({ref,record:t,distance});}}
 for(const t of getSurveys()){if(!visibleSurveyIds.has(t.id))continue;const p=surveyPosition(t);if(!p)continue;const q=xy(p),distance=Math.hypot(q.x-point.x,q.y-point.y);if(distance<=24){const ref=recordRef('survey',t.id);if(ref)hits.push({ref,record:t,distance});}}
 return hits.sort((a,b)=>a.distance-b.distance);
}
function openMapRecords(x,y){const hits=mapRecordHits(x,y);if(!hits.length)return;if(hits.length===1)return openRecordActions(hits[0].ref);const list=$('managedCandidates');list.replaceChildren();managedFocus=null;draw();for(const hit of hits){const button=document.createElement('button');button.type='button';button.className='candidate-record';button.style.setProperty('--record-category',recordCategoryColor(hit.record,hit.ref.type));const title=document.createElement('strong'),details=document.createElement('span');title.textContent=recordDisplayName(hit.record,hit.ref.type);details.textContent=recordDetails(hit.record,hit.ref.type);button.append(title,details);button.onclick=()=>openRecordActions(hit.ref);list.append(button);}openSheet(recordCandidatesDialog);}
function drawManagementOverlay({ctx,w,h,xy}){
 function marker(p,color,highlight=false){const q=xy(p);ctx.beginPath();ctx.arc(q.x,q.y,highlight?10:6,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=highlight?3:2;ctx.stroke();}
 ctx.save();for(const t of getSurveys()){const p=surveyPosition(t);if(p&&visibleSurveyIds.has(t.id))marker(p,'#187c88');}
 if(managedFocus){const rows=managedFocus.type==='trip'?visibleTripRecords():getSurveys().filter(t=>visibleSurveyIds.has(t.id)),matches=rows.filter(t=>t.id===managedFocus.id);if(matches.length===1){const t=matches[0];if(managedFocus.type==='survey'){const p=surveyPosition(t);if(p)marker(p,'#ba35cc',true);}else{const ps=t.points;ctx.beginPath();ps.forEach((p,i)=>{const q=xy(p);if(isTrackBreak(ps,i))ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle='white';ctx.lineWidth=11;ctx.stroke();ctx.strokeStyle='#ba35cc';ctx.lineWidth=7;ctx.stroke();if(ps.length){marker(ps[0],'#ba35cc',true);if(ps.length>1)marker(ps.at(-1),'#ba35cc',true);}}}}
 ctx.restore();
}
// Hold recognition does not capture scrolling or ordinary map gestures.
let heldPointer=null,holdTimer=null,blockHoldClick=false;const heldPointers=new Set();
function cancelRecordHold(){clearTimeout(holdTimer);holdTimer=null;heldPointer=null;}
document.addEventListener('pointerdown',e=>{
 blockHoldClick=false;heldPointers.add(e.pointerId);if(heldPointers.size>1){cancelRecordHold();return;}if(e.button!==0)return;
 const row=e.target.closest('.managed-record-row'),onMap=e.target.closest('#map');if(row){if(e.target.closest('input,button:not(.trip-title)'))return;const ref=recordRef(row.dataset.recordType,row.dataset.recordId);if(!ref)return;heldPointer={id:e.pointerId,x:e.clientX,y:e.clientY,row,ref};}else if(onMap&&screen==='editor'&&!editMode&&!e.target.closest('button'))heldPointer={id:e.pointerId,x:e.clientX,y:e.clientY,onMap:true};else return;
 holdTimer=setTimeout(()=>{const held=heldPointer;if(!held||heldPointers.size!==1)return;blockHoldClick=true;tap=null;if(held.row)openRecordActions(held.ref);else openMapRecords(held.x,held.y);cancelRecordHold();},600);
},true);
document.addEventListener('pointermove',e=>{if(heldPointer&&e.pointerId===heldPointer.id&&Math.hypot(e.clientX-heldPointer.x,e.clientY-heldPointer.y)>8)cancelRecordHold();},true);
for(const event of['pointerup','pointercancel'])document.addEventListener(event,e=>{heldPointers.delete(e.pointerId);if(heldPointer?.id===e.pointerId)cancelRecordHold();},true);
document.addEventListener('click',e=>{if(blockHoldClick){blockHoldClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('contextmenu',e=>{const row=e.target.closest('.managed-record-row');if(row){e.preventDefault();blockHoldClick=true;cancelRecordHold();openRecordActions(recordRef(row.dataset.recordType,row.dataset.recordId));}else if(e.target.closest('#map')&&screen==='editor'){e.preventDefault();blockHoldClick=true;cancelRecordHold();if(!managementDialogs.some(d=>d.open)&&!editMode)openMapRecords(e.clientX,e.clientY);}},true);
window.addEventListener('blur',()=>{cancelRecordHold();heldPointers.clear();});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelRecordHold();heldPointers.clear();}});
// Backup keeps sidecar entries separate; restored ID conflicts are remapped by the existing importer.
window.DRIVEN_MANAGEMENT={drawOverlay:drawManagementOverlay,backup:()=>readManagement(),prepareRestore(incoming,mapping){validateManagement(incoming);const out=readManagement();for(const [k,meta]of Object.entries(incoming.records)){const type=k.startsWith('trip:')?'trip':'survey',oldId=k.slice(type.length+1),id=mapping[type].get(oldId);if(!id)continue;const dest=managementKey(type,id);if(!Object.hasOwn(out.records,dest))out.records[dest]={...meta};}validateManagement(out);return {key:RECORD_META_KEY,value:JSON.stringify(out)};}};
window.addEventListener('storage',e=>{if(e.key===RECORD_META_KEY||e.key===null){try{managementCache=readManagement();refreshTrips();renderSurveys();refreshCurrentInfo();draw();}catch(error){toast('管理情報を更新できません。保存内容は保持しています');}}});
refreshTrips();renderSurveys();refreshCurrentInfo();
$('helpMenu').querySelector('.menu-body').insertAdjacentHTML('beforeend','<p>記録一覧やGPX編集の軌跡・地点を長押しすると、名前・分類色・削除を選べます。重なる記録は候補を選んでから操作します。一覧の⋯からも操作できます。チェックは地図表示用です。</p><p>表示名・分類色は別の管理情報です。元の記録名・原ファイル名・測位点は書き換えません。全体バックアップに管理情報も含みます。</p>');
