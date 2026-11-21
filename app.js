'use strict';
/* Kuestro – all data stays on this device (localStorage), AES-GCM encrypted when a passcode is set. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const dayDiff=(a,b)=>Math.round((parse(key(b))-parse(key(a)))/864e5);
const uid=()=>{const a=crypto.getRandomValues(new Uint8Array(6));return [...a].map(x=>x.toString(36).padStart(2,'0')).join('')};
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PRAYERS=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
const CATS={prayer:['🕌','Prayer & Quran'],exercise:['💪','Exercise'],running:['🏃','Running'],skincare:['🧴','Skin care'],reading:['📖','Reading'],language:['🗣️','Language'],meals:['🥗','Meals & health'],work:['💼','Work & study'],other:['✨','Other']};
const LOGFOR={running:'run',reading:'read',meals:'meal',exercise:'workout',language:'lang'};
const CATFOR={run:'running',read:'reading',meal:'meals',workout:'exercise',lang:'language'};
const STORE='dayflow-v1', OSTATE='dayflow-oauth-state';

let S=null, KEY=null, SALT=null, BLOB=null;
let view='today', viewDate=new Date(), logType='run', editLinks=false, editing=null, hiddenAt=0, fails=0, lockUntil=0, pendingCode=null;

function defaults(){
  const t=key(new Date());
  const r=(name,cat,freq,extra={})=>({id:uid(),name,cat,freq,time:'',note:'',start:t,days:[],dom:1,every:2,...extra});
  const links=[
    {id:uid(),icon:'🕌',name:'Muslim Pro',url:'https://www.muslimpro.com'},
    {id:uid(),icon:'📖',name:'Quran',url:'https://quran.com'},
    {id:uid(),icon:'🟧',name:'Strava',url:'https://www.strava.com/dashboard'},
    {id:uid(),icon:'🎧',name:'Spotify',url:'https://open.spotify.com'},
    {id:uid(),icon:'✳️',name:'Claude',url:'https://claude.ai'},
    {id:uid(),icon:'💬',name:'ChatGPT',url:'https://chatgpt.com'},
  ];
  return {
    routines:[
      r('Morning adhkar','prayer','daily',{time:'06:30'}),
      r('Read Quran (1 page)','prayer','daily',{time:'21:00'}),
      r('Morning skin care','skincare','daily',{time:'07:00',note:'Cleanser → moisturizer → SPF'}),
      r('Evening skin care','skincare','daily',{time:'22:30',note:'Cleanser → serum → moisturizer'}),
      r('Exfoliate / face mask','skincare','weekly',{days:[3],time:'22:30'}),
      r('Strength workout','exercise','weekly',{days:[0,2,4],time:'18:00'}),
      r('Run','running','interval',{every:2,time:'06:45'}),
      r('Read 20 pages','reading','daily',{time:'22:00'}),
      r('Drink 2L of water','meals','daily',{link:'water'}),
      r('Weekly meal prep','meals','weekly',{days:[5],time:'12:00'}),
      r('Monthly progress check (weight, photos)','other','monthly',{dom:1,time:'09:00'}),
    ],
    done:{}, logs:[], ptCache:{}, health:{}, links, claimed:{}, badges:{}, rerolls:{}, qSeen:{}, lastLevel:0,
    hero:{created:false,name:'',motto:'',cls:'paladin',style:'chibi',cuteV:1,scene:'city',rim:'#ff7a1a',glow:false,skin:'#fde3cf',hair:'short',hairColor:'#5b3a29',eyes:'sparkle',eyeColor:'#7b4fc2',mouth:'smile',marks:'blush',acc:'none',outfit:'#d16d9e',bg:'#fbe6e1',hist:[]},
    todos:defaultTodos(),
    money:{cur:'EGP',budget:0,tx:[],rules:{},wish:[]},
    water:{goal:2000,days:{},auto:{}},
    meds:[], cards:{seen:{},revealed:{}},
    train:{days:[6,0,1,3,4],mode:'days',cyc:{on:5,off:1,start:''},plan:defaultPlan(),idx:0,sessions:[],unit:'kg',active:null,seeded:false},
    lang:{chosen:false,name:'Spanish',code:'es-ES',level:'A2 elementary',native:'English',goal:15,newPerDay:15,duoUrl:'https://www.duolingo.com/learn',reverse:false,ai:'claude',deck:[],reviews:{},seeded:false},
    strava:{clientId:'',clientSecret:'',access:'',refresh:'',expires:0,athlete:'',lastSync:0,after:0},
    ai:{claudeKey:'',claudeModel:'claude-sonnet-5-5',openaiKey:'',openaiModel:'gpt-5-mini',plan:''},
    settings:{sound:true,prayers:true,city:'Cairo',country:'Egypt',method:5,lat:null,lon:null,weekStart:6,h12:1,prayerApp:links[0].id,lockAfter:1,nudge:true,nudgeTime:'21:30'}
  };
}
function merge(p){
  const d=defaults();if(!p||!Array.isArray(p.routines))return d;
  const r={...d,...p,settings:{...d.settings,...p.settings},strava:{...d.strava,...p.strava},ai:{...d.ai,...p.ai},health:p.health||{},ptCache:p.ptCache||{},claimed:p.claimed||{},badges:p.badges||{},rerolls:p.rerolls||{},qSeen:p.qSeen||{},lang:{...d.lang,...p.lang},hero:{...d.hero,...p.hero},meds:p.meds||[],train:{...d.train,...p.train},cards:{...d.cards,...p.cards},todos:p.todos&&Array.isArray(p.todos.lists)?p.todos:d.todos,money:{...d.money,...p.money}};
  r.routines.forEach(x=>{if(x.note==='DayFlow → Learn → Review')x.note='Kuestro → Learn → Review'});   // renamed app
  r.water={goal:2000,days:{},auto:{},...r.water};
  if(!r.routines.some(x=>x.link==='water')){const w=r.routines.find(x=>x.cat==='meals'&&/water/i.test(x.name));if(w)w.link='water'}
  return r;
}

/* ---------- encryption (PBKDF2 → AES-GCM 256) ---------- */
const te=new TextEncoder(),td=new TextDecoder();
function b64(buf){const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){
  const base=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptWith(k,salt,json){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(json));return {enc:1,salt,iv:b64(iv),ct:b64(ct)}}
async function decryptBlob(pass,blob){const k=await deriveKey(pass,ub64(blob.salt));const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(blob.iv)},k,ub64(blob.ct));return {k,data:JSON.parse(td.decode(pt))}}
let chain=Promise.resolve();
function save(){
  if(!S)return;const json=JSON.stringify(S),k=KEY,salt=SALT;
  chain=chain.then(async()=>{localStorage.setItem(STORE,k?JSON.stringify(await encryptWith(k,salt,json)):json)}).catch(e=>console.warn('save failed',e));
  return chain;
}
async function setPasscode(p){SALT=b64(crypto.getRandomValues(new Uint8Array(16)));KEY=await deriveKey(p,ub64(SALT));await save()}

function clearDOM(){
  ['todayList','heroSlot','questsBody','learnBody','heroBody','trainBody','medsBody','todosBody','moneyBody','progressBody','week','routineList','recent','stats','connectBody','secBox','aiAnswer','logForm'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=''});
  $$('form').forEach(f=>f.reset());$('#aiPlan').value='';
  if($('#rDlg').open)$('#rDlg').close();QCQ.length=0;nextQC();RV=null;HD=null;heroPeekL=null;TEDIT=false;IMPORT=null;MADD=false;stopRest();if($('#mDlg').open)$('#mDlg').close();
}
async function lock(){
  if(!KEY)return;await chain;KEY=null;S=null;clearDOM();showLock();
}
function showLock(){
  try{BLOB=JSON.parse(localStorage.getItem(STORE))}catch(e){BLOB=null}
  document.body.classList.add('locked');$('#lockPass').value='';$('#lockMsg').textContent='';
  setTimeout(()=>$('#lockPass').focus(),80);
}

/* ---------- scheduling ---------- */
function isDue(r,d){
  if(r.start&&key(d)<r.start)return false;
  if(r.link==='train'&&S.train&&S.train.mode==='cycle')return isTrainDay(d);
  switch(r.freq){
    case 'daily':return true;
    case 'weekly':return (r.days||[]).includes(d.getDay());
    case 'monthly':{const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return d.getDate()===Math.min(+r.dom||1,last)}
    case 'interval':{const n=dayDiff(parse(r.start||key(d)),d);return n>=0&&n%(+r.every||2)===0}
  }
  return false;
}
const isDone=(id,d)=>!!(S.done[key(d)]||{})[id];
function toggle(id,d){const k=key(d);S.done[k]=S.done[k]||{};if(S.done[k][id])delete S.done[k][id];else S.done[k][id]=Date.now();save()}
function autoTick(type,d,hint){
  if(type==='meal')return; // meals have their own routines (water, meal prep) that a single log shouldn't tick
  const cat=CATFOR[type],open=S.routines.filter(r=>r.cat===cat&&isDue(r,d)&&!isDone(r.id,d));
  let r=open[0];
  if(type==='lang'){
    const h=String(hint||''),MAP={Duolingo:/duolingo/i,Listening:/listen|podcast/i,Speaking:/speak|repeat/i,Reading:/read/i,Writing:/writ/i,'Tutor / class':/tutor|convers|class/i};
    const re=h.includes('|')?new RegExp(h,'i'):MAP[h];r=re?open.find(x=>re.test(x.name)):null;
  }
  if(r){const k=key(d);S.done[k]=S.done[k]||{};S.done[k][r.id]=Date.now()}
}
function streak(r){
  let d=new Date(),c=0;if(!isDone(r.id,d))d=addDays(d,-1);
  for(let i=0;i<500;i++){if(r.start&&key(d)<r.start)break;if(isDue(r,d)){if(isDone(r.id,d))c++;else break}d=addDays(d,-1)}
  return c;
}
function dayStats(d){
  const due=S.routines.filter(r=>isDue(r,d));let total=due.length,done=due.filter(r=>isDone(r.id,d)).length;
  if(S.settings.prayers){total+=5;done+=PRAYERS.filter(p=>isDone('prayer:'+p,d)).length}
  const ds=dosesOn(d);total+=ds.length;done+=ds.filter(x=>isDone(x.id,d)).length;
  return {total,done,pct:total?Math.round(done/total*100):0};
}
function freqText(r){
  if(r.link==='train'&&S.train&&S.train.mode==='cycle')return 'Training cycle: '+trainSched();
  if(r.freq==='daily')return 'Every day';
  if(r.freq==='weekly')return (r.days||[]).length?[...r.days].sort().map(i=>DAYS[i]).join(', '):'No days picked';
  if(r.freq==='monthly')return `Monthly on day ${r.dom}`;
  return `Every ${r.every} days`;
}
function fmtTime(t){
  if(!t)return '';if(!+S.settings.h12)return t;
  let[h,m]=t.split(':').map(Number);const ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${pad(m)} ${ap}`;
}

/* ---------- links ---------- */
const BAD_SCHEME=/^\s*(javascript|data|vbscript|file|blob):/i;
function linkAttrs(url){return /^https?:/i.test(url)?`href="${esc(url)}" target="_blank" rel="noopener noreferrer"`:`href="${esc(url)}"`}
const linkById=id=>S.links.find(l=>l.id===id);

/* ---------- prayer times (aladhan.com) ---------- */
let ptMem={};
function ptBase(){const s=S.settings;return `${s.lat!=null?`lat${s.lat},${s.lon}`:`${s.city},${s.country}`}|${s.method}`}
async function loadMonth(y,m){
  const s=S.settings,ck=`${ptBase()}|${y}-${pad(m)}`;
  if(S.ptCache[ck])return S.ptCache[ck];
  const q=s.lat!=null?`latitude=${s.lat}&longitude=${s.lon}&method=${s.method}`:`city=${encodeURIComponent(s.city)}&country=${encodeURIComponent(s.country)}&method=${s.method}`;
  const path=s.lat!=null?'calendar':'calendarByCity';
  let j=null;
  for(const url of [`https://api.aladhan.com/v1/${path}/${y}/${m}?${q}`,`https://api.aladhan.com/v1/${path}?${q}&month=${m}&year=${y}`]){
    try{const r=await fetch(url);if(r.ok){j=await r.json();if(Array.isArray(j.data))break}}catch(e){}
    j=null;
  }
  if(!j)throw new Error('offline');
  const out={};
  j.data.forEach(day=>{
    const[dd,mm,yy]=day.date.gregorian.date.split('-');const t={};
    PRAYERS.concat('Sunrise').forEach(p=>t[p]=String(day.timings[p]).slice(0,5));
    const h=day.date.hijri;t.hijri=`${+h.day} ${h.month.en} ${h.year} AH`;
    out[`${yy}-${mm}-${dd}`]=t;
  });
  if(!S)throw new Error('locked');
  const keys=Object.keys(S.ptCache);if(keys.length>6)delete S.ptCache[keys[0]];
  S.ptCache[ck]=out;save();return out;
}
async function prayerTimes(d){
  const mk=`${ptBase()}|${key(d)}`;if(ptMem[mk])return ptMem[mk];
  const month=await loadMonth(d.getFullYear(),d.getMonth()+1);
  const t=month[key(d)];if(!t)throw new Error('missing');ptMem[mk]=t;return t;
}

/* ---------- Today ---------- */
const HKEYS={steps:['👣','steps'],active_kcal:['🔥','active kcal'],exercise_min:['⏱️','exercise min'],sleep_h:['😴','h sleep'],weight:['⚖️','kg'],resting_hr:['❤️','resting bpm']};
const healthLine=h=>Object.keys(HKEYS).filter(k=>h[k]!=null).map(k=>`${HKEYS[k][0]} ${(+h[k]).toLocaleString()} ${HKEYS[k][1]}`).join(' · ');
function itemHTML(id,name,meta,done,extra=''){
  return `<div class="item ${done?'done':''}" data-toggle="${esc(id)}"><span class="chk">✓</span><div class="grow"><div class="nm">${esc(name)}</div>${meta?`<div class="meta">${meta}</div>`:''}</div>${extra}</div>`;
}
function renderWeek(){
  const ws=+S.settings.weekStart,d0=addDays(viewDate,-((viewDate.getDay()-ws+7)%7)),today=key(new Date());
  let h='';
  for(let i=0;i<7;i++){const d=addDays(d0,i),st=dayStats(d),k=key(d);
    h+=`<button data-day="${k}" class="${k===key(viewDate)?'sel':''}"><span>${DAYS[d.getDay()][0]}${k===today?'•':''}</span><b>${d.getDate()}</b><span class="dot"><i style="width:${st.pct}%"></i></span></button>`}
  $('#week').innerHTML=h;
}
function renderToday(){
  const d=viewDate,k=key(d),isToday=k===key(new Date()),dd=dayDiff(new Date(),d);
  $('#tTitle').textContent=isToday?'Today':dd===1?'Tomorrow':dd===-1?'Yesterday':d.toLocaleDateString(undefined,{weekday:'long'});
  $('#tSub').textContent=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  $('#heroSlot').innerHTML=heroHTML();
  renderWeek();
  const st=dayStats(d);
  $('#pText').textContent=`${st.done} of ${st.total} done`;$('#pPct').textContent=st.pct+'%';$('#pBar').style.width=st.pct+'%';

  const due=S.routines.filter(r=>isDue(r,d)).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
  const groups={};due.forEach(r=>(groups[r.cat]=groups[r.cat]||[]).push(r));
  const rItem=r=>{const s=streak(r),lt=LOGFOR[r.cat];
    const meta=[fmtTime(r.time),r.note?esc(r.note):'',s>1?`🔥 ${s}`:''].filter(Boolean).join(' · ');
    return itemHTML(r.id,r.name,r.link==='train'&&nextW()?[meta,'Next: '+esc(nextW().name)].filter(Boolean).join(' · '):meta,isDone(r.id,d),r.link==='water'?`<span class="meta">${wL(wTotal(k))} / ${wL(wData().goal)}</span>`:r.link==='train'?`<button class="pill" data-act="goTrain">▶ Train</button>`:lt?`<button class="pill" data-log="${lt}">+ log</button>`:'')};
  const catCard=c=>{const extra=c==='language'?`<span style="display:flex;gap:6px"><a class="pill" ${linkAttrs(S.lang.duoUrl)}>🦉 Duolingo</a><button class="pill" data-act="goLearn">🧠 ${dueCards().length}</button></span>`:'';
    return `<div class="card"><div class="sec-h"><span>${CATS[c][0]} ${c==='language'?esc(S.lang.name):CATS[c][1]}</span>${extra}</div>${groups[c].map(rItem).join('')}</div>`};
  let h='';
  if(isToday)h+=nudgeBannerHTML()+cardOfDayHTML();
  const doses=dosesOn(d);
  if(doses.length){const nh=nowHM();
    h+=`<div class="card"><div class="sec-h"><span>💊 Medications</span><button class="pill" data-act="goMeds">Manage</button></div>${doses.map(x=>{const m=x.m,dn=isDone(x.id,d),late=isToday&&!dn&&x.t&&x.t<nh,food=MED_FOOD.find(f=>f[0]===m.food);
      const meta=[x.t?fmtTime(x.t):'',m.dose?esc(m.dose):'',food&&m.food!=='any'?food[1].toLowerCase():'',late?'<b class="late">late</b>':'',medTracked(m)&&+m.stock<=(+m.refillAt||0)?`⚠️ ${+m.stock} left`:''].filter(Boolean).join(' · ');
      return itemHTML(x.id,`${medIcon(m.form)} ${m.name}`,meta,dn)}).join('')}</div>`}
  h+=waterCardHTML(d)+mealsCardHTML(d)+(groups.meals?catCard('meals'):'');
  if(isToday)h+=todoTodayCard()+moneyTodayCard();
  if(isToday){
    const dq=activeQuests().filter(q=>q.scope==='d'&&!q.bonus);
    h+=`<div class="card"><div class="sec-h"><span>🎯 Today's quests</span><button class="pill" data-act="goQuests">All quests ›</button></div>${dq.map(questHTML).join('')}</div>`;
  }
  const hd=S.health[k];
  if(hd)h+=`<div class="card"><div class="sec-h"><span>❤️ Health</span><span class="meta">from Apple Health</span></div><div class="hstats">${esc(healthLine(hd))}</div></div>`;
  if(S.settings.prayers||groups.prayer){
    const app=linkById(S.settings.prayerApp);
    h+=`<div class="card"><div class="sec-h"><span>🕌 Prayer <span class="meta" id="hijri"></span></span>${app?`<a class="pill" ${linkAttrs(app.url)}>Open ${esc(app.name)}</a>`:''}</div>`;
    if(S.settings.prayers)h+=PRAYERS.map(p=>itemHTML('prayer:'+p,p,`<span data-pt="${p}">…</span>`,isDone('prayer:'+p,d))).join('');
    h+=(groups.prayer||[]).map(rItem).join('')+`</div>`;
  }
  Object.keys(CATS).filter(c=>c!=='prayer'&&c!=='meals'&&groups[c]).forEach(c=>{h+=catCard(c)});
  if(!due.length&&!S.settings.prayers)h+=`<div class="empty">Nothing scheduled for this day.<br><br><button class="btn" data-act="newRoutine">+ Add a routine</button></div>`;
  $('#todayList').innerHTML=h;
  if(S.settings.prayers)fillPrayers(d,isToday);
}
async function fillPrayers(d,isToday){
  try{
    const t=await prayerTimes(d);if(!S||key(d)!==key(viewDate)||view!=='today')return;
    PRAYERS.forEach(p=>{const el=document.querySelector(`[data-pt="${p}"]`);if(el)el.textContent=fmtTime(t[p])+(p==='Fajr'&&t.Sunrise?` · sunrise ${fmtTime(t.Sunrise)}`:'')});
    const hj=$('#hijri');if(hj)hj.textContent=t.hijri?'· '+t.hijri:'';
    if(isToday){const n=new Date(),now=`${pad(n.getHours())}:${pad(n.getMinutes())}`,nx=PRAYERS.find(p=>t[p]>now);
      if(nx){const el=document.querySelector(`[data-toggle="prayer:${nx}"]`);if(el){el.classList.add('next');el.querySelector('.meta').append(' · next')}}}
  }catch(e){$$('[data-pt]').forEach(el=>el.textContent='Times unavailable offline')}
}

/* ---------- Routines ---------- */
function renderRoutines(){
  if(!S.routines.length){$('#routineList').innerHTML='<div class="empty">No routines yet. Tap “+ Add”.</div>';return}
  let h='';
  Object.keys(CATS).forEach(c=>{const list=S.routines.filter(r=>r.cat===c).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));if(!list.length)return;
    h+=`<div class="card"><div class="sec-h"><span>${CATS[c][0]} ${CATS[c][1]}</span></div>`+list.map(r=>{const s=streak(r);
      return `<div class="li" data-edit="${r.id}" style="cursor:pointer"><div class="grow"><div>${esc(r.name)}</div><div class="meta">${freqText(r)}${r.time?' · '+fmtTime(r.time):''}${s?` · 🔥 ${s}`:''}</div></div><span class="meta">›</span></div>`}).join('')+`</div>`});
  $('#routineList').innerHTML=h;
}

/* ---------- Log ---------- */
const pace=e=>{const p=e.min/e.km;return `${Math.floor(p)}:${pad(Math.round((p%1)*60)%60)}`};
const LOG={  // sum() returns plain text; escape when rendering
  run:{icon:'🏃',label:'Run',f:[['km','Distance (km)','number'],['min','Time (minutes)','number'],['note','Note','text']],sum:e=>`${e.km||0} km${e.min?` · ${e.min} min`:''}${e.km&&e.min?` · ${pace(e)} /km`:''}${e.note?' · '+e.note:''}`},
  read:{icon:'📖',label:'Reading',f:[['title','Book','text'],['pages','Pages read','number']],sum:e=>`${e.pages||0} pages${e.title?' · '+e.title:''}`},
  meal:{icon:'🥗',label:'Meal',f:[['slot','Meal','select:Breakfast,Lunch,Dinner,Snack'],['food','What did you eat?','text'],['kcal','Calories (optional)','number']],sum:e=>`${e.slot}: ${e.food}${e.kcal?` · ${e.kcal} kcal`:''}${e.p!=null?` · P ${e.p}g C ${e.c}g F ${e.f}g`:''}`},
  lang:{icon:'🗣️',label:'Language',f:[['act','Activity','select:Duolingo,Listening,Speaking,Reading,Writing,Tutor / class'],['min','Minutes','number'],['duoXp','Duolingo XP (optional)','number'],['duoStreak','Duolingo streak (optional)','number']],sum:e=>`${e.act}${e.min?` · ${e.min} min`:''}${e.duoXp?` · ${e.duoXp} XP`:''}${e.duoStreak?` · 🔥 ${e.duoStreak}`:''}`},
  workout:{icon:'💪',label:'Workout',f:[['kind','Type (e.g. push day, yoga)','text'],['min','Minutes','number']],sum:e=>`${e.kind||'Workout'}${e.min?` · ${e.min} min`:''}`},
};
function renderLog(){
  $('#logTypes').innerHTML=Object.entries(LOG).map(([k,v])=>`<label><input type="radio" name="lt" value="${k}" ${k===logType?'checked':''}><span>${v.icon} ${v.label}</span></label>`).join('');
  const T=LOG[logType],lastBook=([...S.logs].reverse().find(l=>l.type==='read'&&l.title)||{}).title||'';
  const hour=new Date().getHours(),slot=hour<11?'Breakfast':hour<16?'Lunch':hour<21?'Dinner':'Snack';
  if(logType==='meal'){$('#logForm').innerHTML=mealHTML();drawMeal()}else $('#logForm').innerHTML=`<h2>${T.icon} Log ${T.label.toLowerCase()}</h2>`+T.f.map(([n,l,t])=>{
    if(t.startsWith('select:'))return `<label class="f">${l}</label><select name="${n}">${t.slice(7).split(',').map(o=>`<option ${o===slot?'selected':''}>${o}</option>`).join('')}</select>`;
    return `<label class="f">${l}</label><input name="${n}" type="${t}" ${t==='number'?'step="any" min="0" inputmode="decimal"':''} value="${n==='title'?esc(lastBook):''}" ${['km','pages','food'].includes(n)?'required':''}>`;
  }).join('')+`<label class="f">Date</label><input type="date" name="date" value="${key(new Date())}"><div style="margin-top:12px"><button class="btn full">Save</button></div>`;
  const since=key(addDays(new Date(),-6)),wk=S.logs.filter(l=>l.date>=since),sum=(t,f)=>wk.filter(l=>l.type===t).reduce((a,l)=>a+(+l[f]||0),0);
  let due=0,dn=0;for(let i=0;i<7;i++){const s=dayStats(addDays(new Date(),-i));due+=s.total;dn+=s.done}
  const runs=wk.filter(l=>l.type==='run').length,kcal=sum('meal','kcal'),mealDays=new Set(wk.filter(l=>l.type==='meal'&&l.kcal).map(l=>l.date)).size;
  const hs=Object.entries(S.health).filter(([d,v])=>d>=since&&v.steps!=null);
  $('#stats').innerHTML=[
    [`${due?Math.round(dn/due*100):0}%`,'routines completed'],
    [`${+sum('run','km').toFixed(1)} km`,`in ${runs} run${runs===1?'':'s'}`],
    [sum('read','pages'),'pages read'],
    [`${sum('workout','min')} min`,'of workouts'],
    [hs.length?Math.round(hs.reduce((a,[,v])=>a+v.steps,0)/hs.length).toLocaleString():'—','avg steps / day'],
    [mealDays?Math.round(kcal/mealDays):'—','avg kcal eaten / day'],
    [range(addDays(new Date(),-6),new Date()).reduce((a,d)=>a+langMinOn(key(d)),0)+' min','language practice'],
    [range(addDays(new Date(),-6),new Date()).reduce((a,d)=>a+(S.lang.reviews[key(d)]||0),0),'flashcards reviewed'],
  ].map(([b,s])=>`<div class="stat"><b>${b}</b><span class="meta">${s}</span></div>`).join('');
  const rec=[...S.logs].sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts).slice(0,30);
  $('#recent').innerHTML=rec.length?rec.map(l=>`<div class="li"><span style="font-size:20px">${LOG[l.type].icon}</span><div class="grow"><div>${esc(LOG[l.type].sum(l))}</div><div class="meta">${parse(l.date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}${l.src?' · '+esc(l.src):''}</div></div><button class="ib" data-dellog="${l.id}" aria-label="Delete">×</button></div>`).join(''):'<div class="empty">Nothing logged yet.</div>';
  $('#aiPlan').value=S.ai.plan||'';
  $('#aiMode').textContent=`Claude: ${S.ai.claudeKey?'answers here (API key saved)':'opens the Claude app with your data'} · ChatGPT: ${S.ai.openaiKey?'answers here':'opens ChatGPT with your data'}`;
  if(S.ai.last&&!$('#aiAnswer').innerHTML)$('#aiAnswer').innerHTML=fmtAI(S.ai.last.text);
}

/* ---------- Evening check-in: an alert before the day ends ---------- */
const NUDGE_DEF='21:30';
const nudgeOn=()=>S.settings.nudge!==false;
const nudgeAt=()=>S.settings.nudgeTime||NUDGE_DEF;
let nudgeShown=false;
function nudgeState(){   // null when there is nothing to remind about
  if(!nudgeOn())return null;
  const d=new Date(),k=key(d),st=dayStats(d);
  if(nowHM()<nudgeAt()||S.settings.nudgeDone===k||!st.total||st.done>=st.total)return null;
  return {k,st};
}
function nudgeBannerHTML(){
  const n=nudgeState();nudgeShown=!!n;if(!n)return '';
  const {st,k}=n,streak=dayStreak(),need=Math.max(0,Math.ceil(st.total/2)-st.done),W=wData(),lines=[];
  lines.push(`✅ ${st.done} of ${st.total} done today`+(streak>0?(need>0?` · do ${need} more to keep your 🔥 ${streak}-day streak`:` · your 🔥 ${streak}-day streak is safe`):''));
  if(wTotal(k)<W.goal)lines.push(`💧 ${wL(wTotal(k))} of ${wL(W.goal)} water`);
  if(!dayTotals(k).n)lines.push('🥗 No meals logged yet');
  return `<div class="card nudge"><div class="sec-h"><span>🌙 The day is almost over</span><button class="pill" data-nact="dismiss">Got it</button></div><div class="meta">Take a minute to log today’s progress:</div>${lines.map(l=>`<div class="nl">${l}</div>`).join('')}</div>`;
}
async function nudgeNotify(){   // generic text on purpose: it can show on a locked screen
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  const opts={body:'Time to log today’s progress ✨',tag:'kuestro-nudge',icon:'icon-192.png',badge:'icon-192.png'};
  try{const reg=await (navigator.serviceWorker&&navigator.serviceWorker.getRegistration?navigator.serviceWorker.getRegistration():null);
    if(reg&&reg.showNotification)await reg.showNotification('🌙 Kuestro',opts);else new Notification('🌙 Kuestro',opts);return true}
  catch(e){try{new Notification('🌙 Kuestro',opts);return true}catch(e2){return false}}
}
function nudgeTick(){
  if(!S)return;const n=nudgeState();
  if(n&&document.hidden&&S.settings.nudgeNote!==n.k){S.settings.nudgeNote=n.k;save();nudgeNotify()}
  if(!!n!==nudgeShown&&view==='today'&&key(viewDate)===key(new Date()))renderToday();
}
setInterval(nudgeTick,30000);
function nudgeHTML(){
  const perm='Notification' in window?Notification.permission:'unsupported';
  const note=perm==='granted'?'Notifications are on. You get one while Kuestro is open or in the background.':perm==='denied'?'Notifications are blocked for this site in your browser settings. The banner and the calendar alert still work.':perm==='unsupported'?'Notifications aren’t available here (on iPhone, add Kuestro to your Home Screen). The banner and the calendar alert still work.':'Allow notifications to get an alert while Kuestro is open or in the background.';
  return `<h2>🌙 Evening check-in</h2><p class="meta">A reminder before the day ends to log your progress: routines, water and meals.</p>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-nudge="on" ${nudgeOn()?'checked':''}> Remind me to log my day</label>
    <label class="f">Remind me at</label><input type="time" data-nudge="time" value="${nudgeAt()}">
    <div class="row mt"><button type="button" class="btn ghost" data-nact="ics">📅 Add a daily alert to my calendar</button>${perm==='default'?`<button type="button" class="btn ghost" data-nact="perm">🔔 Allow notifications</button>`:perm==='granted'?`<button type="button" class="btn ghost" data-nact="test">Send a test alert</button>`:''}</div>
    <p class="meta mt">${note}</p><p class="meta"><b>Tip:</b> the calendar alert is the only one that can ring when Kuestro is fully closed. Open the downloaded file once and your calendar adds a daily alert.</p>`;
}
function nudgeIcs(){
  const L=icsHead('Kuestro evening check-in'),t=nudgeAt().replace(':',''),url=location.href.split('#')[0].split('?')[0];
  L.push('BEGIN:VEVENT','UID:evening-checkin@dayflow',`DTSTAMP:${stamp()}`,`DTSTART:${todayK().replace(/-/g,'')}T${t}00`,'DURATION:PT10M','RRULE:FREQ=DAILY',
    `SUMMARY:${icsEsc('🌙 Log your day in Kuestro')}`,`DESCRIPTION:${icsEsc('Tick off what you did today and log your water and meals.')}`,`URL:${url}`,
    'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEsc('Log your day in Kuestro')}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR');
  download(L.join('\r\n'),'kuestro-evening-checkin.ics','text/calendar');toast('Calendar alert downloaded. Open it to add it.');
}
document.addEventListener('change',e=>{const t=e.target;if(!S||!t||!t.dataset||!t.dataset.nudge)return;
  if(t.dataset.nudge==='on')S.settings.nudge=t.checked;else S.settings.nudgeTime=/^\d\d:\d\d$/.test(t.value)?t.value:NUDGE_DEF;
  S.settings.nudgeDone='';S.settings.nudgeNote='';save();nudgeShown=false;toast('Saved ✓');
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-nact]');if(!S||!b)return;const a=b.dataset.nact;
  if(a==='dismiss'){S.settings.nudgeDone=todayK();save();return render()}
  if(a==='ics')return nudgeIcs();
  if(a==='perm'){try{const p=await Notification.requestPermission();toast(p==='granted'?'Notifications on ✓':'Notifications are blocked')}catch(err){toast('Notifications aren’t supported here')}return render()}
  if(a==='test'){toast((await nudgeNotify())?'Test alert sent':'Allow notifications first')}
});

/* ---------- Water & drinks ---------- */
const DRINKS={water:['💧','Water',250],coffee:['☕','Coffee',200],tea:['🍵','Tea',200],milk:['🥛','Milk',250],juice:['🧃','Juice',250],soda:['🥤','Soda',330],other:['🫗','Other drink',250]};
let WM={more:false};
const wData=()=>{const w=S.water=S.water||{};w.goal=+w.goal||2000;w.days=w.days||{};w.auto=w.auto||{};return w};
const wList=k=>wData().days[k]||[];
const wTotal=k=>wList(k).reduce((a,x)=>a+x.ml,0);
const wL=ml=>(Math.round(ml/10)/100)+' L';
function waterSync(k){   // ticks the "Drink water" routine when the goal is reached (and unticks if you remove a drink)
  const W=wData(),tot=wTotal(k),r=S.routines.find(x=>x.link==='water');if(!r)return false;
  S.done[k]=S.done[k]||{};
  if(tot>=W.goal&&!S.done[k][r.id]){S.done[k][r.id]=Date.now();W.auto[k]=1;return true}
  if(tot<W.goal&&W.auto[k]&&S.done[k][r.id]){delete S.done[k][r.id];delete W.auto[k]}
  return false;
}
function waterAdd(type,ml,k){
  if(!(ml>0))return;const W=wData(),now=new Date();
  (W.days[k]=W.days[k]||[]).push({id:uid(),t:type,ml:Math.round(ml),at:pad(now.getHours())+':'+pad(now.getMinutes())});
  const hit=waterSync(k);save();render();
  if(hit){toast('💧 Goal reached! Water routine done');burst(innerWidth/2,innerHeight/2,'skincare');checkProgress()}
}
function waterCardHTML(d){
  const k=key(d),W=wData(),tot=wTotal(k),pct=Math.min(100,Math.round(tot/W.goal*100)),list=[...wList(k)].reverse(),by={};
  wList(k).forEach(x=>by[x.t]=(by[x.t]||0)+x.ml);
  const q=(t,ml,l)=>`<button class="wbtn" data-wadd="${t}:${ml}"><span>${DRINKS[t][0]}</span><b>${l}</b><small>${ml} ml</small></button>`;
  return `<div class="card water" data-cid="water"><div class="sec-h"><span>💧 Water & drinks</span><select class="wgoal" data-wgoal aria-label="Daily goal">${[1500,2000,2500,3000,3500,4000].map(v=>`<option value="${v}" ${W.goal===v?'selected':''}>🎯 ${wL(v)}</option>`).join('')}</select></div>
    <div class="wtot"><b>${wL(tot)}</b><span class="meta">of ${wL(W.goal)}</span><span class="meta wleft">${tot>=W.goal?'🎉 Goal reached!':wL(W.goal-tot)+' to go'}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="wq">${q('water',250,'Cup')}${q('water',500,'Bottle')}${q('coffee',200,'Coffee')}${q('tea',200,'Tea')}<button class="wbtn" data-wmore><span>＋</span><b>More</b><small>other</small></button></div>
    ${WM.more?`<div class="row mt wmore"><select id="wType" data-wtype>${Object.entries(DRINKS).map(([t,[e,n,ml]])=>`<option value="${t}" data-ml="${ml}">${e} ${n}</option>`).join('')}</select><input id="wMl" type="number" inputmode="numeric" min="1" step="10" value="250" aria-label="Millilitres"><button class="btn" style="flex:0 0 auto" data-wcustom>Add</button></div>`:''}
    ${list.length?`<div class="wlist">${list.map(x=>`<div class="wrow"><span>${DRINKS[x.t]?DRINKS[x.t][0]:'🥤'} ${esc(DRINKS[x.t]?DRINKS[x.t][1]:'Drink')} · ${x.ml} ml</span><span class="meta">${esc(x.at||'')}</span><button class="ib" data-wdel="${x.id}" aria-label="Remove">×</button></div>`).join('')}</div><div class="meta mt">${Object.entries(by).map(([t,ml])=>`${DRINKS[t]?DRINKS[t][0]:'🥤'} ${wL(ml)}`).join(' · ')}</div>`:'<div class="meta" style="margin-top:8px">Tap a drink each time you have one, and watch the bar fill up.</div>'}</div>`;
}
document.addEventListener('click',e=>{if(!S)return;const c=s=>e.target.closest(s);let el;
  if(el=c('[data-wadd]')){const [t,ml]=el.dataset.wadd.split(':');return waterAdd(t,+ml,key(viewDate))}
  if(c('[data-wmore]')){WM.more=!WM.more;return render()}
  if(c('[data-wcustom]')){return waterAdd($('#wType').value,+$('#wMl').value,key(viewDate))}
  if(el=c('[data-wdel]')){const k=key(viewDate),W=wData();W.days[k]=wList(k).filter(x=>x.id!==el.dataset.wdel);waterSync(k);save();return render()}
});
document.addEventListener('change',e=>{const t=e.target;if(!S||!t||!t.dataset)return;
  if('wtype' in t.dataset){const o=t.selectedOptions[0];if(o&&$('#wMl'))$('#wMl').value=o.dataset.ml;return}
  if('wgoal' in t.dataset){const W=wData();W.goal=+t.value||2000;
    const r=S.routines.find(x=>x.link==='water');if(r&&/^Drink [\d.]+ ?L of water$/i.test(r.name))r.name='Drink '+wL(W.goal).replace(' L','L')+' of water';
    waterSync(key(viewDate));save();render()}
});

/* ---------- Meals card on Today (quick add, today's meals, log again) ---------- */
const MEAL_ICON={Breakfast:'🌅',Lunch:'🍽️',Dinner:'🌙',Snack:'🍎'};
function mealsCardHTML(d){
  const k=key(d),t=dayTotals(k),n=S.nut=S.nut||{kcal:0,p:0},meals=S.logs.filter(l=>l.type==='meal'&&l.date===k).sort((a,b)=>a.ts-b.ts);
  const bar=(v,g,l)=>g>0?`<div class="meta" style="margin-top:6px">${l}: ${r0(v)} / ${g}</div><div class="bar sm"><i style="width:${Math.min(100,Math.round(v/g*100))}%;${v>g?'background:var(--warn)':''}"></i></div>`:'';
  const seen=new Set(),again=[...S.logs].reverse().filter(l=>l.type==='meal'&&l.items&&l.items.length&&l.food).filter(l=>{if(seen.has(l.food))return false;seen.add(l.food);return true}).slice(0,3);
  return `<div class="card meals" data-cid="meals"><div class="sec-h"><span>🥗 Meals</span><span class="meta"><b>${r0(t.k)}</b> kcal</span></div>
    <div class="meta">Protein ${r0(t.p)} g · Carbs ${r0(t.c)} g · Fat ${r0(t.f)} g</div>${bar(t.k,n.kcal,'Calories')}${bar(t.p,n.p,'Protein g')}
    <div class="wq mq4">${Object.entries(MEAL_ICON).map(([sl,e])=>`<button class="wbtn" data-mealadd="${sl}"><span>${e}</span><b>${sl}</b><small>+ add</small></button>`).join('')}</div>
    ${meals.length?`<div class="wlist">${meals.map(l=>`<div class="wrow"><span>${MEAL_ICON[l.slot]||'🥗'} ${esc(l.slot||'Meal')} · ${esc((l.food||'').slice(0,56))}${(l.food||'').length>56?'…':''}</span><span class="meta">${l.kcal?l.kcal+' kcal':''}</span><button class="ib" data-delmeal="${l.id}" aria-label="Remove">×</button></div>`).join('')}</div>`:'<div class="meta" style="margin-top:8px">No meals logged yet. Tap a meal above to add what you ate.</div>'}
    ${again.length?`<div class="meta mt">Log again with one tap:</div><div class="again">${again.map(l=>`<span class="pill" data-mealagain="${l.id}">${esc(l.slot||'Meal')}: ${esc(l.food.slice(0,22))}${l.food.length>22?'…':''} · ${l.kcal} kcal</span>`).join('')}</div>`:''}</div>`;
}
document.addEventListener('click',e=>{if(!S)return;const c=s=>e.target.closest(s);let el;
  if(el=c('[data-mealadd]')){logType='meal';MB.slot=el.dataset.mealadd;MB.back=true;MB.date=key(viewDate);return show('log')}
  if(el=c('[data-delmeal]')){S.logs=S.logs.filter(l=>l.id!==el.dataset.delmeal);save();return render()}
  if(el=c('[data-mealagain]')){const l=S.logs.find(x=>x.id===el.dataset.mealagain);if(!l)return;
    S.logs.push({...l,id:uid(),ts:Date.now(),date:key(viewDate),items:l.items.map(i=>({...i}))});save();checkProgress();render();floatXP(0,0,'+'+XP_LOG+' XP');return toast('Meal logged again ✓')}
});

/* ---------- Meal calculator (calories, protein, carbs, fat) ---------- */
let MB={items:[],custom:false,goals:false,sug:[],back:false,date:null};
const r0=Math.round,r1=n=>Math.round(n*10)/10,todayKey=()=>key(new Date());
const GEN_U={cup:240,tbsp:15,tsp:5,slice:30,handful:28,scoop:30,can:330,bowl:250,plate:300,loaf:100,sandwich:200,bar:45,square:10,bag:28};
const UNIT_RE='cups?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|pcs?|scoops?|handfuls?|cans?|bowls?|plates?|loaf|loaves|sandwich(?:es)?|servings?|portions?|bars?|squares?|bags?|medium|large|small';
const normU=u=>({tablespoon:'tbsp',tablespoons:'tbsp',teaspoon:'tsp',teaspoons:'tsp',cups:'cup',slices:'slice',pieces:'piece',pcs:'piece',pc:'piece',serving:'piece',servings:'piece',portion:'piece',portions:'piece',scoops:'scoop',handfuls:'handful',cans:'can',bowls:'bowl',plates:'plate',loaves:'loaf',sandwiches:'sandwich',bars:'bar',squares:'square',bags:'bag',medium:'piece',large:'piece',small:'piece'}[u]||u);
const COUNTABLE=new Set(['egg','white','banana','apple','orange','mandarin','date','fig','piece','biscuit','slice','loaf','potato','tomato','cucumber','carrot','onion','avocado','mango','guava','pear','peach','zucchini','burger','sandwich','can','bag','bar','square']);
const allFoods=()=>[...(S.foods||[]).map(x=>({...x,mine:1})),...FOODS];
const mGrams=it=>it.mode==='u'?it.q*it.ug:it.q;
const mNutr=it=>{const g=mGrams(it),m=g/100;return {g,k:it.k*m,p:it.p*m,c:it.c*m,f:it.f*m}};
const rxEsc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function foodScore(f,q){
  const toks=q.split(/\s+/).filter(Boolean).map(t=>t.length>3&&t.endsWith('s')?t.slice(0,-1):t);
  if(!toks.length)return 0;
  const name=f.n.toLowerCase(),al=(f.a||'').toLowerCase().split(',').map(x=>x.trim()),hay=name+' '+al.join(' ');
  let sc=0;
  for(const t of toks){if(!new RegExp('(^|[\\s,(])'+rxEsc(t)).test(hay))return 0;sc+=3}
  if(name===q||al.includes(q))sc+=20;else if(name.startsWith(toks[0]))sc+=4;
  if(f.mine)sc+=2;
  return sc-name.length*.02;
}
function findFoods(q,n=7){
  q=q.toLowerCase().replace(/\s+/g,' ').trim();if(!q)return [];
  return allFoods().map(f=>[foodScore(f,q),f]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
}
function makeItem(f,qty,unit){
  const it={id:uid(),n:f.n,k:f.k,p:f.p,c:f.c,f:f.f,u:f.u||'',ug:f.ug||0,mode:'g',q:100};
  if(qty==null){if(it.ug){if(COUNTABLE.has(it.u)){it.mode='u';it.q=1}else it.q=it.ug}}  // eggs, bananas… are counted; everything else starts in grams so typing "200" means 200 g
  else if(unit==='g')it.q=qty;
  else if(unit&&unit===it.u){it.mode='u';it.q=qty}
  else if(!unit||unit==='piece'){if(it.ug){it.mode='u';it.q=qty}else it.q=qty*100}
  else it.q=qty*(GEN_U[unit]||100);
  return it;
}
function parseMealText(text){
  const out=[],miss=[],W={half:.5,one:1,two:2,three:3,four:4,five:5,a:1,an:1};
  text.split(/[\n,;+،]|\band\b/i).map(s=>s.trim()).filter(Boolean).forEach(part=>{
    let s=' '+part.toLowerCase()+' ',qty=null,unit='';
    s=s.replace(/\b(of|the|some)\b/g,' ');
    let m=s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gm|grams?|ml)\b/);
    if(m){qty=parseFloat(m[1].replace(',','.'));if(m[2]==='kg')qty*=1000;unit='g';s=s.slice(0,m.index)+' '+s.slice(m.index+m[0].length)}
    else{
      s=s.trim();
      m=s.match(/^(\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:x\s*)?/);
      if(m){const v=m[1];qty=v.includes('/')?v.split('/')[0]/v.split('/')[1]:parseFloat(v.replace(',','.'));s=s.slice(m[0].length)}
      else{m=s.match(/^(half|one|two|three|four|five|an?)\s+/);if(m){qty=W[m[1]];s=s.slice(m[0].length)}}
      const um=s.match(new RegExp('^('+UNIT_RE+')\\b\\s*'));
      if(um){unit=normU(um[1]);s=s.slice(um[0].length)}
    }
    s=s.replace(/\s+/g,' ').trim();if(!s)return;
    const f=findFoods(s,1)[0];
    if(!f)miss.push(part);else out.push(makeItem(f,qty,unit));
  });
  return {out,miss};
}
const mDay=()=>(document.getElementById('mealDate')||{}).value||todayKey();
function mealTotals(items){return items.reduce((t,it)=>{const x=mNutr(it);t.k+=x.k;t.p+=x.p;t.c+=x.c;t.f+=x.f;return t},{k:0,p:0,c:0,f:0})}
function dayTotals(date){return S.logs.filter(l=>l.type==='meal'&&l.date===date).reduce((t,l)=>{t.k+=+l.kcal||0;t.p+=+l.p||0;t.c+=+l.c||0;t.f+=+l.f||0;t.n++;return t},{k:0,p:0,c:0,f:0,n:0})}
function mealHTML(){
  const hour=new Date().getHours(),slot=MB.slot||(hour<11?'Breakfast':hour<16?'Lunch':hour<21?'Dinner':'Snack');
  return `<h2>🥗 Log meal</h2><div id="mealDay"></div>
    <label class="f">Meal</label><select name="slot">${['Breakfast','Lunch','Dinner','Snack'].map(o=>`<option ${o===slot?'selected':''}>${o}</option>`).join('')}</select>
    <label class="f">Add food</label><input id="foodQ" placeholder="Search: chicken, rice, banana, بيض…" autocomplete="off"><div id="foodSug"></div>
    <label class="f">Or type what you ate</label><textarea id="mealText" rows="2" placeholder="2 eggs, 150g chicken breast, 1 cup rice, 1 tbsp olive oil"></textarea>
    <button type="button" class="btn ghost full mt" data-mact="parse">✨ Calculate from my text</button><div class="meta mt" id="mealMsg"></div>
    <div id="mealItems"></div><div id="mealTot"></div>
    <button type="button" class="linkbtn" data-mact="custom">${MB.custom?'− Hide custom food':'＋ Add my own food (packaged or homemade)'}</button><div id="mealCustom"></div>
    <label class="f">Date</label><input type="date" id="mealDate" name="date" value="${MB.date||todayKey()}">
    <div style="margin-top:12px"><button class="btn full">Save meal</button></div><p class="meta mt">Values are approximate (cooked or ready-to-eat food). Check the packaging for exact numbers.</p>`;
}
function drawMeal(){
  drawMealDay();drawSug();drawItems();drawCustom();
}
function drawMealDay(){
  const el=$('#mealDay');if(!el)return;const n=S.nut=S.nut||{kcal:0,p:0},d=mDay(),t=dayTotals(d),isT=d===todayKey();
  const bar=(v,g,l)=>g>0?`<div class="meta" style="margin-top:6px">${l}: ${r0(v)} / ${g}</div><div class="bar sm"><i style="width:${Math.min(100,Math.round(v/g*100))}%;${v>g?'background:var(--warn)':''}"></i></div>`:'';
  el.innerHTML=`<div class="mday"><div class="sec-h"><span>${isT?'Today so far':'That day'}: <b>${r0(t.k)} kcal</b></span><button type="button" class="pill" data-mact="goals">🎯 Goals</button></div>
    <div class="meta">Protein ${r0(t.p)} g · Carbs ${r0(t.c)} g · Fat ${r0(t.f)} g · ${t.n} meal${t.n===1?'':'s'}</div>${bar(t.k,n.kcal,'Calories')}${bar(t.p,n.p,'Protein g')}
    ${MB.goals?`<div class="row mt"><label class="mini">Daily calories<input type="number" inputmode="numeric" min="0" data-nut="kcal" value="${n.kcal||''}" placeholder="e.g. 2200"></label><label class="mini">Daily protein (g)<input type="number" inputmode="numeric" min="0" data-nut="p" value="${n.p||''}" placeholder="e.g. 120"></label></div>`:''}</div>`;
}
function drawSug(){
  const el=$('#foodSug');if(!el)return;const q=($('#foodQ')||{}).value||'';
  let list;
  if(q.trim())list=findFoods(q);
  else{const seen=new Set();list=[];[...S.logs].reverse().filter(l=>l.type==='meal'&&l.items).forEach(l=>l.items.forEach(i=>{if(list.length<6&&!seen.has(i.n)){seen.add(i.n);const f=allFoods().find(x=>x.n===i.n);if(f)list.push(f)}}))}
  MB.sug=list;
  el.innerHTML=(list.length?(q.trim()?'':'<div class="meta" style="margin-top:6px">Recent foods</div>'):q.trim()?'<div class="meta" style="margin-top:6px">No match. Try another word, or add your own food below.</div>':'')+list.map((f,i)=>`<div class="sugrow"><button type="button" class="sug" data-addfood="${i}"><span>${f.mine?'🙋 ':''}${esc(f.n)}</span><small>${r0(f.k)} kcal · P ${r0(f.p)} /100 g</small></button>${f.mine?`<button type="button" class="ib" data-delfood="${esc(f.id)}" aria-label="Delete my food">×</button>`:''}</div>`).join('');
}
function drawItems(){
  const el=$('#mealItems');if(!el)return;
  el.innerHTML=MB.items.length?MB.items.map(it=>`<div class="mrow"><div class="grow"><b>${esc(it.n)}</b><div class="meta" data-mm="${it.id}"></div></div><input class="mq" type="number" inputmode="decimal" step="any" min="0" data-mq="${it.id}" value="${it.q}" aria-label="Amount"><select class="mu" data-mu="${it.id}" aria-label="Unit"><option value="g" ${it.mode==='g'?'selected':''}>g</option>${it.ug?`<option value="u" ${it.mode==='u'?'selected':''}>${esc(it.u)}</option>`:''}</select><button type="button" class="ib" data-mdel="${it.id}" aria-label="Remove">×</button></div>`).join(''):'<div class="empty">Nothing added yet. Search a food above or type your meal.</div>';
  refreshMeal();
}
function refreshMeal(){
  MB.items.forEach(it=>{const e=document.querySelector(`[data-mm="${it.id}"]`);if(!e)return;const x=mNutr(it);e.textContent=`${r0(x.k)} kcal · P ${r1(x.p)} · C ${r1(x.c)} · F ${r1(x.f)}${it.mode==='u'?` · ${r0(x.g)} g`:''}`});
  const el=$('#mealTot');if(!el)return;const t=mealTotals(MB.items);if(!MB.items.length){el.innerHTML='';return}
  const ec=t.p*4+t.c*4+t.f*9||1,pc=Math.round(t.p*4/ec*100),cc=Math.round(t.c*4/ec*100);
  el.innerHTML=`<div class="mtot"><div><b>${r0(t.k)}</b><span>kcal</span></div><div><b style="color:#e5605c">${r1(t.p)}</b><span>protein g</span></div><div><b style="color:#d9962b">${r1(t.c)}</b><span>carbs g</span></div><div><b style="color:#4f7fe0">${r1(t.f)}</b><span>fat g</span></div></div>
    <div class="msplit" title="Share of calories"><i style="width:${pc}%;background:#e5605c"></i><i style="width:${cc}%;background:#f5b942"></i><i style="flex:1;background:#5b8def"></i></div><div class="meta">Calories from protein ${pc}% · carbs ${cc}% · fat ${Math.max(0,100-pc-cc)}%</div>`;
}
function drawCustom(){
  const el=$('#mealCustom');if(!el)return;
  el.innerHTML=MB.custom?`<div class="mday"><input id="cfName" placeholder="Food name" autocomplete="off"><div class="row mt"><label class="mini">These values are for (g)<input id="cfAmt" type="number" inputmode="decimal" min="1" value="100"></label><label class="mini">Calories<input id="cfK" type="number" inputmode="decimal" min="0"></label></div>
    <div class="row mt"><label class="mini">Protein g<input id="cfP" type="number" inputmode="decimal" min="0"></label><label class="mini">Carbs g<input id="cfC" type="number" inputmode="decimal" min="0"></label><label class="mini">Fat g<input id="cfF" type="number" inputmode="decimal" min="0"></label></div>
    <button type="button" class="btn full mt" data-mact="cfsave">Save food & add to meal</button><p class="meta mt">Tip: copy the numbers from the package label. It is saved so you can find it by name next time.</p></div>`:'';
}
function mealAddText(){
  const ta=$('#mealText'),msg=$('#mealMsg');if(!ta)return;
  const {out,miss}=parseMealText(ta.value);
  if(out.length){MB.items.push(...out);ta.value='';drawItems()}
  msg.textContent=out.length||miss.length?`${out.length?`Added ${out.length} item${out.length===1?'':'s'}. Check the amounts below. `:''}${miss.length?`Couldn’t find: ${miss.join(', ')}. Search it above or add your own food.`:''}`:'Type what you ate first, e.g. “2 eggs, 150g chicken, 1 cup rice”.';
}
function saveMeal(frm){
  if(!MB.items.length&&(($('#mealText')||{}).value||'').trim())mealAddText();
  if(!MB.items.length)return toast('Add what you ate first');
  const date=frm.date.value||todayKey(),t=mealTotals(MB.items);
  const items=MB.items.map(it=>{const x=mNutr(it);return {n:it.n,g:r0(x.g),k:r0(x.k),p:r1(x.p),c:r1(x.c),f:r1(x.f)}});
  S.logs.push({id:uid(),ts:Date.now(),type:'meal',slot:frm.slot.value,food:items.map(i=>`${i.n} ${i.g}g`).join(', '),kcal:r0(t.k),p:r1(t.p),c:r1(t.c),f:r1(t.f),items,date});
  const back=MB.back;MB.items=[];MB.slot=null;MB.back=false;MB.date=null;autoTick('meal',parse(date));save();checkProgress();floatXP(0,0,'+'+XP_LOG+' XP');toast('Meal logged ✓');
  if(back)show('today');else renderLog();
}
document.addEventListener('input',e=>{const t=e.target;if(!S||!t)return;
  if(t.id==='foodQ')return drawSug();
  if(t.dataset&&t.dataset.mq){const it=MB.items.find(x=>x.id===t.dataset.mq);if(it){it.q=Math.max(0,parseFloat(t.value)||0);refreshMeal()}}
});
document.addEventListener('change',e=>{const t=e.target;if(!S||!t)return;
  if(t.dataset&&t.dataset.mu){const it=MB.items.find(x=>x.id===t.dataset.mu);if(it){const g=mGrams(it);it.mode=t.value;it.q=it.mode==='u'?Math.round(g/it.ug*100)/100:Math.round(g);drawItems()}return}
  if(t.dataset&&t.dataset.nut){S.nut=S.nut||{kcal:0,p:0};S.nut[t.dataset.nut]=Math.max(0,+t.value||0);save();drawMealDay();return}
  if(t.id==='mealDate')drawMealDay();
});
document.addEventListener('click',e=>{if(!S)return;const c=s=>e.target.closest(s);let el;
  if(el=c('[data-addfood]')){const f=MB.sug[+el.dataset.addfood];if(f){MB.items.push(makeItem(f,null,''));$('#foodQ').value='';$('#mealMsg').textContent='';drawSug();drawItems()}return}
  if(el=c('[data-delfood]')){if(confirm('Delete this food from your list?')){S.foods=(S.foods||[]).filter(x=>x.id!==el.dataset.delfood);save();drawSug()}return}
  if(el=c('[data-mdel]')){MB.items=MB.items.filter(x=>x.id!==el.dataset.mdel);drawItems();return}
  if(el=c('[data-mact]')){
    const a=el.dataset.mact;
    if(a==='parse')return mealAddText();
    if(a==='goals'){MB.goals=!MB.goals;return drawMealDay()}
    if(a==='custom'){MB.custom=!MB.custom;el.textContent=MB.custom?'− Hide custom food':'＋ Add my own food (packaged or homemade)';return drawCustom()}
    if(a==='cfsave'){
      const name=$('#cfName').value.trim(),amt=+$('#cfAmt').value||100,v=id=>+$(id).value||0,k=$('#cfK').value;
      if(!name)return toast('Give the food a name');if(k==='')return toast('Enter the calories');
      const m=100/amt,f={id:uid(),n:name,a:'',k:+k*m,p:v('#cfP')*m,c:v('#cfC')*m,f:v('#cfF')*m,u:'',ug:0};
      (S.foods=S.foods||[]).push(f);const it=makeItem(f,amt,'g');MB.items.push(it);MB.custom=false;save();drawMeal();
      const b=document.querySelector('[data-mact="custom"]');if(b)b.textContent='＋ Add my own food (packaged or homemade)';toast('Food saved ✓');return
    }
  }
});

/* ---------- AI coach ---------- */
function coachPrompt(q){
  const since=key(addDays(new Date(),-27)),L=[];
  L.push('You are my personal fitness coach. Use my plan and my real training data below. Be specific and practical, keep it short, and flag anything risky (overtraining, sudden mileage jumps, too little recovery).','',`My question: ${q}`,'',`Today is ${new Date().toDateString()}.`,'','MY WORKOUT PLAN:',S.ai.plan||'(see my training program below)');
  if(T_().plan.length){L.push('',`MY TRAINING PROGRAM (rotates on ${T_().mode==='cycle'?trainSched():T_().days.map(i=>DAYS[i]).join(', ')}; next up: ${nextW()?.name}):`);
    T_().plan.forEach((p,i)=>L.push(`Day ${i+1} ${p.name} (${p.focus||''}): `+p.ex.map(e=>`${e.name} ${e.sets}x${e.reps}${e.w?` @ ${e.w}${T_().unit}`:''}`).join('; ')));
    const rs=T_().sessions.filter(x=>x.date>=since);if(rs.length){L.push('','RECENT WORKOUT SESSIONS (weight x reps):');rs.forEach(x=>L.push(`${x.date} ${x.name} (${x.dur} min): `+x.ex.map(e=>`${e.name} `+e.sets.map(s=>`${s.w}x${s.r}`).join(', ')).join(' | ')))}}
  L.push('','MY SCHEDULED EXERCISE ROUTINES:');
  S.routines.filter(r=>['exercise','running'].includes(r.cat)).forEach(r=>{let due=0,dn=0;for(let i=0;i<28;i++){const d=addDays(new Date(),-i);if(isDue(r,d)){due++;if(isDone(r.id,d))dn++}}
    L.push(`- ${r.name}: ${freqText(r)}${r.time?' at '+r.time:''}. Done ${dn} of ${due} times in the last 4 weeks.`)});
  L.push('','TRAINING LOG (last 28 days):');
  const logs=S.logs.filter(l=>l.date>=since&&(l.type==='run'||l.type==='workout')).sort((a,b)=>a.date.localeCompare(b.date));
  logs.forEach(l=>L.push(`${l.date} ${LOG[l.type].label}: ${LOG[l.type].sum(l)}${l.src?' ('+l.src+')':''}`));
  if(!logs.length)L.push('(nothing logged)');
  const hs=Object.entries(S.health).filter(([d])=>d>=since).sort();
  if(hs.length){L.push('','DAILY HEALTH DATA (Apple Health):');hs.forEach(([d,v])=>L.push(`${d}: ${Object.entries(v).map(([k,x])=>`${k.replace(/_/g,' ')} ${x}`).join(', ')}`))}
  return L.join('\n');
}
function fmtAI(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#{1,4} (.+)$/gm,'<b>$1</b>')}
async function callClaude(prompt){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.ai.claudeKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.ai.claudeModel,max_tokens:1500,messages:[{role:'user',content:prompt}]})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||r.status);
  return j.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
}
async function callOpenAI(prompt){
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+S.ai.openaiKey},
    body:JSON.stringify({model:S.ai.openaiModel,messages:[{role:'user',content:prompt}]})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||r.status);
  return j.choices[0].message.content;
}
async function askAI(which){
  S.ai.plan=$('#aiPlan').value;save();
  const q=$('#aiQ').value.trim()||'Review my workout plan against what I actually did. What should I change next week?';
  const text=await runAI(which,coachPrompt(q),$('#aiAnswer'));
  if(text&&S){S.ai.last={which,q,text,at:Date.now()};save()}
}
async function runAI(which,prompt,box,forceApp){
  const hasKey=which==='claude'?S.ai.claudeKey:S.ai.openaiKey;
  if(hasKey&&!forceApp){
    box.innerHTML='<span class="meta">Thinking…</span>';
    try{const text=which==='claude'?await callClaude(prompt):await callOpenAI(prompt);if(!S)return;box.innerHTML=fmtAI(text);return text}
    catch(e){box.innerHTML=`<span class="meta">Error: ${esc(e.message)}. Check your key and model name in Connect.</span>`}
    return;
  }
  try{await navigator.clipboard.writeText(prompt)}catch(e){}
  const url=(which==='claude'?'https://claude.ai/new?q=':'https://chatgpt.com/?q=')+encodeURIComponent(prompt.slice(0,6000));
  window.open(url,'_blank','noopener');
  toast('Your plan + data are copied. Paste them if they don’t appear.');
}

/* ---------- Strava ---------- */
const redirectUri=()=>location.origin+location.pathname;
async function stravaConnect(){
  const st=uid()+uid();localStorage.setItem(OSTATE,st);await chain;
  location.href=`https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(S.strava.clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri())}&approval_prompt=auto&scope=${encodeURIComponent('read,activity:read_all')}&state=${st}`;
}
async function stravaToken(params){
  const r=await fetch('https://www.strava.com/oauth/token',{method:'POST',body:new URLSearchParams({client_id:S.strava.clientId,client_secret:S.strava.clientSecret,...params})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token)throw new Error(j.message||`Strava refused (${r.status})`);
  Object.assign(S.strava,{access:j.access_token,refresh:j.refresh_token,expires:j.expires_at});
  if(j.athlete)S.strava.athlete=[j.athlete.firstname,j.athlete.lastname].filter(Boolean).join(' ');
  save();
}
async function stravaExchange(code){
  try{toast('Connecting Strava…');await stravaToken({code:code.trim(),grant_type:'authorization_code'});toast('Strava connected ✓');await stravaSync()}
  catch(e){toast('Strava: '+e.message)}
  if(S&&view==='connect')renderConnect();
}
async function stravaSync(quiet){
  const s=S&&S.strava;if(!s||!s.refresh)return;
  try{
    if(Date.now()/1000>s.expires-120)await stravaToken({refresh_token:s.refresh,grant_type:'refresh_token'});
    const after=s.after||Math.floor(Date.now()/1000)-30*86400;let page=1,added=0,max=after;
    while(page<=5){
      const r=await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,{headers:{Authorization:'Bearer '+s.access}});
      if(!r.ok)throw new Error(r.status===401?'permission expired, please reconnect':`sync failed (${r.status})`);
      const list=await r.json();if(!S)return;
      for(const a of list){
        const t=Math.floor(Date.parse(a.start_date)/1000);if(t>max)max=t;
        const ext='strava:'+a.id;if(S.logs.some(l=>l.ext===ext))continue;
        const date=String(a.start_date_local).slice(0,10),sport=String(a.sport_type||a.type||'Workout'),min=Math.round((a.moving_time||0)/60),isRun=/run/i.test(sport);
        if(isRun)S.logs.push({id:uid(),ts:Date.now(),type:'run',date,km:+((a.distance||0)/1000).toFixed(2),min,note:a.name||'',ext,src:'Strava'});
        else S.logs.push({id:uid(),ts:Date.now(),type:'workout',date,kind:`${sport.replace(/([a-z])([A-Z])/g,'$1 $2')} · ${a.name||''}`,min,ext,src:'Strava'});
        autoTick(isRun?'run':'workout',parse(date));added++;
      }
      if(list.length<100)break;page++;
    }
    s.after=max;s.lastSync=Date.now();save();checkProgress();
    if(!quiet||added)toast(added?`Strava: ${added} new activit${added===1?'y':'ies'}`:'Strava: up to date');
    render();
  }catch(e){if(!quiet)toast('Strava: '+e.message)}
}
async function stravaOff(){
  if(!confirm('Disconnect Strava? Activities already imported stay in your log.'))return;
  try{await fetch('https://www.strava.com/oauth/deauthorize',{method:'POST',body:new URLSearchParams({access_token:S.strava.access})})}catch(e){}
  Object.assign(S.strava,{access:'',refresh:'',expires:0,athlete:'',after:0,lastSync:0});save();renderConnect();
}

/* ---------- Apple Health (via iOS Shortcut → clipboard) ---------- */
function parseNum(v){
  const m=String(v).match(/-?[\d.,]+/);if(!m)return null;let s=m[0];
  if(s.includes('.')&&s.includes(','))s=s.replace(/,/g,'');else if(s.includes(','))s=/,\d{1,2}$/.test(s)?s.replace(',','.'):s.replace(/,/g,'');
  const n=parseFloat(s);return isNaN(n)?null:n;
}
function importHealth(text){
  if(!/DAYFLOW|KUESTRO/i.test(text||''))throw new Error('No Kuestro health data found. Run the Shortcut first.');
  let date=key(new Date());const vals={};
  text.split(/\r?\n/).forEach(line=>{const m=line.match(/^\s*([a-z_]+)\s*[=:]\s*(.+)$/i);if(!m)return;const k=m[1].toLowerCase();
    if(k==='date'){const d=m[2].match(/\d{4}-\d{2}-\d{2}/);if(d)date=d[0]}
    else if(HKEYS[k]){const n=parseNum(m[2]);if(n!=null)vals[k]=Math.round(n*10)/10}});
  if(!Object.keys(vals).length)throw new Error('Found the header but no numbers.');
  S.health[date]={...S.health[date],...vals};save();checkProgress();return date;
}
const HEALTH_STEPS=`<ol class="meta">
<li>Open the <b>Shortcuts</b> app → <b>+</b>. Name it <b>Kuestro Health</b>.</li>
<li>Add <b>Find Health Samples</b>: Type <i>Steps</i>, Start Date <i>is today</i>. Then add <b>Calculate Statistics</b> → <i>Sum</i>.</li>
<li>Repeat for <i>Active Energy</i> (Sum) and <i>Exercise Minutes</i> (Sum). Optional: <i>Weight</i> → sort by Start Date, Latest First, Limit 1.</li>
<li>Add a <b>Text</b> action and type this, inserting each result where shown:<br><code>KUESTRO<br>steps=[Steps sum]<br>active_kcal=[Active Energy sum]<br>exercise_min=[Exercise sum]<br>weight=[Weight]</code></li>
<li>Add <b>Copy to Clipboard</b>. Run it once and allow Health access.</li>
<li>Optional: <b>Automation</b> tab → Time of Day (e.g. 9:30 PM) → run Kuestro Health, so it’s ready every evening.</li>
<li>Open Kuestro → <b>Import from Health</b>.</li></ol>`;

/* ---------- Connect tab ---------- */
function renderConnect(){
  const s=S.strava,dis=KEY?'':'disabled',a=S.ai;
  let h=KEY
    ?`<div class="card ok"><b>🔒 Private and encrypted.</b><p class="meta" style="margin-top:4px">Everything is stored only on this phone, encrypted with your passcode. People who open your GitHub Pages link just see an empty, locked-down copy of the app.</p></div>`
    :`<div class="card warn"><b>🔓 Set a passcode first</b><p class="meta" style="margin-top:4px">Connecting accounts means storing private keys. Kuestro only stores them encrypted, so turn on a passcode first.</p><button class="btn" data-act="goSecurity">Set passcode</button></div>`;
  // Strava
  h+=`<div class="card"><h2>🟧 Strava</h2>`;
  if(s.refresh){
    h+=`<p class="meta">Connected${s.athlete?' as <b>'+esc(s.athlete)+'</b>':''}. Last sync: ${s.lastSync?new Date(s.lastSync).toLocaleString():'never'}. Runs become run logs and other activities become workouts. It syncs automatically when you open the app.</p><div class="row"><button class="btn" data-act="stravaSync">Sync now</button><button class="btn danger" data-act="stravaOff">Disconnect</button></div>`;
  }else{
    h+=`<fieldset ${dis}><p class="meta">Imports your runs and workouts automatically. It uses your own free Strava API key, so nobody else is involved.</p>
    <details ${s.clientId?'':'open'}><summary>One-time setup (5 min)</summary><ol class="meta">
      <li>Open <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer">strava.com/settings/api</a> and create an app: name <i>Kuestro</i>, category <i>Training</i>, website = your app link.</li>
      <li>Set <b>Authorization Callback Domain</b> to <code>${esc(location.hostname||'YOUR-USERNAME.github.io')}</code></li>
      <li>Paste the <b>Client ID</b> and <b>Client Secret</b> below and tap Connect.</li></ol></details>
    <form id="fStrava" class="mt"><div class="row"><input name="clientId" placeholder="Client ID" inputmode="numeric" value="${esc(s.clientId)}" autocomplete="off"><input name="clientSecret" type="password" placeholder="${s.clientSecret?'Secret saved ✓':'Client Secret'}" autocomplete="off"></div><button class="btn full mt">Connect Strava</button></form>
    <details><summary>Got a code?</summary><form id="fStravaCode" class="row mt"><input name="code" placeholder="Paste the code or link" autocomplete="off"><button class="btn" style="flex:0 0 auto">Use</button></form></details></fieldset>`;
  }
  h+=`</div>`;
  // Health
  const hd=S.health[key(new Date())];
  h+=`<div class="card"><h2>❤️ Apple Health</h2><p class="meta">Apple doesn’t let websites read Health, so an iPhone Shortcut copies today’s numbers and Kuestro imports them with one tap.${hd?'<br><b>Today:</b> '+esc(healthLine(hd)):''}</p>
    <button class="btn full" data-act="healthImport">Import from Health</button>
    <div id="healthPaste" class="hidden mt"><textarea id="healthText" rows="4" placeholder="Paste the Shortcut’s text here"></textarea><button class="btn ghost full mt" data-act="healthPasteGo">Import pasted text</button></div>
    <details><summary>Set up the Shortcut (once)</summary>${HEALTH_STEPS}</details>
    <p class="meta mt">💡 <b>Workouts:</b> connect Apple Health inside the Strava app’s settings. Your Apple Watch and Health workouts then go to Strava, and from there into Kuestro automatically.</p></div>`;
  // AI
  h+=`<div class="card"><h2>🤖 Claude & ChatGPT</h2><p class="meta">Without keys, the <b>Ask</b> buttons in Log open Claude or ChatGPT with your plan and data. With an API key (billed by them), the answer shows right inside Kuestro.</p>
    <fieldset ${dis}><form id="fAI">
      <label class="f">Claude API key (<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>)</label>
      <div class="row"><input name="claudeKey" type="password" placeholder="${a.claudeKey?'Saved ✓ (type to replace)':'sk-ant-…'}" autocomplete="off"><input name="claudeModel" value="${esc(a.claudeModel)}" style="flex:0 0 40%" aria-label="Claude model"></div>
      <label class="f">OpenAI API key (<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com</a>)</label>
      <div class="row"><input name="openaiKey" type="password" placeholder="${a.openaiKey?'Saved ✓ (type to replace)':'sk-…'}" autocomplete="off"><input name="openaiModel" value="${esc(a.openaiModel)}" style="flex:0 0 40%" aria-label="OpenAI model"></div>
      <div class="row mt"><button class="btn">Save keys</button><button type="button" class="btn danger" data-act="aiClear">Remove keys</button></div>
      <p class="meta mt">Tip: set a low monthly spending limit on each key.</p>
    </form></fieldset></div>`;
  // Prayer
  h+=`<div class="card"><h2>🕌 Prayer app</h2><label class="f">Open this app from the Prayer card on Today</label>
    <select id="prayerAppSel"><option value="">None</option>${S.links.map(l=>`<option value="${l.id}" ${l.id===S.settings.prayerApp?'selected':''}>${esc(l.icon)} ${esc(l.name)}</option>`).join('')}</select>
    <p class="meta mt">Add your prayer app under App shortcuts below, then pick it here. In Settings, choose the same calculation method your app uses so the times match.</p>
    <button class="btn ghost full" data-act="prayerIcs">Add this month’s prayer times to my calendar (with alerts)</button></div>`;
  // App shortcuts
  h+=`<div class="card"><div class="sec-h"><h2 style="margin:0">🧩 App shortcuts</h2><button class="ib" data-act="editLinks" aria-label="Edit">${editLinks?'✓':'✎'}</button></div>
    <div class="grid mt">${S.links.map(l=>`<a class="tile" ${linkAttrs(l.url)}>${editLinks?`<button class="x" data-dellink="${l.id}" aria-label="Remove">×</button>`:''}<b>${esc(l.icon||'🔗')}</b>${esc(l.name)}</a>`).join('')}</div>
    <form id="fLink" class="mt"><h2 style="margin-top:14px">Add an app</h2>
      <div class="row"><input name="icon" placeholder="🙂" maxlength="4" style="flex:0 0 64px"><input name="name" placeholder="Name, e.g. Muslim Pro" required></div>
      <label class="f">How to open it</label>
      <select name="ltype"><option value="web">Website or app link</option><option value="ios">iPhone app (via Shortcuts)</option><option value="android">Android app (package name)</option></select>
      <input name="val" class="mt" placeholder="https://…" required autocomplete="off">
      <p class="meta mt" id="linkHelp">Many apps open directly from their website link.</p>
      <button class="btn full">Add</button></form></div>`;
  // Calendar
  h+=`<div class="card"><h2>📅 Reminders via your calendar</h2><p class="meta">Exports all your routines as repeating events with a 10-minute alert. Open the file on your phone to add them to Apple or Google Calendar.</p><button class="btn ghost full" data-act="ics">Export routines (.ics)</button></div>`;
  $('#connectBody').innerHTML=h;
}
const LINK_HELP={
  web:['https://…','Many apps open directly from their website link.'],
  ios:['Shortcut name, e.g. Open Muslim Pro','In the Shortcuts app, create a shortcut with one action, <b>Open App</b> → pick the app, and give it this exact name. That opens any iPhone app.'],
  android:['e.g. com.bitsmedia.android.muslimpro','Find it in the app’s Play Store link after <code>id=</code>.'],
};

/* ---------- Settings ---------- */
function renderSettings(){
  const f=$('#setForm'),s=S.settings;
  f.prayers.checked=!!s.prayers;applyTheme(getTheme());applyAccent(getAccent());f.sound.checked=s.sound!==false;f.city.value=s.city;f.country.value=s.country;f.method.value=s.method;f.weekStart.value=s.weekStart;f.h12.value=s.h12;
  $('#nudgeBox').innerHTML=nudgeHTML();
  $('#locNote').textContent=s.lat!=null?`Using your location (${(+s.lat).toFixed(2)}, ${(+s.lon).toFixed(2)}). Edit the city and save to switch back.`:`Using ${s.city}, ${s.country}.`;
  $('#secBox').innerHTML=KEY
    ?`<h2>🔒 Passcode lock: on</h2><p class="meta">Your data is encrypted on this phone (AES-256). Without the passcode it can’t be read.</p>
      <label class="f">Lock automatically</label><select id="lockAfter">${[[0,'As soon as I leave the app'],[1,'After 1 minute'],[5,'After 5 minutes'],[15,'After 15 minutes']].map(([v,t])=>`<option value="${v}" ${+s.lockAfter===v?'selected':''}>${t}</option>`).join('')}</select>
      <div class="row mt"><button class="btn ghost" data-act="lockNow">Lock now</button><button class="btn ghost" data-act="changePass">Change</button><button class="btn danger" data-act="removePass">Turn off</button></div>
      <form id="fPass" class="hidden mt"><input name="p1" type="password" placeholder="New passcode (min 4)" autocomplete="new-password"><input name="p2" type="password" class="mt" placeholder="Repeat it" autocomplete="new-password"><button class="btn full mt">Save new passcode</button></form>`
    :`<h2>🔓 Passcode lock: off</h2><p class="meta">Turn it on to encrypt your data on this phone and lock the app when you leave it. It’s required for connecting Strava and AI keys. <b>If you forget it, the data can’t be recovered</b>, so keep a backup.</p>
      <form id="fPass"><input name="p1" type="password" placeholder="Choose a passcode (min 4)" autocomplete="new-password"><input name="p2" type="password" class="mt" placeholder="Repeat it" autocomplete="new-password"><button class="btn full mt">Turn on passcode</button></form>`;
}

function render(){if(!S)return;({today:renderToday,routines:renderRoutines,log:renderLog,connect:renderConnect,settings:renderSettings,quests:renderQuests,learn:renderLearn,hero:renderHero,train:renderTrain,meds:renderMeds,todos:renderTodos,money:renderMoney,progress:renderProgress})[view]()}
function show(v){view=v;$$('main>section').forEach(s=>s.classList.toggle('hidden',s.id!=='v-'+v));const tabOf={connect:'settings',routines:'settings',log:'settings',meds:'settings',money:'settings',hero:'quests',progress:'today'};$$('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===(tabOf[v]||v)));if(v!=='train')TEDIT=false;if(v!=='log'){MB.back=false;MB.date=null}$$('main>section').forEach(x=>x.classList.remove('cx-arr'));render();scrollTo(0,0)}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2600)}

/* ---------- Appearance ---------- */
const getTheme=()=>{try{return localStorage.getItem('dayflow-theme')||'auto'}catch(e){return 'auto'}};
function applyTheme(t){
  try{localStorage.setItem('dayflow-theme',t)}catch(e){}
  const r=document.documentElement;if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);
  const dark=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').setAttribute('content',dark?'#0f1115':'#2f7d6d');
  const b=$('#themeBtn');if(b)b.textContent=t==='dark'?'🌙':t==='light'?'☀️':'🌓';
  $$('#themeChips input').forEach(i=>i.checked=i.value===t);
}
const getAccent=()=>{try{return localStorage.getItem('dayflow-accent')||'teal'}catch(e){return 'teal'}};
function applyAccent(a){try{localStorage.setItem('dayflow-accent',a)}catch(e){}const r=document.documentElement;if(a==='teal')r.removeAttribute('data-accent');else r.setAttribute('data-accent',a);$$('#accentChips input').forEach(i=>i.checked=i.value===a)}
applyAccent(getAccent());
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>applyTheme(getTheme()));
applyTheme(getTheme());

/* ---------- Routine dialog ---------- */
$('#catSel').innerHTML=Object.entries(CATS).map(([k,[i,l]])=>`<option value="${k}">${i} ${l}</option>`).join('');
$('#dayChips').innerHTML=[6,0,1,2,3,4,5].map(i=>`<label><input type="checkbox" name="days" value="${i}"><span>${DAYS[i]}</span></label>`).join('');
function syncFreq(){const v=$('#freqSel').value;$('#fWeekly').classList.toggle('hidden',v!=='weekly');$('#fInterval').classList.toggle('hidden',v!=='interval');$('#fMonthly').classList.toggle('hidden',v!=='monthly')}
$('#freqSel').onchange=syncFreq;
function openRoutine(r){
  editing=r||null;const f=$('#rForm');f.reset();
  const x=r||{name:'',cat:'other',freq:'daily',time:'',note:'',days:[],dom:new Date().getDate(),every:2,start:key(new Date())};
  $('#rDlgTitle').textContent=r?'Edit routine':'New routine';
  f.name.value=x.name;f.cat.value=x.cat;f.freq.value=x.freq;f.time.value=x.time||'';f.note.value=x.note||'';f.dom.value=x.dom;f.every.value=x.every;f.start.value=x.start||key(new Date());
  $$('#dayChips input').forEach(c=>c.checked=(x.days||[]).includes(+c.value));
  $('#rDel').classList.toggle('hidden',!r);syncFreq();$('#rDlg').showModal();
}
$('#rDel').onclick=()=>{if(editing&&confirm(`Delete “${editing.name}”?`)){S.routines=S.routines.filter(r=>r!==editing);save();$('#rDlg').close();render()}};

/* ---------- Calendar exports ---------- */
const icsEsc=s=>String(s).replace(/[\\,;]/g,m=>'\\'+m).replace(/\n/g,'\\n');
const icsHead=name=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kuestro//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:'+name];
const stamp=()=>new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
function routinesIcs(){
  const now=new Date(),BY=['SU','MO','TU','WE','TH','FR','SA'],L=icsHead('Kuestro routines'),st=stamp();
  S.routines.forEach(r=>{
    if(r.link==='train'&&S.train.mode==='cycle'){for(let i=0;i<60;i++){const d=addDays(now,i);if(!isTrainDay(d))continue;const ds=key(d).replace(/-/g,'');
      L.push('BEGIN:VEVENT',`UID:${r.id}-${ds}@dayflow`,`DTSTAMP:${st}`,`SUMMARY:${icsEsc(CATS[r.cat][0]+' '+r.name)}`,r.time?`DTSTART:${ds}T${r.time.replace(':','')}00`:`DTSTART;VALUE=DATE:${ds}`,...(r.time?['DURATION:PT20M']:[]),'END:VEVENT')}return}
    if(r.freq==='weekly'&&!r.days.length)return;
    let start=parse(r.start||key(now));if(key(start)<key(now))start=addDays(now,0);
    if(r.freq==='interval'){const n=dayDiff(parse(r.start),start),off=((n%r.every)+r.every)%r.every;if(off)start=addDays(start,r.every-off)}
    if(r.freq==='monthly'){start=new Date(start.getFullYear(),start.getMonth(),Math.min(r.dom,28));if(key(start)<key(now))start.setMonth(start.getMonth()+1)}
    const ds=key(start).replace(/-/g,'');
    const rule=r.freq==='daily'?'FREQ=DAILY':r.freq==='weekly'?`FREQ=WEEKLY;BYDAY=${r.days.map(i=>BY[i]).join(',')}`:r.freq==='monthly'?`FREQ=MONTHLY;BYMONTHDAY=${r.dom}`:`FREQ=DAILY;INTERVAL=${r.every}`;
    L.push('BEGIN:VEVENT',`UID:${r.id}@dayflow`,`DTSTAMP:${st}`,`SUMMARY:${icsEsc(CATS[r.cat][0]+' '+r.name)}`);
    if(r.note)L.push(`DESCRIPTION:${icsEsc(r.note)}`);
    if(r.time)L.push(`DTSTART:${ds}T${r.time.replace(':','')}00`,'DURATION:PT20M',`RRULE:${rule}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEsc(r.name)}`,'TRIGGER:-PT10M','END:VALARM');
    else L.push(`DTSTART;VALUE=DATE:${ds}`,`RRULE:${rule}`);
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');download(L.join('\r\n'),'kuestro-routines.ics','text/calendar');toast('Calendar file downloaded');
}
async function prayerIcs(){
  try{
    const d=new Date(),m=await loadMonth(d.getFullYear(),d.getMonth()+1),L=icsHead('Prayer times'),st=stamp();
    Object.entries(m).filter(([k])=>k>=key(d)).forEach(([k,t])=>PRAYERS.forEach(p=>{
      L.push('BEGIN:VEVENT',`UID:${k}-${p}@dayflow`,`DTSTAMP:${st}`,`DTSTART:${k.replace(/-/g,'')}T${t[p].replace(':','')}00`,'DURATION:PT15M',`SUMMARY:🕌 ${p}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:Time for ${p}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT')}));
    L.push('END:VCALENDAR');download(L.join('\r\n'),`prayer-times-${key(d).slice(0,7)}.ics`,'text/calendar');toast('Prayer calendar downloaded');
  }catch(e){toast('Needs internet to fetch prayer times')}
}
function download(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}

/* ---------- form submits ---------- */
const SUBMIT={
  fTx(f){const v=parseFloat(f.amount.value);if(!(v>0))return toast('Enter an amount');const type=f.type.value;
    addTx({date:f.date.value||todayK(),amount:v,type,cat:type==='income'?'income':f.cat.value,merchant:f.merchant.value.trim(),raw:'manual:'+Date.now()},'manual');MADD=false;save();renderMoney();toast('Saved ✓')},
  fMoneySet(f){S.money.cur=(f.cur.value.trim()||'EGP').toUpperCase().slice(0,5);S.money.budget=Math.max(0,+f.budget.value||0);save();renderMoney();toast('Saved ✓')},
  fWish(f){const n=f.name.value.trim();if(!n)return;let link=f.link.value.trim();if(link&&!/^https?:/i.test(link))link='https://'+link;if(BAD_SCHEME.test(link))link='';
    S.money.wish.push({id:uid(),name:n,price:+f.price.value||0,prio:+f.prio.value||2,link,saved:0,bought:false,created:todayK()});save();renderMoney();toast('Added to wishlist 🎁')},
  fTodo(f){const lid=f.l?f.l.value:TL,it=addTodo(lid,f.t.value,TL==='today'?todayK():'');if(!it)return;save();renderTodos();setTimeout(()=>$('#fTodo')?.t.focus(),30)},
  fTodoQ(f){const it=addTodo(f.l.value,f.t.value,(tlist(f.l.value)||{}).kind==='groceries'?'':todayK());if(!it)return;save();renderToday();toast('Added ✓')},
  mForm(f){
    const times=[...f.querySelectorAll('[name=mtime]')].map(i=>i.value).filter(Boolean).sort();
    const data={name:f.name.value.trim(),dose:f.dose.value.trim(),form:f.form.value,freq:f.freq.value,days:[...f.querySelectorAll('[name=mdays]:checked')].map(c=>+c.value),every:Math.max(2,+f.every.value||2),
      times:[...new Set(times)],food:f.food.value,start:f.start.value||todayK(),end:f.end.value||'',stock:f.stock.value===''?'':+f.stock.value,perDose:+f.perDose.value||1,refillAt:+f.refillAt.value||0,notes:f.notes.value.trim(),active:f.active?f.active.checked:true};
    if(!data.name)return toast('Add a name');
    if(data.freq==='weekly'&&!data.days.length)return toast('Pick at least one day');
    if(!data.times.length)data.times=[''];
    if(editingMed)Object.assign(editingMed,data);else S.meds.push({id:uid(),...data});
    save();$('#mDlg').close();checkProgress();render();toast('Saved ✓');
  },
  fLangSet(f){
    const L=S.lang,code=f.lang.value;
    Object.assign(L,{chosen:true,code,name:(LANGS.find(x=>x[1]===code)||['Language'])[0],level:f.level.value,goal:Math.max(5,+f.goal.value||15),newPerDay:Math.max(0,+f.newPerDay.value||0),native:f.native.value.trim()||'English',reverse:f.reverse.checked});
    let u=f.duoUrl.value.trim()||'https://www.duolingo.com/learn';if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u;if(!BAD_SCHEME.test(u))L.duoUrl=u;
    save();renderLearn();toast('Saved');
  },
  fWord(f){
    if(!addWord(f.front.value,f.back.value,f.ex.value))return toast('Already in your deck (or missing a field)');
    save();checkProgress();const w=f.front.value;renderLearn();toast(`“${w}” added ✓`);setTimeout(()=>$('#fWord')?.front.focus(),50);
  },
  fLang(f){
    const fd=Object.fromEntries(new FormData(f)),date=todayK();
    if(!(+fd.min>0))return toast('How many minutes?');
    if(fd.act!=='Duolingo'){delete fd.duoXp;delete fd.duoStreak}
    S.logs.push({id:uid(),ts:Date.now(),type:'lang',...fd,date});autoTick('lang',parse(date),fd.act);
    save();checkProgress();renderLearn();floatXP(0,0,'+'+XP_LOG+' XP');toast('Practice logged ✓');
  },
  async lockForm(){
    if(Date.now()<lockUntil){$('#lockMsg').textContent=`Too many tries. Wait ${Math.ceil((lockUntil-Date.now())/1000)}s.`;return}
    const pass=$('#lockPass').value;if(!pass||!BLOB)return;$('#lockMsg').textContent='Unlocking…';
    try{const {k,data}=await decryptBlob(pass,BLOB);KEY=k;SALT=BLOB.salt;S=merge(data);fails=0;document.body.classList.remove('locked');$('#lockPass').value='';start()}
    catch(e){fails++;if(fails>=5)lockUntil=Date.now()+30000*2**(fails-5);$('#lockMsg').textContent='Wrong passcode';$('#lockPass').value=''}
  },
  rForm(f){
    const data={name:f.name.value.trim(),cat:f.cat.value,freq:f.freq.value,time:f.time.value,note:f.note.value.trim(),
      days:$$('#dayChips input:checked').map(c=>+c.value),dom:Math.min(31,Math.max(1,+f.dom.value||1)),every:Math.max(2,+f.every.value||2),
      start:f.freq.value==='interval'?(f.start.value||key(new Date())):(editing?.start||key(new Date()))};
    if(!data.name)return;
    if(data.freq==='weekly'&&!data.days.length)return toast('Pick at least one day');
    if(editing)Object.assign(editing,data);else S.routines.push({id:uid(),...data});
    save();$('#rDlg').close();render();toast('Saved');
  },
  logForm(f){
    if(logType==='meal')return saveMeal(f);
    const fd=Object.fromEntries(new FormData(f)),date=fd.date||key(new Date());
    S.logs.push({id:uid(),ts:Date.now(),type:logType,...fd,date});autoTick(logType,parse(date),fd.act);
    save();checkProgress();renderLog();floatXP(0,0,'+'+XP_LOG+' XP');toast('Logged ✓');
  },
  setForm(f){
    const s=S.settings;
    if(f.city.value.trim()!==s.city||f.country.value.trim()!==s.country){s.lat=s.lon=null}
    Object.assign(s,{sound:f.sound.checked,prayers:f.prayers.checked,city:f.city.value.trim()||'Cairo',country:f.country.value.trim()||'Egypt',method:+f.method.value,weekStart:+f.weekStart.value,h12:+f.h12.value});
    ptMem={};save();renderSettings();toast('Settings saved');
  },
  async fPass(f){
    const p1=f.p1.value,p2=f.p2.value;
    if(p1.length<4)return toast('Use at least 4 characters');
    if(p1!==p2)return toast('Passcodes don’t match');
    await setPasscode(p1);renderSettings();toast('Passcode on. Your data is encrypted 🔒');
  },
  async fStrava(f){
    if(!KEY)return toast('Set a passcode first');
    const id=f.clientId.value.trim(),sec=f.clientSecret.value.trim();
    if(!/^\d+$/.test(id))return toast('Client ID should be a number');
    S.strava.clientId=id;if(sec)S.strava.clientSecret=sec;
    if(!S.strava.clientSecret)return toast('Paste the Client Secret too');
    await save();stravaConnect();
  },
  fStravaCode(f){
    if(!S.strava.clientId||!S.strava.clientSecret)return toast('Save your Client ID and Secret first');
    const v=f.code.value.trim(),m=v.match(/code=([^&\s]+)/);stravaExchange(m?m[1]:v);
  },
  fAI(f){
    if(!KEY)return toast('Set a passcode first');
    const a=S.ai;if(f.claudeKey.value.trim())a.claudeKey=f.claudeKey.value.trim();if(f.openaiKey.value.trim())a.openaiKey=f.openaiKey.value.trim();
    a.claudeModel=f.claudeModel.value.trim()||a.claudeModel;a.openaiModel=f.openaiModel.value.trim()||a.openaiModel;
    save();renderConnect();toast('Saved (encrypted)');
  },
  fLink(f){
    const t=f.ltype.value,v=f.val.value.trim();let url;
    if(t==='ios')url='shortcuts://run-shortcut?name='+encodeURIComponent(v);
    else if(t==='android'){if(!/^[a-zA-Z][\w.]+$/.test(v))return toast('That doesn’t look like a package name');url=`intent://#Intent;package=${v};end`}
    else{url=/^[a-z][a-z0-9+.-]*:/i.test(v)?v:'https://'+v;if(BAD_SCHEME.test(url))return toast('That link type isn’t allowed')}
    S.links.push({id:uid(),icon:f.icon.value.trim()||'🔗',name:f.name.value.trim(),url});save();renderConnect();toast('Added');
  },
};
document.addEventListener('submit',async e=>{const H=SUBMIT[e.target.id];if(!H)return;e.preventDefault();if(e.target.id!=='lockForm'&&!S)return;await H(e.target)});

/* ---------- clicks ---------- */
document.addEventListener('click',async e=>{
  const c=s=>e.target.closest(s);let el;
  if(el=c('[data-act="forgot"]')){if(confirm('Erase ALL Kuestro data on this device and start over? This can’t be undone.')){localStorage.removeItem(STORE);location.reload()}return}
  if(el=c('[data-act="copyCode"]')){const v=$('#handoffCode').value;try{await navigator.clipboard.writeText(v);toast('Copied')}catch(err){$('#handoffCode').select()}return}
  if(c('#qc'))return nextQC();
  if(!S)return;
  if(el=c('nav.tabs button'))return show(el.dataset.tab);
  if(el=c('[data-log]')){e.stopPropagation();logType=el.dataset.log;return show('log')}
  if(el=c('[data-claim]'))return claimQuest(el.dataset.claim,e.clientX,e.clientY);
  if(el=c('[data-say]'))return speak(el.dataset.say);
  if(el=c('[data-todo]')){const it=S.todos.items.find(i=>i.id===el.dataset.todo);if(!it)return;it.done=!it.done;it.doneAt=it.done?todayK():'';
    floatXP(e.clientX,e.clientY,(it.done?'+':'−')+XP_TODO+' XP');if(it.done){burst(e.clientX,e.clientY,'todo');if(navigator.vibrate)navigator.vibrate(10)}save();checkProgress();return render()}
  if(el=c('[data-tstar]')){const it=S.todos.items.find(i=>i.id===el.dataset.tstar);it.star=!it.star;save();return render()}
  if(el=c('[data-tdue]')){const it=S.todos.items.find(i=>i.id===el.dataset.tdue),t0=todayK(),t1=key(addDays(new Date(),1)),t7=key(addDays(new Date(),7));
    it.due=!it.due||it.due<t0?t0:it.due===t0?t1:it.due===t1?t7:'';save();toast(it.due?`Due ${it.due===t0?'today':it.due===t1?'tomorrow':'in a week'}`:'No due date');return render()}
  if(el=c('[data-tdel]')){const it=S.todos.items.find(i=>i.id===el.dataset.tdel);if(it){if(it.done&&it.doneAt)it.list='_deleted';else S.todos.items=S.todos.items.filter(i=>i!==it)}save();return render()}
  if(el=c('[data-tl]')){TL=el.dataset.tl;return renderTodos()}
  if(el=c('[data-pv]')){PV=el.dataset.pv;POFF=0;return renderProgress()}
  if(el=c('[data-poff]')){POFF=Math.min(0,POFF+(+el.dataset.poff));return renderProgress()}
  if(el=c('[data-gotoday]')){viewDate=parse(el.dataset.gotoday);return show('today')}
  if(el=c('[data-mv]')){MV=el.dataset.mv;return renderMoney()}
  if(el=c('[data-mmonth]')){const[y,m]=MMONTH.split('-').map(Number);MMONTH=key(new Date(y,m-1+(+el.dataset.mmonth),1)).slice(0,7);MFILTER=null;return renderMoney()}
  if(el=c('[data-mcat]')){if(e.target.closest('select'))return;MFILTER=el.dataset.mcat&&MFILTER!==el.dataset.mcat?el.dataset.mcat:null;return renderMoney()}
  if(el=c('[data-txdel]')){if(confirm('Delete this transaction?')){S.money.tx=S.money.tx.filter(x=>x.id!==el.dataset.txdel);save();renderMoney()}return}
  if(el=c('[data-wsave]')){const w=S.money.wish.find(x=>x.id===el.dataset.wsave),v=parseFloat(prompt(`How much did you put aside for ${w.name}?`,''));if(v){w.saved=Math.max(0,(+w.saved||0)+v);save();renderMoney();if(w.price&&w.saved>=w.price){burst(e.clientX,e.clientY,'chest');toast('🎉 Fully saved! You can buy it')}}return}
  if(el=c('[data-wbuy]')){const w=S.money.wish.find(x=>x.id===el.dataset.wbuy);w.bought=true;w.boughtAt=todayK();
    if(w.price&&confirm(`Add ${fmtMoney(w.price)} for ${w.name} to your spending?`))addTx({date:todayK(),amount:+w.price,type:'expense',cat:'shopping',merchant:w.name,raw:'wish:'+w.id},'wishlist');
    save();burst(e.clientX,e.clientY,'chest');return renderMoney()}
  if(el=c('[data-wdel]')){if(confirm('Remove from wishlist?')){S.money.wish=S.money.wish.filter(x=>x.id!==el.dataset.wdel);save();renderMoney()}return}
  if(el=c('[data-editmed]'))return openMed(S.meds.find(m=>m.id===el.dataset.editmed));
  if(el=c('[data-refill]')){const m=S.meds.find(m=>m.id===el.dataset.refill),n=parseFloat(prompt(`How many ${m.name} did you add?`,'30'));if(n>0){m.stock=(+m.stock||0)+n;save();renderMeds();toast('Stock updated ✓')}return}
  if(el=c('[data-mtimes]')){$('#mTimes').innerHTML=el.dataset.mtimes.split(',').map(t=>`<input type="time" name="mtime" value="${t}">`).join('');return}
  if(el=c('[data-startw]')){if(T_().active&&!confirm('A workout is already in progress. Start a new one?'))return;return startWorkout(el.dataset.startw)}
  if(el=c('[data-setdone]')){const[ei,si]=el.dataset.setdone.split(':').map(Number),a=T_().active,st=a.ex[ei].sets[si];st.done=!st.done;
    if(st.done){if(st.r===''){st.r=String(a.ex[ei].reps).match(/\d+/)?.[0]||''}if(st.w===''&&si>0)st.w=a.ex[ei].sets[si-1].w;burst(e.clientX,e.clientY,'workout');startRest(a.ex[ei].rest)}save();return renderTrain()}
  if(el=c('[data-addset]')){const ex=T_().active.ex[+el.dataset.addset],l=ex.sets[ex.sets.length-1]||{};ex.sets.push({w:l.w||'',r:l.r||'',done:false});save();return renderTrain()}
  if(el=c('[data-delset]')){const ex=T_().active.ex[+el.dataset.delset];if(ex.sets.length>1)ex.sets.pop();save();return renderTrain()}
  if(el=c('[data-exadd]')){T_().plan[+el.dataset.exadd].ex.push(EX('',3,'8-12'));save();renderTrain();const ins=$$(`[data-pe^="${el.dataset.exadd}:"][data-pe$=":name"]`);ins[ins.length-1]?.focus();return}
  if(el=c('[data-exdel]')){const[di,ei]=el.dataset.exdel.split(':').map(Number);T_().plan[di].ex.splice(ei,1);save();return renderTrain()}
  if(el=c('[data-exmove]')){const[di,ei,dir]=el.dataset.exmove.split(':').map(Number),a=T_().plan[di].ex,j=ei+dir;if(j>=0&&j<a.length){[a[ei],a[j]]=[a[j],a[ei]];save();renderTrain()}return}
  if(el=c('[data-daymove]')){const[di,dir]=el.dataset.daymove.split(':').map(Number),a=T_().plan,j=di+dir;if(j>=0&&j<a.length){[a[di],a[j]]=[a[j],a[di]];save();renderTrain()}return}
  if(el=c('[data-daydel]')){const di=+el.dataset.daydel;if(T_().plan.length>1&&confirm(`Delete “${T_().plan[di].name}”?`)){T_().plan.splice(di,1);save();renderTrain()}return}
  if(el=c('[data-preset]')){if(!HD)return;Object.assign(HD,el.dataset.preset==='moody'?{style:'hunter',useImg:false,hair:'wolf',hairColor:'#2a2230',face:'mature',eyes:'cool',eyeColor:'#7f9bb0',mouth:'calm',marks:'none',acc:'none',wear:'sweater',outfit:'#2b2f36',scene:'plain',bg:'#8ea3b5',rim:'none',glow:false}:{style:'hunter',useImg:false,hair:'messy',hairColor:'#2a2230',face:'sharp',eyes:'sparkle',eyeColor:'#d9822b',mouth:'calm',acc:'earring',wear:'tech',outfit:'#15151c',scene:'city',rim:'#ff7a1a',glow:false});return renderHero()}
  if(el=c('[data-opt]')){if(!HD)return;e.preventDefault();HD[el.dataset.opt]=el.dataset.opt==='glow'||el.dataset.opt==='useImg'?el.dataset.val==='1':el.dataset.val;return renderHero()}
  if(el=c('[data-rate]')){const card=S.lang.deck.find(x=>x.id===RV?.queue[0]);if(!card)return;const g=+el.dataset.rate;rateCard(card,g);RV.queue.shift();if(g===0)RV.queue.push(card.id);RV.done++;RV.shown=false;floatXP(e.clientX,e.clientY,'+2 XP');if(g>0)burst(e.clientX,e.clientY,'language');return renderReview()}
  if(el=c('[data-delword]')){if(!confirm('Delete this word?'))return;S.lang.deck=S.lang.deck.filter(x=>x.id!==el.dataset.delword);save();return renderWordList($('#wordSearch')?.value||'')}
  if(el=c('[data-tutor]')){const k=el.dataset.tutor,t=$('#tutorText').value.trim();if(k==='correct'&&!t)return toast('Write something first');return runAI(S.lang.ai,tutorPrompt(k,t),$('#langAnswer'),k==='chat')}
  if(el=c('[data-toggle]')){if(c('a'))return;const id=el.dataset.toggle,was=isDone(id,viewDate),xp=tickXP(id,viewDate);
    toggle(id,viewDate);floatXP(e.clientX,e.clientY,(was?'−':'+')+xp+' XP');if(!was)burst(e.clientX,e.clientY,id.startsWith('med:')?'meds':id.startsWith('prayer:')?'prayer':CAT2TH[idCat(id)]);
    if(id.startsWith('med:')){const m=S.meds.find(m=>m.id===id.slice(4).split('@')[0]);if(m&&medTracked(m)){m.stock=Math.max(0,Math.round((+m.stock+(was?1:-1)*(+m.perDose||1))*100)/100);save();if(!was&&+m.stock<=(+m.refillAt||0))setTimeout(()=>toast(`⚠️ ${m.name}: ${m.stock} left. Time to refill`),700)}}if(navigator.vibrate)navigator.vibrate(was?5:[10,30,10]);checkProgress();return renderToday()}
  if(el=c('[data-day]')){viewDate=parse(el.dataset.day);return renderToday()}
  if(el=c('[data-edit]'))return openRoutine(S.routines.find(r=>r.id===el.dataset.edit));
  if(el=c('[data-dellog]')){S.logs=S.logs.filter(l=>l.id!==el.dataset.dellog);save();return renderLog()}
  if(el=c('[data-dellink]')){e.preventDefault();S.links=S.links.filter(l=>l.id!==el.dataset.dellink);save();return renderConnect()}
  if(el=c('[data-act]'))switch(el.dataset.act){
    case 'prev':viewDate=addDays(viewDate,-1);return renderToday();
    case 'next':viewDate=addDays(viewDate,1);return renderToday();
    case 'today':viewDate=new Date();return renderToday();
    case 'newRoutine':return openRoutine();
    case 'closeDlg':return $('#rDlg').close();
    case 'editLinks':editLinks=!editLinks;return renderConnect();
    case 'ics':return routinesIcs();
    case 'prayerIcs':return prayerIcs();
    case 'goSecurity':return show('settings');
    case 'goQuests':return show('quests');
    case 'goLearn':return show('learn');
    case 'themeCycle':{const n={auto:'dark',dark:'light',light:'auto'}[getTheme()];applyTheme(n);return toast({auto:'🌓 Auto: follows your phone',dark:'🌙 Dark mode',light:'☀️ Light mode'}[n])}
    case 'goTrain':return show('train');
    case 'goTodos':TL='today';return show('todos');
    case 'goMoney':return show('money');
    case 'goProgress':PV='week';POFF=0;return show('progress');
    case 'mImport':IMPORT=IMPORT?null:{text:'',parsed:null};MADD=false;return renderMoney();
    case 'mImportClose':IMPORT=null;return renderMoney();
    case 'mAdd':MADD=!MADD;IMPORT=null;return renderMoney();
    case 'smsClip':try{const t=await navigator.clipboard.readText();if(!t)return toast('Clipboard is empty');doParse(t)}catch(err){toast('Paste into the box instead (long-press → Paste)')}return;
    case 'smsParse':return doParse($('#smsText').value);
    case 'smsSave':{let n=0;IMPORT.parsed.forEach(p=>{if(!p.dup&&!p.skip){addTx(p,'sms');n++}});IMPORT=null;save();renderMoney();return toast(`Imported ${n} transaction${n===1?'':'s'} ✓`)}
    case 'tLogShop':{const L=tlist(TL),done=S.todos.items.filter(i=>i.list===TL&&i.done),est=done.reduce((a,i)=>a+(+i.price||0)*(parseFloat(i.qty)||1),0);
      const v=parseFloat(prompt(`How much did you spend? (${S.money.cur})`,est?String(Math.round(est*100)/100):''));if(!(v>0))return;
      addTx({date:todayK(),amount:v,type:'expense',cat:'groceries',merchant:L.name,raw:'groceries:'+Date.now()},'groceries');done.forEach(i=>i.list='_cleared');save();renderTodos();return toast(`Logged ${fmtMoney(v)} in Money 🛒`)}
    case 'tlAdd':{const n=prompt('Name of the new list (e.g. Pharmacy, Weekend, Project X):');if(!n||!n.trim())return;const ic=(prompt('Pick an emoji for it:','📝')||'📝').trim().slice(0,4);const l={id:uid(),name:n.trim().slice(0,30),icon:ic,kind:/grocer|shop|market|سوبر/i.test(n)?'groceries':'custom'};S.todos.lists.push(l);TL=l.id;save();return renderTodos()}
    case 'tlEdit':{const l=tlist(TL);const n=prompt('Rename list:',l.name);if(n&&n.trim()){l.name=n.trim().slice(0,30);const ic=prompt('Emoji:',l.icon);if(ic)l.icon=ic.trim().slice(0,4);save();renderTodos()}return}
    case 'tlDel':{const l=tlist(TL);if(confirm(`Delete “${l.name}” and its items?`)){S.todos.lists=S.todos.lists.filter(x=>x!==l);S.todos.items=S.todos.items.filter(i=>i.list!==l.id||(i.done&&i.doneAt));S.todos.items.forEach(i=>{if(i.list===l.id)i.list='_deleted'});TL='today';save();renderTodos()}return}
    case 'tClear':S.todos.items.forEach(i=>{if(i.list===TL&&i.done)i.list='_cleared'});save();return renderTodos();
    case 'tShare':{const l=tlist(TL),txt=`${l.icon} ${l.name}\n`+S.todos.items.filter(i=>i.list===l.id&&!i.done).map(i=>`• ${i.text}${i.qty?' ×'+i.qty:''}`).join('\n');
      if(navigator.share)navigator.share({title:l.name,text:txt}).catch(()=>{});else navigator.clipboard?.writeText(txt).then(()=>toast('List copied ✓'),()=>toast('Could not copy'));return}
    case 'goMeds':return show('meds');
    case 'goRoutines':return show('routines');
    case 'goLog':return show('log');
    case 'newMed':return openMed();
    case 'closeMed':return $('#mDlg').close();
    case 'delMed':if(editingMed&&confirm(`Delete ${editingMed.name}?`)){S.meds=S.meds.filter(m=>m!==editingMed);save();$('#mDlg').close();render()}return;
    case 'medsIcs':return medsIcs();
    case 'mAddTime':{const i=document.createElement('input');i.type='time';i.name='mtime';i.value='12:00';$('#mTimes').append(i);return}
    case 'revealCard':{const k=todayK(),i=todayCardIdx();S.cards.revealed[k]=i;if(S.cards.seen[i]==null)S.cards.seen[i]=k;S.claimed['card:'+k]=5;save();renderToday();const el=$('.cardslot .mcard');if(el)el.classList.add('flip');burst(e.clientX,e.clientY,'perfect');floatXP(e.clientX,e.clientY,'+5 XP');checkProgress();return}
    case 'skipW':if(confirm(`Skip ${nextW().name} and move to the next workout?`)){T_().idx++;save();renderTrain()}return;
    case 'editTrain':TEDIT=true;return renderTrain();
    case 'cycRestart':cyc().start=todayK();save();return renderTrain();
    case 'cycSkip':cyc().start=key(addDays(parse(cyc().start||todayK()),1));save();toast('Cycle shifted by a day');return renderTrain();
    case 'editDone':TEDIT=false;syncTrainRoutine();save();return renderTrain();
    case 'finishW':return finishWorkout();
    case 'cancelW':if(confirm('Cancel this workout? Sets you entered will be lost.')){T_().active=null;stopRest();save();renderTrain()}return;
    case 'restAdd':if(REST){REST.end+=15000;tickRest()}return;
    case 'restSkip':return stopRest();
    case 'dayAdd':T_().plan.push({id:uid(),name:'New workout',focus:'',ex:[EX('Exercise',3,'8-12')]});save();return renderTrain();
    case 'resetPlan':if(confirm('Replace your program with the default 5-day rotation?')){T_().plan=defaultPlan();T_().idx=0;save();renderTrain()}return;
    case 'goHero':HD=null;heroPeekL=null;return show('hero');
    case 'heroBack':HD=null;heroPeekL=null;return show('quests');
    case 'heroPeek':heroPeekL=heroPeekL?null:20;return renderHero();
    case 'heroRandom':heroRandom();return renderHero();
    case 'heroSave':return heroSave();
    case 'goConnect':return show('connect');
    case 'rvStart':{const q=dueCards();if(!q.length)return toast('Nothing due. Add words or come back tomorrow');RV={queue:q.map(c=>c.id),shown:false,done:0,rev:{}};if(S.lang.reverse)q.forEach(c=>{if(c.first&&Math.random()<.5)RV.rev[c.id]=1});return renderReview()}
    case 'rvShow':{RV.shown=true;const c=S.lang.deck.find(x=>x.id===RV.queue[0]);renderReview();if(c)speak(c.front);return}
    case 'rvSay':{const c=S.lang.deck.find(x=>x.id===RV.queue[0]);return c&&sayIt(c.front)}
    case 'rvEnd':RV=null;return renderLearn();
    case 'speakField':{const v=$('#fWord').front.value.trim();return v?speak(v):toast('Type a word first')}
    case 'bulkAdd':{let n=0;$('#bulkWords').value.split(/\r?\n/).forEach(line=>{const[main,ex]=line.split('|');const m=(main||'').match(/^(.+?)\s*(?:=|\t|;| - | – |:)\s*(.+)$/);if(m&&addWord(m[1],m[2],ex))n++});save();checkProgress();renderLearn();return toast(n?`Added ${n} word${n===1?'':'s'} ✓`:'No new words found. Use “word = meaning”.')}
    case 'reroll':{const k=key(new Date());S.rerolls[k]=(S.rerolls[k]||0)+1;save();renderQuests();return toast('🎲 New quests!')}
    case 'stravaSync':return stravaSync();
    case 'stravaOff':return stravaOff();
    case 'askClaude':return askAI('claude');
    case 'askOpenAI':return askAI('openai');
    case 'aiClear':Object.assign(S.ai,{claudeKey:'',openaiKey:''});save();renderConnect();return toast('Keys removed');
    case 'healthImport':
      try{const txt=await navigator.clipboard.readText();const d=importHealth(txt);toast(`Health data imported for ${d} ✓`);renderConnect()}
      catch(err){$('#healthPaste').classList.remove('hidden');toast(err.message&&/DAYFLOW|KUESTRO|numbers/.test(err.message)?err.message:'Paste the text below instead')}
      return;
    case 'healthPasteGo':
      try{const d=importHealth($('#healthText').value);toast(`Health data imported for ${d} ✓`);renderConnect()}catch(err){toast(err.message)}
      return;
    case 'lockNow':return lock();
    case 'changePass':return $('#fPass').classList.toggle('hidden');
    case 'removePass':
      if(confirm('Turn off the passcode? Your data will be stored unencrypted, and connected keys will be removed.')){KEY=null;SALT=null;Object.assign(S.ai,{claudeKey:'',openaiKey:''});Object.assign(S.strava,{clientSecret:'',access:'',refresh:'',expires:0});await save();renderSettings();toast('Passcode off')}
      return;
    case 'export':{
      const data={...S,ptCache:{},strava:{...S.strava,clientSecret:'',access:'',refresh:'',expires:0},ai:{...S.ai,claudeKey:'',openaiKey:''}};
      const out=KEY?{dayflowBackup:1,...await encryptWith(KEY,SALT,JSON.stringify(data))}:data;
      return download(JSON.stringify(out),`kuestro-backup-${key(new Date())}.json`,'application/json');
    }
    case 'reset':if(confirm('Erase all routines, check-ins, logs and keys on this device?')){KEY=null;SALT=null;S=defaults();await save();show('today')}return;
    case 'geo':
      if(!navigator.geolocation)return toast('Location not available');
      navigator.geolocation.getCurrentPosition(p=>{S.settings.lat=+p.coords.latitude.toFixed(4);S.settings.lon=+p.coords.longitude.toFixed(4);ptMem={};save();renderSettings();toast('Location saved')},()=>toast('Location permission denied'));
      return;
  }
});
document.addEventListener('change',e=>{
  if(!S)return;const t=e.target;
  if(t.name==='lt'){logType=t.value;return renderLog()}
  if(t.id==='prayerAppSel'){S.settings.prayerApp=t.value;return save()}
  if(t.name==='theme'&&t.closest('#themeChips'))return applyTheme(t.value);
  if(t.name==='accent'&&t.closest('#accentChips'))return applyAccent(t.value);
  if(t.dataset&&t.dataset.txcat){const x=S.money.tx.find(x=>x.id===t.dataset.txcat);if(!x)return;x.cat=t.value;const mk=merchKey(x.merchant);if(mk&&t.value!=='income'){S.money.rules[mk]=t.value;S.money.tx.forEach(y=>{if(merchKey(y.merchant)===mk&&y.type==='expense')y.cat=t.value});toast(`Got it: “${x.merchant}” → ${MCATS[t.value][1]} from now on`)}save();return renderMoney()}
  if(t.dataset&&t.dataset.impcat){IMPORT.parsed[+t.dataset.impcat].cat=t.value;return}
  if(t.dataset&&t.dataset.imp){IMPORT.parsed[+t.dataset.imp].skip=!t.checked;return}
  if(t.id==='heroImg'&&HD){const f=t.files[0];if(!f)return;const img=new Image(),u=URL.createObjectURL(f);img.onload=()=>{const c=document.createElement('canvas'),sw0=img.width,sh0=Math.min(img.height,img.width*1.6),W=Math.min(720,sw0),Hh=Math.round(sh0*W/sw0);c.width=W;c.height=Hh;c.getContext('2d').drawImage(img,0,0,sw0,sh0,0,0,W,Hh);let q=.86,d=c.toDataURL('image/jpeg',q);while(d.length>880000&&q>.4){q-=.1;d=c.toDataURL('image/jpeg',q)}HD.img=d;HD.useImg=true;URL.revokeObjectURL(u);renderHero()};img.onerror=()=>toast('Could not read that image');img.src=u;return}
  if(t.id==='smsFile'){const f=t.files[0];if(f)f.text().then(doParse);return}
  if(t.id==='tutorAI'){S.lang.ai=t.value;return save()}
  if(t.id==='mFreq'){$('#mWeekly').classList.toggle('hidden',t.value!=='weekly');$('#mEvery').classList.toggle('hidden',t.value!=='interval');return}
  if(t.dataset&&t.dataset.tday!=null){const i=+t.dataset.tday,d=T_().days;if(t.checked&&!d.includes(i))d.push(i);if(!t.checked)T_().days=d.filter(x=>x!==i);syncTrainRoutine();const pv=$('#tPrev');if(pv)pv.innerHTML=tPrevHTML();return save()}
  if(t.id==='tUnit'){T_().unit=t.value;return save()}
  if(t.name==='act'&&t.form&&t.form.id==='fLang')return syncDuo();
  if(t.id==='lockAfter'){S.settings.lockAfter=+t.value;return save()}
  if(t.name==='ltype'){const[ph,help]=LINK_HELP[t.value];const f=t.form;f.val.placeholder=ph;$('#linkHelp').innerHTML=help;return}
  if(t.form&&t.form.id==='setForm'&&['weekStart','h12','prayers','method','sound'].includes(t.name))t.form.requestSubmit();
});
function planEdit(t){const[di,ei,f]=t.dataset.pe.split(':');const p=T_().plan[+di];if(!p)return;
  if(ei==='')p[f]=t.value;else{const x=p.ex[+ei];if(x)x[f]=f==='sets'||f==='rest'?Math.max(0,+t.value||0):t.value}clearTimeout(planEdit._t);planEdit._t=setTimeout(save,400)}
document.addEventListener('change',e=>{if(S&&e.target.dataset&&e.target.dataset.pe)planEdit(e.target)});
document.addEventListener('input',e=>{const t=e.target;
  if(S&&t.dataset&&t.dataset.set){const[ei,si,f]=t.dataset.set.split(':'),a=T_().active;if(a&&a.ex[+ei]){a.ex[+ei].sets[+si][f]=t.value;clearTimeout(t._t);t._t=setTimeout(save,400)}return}
  if(S&&t.dataset&&t.dataset.pe)return planEdit(t);if(S&&e.target.id==='wordSearch')return renderWordList(e.target.value);if(HD&&e.target.id==='heroName'){HD.name=e.target.value;return}if(HD&&e.target.id==='heroMotto'){HD.motto=e.target.value;return}if(S&&e.target.id==='aiPlan'){S.ai.plan=e.target.value;clearTimeout(e.target._t);e.target._t=setTimeout(save,500)}});
$('#importFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    let d=JSON.parse(await file.text());
    if(d.enc){const p=prompt('This backup is encrypted. Enter the passcode it was made with:');if(!p)return;d=(await decryptBlob(p,d)).data}
    if(!Array.isArray(d.routines))throw 0;
    const keep={strava:S.strava,ai:{...S.ai}};S=merge(d);S.strava={...S.strava,...keep.strava};S.ai={...S.ai,claudeKey:keep.ai.claudeKey,openaiKey:keep.ai.openaiKey};
    save();toast('Backup restored');show('today');
  }catch(err){toast('Couldn’t read that backup (wrong file or passcode)')}
};
document.addEventListener('visibilitychange',()=>{
  if(!S)return;
  if(document.hidden){hiddenAt=Date.now();save();if(KEY&&+S.settings.lockAfter===0)lock()}
  else{if(KEY&&hiddenAt&&Date.now()-hiddenAt>=S.settings.lockAfter*60000)return lock();if(view==='today')renderToday();nudgeTick()}
});

/* ---------- Collapsible cards: collapse to save scrolling, pin to keep a card open ---------- */
const cxUI=()=>{const u=S.ui=S.ui||{};u.c=u.c||{};u.p=u.p||{};return u};
function cxApply(card){
  const U=cxUI(),id=card.dataset.cxid,pin=!!U.p[id],col=!!U.c[id]&&!pin;
  card.classList.toggle('cx-c',col);card.classList.toggle('cx-p',pin);
  const t=card.querySelector('[data-cx-toggle]'),p=card.querySelector('[data-cx-pin]');
  if(t){t.setAttribute('aria-expanded',String(!col));t.setAttribute('aria-label',col?'Expand':'Collapse')}
  if(p){p.classList.toggle('on',pin);p.setAttribute('aria-pressed',String(pin));p.title=pin?'Pinned open. Tap to unpin':'Pin open'}
}
function cxOrder(sec){   // put the cards in the order you saved; new cards slot in after the card that preceded them
  const U=cxUI(),ord=(U.o&&U.o[sec.id])||[],cards=[...sec.querySelectorAll('[data-cx]')];
  if(!ord.length||cards.length<2)return;
  const byId=new Map(cards.map(c=>[c.dataset.cxid,c])),want=ord.filter(id=>byId.has(id));
  cards.forEach((c,i)=>{const id=c.dataset.cxid;if(want.includes(id))return;let at=0;
    for(let j=i-1;j>=0;j--){const p=want.indexOf(cards[j].dataset.cxid);if(p>=0){at=p+1;break}}
    want.splice(at,0,id)});
  const ordered=want.map(id=>byId.get(id));
  if(ordered.every((c,i)=>c===cards[i]))return;     // already in order: touch nothing
  const ph=cards.map(c=>{const m=document.createComment('');c.before(m);return m});
  ph.forEach((m,i)=>m.replaceWith(ordered[i]));
}
function decorateCards(){
  if(!S)return;
  document.querySelectorAll('main > section:not(.hidden)').forEach(sec=>{
    const seen={},fresh=[...sec.querySelectorAll('.card:not([data-cx]),.syswin:not([data-cx])')].filter(c=>{
      const h=c.firstElementChild;return h&&!c.matches('.nudge,.hero,[data-act]')&&h.matches('.sec-h,h2,.sys-h')&&(h.matches('h2')||(h.firstElementChild&&!/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(h.firstElementChild.tagName)))});
    fresh.forEach(c=>{
      const h=c.firstElementChild,te=h.matches('h2')?h:h.firstElementChild;
      let id=sec.id+':'+(c.dataset.cid||((te.textContent||'').replace(/[\d.,:·%/]+/g,' ').replace(/\s+/g,' ').trim().slice(0,40)||'card'));
      seen[id]=(seen[id]||0)+1;if(seen[id]>1)id+='#'+seen[id];
      c.dataset.cx='1';c.dataset.cxid=id;
      const tg=document.createElement('button');tg.type='button';tg.className='cxt';tg.dataset.cxToggle='1';tg.textContent='▾';
      const pn=document.createElement('button');pn.type='button';pn.className='cxp';pn.dataset.cxPin='1';pn.textContent='📌';
      const mv=document.createElement('span');mv.className='cxm';mv.innerHTML='<button type="button" data-cx-move="-1" aria-label="Move up">▲</button><button type="button" data-cx-move="1" aria-label="Move down">▼</button>';
      te.prepend(tg);te.append(pn,mv);cxApply(c);
    });
    const cards=[...sec.querySelectorAll('[data-cx]')];
    if(cards.length>=3){const par=cards[0].parentElement;
      if(![...par.children].some(x=>x.classList&&x.classList.contains('cxbar'))){
        const bar=document.createElement('div');bar.className='cxbar';
        const ar=sec.classList.contains('cx-arr');
        bar.innerHTML=`<span class="cxhint">Use ▲ ▼ to move cards</span><button type="button" data-cx-all="c">⇕ Collapse all</button><button type="button" data-cx-all="e">Expand all</button><button type="button" data-cx-arr="1">${ar?'✓ Done':'↕ Arrange'}</button><button type="button" class="cxreset" data-cx-reset="1">Reset order</button>`;par.insertBefore(bar,cards[0])}}
    cxOrder(sec);
  });
}
document.addEventListener('click',e=>{if(!S)return;const c=s=>e.target.closest(s);let el;
  if(el=c('[data-cx-toggle]')){e.stopPropagation();const card=el.closest('[data-cx]'),U=cxUI(),id=card.dataset.cxid;if(U.c[id])delete U.c[id];else U.c[id]=1;save();return cxApply(card)}
  if(el=c('[data-cx-pin]')){e.stopPropagation();const card=el.closest('[data-cx]'),U=cxUI(),id=card.dataset.cxid;if(U.p[id]){delete U.p[id];toast('Unpinned')}else{U.p[id]=1;delete U.c[id];toast('Pinned: this card stays open')}save();return cxApply(card)}
  if(el=c('[data-cx-arr]')){e.stopPropagation();const sec=el.closest('section'),on=sec.classList.toggle('cx-arr');el.textContent=on?'✓ Done':'↕ Arrange';return}
  if(el=c('[data-cx-reset]')){e.stopPropagation();const U=cxUI(),sec=el.closest('section');if(U.o)delete U.o[sec.id];save();return render()}
  if(el=c('[data-cx-move]')){e.stopPropagation();const card=el.closest('[data-cx]'),sec=card.closest('section'),cards=[...sec.querySelectorAll('[data-cx]')],i=cards.indexOf(card),j=i+(+el.dataset.cxMove);
    if(j<0||j>=cards.length)return;const ids=cards.map(x=>x.dataset.cxid);[ids[i],ids[j]]=[ids[j],ids[i]];
    const U=cxUI();(U.o=U.o||{})[sec.id]=ids;save();cxOrder(sec);card.scrollIntoView({block:'nearest',behavior:'smooth'});return}
  if(el=c('[data-cx-all]')){e.stopPropagation();const U=cxUI(),sec=el.closest('section'),collapse=el.dataset.cxAll==='c';
    sec.querySelectorAll('[data-cx]').forEach(card=>{const id=card.dataset.cxid;if(collapse){if(!U.p[id])U.c[id]=1}else delete U.c[id];cxApply(card)});save()}
},true);
new MutationObserver(()=>decorateCards()).observe(document.querySelector('main'),{childList:true,subtree:true});

/* ---------- Language learning ---------- */
const LANGS=[['Spanish','es-ES'],['French','fr-FR'],['German','de-DE'],['Italian','it-IT'],['Portuguese','pt-BR'],['English','en-US'],['Turkish','tr-TR'],['Japanese','ja-JP'],['Korean','ko-KR'],['Chinese (Mandarin)','zh-CN'],['Russian','ru-RU'],['Dutch','nl-NL'],['Arabic','ar-SA'],['Hindi','hi-IN'],['Greek','el-GR'],['Swedish','sv-SE'],['Polish','pl-PL'],['Hebrew','he-IL']];
const LEVELS=['A1 beginner','A2 elementary','B1 intermediate','B2 upper-intermediate','C1 advanced'];
const ACTS=['Duolingo','Listening','Speaking','Reading','Writing','Tutor / class'];
const todayK=()=>key(new Date());
const langOn=()=>S.routines.some(r=>r.cat==='language');
let RV=null; // active review session
function dueCards(){
  const k=todayK(),deck=S.lang.deck;
  const old=deck.filter(c=>c.first&&c.due<=k).sort((a,b)=>a.due.localeCompare(b.due));
  const newToday=deck.filter(c=>c.first===k).length;
  return old.concat(deck.filter(c=>!c.first).slice(0,Math.max(0,S.lang.newPerDay-newToday)));
}
const langMinOn=k=>Math.round(S.logs.filter(l=>l.type==='lang'&&l.date===k).reduce((a,l)=>a+(+l.min||0),0)+(S.lang.reviews[k]||0)*0.2);
function schedule(c,g){ // simplified SM-2. g: 0 again, 1 hard, 2 good, 3 easy
  let ivl=c.ivl||0,ease=c.ease||2.5,reps=c.reps||0;
  if(g===0){reps=0;ivl=0;ease=Math.max(1.3,ease-.2)}
  else{
    if(g===1){ivl=Math.max(1,Math.round(Math.max(ivl,1)*1.2));ease=Math.max(1.3,ease-.15)}
    else if(g===2)ivl=reps===0?1:reps===1?3:Math.max(ivl+1,Math.round(ivl*ease));
    else{ivl=reps===0?4:Math.max(ivl+2,Math.round(Math.max(ivl,1)*ease*1.3));ease+=.15}
    reps++;
  }
  return {ivl,ease:Math.round(ease*100)/100,reps};
}
const ivlLabel=n=>n===0?'today':n<30?n+'d':n<365?Math.round(n/30)+'mo':(n/365).toFixed(1)+'y';
function rateCard(c,g){
  const k=todayK(),s=schedule(c,g);
  Object.assign(c,s,{due:key(addDays(new Date(),s.ivl)),last:k,first:c.first||k});
  if(g===0)c.lapses=(c.lapses||0)+1;
  S.lang.reviews[k]=(S.lang.reviews[k]||0)+1;save();
}
function speak(t){
  if(!('speechSynthesis' in window))return toast('Speech isn’t supported in this browser');
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t),pre=S.lang.code.slice(0,2).toLowerCase();
  u.lang=S.lang.code;const v=speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').toLowerCase().startsWith(pre));if(v)u.voice=v;
  u.rate=.85;speechSynthesis.speak(u);
}
function sayIt(expected){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition,out=$('#sayOut');
  if(!SR)return toast('Speech check isn’t available in this browser. Try Chrome or Safari.');
  const r=new SR();r.lang=S.lang.code;r.interimResults=false;r.maxAlternatives=3;
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ').trim();
  if(out)out.textContent='🎤 Listening… say it now';
  r.onresult=e=>{const alts=[...e.results[0]].map(a=>a.transcript),ok=alts.some(a=>norm(a)===norm(expected)||norm(a).includes(norm(expected)));
    if(out)out.innerHTML=ok?'✅ Great pronunciation!':`🤔 I heard “${esc(alts[0])}”. Listen 🔊 and try again.`};
  r.onerror=e=>{if(out)out.textContent=e.error==='not-allowed'?'Allow microphone access to use this.':'Didn’t catch that. Try again.'};
  try{r.start()}catch(e){}
}
function addWord(front,back,ex){
  front=String(front||'').trim();back=String(back||'').trim();if(!front||!back)return false;
  if(S.lang.deck.some(c=>c.front.toLowerCase()===front.toLowerCase()))return false;
  S.lang.deck.push({id:uid(),front,back,ex:String(ex||'').trim(),added:todayK()});return true;
}
function wordsForAI(hard){
  const d=[...S.lang.deck];
  if(hard){const h=d.filter(c=>c.lapses).sort((a,b)=>b.lapses-a.lapses).slice(0,15);if(h.length)return h}
  return d.sort((a,b)=>(b.lapses||0)-(a.lapses||0)||b.added.localeCompare(a.added)).slice(0,30);
}
function tutorPrompt(kind,text){
  const L=S.lang,base=`I'm learning ${L.name} (level: ${L.level}). My native language is ${L.native}.`;
  const list=ws=>ws.map(c=>`${c.front} = ${c.back}`).join('\n')||'(no words yet. Pick useful words for my level.)';
  const P={
    story:`${base}\nWrite a short, engaging story (120–180 words) in ${L.name} at my level that uses as many of my words as possible. Bold each one. Then give a translation into ${L.native} and 3 comprehension questions in ${L.name}.\n\nMy words:\n${list(wordsForAI())}`,
    quiz:`${base}\nQuiz me with 10 short, numbered questions on these words (mix: translate both ways, fill in the blank, choose the right word). Put the answer key at the very end, after a line of dashes.\n\nWords:\n${list(wordsForAI())}`,
    chat:`${base}\nLet's have a conversation in ${L.name}. Keep each reply to 2–3 short sentences at my level and end with a question for me. After each of my messages, correct my mistakes briefly in [brackets] in ${L.native}, then continue. Bring in one of my words when natural:\n${list(wordsForAI())}\n\nStart by asking me about my day.`,
    tricky:`${base}\nThese are words I keep forgetting:\n${list(wordsForAI(true))}\nFor each one: a memorable mnemonic, a short note on usage or common mistakes, and 2 simple example sentences with translations.`,
    correct:`${base}\nCorrect my ${L.name} text. Give: 1) the corrected version, 2) each mistake with a one-line explanation in ${L.native}, 3) how a native speaker would naturally say it.\n\nMy text:\n${text||''}`,
  };
  return P[kind];
}
function langSetForm(){
  const L=S.lang;
  return `<form id="fLangSet">
    <div class="row"><div><label class="f">Learning</label><select name="lang">${LANGS.map(([n,c])=>`<option value="${c}" ${c===L.code?'selected':''}>${n}</option>`).join('')}</select></div>
    <div><label class="f">My level</label><select name="level">${LEVELS.map(l=>`<option ${l===L.level?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="row"><div><label class="f">Daily goal (min)</label><input name="goal" type="number" min="5" max="180" value="${L.goal}"></div>
    <div><label class="f">New words / day</label><input name="newPerDay" type="number" min="0" max="50" value="${L.newPerDay}"></div></div>
    <label class="f">My native language</label><input name="native" value="${esc(L.native)}">
    <label class="f">Duolingo link (or iPhone Shortcut link)</label><input name="duoUrl" value="${esc(L.duoUrl)}">
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="reverse" ${L.reverse?'checked':''}> Also quiz me in reverse (meaning → word)</label>
    <button class="btn full mt">Save</button></form>`;
}
function renderLearn(){
  if(RV)return renderReview();
  const L=S.lang,k=todayK(),due=dueCards().length,total=L.deck.length,mature=L.deck.filter(c=>(c.ivl||0)>=21).length,mins=langMinOn(k);
  const lastDuo=[...S.logs].reverse().find(l=>l.type==='lang'&&l.duoStreak);
  let h='';
  if(!L.chosen)h+=`<div class="card warn"><h2>👋 Which language are you learning?</h2>${langSetForm()}</div>`;
  h+=`<div class="card hero"><div class="avatar">🗣️</div><div class="grow"><div class="sec-h"><span>${esc(L.name)} · ${esc(L.level.split(' ')[0])}</span>${lastDuo?`<span class="meta">🦉 ${esc(lastDuo.duoStreak)}-day streak</span>`:''}</div>
    <div class="bar xp"><i style="width:${Math.min(100,Math.round(mins/L.goal*100))}%"></i></div><div class="meta">${mins} / ${L.goal} min today · ${total} words · ${mature} mastered</div></div></div>`;
  h+=`<div class="row" style="margin-bottom:12px"><a class="btn" ${linkAttrs(L.duoUrl)}>🦉 Open Duolingo</a><button class="btn ${due?'':'ghost'}" data-act="rvStart" ${due?'':'disabled'}>🧠 Review ${due} word${due===1?'':'s'}</button></div>`;
  h+=`<form class="card" id="fLang"><h2>✅ Log practice</h2><div class="chips">${ACTS.map((a,i)=>`<label><input type="radio" name="act" value="${a}" ${i===0?'checked':''}><span>${a}</span></label>`).join('')}</div>
    <div class="row mt"><div><label class="f">Minutes</label><input name="min" type="number" min="1" inputmode="numeric" value="15"></div>
    <div class="duoOnly"><label class="f">Duolingo XP</label><input name="duoXp" type="number" min="0" inputmode="numeric" placeholder="optional"></div>
    <div class="duoOnly"><label class="f">🔥 Streak</label><input name="duoStreak" type="number" min="0" inputmode="numeric" placeholder="optional"></div></div>
    <button class="btn full mt">Save practice</button></form>`;
  h+=`<form class="card" id="fWord"><h2>➕ Add a word</h2><p class="meta">After each Duolingo lesson, add the 3–5 words you got wrong. That’s the fastest way to make them stick.</p>
    <div class="row"><input name="front" placeholder="Word or phrase in ${esc(L.name)}" required autocomplete="off"><button type="button" class="ib" style="flex:0 0 44px" data-act="speakField" aria-label="Listen">🔊</button></div>
    <input name="back" class="mt" placeholder="Meaning" required autocomplete="off"><input name="ex" class="mt" placeholder="Example sentence (optional, but it helps a lot)" autocomplete="off">
    <button class="btn full mt">Add to deck</button>
    <details><summary>Add many at once</summary><textarea id="bulkWords" rows="5" class="mt" placeholder="One per line:&#10;hola = hello&#10;la manzana = the apple | Me gusta la manzana."></textarea><button type="button" class="btn ghost full mt" data-act="bulkAdd">Import words</button></details></form>`;
  h+=`<div class="card"><div class="sec-h"><h2 style="margin:0">🤖 AI tutor</h2><select id="tutorAI" style="width:auto">${[['claude','Claude'],['openai','ChatGPT']].map(([v,n])=>`<option value="${v}" ${L.ai===v?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="grid2 mt"><button class="btn ghost" data-tutor="story">📖 Story with my words</button><button class="btn ghost" data-tutor="quiz">❓ Quiz me</button><button class="btn ghost" data-tutor="chat">💬 Conversation</button><button class="btn ghost" data-tutor="tricky">🧩 Words I forget</button></div>
    <label class="f">✍️ Write a few sentences in ${esc(L.name)} to get them corrected</label><textarea id="tutorText" rows="3"></textarea>
    <button class="btn ghost full mt" data-tutor="correct">Correct my writing</button><div class="answer" id="langAnswer"></div></div>`;
  h+=`<div class="card"><details ${total?'':'open'}><summary style="margin:0">💡 How to learn faster</summary><ol class="meta">
    <li><b>Short and daily beats long and rare.</b> 15 minutes every day does more than 2 hours on Sunday.</li>
    <li><b>Turn Duolingo mistakes into flashcards.</b> Spaced repetition shows each word right before you’d forget it.</li>
    <li><b>Try to recall before you flip the card.</b> Struggling to remember is what builds memory.</li>
    <li><b>Say everything out loud.</b> Tap 🔊, repeat it, then 🎤 check yourself (shadowing).</li>
    <li><b>Learn words inside sentences.</b> Always add an example when you can.</li>
    <li><b>Listen to content you mostly understand</b> (podcasts, YouTube for learners) 3× a week.</li>
    <li><b>Use your words.</b> Write 3 sentences and let the AI tutor correct them.</li>
    <li><b>Speak early.</b> A weekly conversation with a tutor or the AI unlocks speaking much faster.</li></ol></details></div>`;
  h+=`<div class="card"><details><summary style="margin:0">📇 My words (${total})</summary><input id="wordSearch" class="mt" placeholder="Search…" autocomplete="off"><div id="wordList" class="mt"></div></details></div>`;
  h+=`<div class="card"><details><summary style="margin:0">⚙️ Language settings</summary>${langSetForm()}</details></div>`;
  $('#learnBody').innerHTML=h;renderWordList('');syncDuo();
}
function renderWordList(q){
  const el=$('#wordList');if(!el)return;q=q.toLowerCase();
  const list=S.lang.deck.filter(c=>!q||c.front.toLowerCase().includes(q)||c.back.toLowerCase().includes(q)).slice(-200).reverse();
  el.innerHTML=list.length?list.map(c=>`<div class="li"><button class="ib" data-say="${esc(c.front)}" aria-label="Listen">🔊</button><div class="grow"><div><b>${esc(c.front)}</b> · ${esc(c.back)}</div><div class="meta">${c.first?`next review ${c.due<=todayK()?'today':esc(c.due)} · ${c.ivl>=21?'mastered 🧠':'learning'}`:'new'}</div></div><button class="ib" data-delword="${c.id}" aria-label="Delete">×</button></div>`).join(''):'<div class="empty">No words yet.</div>';
}
function syncDuo(){const f=$('#fLang');if(!f)return;const duo=f.act.value==='Duolingo';$$('#fLang .duoOnly').forEach(e=>e.classList.toggle('hidden',!duo))}
function renderReview(){
  const box=$('#learnBody'),c=S.lang.deck.find(x=>x.id===RV.queue[0]);
  if(!c){
    const n=RV.done;RV=null;
    if(n){autoTick('lang',new Date(),'flashcard|review|anki');showQC({theme:'language',title:'REVIEW CLEAR!',qtitle:`${n} card${n===1?'':'s'} reviewed`,xp:n*2})}
    box.innerHTML=`<div class="card boss"><div class="be">🎉</div><h2>All caught up!</h2><p class="sub">You reviewed ${n} card${n===1?'':'s'}. Your brain will thank you tomorrow.</p><button class="btn full" data-act="rvEnd">Done</button></div>`;
    checkProgress();return;
  }
  const rev=!!RV.rev[c.id],q=rev?c.back:c.front,a=rev?c.front:c.back;
  let h=`<div class="card review"><div class="sec-h"><span class="meta">${RV.queue.length} left · ${RV.done} done${c.first?'':' · ✨ new word'}</span><button class="pill" data-act="rvEnd">End</button></div>
    <div class="rv-q">${esc(q)}</div>${rev?'<p class="meta">Say it in '+esc(S.lang.name)+'</p>':`<button class="pill" data-say="${esc(c.front)}">🔊 Listen</button>`}`;
  if(RV.shown){
    h+=`<hr><div class="rv-a">${esc(a)}</div>${c.ex?`<div class="meta rv-ex">${esc(c.ex)} <button class="pill" data-say="${esc(c.ex)}">🔊</button></div>`:''}
      <div class="row mt" style="justify-content:center"><button class="pill" style="flex:0 0 auto" data-say="${esc(c.front)}">🔊 Listen</button><button class="pill" style="flex:0 0 auto" data-act="rvSay">🎤 Say it</button></div>
      <div class="meta mt" id="sayOut"></div>
      <div class="rate mt">${['Again','Hard','Good','Easy'].map((t,g)=>`<button class="btn r${g}" data-rate="${g}">${t}<small>${ivlLabel(schedule(c,g).ivl)}</small></button>`).join('')}</div>`;
  }else h+=`<p class="meta mt">Try to remember it, and say it out loud, before you flip.</p><button class="btn full mt" data-act="rvShow">Show answer</button>`;
  box.innerHTML=h+'</div>';
}

/* ---------- Character (anime style) ---------- */
const SKINS=['#fde3cf','#f6d0b1','#e8b48f','#c98e66','#9c6644','#6b4430'];
const HAIRC=['#2a2230','#5b3a29','#a0522d','#e8c170','#f4e6c4','#d94a4a','#ff8fb1','#7c5cff','#3b82f6','#22b8a6','#9aa3b2','#f5f5f5'];
const EYEC=['#d9822b','#7f9bb0','#6b3e26','#c98a1c','#2f9e5a','#2f7fd6','#7b4fc2','#d6453d','#5f6b7a','#1fb5c9'];
const OUTFITS=['#15151c','#2f7d6d','#3d72c4','#7b4fc2','#c2553d','#c98a1c','#2b2f36','#d16d9e','#5a7d2f'];
const BGS=['#8ea3b5','#0f1426','#1a1030','#0b1f1c','#2a0f14','#1e2540','#1d2f2a','#e6f2ee','#e3ecfa','#efe7fa','#fbe6e1','#fbf0d9','#e9e9ec','#ffd9e8','#d9ecff','#dff5e1'];
const HAIRS=[['wolf','Fluffy'],['spiky','Tufty'],['short','Neat'],['messy','Messy'],['long','Long'],['ponytail','Ponytail'],['twintails','Twin tails'],['bob','Bob'],['hijab','Hijab']];
const EYES=[['sparkle','Sparkly'],['happy','Happy ^^'],['fierce','Determined'],['cool','Sleepy']];
const MOUTHS=[['smile','Smile'],['grin','Grin'],['cat','Cat :3'],['calm','Calm']];
const MARKS=[['none','None'],['blush','Blush'],['freckles','Freckles'],['scar','Plaster'],['stubble','Stubble']];
const ACCS=[['none','None'],['earring','Earring'],['ahoge','Ahoge'],['glasses','Glasses'],['headband','Bow'],['catears','Cat ears'],['flower','Flower pin']];
const RIMS=['#ff7a1a','#ffb02e','#3aa8ff','#9b7bff','#ff3d6e','#5fe0a0','#f5f5f5','none'];
const OLDMAP={hair:{curly:'messy',cap:'short',bald:'short'},eyes:{normal:'sparkle',determined:'fierce'}};
const CLASSES={
  paladin:{e:'🛡️',n:'Paladin',perk:'+2 XP on everything. The all-rounder.',cats:'all'},
  monk:{e:'📿',n:'Spirit Monk',perk:'+5 XP on prayers & Quran',cats:['prayer']},
  warrior:{e:'⚔️',n:'Warrior',perk:'+5 XP on workouts',cats:['exercise']},
  ranger:{e:'🏹',n:'Wind Ranger',perk:'+5 XP on runs',cats:['running']},
  healer:{e:'🌸',n:'Bloom Healer',perk:'+5 XP on skin care',cats:['skincare']},
  scholar:{e:'📜',n:'Sage',perk:'+5 XP on reading',cats:['reading']},
  mage:{e:'🔮',n:'Rune Mage',perk:'+5 XP on language, +1 per flashcard',cats:['language']},
  alchemist:{e:'🧪',n:'Alchemist',perk:'+5 XP on meals, meds & health',cats:['meals','meds']},
  tactician:{e:'♟️',n:'Tactician',perk:'+5 XP on work, study & to-dos',cats:['work','other']},
};
const GEAR=[[3,'🧣','Scarf'],[5,'✨','Aura'],[8,'🦸','Cape'],[12,'🥇','Gold trim'],[16,'🌟','Star halo'],[20,'👑','Crown']];
function classOn(k){let c=null;for(const e of (S.hero.hist||[]))if(e.from<=k)c=e.c;return c}
function bonusXP(cls,cat){const C=CLASSES[cls];if(!C||!cat)return 0;return C.cats==='all'?2:C.cats.includes(cat)?5:0}
function tickXP(id,d){const cat=idCat(id);return (id.startsWith('prayer:')?XP_PRAYER:XP_ROUTINE)+bonusXP(classOn(key(d)),cat)}
let svgN=0;
function avatarChibi(h,L=1,size=54){
  const one=(v,list,def)=>list.includes(v)?v:def,ids=l=>l.map(x=>x[0]);
  const skin=one(h.skin,SKINS,SKINS[1]),hc=one(h.hairColor,HAIRC,HAIRC[0]),ec=one(h.eyeColor,EYEC,EYEC[0]),oc=one(h.outfit,OUTFITS,OUTFITS[0]),bg=one(h.bg,BGS,'#fbe6e1');
  const hair=one(OLDMAP.hair[h.hair]||h.hair,ids(HAIRS),'spiky'),eyes=one(OLDMAP.eyes[h.eyes]||h.eyes,ids(EYES),'sparkle'),mouth=one(h.mouth,ids(MOUTHS),'smile'),marks=one(h.marks||(h.beard&&h.beard!=='none'?'stubble':'none'),ids(MARKS),'none'),acc=one(h.acc,ids(ACCS),'none');
  const cls=CLASSES[h.cls]?h.cls:'paladin',id='av'+(++svgN),ink='#3a2234',hij=hair==='hijab';
  const hl=shadeC(hc,.55),hd=shadeC(hc,-.28),hk=shadeC(skin,-.1),hs=`stroke="${hd}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"`;
  const FACE='M33 52 C33 31 46 24 60 24 C74 24 87 31 87 52 C87 69 75 81 60 81 C45 81 33 69 33 52Z';
  // soft, rounded fringes (no zig-zag spikes)
  const FR={
    short:'M27 56 C21 20 44 12 60 12 C76 12 99 20 93 56 C92 50 90 46 88 42 C84 50 77 50 73 43 C70 50 62 50 60 44 C58 50 50 50 47 43 C43 50 36 50 32 42 C30 46 28 50 27 56Z',
    spiky:'M27 56 C21 20 44 12 60 12 C76 12 99 20 93 56 C91 50 88 45 84 41 C80 50 70 50 66 42 C63 51 53 51 50 42 C46 50 38 50 35 41 C31 45 28 50 27 56Z',
    messy:'M26 60 C20 20 44 11 62 12 C80 13 100 22 94 56 C93 49 90 44 86 40 C80 48 70 48 64 41 C56 50 40 52 32 49 C29 52 27 56 26 60Z',
    bob:'M26 62 C20 20 44 12 60 12 C76 12 100 20 94 62 C92 54 86 47 80 45 C70 49 50 49 40 45 C34 47 28 54 26 62Z',
    wolf:'M24 62 C16 22 44 10 60 11 C78 12 104 22 96 62 C95 54 92 48 88 44 C84 53 76 51 72 44 C68 54 58 52 56 44 C52 53 44 52 42 45 C38 54 30 53 30 46 C27 50 25 56 24 62Z',
    long:'M27 56 C21 20 44 12 60 12 C76 12 99 20 93 56 C90 46 80 40 68 40 C64 40 61 42 60 44 C59 42 56 40 52 40 C40 40 30 46 27 56Z',
  };
  FR.ponytail=FR.long;FR.twintails=FR.long;
  let s=`<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Character"><defs><clipPath id="${id}"><circle cx="60" cy="60" r="60"/></clipPath><radialGradient id="${id}b" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${shadeC(bg,.1)}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><g clip-path="url(#${id})"><rect width="120" height="120" fill="url(#${id}b)"/>`;
  s+=`<g fill="#fff" opacity=".55"><ellipse cx="22" cy="26" rx="12" ry="5"/><ellipse cx="30" cy="22" rx="8" ry="5"/><ellipse cx="98" cy="40" rx="11" ry="4.5"/><ellipse cx="90" cy="36" rx="7" ry="4.5"/></g><g fill="#fff" opacity=".75"><circle cx="13" cy="60" r="2"/><circle cx="107" cy="72" r="2.4"/><circle cx="19" cy="84" r="1.6"/><circle cx="101" cy="16" r="1.8"/></g>`;
  if(L>=16)[[16,28],[102,24],[10,66],[110,62],[28,10],[92,8],[20,100],[100,98]].forEach(([x,y],i)=>s+=`<path d="M${x} ${y-5} L${x+1.5} ${y-1.5} L${x+5} ${y} L${x+1.5} ${y+1.5} L${x} ${y+5} L${x-1.5} ${y+1.5} L${x-5} ${y} L${x-1.5} ${y-1.5}Z" fill="${i%2?'#fff':'#f5c542'}" opacity=".9"/>`);
  if(L>=5)s+=`<circle cx="60" cy="58" r="51" fill="none" stroke="#f5c542" stroke-opacity=".75" stroke-width="3.6" stroke-dasharray="0.1 7.2" stroke-linecap="round"/>`;
  if(L>=8)s+=`<path d="M17 118 L32 89 L88 89 L103 118Z" fill="#e0627a" stroke="#e0627a" stroke-width="6" stroke-linejoin="round"/><path d="M32 89 L25 118 M88 89 L95 118" stroke="#c94a63" stroke-width="2" stroke-linecap="round"/>`;
  // props behind body
  if(cls==='warrior')s+=`<path d="M86 98 L104 66" stroke="#5b6472" stroke-width="4.5" stroke-linecap="round"/><path d="M96 74 L106 80" stroke="#c98a1c" stroke-width="3.5" stroke-linecap="round"/><circle cx="105" cy="64" r="2.8" fill="#f5c542"/>`;
  if(cls==='ranger')s+=`<path d="M26 66 Q8 94 30 120" stroke="#8b5a2b" stroke-width="3.5" fill="none"/><path d="M26 66 L30 120" stroke="#e9e4dc" stroke-width="1"/>`;
  if(cls==='mage')[['A',14,40],['あ',104,44],['ب',12,82],['Ω',106,84],['ñ',22,16]].forEach(([g,x,y])=>s+=`<text x="${x}" y="${y}" font-size="11" font-weight="700" fill="#7b4fc2" opacity=".75" text-anchor="middle">${g}</text>`);
  if(cls==='healer')[[18,40],[102,46],[16,88],[104,90]].forEach(([x,y])=>s+=`<ellipse cx="${x}" cy="${y}" rx="3.5" ry="2" fill="#ff8fb1" opacity=".8" transform="rotate(35 ${x} ${y})"/>`);
  // hair behind the head (all rounded)
  if(hair==='long')s+=`<path d="M27 48 C22 10 98 10 93 48 L99 104 C99 111 90 111 86 104 L82 98 L38 98 L34 104 C30 111 21 111 21 104Z" fill="${hc}" ${hs}/>`;
  if(hair==='ponytail')s+=`<path d="M76 22 C106 14 114 52 102 82 C98 92 88 90 90 80 C95 62 92 44 78 38Z" fill="${hc}" ${hs}/>`;
  if(hair==='twintails')s+=`<path d="M32 36 C8 32 4 70 13 92 C18 101 30 96 29 85 C27 70 30 54 38 44Z" fill="${hc}" ${hs}/><path d="M88 36 C112 32 116 70 107 92 C102 101 90 96 91 85 C93 70 90 54 82 44Z" fill="${hc}" ${hs}/>`;
  if(hair==='bob')s+=`<path d="M25 50 C21 12 99 12 95 50 L98 84 C98 93 88 94 84 88 L36 88 C32 94 22 93 22 84Z" fill="${hc}" ${hs}/>`;
  if(hair==='wolf')s+=`<path d="M25 48 C18 12 102 12 95 48 C102 56 102 70 98 80 C96 90 88 88 86 80 L34 80 C32 88 24 90 22 80 C18 70 18 56 25 48Z" fill="${hc}" ${hs}/>`;
  // neck + body
  s+=`<rect x="53" y="74" width="14" height="16" rx="4" fill="${skin}"/><path d="M22 120 C22 98 38 88 60 88 C82 88 98 98 98 120Z" fill="${oc}" ${L>=12?'stroke="#f5c542" stroke-width="3"':''}/>`;
  // class outfit
  const O={
    paladin:`<path d="M44 94 L76 94 L73 112 L60 119 L47 112Z" fill="#dfe6ee" stroke="#9aa6b2" stroke-width="1.5"/><path d="M60 99 L67 102 L66 108 C65 112 60 114 60 114 C60 114 55 112 54 108 L53 102Z" fill="${oc}"/>`,
    monk:`<path d="M48 88 L60 106 L72 88" stroke="#fff" stroke-width="5" fill="none"/>`+[...Array(9)].map((_,i)=>{const t=i/8,x=46+28*t,y=92+16*4*t*(1-t);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${i%2?'#8b5a2b':'#c98a1c'}"/>`}).join('')+`<path d="M60 108 L58 116 L62 116Z" fill="#c98a1c"/>`,
    warrior:`<ellipse cx="30" cy="102" rx="13" ry="8" fill="#8a94a3" stroke="#5b6472" stroke-width="1.5"/><ellipse cx="90" cy="102" rx="13" ry="8" fill="#8a94a3" stroke="#5b6472" stroke-width="1.5"/><path d="M50 90 L60 100 L70 90" stroke="#2b2f36" stroke-width="3" fill="none"/>`,
    ranger:`<path d="M36 93 C40 83 80 83 84 93 C76 100 44 100 36 93Z" fill="#3f5a35"/><path d="M60 98 l4 4 -4 4 -4 -4Z" fill="#9ccc65"/>`,
    healer:`<path d="M46 88 L60 101 L74 88" stroke="#ffb3c6" stroke-width="4" fill="none"/>`+[0,72,144,216,288].map(a=>`<circle cx="${(60+3.6*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(108+3.6*Math.sin(a*Math.PI/180)).toFixed(1)}" r="2.6" fill="#ff8fb1"/>`).join('')+`<circle cx="60" cy="108" r="1.8" fill="#f5c542"/>`,
    scholar:`<path d="M48 88 L57 108 L53 90Z M72 88 L63 108 L67 90Z" fill="#f5f0e1"/><rect x="53" y="104" width="14" height="10" rx="1.5" fill="#f5f0e1" stroke="#8b5a2b" stroke-width="1.5"/><path d="M60 104 L60 114" stroke="#8b5a2b" stroke-width="1.2"/>`,
    mage:`<path d="M38 96 L32 80 L50 89Z M82 96 L88 80 L70 89Z" fill="${oc}" stroke="#f5c542" stroke-width="1.2"/><circle cx="60" cy="104" r="4.5" fill="#b69cff" stroke="#fff" stroke-width="1.5"/>`,
    alchemist:`<path d="M46 94 L74 94 L77 120 L43 120Z" fill="#f2ead8"/><rect x="54" y="104" width="12" height="8" rx="2" fill="#e0d4b8"/><path d="M60 98 C63 96 66 97 66 100 C63 101 61 100 60 98Z" fill="#5a9e3a"/>`,
    tactician:`<path d="M51 88 L60 101 L69 88Z" fill="#fff"/><path d="M58.5 92 L61.5 92 L63 106 L60 110 L57 106Z" fill="#c2553d"/><path d="M47 90 L56 106 M73 90 L64 106" stroke="#00000040" stroke-width="2"/>`,
  };
  if(L>=3&&!hij)s+=`<path d="M41 86 C52 93 68 93 79 86 L81 91 C70 98 50 98 39 91Z" fill="#e5484d"/><path d="M71 93 L84 112 L77 113 L67 95Z" fill="#e5484d"/>`;
  s+=O[cls];
  // head
  if(hij)s+=`<path d="M26 56 C24 4 96 4 94 56 C94 72 90 84 84 90 L102 106 C88 118 32 118 18 106 L36 90 C30 84 26 72 26 56Z" fill="${hc}" ${hs}/>`;
  else{
    s+=`<ellipse cx="60" cy="42" rx="34" ry="30" fill="${hc}" ${hs}/>`;
    if(hair==='spiky')s+=`<path d="M42 22 C34 6 52 0 56 14Z M56 16 C56 -2 76 2 70 18Z M72 22 C82 8 96 18 84 30Z" fill="${hc}" ${hs}/>`;
    if(acc==='catears')s+=`<path d="M37 30 L35 9 L55 21Z M83 30 L85 9 L65 21Z" fill="${hc}" stroke="${hc}" stroke-width="5" stroke-linejoin="round"/><path d="M40 24 L39 15 L47 20Z M80 24 L81 15 L73 20Z" fill="#ffb3c6" stroke="#ffb3c6" stroke-width="3" stroke-linejoin="round"/>`;
  }
  s+=`<path d="${FACE}" fill="${skin}" stroke="${hk}" stroke-width=".8"/>`;
  // brows, blush, tiny nose, face marks (under the fringe)
  const bc=hij?ink:hd,brow=(cx,dir)=>eyes==='fierce'?`<path d="M${cx+dir*5.5} 48.4 L${cx-dir*5} 50.6" stroke="${bc}" stroke-width="1.8" stroke-linecap="round"/>`:`<path d="M${cx-5} 50 Q${cx} 47.8 ${cx+5} 50" stroke="${bc}" stroke-opacity=".75" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  s+=brow(47,-1)+brow(73,1);
  const bo=marks==='blush'?.72:.42;
  s+=`<ellipse cx="44" cy="70.5" rx="4.8" ry="3" fill="#ff8fa3" opacity="${bo}"/><ellipse cx="76" cy="70.5" rx="4.8" ry="3" fill="#ff8fa3" opacity="${bo}"/><path d="M59.3 67.2 Q60 68 60.7 67.2" stroke="${hk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  if(marks==='blush')s+=`<path d="M41.5 71.8 l1.6 -2.6 M44.5 71.8 l1.6 -2.6 M47.5 71.8 l1.6 -2.6 M72.5 71.8 l1.6 -2.6 M75.5 71.8 l1.6 -2.6 M78.5 71.8 l1.6 -2.6" stroke="#ff6f8e" stroke-width=".9" stroke-linecap="round" opacity=".8"/>`;
  if(marks==='freckles')[[42,66],[45,67.6],[43.5,69.6],[75,67.6],[78,66],[76.5,69.6]].forEach(([x,y])=>s+=`<circle cx="${x}" cy="${y}" r=".9" fill="#b0765a" opacity=".75"/>`);
  if(marks==='scar')s+=`<g transform="rotate(-25 78 66)"><rect x="72" y="63" width="12" height="5.4" rx="2.7" fill="#f8d9b8" stroke="#d9a977" stroke-width=".6"/><rect x="76" y="63" width="4" height="5.4" fill="#f0c498"/></g>`;
  if(marks==='stubble'&&!hij)s+=`<path d="M40 66 C44 78 52 80 60 80 C68 80 76 78 80 66 C76 74 68 76 60 76 C52 76 44 74 40 66Z" fill="${hc}" opacity=".25"/>`;
  // front hair
  if(hij)s+=`<path d="M31 58 C29 6 91 6 89 58 C85 40 35 40 31 58Z" fill="${hc}"/><path d="M42 30 Q60 20 78 30" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="86" cy="66" r="2.6" fill="#fff" stroke="#f5c542" stroke-width="1.2"/>`;
  else{
    s+=`<path d="${FR[hair]||FR.short}" fill="${hc}" ${hs}/>`;
    if(hair==='long'||hair==='bob'||hair==='wolf'){const e=hair==='bob'?82:hair==='wolf'?86:92;s+=`<path d="M29 52 C25 64 26 ${e-14} 32 ${e} C37 ${e-12} 36 64 38 52Z" fill="${hc}" ${hs}/><path d="M91 52 C95 64 94 ${e-14} 88 ${e} C83 ${e-12} 84 64 82 52Z" fill="${hc}" ${hs}/>`}
    if(hair==='ponytail')s+=`<circle cx="78" cy="30" r="3.6" fill="#ff8fb1" stroke="#fff" stroke-width="1"/>`;
    if(hair==='twintails')s+=`<circle cx="35" cy="40" r="3.6" fill="#ff8fb1" stroke="#fff" stroke-width="1"/><circle cx="85" cy="40" r="3.6" fill="#ff8fb1" stroke="#fff" stroke-width="1"/>`;
    s+=`<path d="M37 26 Q47 16 62 17" stroke="#fff" stroke-opacity=".55" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="68" cy="18.5" r="1.4" fill="#fff" opacity=".6"/>`;
  }
  // big glossy eyes
  const eye=(cx,left)=>{const cy=59,dir=left?-1:1;
    if(eyes==='happy')return `<path d="M${cx-6.5} ${cy+2} Q${cx} ${cy-7} ${cx+6.5} ${cy+2}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${cx+dir*6.4} ${cy+.6} l${dir*2} -1.4" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
    const sl=eyes==='cool',ry=sl?6.6:8.4;
    let e=`<ellipse cx="${cx}" cy="${cy+.5}" rx="7" ry="${ry}" fill="${shadeC(ec,-.45)}"/><ellipse cx="${cx}" cy="${cy+1.2}" rx="5.9" ry="${ry-1.3}" fill="${ec}"/><ellipse cx="${cx}" cy="${cy+ry*.55}" rx="4.6" ry="${ry*.3}" fill="${shadeC(ec,.6)}" opacity=".75"/><ellipse cx="${cx}" cy="${cy+1}" rx="2.9" ry="${ry*.52}" fill="${ink}"/><circle cx="${cx-2.4}" cy="${cy-ry*.32}" r="2.7" fill="#fff"/><circle cx="${cx+2.6}" cy="${cy+ry*.42}" r="1.35" fill="#fff"/><circle cx="${cx+3.4}" cy="${cy-ry*.1}" r=".75" fill="#fff"/>`;
    if(sl)e+=`<path d="M${cx-8} ${cy-ry-2} H${cx+8} V${cy-1} Q${cx} ${cy+1.6} ${cx-8} ${cy-1}Z" fill="${skin}"/><path d="M${cx-7.4} ${cy-1} Q${cx} ${cy+1.4} ${cx+7.4} ${cy-1}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    else e+=`<path d="M${cx-7.2} ${cy+.5} A7.2 ${ry+.4} 0 0 1 ${cx+7.2} ${cy+.5}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    return e+`<path d="M${cx+dir*7} ${cy-2} q${dir*2.4} -.2 ${dir*3} -2.6" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  };
  s+=eye(47,true)+eye(73,false);
  s+=mouth==='grin'?`<path d="M55 71 Q60 80 65 71Z" fill="#9a3a4a"/><ellipse cx="60" cy="74" rx="2.6" ry="1.4" fill="#ff8fa3"/>`:mouth==='cat'?`<path d="M53.5 71.5 Q56.7 75.5 60 71.8 Q63.3 75.5 66.5 71.5" stroke="#a8454f" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`:mouth==='calm'?`<path d="M57 73 Q60 74.6 63 73" stroke="#a8454f" stroke-width="1.7" fill="none" stroke-linecap="round"/>`:`<path d="M55.5 72 Q60 77 64.5 72" stroke="#a8454f" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // accessories (rounded)
  if(acc==='earring'&&!hij)s+=`<circle cx="35" cy="66" r="2.2" fill="none" stroke="#f5c542" stroke-width="1.2"/>`;
  if(acc==='glasses')s+=`<g stroke="#8a5a72" stroke-width="1.8" fill="#ffffff2a"><circle cx="47" cy="59" r="10.4"/><circle cx="73" cy="59" r="10.4"/><path d="M57.4 58 Q60 56.4 62.6 58" fill="none"/></g>`;
  if(acc==='headband'&&!hij)s+=`<path d="M32 36 C44 28 76 28 88 36 L88 42 C76 34 44 34 32 42Z" fill="#ff7a90"/><g fill="#ff7a90"><ellipse cx="80" cy="30" rx="8" ry="5" transform="rotate(-25 80 30)"/><ellipse cx="94" cy="32" rx="8" ry="5" transform="rotate(25 94 32)"/></g><circle cx="87" cy="31" r="3.4" fill="#ff5a78"/>`;
  if(acc==='ahoge'&&!hij)s+=`<path d="M60 16 C58 4 70 0 74 6 C76 10 70 12 68 8" stroke="${hc}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(acc==='flower')s+=[0,72,144,216,288].map(a=>`<circle cx="${(81+4*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(31+4*Math.sin(a*Math.PI/180)).toFixed(1)}" r="3.2" fill="#ff8fb1" stroke="#fff" stroke-width=".6"/>`).join('')+`<circle cx="81" cy="31" r="2.2" fill="#f5c542"/>`;
  if(L>=20){const y=hij?18:acc==='catears'?14:16;s+=`<path d="M45 ${y+12} L48 ${y} L54 ${y+7} L60 ${y-4} L66 ${y+7} L72 ${y} L75 ${y+12}Z" fill="#f5c542" stroke="#c98a1c" stroke-width="2.6" stroke-linejoin="round"/><circle cx="60" cy="${y+8}" r="2" fill="#e5484d"/>`}
  return s+'</g></svg>';
}
let HD=null,heroPeekL=null;
function renderHero(){
  if(!HD)HD={...S.hero};
  const L=heroPeekL||levelInfo(totalXP()).L;
  const sw=(part,list)=>`<div class="swatches">${list.map(c=>`<button class="sw ${HD[part]===c?'on':''}" data-opt="${part}" data-val="${c}" style="background:${c==='none'?'transparent':c}" aria-label="${c==='none'?'none':'color '+c}">${c==='none'?'⊘':''}</button>`).join('')}</div>`;
  const ch=(part,list,def)=>`<div class="chips">${list.map(([v,l])=>`<label><input type="radio" ${(HD[part]||def)===v?'checked':''}><span data-opt="${part}" data-val="${v}">${l}</span></label>`).join('')}</div>`;
  const C=CLASSES[HD.cls]||CLASSES.paladin;
  const hun=HD.style==='hunter';
  let h=`<div class="card" style="text-align:center"><div class="prev">${HD.useImg&&okImg(HD.img)?`<img class="prevshow" src="${HD.img}" alt="">`:avatarSVG(HD,L,180)}</div><div class="qt" style="font-size:20px">${esc(HD.name||'Your hero')}</div><div class="meta">${C.e} ${C.n} · Level ${L}${HD.motto?` · “${esc(HD.motto)}”`:''}</div>
    <button class="linkbtn" data-act="heroPeek">${heroPeekL?'← Back to my real level':'👀 Preview your Level 20 look'}</button></div>`;
  h+=`<div class="card"><label class="f" style="margin-top:0">Name</label><input id="heroName" maxlength="20" placeholder="e.g. Layla the Unstoppable" value="${esc(HD.name||'')}" autocomplete="off">
    <label class="f">Motto (optional)</label><input id="heroMotto" maxlength="40" placeholder="e.g. One more step" value="${esc(HD.motto||'')}" autocomplete="off"></div>`;
  h+=`<div class="card"><h2>Class</h2><p class="meta">Each class has its own outfit and a bonus for one kind of activity. You can switch any time.</p><div class="classes">${Object.entries(CLASSES).map(([k,c])=>`<button class="cls ${HD.cls===k?'on':''}" data-opt="cls" data-val="${k}">${avatarSVG({...HD,cls:k},L,52)}<span>${c.e} ${c.n}</span><small>${c.perk}</small></button>`).join('')}</div></div>`;
  h+=`<div class="card"><h2>Look</h2>
    <label class="f">Character art</label><div class="chips">${[['0','🎨 Drawn by Kuestro'],['1','🖼️ My own image']].map(([v,l])=>`<label><input type="radio" ${(HD.useImg&&okImg(HD.img)?'1':'0')===v?'checked':''}><span data-opt="useImg" data-val="${v}">${l}</span></label>`).join('')}</div>
    ${HD.useImg?`<div class="mt"><label class="btn ${okImg(HD.img)?'ghost':''} full">📤 ${okImg(HD.img)?'Change illustration':'Upload your anime illustration'}<input type="file" id="heroImg" accept="image/*" hidden></label><p class="meta mt">Upload a full anime illustration (portrait or half-body works best). It becomes your character card on Quests and Today and appears in every QUEST CLEAR screen. It's stored only on this phone, never on GitHub.</p></div>`:''}
    <label class="f">Art style</label><div class="chips">${[['chibi','🍡 Cute (kawaii)'],['hunter','⚔️ Hunter (dark anime)']].map(([v,l])=>`<label><input type="radio" ${(HD.style||'chibi')===v?'checked':''}><span data-opt="style" data-val="${v}">${l}</span></label>`).join('')}</div>
    ${hun?`<label class="f">Face</label><div class="chips">${[['sharp','Sharp'],['soft','Soft (long lashes)'],['mature','Mature (longer)']].map(([v,l])=>`<label><input type="radio" ${(HD.face||'sharp')===v?'checked':''}><span data-opt="face" data-val="${v}">${l}</span></label>`).join('')}</div>
    <label class="f">Quick looks</label><div class="chips"><span class="pill" data-preset="moody">🌧️ Moody casual</span><span class="pill" data-preset="night">🌃 Night hunter</span></div>
    <label class="f">Outfit</label><div class="chips">${[['tech','🧥 Techwear jacket'],['sweater','👕 Sweatshirt']].map(([v,l])=>`<label><input type="radio" ${(HD.wear||'tech')===v?'checked':''}><span data-opt="wear" data-val="${v}">${l}</span></label>`).join('')}</div>
    <label class="f">Background</label><div class="chips">${[['city','🌃 Night city'],['plain','Plain color']].map(([v,l])=>`<label><input type="radio" ${(HD.scene||'city')===v?'checked':''}><span data-opt="scene" data-val="${v}">${l}</span></label>`).join('')}</div>
    <label class="f">Light color (rim light & glow)</label>${sw('rim',RIMS)}
    <label class="f">Glowing eyes</label><div class="chips">${[['1','✨ On'],['0','Off']].map(([v,l])=>`<label><input type="radio" ${(HD.glow===true?'1':'0')===v?'checked':''}><span data-opt="glow" data-val="${v}">${l}</span></label>`).join('')}</div>`:''}
    <label class="f">Hair</label>${ch('hair',HAIRS,'spiky')}
    <label class="f">Hair / hijab color</label>${sw('hairColor',HAIRC)}
    <label class="f">Eyes</label>${ch('eyes',EYES,'sparkle')}
    <label class="f">Eye color</label>${sw('eyeColor',EYEC)}
    <label class="f">Mouth</label>${ch('mouth',MOUTHS,'smile')}
    <label class="f">Skin</label>${sw('skin',SKINS)}
    <label class="f">Face details</label>${ch('marks',MARKS,'none')}
    <label class="f">Accessory</label>${ch('acc',ACCS,'none')}
    <label class="f">Outfit color</label>${sw('outfit',OUTFITS)}
    <label class="f">Background color</label>${sw('bg',BGS)}</div>`;
  const myL=levelInfo(totalXP()).L;
  h+=`<div class="card"><h2>Gear you unlock by leveling up</h2><div class="badges">${GEAR.map(([lv,e,n])=>`<div class="badge ${myL>=lv?'':'locked'}"><b>${e}</b>${n}<div class="meta">Level ${lv}</div></div>`).join('')}</div></div>`;
  h+=`<div class="row" style="margin-bottom:12px"><button class="btn ghost" data-act="heroRandom">🎲 Randomize</button><button class="btn" data-act="heroSave">${S.hero.created?'Save':'Start my adventure'}</button></div>`;
  $('#heroBody').innerHTML=h;
}
function heroRandom(){
  const r=a=>a[Math.floor(Math.random()*a.length)],ids=l=>l.map(x=>x[0]);
  Object.assign(HD,{skin:r(SKINS),hair:r(ids(HAIRS)),hairColor:r(HAIRC),eyes:r(ids(EYES)),eyeColor:r(EYEC),mouth:r(ids(MOUTHS)),marks:r(ids(MARKS)),acc:r(ids(ACCS)),outfit:r(OUTFITS),bg:r(BGS)});
}
function heroSave(){
  HD.name=($('#heroName').value||'').trim();HD.motto=($('#heroMotto').value||'').trim();
  if(!HD.name){$('#heroName').focus();return toast('Give your character a name')}
  const first=!S.hero.created,k=todayK(),hist=[...(S.hero.hist||[])],last=hist[hist.length-1];
  if(!last||last.c!==HD.cls){if(last&&last.from===k)last.c=HD.cls;else hist.push({c:HD.cls,from:k})}
  S.hero={...HD,hist,created:true};HD=null;heroPeekL=null;save();show('quests');checkProgress();
  if(first){const C=CLASSES[S.hero.cls];celebrate(avatarSVG(S.hero,levelInfo(totalXP()).L,150),`Welcome, ${S.hero.name}!`,`${C.e} ${C.n} · ${C.perk.replace(/\.$/,'')}. Your adventure begins!`)}
  else toast('Character saved ✓');
}

/* ---------- Quest-clear animations ---------- */
const THEMES={
  prayer:{c:'#f5c542',fx:['🌙','⭐','✨','⭐'],mode:'rise',prop:'🌙',sub:'Your spirit glows brighter ✨'},
  workout:{c:'#ff6b3d',fx:['💥','⚡','💪','🔥'],mode:'burst',prop:'🏋️',sub:'POWER UP! Strength +1',shake:1},
  run:{c:'#3bc4ff',fx:['💨','💨','👟','⚡'],mode:'dash',prop:'👟',sub:'Speed +1! Nothing can catch you'},
  skincare:{c:'#ff8fb1',fx:['🫧','✨','🌸','💧'],mode:'rise',prop:'🧴',sub:'Glow level rising ✨'},
  reading:{c:'#c9a46a',fx:['📖','📜','✨','🔖'],mode:'rise',prop:'📖',sub:'Wisdom +1'},
  language:{c:'#9b7bff',fx:['Hola!','Bonjour!','مرحبا','こんにちは','Ciao!','Hallo!','안녕!','Olá!','Merhaba!','Привет!'],words:1,mode:'rise',prop:'💬',sub:'New spell learned!'},
  meals:{c:'#5fd068',fx:['🍎','🥑','🥗','🍌','🥕','🍇'],mode:'fall',prop:'🍎',sub:'HP restored! Fueled up'},
  steps:{c:'#ffb347',fx:['👣'],mode:'walk',prop:'👣',sub:'Explorer path unlocked'},
  meds:{c:'#4fd1c5',fx:['💊','💚','✨','🩺'],mode:'rise',prop:'💊',sub:'Health shield +1 🛡️'},
  todo:{c:'#60a5fa',fx:['✅','📋','✨','✔️'],mode:'burst',prop:'📋',sub:'Task cleared! Focus +1'},
  power:{c:'#ffd23f',fx:['⚡','✨','🔥','💫'],mode:'burst',prop:'⚡',sub:'COMBO!'},
  chest:{c:'#f5c542',fx:['🪙','💎','🪙','✨'],mode:'fall',prop:'🎁',sub:'Treasure chest opened!'},
  perfect:{c:'#ffe066',fx:['🌟','✨','💫','⭐'],mode:'burst',prop:'🌟',sub:'PERFECT! Flawless victory'},
  boss:{c:'#ff3d5a',fx:['💥','⚔️','🔥','✨'],mode:'burst',prop:'⚔️',sub:'The monster falls. Legendary!',shake:1},
  level:{c:'#f5c542',fx:['⭐','✨','💫','🌟'],mode:'burst',prop:'⬆️',sub:''},
  badge:{c:'#b69cff',fx:['✨','🏅','💫','⭐'],mode:'burst',prop:'',sub:''},
};
const QTH={pray5:'prayer',fajr:'prayer',deen:'prayer',pray5d:'prayer',skin:'skincare',move:'workout',wo3:'workout',pages:'reading',pg100:'reading',meals:'meals',meal14:'meals',steps:'steps',five:'power',duo:'language',srs:'language',words5:'language',langmin:'language',lang90:'language',words25:'language',rev100:'language',chest:'chest',perfect:'perfect',perf2:'perfect',km15:'run',boss:'boss',meds:'meds',meds7:'meds',train:'workout',train5:'workout',todo3:'todo',todos:'todo',todo15:'todo'};
const CAT2TH={prayer:'prayer',exercise:'workout',running:'run',skincare:'skincare',reading:'reading',language:'language',meals:'meals',work:'power',other:'power'};
const qTheme=qk=>QTH[String(qk).split(':').pop()]||'power';
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const QCQ=[];let qcOn=false;
function showQC(o){QCQ.push(o);if(!qcOn)nextQC()}
function nextQC(){
  const el=$('#qc'),o=QCQ.shift();clearTimeout(el._t);
  if(!o){qcOn=false;el.className='qc hidden';el.innerHTML='';return}
  qcOn=true;const T=THEMES[o.theme]||THEMES.power;
  const L=S?levelInfo(totalXP()).L:1;
  const ill=S&&hasArt(S.hero)?`<img class="qc-img" src="${S.hero.img}" alt="">`:null;
  const art=o.big?(String(o.big).startsWith('<svg')?(ill||o.big):`<div class="qc-emoji">${esc(o.big)}</div>`):(ill||S&&S.hero.created?(ill||avatarSVG(S.hero,L,150)):`<div class="qc-emoji">${T.prop||'🏆'}</div>`);
  el.className='qc'+(T.shake?' shake':'');el.style.setProperty('--qc',T.c);
  el.innerHTML=`<div class="qc-lines"></div>${o.theme==='boss'?'<div class="qc-slash"></div>':''}<div class="qc-stage"><div class="qc-av">${art}${T.prop&&!(o.big&&!String(o.big).startsWith('<svg'))?`<span class="qc-prop">${T.prop}</span>`:''}</div>
    <div class="qc-title">${esc(o.title)}</div>${o.qtitle?`<div class="qc-q">${esc(o.qtitle)}</div>`:''}<div class="qc-sub">${esc(o.sub||T.sub)}</div>${o.xp?`<div class="qc-xp">+${o.xp} XP</div>`:''}<div class="qc-tap">tap to continue</div></div>`;
  if(!reduceMotion())qcParticles(el,T);
  playSound(o.theme);if(navigator.vibrate)navigator.vibrate(T.shake?[40,30,40,30,90]:[20,40,20]);
  if(!o.hold)el._t=setTimeout(nextQC,3400);
}
function qcParticles(el,T){
  const n=T.mode==='walk'?10:T.words?12:24,W=innerWidth,H=innerHeight;
  for(let i=0;i<n;i++){
    const p=document.createElement('span'),st=p.style;p.className='qp '+T.mode+(T.words?' word':'');p.textContent=T.fx[i%T.fx.length];
    if(T.mode==='rise'){st.left=(Math.random()*90)+'%';st.top='102%';st.setProperty('--dx',(Math.random()*60-30)+'px');st.setProperty('--dy',-(H*1.15)+'px')}
    else if(T.mode==='fall'){st.left=(Math.random()*95)+'%';st.top='-8%';st.setProperty('--dx',(Math.random()*60-30)+'px');st.setProperty('--dy',(H*1.2)+'px')}
    else if(T.mode==='dash'){st.left='-18%';st.top=(8+Math.random()*84)+'%';st.setProperty('--dx',(W*1.45)+'px');st.setProperty('--dy','0px')}
    else if(T.mode==='walk'){st.left=(6+i*9)+'%';st.top=(84-i*7+(i%2?3:-3))+'%';st.setProperty('--rot',(i%2?40:20)+'deg')}
    else{st.left='50%';st.top='40%';const a=Math.random()*Math.PI*2,r=110+Math.random()*Math.min(W,H)*.42;st.setProperty('--dx',(Math.cos(a)*r).toFixed(0)+'px');st.setProperty('--dy',(Math.sin(a)*r).toFixed(0)+'px')}
    st.setProperty('--r',(Math.random()*360-180).toFixed(0)+'deg');
    st.animationDelay=(T.mode==='walk'?i*.16:Math.random()*(T.mode==='burst'?.25:.9)).toFixed(2)+'s';
    if(!T.words)st.fontSize=(22+Math.random()*18).toFixed(0)+'px';
    el.append(p);
  }
}
function burst(x,y,th){
  if((!x&&!y)||reduceMotion())return;const T=THEMES[th]||THEMES.power;
  for(let i=0;i<6;i++){const p=document.createElement('span'),a=-Math.PI/2+(Math.random()-.5)*2.6,r=40+Math.random()*55;
    p.className='tb';p.textContent=T.words?['✨','💬','⭐'][i%3]:T.fx[i%T.fx.length];p.style.left=x+'px';p.style.top=y+'px';
    p.style.setProperty('--dx',(Math.cos(a)*r).toFixed(0)+'px');p.style.setProperty('--dy',(Math.sin(a)*r).toFixed(0)+'px');
    document.body.append(p);setTimeout(()=>p.remove(),950)}
}
let AC=null;
function playSound(th){
  if(!S||S.settings.sound===false)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const seq={boss:[196,262,330,392,523,659],level:[392,523,659,784,1047],prayer:[440,554,659,880],language:[523,587,659,784,880],workout:[262,330,392,523]}[th]||[523,659,784,1047];
    const t0=AC.currentTime+.02;
    seq.forEach((f,i)=>{const o=AC.createOscillator(),g=AC.createGain(),t=t0+i*.085;o.type=th==='boss'||th==='workout'?'square':'triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(th==='boss'||th==='workout'?.05:.12,t+.015);g.gain.exponentialRampToValueAtTime(.0005,t+.38);
      o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.4)});
  }catch(e){}
}

/* ---------- Medications ---------- */
const MED_FORMS=[['pill','💊 Pill'],['capsule','💊 Capsule'],['drops','💧 Drops'],['syrup','🥄 Syrup'],['injection','💉 Injection'],['inhaler','🌬️ Inhaler'],['cream','🧴 Cream'],['other','✨ Other']];
const MED_FOOD=[['any','Any time'],['with','With food'],['before','Before food'],['after','After food'],['empty','Empty stomach']];
const medIcon=f=>({drops:'💧',syrup:'🥄',injection:'💉',inhaler:'🌬️',cream:'🧴'})[f]||'💊';
const idCat=id=>id.startsWith('prayer:')?'prayer':id.startsWith('med:')?'meds':(S.routines.find(r=>r.id===id)||{}).cat;
function medDue(m,d){
  if(m.active===false)return false;const k=key(d);
  if(m.start&&k<m.start)return false;if(m.end&&k>m.end)return false;
  if(m.freq==='weekly')return (m.days||[]).includes(d.getDay());
  if(m.freq==='interval'){const n=dayDiff(parse(m.start||k),d);return n>=0&&n%(+m.every||2)===0}
  return true;
}
function dosesOn(d){
  const out=[];(S.meds||[]).forEach(m=>{if(!medDue(m,d))return;(m.times&&m.times.length?m.times:['']).forEach(t=>out.push({m,t,id:`med:${m.id}@${t}`}))});
  return out.sort((a,b)=>(a.t||'99').localeCompare(b.t||'99'));
}
const medTracked=m=>m.stock!==''&&m.stock!=null&&!isNaN(+m.stock);
function medAdherence(days,medId){
  let due=0,dn=0;for(let i=0;i<days;i++){const d=addDays(new Date(),-i);dosesOn(d).forEach(x=>{if(medId&&x.m.id!==medId)return;if(key(d)===todayK()&&x.t&&x.t>nowHM()&&!isDone(x.id,d))return;due++;if(isDone(x.id,d))dn++})}
  return due?Math.round(dn/due*100):null;
}
const nowHM=()=>{const n=new Date();return `${pad(n.getHours())}:${pad(n.getMinutes())}`};
function renderMeds(){
  const list=S.meds||[];let h='';
  const a7=medAdherence(7),a30=medAdherence(30),low=list.filter(m=>m.active!==false&&medTracked(m)&&+m.stock<=(+m.refillAt||0));
  if(list.length)h+=`<div class="card"><div class="stats"><div class="stat"><b>${a7==null?'—':a7+'%'}</b><span class="meta">taken on time, 7 days</span></div><div class="stat"><b>${a30==null?'—':a30+'%'}</b><span class="meta">last 30 days</span></div></div></div>`;
  if(low.length)h+=`<div class="card warn"><b>⚠️ Refill soon</b>${low.map(m=>`<div class="li"><div class="grow">${esc(m.name)} <span class="meta">· ${+m.stock} left</span></div><button class="pill" data-refill="${m.id}">+ Refill</button></div>`).join('')}</div>`;
  h+=list.length?`<div class="card">${list.map(m=>{const ad=medAdherence(30,m.id);
    return `<div class="li" data-editmed="${m.id}" style="cursor:pointer"><span style="font-size:22px">${medIcon(m.form)}</span><div class="grow"><div><b>${esc(m.name)}</b>${m.dose?' · '+esc(m.dose):''}${m.active===false?' <span class="meta">(paused)</span>':''}</div>
      <div class="meta">${medFreqText(m)}${(m.times||[]).filter(Boolean).length?' · '+m.times.map(fmtTime).join(', '):''}${m.food&&m.food!=='any'?' · '+MED_FOOD.find(f=>f[0]===m.food)[1].toLowerCase():''}${medTracked(m)?` · ${+m.stock} left`:''}${ad!=null?` · ${ad}% taken`:''}</div></div><span class="meta">›</span></div>`}).join('')}</div>`
    :`<div class="empty">No medications yet.<br>Add them to get them on your Today list, with reminders, refill alerts and a quest.</div>`;
  h+=`<button class="btn full" data-act="newMed">+ Add medication</button>`;
  if(list.length)h+=`<button class="btn ghost full mt" data-act="medsIcs">📅 Add medication reminders to my calendar</button>`;
  h+=`<p class="meta mt">💡 Your medication list is stored only on this phone (encrypted if you set a passcode). Always follow your doctor’s or pharmacist’s instructions.</p>`;
  $('#medsBody').innerHTML=h;
}
const medFreqText=m=>m.freq==='weekly'?((m.days||[]).length?[...m.days].sort().map(i=>DAYS[i]).join(', '):'No days'):m.freq==='interval'?`Every ${m.every} days`:'Every day';
let editingMed=null;
function openMed(m){
  editingMed=m||null;
  const x=m||{name:'',dose:'',form:'pill',freq:'daily',days:[],every:2,times:['08:00'],food:'any',start:todayK(),end:'',stock:'',perDose:1,refillAt:7,notes:'',active:true};
  const f=$('#mForm');
  f.innerHTML=`<h2>${m?'Edit medication':'New medication'}</h2>
    <input name="name" placeholder="Name, e.g. Vitamin D" value="${esc(x.name)}" required autocomplete="off">
    <div class="row mt"><input name="dose" placeholder="Dose, e.g. 1000 IU" value="${esc(x.dose)}" autocomplete="off"><select name="form">${MED_FORMS.map(([v,l])=>`<option value="${v}" ${x.form===v?'selected':''}>${l}</option>`).join('')}</select></div>
    <label class="f">How often</label><select name="freq" id="mFreq"><option value="daily" ${x.freq==='daily'?'selected':''}>Every day</option><option value="weekly" ${x.freq==='weekly'?'selected':''}>Certain days of the week</option><option value="interval" ${x.freq==='interval'?'selected':''}>Every few days</option></select>
    <div id="mWeekly" class="mt ${x.freq==='weekly'?'':'hidden'}"><div class="chips">${[6,0,1,2,3,4,5].map(i=>`<label><input type="checkbox" name="mdays" value="${i}" ${(x.days||[]).includes(i)?'checked':''}><span>${DAYS[i]}</span></label>`).join('')}</div></div>
    <div id="mEvery" class="mt ${x.freq==='interval'?'':'hidden'}"><input name="every" type="number" min="2" max="60" value="${x.every||2}" placeholder="Every … days"></div>
    <label class="f">Times</label><div class="chips" style="margin-bottom:6px"><button type="button" class="pill" data-mtimes="08:00">1× a day</button><button type="button" class="pill" data-mtimes="08:00,20:00">2×</button><button type="button" class="pill" data-mtimes="08:00,14:00,20:00">3×</button><button type="button" class="pill" data-act="mAddTime">+ time</button></div>
    <div id="mTimes" class="timegrid">${(x.times||[]).map(t=>`<input type="time" name="mtime" value="${t}">`).join('')}</div>
    <label class="f">Food</label><select name="food">${MED_FOOD.map(([v,l])=>`<option value="${v}" ${x.food===v?'selected':''}>${l}</option>`).join('')}</select>
    <div class="row"><div><label class="f">Start</label><input type="date" name="start" value="${x.start||''}"></div><div><label class="f">End (optional)</label><input type="date" name="end" value="${x.end||''}"></div></div>
    <div class="row"><div><label class="f">In stock (optional)</label><input type="number" name="stock" min="0" step="any" value="${x.stock??''}" placeholder="e.g. 30"></div><div><label class="f">Per dose</label><input type="number" name="perDose" min="0" step="any" value="${x.perDose??1}"></div><div><label class="f">Alert at</label><input type="number" name="refillAt" min="0" value="${x.refillAt??7}"></div></div>
    <label class="f">Notes (optional)</label><input name="notes" value="${esc(x.notes||'')}" placeholder="e.g. take with a full glass of water" autocomplete="off">
    ${m?`<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="active" ${x.active!==false?'checked':''}> Active (uncheck to pause)</label>`:''}
    <div class="row" style="margin-top:16px">${m?'<button type="button" class="btn danger" data-act="delMed">Delete</button>':''}<button type="button" class="btn ghost" data-act="closeMed">Cancel</button><button class="btn">Save</button></div>`;
  $('#mDlg').showModal();
}
function medsIcs(){
  const L=icsHead('Medications'),st=stamp(),BY=['SU','MO','TU','WE','TH','FR','SA'];
  (S.meds||[]).filter(m=>m.active!==false).forEach(m=>{
    let start=parse(m.start&&m.start>todayK()?m.start:todayK());
    if(m.freq==='interval'&&m.start){const n=dayDiff(parse(m.start),start),off=((n%m.every)+m.every)%m.every;if(off)start=addDays(start,m.every-off)}
    const rule=(m.freq==='weekly'?`FREQ=WEEKLY;BYDAY=${(m.days||[]).map(i=>BY[i]).join(',')}`:m.freq==='interval'?`FREQ=DAILY;INTERVAL=${m.every}`:'FREQ=DAILY')+(m.end?`;UNTIL=${m.end.replace(/-/g,'')}T235959`:'');
    if(m.freq==='weekly'&&!(m.days||[]).length)return;
    (m.times||[]).filter(Boolean).forEach(t=>{
      L.push('BEGIN:VEVENT',`UID:${m.id}-${t.replace(':','')}@dayflow`,`DTSTAMP:${st}`,`DTSTART:${key(start).replace(/-/g,'')}T${t.replace(':','')}00`,'DURATION:PT10M',`RRULE:${rule}`,
        `SUMMARY:${icsEsc(medIcon(m.form)+' '+m.name+(m.dose?' '+m.dose:''))}`,`DESCRIPTION:${icsEsc([MED_FOOD.find(f=>f[0]===m.food)?.[1],m.notes].filter(Boolean).join('. '))}`,
        'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEsc('Time for '+m.name)}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT');
    });
  });
  L.push('END:VCALENDAR');download(L.join('\r\n'),'kuestro-medications.ics','text/calendar');toast('Medication calendar downloaded');
}

/* ---------- Training program (rotational) ---------- */
const EX=(name,sets,reps,rest=90,w='')=>({id:uid(),name,sets,reps,rest,w});
function defaultPlan(){return [
  {id:uid(),name:'Push',focus:'Chest · Shoulders · Triceps',ex:[EX('Bench press',4,'6-8',120),EX('Incline dumbbell press',3,'8-10'),EX('Overhead shoulder press',3,'8-10'),EX('Lateral raise',3,'12-15',60),EX('Triceps pushdown',3,'10-12',60)]},
  {id:uid(),name:'Pull',focus:'Back · Biceps',ex:[EX('Pull-ups / lat pulldown',4,'6-10',120),EX('Barbell row',3,'8-10'),EX('Seated cable row',3,'10-12'),EX('Face pull',3,'12-15',60),EX('Dumbbell curl',3,'10-12',60)]},
  {id:uid(),name:'Legs',focus:'Quads · Hamstrings · Calves',ex:[EX('Back squat',4,'6-8',150),EX('Romanian deadlift',3,'8-10',120),EX('Leg press',3,'10-12'),EX('Leg curl',3,'10-12',60),EX('Calf raise',4,'12-15',60)]},
  {id:uid(),name:'Upper',focus:'Strength + volume',ex:[EX('Incline bench press',3,'6-8',120),EX('Chin-ups',3,'max',120),EX('Dumbbell shoulder press',3,'8-10'),EX('Chest-supported row',3,'10-12'),EX('Hammer curl',3,'10-12',60),EX('Overhead triceps extension',3,'10-12',60)]},
  {id:uid(),name:'Lower + Core',focus:'Glutes · Hamstrings · Abs',ex:[EX('Deadlift',3,'5',180),EX('Bulgarian split squat',3,'8-10/leg'),EX('Hip thrust',3,'8-12'),EX('Plank',3,'45 s',60),EX('Hanging knee raise',3,'12-15',60)]},
]}
const T_=()=>S.train;
const cyc=()=>{const T=T_();T.cyc=T.cyc||{on:5,off:1,start:''};return T.cyc};
const cycOn=()=>Math.max(1,Math.round(+cyc().on||1));
const cycLen=()=>cycOn()+Math.max(0,Math.round(+cyc().off||0));
const cycPos=d=>{const n=dayDiff(parse(cyc().start||todayK()),d),L=cycLen();return ((n%L)+L)%L};   // 0 = first training day of the cycle
const isTrainDay=d=>T_().mode==='cycle'?cycPos(d)<cycOn():T_().days.includes(d.getDay());
const trainSched=()=>T_().mode==='cycle'?`${cycOn()} training days, then ${cycLen()-cycOn()} rest day${cycLen()-cycOn()===1?'':'s'}, repeating`:`${T_().days.length} days/week`;
const cycNowText=()=>{const p=cycPos(new Date()),on=cycOn();return p<on?`Today is training day ${p+1} of ${on}.`:`Today is a rest day (${p-on+1} of ${cycLen()-on}).`};
const tPrevHTML=()=>{let h='';for(let i=0;i<14;i++){const d=addDays(new Date(),i),on=isTrainDay(d);h+=`<div class="${on?'on':''} ${i===0?'today':''}"><span>${DAYS[d.getDay()][0]}</span><b>${d.getDate()}</b><i>${on?'🏋️':'😴'}</i></div>`}return h};
function cycleEditHTML(){const c=cyc();
  return `<div class="row mt"><label class="mini">Train for (days)<input type="number" inputmode="numeric" min="1" max="14" data-cyc="on" value="${cycOn()}"></label><label class="mini">then rest (days)<input type="number" inputmode="numeric" min="0" max="14" data-cyc="off" value="${cycLen()-cycOn()}"></label></div>
    <label class="f">First training day of the current cycle</label><div class="row"><input type="date" data-cyc="start" value="${c.start||todayK()}"><button type="button" class="btn ghost" style="flex:0 0 auto" data-act="cycRestart">Today</button></div>
    <p class="meta mt" id="cycNow">${cycNowText()}</p>`}
function cycStatusHTML(){const p=cycPos(new Date());
  return `<p class="meta mt"><b>${cycNowText()}</b> Cycle: ${cycOn()} on, ${cycLen()-cycOn()} off.</p>
    <div class="row" style="flex-wrap:wrap"><button class="linkbtn" data-act="cycRestart">↺ Today is day 1 of my cycle</button>${p<cycOn()?'<button class="linkbtn" data-act="cycSkip">😴 Skip today (shift my cycle a day)</button>':''}</div>`}
const nextW=()=>{const p=T_().plan;return p.length?p[((T_().idx%p.length)+p.length)%p.length]:null};
const sessionsOn=k=>T_().sessions.filter(x=>x.date===k);
function syncTrainRoutine(){const r=S.routines.find(r=>r.link==='train');if(r){r.days=[...T_().days];r.freq='weekly'}}
function lastSets(name){
  const n=name.trim().toLowerCase();
  for(let i=T_().sessions.length-1;i>=0;i--){const e=T_().sessions[i].ex.find(e=>e.name.trim().toLowerCase()===n);if(e&&e.sets.length)return e.sets}
  return null;
}
function bestW(name,beforeId){
  const n=name.trim().toLowerCase();let b=0;
  T_().sessions.forEach(s=>{if(s.id===beforeId)return;s.ex.forEach(e=>{if(e.name.trim().toLowerCase()===n)e.sets.forEach(x=>{if(+x.w>b)b=+x.w})})});
  return b;
}
/* ---------- Progressive overload: tells you when to add weight ---------- */
const repNums=r=>(String(r||'').match(/\d+/g)||[]).map(Number);
const wJump=(w,unit)=>unit==='lb'?(w<45?2.5:5):(w<20?1:2.5);
function progFor(e){
  const last=lastSets(e.name),top=Math.max(0,...repNums(e.reps));
  if(!last||!top)return null;                       // first time, or reps like "max"
  const lw=Math.max(0,...last.map(s=>+s.w||0));
  if(lw<=0)return null;                             // bodyweight, nothing to add
  const cur=Math.max(+e.w||0,lw),need=Math.max(1,(+e.sets||3)-1),atTop=last.filter(s=>(+s.w||0)===lw);
  if(lw>=cur&&atTop.length>=need&&atTop.every(s=>(+s.r||0)>=top))return {type:'up',w:Math.round((lw+wJump(lw,T_().unit))*100)/100,from:lw,top,n:atTop.length};
  return {type:'hold',w:cur,top};
}
const progHTML=(p,u)=>p.type==='up'
  ?`<div class="prog up">⬆️ <b>Time to add weight: ${p.w} ${u}</b><span>Last time you did ${p.top} reps on all ${p.n} sets at ${p.from} ${u}.</span></div>`
  :`<div class="prog">🎯 Stay at <b>${p.w} ${u}</b> until you hit <b>${p.top} reps</b> on every set, then add weight.</div>`;
function startWorkout(wid){
  const w=T_().plan.find(p=>p.id===wid)||nextW();if(!w)return toast('Add a workout day first');
  T_().active={wid:w.id,name:w.name,start:Date.now(),date:todayK(),ex:w.ex.map(e=>{const last=lastSets(e.name)||[];
    const pg=progFor(e),tw=pg?String(pg.w):(e.w!==undefined&&e.w!==null&&String(e.w).trim()!==''?String(e.w).trim():'');
    return {name:e.name,reps:e.reps,rest:+e.rest||90,tw,prog:pg,sets:[...Array(Math.max(1,+e.sets||3))].map((_,i)=>({w:tw||(last[i]?.w??last[last.length-1]?.w??''),r:last[i]?.r??'',done:false}))}})};
  save();show('train');
}
function finishWorkout(){
  const a=T_().active;if(!a)return;
  const done=a.ex.map(e=>({name:e.name,sets:e.sets.filter(s=>s.done).map(s=>({w:+s.w||0,r:+s.r||0}))})).filter(e=>e.sets.length);
  const nSets=done.reduce((t,e)=>t+e.sets.length,0);
  if(!nSets&&!confirm('No sets are checked. Finish anyway?'))return;
  const dur=Math.max(1,Math.round((Date.now()-a.start)/60000)),vol=Math.round(done.reduce((t,e)=>t+e.sets.reduce((u,s)=>u+s.w*s.r,0),0));
  const id=uid();let prs=[];
  done.forEach(e=>{const best=bestW(e.name),top=Math.max(...e.sets.map(s=>s.w));if(top>0&&top>best&&best>0)prs.push(`${e.name} ${top}${T_().unit}`)});
  T_().sessions.push({id,date:a.date,wid:a.wid,name:a.name,ex:done,dur,vol,prs:prs.length});
  const pd=T_().plan.find(p=>p.id===a.wid);   // the plan's weight follows what you lifted
  if(pd)done.forEach(x=>{const px=pd.ex.find(y=>y.name.trim().toLowerCase()===x.name.trim().toLowerCase()),topW=Math.max(0,...x.sets.map(t=>t.w));if(px&&topW>(+px.w||0))px.w=String(topW)});
  S.logs.push({id:uid(),ts:Date.now(),type:'workout',date:a.date,kind:`${a.name} · ${nSets} set${nSets===1?'':'s'}${vol?` · ${vol.toLocaleString()} ${T_().unit}`:''}`,min:dur,src:'Train'});
  const r=S.routines.find(r=>r.link==='train'),d=parse(a.date);
  if(r&&!isDone(r.id,d)){const k=a.date;S.done[k]=S.done[k]||{};S.done[k][r.id]=Date.now()}else autoTick('workout',d);
  const pi=T_().plan.findIndex(p=>p.id===a.wid);T_().idx=(pi>=0?pi:T_().idx)+1;
  T_().active=null;stopRest();save();
  showQC({theme:'workout',title:prs.length?'NEW PR!':'WORKOUT CLEAR!',qtitle:`${a.name} · ${dur} min · ${nSets} set${nSets===1?'':'s'}${vol?` · ${vol.toLocaleString()} ${T_().unit} lifted`:''}`,sub:prs.length?`🏆 ${prs.slice(0,3).join(' · ')}`:'',xp:XP_LOG+XP_ROUTINE});
  checkProgress();render();
}
let REST=null,TEDIT=false;
function startRest(sec){
  stopRest();if(!sec)return;REST={end:Date.now()+sec*1000};
  REST.iv=setInterval(tickRest,250);tickRest();
}
function stopRest(){if(REST){clearInterval(REST.iv);REST=null}const b=$('#restBar');if(b)b.classList.add('hidden')}
function tickRest(){
  const b=$('#restBar');if(!REST||!b)return;const left=Math.max(0,Math.ceil((REST.end-Date.now())/1000));
  b.classList.remove('hidden');
  b.innerHTML=`<span>⏱️ Rest <b>${Math.floor(left/60)}:${pad(left%60)}</b></span><button class="pill" data-act="restAdd">+15s</button><button class="pill" data-act="restSkip">Skip</button>`;
  if(left<=0){stopRest();if(navigator.vibrate)navigator.vibrate([200,100,200]);playSound('workout');toast('Rest over. Next set! 💪')}
}
function weekPlanPreview(){
  // project the rotation onto the next 7 days
  const out=[],p=T_().plan;let idx=T_().idx,today=todayK();
  const doneToday=sessionsOn(today).length>0;
  for(let i=0;i<7;i++){const d=addDays(new Date(),i),k=key(d);
    if(i===0&&doneToday){out.push({d,k,w:{name:sessionsOn(today)[0].name},done:true});continue}
    if(isTrainDay(d)&&p.length){out.push({d,k,w:p[((idx%p.length)+p.length)%p.length]});idx++}else out.push({d,k,w:null})}
  return out;
}
function renderTrain(){
  const T=T_(),box=$('#trainBody');
  if(TEDIT)return renderTrainEdit();
  const a=T.active;let h='';
  if(a){
    const doneSets=a.ex.reduce((t,e)=>t+e.sets.filter(s=>s.done).length,0),all=a.ex.reduce((t,e)=>t+e.sets.length,0);
    h+=`<div class="card hero"><div class="avatar">🏋️</div><div class="grow"><div class="sec-h"><span>${esc(a.name)}</span><span class="meta" id="elapsed"></span></div><div class="bar xp"><i style="width:${all?Math.round(doneSets/all*100):0}%"></i></div><div class="meta">${doneSets} / ${all} sets done</div></div></div>`;
    a.ex.forEach((e,ei)=>{const last=lastSets(e.name);
      h+=`<div class="card"><div class="sec-h"><span>${esc(e.name)}</span><span class="meta">${e.sets.length}×${esc(e.reps)}${e.tw?` · 🎯 ${esc(e.tw)} ${T.unit}`:''} · rest ${e.rest>=60?Math.floor(e.rest/60)+':'+pad(e.rest%60):e.rest+'s'}</span></div>
        ${e.prog?progHTML(e.prog,T.unit):''}
        ${last?`<div class="meta">Last time: ${last.map(s=>`${s.w||0}×${s.r||0}`).join(', ')}</div>`:''}
        <div class="sets"><div class="sh"><span>Set</span><span>${T.unit}</span><span>Reps</span><span></span></div>
        ${e.sets.map((s,si)=>`<div class="srow ${s.done?'done':''}"><span class="sn">${si+1}</span><input type="number" inputmode="decimal" step="any" min="0" data-set="${ei}:${si}:w" value="${esc(s.w)}" placeholder="0"><input type="number" inputmode="numeric" min="0" data-set="${ei}:${si}:r" value="${esc(s.r)}" placeholder="${esc(String(e.reps).match(/\d+/)?.[0]||'')}"><button class="chkbtn" data-setdone="${ei}:${si}" aria-label="Set done">✓</button></div>`).join('')}</div>
        <div class="row mt"><button class="pill" style="flex:0 0 auto" data-addset="${ei}">+ Set</button>${e.sets.length>1?`<button class="pill" style="flex:0 0 auto" data-delset="${ei}">− Set</button>`:''}</div></div>`});
    h+=`<button class="btn full" data-act="finishW">🏁 Finish workout</button><button class="linkbtn" style="display:block;margin:12px auto" data-act="cancelW">Cancel workout</button>`;
    box.innerHTML=h;tickElapsed();return;
  }
  const nw=nextW(),today=new Date(),trainToday=isTrainDay(today),doneToday=sessionsOn(todayK()).length>0;
  const wk=weekPlanPreview();
  h+=`<div class="week tweek">${wk.map(x=>`<div class="${x.k===todayK()?'sel':''} ${x.w?'on':''}"><span>${DAYS[x.d.getDay()][0]}</span><b>${x.done?'✅':x.w?'🏋️':'😴'}</b><small>${x.w?esc(x.w.name.split(' ')[0]):'Rest'}</small></div>`).join('')}</div>`;
  if(doneToday)h+=`<div class="card ok"><h2>✅ Today’s training is done</h2><p class="meta">Great work. Next up: <b>${nw?esc(nw.name):''}</b> on your next training day.</p></div>`;
  else if(nw)h+=`<div class="card hero tnext"><div class="avatar">${trainToday?'🔥':'😴'}</div><div class="grow"><div class="meta">${trainToday?'Today’s workout':'Rest day. Next workout'}</div><div class="qt" style="font-size:20px">${esc(nw.name)}</div><div class="meta">${esc(nw.focus||'')} · ${nw.ex.length} exercises${nw.ex.filter(x=>progFor(x)?.type==='up').length?` · ⬆️ ${nw.ex.filter(x=>progFor(x)?.type==='up').length} ready for more weight`:''}</div></div></div>
    <div class="row" style="margin-bottom:12px"><button class="btn" data-startw="${nw.id}">${trainToday?'▶ Start workout':'▶ Train anyway'}</button><button class="btn ghost" style="flex:0 0 auto" data-act="skipW">Skip ⏭</button></div>`;
  h+=`<div class="card"><div class="sec-h"><span>🔁 Rotation · ${T.mode==='cycle'?cycOn()+' on · '+(cycLen()-cycOn())+' off':T.days.length+' days/week'}</span><button class="pill" data-act="editTrain">✎ Edit program</button></div>
    ${T.plan.map((p,i)=>`<div class="li ${nw&&p.id===nw.id?'cur':''}"><span class="rnum">${i+1}</span><div class="grow"><b>${esc(p.name)}</b>${nw&&p.id===nw.id?' <span class="pill">next</span>':''}<div class="meta">${esc(p.focus||'')} · ${p.ex.map(e=>esc(e.name)).slice(0,3).join(', ')}${p.ex.length>3?'…':''}</div></div><button class="ib" data-startw="${p.id}" aria-label="Start ${esc(p.name)}">▶</button></div>`).join('')}
    <p class="meta mt">Your workouts go in order on your training days. A missed day doesn’t skip a workout; the rotation simply continues next time.</p>${T.mode==='cycle'?cycStatusHTML():''}</div>`;
  const recent=[...T.sessions].reverse().slice(0,8);
  h+=`<div class="card"><h2>📈 Recent sessions</h2>${recent.length?recent.map(s=>`<div class="li"><span>🏋️</span><div class="grow"><b>${esc(s.name)}</b>${s.prs?` <span class="pill">🏆 ${s.prs} PR</span>`:''}<div class="meta">${parse(s.date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})} · ${s.dur} min · ${s.ex.reduce((t,e)=>t+e.sets.length,0)} sets${s.vol?` · ${s.vol.toLocaleString()} ${T.unit}`:''}</div></div></div>`).join(''):'<div class="empty">Your finished workouts will show here.</div>'}</div>`;
  const prs={};T.sessions.forEach(s=>s.ex.forEach(e=>e.sets.forEach(x=>{if(+x.w>0&&(!prs[e.name]||+x.w>prs[e.name].w))prs[e.name]={w:+x.w,r:x.r,date:s.date}})));
  const pk=Object.keys(prs);
  if(pk.length)h+=`<div class="card"><h2>🏆 Personal records</h2>${pk.map(n=>`<div class="li"><div class="grow">${esc(n)}</div><b>${prs[n].w} ${T.unit}</b><span class="meta">× ${prs[n].r}</span></div>`).join('')}</div>`;
  box.innerHTML=h;
}
function renderTrainEdit(){
  const T=T_();
  let h=`<div class="card"><h2>Training schedule</h2><p class="meta">How do you train? <b>Weight</b> is your current working weight: it goes up by itself when you lift more, and Kuestro tells you when it is time to add weight.</p><div class="chips">${[['days','📅 Specific weekdays'],['cycle','🔁 Rotating cycle']].map(([v,l])=>`<label><input type="radio" ${(T.mode||'days')===v?'checked':''}><span data-tmode="${v}">${l}</span></label>`).join('')}</div>${T.mode==='cycle'?cycleEditHTML():`<p class="meta mt">Pick your days. The workouts below rotate across them.</p><div class="chips">${[6,0,1,2,3,4,5].map(i=>`<label><input type="checkbox" data-tday="${i}" ${T.days.includes(i)?'checked':''}><span>${DAYS[i]}</span></label>`).join('')}</div>`}<div class="meta mt">Your next 14 days:</div><div class="tprev" id="tPrev">${tPrevHTML()}</div>
    <div class="row mt"><div><label class="f">Units</label><select id="tUnit"><option ${T.unit==='kg'?'selected':''}>kg</option><option ${T.unit==='lb'?'selected':''}>lb</option></select></div></div></div>`;
  T.plan.forEach((p,di)=>{
    h+=`<div class="card"><div class="row"><span class="rnum" style="flex:0 0 auto">${di+1}</span><input data-pe="${di}::name" value="${esc(p.name)}" placeholder="Workout name"></div>
      <input class="mt" data-pe="${di}::focus" value="${esc(p.focus||'')}" placeholder="Focus, e.g. Chest · Triceps">
      ${p.ex.map((e,ei)=>`<div class="exrow"><input data-pe="${di}:${ei}:name" value="${esc(e.name)}" placeholder="Exercise"><div class="row"><label class="mini">Sets<input type="number" min="1" max="10" data-pe="${di}:${ei}:sets" value="${e.sets}"></label><label class="mini">Reps<input data-pe="${di}:${ei}:reps" value="${esc(e.reps)}"></label><label class="mini">Weight (${T.unit})<input type="number" inputmode="decimal" step="any" min="0" placeholder="—" data-pe="${di}:${ei}:w" value="${esc(e.w??'')}"></label><label class="mini">Rest<select data-pe="${di}:${ei}:rest">${[0,30,45,60,90,120,150,180,240].map(v=>`<option value="${v}" ${+e.rest===v?'selected':''}>${v?v>=60?Math.floor(v/60)+':'+pad(v%60):v+'s':'none'}</option>`).join('')}</select></label>
        <span class="exbtns"><button class="ib" data-exmove="${di}:${ei}:-1" aria-label="Up">↑</button><button class="ib" data-exmove="${di}:${ei}:1" aria-label="Down">↓</button><button class="ib" data-exdel="${di}:${ei}" aria-label="Delete">×</button></span></div></div>`).join('')}
      <div class="row mt"><button class="btn ghost" data-exadd="${di}">+ Exercise</button><button class="ib" style="flex:0 0 44px" data-daymove="${di}:-1">↑</button><button class="ib" style="flex:0 0 44px" data-daymove="${di}:1">↓</button><button class="btn danger" style="flex:0 0 auto" data-daydel="${di}">Delete day</button></div></div>`;
  });
  h+=`<button class="btn ghost full" data-act="dayAdd">+ Add workout day</button><button class="btn full mt" data-act="editDone">✓ Done</button><button class="linkbtn" style="display:block;margin:12px auto" data-act="resetPlan">Reset to the default 5-day program</button>`;
  $('#trainBody').innerHTML=h;
}

document.addEventListener('click',e=>{if(!S)return;const el=e.target.closest('[data-tmode]');if(!el)return;
  e.preventDefault();const T=T_();T.mode=el.dataset.tmode;if(T.mode==='cycle'&&!cyc().start)cyc().start=todayK();
  syncTrainRoutine();save();renderTrain();
});
document.addEventListener('input',e=>{const t=e.target;if(!S||!t||!t.dataset||!t.dataset.cyc)return;
  const c=cyc(),f=t.dataset.cyc;
  if(f==='on')c.on=Math.min(14,Math.max(1,Math.round(+t.value)||1));
  else if(f==='off')c.off=Math.min(14,Math.max(0,Math.round(+t.value)||0));
  else if(/^\d{4}-\d{2}-\d{2}$/.test(t.value))c.start=t.value;
  save();const pv=$('#tPrev'),nw=$('#cycNow');if(pv)pv.innerHTML=tPrevHTML();if(nw)nw.textContent=cycNowText();
});
function tickElapsed(){const a=S&&T_().active,el=$('#elapsed');if(a&&el){const s=Math.floor((Date.now()-a.start)/1000);el.textContent=`${Math.floor(s/60)}:${pad(s%60)}`}}
setInterval(()=>{if(S&&view==='train')tickElapsed()},1000);

/* ---------- Card of the day (inspired by collectible motivation cards) ---------- */
const CARD_CATS={Discipline:['⚔️','#e5484d'],Strength:['💪','#ff8a3d'],Wisdom:['🦉','#c9a46a'],Focus:['🎯','#3d72c4'],Spirit:['🌙','#7b4fc2']};
const CARDS=[
  ['Discipline','Motivation starts the engine. Discipline keeps it running.'],['Discipline','Do it tired. Do it slow. Just don’t skip it.'],['Discipline','Small promises kept to yourself build unbreakable trust.'],
  ['Discipline','The streak doesn’t care about your mood. Show up anyway.'],['Discipline','Win the morning, and the day follows.'],['Discipline','You become what you repeat. Repeat something good.'],
  ['Strength','Every rep is a vote for the person you’re becoming.'],['Strength','Strong isn’t a feeling. It’s a decision you repeat.'],['Strength','Rest is part of the program, not a break from it.'],
  ['Strength','Progress hides in the boring days. Keep going.'],['Strength','Your body keeps every promise you make it. Make good ones.'],['Strength','Lift heavy things, carry light worries.'],
  ['Wisdom','Ten pages a day is a dozen books a year.'],['Wisdom','A mistake made while trying beats perfection never started.'],['Wisdom','Learn one word today. In a year, you’ll speak a new world.'],
  ['Wisdom','Compare yourself to who you were yesterday, not to anyone else.'],['Wisdom','The best time to start was a year ago. The second best is now.'],['Wisdom','Slow progress is still progress. Ask any tortoise.'],
  ['Focus','One task. One timer. Full attention.'],['Focus','Your phone can wait. Your goals can’t.'],['Focus','Clarity comes from action, not from thinking about action.'],
  ['Focus','Do the hardest thing first, and the rest of the day gets lighter.'],['Focus','Say no to the good so you can say yes to the great.'],['Focus','Finish what you started today. Tomorrow has its own list.'],
  ['Spirit','Gratitude turns what you have into enough.'],['Spirit','Start with Fajr, and the day starts with light.'],['Spirit','Patience isn’t just waiting. It’s how you act while you wait.'],
  ['Spirit','Take care of your body. It’s a trust, not a possession.'],['Spirit','Be as kind to yourself as you are to others.'],['Spirit','Every new day is a fresh page. Write something good on it.'],
];
function cardHTML(i,big){const [cat,txt]=CARDS[i],[e,c]=CARD_CATS[cat];return `<div class="mcard ${big?'big':''}" style="--cc:${c}"><div class="mc-top">${e} ${cat}</div><div class="mc-txt">${esc(txt)}</div><div class="mc-no">#${i+1}</div></div>`}
function todayCardIdx(){
  const k=todayK();if(S.cards.revealed[k]!=null)return S.cards.revealed[k];
  const unseen=CARDS.map((_,i)=>i).filter(i=>S.cards.seen[i]==null),pool=unseen.length?unseen:CARDS.map((_,i)=>i);
  return pool[hashStr('card'+k)%pool.length];
}
function cardOfDayHTML(){
  const k=todayK(),rev=S.cards.revealed[k]!=null;
  return rev?`<div class="cardslot">${cardHTML(S.cards.revealed[k])}</div>`
    :`<button class="cardback" data-act="revealCard"><span>🃏</span><b>Card of the day</b><small>Tap to reveal · +5 XP</small></button>`;
}

/* ---------- Hunter art style (mature anime) ---------- */
const shadeC=(c,p)=>{const n=parseInt(String(c).slice(1),16);if(isNaN(n))return c;const f=v=>Math.max(0,Math.min(255,Math.round(v*(1+p))));return '#'+[n>>16,n>>8&255,n&255].map(v=>f(v).toString(16).padStart(2,'0')).join('')};
const AURA={paladin:'#ffd76a',monk:'#ffd76a',warrior:'#ff5a3d',ranger:'#5fe0a0',healer:'#ff8fc8',scholar:'#e8c170',mage:'#9b7bff',alchemist:'#6ee7b7',tactician:'#60a5fa'};
function avatarHunter(h,L=1,size=54){
  const one=(v,list,def)=>list.includes(v)?v:def,ids=l=>l.map(x=>x[0]);
  const skin=one(h.skin,SKINS,SKINS[1]),hc=one(h.hairColor,HAIRC,HAIRC[0]),ec=one(h.eyeColor,EYEC,EYEC[0]),oc=one(h.outfit,OUTFITS,OUTFITS[0]),bg=one(h.bg,BGS,'#0f1426'),city=h.scene!=='plain';
  const hair=one(OLDMAP.hair[h.hair]||h.hair,ids(HAIRS),'messy'),eyes=one(OLDMAP.eyes[h.eyes]||h.eyes,ids(EYES),'sparkle'),mouth=one(h.mouth,ids(MOUTHS),'calm'),marks=one(h.marks||'none',ids(MARKS),'none'),acc=one(h.acc,ids(ACCS),'none');
  const cls=CLASSES[h.cls]?h.cls:'paladin',id='hv'+(++svgN),ink='#14101c',hij=hair==='hijab',R0=one(h.rim,RIMS,'#ff7a1a'),rimOn=R0!=='none',R=rimOn?R0:'transparent',au=rimOn?R0:'#000',glow=h.glow===true,soft=h.face==='soft',mature=h.face==='mature',sweater=h.wear==='sweater',FACE=soft?'M40 48 C40 31 50 23 60 23 C70 23 80 31 80 48 C80 65 71 79 60 79 C49 79 40 65 40 48Z':mature?'M40 47 C40 30 50 22 60 22 C70 22 80 30 80 47 C80 67 72 83 60 83 C48 83 40 67 40 47Z':'M39 48 C39 31 49 23 60 23 C71 23 81 31 81 48 C81 66 72 80 60 80 C48 80 39 66 39 48Z',hd=shadeC(hc,-.35),hl=shadeC(hc,.6);
  let s=`<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Character"><defs><clipPath id="${id}"><circle cx="60" cy="60" r="60"/></clipPath>
    <radialGradient id="${id}g" cx="50%" cy="62%" r="55%"><stop offset="0" stop-color="${au}" stop-opacity="${rimOn?Math.min(.7,.14+L*.03).toFixed(2):0}"/><stop offset="1" stop-color="${au}" stop-opacity="0"/></radialGradient>
    <filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="${id}k" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05050a"/><stop offset="1" stop-color="#1d1219"/></linearGradient></defs><g clip-path="url(#${id})">`;
  if(city){
    s+=`<rect width="120" height="120" fill="url(#${id}s)"/>`;
    [[2,58,14],[17,44,12],[30,66,10],[41,38,13],[56,52,9],[66,30,14],[81,48,11],[93,36,15],[109,56,11]].forEach(([x,y,w],i)=>{s+=`<rect x="${x}" y="${y}" width="${w}" height="${120-y}" fill="#0b0b12"/>`;
      for(let r=0;r<6;r++)for(let c=0;c<2;c++)if((i*7+r*3+c*5)%4===0)s+=`<rect x="${x+2+c*(w/2)}" y="${y+4+r*7}" width="2" height="2.5" fill="${r%2?'#ffb347':R}" opacity=".55"/>`});
    [[14,30,7,rimOn?R:'#ffb347',.5],[98,24,9,'#ffb347',.45],[86,58,6,R,.55],[26,72,8,'#ffb347',.4],[106,84,5,R,.6],[50,20,5,'#ffd08a',.35],[8,96,6,R,.45],[72,14,4,'#ffd08a',.4]].forEach(([x,y,r,c,o])=>s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}" filter="url(#${id}k)"/>`);
  }else s+=`<rect width="120" height="120" fill="${bg}"/>`;
  s+=`<rect width="120" height="120" fill="url(#${id}g)"/>`;
  if(L>=16)[[18,30],[100,26],[12,70],[108,66],[30,12],[90,10],[24,96],[98,94]].forEach(([x,y],i)=>s+=`<path d="M${x} ${y-4} L${x+1.2} ${y-1.2} L${x+4} ${y} L${x+1.2} ${y+1.2} L${x} ${y+4} L${x-1.2} ${y+1.2} L${x-4} ${y} L${x-1.2} ${y-1.2}Z" fill="${i%2?'#fff':au}" opacity=".85"/>`);
  if(L>=5)s+=`<path d="M14 120 C8 104 18 96 14 82 C24 92 24 102 30 108 C30 98 34 94 32 86 C40 96 38 108 40 120Z M106 120 C112 104 102 96 106 82 C96 92 96 102 90 108 C90 98 86 94 88 86 C80 96 82 108 80 120Z" fill="${au}" opacity=".45"/>`;
  if(L>=8)s+=`<path d="M6 120 L22 92 L98 92 L114 120Z" fill="${shadeC(oc,-.5)}"/>`;
  if(cls==='warrior')s+=`<path d="M86 100 L108 58" stroke="#8a94a3" stroke-width="4" stroke-linecap="round"/><path d="M98 76 L109 82" stroke="#c98a1c" stroke-width="3.5" stroke-linecap="round"/><circle cx="109" cy="56" r="2.6" fill="#f5c542"/>`;
  if(cls==='ranger')s+=`<path d="M26 60 Q6 92 28 122" stroke="#8b5a2b" stroke-width="3.2" fill="none"/><path d="M26 60 L28 122" stroke="#e9e4dc" stroke-width=".9"/>`;
  if(cls==='mage')[['A',14,40],['あ',105,42],['ب',12,80],['Ω',108,80],['ñ',24,18]].forEach(([g,x,y])=>s+=`<text x="${x}" y="${y}" font-size="11" font-weight="700" fill="${au}" opacity=".85" text-anchor="middle">${g}</text>`);
  if(cls==='healer')[[18,40],[102,46],[16,88],[104,90]].forEach(([x,y])=>s+=`<ellipse cx="${x}" cy="${y}" rx="3.5" ry="2" fill="#ff8fb1" opacity=".85" transform="rotate(35 ${x} ${y})"/>`);
  // back hair
  if(hair==='wolf')s+=`<path d="M30 46 C27 14 93 14 90 46 C95 58 96 72 92 86 C90 94 82 92 81 84 L39 84 C38 92 30 94 28 86 C24 72 25 58 30 46Z" fill="${hc}"/><path d="M36 60 C34 70 34 78 35 86 M84 60 C86 70 86 78 85 86" stroke="${hd}" stroke-opacity=".5" stroke-width="1" fill="none"/>`;
  if(hair==='long')s+=`<path d="M34 46 C32 16 88 16 86 46 L90 106 C90 113 82 113 80 106 L78 100 L42 100 L40 106 C38 113 30 113 30 106Z" fill="${hc}"/><path d="M60 26 L60 100" stroke="${hd}" stroke-opacity=".4" stroke-width="1.2"/>`;
  if(hair==='ponytail')s+=`<path d="M72 24 C100 18 110 48 101 76 C98 86 90 84 92 76 C96 60 90 42 74 33Z" fill="${hc}"/>`;
  if(hair==='twintails')s+=`<path d="M40 30 C16 30 12 62 20 90 C23 99 33 94 31 85 C29 70 32 50 42 40Z" fill="${hc}"/><path d="M80 30 C104 30 108 62 100 90 C97 99 87 94 89 85 C91 70 88 50 78 40Z" fill="${hc}"/>`;
  if(hair==='bob')s+=`<path d="M34 48 C32 16 88 16 86 48 L88 78 C88 85 80 84 77 78 L43 78 C40 84 32 85 32 78Z" fill="${hc}"/>`;
  if(hair==='spiky')s+=`<path d="M36 50 C22 44 18 32 28 28 C26 16 40 14 46 22 C48 8 62 6 66 16 C74 8 86 14 82 26 C94 26 100 38 84 50Z" fill="${hc}"/>`;
  // neck, coat
  s+=`<path d="M53 70 L53 92 L67 92 L67 70Z" fill="${skin}"/><path d="M53 74 Q60 84 67 74 L67 82 Q60 90 53 82Z" fill="#000" opacity=".14"/>`;
  s+=`<path d="M6 120 C10 101 28 93 50 90 L70 90 C92 93 110 101 114 120Z" fill="${oc}" ${L>=12?'stroke="#f5c542" stroke-width="2.5"':''}/><path d="M6 120 C10 101 28 93 50 90 L48 96 C34 99 22 106 18 120Z" fill="#000" opacity=".22"/>`;
  s+=`<path d="M70 90 C92 93 110 101 114 120" stroke="${R}" stroke-width="1.8" stroke-opacity=".85" fill="none"/>`;
  if(sweater){s+=`<path d="M47 90 Q60 99 73 90" stroke="${shadeC(oc,-.35)}" stroke-width="3.2" fill="none"/><path d="M47 90 Q60 99 73 90" stroke="${shadeC(oc,.25)}" stroke-width=".8" fill="none"/><path d="M28 104 Q34 112 32 120 M92 104 Q86 112 88 120 M56 104 Q60 110 58 120" stroke="#000" stroke-opacity=".2" stroke-width="1.2" fill="none"/>`}else{
  s+=`<path d="M30 100 L66 120" stroke="#25252e" stroke-width="5"/><rect x="43" y="105" width="7" height="4.5" rx="1" fill="#34343f" stroke="${R}" stroke-width=".8" transform="rotate(29 46 107)"/>`;
  s+=`<path d="M80 92 L88 120" stroke="#25252e" stroke-width="4.5"/><path d="M82.2 92 L90.2 120" stroke="${R}" stroke-opacity=".7" stroke-width=".8"/><rect x="92" y="106" width="3" height="8" rx=".8" fill="${R}" opacity=".9"/>`;
  s+=`<path d="M45 93 C43 84 45 76 51 70 L58 73 L58 93Z" fill="${shadeC(oc,.16)}"/><path d="M75 93 C77 84 75 76 69 70 L62 73 L62 93Z" fill="${shadeC(oc,.1)}"/><path d="M69 70 C75 76 77 84 75 93" stroke="${R}" stroke-width="1.2" stroke-opacity=".8" fill="none"/>`;
  s+=`<path d="M60 74 L60 120" stroke="#3a3a46" stroke-width="1.4"/><rect x="58.6" y="88" width="2.8" height="5" rx=".6" fill="${rimOn?R:'#8a8a96'}"/>`;}
  const O={
    paladin:`<path d="M68 100 L73 102 L72.5 106.5 C71.5 109 68 110.5 68 110.5 C68 110.5 64.5 109 63.5 106.5 L63 102Z" fill="#f5c542" stroke="#fff" stroke-width=".8"/>`,
    monk:[...Array(9)].map((_,i)=>{const t=i/8,x=46+28*t,y=94+18*4*t*(1-t);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${i%2?'#8b5a2b':'#c98a1c'}"/>`}).join('')+`<path d="M60 112 L58 119 L62 119Z" fill="#c98a1c"/>`,
    warrior:`<path d="M76 92 C92 90 104 96 108 106 L88 108 C86 100 82 96 76 96Z" fill="#8a94a3" stroke="#5b6472" stroke-width="1.2"/><path d="M28 98 L44 96" stroke="#6b3e26" stroke-width="3"/>`,
    ranger:`<path d="M38 92 C42 84 78 84 82 92 C74 99 46 99 38 92Z" fill="#3f5a35"/><path d="M60 100 l3.5 3.5 -3.5 3.5 -3.5 -3.5Z" fill="#9ccc65"/>`,
    healer:[0,72,144,216,288].map(a=>`<circle cx="${(49+3*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(94+3*Math.sin(a*Math.PI/180)).toFixed(1)}" r="2.2" fill="#ff8fb1"/>`).join('')+`<circle cx="49" cy="94" r="1.5" fill="#f5c542"/>`,
    scholar:`<rect x="70" y="100" width="12" height="9" rx="1.5" fill="#f5f0e1" stroke="#8b5a2b" stroke-width="1.2"/><path d="M76 100 L76 109" stroke="#8b5a2b" stroke-width="1"/>`,
    mage:`<circle cx="60" cy="108" r="4.5" fill="${au}" filter="url(#${id}b)"/><circle cx="60" cy="108" r="3" fill="#fff"/>`,
    alchemist:`<path d="M58 102 L62 102 L62 105 L65 111 C65 114 55 114 55 111 L58 105Z" fill="#6ee7b7" stroke="#fff" stroke-width="1"/>`,
    tactician:`<path d="M58.6 86 L61.4 86 L62.8 100 L60 104 L57.2 100Z" fill="#c2553d"/>`,
  };
  s+=O[cls];
  if(L>=3&&!hij)s+=`<path d="M70 95 L84 116 L77 117 L66 97Z" fill="${shadeC(R,-.35)}"/>`;
  // head
  if(hij)s+=`<path d="M32 52 C31 16 89 16 88 52 C88 66 85 76 79 82 L100 98 C86 110 34 110 20 98 L41 82 C35 76 32 66 32 52Z" fill="${hc}"/><path d="M41 82 C48 90 72 90 79 82" stroke="#000" stroke-opacity=".2" stroke-width="2" fill="none"/>`;
  else s+=`<ellipse cx="60" cy="40" rx="25" ry="24" fill="${hc}"/><path d="M41 50 C38 50 38 57 42 58Z M79 50 C82 50 82 57 78 58Z" fill="${skin}"/>`;
  s+=`<path d="${FACE}" fill="${skin}"/><path d="M64 25 C74 29 79 37 79 47 C79 61 74 73 60 82 C68 71 72 60 71 47 C70 37 68 30 64 25Z" fill="#000" opacity=".08"/><path d="${soft?'M80 46 C80 63 71 77 60 79':mature?'M80 46 C80 66 72 81 60 83':'M81 46 C81 64 72 78 60 80'}" stroke="${R}" stroke-width="1.4" stroke-opacity=".85" fill="none"/>`;
  if(hij)s+=`<path d="M35 56 C33 14 87 14 85 56 C81 37 39 37 35 56Z" fill="${hc}" stroke="${R}" stroke-opacity=".5" stroke-width=".9"/><path d="M40 44 C48 38 72 38 80 44" stroke="#fff" stroke-opacity=".18" stroke-width="2" fill="none"/><path d="M72 20 C82 26 86 38 85 54" stroke="${R}" stroke-opacity=".7" stroke-width="1.4" fill="none"/><circle cx="79" cy="68" r="2" fill="#fff"/>`;
  else{
    const F={wolf:'M34 54 C30 24 46 14 60 14 C74 14 90 24 86 54 Q85 60 80.5 55 C79 47 72 35 62 27 Q60 25.5 58 27 C48 35 41 47 39.5 55 Q35 60 34 54Z'};F.messy=F.short=F.spiky=F.bob=F.long=F.ponytail=F.twintails=F.wolf;
    s+=`<path d="${F[hair]||F.short}" fill="${hc}" stroke="${R}" stroke-opacity=".55" stroke-width=".9" stroke-linejoin="round"/><path d="${F[hair]||F.short}" fill="${hc}"/><path d="M72 22 C80 26 85 34 84 50" stroke="${R}" stroke-opacity=".75" stroke-width="1.4" fill="none"/>`;
    if(hair==='messy'||hair==='long'||hair==='twintails'||hair==='wolf'||hair==='bob'){const e=hair==='bob'?76:hair==='wolf'?88:84;s+=`<path d="M36 52 C32 64 33 ${e-12} 38 ${e} C42 ${e-10} 41 62 41 54Z M84 52 C88 64 87 ${e-12} 82 ${e} C78 ${e-10} 79 62 79 54Z" fill="${hc}" stroke-linejoin="round"/>`}
    if(hair==='wolf')s+=`<path d="M44 27 Q53 20 62 22 Q55 25 47 31Z M66 21 Q75 22 80 30 Q74 26 67 25Z" fill="${hl}" opacity=".45"/><path d="M58 30 C54 40 50 46 46 52 M62 30 C68 40 72 46 74 52" stroke="${hd}" stroke-opacity=".5" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    if(hair==='ponytail')s+=`<circle cx="77" cy="24" r="2.6" fill="#b3263a"/>`;
    s+=`<path d="M46 26 Q53 21 59 23" stroke="${hl}" stroke-opacity=".4" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M66 21 Q73 22 78 29" stroke="${R}" stroke-opacity=".6" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M63 29 C71 36 77 44 79 53 M57 29 C49 36 43 44 41 53" stroke="${hl}" stroke-opacity=".3" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  // eyes
  const eye=(cx,left)=>{const cy=54,dir=left?1:-1,ox=cx-5.6*dir,ix=cx+5.4*dir;
    if(eyes==='happy')return `<path d="M${cx-5} ${cy+1} Q${cx} ${cy-4} ${cx+5} ${cy+1}" stroke="${ink}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    const top=eyes==='fierce'?cy-2.2:cy-3.4;
    let e=`<path d="M${ix} ${cy+.8} Q${cx} ${top-1.4} ${ox} ${cy-1.4} Q${cx} ${cy+4.6} ${ix} ${cy+.8}Z" fill="#fff"/>`;
    if(glow)e+=`<circle cx="${cx}" cy="${cy}" r="4.4" fill="${ec}" filter="url(#${id}b)" opacity=".95"/>`;
    e+=`<ellipse cx="${cx}" cy="${cy+.3}" rx="2.9" ry="3.3" fill="${ec}"/><path d="M${cx-2.9} ${cy+.3} A2.9 3.3 0 0 1 ${cx+2.9} ${cy+.3}Z" fill="#000" opacity=".28"/><ellipse cx="${cx}" cy="${cy+.5}" rx="1.3" ry="1.9" fill="${ink}"/><circle cx="${cx-1}" cy="${cy-1.2}" r=".95" fill="#fff"/>`;
    if(eyes==='cool')e+=`<path d="M${ix} ${cy-.4} Q${cx} ${cy-2.6} ${ox} ${cy-1.8} L${ox} ${cy-6} L${ix} ${cy-6}Z" fill="${skin}"/><path d="M${ix} ${cy-.4} Q${cx} ${cy-2.6} ${ox-dir} ${cy-2}" stroke="${ink}" stroke-opacity=".8" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M${ix-dir} ${cy-3.6} Q${cx} ${cy-5.6} ${ox} ${cy-4.4}" stroke="${ink}" stroke-opacity=".35" stroke-width=".8" fill="none"/>`;
    else e+=`<path d="M${ix} ${cy+.3} Q${cx} ${top-2} ${ox-1.2*dir} ${cy-2.2}" stroke="${ink}" stroke-opacity=".8" stroke-width="1.2" fill="none" stroke-linecap="round"/>`+(soft?`<path d="M${ox-.6*dir} ${cy-2.2} l${-1.8*dir} -1" stroke="${ink}" stroke-opacity=".7" stroke-width=".7" stroke-linecap="round"/>`:'');
    return e+`<path d="M${ox+.6*dir} ${cy+1.8} Q${cx} ${cy+4.8} ${ix-dir} ${cy+2.1}" stroke="${ink}" stroke-opacity=".25" stroke-width=".7" fill="none"/>`;
  };
  s+=eye(52,true)+eye(68,false);
  const bc=hij?ink:hd;
  s+=eyes==='fierce'?`<path d="M45 44.5 L57 48.5 M75 44.5 L63 48.5" stroke="${bc}" stroke-width="2" stroke-linecap="round"/>`:`<path d="M45.5 46.5 Q51 44 57 46.5 M74.5 46.5 Q69 44 63 46.5" stroke="${bc}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  s+=`<path d="M61 58 L62.6 63.5 L60.4 64" stroke="#000" stroke-opacity=".25" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  if(marks==='blush')s+=`<ellipse cx="47" cy="63" rx="4" ry="2" fill="#ff7a8a" opacity=".45"/><ellipse cx="73" cy="63" rx="4" ry="2" fill="#ff7a8a" opacity=".45"/>`;
  if(marks==='freckles')[[46,61],[48.5,62.5],[47,64],[72,62.5],[74.5,61],[73.5,64]].forEach(([x,y])=>s+=`<circle cx="${x}" cy="${y}" r=".8" fill="#8a5a3a" opacity=".7"/>`);
  if(marks==='scar')s+=`<path d="M70 58 L78 67" stroke="#b14a4a" stroke-width="1.3" stroke-linecap="round"/>`;
  if(marks==='stubble'&&!hij)s+=`<path d="M44 62 C47 73 53 79 60 80 C67 79 73 73 76 62 C73 71 67 75 60 75 C53 75 47 71 44 62Z" fill="${hc}" opacity=".3"/>`;
  if(soft&&marks!=='blush')s+=`<ellipse cx="47.5" cy="63" rx="3.6" ry="1.7" fill="#ff7a8a" opacity=".22"/><ellipse cx="72.5" cy="63" rx="3.6" ry="1.7" fill="#ff7a8a" opacity=".22"/>`;
  if(soft)s+=mouth==='grin'?`<path d="M57 68 Q60 72.5 63 68Z" fill="#8a3540"/>`:`<path d="${mouth==='calm'?'M58 69 Q60 69.8 62 69':'M57.2 68.6 Q60 70.8 62.8 68.6'}" stroke="#b5534f" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M58.6 71.2 Q60 71.8 61.4 71.2" stroke="#d98b86" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
  else s+=mouth==='grin'?`<path d="M56 68.5 Q60 74 64 68.5Z" fill="#7a2a33"/>`:mouth==='cat'?`<path d="M56 69.5 Q61 71 65 67.5" stroke="#5a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:mouth==='smile'?`<path d="M56 69 Q60 72 64 69" stroke="#5a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`:`<path d="M57 70 L63 70" stroke="#5a2a2a" stroke-width="1.5" stroke-linecap="round"/>`;
  if(acc==='earring'&&!hij)s+=`<circle cx="80.4" cy="59" r="1.3" fill="none" stroke="#d5d8e0" stroke-width=".9"/>`;
  if(acc==='glasses')s+=`<g stroke="#20202a" stroke-width="1.3" fill="#ffffff18"><rect x="45" y="49.5" width="13" height="9" rx="3"/><rect x="62" y="49.5" width="13" height="9" rx="3"/><path d="M58 53.5 L62 53.5"/></g>`;
  if(acc==='headband'&&!hij)s+=`<path d="M37 38 C47 32 73 32 83 38 L83 43 C73 37 47 37 37 43Z" fill="#b3263a"/><path d="M83 40 L97 33 L94 42Z M83 42 L98 48 L92 50Z" fill="#b3263a"/>`;
  if(acc==='catears')s+=`<path d="M39 30 L36 9 L54 21Z M81 30 L84 9 L66 21Z" fill="${hc}" stroke="${hc}" stroke-width="5" stroke-linejoin="round"/><path d="M41 25 L39 15 L48 21Z M79 25 L81 15 L72 21Z" fill="#ffb3c6" stroke="#ffb3c6" stroke-width="3" stroke-linejoin="round"/>`;
  if(acc==='ahoge'&&!hij)s+=`<path d="M60 17 C56 3 71 -1 73 5 C67 4 63 9 63 17Z" fill="${hc}"/>`;
  if(acc==='flower')s+=[0,72,144,216,288].map(a=>`<circle cx="${(79+3.3*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(32+3.3*Math.sin(a*Math.PI/180)).toFixed(1)}" r="2.8" fill="#ff8fb1"/>`).join('')+`<circle cx="79" cy="32" r="1.8" fill="#f5c542"/>`;
  if(L>=20){const y=hij?16:acc==='catears'?12:14;s+=`<path d="M46 ${y+12} L49 ${y} L55 ${y+7} L60 ${y-4} L65 ${y+7} L71 ${y} L74 ${y+12}Z" fill="#f5c542" stroke="#c98a1c" stroke-width="1.4"/><circle cx="60" cy="${y+8}" r="1.8" fill="${au}"/>`}
  return s+'</g></svg>';
}
const okImg=u=>typeof u==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(u)&&u.length<900000;
function avatarImage(h,L,size){
  const id='im'+(++svgN),R=RIMS.includes(h.rim)?h.rim:'#ff7a1a';
  let s=`<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Character"><defs><clipPath id="${id}"><circle cx="60" cy="60" r="60"/></clipPath><linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>
    <g clip-path="url(#${id})"><rect width="120" height="120" fill="#0b0b12"/><image href="${h.img}" x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMin slice"/><rect width="120" height="120" fill="url(#${id}v)"/>`;
  if(L>=16)[[16,26],[104,24],[10,64],[110,62]].forEach(([x,y])=>s+=`<path d="M${x} ${y-4} L${x+1.2} ${y-1.2} L${x+4} ${y} L${x+1.2} ${y+1.2} L${x} ${y+4} L${x-1.2} ${y+1.2} L${x-4} ${y} L${x-1.2} ${y-1.2}Z" fill="#fff" opacity=".9"/>`);
  s+=`</g><circle cx="60" cy="60" r="58.5" fill="none" stroke="${R}" stroke-width="3" opacity=".9"/>`;
  if(L>=5)s+=`<circle cx="60" cy="60" r="55" fill="none" stroke="${R}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="6 5"/>`;
  if(L>=12)s+=`<circle cx="60" cy="60" r="58.5" fill="none" stroke="#f5c542" stroke-width="1.2"/>`;
  if(L>=20)s+=`<path d="M45 14 L48 3 L54 9 L60 0 L66 9 L72 3 L75 14Z" fill="#f5c542" stroke="#c98a1c" stroke-width="1.2"/>`;
  return s+'</svg>';
}
function avatarSVG(h,L=1,size=54){h=h||{};if(h.useImg&&okImg(h.img))return avatarImage(h,L,size);return h.style==='hunter'?avatarHunter(h,L,size):avatarChibi(h,L,size)}

/* ---------- STATUS window (RPG stats) ---------- */
function heroStats(){
  const c={STR:0,VIT:0,INT:0,SPI:0,FOC:0},M={exercise:'STR',running:'STR',meds:'VIT',meals:'VIT',skincare:'VIT',reading:'INT',language:'INT',prayer:'SPI',work:'FOC',other:'FOC'};
  const add=(cat,n=1)=>{const k=M[cat];if(k)c[k]+=n};
  const catOf={};S.routines.forEach(r=>catOf[r.id]=r.cat);
  for(const k in S.done)for(const id in S.done[k])add(id.startsWith('prayer:')?'prayer':id.startsWith('med:')?'meds':catOf[id]);
  S.logs.forEach(l=>add(CATFOR[l.type]));
  add('exercise',T_().sessions.length*2);
  add('language',Math.floor(Object.values(S.lang.reviews).reduce((a,n)=>a+n,0)/10));
  add('work',(S.todos?.items||[]).filter(i=>i.done).length);
  const g=gameStats(),v=n=>10+Math.floor(n/4);
  return [['STR','Strength','💪',v(c.STR)],['VIT','Vitality','❤️',v(c.VIT)],['INT','Intelligence','🧠',v(c.INT)],['SPI','Spirit','🌙',v(c.SPI)],['FOC','Focus','🎯',v(c.FOC)],['DIS','Discipline','⚔️',10+g.bestStreak+g.perfect*2]];
}
const hasArt=H=>H&&H.created&&H.useImg&&okImg(H.img);
function showcaseHTML(){
  const H=S.hero,li=levelInfo(totalXP()),t=titleFor(li.L),C=CLASSES[H.cls]||CLASSES.paladin;
  return `<div class="showcase ${li.L>=5?'aura':''}" data-act="goHero"><img src="${H.img}" alt="${esc(H.name)}"><div class="sc-fade"></div>${li.L>=20?'<div class="sc-crown">👑</div>':li.L>=16?'<div class="sc-crown">🌟</div>':''}
    <div class="sc-info"><span class="sc-lv">LV. ${li.L}</span><div class="sc-name">${esc(H.name)}</div><div class="sc-sub">${esc(t[2])} · ${C.e} ${C.n}${H.motto?` · “${esc(H.motto)}”`:''}</div><div class="sys-xp"><i style="width:${Math.round(li.into/li.need*100)}%"></i></div><div class="sc-xp">EXP ${li.into} / ${li.need} · 🔥 ${dayStreak()}-day streak</div></div></div>`;
}
function statusHTML(){
  const li=levelInfo(totalXP()),t=titleFor(li.L),H=S.hero,C=CLASSES[H.cls]||CLASSES.paladin,st=heroStats(),mx=Math.max(...st.map(x=>x[3]),20);
  const art=hasArt(H);
  return (art?showcaseHTML():'')+`<div class="syswin"><div class="sys-h"><span>✿ Hero card</span><span>🔥 ${dayStreak()}-day streak</span></div>
    ${art?'':`<div class="sys-top" data-act="goHero"><div class="sys-av">${H.created?avatarSVG(H,li.L,104):'<span style="font-size:44px">❔</span>'}</div><div class="grow">
      <div class="sys-name">${H.created?esc(H.name):'Create your character ›'}</div>
      <div class="sys-l">LV. <b>${li.L}</b> · ${esc(t[2])}</div><div class="sys-l">${H.created?`${C.e} ${C.n}`:'—'}</div>
      <div class="sys-xp"><i style="width:${Math.round(li.into/li.need*100)}%"></i></div><div class="sys-s">EXP ${li.into} / ${li.need}${H.created?' · tap to customize':''}</div></div></div>`}
    <div class="sys-stats">${st.map(([k,n,e,v])=>`<div class="sys-st"><span>${e} ${k}</span><b>${v}</b><div class="sys-bar"><i style="width:${Math.round(v/mx*100)}%"></i></div><small>${n}</small></div>`).join('')}</div></div>`;
}

/* ---------- To-do lists ---------- */
const XP_TODO=5;
function defaultTodos(){return {lists:[{id:uid(),name:'Groceries',icon:'🛒',kind:'groceries'},{id:uid(),name:'Work',icon:'💼',kind:'work'},{id:uid(),name:'Home',icon:'🏠',kind:'home'}],items:[]}}
let TL='today';
const tlist=id=>S.todos.lists.find(l=>l.id===id);
const openTodos=()=>S.todos.items.filter(i=>!i.done&&tlist(i.list));
const dueToday=()=>{const k=todayK();return openTodos().filter(i=>i.star||(i.due&&i.due<=k))};
const todoDoneOn=k=>S.todos.items.filter(i=>i.done&&i.doneAt===k).length;
function parseTodo(text){
  let t=' '+String(text||'').trim()+' ',qty='',star=false,due='';
  if(/\s!\s/.test(t)){star=true;t=t.replace(/\s!\s/,' ')}
  let price='';const pm=t.match(/\s@\s?(\d+(?:[.,]\d+)?)\s/);if(pm){price=pm[1].replace(',','.');t=t.replace(pm[0],' ')}
  const q=t.match(/\s[x×](\d+(?:[.,]\d+)?)\s/i)||t.match(/\s(\d+(?:[.,]\d+)?)\s?[x×]\s/i);if(q){qty=q[1];t=t.replace(q[0],' ')}
  const m=t.match(/\s(today|tonight|tomorrow|tmrw?)\s*$/i);if(m){due=key(addDays(new Date(),/tom|tmr/i.test(m[1])?1:0));t=t.slice(0,m.index)}
  return {text:t.trim(),qty,star,due,price};
}
function addTodo(listId,text,due){const p=parseTodo(text);if(!p.text||!tlist(listId))return null;const it={id:uid(),list:listId,text:p.text,qty:p.qty,price:p.price,star:p.star,due:due||p.due,done:false,doneAt:'',created:todayK()};S.todos.items.push(it);return it}
const dueLabel=d=>{if(!d)return '';const n=dayDiff(new Date(),parse(d));return n<0?`<span class="due late">overdue</span>`:n===0?'<span class="due">today</span>':n===1?'<span class="due">tomorrow</span>':`<span class="due">${parse(d).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</span>`};
function todoRow(i,showList){const l=tlist(i.list);
  return `<div class="todo ${i.done?'done':''}"><button class="tchk" data-todo="${i.id}" aria-label="Done">✓</button><div class="grow"><div class="tt">${esc(i.text)}${i.qty?` <span class="qty">×${esc(i.qty)}</span>`:''}${i.price?` <span class="meta">${esc(S.money.cur)} ${esc(i.price)}</span>`:''}</div>${(showList&&l)||i.due?`<div class="meta">${showList&&l?esc(l.icon+' '+l.name)+' ':''}${dueLabel(i.done?'':i.due)}</div>`:''}</div>
    ${i.done?'':`<button class="tb2 ${i.star?'on':''}" data-tstar="${i.id}" aria-label="Important">★</button><button class="tb2" data-tdue="${i.id}" aria-label="Due date">📅</button>`}<button class="tb2" data-tdel="${i.id}" aria-label="Delete">×</button></div>`}
function todoTodayCard(){
  const due=dueToday(),rest=openTodos().filter(i=>!due.includes(i)),items=due.concat(rest),open=items.length;
  if(!S.todos.lists.length)return '';
  return `<div class="card"><div class="sec-h"><span>📋 To-dos</span><button class="pill" data-act="goTodos">${open} open ›</button></div>
    ${items.slice(0,10).map(i=>todoRow(i,true)).join('')||'<div class="meta" style="padding:4px 0 8px">All clear! Add a to-do:</div>'}${open>10?`<button class="linkbtn" data-act="goTodos">+ ${open-10} more ›</button>`:''}
    <form id="fTodoQ" class="row mt"><input name="t" placeholder="Add a to-do…" autocomplete="off"><select name="l" style="flex:0 0 34%">${S.todos.lists.map(l=>`<option value="${l.id}">${esc(l.icon)} ${esc(l.name)}</option>`).join('')}</select><button class="btn" style="flex:0 0 auto;padding:10px 14px">+</button></form></div>`;
}
function renderTodos(){
  if(TL!=='today'&&!tlist(TL))TL='today';
  const L=TL==='today'?null:tlist(TL),k=todayK();
  let h=`<div class="tabsx"><button class="${TL==='today'?'on':''}" data-tl="today">⭐ Today <b>${dueToday().length}</b></button>${S.todos.lists.map(l=>`<button class="${TL===l.id?'on':''}" data-tl="${l.id}">${esc(l.icon)} ${esc(l.name)} <b>${S.todos.items.filter(i=>i.list===l.id&&!i.done).length}</b></button>`).join('')}<button data-act="tlAdd">＋ List</button></div>`;
  const ph=L?(L.kind==='groceries'?'Add item… e.g. milk x2 @45':'Add a task… use ! for important, “tomorrow” for due'):'Add a task for today…';
  h+=`<form id="fTodo" class="card row"><input name="t" placeholder="${ph}" autocomplete="off" enterkeyhint="done">${L?'':`<select name="l" style="flex:0 0 34%">${S.todos.lists.map(l=>`<option value="${l.id}">${esc(l.icon)} ${esc(l.name)}</option>`).join('')}</select>`}<button class="btn" style="flex:0 0 auto">Add</button></form>`;
  const items=L?S.todos.items.filter(i=>i.list===L.id):S.todos.items.filter(i=>tlist(i.list)&&(i.done?i.doneAt===k&&(i.star||i.due):(i.star||(i.due&&i.due<=k))));
  const open=items.filter(i=>!i.done).sort((a,b)=>(b.star-a.star)||((a.due||'9')>(b.due||'9')?1:-1)),done=items.filter(i=>i.done);
  const groc=L&&L.kind==='groceries';
  if(groc&&open.length){const g={};open.forEach(i=>(g[aisleOf(i.text)]=g[aisleOf(i.text)]||[]).push(i));
    const est=items.reduce((a,i)=>a+(+i.price||0)*(parseFloat(i.qty)||1),0);
    h+=`<div class="card">${Object.entries(g).map(([a,arr])=>`<div class="aisle">${a}</div>`+arr.map(i=>todoRow(i,false)).join('')).join('')}${est?`<div class="meta mt">Estimated total: <b>${fmtMoney(est)}</b></div>`:''}</div>`;
  }else h+=`<div class="card">${open.length?open.map(i=>todoRow(i,!L)).join(''):`<div class="empty">${L?(L.kind==='groceries'?'Your shopping list is empty 🛒':'All clear! 🎉'):'Nothing due today. Star ★ tasks in any list to see them here.'}</div>`}</div>`;
  if(groc&&done.length)h+=`<button class="btn full" style="margin-bottom:12px" data-act="tLogShop">🧾 Done shopping: log it in Money</button>`;
  if(done.length)h+=`<div class="card"><details ${L&&L.kind==='groceries'?'open':''}><summary style="margin:0">✓ Done (${done.length})</summary><div class="mt">${done.map(i=>todoRow(i,!L)).join('')}</div></details>${L?`<button class="linkbtn" data-act="tClear">Clear done items</button>`:''}</div>`;
  if(L)h+=`<div class="row" style="margin-bottom:12px"><button class="btn ghost" data-act="tShare">📤 Share list</button><button class="btn ghost" data-act="tlEdit">✎ Rename</button><button class="btn danger" style="flex:0 0 auto" data-act="tlDel">Delete</button></div>`;
  h+=`<p class="meta">+${XP_TODO} XP for every to-do you finish. Tip: type “eggs x12”, “milk @45” (price), “call bank tomorrow” or “pay bills !”.</p>`;
  $('#todosBody').innerHTML=h;
}

/* ---------- Money tracker ---------- */
const MCATS={groceries:['🛒','Groceries'],food:['🍔','Food & dining'],transport:['🚗','Transport & fuel'],bills:['💡','Bills & phone'],shopping:['🛍️','Shopping'],health:['💊','Health'],fitness:['🏋️','Fitness'],subs:['📺','Subscriptions'],education:['📚','Education'],home:['🏠','Home'],transfer:['🔁','Transfers'],cash:['🏧','Cash withdrawal'],gifts:['🎁','Gifts & charity'],other:['✨','Other'],income:['💰','Income']};
const MKEYS=[
  ['groceries',/carrefour|spinneys|seoudi|metro market|kazyon|hyper ?one|oscar|gourmet|kheir zaman|awlad ragab|fathalla|panda|lulu|supermarket|grocer|market|سوبر ?ماركت|ماركت|هايبر|بقال|خضار|فاكه|كارفور|سعودي|كازيون/i],
  ['food',/talabat|elmenus|breadfast|mcdonald|kfc|burger|pizza|starbucks|costa|cilantro|caf[eé]|coffee|restaurant|buffalo|hardee|domino|papa ?john|koshary|bakery|مطعم|كافيه|طلبات|قهوة|شاورما|كشري|مخبز/i],
  ['transport',/uber|careem|indrive|didi|swvl|bolt|taxi|petrol|fuel|misr petroleum|wataniya|chill ?out|total ?energ|shell|mobil|emarat|parking|toll|بنزين|وقود|مواصلات|أوبر|اوبر|كريم|جراج/i],
  ['subs',/netflix|spotify|shahid|osn|youtube|apple\.com|itunes|icloud|google|anghami|watch ?it|chatgpt|openai|anthropic|claude\.ai|prime video|disney|playstation|xbox|steam/i],
  ['bills',/vodafone(?! cash)|orange(?! cash)|etisalat(?! cash)|\bwe\b|telecom|internet|electric|water bill|gas bill|fawry|recharge|كهرباء|مياه|غاز|فاتورة|فوري|شحن رصيد|فودافون|اورنج|اتصالات/i],
  ['health',/pharm|el ?ezaby|seif|19011|hospital|clinic|doctor|\bdr\.?\b|\blab\b|alfa|mokhtabar|صيدلي|مستشفى|عيادة|دكتور|معمل|دواء/i],
  ['fitness',/\bgym\b|fitness|gold'?s|crossfit|nadi|نادي|جيم/i],
  ['shopping',/amazon|noon|jumia|zara|h&m|defacto|lc ?waikiki|shein|\bmall\b|ikea|centrepoint|max fashion|adidas|nike|مول|ملابس|سنتر/i],
  ['education',/udemy|coursera|duolingo|school|university|academy|kindle|book|مدرسة|جامعة|كتاب|كورس/i],
  ['home',/furniture|hardware|maintenance|plumb|electrician|homzmart|اثاث|أثاث|صيانة|سباك/i],
  ['transfer',/instapay|insta pay|transfer|wallet|vodafone cash|etisalat cash|orange cash|تحويل|محفظة|انستا ?باي/i],
  ['cash',/\batm\b|cash withdrawal|withdraw|سحب نقد|سحب|صراف/i],
  ['gifts',/donation|charity|zakat|sadaqa|gift|تبرع|زكاة|زكاه|صدقة|هدية/i],
];
const AR_DIG=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/٬/g,',');
const CUR_RE='(?:EGP|E\\.G\\.P|LE|L\\.E\\.?|E£|USD|US\\$|\\$|EUR|€|SAR|AED|GBP|£|جنيه(?:اً|ا)?(?: مصري)?|ج\\.?م\\.?|جم)';
const merchKey=m=>String(m||'').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,' ').trim().split(' ').slice(0,2).join(' ');
function guessCat(merchant,text){
  const mk=merchKey(merchant);if(mk&&S.money.rules[mk])return S.money.rules[mk];
  for(const [c,re] of MKEYS)if(re.test(merchant||''))return c;
  for(const [c,re] of MKEYS)if(re.test(text||''))return c;
  return 'other';
}
function parseSMS(raw){
  const t=AR_DIG(raw).replace(/\s+/g,' ').trim();if(t.length<8)return null;
  if(/\bOTP\b|one[- ]time|verification code|passcode|رمز التحقق|كود التفعيل|كلمة (?:السر|المرور)|لا تشارك/i.test(t)&&!/charged|debited|purchase|خصم|شراء/i.test(t))return null;
  const re=new RegExp(`${CUR_RE}\\s?([\\d,]+(?:\\.\\d{1,2})?)|([\\d,]+(?:\\.\\d{1,2})?)\\s?${CUR_RE}`,'gi');
  let m,amt=null,cur='';
  while((m=re.exec(t))){
    const before=t.slice(Math.max(0,m.index-30),m.index).toLowerCase();
    if(/balance|limit|available|avail|bal\b|رصيد|الحد|المتاح|متاح/.test(before))continue;
    const num=parseFloat((m[1]||m[2]).replace(/,/g,''));if(!(num>0))continue;
    amt=num;cur=(m[0].match(/[A-Za-z$€£]+|جنيه|ج\.?م|جم/)||[''])[0];break;
  }
  if(amt==null)return null;
  const isDebit=/charged|debited|purchase|spent|\bpaid\b|payment|withdraw|\bsent\b|transferred to|transfer to|\bpos\b|خصم|شراء|سحب|دفع|سداد|تم تحويل/i.test(t);
  const isCredit=/credited|deposit|received|salary|refund|reversal|cash ?back|incoming|transfer(?:red)? from|added to your|إيداع|ايداع|إضافة|اضافة|استلام|استلمت|وارد|استرداد|راتب|مرتب|إلى حسابك|الى حسابك/i.test(t);
  if(!isDebit&&!isCredit)return null;
  const type=isCredit&&!/charged|debited|purchase|خصم|شراء|سحب/i.test(t)?'income':'expense';
  let merchant='';
  const mm=t.match(/\b(?:at|@|to|from)\s+([A-Za-z0-9&'.\-* ]{2,40}?)(?=\s+(?:on|at|dated|with|via|using|for|ref|card|from|your|\d{1,2}[\/\-.]\d)|[.,;]|$)/i)
    ||t.match(/(?:لدى|لدي|عند|إلى|الى|لصالح|من)\s+([^\d.,،:]{2,30}?)(?=\s+(?:بتاريخ|يوم|في|بطاقة|رصيد|المتاح|الساعة|من|عن)|[.,،]|$)/);
  if(mm)merchant=mm[1].replace(/\*+/g,' ').replace(/\s+/g,' ').trim();
  if(/^(your|you|the|card|account|حسابك|بطاقتك)$/i.test(merchant))merchant='';
  let date=todayK();
  const iso=t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/),dm=t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if(iso)date=`${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
  else if(dm){let[,d,mo,y]=dm;y=y.length===2?'20'+y:y;if(+mo>=1&&+mo<=12&&+d>=1&&+d<=31)date=`${y}-${pad(+mo)}-${pad(+d)}`}
  if(date>todayK()||date<'2000')date=todayK();
  const card=(t.match(/(?:ending(?: with| in)?|card(?: no\.?)?\s*\**|\*{2,}|x{2,}|منتهي(?:ة)?\s*(?:ب|برقم|بـ)?)\s*(\d{4})/i)||[])[1]||'';
  return {amount:amt,cur,type,merchant,date,card,raw:String(raw).trim().slice(0,400),cat:type==='income'?'income':guessCat(merchant,t)};
}
function parseMany(text){
  const out=[],seen=new Set();
  const chunks=String(text||'').split(/\n\s*\n|\r\n\s*\r\n/);
  chunks.forEach(ch=>{let p=parseSMS(ch);
    if(p&&ch.split('\n').filter(l=>new RegExp(CUR_RE,'i').test(AR_DIG(l))).length<=1){out.push(p);return}
    ch.split(/\r?\n/).forEach(l=>{const q=parseSMS(l);if(q)out.push(q)})});
  return out.filter(p=>{const h=txHash(p);if(seen.has(h))return false;seen.add(h);return true});
}
const txHash=p=>`${p.date}|${p.amount}|${p.type}|${merchKey(p.merchant)}|${(p.raw||'').slice(0,50)}`;
const fmtMoney=(n,cur)=>`${(cur||S.money.cur)} ${(+n).toLocaleString(undefined,{maximumFractionDigits:2})}`;
const monthTx=mk=>S.money.tx.filter(x=>x.date.slice(0,7)===mk);
let MV='spend',MMONTH=null,IMPORT=null,MFILTER=null,MADD=false;
function renderMoney(){
  const M=S.money;if(!MMONTH)MMONTH=todayK().slice(0,7);
  let h=`<div class="tabsx"><button class="${MV==='spend'?'on':''}" data-mv="spend">💸 Spending</button><button class="${MV==='wish'?'on':''}" data-mv="wish">🎁 Wishlist <b>${M.wish.filter(w=>!w.bought).length}</b></button></div>`;
  if(MV==='wish'){$('#moneyBody').innerHTML=h+wishHTML();return}
  const [y,mo]=MMONTH.split('-').map(Number),label=new Date(y,mo-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const tx=monthTx(MMONTH),exp=tx.filter(x=>x.type==='expense'&&inCur(x)),inc=tx.filter(x=>x.type==='income'&&inCur(x)),fx=tx.filter(x=>!inCur(x));
  const spent=exp.reduce((a,x)=>a+x.amount,0),income=inc.reduce((a,x)=>a+x.amount,0);
  const prevK=key(new Date(y,mo-2,1)).slice(0,7),prev=monthTx(prevK).filter(x=>x.type==='expense'&&inCur(x)).reduce((a,x)=>a+x.amount,0);
  const isCur=MMONTH===todayK().slice(0,7),daysIn=new Date(y,mo,0).getDate(),dayN=isCur?new Date().getDate():daysIn;
  h+=`<div class="card"><div class="sec-h"><button class="ib" data-mmonth="-1">‹</button><b>${label}</b><button class="ib" data-mmonth="1" ${isCur?'disabled':''}>›</button></div>
    <div class="money-big">${fmtMoney(spent)}</div><div class="meta" style="text-align:center">spent${prev?` · ${spent>prev?'▲':'▼'} ${Math.abs(Math.round((spent-prev)/prev*100))}% vs last month`:''} · ${fmtMoney(Math.round(spent/dayN))}/day</div>
    ${M.budget?`<div class="bar mt"><i style="width:${Math.min(100,Math.round(spent/M.budget*100))}%;${spent>M.budget?'background:var(--warn)':''}"></i></div><div class="meta mt">${spent>M.budget?'⚠️ Over budget by '+fmtMoney(spent-M.budget):fmtMoney(M.budget-spent)+' left of '+fmtMoney(M.budget)+' budget'}${isCur&&spent<=M.budget?` · ${fmtMoney(Math.round((M.budget-spent)/Math.max(1,daysIn-dayN+1)))}/day to stay on track`:''}</div>`:''}
    <div class="stats mt"><div class="stat"><b class="pos">${fmtMoney(income)}</b><span class="meta">income</span></div><div class="stat"><b>${fmtMoney(income-spent)}</b><span class="meta">net</span></div></div>${fx.length?`<div class="meta mt">🌍 ${fx.length} foreign-currency transaction${fx.length===1?'':'s'} (${[...new Set(fx.map(x=>x.cur))].join(', ')}) shown below but not counted in ${esc(M.cur)} totals.</div>`:''}</div>`;
  h+=`<div class="row" style="margin-bottom:12px"><button class="btn" data-act="mImport">📩 Import bank SMS</button><button class="btn ghost" style="flex:0 0 auto" data-act="mAdd">＋ Add</button></div>`;
  if(IMPORT)h+=importHTML();
  if(MADD)h+=`<form class="card" id="fTx"><h2>Add a transaction</h2><div class="chips"><label><input type="radio" name="type" value="expense" checked><span>💸 Expense</span></label><label><input type="radio" name="type" value="income"><span>💰 Income</span></label></div>
    <div class="row mt"><input name="amount" type="number" step="any" min="0" inputmode="decimal" placeholder="Amount (${esc(M.cur)})" required><select name="cat">${catOpts('other')}</select></div>
    <input class="mt" name="merchant" placeholder="Where / what (e.g. Carrefour)" autocomplete="off"><div class="row mt"><input type="date" name="date" value="${todayK()}"><button class="btn" style="flex:0 0 auto">Save</button></div></form>`;
  const byCat={};exp.forEach(x=>byCat[x.cat]=(byCat[x.cat]||0)+x.amount);
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  if(cats.length)h+=`<div class="card"><div class="sec-h"><span>📊 Where it went</span>${MFILTER?`<button class="pill" data-mcat="">Show all</button>`:''}</div>${cats.map(([c,v])=>`<div class="catrow ${MFILTER===c?'on':''}" data-mcat="${c}"><span class="ce">${(MCATS[c]||MCATS.other)[0]}</span><div class="grow"><div class="sec-h" style="margin:0"><span>${(MCATS[c]||MCATS.other)[1]}</span><b>${fmtMoney(v)}</b></div><div class="bar sm"><i style="width:${Math.round(v/cats[0][1]*100)}%"></i></div></div><span class="meta" style="width:36px;text-align:right">${Math.round(v/spent*100)}%</span></div>`).join('')}</div>`;
  const list=tx.filter(x=>!MFILTER||x.cat===MFILTER).sort((a,b)=>b.date.localeCompare(a.date)||b.ts-a.ts);
  if(list.length){let last='';h+=`<div class="card"><h2>🧾 Transactions</h2>`+list.map(x=>{const head=x.date!==last?`<div class="meta tdate">${parse(x.date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</div>`:'';last=x.date;
    return head+`<div class="txrow"><span class="ce">${(MCATS[x.cat]||MCATS.other)[0]}</span><div class="grow"><div>${esc(x.merchant||(MCATS[x.cat]||MCATS.other)[1])}</div><select class="txcat" data-txcat="${x.id}">${catOpts(x.cat)}</select></div><b class="${x.type==='income'?'pos':''}">${x.type==='income'?'+':'−'}${fmtMoney(x.amount,x.cur)}</b><button class="tb2" data-txdel="${x.id}" aria-label="Delete">×</button></div>`}).join('')+`</div>`}
  else if(!IMPORT)h+=`<div class="empty">No transactions in ${label} yet.<br>Import your bank SMS or add one manually.</div>`;
  h+=`<div class="card"><details><summary style="margin:0">📱 How to get bank messages in automatically</summary><ol class="meta">
    <li><b>Android:</b> install Kuestro from Chrome (⋮ → Install app). Then long-press any bank SMS → <b>Share</b> → <b>Kuestro</b>. It opens ready to import.</li>
    <li><b>iPhone:</b> Shortcuts → <b>Automation</b> → + → <b>Message</b> → Sender = your bank (or Message contains “EGP”) → <b>Run Immediately</b>. Action: <b>Append to Text File</b> (Shortcut Input → file “bank.txt” in iCloud Drive). Once in a while, tap <b>Import bank SMS → Open file</b> and pick bank.txt. Duplicates are skipped.</li>
    <li><b>Any phone:</b> copy one or many messages, then tap <b>Paste from clipboard</b>.</li>
    <li>Change a category once and Kuestro remembers it for that shop next time.</li></ol></details>
    <details><summary>⚙️ Currency & budget</summary><form id="fMoneySet" class="row mt"><div><label class="f">Currency</label><input name="cur" value="${esc(M.cur)}" maxlength="5"></div><div><label class="f">Monthly budget</label><input name="budget" type="number" min="0" step="any" value="${M.budget||''}" placeholder="optional"></div><button class="btn" style="flex:0 0 auto;align-self:flex-end">Save</button></form></details></div>`;
  $('#moneyBody').innerHTML=h;
}
const catOpts=sel=>Object.entries(MCATS).map(([k,[e,n]])=>`<option value="${k}" ${k===sel?'selected':''}>${e} ${n}</option>`).join('');
function importHTML(){
  const P=IMPORT.parsed;
  let h=`<div class="card"><h2>📩 Import bank messages</h2><textarea id="smsText" rows="5" placeholder="Paste one or many bank SMS here (English or Arabic)…">${esc(IMPORT.text||'')}</textarea>
    <div class="row mt"><button class="btn ghost" data-act="smsClip">📋 Paste from clipboard</button><label class="btn ghost">📂 Open file<input type="file" id="smsFile" accept=".txt,text/plain" hidden></label></div>
    <button class="btn full mt" data-act="smsParse">Read messages</button>`;
  if(P){const ok=P.filter(p=>!p.dup);
    h+=`<div class="mt">${P.length?P.map((p,i)=>`<div class="txrow ${p.dup?'dup':''}"><input type="checkbox" data-imp="${i}" ${p.skip||p.dup?'':'checked'} ${p.dup?'disabled':''}><div class="grow"><div><b class="${p.type==='income'?'pos':''}">${p.type==='income'?'+':'−'}${fmtMoney(p.amount,p.cur||S.money.cur)}</b> · ${esc(p.merchant||'—')}</div><div class="meta">${esc(p.date)}${p.card?' · card ••'+esc(p.card):''}${p.dup?' · already imported':''}</div><select class="txcat" data-impcat="${i}">${catOpts(p.cat)}</select></div></div>`).join(''):'<div class="meta">No transactions found. Make sure the text includes an amount with a currency (EGP, LE, جنيه…).</div>'}</div>
      ${ok.length?`<button class="btn full mt" data-act="smsSave">Import ${ok.filter(p=>!p.skip).length} transaction${ok.length===1?'':'s'}</button>`:''}`;
  }
  return h+`<button class="linkbtn" data-act="mImportClose">Close</button></div>`;
}
function doParse(text){
  const hs=new Set(S.money.tx.map(x=>x.h));
  IMPORT={text,parsed:parseMany(text).map(p=>({...p,dup:hs.has(txHash(p))}))};
  renderMoney();
}
const normCur=c=>{c=String(c||'').toUpperCase();if(/^\$|US/.test(c))return 'USD';if(c==='€')return 'EUR';if(c==='£')return 'GBP';return /^(USD|EUR|SAR|AED|GBP)$/.test(c)?c:''};
const inCur=x=>!x.cur||x.cur===S.money.cur;
function addTx(p,src){S.money.tx.push({id:uid(),ts:Date.now(),date:p.date,amount:+p.amount,cur:normCur(p.cur)===S.money.cur?'':normCur(p.cur),type:p.type,cat:p.cat,merchant:p.merchant||'',card:p.card||'',src,h:txHash(p)})}
function wishHTML(){
  const W=S.money.wish,open=W.filter(w=>!w.bought).sort((a,b)=>a.prio-b.prio),bought=W.filter(w=>w.bought);
  const total=open.reduce((a,w)=>a+(+w.price||0),0),saved=open.reduce((a,w)=>a+(+w.saved||0),0);
  const PR=['','🔥 Must have','💛 Want','✨ Nice to have'];
  let h=`<div class="card"><div class="stats"><div class="stat"><b>${fmtMoney(total)}</b><span class="meta">wishlist total</span></div><div class="stat"><b class="pos">${fmtMoney(saved)}</b><span class="meta">saved so far</span></div></div></div>
    <form class="card" id="fWish"><h2>➕ Add a wish</h2><input name="name" placeholder="What do you want? e.g. Running shoes" required autocomplete="off">
    <div class="row mt"><input name="price" type="number" min="0" step="any" inputmode="decimal" placeholder="Price"><select name="prio"><option value="1">🔥 Must have</option><option value="2" selected>💛 Want</option><option value="3">✨ Nice to have</option></select></div>
    <input class="mt" name="link" placeholder="Link (optional)" autocomplete="off"><button class="btn full mt">Add to wishlist</button></form>`;
  h+=open.length?open.map(w=>{const pct=w.price?Math.min(100,Math.round((+w.saved||0)/w.price*100)):0;
    return `<div class="card wish"><div class="sec-h"><span>${esc(w.name)}</span><b>${w.price?fmtMoney(w.price):''}</b></div><div class="meta">${PR[w.prio]||''}${w.price?` · saved ${fmtMoney(w.saved||0)} (${pct}%)`:''}</div>${w.price?`<div class="bar mt"><i style="width:${pct}%"></i></div>`:''}
      <div class="row mt"><button class="pill" style="flex:0 0 auto" data-wsave="${w.id}">＋ Saved</button>${w.link?`<a class="pill" style="flex:0 0 auto" ${linkAttrs(w.link)}>🔗 Open</a>`:''}<span class="grow"></span><button class="pill" style="flex:0 0 auto" data-wbuy="${w.id}">✓ Bought</button><button class="tb2" data-wdel="${w.id}" aria-label="Delete">×</button></div></div>`}).join(''):'<div class="empty">Your wishlist is empty. Add things you’re saving up for 🎯</div>';
  if(bought.length)h+=`<div class="card"><details><summary style="margin:0">✓ Got it (${bought.length})</summary>${bought.map(w=>`<div class="li"><div class="grow">${esc(w.name)}</div><span class="meta">${w.price?fmtMoney(w.price):''}</span><button class="tb2" data-wdel="${w.id}">×</button></div>`).join('')}</details></div>`;
  return h;
}
function moneyTodayCard(){
  const k=todayK(),tx=monthTx(k.slice(0,7)).filter(x=>x.type==='expense'&&inCur(x));if(!tx.length&&!S.money.budget)return '';
  const spent=tx.reduce((a,x)=>a+x.amount,0),today=tx.filter(x=>x.date===k).reduce((a,x)=>a+x.amount,0),B=S.money.budget;
  return `<div class="card" data-act="goMoney" style="cursor:pointer"><div class="sec-h"><span>💰 Money</span><span class="meta">${fmtMoney(today)} today ›</span></div><div class="meta">${fmtMoney(spent)} spent this month${B?` of ${fmtMoney(B)}`:''}</div>${B?`<div class="bar"><i style="width:${Math.min(100,Math.round(spent/B*100))}%;${spent>B?'background:var(--warn)':''}"></i></div>`:''}</div>`;
}
/* grocery aisles */
const AISLES=[['🥬','Fruit & veg',/tomato|potato|onion|garlic|apple|banana|orange|fruit|veg|lettuce|cucumber|lemon|carrot|pepper|herb|avocado|grape|طماطم|بطاطس|بصل|ثوم|خيار|ليمون|فاكه|خضار|جزر|فلفل|موز|تفاح|برتقال/i],
  ['🥛','Dairy & eggs',/milk|cheese|yog|laban|butter|cream|egg|labneh|لبن|جبن|زبادي|زبدة|بيض|قشطة|لبنة/i],
  ['🍗','Meat & fish',/chicken|beef|meat|fish|tuna|salmon|shrimp|mince|sausage|فراخ|دجاج|لحم|سمك|تونة|جمبري|مفروم/i],
  ['🍞','Bakery',/bread|toast|cake|croissant|bun|عيش|خبز|توست|كيك/i],
  ['🥫','Pantry',/rice|pasta|oil|sugar|salt|flour|tea|coffee|beans|lentil|oat|honey|spice|sauce|jam|cereal|nuts|رز|أرز|مكرونة|زيت|سكر|ملح|دقيق|شاي|بن|فول|عدس|شوفان|عسل|توابل|صلصة|مربى/i],
  ['🥤','Drinks',/water|juice|soda|cola|pepsi|مياه|ماء|عصير|بيبسي/i],
  ['❄️','Frozen',/frozen|ice cream|مجمد|آيس كريم/i],
  ['🧴','Household & care',/soap|detergent|tissue|shampoo|toothpaste|clean|bleach|diaper|foil|bag|صابون|منظف|مناديل|شامبو|معجون|كلور|حفاض|أكياس/i]];
const aisleOf=t=>{const a=AISLES.find(a=>a[2].test(t));return a?a[0]+' '+a[1]:'📦 Other'};

/* ---------- Progress (weekly / monthly) ---------- */
let PV='week',POFF=0;
function periodRange(kind,off){
  const t=new Date();
  if(kind==='week'){const [s]=weekRange(addDays(t,off*7));return [s,addDays(s,6)]}
  return [new Date(t.getFullYear(),t.getMonth()+off,1),new Date(t.getFullYear(),t.getMonth()+off+1,0)];
}
function periodXP(ks){
  const catOf={};S.routines.forEach(r=>catOf[r.id]=r.cat);let x=0;
  for(const k in S.done){if(!ks.has(k))continue;const cls=classOn(k);for(const id in S.done[k]){const pr=id.startsWith('prayer:');x+=(pr?XP_PRAYER:XP_ROUTINE)+bonusXP(cls,pr?'prayer':id.startsWith('med:')?'meds':catOf[id])}}
  S.logs.forEach(l=>{if(ks.has(l.date))x+=XP_LOG+bonusXP(classOn(l.date),CATFOR[l.type])});
  S.todos.items.forEach(i=>{if(i.done&&ks.has(i.doneAt))x+=XP_TODO+bonusXP(classOn(i.doneAt),'work')});
  Object.entries(S.lang.reviews).forEach(([k,n])=>{if(ks.has(k))x+=n*(2+(classOn(k)==='mage'?1:0))});
  Object.entries(S.claimed).forEach(([k,v])=>{const m=k.match(/^(?:d|w|card):(\d{4}-\d{2}-\d{2})/)||k.match(/^m:(\d{4}-\d{2})/);if(!m)return;const d=m[1].length===7?m[1]+'-01':m[1];if(ks.has(d))x+=+v||0});
  return x;
}
function periodStats(days){
  const P={due:0,dn:0,perfect:0,good:0,pr:0,prDue:0,pr5:0,per:{},cat:{},best:null};
  days.forEach(d=>{
    const st=dayStats(d);P.due+=st.total;P.dn+=st.done;
    if(st.total&&st.done===st.total)P.perfect++;if(st.total&&st.done/st.total>=.5)P.good++;
    if(st.total&&(!P.best||st.pct>P.best.pct))P.best={d,pct:st.pct};
    S.routines.forEach(r=>{if(!isDue(r,d))return;const dn=isDone(r.id,d),o=P.per[r.id]=P.per[r.id]||{r,due:0,dn:0},c=P.cat[r.cat]=P.cat[r.cat]||{due:0,dn:0};o.due++;c.due++;if(dn){o.dn++;c.dn++}});
    if(S.settings.prayers){const n=prayedCount(d),c=P.cat.prayer=P.cat.prayer||{due:0,dn:0};P.prDue+=5;P.pr+=n;if(n===5)P.pr5++;c.due+=5;c.dn+=n}
    dosesOn(d).forEach(x=>{const c=P.cat.meds=P.cat.meds||{due:0,dn:0};c.due++;if(isDone(x.id,d))c.dn++});
  });
  const ks=new Set(days.map(key)),L=S.logs.filter(l=>ks.has(l.date)),sum=(t,f)=>L.filter(l=>l.type===t).reduce((a,l)=>a+(f?(+l[f]||0):1),0);
  Object.assign(P,{pct:P.due?Math.round(P.dn/P.due*100):0,ks,km:+sum('run','km').toFixed(1),runs:sum('run'),pages:sum('read','pages'),
    sessions:T_().sessions.filter(s=>ks.has(s.date)).length,vol:T_().sessions.filter(s=>ks.has(s.date)).reduce((a,s)=>a+(s.vol||0),0),
    wo:sum('workout'),langMin:days.reduce((a,d)=>a+langMinOn(key(d)),0),cards:days.reduce((a,d)=>a+(S.lang.reviews[key(d)]||0),0),
    words:S.lang.deck.filter(c=>ks.has(c.added)).length,todos:S.todos.items.filter(i=>i.done&&ks.has(i.doneAt)).length,
    spent:S.money.tx.filter(x=>x.type==='expense'&&inCur(x)&&ks.has(x.date)).reduce((a,x)=>a+x.amount,0),xp:periodXP(ks)});
  return P;
}
const pctColor=p=>p>=100?'var(--acc)':p>=75?'color-mix(in srgb,var(--acc) 75%,transparent)':p>=50?'color-mix(in srgb,var(--acc) 50%,transparent)':p>0?'color-mix(in srgb,var(--acc) 25%,transparent)':'var(--line)';
function renderProgress(){
  const [s,e]=periodRange(PV,POFF),today=new Date(),tk=todayK(),all=range(s,e),past=all.filter(d=>key(d)<=tk);
  const P=periodStats(past),[ps,pe]=periodRange(PV,POFF-1),PP=periodStats(range(ps,pe).slice(0,past.length).filter(d=>key(d)<=tk));
  const label=PV==='week'?`${s.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${e.toLocaleDateString(undefined,{day:'numeric',month:'short'})}`:s.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const delta=PP.due?P.pct-PP.pct:null,word=PV==='week'?'week':'month',cur=POFF===0;
  let h=`<div class="tabsx"><button class="${PV==='week'?'on':''}" data-pv="week">📅 Week</button><button class="${PV==='month'?'on':''}" data-pv="month">🗓️ Month</button></div>`;
  h+=`<div class="card"><div class="sec-h"><button class="ib" data-poff="-1">‹</button><b>${cur?`This ${word}`:label}</b><button class="ib" data-poff="1" ${cur?'disabled':''}>›</button></div>${cur?`<div class="meta" style="text-align:center">${label}</div>`:''}
    <div class="ring-wrap"><div class="ring" style="--p:${P.pct}"><b>${P.pct}%</b><span>done</span></div>
    <div class="ring-side"><div><b>${P.dn}</b> <span class="meta">of ${P.due} tasks</span></div>${delta!=null?`<div class="${delta>=0?'pos':'late'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}% <span class="meta">vs ${cur?'same point last':'previous'} ${word}</span></div>`:''}<div><b>+${P.xp.toLocaleString()}</b> <span class="meta">XP earned</span></div><div>🌟 <b>${P.perfect}</b> <span class="meta">perfect day${P.perfect===1?'':'s'}</span></div>${P.best?`<div class="meta">Best: ${P.best.d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'})} (${P.best.pct}%)</div>`:''}</div></div></div>`;
  // day by day
  if(PV==='week'){
    h+=`<div class="card"><h2>Day by day</h2><div class="wbars">${all.map(d=>{const k=key(d),fut=k>tk,st=fut?null:dayStats(d);return `<button class="wbar ${k===tk?'today':''}" data-gotoday="${k}" ${fut?'disabled':''}><span class="wv">${fut?'':st.pct+'%'}</span><span class="wcol"><i style="height:${fut?0:Math.max(3,st.pct)}%;background:${fut?'var(--line)':pctColor(st.pct)}"></i></span><span class="wl">${DAYS[d.getDay()][0]}<small>${d.getDate()}</small></span></button>`}).join('')}</div></div>`;
  }else{
    const lead=(s.getDay()-(+S.settings.weekStart)+7)%7,wd=[...Array(7)].map((_,i)=>DAYS[(+S.settings.weekStart+i)%7][0]);
    h+=`<div class="card"><h2>Day by day</h2><div class="cal">${wd.map(x=>`<span class="cal-h">${x}</span>`).join('')}${'<span></span>'.repeat(lead)}${all.map(d=>{const k=key(d),fut=k>tk,st=fut?null:dayStats(d);return `<button class="cal-d ${k===tk?'today':''}" data-gotoday="${k}" ${fut?'disabled':''} style="background:${fut?'transparent':pctColor(st.pct)}" title="${fut?'':st.pct+'%'}">${d.getDate()}</button>`}).join('')}</div>
      <div class="legend meta"><span>Less</span>${[0,25,50,75,100].map(p=>`<i style="background:${pctColor(p)}"></i>`).join('')}<span>More</span></div></div>`;
  }
  // by area
  const cats=Object.entries(P.cat).filter(([,v])=>v.due).map(([c,v])=>({c,...v,p:Math.round(v.dn/v.due*100)})).sort((a,b)=>b.p-a.p);
  const nameOf=c=>c==='meds'?['💊','Medications']:(CATS[c]||['✨',c]);
  if(cats.length)h+=`<div class="card"><h2>By area</h2>${cats.map(x=>`<div class="catrow"><span class="ce">${nameOf(x.c)[0]}</span><div class="grow"><div class="sec-h" style="margin:0"><span>${x.c==='language'?esc(S.lang.name):nameOf(x.c)[1]}</span><b>${x.p}%</b></div><div class="bar sm"><i style="width:${x.p}%"></i></div><div class="meta">${x.dn} / ${x.due}</div></div></div>`).join('')}</div>`;
  // totals
  const T=[['🕌',`${P.pr}/${P.prDue}`,`prayers · ${P.pr5} full days`,S.settings.prayers],['🏋️',P.sessions,'training sessions',P.sessions||T_().plan.length],['🏃',`${P.km} km`,`${P.runs} run${P.runs===1?'':'s'}`,P.runs],['📖',P.pages,'pages read',P.pages],
    ['🗣️',`${P.langMin} min`,`${esc(S.lang.name)} practice`,P.langMin],['🧠',P.cards,`flashcards · ${P.words} new words`,P.cards||P.words],['✅',P.todos,'to-dos finished',P.todos],['💸',fmtMoney(Math.round(P.spent)),'spent',P.spent]].filter(x=>x[3]);
  if(T.length)h+=`<div class="card"><h2>Totals</h2><div class="stats">${T.map(([e,b,sub])=>`<div class="stat"><b>${e} ${b}</b><span class="meta">${sub}</span></div>`).join('')}</div></div>`;
  // routines
  const per=Object.values(P.per).map(o=>({...o,p:Math.round(o.dn/o.due*100)})).sort((a,b)=>a.p-b.p);
  if(per.length)h+=`<div class="card"><h2>Routines</h2>${per.map(o=>`<div class="li"><span>${(CATS[o.r.cat]||CATS.other)[0]}</span><div class="grow"><div class="sec-h" style="margin:0"><span>${esc(o.r.name)}${o.p<50&&o.due>=3?' <span class="due late">needs attention</span>':o.p===100?' <span class="due">💯</span>':''}</span><span class="meta">${o.dn}/${o.due}</span></div><div class="bar sm"><i style="width:${o.p}%"></i></div></div></div>`).join('')}</div>`;
  if(!P.due&&!past.length)h+=`<div class="empty">This ${word} hasn’t started yet.</div>`;
  $('#progressBody').innerHTML=h;
}

/* ---------- Quests, XP, levels, badges ---------- */
const XP_ROUTINE=10, XP_PRAYER=15, XP_LOG=5, XP_BADGE=100;
const TITLES=[[1,'🌱','Beginner'],[3,'🧭','Seeker'],[5,'🛡️','Disciplined'],[8,'⚔️','Warrior'],[12,'🏅','Champion'],[16,'🦁','Master'],[20,'👑','Legend']];
const titleFor=L=>[...TITLES].reverse().find(t=>L>=t[0]);
function hashStr(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function pick(arr,n,seed){const r=rng(seed),a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
const range=(from,to)=>{const o=[];for(let d=from;key(d)<=key(to);d=addDays(d,1))o.push(d);return o};
const logsOn=(k,type)=>S.logs.filter(l=>l.date===k&&(!type||l.type===type));
const prayedCount=d=>PRAYERS.filter(p=>isDone('prayer:'+p,d)).length;
const catDue=(d,cat)=>S.routines.filter(r=>r.cat===cat&&isDue(r,d));
const catDone=(d,cat)=>catDue(d,cat).filter(r=>isDone(r.id,d)).length;
const isPerfect=d=>{const s=dayStats(d);return s.total>0&&s.done===s.total};
const isGood=d=>{const s=dayStats(d);return s.total>0&&s.done/s.total>=.5};
function weekRange(d=new Date()){const s=addDays(d,-((d.getDay()-(+S.settings.weekStart)+7)%7));return [s,addDays(s,6)]}
const sumLogs=(days,type,f)=>{const ks=new Set(days.map(key));return S.logs.filter(l=>l.type===type&&ks.has(l.date)).reduce((a,l)=>a+(f?(+l[f]||0):1),0)};
const fmtN=n=>(+n).toLocaleString(undefined,{maximumFractionDigits:1});

const DAILY=[
  {id:'pray5',icon:'🕌',t:'Pray all 5 prayers',xp:50,ok:()=>S.settings.prayers,p:d=>[prayedCount(d),5]},
  {id:'fajr',icon:'🌅',t:'Start strong: pray Fajr',xp:20,ok:()=>S.settings.prayers,p:d=>[+isDone('prayer:Fajr',d),1]},
  {id:'skin',icon:'🧴',t:'Glow up: finish all skin care',xp:30,ok:d=>catDue(d,'skincare').length>0,p:d=>[catDone(d,'skincare'),catDue(d,'skincare').length]},
  {id:'move',icon:'💪',t:'Move your body: log a run or workout',xp:40,ok:()=>true,p:d=>[Math.min(1,logsOn(key(d),'run').length+logsOn(key(d),'workout').length),1]},
  {id:'pages',icon:'📖',t:'Read 20 pages (log them)',xp:30,ok:()=>true,p:d=>[Math.min(20,logsOn(key(d),'read').reduce((a,l)=>a+(+l.pages||0),0)),20]},
  {id:'meals',icon:'🥗',t:'Log 3 meals',xp:30,ok:()=>true,p:d=>[Math.min(3,logsOn(key(d),'meal').length),3]},
  {id:'steps',icon:'👣',t:'Walk 8,000 steps',xp:40,ok:()=>Object.keys(S.health).length>0,p:d=>[Math.min(8000,(S.health[key(d)]||{}).steps||0),8000]},
  {id:'five',icon:'⚡',t:'Knock out 5 routines',xp:25,ok:d=>S.routines.filter(r=>isDue(r,d)).length>=5,p:d=>[Math.min(5,S.routines.filter(r=>isDue(r,d)&&isDone(r.id,d)).length),5]},
  {id:'duo',lang:1,icon:'🦉',t:'Do your Duolingo lesson',xp:30,ok:langOn,p:d=>[Math.min(1,S.logs.filter(l=>l.type==='lang'&&l.date===key(d)&&/duolingo/i.test(l.act)).length+S.routines.filter(r=>r.cat==='language'&&/duolingo/i.test(r.name)&&isDone(r.id,d)).length),1]},
  {id:'srs',lang:1,icon:'🧠',t:'Clear all your due flashcards',xp:30,ok:()=>S.lang.deck.length>0&&(dueCards().length>0||(S.lang.reviews[todayK()]||0)>0),p:d=>{const r=S.lang.reviews[key(d)]||0;return [r,r+dueCards().length]}},
  {id:'words5',lang:1,icon:'✍️',t:'Add 5 new words to your deck',xp:25,ok:langOn,p:d=>[Math.min(5,S.lang.deck.filter(c=>c.added===key(d)).length),5]},
  {id:'langmin',lang:1,icon:'🗣️',t:'Hit your daily language goal',xp:30,ok:langOn,p:d=>[Math.min(S.lang.goal,langMinOn(key(d))),S.lang.goal]},
  {id:'todo3',icon:'✅',t:'Clear 3 to-dos',xp:30,ok:()=>openTodos().length+todoDoneOn(todayK())>=3,p:d=>[Math.min(3,todoDoneOn(key(d))),3]},
  {id:'deen',icon:'📿',t:'Complete your Prayer & Quran routines',xp:30,ok:d=>catDue(d,'prayer').length>0,p:d=>[catDone(d,'prayer'),catDue(d,'prayer').length]},
];
const WEEKLY=[
  {id:'km15',icon:'🏃',t:'Run 15 km this week',xp:150,ok:()=>true,p:ds=>[Math.min(15,+sumLogs(ds,'run','km').toFixed(1)),15]},
  {id:'wo3',icon:'🏋️',t:'Complete 3 workouts',xp:150,ok:()=>true,p:ds=>[Math.min(3,Math.max(sumLogs(ds,'workout'),ds.reduce((a,d)=>a+catDone(d,'exercise'),0))),3]},
  {id:'pg100',icon:'📚',t:'Read 100 pages',xp:120,ok:()=>true,p:ds=>[Math.min(100,sumLogs(ds,'read','pages')),100]},
  {id:'pray5d',icon:'🕌',t:'All 5 prayers on 5 days',xp:200,ok:()=>S.settings.prayers,p:ds=>[Math.min(5,ds.filter(d=>prayedCount(d)===5).length),5]},
  {id:'perf2',icon:'🌟',t:'Have 2 perfect days',xp:200,ok:()=>true,p:ds=>[Math.min(2,ds.filter(isPerfect).length),2]},
  {id:'skin',icon:'✨',t:'Never skip skin care this week',xp:150,ok:()=>S.routines.some(r=>r.cat==='skincare'),p:ds=>{const due=ds.filter(d=>catDue(d,'skincare').length);return [due.filter(d=>catDone(d,'skincare')===catDue(d,'skincare').length).length,due.length]}},
  {id:'lang90',lang:1,icon:'🌍',t:'Practice your language 90 min',xp:150,ok:langOn,p:ds=>[Math.min(90,ds.reduce((a,d)=>a+langMinOn(key(d)),0)),90]},
  {id:'words25',lang:1,icon:'📇',t:'Add 25 new words',xp:120,ok:langOn,p:ds=>{const ks=new Set(ds.map(key));return [Math.min(25,S.lang.deck.filter(c=>ks.has(c.added)).length),25]}},
  {id:'rev100',lang:1,icon:'🧠',t:'Review 100 flashcards',xp:120,ok:()=>S.lang.deck.length>0,p:ds=>[Math.min(100,ds.reduce((a,d)=>a+(S.lang.reviews[key(d)]||0),0)),100]},
  {id:'train5',icon:'🏋️',t:'Finish every training day this week',xp:200,ok:()=>T_().plan.length>0&&(T_().mode==='cycle'||T_().days.length>0),p:ds=>{const wk=new Set(ds.map(key)),n=new Set(T_().sessions.filter(x=>wk.has(x.date)).map(x=>x.date)).size,tgt=T_().mode==='cycle'?Math.max(1,ds.filter(d=>isTrainDay(d)).length):T_().days.length;return [Math.min(n,tgt),tgt]}},
  {id:'meds7',icon:'💊',t:'Every dose, every day this week',xp:150,ok:()=>(S.meds||[]).some(m=>m.active!==false),p:ds=>{const days=ds.filter(d=>dosesOn(d).length);return [days.filter(d=>dosesOn(d).every(x=>isDone(x.id,d))).length,days.length]}},
  {id:'todo15',icon:'✅',t:'Complete 15 to-dos',xp:120,ok:()=>S.todos.items.length>0,p:ds=>{const ks=new Set(ds.map(key));return [Math.min(15,S.todos.items.filter(i=>i.done&&ks.has(i.doneAt)).length),15]}},
  {id:'meal14',icon:'🍽️',t:'Log 14 meals',xp:100,ok:()=>true,p:ds=>[Math.min(14,sumLogs(ds,'meal')),14]},
];
const BOSSES=[['🐉','The Dragon of Delay'],['👹','The Procrastination Ogre'],['🦂','The Scorpion of Excuses'],['🐺','The Wolf of Laziness'],['🦇','The Night Scroller'],['🐙','The Kraken of Distraction']];

function activeQuests(){
  const now=new Date(),k=key(now),out=[];
  const mk=(scope,id,q,[cur,target],extra={})=>{const qk=`${scope}:${id}`;out.push({key:qk,scope,icon:q.icon,t:q.t,xp:q.xp,cur,target,done:target>0&&cur>=target,claimed:S.claimed[qk]!=null,...extra})};
  const mix=(pool,seed)=>{const g=pool.filter(q=>!q.lang),l=pool.filter(q=>q.lang);return l.length?pick(g,2,seed).concat(pick(l,1,seed+7)):pick(g,3,seed)};
  const daily=mix(DAILY.filter(q=>q.ok(now)),hashStr(k+'|'+(S.rerolls[k]||0)));
  daily.forEach(q=>mk('d',`${k}:${q.id}`,q,q.p(now)));
  const dClaimed=out.filter(q=>q.claimed).length;
  mk('d',`${k}:chest`,{icon:'🎁',t:'Daily chest: claim all 3 quests',xp:50},[dClaimed,3],{chest:1});
  {const ds=dosesOn(now);if(ds.length)mk('d',`${k}:meds`,{icon:'💊',t:'Take all your medications',xp:30},[ds.filter(x=>isDone(x.id,now)).length,ds.length])}
  if(isTrainDay(now)&&T_().plan.length)mk('d',`${k}:train`,{icon:'🏋️',t:`Train today: ${(sessionsOn(k)[0]||nextW()).name}`,xp:40},[Math.min(1,sessionsOn(k).length),1]);
  {const k2=todayK(),dn=S.todos.items.filter(i=>i.done&&i.doneAt===k2&&i.due&&i.due<=k2).length,op=openTodos().filter(i=>i.due&&i.due<=k2).length;if(dn+op)mk('d',`${k}:todos`,{icon:'📋',t:"Finish today's to-dos",xp:30},[dn,dn+op])}
  mk('d',`${k}:perfect`,{icon:'🌟',t:'Bonus: perfect day, 100% of everything',xp:100},(()=>{const s=dayStats(now);return [s.done,s.total]})(),{bonus:1});
  const [ws,we]=weekRange(now),wk=key(ws),wdays=range(ws,now);
  const fixedW=['train5','meds7'];
  mix(WEEKLY.filter(q=>q.ok()&&!fixedW.includes(q.id)),hashStr('w'+wk)).forEach(q=>mk('w',`${wk}:${q.id}`,q,q.p(wdays)));
  WEEKLY.filter(q=>fixedW.includes(q.id)&&q.ok()).forEach(q=>mk('w',`${wk}:${q.id}`,q,q.p(wdays)));
  const ms=new Date(now.getFullYear(),now.getMonth(),1),me=new Date(now.getFullYear(),now.getMonth()+1,0),mkey=k.slice(0,7);
  let total=0,hits=0;range(ms,me).forEach(d=>{const s=dayStats(d);total+=s.total;if(key(d)<=k)hits+=s.done});
  const hp=Math.max(10,Math.round(total*.7)),boss=BOSSES[hashStr(mkey)%BOSSES.length];
  mk('m',`${mkey}:boss`,{icon:boss[0],t:`Defeat ${boss[1]}`,xp:500},[Math.min(hits,hp),hp],{boss,ends:me});
  return out;
}
function baseXP(){
  const catOf={};S.routines.forEach(r=>catOf[r.id]=r.cat);let x=0;
  for(const k in S.done){const cls=classOn(k);for(const id in S.done[k]){const pr=id.startsWith('prayer:');x+=(pr?XP_PRAYER:XP_ROUTINE)+bonusXP(cls,pr?'prayer':id.startsWith('med:')?'meds':catOf[id])}}
  S.logs.forEach(l=>{x+=XP_LOG+bonusXP(classOn(l.date),CATFOR[l.type])});
  S.todos.items.forEach(i=>{if(i.done&&i.doneAt)x+=XP_TODO+bonusXP(classOn(i.doneAt),'work')});
  return x+Object.entries(S.lang.reviews).reduce((a,[k,n])=>a+n*(2+(classOn(k)==='mage'?1:0)),0)}
const totalXP=()=>baseXP()+Object.values(S.claimed).reduce((a,b)=>a+(+b||0),0);
function levelInfo(xp){let L=1,need=100;while(xp>=need){xp-=need;L++;need=100+(L-1)*50}return {L,into:xp,need}}
function dayStreak(){
  const first=Object.keys(S.done).sort()[0];if(!first)return 0;
  let d=new Date(),c=0;if(!isGood(d))d=addDays(d,-1);
  for(let i=0;i<2000&&key(d)>=first;i++){const s=dayStats(d);if(s.total===0){d=addDays(d,-1);continue}if(s.done/s.total>=.5)c++;else break;d=addDays(d,-1)}
  return c;
}
function gameStats(){
  const st={medDays:0,ticks:0,prayers:0,perfect:0,bestStreak:0,km:0,pages:0,meals:0,quests:0,boss:0};
  for(const k in S.done)for(const id in S.done[k])id.startsWith('prayer:')?st.prayers++:st.ticks++;
  const keys=Object.keys(S.done).sort();
  if(keys.length){let run=0;range(parse(keys[0]),new Date()).forEach(d=>{const s=dayStats(d),dz=dosesOn(d);if(dz.length&&dz.every(x=>isDone(x.id,d)))st.medDays++;if(s.total===0)return;if(s.done===s.total)st.perfect++;if(s.done/s.total>=.5){run++;st.bestStreak=Math.max(st.bestStreak,run)}else run=0})}
  S.logs.forEach(l=>{if(l.type==='run')st.km+=+l.km||0;if(l.type==='read')st.pages+=+l.pages||0;if(l.type==='meal')st.meals++});
  Object.keys(S.claimed).forEach(k=>{if(/^[dw]:/.test(k)&&!k.endsWith(':chest'))st.quests++;if(k.startsWith('m:'))st.boss++});
  st.sessions=T_().sessions.length;st.prs=T_().sessions.reduce((a,x)=>a+(x.prs||0),0);st.cards=Object.keys(S.cards.seen).length;st.todos=S.todos.items.filter(i=>i.done).length;
  st.words=S.lang.deck.length;st.mature=S.lang.deck.filter(c=>(c.ivl||0)>=21).length;
  st.langMin=S.logs.filter(l=>l.type==='lang').reduce((a,l)=>a+(+l.min||0),0)+Object.values(S.lang.reviews).reduce((a,n)=>a+n,0)*0.2;
  st.level=levelInfo(totalXP()).L;return st;
}
const BADGES=[
  {id:'first',icon:'👣',t:'First step',h:'Complete a routine',ok:s=>s.ticks+s.prayers>=1},
  {id:'perfect1',icon:'🌟',t:'Flawless',h:'1 perfect day',ok:s=>s.perfect>=1},
  {id:'streak7',icon:'🔥',t:'On fire',h:'7-day streak',ok:s=>s.bestStreak>=7},
  {id:'perfect7',icon:'💎',t:'Diamond',h:'7 perfect days',ok:s=>s.perfect>=7},
  {id:'pray100',icon:'🕌',t:'Devoted',h:'100 prayers',ok:s=>s.prayers>=100},
  {id:'streak30',icon:'☄️',t:'Unstoppable',h:'30-day streak',ok:s=>s.bestStreak>=30},
  {id:'km50',icon:'🏃',t:'Road runner',h:'Run 50 km',ok:s=>s.km>=50},
  {id:'km200',icon:'🏁',t:'Ultra',h:'Run 200 km',ok:s=>s.km>=200},
  {id:'pg500',icon:'📚',t:'Bookworm',h:'Read 500 pages',ok:s=>s.pages>=500},
  {id:'meals50',icon:'🥗',t:'Mindful eater',h:'Log 50 meals',ok:s=>s.meals>=50},
  {id:'quest10',icon:'🗺️',t:'Adventurer',h:'Claim 10 quests',ok:s=>s.quests>=10},
  {id:'boss',icon:'⚔️',t:'Boss slayer',h:'Defeat a boss',ok:s=>s.boss>=1},
  {id:'lvl5',icon:'🛡️',t:'Disciplined',h:'Reach level 5',ok:s=>s.level>=5},
  {id:'lvl10',icon:'🏅',t:'Champion',h:'Reach level 10',ok:s=>s.level>=10},
  {id:'lvl20',icon:'👑',t:'Legend',h:'Reach level 20',ok:s=>s.level>=20},
  {id:'words100',icon:'🗂️',t:'Collector',h:'100 words in deck',ok:s=>s.words>=100},
  {id:'mature50',icon:'🧠',t:'Locked in',h:'Master 50 words',ok:s=>s.mature>=50},
  {id:'words500',icon:'🦜',t:'Polyglot path',h:'500 words',ok:s=>s.words>=500},
  {id:'lang600',icon:'🌍',t:'10 hours',h:'10 h of language',ok:s=>s.langMin>=600},
  {id:'train20',icon:'🏋️',t:'Iron will',h:'20 workouts',ok:s=>s.sessions>=20},
  {id:'pr10',icon:'🏆',t:'PR hunter',h:'10 personal records',ok:s=>s.prs>=10},
  {id:'meds30',icon:'💊',t:'Self-care pro',h:'All meds, 30 days',ok:s=>s.medDays>=30},
  {id:'cards30',icon:'🃏',t:'Collector',h:'All 30 cards',ok:s=>s.cards>=30},
  {id:'todo100',icon:'📋',t:'Getting it done',h:'100 to-dos',ok:s=>s.todos>=100},
  {id:'pray1000',icon:'🌙',t:'Steadfast',h:'1,000 prayers',ok:s=>s.prayers>=1000},
];
function checkProgress(){
  if(!S)return;
  const fresh=[];
  for(let pass=0;pass<3;pass++){const st=gameStats();let any=false;BADGES.forEach(b=>{if(!S.badges[b.id]&&b.ok(st)){S.badges[b.id]=key(new Date());S.claimed['b:'+b.id]=XP_BADGE;fresh.push(b);any=true}});if(!any)break}
  activeQuests().forEach(q=>{if(q.done&&!q.claimed&&!S.qSeen[q.key]){S.qSeen[q.key]=1;if(!q.chest)setTimeout(()=>toast(`🎯 Quest complete: ${q.t}. Claim your XP!`),400)}});
  const L=levelInfo(totalXP()).L;
  if(!S.lastLevel)S.lastLevel=L;
  else if(L>S.lastLevel){S.lastLevel=L;const t=titleFor(L),g=GEAR.find(x=>x[0]===L);celebrate(S.hero.created?avatarSVG(S.hero,L,150):t[1],'LEVEL UP!',`Level ${L} · ${S.hero.created?S.hero.name+', you':'You'}'re now a ${t[2]}.${g?` New gear unlocked: ${g[1]} ${g[2]}!`:' Keep the streak alive 💪'}`)}
  else if(fresh.length)celebrate(fresh[0].icon,`BADGE GET! ${fresh[0].t}`,`${fresh[0].h} · +${XP_BADGE} XP${fresh.length>1?` (and ${fresh.length-1} more!)`:''}`);
  save();
}
function heroHTML(big){
  if(!big&&hasArt(S.hero)){const H=S.hero,li=levelInfo(totalXP()),t=titleFor(li.L),C=CLASSES[H.cls]||CLASSES.paladin;
    return `<div class="banner" data-act="goQuests"><img src="${H.img}" alt=""><div class="sc-fade"></div><div class="bn-info"><span class="sc-lv">LV. ${li.L}</span><div class="sc-name" style="font-size:24px">${esc(H.name)}</div><div class="sc-sub">${esc(t[2])} · ${C.e} ${C.n}</div><div class="sys-xp"><i style="width:${Math.round(li.into/li.need*100)}%"></i></div><div class="sc-xp">${li.into} / ${li.need} XP · 🔥 ${dayStreak()}</div></div></div>`}
  const li=levelInfo(totalXP()),t=titleFor(li.L),ds=dayStreak(),H=S.hero,C=CLASSES[H.cls]||CLASSES.paladin;
  const act=H.created?(big?'goHero':'goQuests'):'goHero';
  const av=H.created?avatarSVG(H,li.L,big?88:54):t[1];
  return `<div class="card hero" data-act="${act}"><div class="avatar ${H.created?'av':''} ${big?'big':''}">${av}</div><div class="grow">
    <div class="sec-h"><span>${H.created?esc(H.name):'✨ Create your character ›'}</span><span class="meta">🔥 ${ds}-day streak</span></div>
    <div class="meta">Level ${li.L} · ${t[2]}${H.created?` ${C.e} ${C.n}`:''}</div>
    <div class="bar xp"><i style="width:${Math.round(li.into/li.need*100)}%"></i></div>
    <div class="meta">${li.into} / ${li.need} XP${big&&H.created?' · tap to customize':''}</div></div></div>`;
}
function questHTML(q){
  const pct=q.target?Math.min(100,Math.round(q.cur/q.target*100)):0;
  const right=q.claimed?`<span class="qdone">✓ +${q.xp}</span>`:q.done?`<button class="btn claim" data-claim="${esc(q.key)}">Claim +${q.xp}</button>`:`<span class="meta">+${q.xp} XP</span>`;
  return `<div class="quest ${q.claimed?'claimed':q.done?'ready':''}"><div class="qicon" style="background:${(THEMES[qTheme(q.key)]||THEMES.power).c}2e">${q.icon}</div><div class="grow"><div class="qt">${esc(q.t)}</div><div class="bar sm"><i style="width:${pct}%"></i></div><div class="meta">${fmtN(q.cur)} / ${fmtN(q.target)}</div></div>${right}</div>`;
}
function renderQuests(){
  const qs=activeQuests(),now=new Date(),k=key(now),hrs=Math.max(1,Math.ceil((addDays(now,1)-now)/36e5)),we=weekRange(now)[1],wleft=dayDiff(now,we)+1;
  const daily=qs.filter(q=>q.scope==='d'),canReroll=!(S.rerolls[k]>=1)&&!daily.some(q=>q.claimed&&!q.chest&&!q.bonus);
  const boss=qs.find(q=>q.scope==='m'),hpLeft=boss.target-boss.cur,mleft=dayDiff(now,boss.ends)+1,st=gameStats();
  let h=statusHTML();
  h+=`<button class="btn ghost full" style="margin-bottom:12px" data-act="goProgress">📈 Weekly & monthly progress</button>`;
  if(!hasArt(S.hero))h+=`<button class="card arttip" data-act="goHero"><b>🖼️ Make your character a real anime illustration</b><span class="meta">Upload your art and it becomes your hero card ›</span></button>`;
  h+=`<div class="card"><div class="sec-h"><span>☀️ Daily quests</span><span class="meta">reset in ${hrs}h</span></div>${daily.map(questHTML).join('')}${canReroll?`<button class="linkbtn" data-act="reroll">🎲 Don't like these? Swap today's quests (once a day)</button>`:''}</div>`;
  h+=`<div class="card"><div class="sec-h"><span>📅 Weekly quests</span><span class="meta">${wleft} day${wleft===1?'':'s'} left</span></div>${qs.filter(q=>q.scope==='w').map(questHTML).join('')}</div>`;
  h+=`<div class="card boss ${boss.done?'slain':''}"><div class="sec-h"><span>⚔️ Monthly boss</span><span class="meta">${mleft} day${mleft===1?'':'s'} left</span></div>
    <div class="be">${boss.done?'💥':boss.boss[0]}</div><div class="qt">${esc(boss.boss[1])}</div>
    <div class="bar hp"><i style="width:${Math.round(hpLeft/boss.target*100)}%"></i></div>
    <div class="meta">${boss.done?'Defeated!':`HP ${hpLeft} / ${boss.target}. Every routine and prayer you finish is a hit.`}</div>
    <div class="mt">${boss.claimed?`<span class="qdone">✓ Slain · +${boss.xp} XP</span>`:boss.done?`<button class="btn claim" data-claim="${esc(boss.key)}">Claim +${boss.xp} XP</button>`:`<span class="meta">Reward: +${boss.xp} XP & ⚔️ badge</span>`}</div></div>`;
  const seen=Object.keys(S.cards.seen).length;
  h+=`<div class="card"><details><summary style="margin:0">🃏 Card collection · ${seen} / ${CARDS.length}</summary><div class="cgrid mt">${CARDS.map((c,i)=>S.cards.seen[i]!=null?cardHTML(i):`<div class="mcard locked"><div class="mc-top">?</div><div class="mc-txt">Reveal more daily cards to collect this one</div><div class="mc-no">#${i+1}</div></div>`).join('')}</div></details></div>`;
  h+=`<div class="card"><div class="sec-h"><span>🏅 Badges</span><span class="meta">${Object.keys(S.badges).length} / ${BADGES.length}</span></div><div class="badges mt">${BADGES.map(b=>`<div class="badge ${S.badges[b.id]?'':'locked'}"><b>${b.icon}</b>${esc(b.t)}<div class="meta">${esc(b.h)}</div></div>`).join('')}</div></div>`;
  h+=`<div class="card"><h2>📊 Your record</h2><div class="stats">${[[fmtN(totalXP()),'total XP'],[st.bestStreak,'best streak (days)'],[st.perfect,'perfect days'],[st.quests,'quests claimed'],[fmtN(st.prayers),'prayers'],[fmtN(st.ticks),'routines done']].map(([b,s])=>`<div class="stat"><b>${b}</b><span class="meta">${s}</span></div>`).join('')}</div>
    <p class="meta mt">XP: +${XP_ROUTINE} per routine, +${XP_PRAYER} per prayer, +${XP_LOG} per log entry, +2 per flashcard, your class bonus, +${XP_BADGE} per badge, plus quest rewards. A streak day means at least half of that day's routines are done.</p></div>`;
  $('#questsBody').innerHTML=h;
}
function claimQuest(qk,x,y){
  const q=activeQuests().find(q=>q.key===qk);if(!q||!q.done||q.claimed)return;
  S.claimed[qk]=q.xp;showQC({theme:qTheme(qk),title:q.scope==='m'?'BOSS DEFEATED!':q.chest?'TREASURE!':'QUEST CLEAR!',qtitle:q.t,xp:q.xp});
  checkProgress();render();
}
function floatXP(x,y,text){
  if(!x&&!y){x=innerWidth/2;y=innerHeight/2}
  const el=document.createElement('div');el.className='fx';el.textContent=text;el.style.left=(x-20)+'px';el.style.top=(y-20)+'px';
  document.body.append(el);setTimeout(()=>el.remove(),1000);
}
function confetti(n=90){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cv=document.createElement('canvas'),dpr=devicePixelRatio||1;cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;cv.className='confetti';document.body.append(cv);
  const ctx=cv.getContext('2d'),cols=['#f5b544','#f08a3c','#2f7d6d','#5cc2a8','#e2553f','#7b6cf6'];
  const ps=Array.from({length:n},()=>({x:cv.width/2,y:cv.height*.4,vx:(Math.random()-.5)*16*dpr,vy:(-Math.random()*13-4)*dpr,s:(5+Math.random()*5)*dpr,c:cols[Math.random()*cols.length|0],r:Math.random()*6,vr:(Math.random()-.5)*.3}));
  const t0=performance.now();
  (function f(t){ctx.clearRect(0,0,cv.width,cv.height);ps.forEach(p=>{p.vy+=.35*dpr;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);ctx.restore()});
    if(t-t0<2600)requestAnimationFrame(f);else cv.remove()})(t0);
}
function celebrate(icon,title,sub){showQC({theme:String(icon).startsWith('<svg')?'level':'badge',big:icon,title,sub,hold:true})}

/* ---------- boot ---------- */
function start(){
  if(!S.lang.seeded){
    const t=todayK(),r=(name,freq,extra)=>({id:uid(),name,cat:'language',freq,time:'',note:'',start:t,days:[],dom:1,every:2,...extra});
    S.routines.push(r('Duolingo lesson','daily',{time:'08:00',note:'Then add the words you got wrong to your deck'}),r('Review flashcards','daily',{time:'21:30',note:'Kuestro → Learn → Review'}),
      r('Listening: podcast or video, 15 min','weekly',{days:[0,2,4],time:'19:00'}),r('Speaking: listen, repeat out loud, 5 min','interval',{every:2,time:'20:00'}),r('Conversation practice (tutor or AI)','weekly',{days:[5],time:'17:00'}));
    S.lang.seeded=true;save();
  }
  if(!S.train.seeded){
    let r=S.routines.find(r=>r.cat==='exercise'&&/strength workout/i.test(r.name));
    if(!r){r={id:uid(),name:'',cat:'exercise',freq:'weekly',time:'18:00',note:'',start:todayK(),days:[],dom:1,every:2};S.routines.push(r)}
    Object.assign(r,{name:'Training session',link:'train',freq:'weekly',note:'Your rotation is in the Train tab'});S.train.seeded=true;syncTrainRoutine();save();
  }
  checkProgress();nudgeTick();
  if(pendingShare){const t=pendingShare;pendingShare=null;view='money';MV='spend';show('money');doParse(t);return}
  show(view);
  if(pendingCode){const c=pendingCode;pendingCode=null;if(S.strava.clientSecret)stravaExchange(c);else toast('Strava: set up your Client ID and Secret first')}
  else if(S.strava.refresh&&Date.now()-S.strava.lastSync>3600e3)stravaSync(true);
}
let pendingShare=null;
function boot(){
  const q=new URLSearchParams(location.search);
  if(q.has('text')||q.has('title')){pendingShare=[q.get('title'),q.get('text'),q.get('url')].filter(Boolean).join('\n');history.replaceState(null,'',location.pathname)}
  if(q.has('code')||q.has('error')){
    history.replaceState(null,'',location.pathname);
    if(q.has('error'))setTimeout(()=>toast('Strava connection was cancelled'),300);
    else if(q.get('state')&&q.get('state')===localStorage.getItem(OSTATE)){pendingCode=q.get('code');localStorage.removeItem(OSTATE)}
    else{$('#handoffCode').value=q.get('code');$('#handoff').classList.remove('hidden');document.body.classList.add('locked');$('#lock').style.display='none';return}
  }
  let p=null;try{p=JSON.parse(localStorage.getItem(STORE))}catch(e){}
  if(p&&p.enc)showLock();else{S=merge(p);start()}
}
boot();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
