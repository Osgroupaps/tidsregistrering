"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const prs=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addD=(s,n)=>{const d=prs(s);d.setDate(d.getDate()+n);return ymd(d)};
const mon=s=>{const d=prs(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const isoW=s=>{const d=prs(s);d.setDate(d.getDate()+3-((d.getDay()+6)%7));const w=new Date(d.getFullYear(),0,4);return 1+Math.round(((d-w)/864e5-3+((w.getDay()+6)%7))/7)};
const DAY=['man','tir','ons','tor','fre','lør','søn'],MON=['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
const dname=s=>{const d=prs(s);return DAY[(d.getDay()+6)%7]+' '+d.getDate()+'. '+MON[d.getMonth()].slice(0,3)};
const mname=ym=>MON[+ym.slice(5,7)-1]+' '+ym.slice(0,4);
const hm=m=>Math.floor(m/60)+':'+pad(Math.round(m%60));
const dec=m=>(Math.round(m/60*100)/100).toLocaleString('da-DK',{minimumFractionDigits:0,maximumFractionDigits:2});
const kr=v=>Math.round(v).toLocaleString('da-DK')+' kr.';
const todayS=()=>ymd(new Date());
const TARGET=37*60;
/* Afsender på bilag (ændres her, hvis firmaet skifter) */
const FIRMA={n:'OS Group ApS',cvr:'46161556',adr:'Søstrupvej 14, 4300 Holbæk'};
function parseDur(t){t=String(t||'').trim().toLowerCase().replace(',','.');if(!t)return 0;let m;
 if(m=t.match(/^(\d+):(\d{1,2})$/))return +m[1]*60+ +m[2];
 if(m=t.match(/^(\d+)\s*t(?:imer)?\s*(\d+)?\s*(?:m|min)?$/))return +m[1]*60+(+m[2]||0);
 if(m=t.match(/^(\d+)\s*m(?:in)?$/))return +m[1];
 if(/^\d+(\.\d+)?$/.test(t))return Math.round(parseFloat(t)*60);return 0}
function t2m(t){const a=(t||'').split(':');return a.length==2?+a[0]*60+ +a[1]:null}
const PALETTE=['#d9480f','#1c2630','#2b8a3e','#1971c2','#d99a00','#862e9c','#0c8599','#c92a2a'];
/* låsning: indeværende måned kan rettes af medarbejder indtil sidste dag i måneden kl. 18:00 */
const lastDay=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
const lockTime=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7)-1,lastDay(ym),18,0,0).getTime();
const isLocked=d=>Date.now()>=lockTime(d.slice(0,7));
const lockText=ym=>lastDay(ym)+'. '+MON[+ym.slice(5,7)-1]+' kl. 18:00';
const canEditE=d=>S.isAdmin||!isLocked(d);

let sb=null,uid=null,me=null;
const S={view:'tid',week:mon(todayS()),canWrite:true,isAdmin:false,projects:{},my:{},fetched:{},timer:null,names:{},emails:{},roles:{},members:[],adm:{},assignAll:{},admLoading:false,
 mm:todayS().slice(0,7),emp:{u:'',ym:todayS().slice(0,7)},rep:{ym:todayS().slice(0,7),u:'',c:'',rate:false},
 note:'',proj:'',err:'',ok:'',loaded:false,edT:null,offline:!navigator.onLine};
const uidn=()=>crypto.randomUUID();

/* ---------- data ---------- */
const fromRow=r=>({id:r.id,d:r.work_date,m:r.minutes,p:r.project_id,n:r.note||'',bl:r.billable,t0:(r.start_time||'').slice(0,5),t1:(r.end_time||'').slice(0,5)});
const toRow=(u,e)=>({id:e.id,user_id:u,project_id:e.p,work_date:e.d,minutes:e.m,note:e.n||'',billable:e.bl!==false,start_time:e.t0||null,end_time:e.t1||null});
const range=ym=>[ym+'-01',ym+'-'+pad(lastDay(ym))];
async function fetchAll(build){const out=[];for(let from=0;;from+=1000){const {data,error}=await build().range(from,from+999);if(error)throw error;out.push(...data);if(data.length<1000)break}return out}
async function loadMonth(ym){const [a,b]=range(ym);const rows=await fetchAll(()=>sb.from('time_entries').select('*').eq('user_id',uid).gte('work_date',a).lte('work_date',b).order('work_date'));const o={};rows.forEach(r=>o[r.id]=fromRow(r));S.my[ym]=o}
function watchMonth(ym){if(S.fetched[ym]||!sb)return;S.fetched[ym]=1;loadMonth(ym).then(render).catch(e=>{S.fetched[ym]=0;S.err=errText(e);render()})}
function allMy(){const a=[];for(const ym in S.my)for(const id in S.my[ym])a.push(Object.assign({id},S.my[ym][id]));return a}
const proj=id=>S.projects[id]||{name:'(projekt fjernet)',client:'',rate:0,color:'#9aa5ab'};
async function reload(u,ym){if(u===uid)await loadMonth(ym);else await refreshAdm(u,ym)}
async function refreshAdm(u,ym){const [a,b]=range(ym);const rows=await fetchAll(()=>sb.from('time_entries').select('*').eq('user_id',u).gte('work_date',a).lte('work_date',b).order('work_date'));const o={};rows.forEach(r=>o[r.id]=fromRow(r));(S.adm[ym]=S.adm[ym]||{})[u]=o}
async function saveEntry(u,e,oldYm){const {error}=await sb.from('time_entries').upsert(toRow(u,e));if(error)throw error;const ym=e.d.slice(0,7);await reload(u,ym);if(oldYm&&oldYm!==ym)await reload(u,oldYm)}
async function delEntry(u,ym,id){const {error,count}=await sb.from('time_entries').delete({count:'exact'}).eq('id',id);if(error)throw error;if(count===0)throw new Error('Registreringen kunne ikke slettes (måneden er låst).');await reload(u,ym)}
function errText(e){const m=(e&&e.message)||String(e);if(e&&(e.code==='42501'||/row-level security/i.test(m)))return 'Det er ikke tilladt: måneden er låst, eller du har ikke adgang til projektet.';if(e&&e.code==='23503')return 'Kan ikke slettes, fordi der findes registreringer. Sæt projektet til inaktivt i stedet.';if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Ingen forbindelse. Tjek internettet og prøv igen.';return m}
async function guard(fn){try{S.err='';await fn()}catch(e){S.err='Handlingen mislykkedes: '+errText(e)}render()}
const nm=u=>S.names[u]||S.emails[u]||(u===uid?'Mig':'Medarbejder');

/* ---------- timer ---------- */
async function loadTimer(){const {data}=await sb.from('timers').select('*').eq('user_id',uid).maybeSingle();S.timer=data?{p:data.project_id,n:data.note||'',start:Date.parse(data.started_at)}:null;if(S.timer)S.proj=S.timer.p}
async function startTimer(){const p=S.proj;if(!p){S.err='Vælg et projekt først.';return render()}
 await guard(async()=>{const {error}=await sb.from('timers').upsert({user_id:uid,project_id:p,note:S.note||'',started_at:new Date().toISOString()});if(error)throw error;await loadTimer()})}
async function stopTimer(){const t=S.timer;if(!t)return;const mins=Math.max(1,Math.round((Date.now()-t.start)/60000));const st=new Date(t.start);
 await guard(async()=>{await saveEntry(uid,{id:uidn(),d:ymd(st),m:Math.min(mins,1440),p:t.p,n:t.n||'',bl:true,t0:pad(st.getHours())+':'+pad(st.getMinutes())});const {error}=await sb.from('timers').delete().eq('user_id',uid);if(error)throw error;S.timer=null;S.note=''})}

/* ---------- modal: registrering ---------- */
const projOptions=sel=>Object.keys(S.projects).filter(k=>S.projects[k].active!==false||k===sel).sort((a,b)=>S.projects[a].name.localeCompare(S.projects[b].name,'da'));
function openEntry(e,u){e=e||{};u=u||uid;const isNew=!e.id;const projs=projOptions(e.p);
 const cur=Object.assign({d:todayS(),p:S.proj&&S.projects[S.proj]?S.proj:projs[0]||'',m:0,n:'',bl:true},e);const locked=!canEditE(cur.d);
 S.edT=u;
 $('#modal').innerHTML=`<div class="ov" data-act="mclose"><div class="md" role="dialog" aria-modal="true">
 <h2>${isNew?'Ny tidsregistrering':'Redigér registrering'}</h2>${u!==uid?'<div class="mu" style="margin-top:4px">For '+esc(nm(u))+'</div>':''}${locked?'<div class="inf" style="margin-top:10px">🔒 '+esc(mname(cur.d.slice(0,7)))+' er låst for redigering. Kontakt administrator, hvis noget skal rettes.</div>':''}
 <label for="ed">Dato</label><input id="ed" type="date" class="fl" value="${esc(cur.d)}" ${locked?'disabled':''}>
 <label for="ep">Projekt</label><select id="ep" class="fl" ${locked?'disabled':''}>${projs.map(k=>`<option value="${k}" ${k===cur.p?'selected':''}>${esc(S.projects[k].client?S.projects[k].client+' – ':'')+esc(S.projects[k].name)}</option>`).join('')}</select>
 <div class="g2"><div><label for="e0">Fra</label><input id="e0" type="time" class="fl" value="${esc(cur.t0||'')}" ${locked?'disabled':''}></div><div><label for="e1">Til</label><input id="e1" type="time" class="fl" value="${esc(cur.t1||'')}" ${locked?'disabled':''}></div></div>
 <label for="em">Varighed (fx 7,5 eller 7:30)</label><input id="em" class="fl" inputmode="decimal" value="${cur.m?esc(hm(cur.m)):''}" ${locked?'disabled':''}>
 <label for="en">Beskrivelse</label><textarea id="en" class="fl" rows="2" ${locked?'disabled':''}>${esc(cur.n||'')}</textarea>
 <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);text-transform:none;letter-spacing:0"><input id="eb" type="checkbox" ${cur.bl!==false?'checked':''} ${locked?'disabled':''}> Fakturerbar</label>
 <div id="merr"></div><div class="row" style="margin-top:16px"><button class="b a" data-act="msave" ${locked?'disabled':''}>Gem</button><button class="b" data-act="mclose">Annullér</button><span class="sp1"></span>${!isNew&&!locked?'<button class="b d" data-act="mdel">Slet</button>':''}</div></div></div>`;
 S.editing=cur;
 const calc=()=>{const a=t2m($('#e0').value),b=t2m($('#e1').value);if(a!=null&&b!=null&&b>a)$('#em').value=hm(b-a)};$('#e0').oninput=calc;$('#e1').oninput=calc}
function closeModal(){$('#modal').innerHTML='';S.editing=null}
async function saveModal(){const c=S.editing,u=S.edT;const m=parseDur($('#em').value);const d=$('#ed').value,p=$('#ep').value;
 if(!d||!p||!m){$('#merr').innerHTML='<div class="err">Udfyld dato, projekt og varighed.</div>';return}
 if(m>24*60){$('#merr').innerHTML='<div class="err">Varighed kan ikke være over 24 timer.</div>';return}
 if(!canEditE(d)){$('#merr').innerHTML='<div class="err">Datoen ligger i en låst måned.</div>';return}
 const e={id:c.id||uidn(),d,p,m,n:$('#en').value.trim(),bl:$('#eb').checked,t0:$('#e0').value||'',t1:$('#e1').value||''};
 S.proj=p;closeModal();await guard(async()=>{await saveEntry(u,e,c.id?c.d.slice(0,7):null)})}

/* ---------- fælles visning ---------- */
function entryRow(e,u){const p=proj(e.p),lk=!canEditE(e.d);return `<div class="ent"><span class="dot" style="background:${esc(p.color||'#9aa5ab')}"></span><div class="sp1"><b>${esc(p.name)}</b> <span class="mu">${esc(p.client||'')}</span><div class="mu">${esc(e.n||'')}${e.t0&&e.t1?' · '+esc(e.t0)+'–'+esc(e.t1):''}${e.bl===false?' · ikke fakturerbar':''}</div></div>${lk?'<span class="chip">🔒 Låst</span>':''}<span class="t">${hm(e.m)}</span><button class="b s" data-act="edit" data-id="${e.id}" data-d="${e.d}" data-u="${u||uid}">${lk?'Se':'Redigér'}</button></div>`}
function hm2(ms){const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/3600)+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60)}
function lockInfo(ym){if(S.isAdmin)return '';return isLocked(ym+'-01')?`<div class="inf">🔒 ${esc(mname(ym))} er låst for redigering.</div>`:`<div class="inf">${esc(mname(ym))} kan rettes indtil ${esc(lockText(ym))}. Herefter låses måneden.</div>`}
function weekEntries(w){const d6=addD(w,6);[w.slice(0,7),d6.slice(0,7)].forEach(watchMonth);return allMy().filter(e=>e.d>=w&&e.d<=d6)}
const CRANE=`<svg class="crane" viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#1c2630" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
<rect x="0" y="176" width="220" height="14" fill="#3a4757" stroke="none"/><rect x="82" y="170" width="40" height="8" fill="#fbbf24"/>
<g fill="none" stroke="#fbbf24" stroke-width="2"><path d="M94 170V40M110 170V40"/><path d="M94 170L110 150L94 130L110 110L94 90L110 70L94 50"/><path d="M110 170L94 150L110 130L94 110L110 90L94 70L110 50"/></g>
<path d="M102 8L30 36H178Z" fill="none" stroke="#fbbf24" stroke-width="1.6"/><rect x="14" y="34" width="190" height="8" rx="2" fill="#fbbf24"/><g fill="none" stroke="#1c2630" stroke-width="1.2"><path d="M30 42L44 34L58 42L72 34L86 42M118 42L132 34L146 42L160 34L174 42L188 34"/></g>
<rect x="8" y="42" width="26" height="22" fill="#6b7785"/><rect x="92" y="44" width="20" height="14" rx="2" fill="#fff"/><rect x="96" y="47" width="12" height="7" fill="#9cc7e8" stroke="none"/>
<path d="M102 8V2" stroke="#fbbf24"/><path d="M102 2L112 5L102 8" fill="#d9480f" stroke="none"/>
<rect x="148" y="42" width="12" height="6" fill="#33414f"/><path d="M154 48V112" stroke="#fff" stroke-width="1.2"/><path d="M154 112c0 6 6 6 6 12" fill="none" stroke="#fbbf24" stroke-width="2.4"/>
<path d="M141 124H167L163 142H145Z" fill="#d9480f"/><path d="M141 124L154 112L167 124" fill="none" stroke="#fff" stroke-width="1"/></g></svg>`,HAT=`<svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true"><path d="M6 36C6 18 18 8 32 8s26 10 26 28Z" fill="#fbbf24" stroke="#1c2630" stroke-width="2.4" stroke-linejoin="round"/><rect x="2" y="34" width="60" height="7" rx="3.5" fill="#f0a500" stroke="#1c2630" stroke-width="2.4"/><rect x="27" y="5" width="10" height="26" rx="3" fill="#d9480f" stroke="#1c2630" stroke-width="2"/></svg>`,SKY=`<svg class="sky" viewBox="0 0 900 190" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><symbol id="cr" viewBox="0 0 220 190"><g stroke="#33414f" stroke-width="2" stroke-linecap="round" fill="none"><path d="M94 188V40M110 188V40M94 188L110 160L94 132L110 104L94 76L110 48"/><path d="M102 8L30 36H178Z"/><rect x="14" y="34" width="190" height="8" fill="#e8dfcf"/><path d="M154 42V112"/></g><rect x="8" y="42" width="26" height="20" fill="#cfc4ae"/><path d="M141 120H167L163 138H145Z" fill="#d9480f" opacity=".85"/></symbol></defs><g transform="translate(0,60)">
<g fill="#e8dfcf" stroke="none"><rect x="0" y="116" width="900" height="14"/></g>
<g stroke="#cdbf9f" stroke-width="2" fill="none"><rect x="70" y="52" width="86" height="64"/><path d="M70 73H156M70 94H156M98 52V116M127 52V116"/><rect x="300" y="30" width="70" height="86"/><path d="M300 52H370M300 73H370M300 94H370M323 30V116M347 30V116"/><rect x="560" y="64" width="110" height="52"/><path d="M560 82H670M560 100H670M597 64V116M633 64V116"/></g>
<use href="#cr" x="150" y="-34" width="170" height="150"/><use href="#cr" x="610" y="-26" width="160" height="142"/>
<g><rect x="430" y="96" width="46" height="18" fill="#fbbf24"/><path d="M476 100h18l8 10v4h-26Z" fill="#fbbf24"/><circle cx="444" cy="116" r="7" fill="#33414f"/><circle cx="488" cy="116" r="7" fill="#33414f"/><path d="M432 96l-6-12h40l-4 12" fill="#d9480f"/></g>
<g><path d="M760 116h50l8-8h-60Z" fill="#33414f"/><rect x="772" y="92" width="26" height="16" fill="#fbbf24"/><path d="M772 98L742 70l-8 6 30 30" fill="none" stroke="#fbbf24" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M734 76l-8-6 6 14Z" fill="#d9480f"/></g></g></svg>`;
const noProj=()=>`<div class="inf">${S.isAdmin?'Opret først et projekt under “Projekter”.':'Du er endnu ikke tildelt nogen projekter. Kontakt administrator.'}</div>`;

function vTid(){const t=S.timer,td=todayS(),wk=mon(td);const projs=projOptions(t?t.p:'');
 const mine=allMy().filter(e=>e.d===td).sort((a,b)=>(a.t0||'').localeCompare(b.t0||''));const tot=mine.reduce((s,e)=>s+e.m,0);
 const we=weekEntries(wk),wt=we.reduce((s,e)=>s+e.m,0),wb=we.filter(e=>e.bl!==false).reduce((s,e)=>s+e.m,0);
 const opts=projs.map(k=>`<option value="${k}" ${(t?t.p:S.proj)===k?'selected':''}>${esc(S.projects[k].client?S.projects[k].client+' – ':'')+esc(S.projects[k].name)}</option>`).join('');
 const hr=new Date().getHours(),gr=hr<10?'God morgen':hr<17?'Goddag':'God aften';const fn=(S.names[uid]||'').split(' ')[0];
 const days=[...Array(7)].map((_,i)=>addD(wk,i)),dm=days.map(d=>we.filter(e=>e.d===d).reduce((s,e)=>s+e.m,0)),mx=Math.max(...dm,TARGET/5);
 let h=`<h1 style="font-size:26px;font-weight:750;margin:6px 2px 16px;letter-spacing:-.02em">${gr}${fn&&fn!=='Mig'?', '+esc(fn):''} 👷</h1>
 <div class="card hero">${CRANE}<div class="row" style="position:relative;z-index:1"><div class="sp1"><div class="mu">${t?'<span class="live"></span>Timer kører':'Klar til at starte'}</div><div class="tmr" id="tmr" style="margin-top:6px">${t?hm2(Date.now()-t.start):'0:00:00'}</div></div>${t?'<button class="b d" data-act="stop" style="padding:15px 28px;font-size:16px;border-radius:16px">■ Stop</button>':'<button class="b a" data-act="start" style="padding:15px 28px;font-size:16px;border-radius:16px" '+(S.canWrite&&projs.length?'':'disabled')+'>▶ Start</button>'}</div>
 <div class="g2" style="position:relative;z-index:1"><div><label for="tp">Projekt</label><select id="tp" class="fl" ${t?'disabled':''}><option value="">Vælg projekt …</option>${opts}</select></div><div><label for="tn">Hvad arbejder du på?</label><input id="tn" class="fl" value="${esc(t?t.n:S.note)}" ${t?'disabled':''} placeholder="Beskrivelse (valgfri)"></div></div></div>`;
 if(!projs.length)h+=noProj();
 h+=`<div class="kpis"><div class="kpi"><span>I dag</span><b>${hm(tot)}</b></div><div class="kpi"><span>Denne uge</span><b>${hm(wt)}<small style="font-size:13px;color:var(--mu);font-weight:600"> / ${hm(TARGET)}</small></b></div><div class="kpi"><span>Fakturerbart</span><b>${wt?Math.round(wb/wt*100):0}%</b></div></div>
 <div class="card"><div class="row"><h2 class="sp1">Ugens forløb</h2><span class="mu">Uge ${isoW(wk)}</span></div><div class="wbars" style="margin-top:14px">${days.map((d,i)=>`<div class="${d===td?'now':''}"><i style="height:${Math.max(4,dm[i]/mx*70)}px" title="${hm(dm[i])}"></i>${DAY[i]}</div>`).join('')}</div></div>
 <div class="card"><div class="row"><h2 class="sp1">I dag</h2><button class="b a s" data-act="new" ${S.canWrite&&projs.length?'':'disabled'}>+ Tilføj tid</button></div>${mine.length?mine.map(e=>entryRow(e)).join(''):'<div class="empty">'+HAT+'<br>Ingen registreringer endnu i dag.</div>'}</div>`;return h}

function vUge(){const w=S.week,days=[...Array(7)].map((_,i)=>addD(w,i));
 const all=weekEntries(w);const tot=all.reduce((s,e)=>s+e.m,0);
 const pids=[...new Set(all.map(e=>e.p))].sort((a,b)=>proj(a).name.localeCompare(proj(b).name,'da'));const td=todayS();
 let h=`<div class="card"><div class="row"><button class="b s" data-act="wk" data-n="-7" aria-label="Forrige uge">‹</button><h2 class="sp1" style="text-align:center">Uge ${isoW(w)} <span class="mu" style="font-weight:500;font-size:14px">${dname(w)} – ${dname(days[6])}</span></h2><button class="b s" data-act="wk" data-n="7" aria-label="Næste uge">›</button></div>
 <div class="row" style="margin-top:14px"><b style="font-size:22px">${hm(tot)}</b><span class="mu">af ${hm(TARGET)} t</span></div><div class="bar" style="margin-top:10px"><i style="width:${Math.min(100,tot/TARGET*100)}%"></i></div></div>`;
 h+=[...new Set([w.slice(0,7),days[6].slice(0,7)])].map(lockInfo).join('');
 h+=`<div class="card"><div class="sc"><table class="grid"><thead><tr><th>Projekt</th>${days.map(d=>`<th class="${d===td?'td':''}">${dname(d).split(' ')[0]}<br><span style="font-weight:500">${prs(d).getDate()}.</span></th>`).join('')}<th class="n">I alt</th></tr></thead><tbody>
 ${pids.map(p=>{const pe=all.filter(e=>e.p===p),pt=pe.reduce((s,e)=>s+e.m,0);return `<tr><td><span class="dot" style="display:inline-block;background:${esc(proj(p).color||'#999')};margin-right:8px"></span><b>${esc(proj(p).name)}</b><div class="mu" style="margin-left:18px">${esc(proj(p).client||'')}</div></td>${days.map(d=>{const m=pe.filter(e=>e.d===d).reduce((s,e)=>s+e.m,0);const ok=canEditE(d);return `<td class="${ok?'c':''} ${m?'':'z'} ${d===td?'td':''}" ${ok?`data-act="new" data-d="${d}" data-p="${p}"`:''}>${m?hm(m):'·'}</td>`}).join('')}<td class="n"><b>${hm(pt)}</b></td></tr>`}).join('')||`<tr><td colspan="9" class="empty">Ingen timer i denne uge endnu.</td></tr>`}</tbody>
 <tfoot><tr><td>I alt</td>${days.map(d=>{const m=all.filter(e=>e.d===d).reduce((s,e)=>s+e.m,0);return `<td class="${d===td?'td':''}">${m?hm(m):''}</td>`}).join('')}<td class="n">${hm(tot)}</td></tr></tfoot></table></div></div>`;
 days.forEach(d=>{const es=all.filter(e=>e.d===d).sort((a,b)=>(a.t0||'').localeCompare(b.t0||''));if(!es.length)return;const dt=es.reduce((s,e)=>s+e.m,0);
  h+=`<div class="card"><div class="row"><h3 class="sp1">${dname(d)}${d===td?' <span class="pill">I dag</span>':''}</h3><span class="mu">${hm(dt)} t</span>${canEditE(d)?`<button class="b s" data-act="new" data-d="${d}">+</button>`:''}</div>${es.map(e=>entryRow(e)).join('')}</div>`});return h}

function vMaaned(){const ym=S.mm;watchMonth(ym);const es=allMy().filter(e=>e.d.slice(0,7)===ym).sort((a,b)=>a.d.localeCompare(b.d)||(a.t0||'').localeCompare(b.t0||''));
 const tot=es.reduce((s,e)=>s+e.m,0);const byP={};es.forEach(e=>byP[e.p]=(byP[e.p]||0)+e.m);const [y,mo]=ym.split('-').map(Number);const prev=mo==1?(y-1)+'-12':y+'-'+pad(mo-1),next=mo==12?(y+1)+'-01':y+'-'+pad(mo+1);
 let h=`<div class="card"><div class="row"><button class="b s" data-act="mm" data-v="${prev}" aria-label="Forrige måned">‹</button><h2 class="sp1" style="text-align:center;text-transform:capitalize">${esc(mname(ym))}</h2><button class="b s" data-act="mm" data-v="${next}" aria-label="Næste måned">›</button></div>
 <div class="row" style="margin-top:14px"><b style="font-size:22px">${hm(tot)}</b><span class="mu">timer i alt</span></div>${Object.keys(byP).map(p=>`<div class="row" style="margin-top:8px"><span class="dot" style="background:${esc(proj(p).color||'#999')}"></span><span class="sp1">${esc(proj(p).name)} <span class="mu">${esc(proj(p).client||'')}</span></span><b>${hm(byP[p])}</b></div>`).join('')}</div>`+lockInfo(ym);
 const byD={};es.forEach(e=>(byD[e.d]=byD[e.d]||[]).push(e));
 Object.keys(byD).sort().forEach(d=>{h+=`<div class="card"><div class="row"><h3 class="sp1">${dname(d)}</h3><span class="mu">${hm(byD[d].reduce((s,e)=>s+e.m,0))} t</span></div>${byD[d].map(e=>entryRow(e)).join('')}</div>`});
 if(!es.length)h+='<div class="card empty">'+HAT+'<br>Ingen registreringer i denne måned.</div>';return h}

/* ----- admin: medarbejdere ----- */
/* ----- admin: data ----- */
async function loadBase(){
 const ps=await fetchAll(()=>sb.from('projects').select('*').order('name'));S.projects={};ps.forEach(p=>S.projects[p.id]={name:p.name,client:p.client||'',cvr:p.cvr||'',color:p.color||'#d9480f',active:p.active});
 if(S.isAdmin){const rs=await fetchAll(()=>sb.from('project_rates').select('*'));rs.forEach(r=>{if(S.projects[r.project_id])S.projects[r.project_id].rate=Number(r.rate)});
  const pr=await fetchAll(()=>sb.from('profiles').select('*').order('name'));S.members=pr.map(p=>p.id);pr.forEach(p=>{S.names[p.id]=p.name||'';S.emails[p.id]=p.email;S.roles[p.id]=p.role});
  const as=await fetchAll(()=>sb.from('assignments').select('*'));S.assignAll={};as.forEach(a=>(S.assignAll[a.user_id]=S.assignAll[a.user_id]||{})[a.project_id]=true)}}
async function loadAdmin(months){S.admLoading=true;render();
 try{await loadBase();
  for(const ym of months){const [a,b]=range(ym);const rows=await fetchAll(()=>sb.from('time_entries').select('*').gte('work_date',a).lte('work_date',b).order('work_date'));const g={};S.members.forEach(u=>g[u]={});rows.forEach(r=>{(g[r.user_id]=g[r.user_id]||{})[r.id]=fromRow(r)});S.adm[ym]=g}}
 catch(e){S.err='Kunne ikke hente medarbejdernes timer: '+errText(e)}S.admLoading=false;render()}
function vEmp(){const r=S.emp;let h=`<div class="card"><h2>Medarbejdernes timer</h2><div class="g2"><div><label for="eu">Medarbejder</label><select id="eu" class="fl"><option value="">Vælg …</option>${S.members.map(u=>`<option value="${u}" ${r.u===u?'selected':''}>${esc(nm(u))}</option>`).join('')}</select></div><div><label for="ey">Måned</label><input id="ey" type="month" class="fl" value="${r.ym}"></div></div><div class="row" style="margin-top:14px"><button class="b a" data-act="eload">Hent</button>${r.u?'<button class="b" data-act="eadd">+ Tilføj tid for medarbejder</button>':''}</div></div>`;
 if(S.admLoading)return h+'<div class="empty">Henter …</div>';
 if(!r.u)return h+'<div class="empty">Vælg en medarbejder og en måned.</div>';
 const items=((S.adm[r.ym]||{})[r.u])||null;if(!items)return h+'<div class="empty">Tryk “Hent”.</div>';
 const es=Object.keys(items).map(id=>Object.assign({id},items[id])).sort((a,b)=>a.d.localeCompare(b.d)||(a.t0||'').localeCompare(b.t0||''));const tot=es.reduce((s,e)=>s+e.m,0);
 h+=`<div class="card"><div class="row"><h3 class="sp1">${esc(nm(r.u))} · ${esc(mname(r.ym))}</h3><b>${hm(tot)} t</b></div><div class="mu" style="margin-top:4px">${isLocked(r.ym+'-01')?'🔒 Låst for medarbejderen – du kan stadig rette.':'Åben for medarbejderen indtil '+esc(lockText(r.ym))+'.'}</div></div>`;
 const byD={};es.forEach(e=>(byD[e.d]=byD[e.d]||[]).push(e));
 Object.keys(byD).sort().forEach(d=>{h+=`<div class="card"><div class="row"><h3 class="sp1">${dname(d)}</h3><span class="mu">${hm(byD[d].reduce((s,e)=>s+e.m,0))} t</span></div>${byD[d].map(e=>entryRow(e,r.u)).join('')}</div>`});
 if(!es.length)h+='<div class="card empty">Ingen registreringer.</div>';return h}

/* ----- admin: projekter ----- */
function vProj(){const ps=Object.keys(S.projects).sort((a,b)=>S.projects[a].name.localeCompare(S.projects[b].name,'da'));
 let h=`<div class="row" style="margin:6px 2px 16px"><h1 class="sp1" style="font-size:26px;font-weight:750;letter-spacing:-.02em">Projekter</h1><button class="b a" data-act="pnew">+ Nyt projekt</button></div>`;
 h+=ps.length?`<div class="pg">${ps.map(k=>{const p=S.projects[k];const who=S.members.filter(u=>(S.assignAll[u]||{})[k]);return `<div class="pc"><div class="row"><span class="dot" style="background:${esc(p.color||'#999')}"></span><b class="sp1">${esc(p.name)}</b>${p.active===false?'<span class="chip">Inaktiv</span>':''}</div><div class="mu" style="margin:4px 0 10px 20px">${esc(p.client||'Ingen kunde')}${p.cvr?' · CVR '+esc(p.cvr):''}<br>${p.rate?kr(p.rate)+' pr. time':'Ingen timepris'}</div><div class="mu" style="margin-bottom:12px"><b>Medarbejdere:</b> ${who.length?who.map(u=>esc(nm(u))).join(', '):'ingen tildelt'}</div><button class="b s" data-act="pedit" data-id="${k}">Redigér</button></div>`}).join('')}</div>`:'<div class="card empty">'+HAT+'<br>Ingen projekter endnu.</div>';return h}
function openProj(id){const p=id?S.projects[id]:{name:'',client:'',cvr:'',rate:'',active:true};
 $('#modal').innerHTML=`<div class="ov" data-act="mclose"><div class="md" role="dialog" aria-modal="true"><h2>${id?'Redigér projekt':'Nyt projekt'}</h2>
 <label for="pn">Projektnavn</label><input id="pn" class="fl" value="${esc(p.name)}"><div class="g2"><div><label for="pc">Kunde</label><input id="pc" class="fl" value="${esc(p.client||'')}"></div><div><label for="pv">Kundens CVR</label><input id="pv" class="fl" inputmode="numeric" value="${esc(p.cvr||'')}"></div></div>
 <label for="pr">Timepris (kr., kun synlig for administratorer)</label><input id="pr" class="fl" inputmode="numeric" value="${esc(p.rate||'')}">
 <label>Tildelte medarbejdere</label><div id="pm">${S.members.length?S.members.map(u=>`<label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);text-transform:none;letter-spacing:0;margin:6px 0"><input type="checkbox" data-u="${u}" ${id&&(S.assignAll[u]||{})[id]?'checked':''}> ${esc(nm(u))}</label>`).join(''):'<div class="mu">Ingen medarbejdere endnu. De vises her, når de har åbnet siden første gang.</div>'}</div>
 <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);text-transform:none;letter-spacing:0;margin-top:14px"><input id="pa" type="checkbox" ${p.active!==false?'checked':''}> Aktivt (kan registreres på)</label>
 <div id="merr"></div><div class="row" style="margin-top:16px"><button class="b a" data-act="psave" data-id="${id||''}">Gem</button><button class="b" data-act="mclose">Annullér</button><span class="sp1"></span>${id?'<button class="b d" data-act="pdel" data-id="'+id+'">Slet</button>':''}</div></div></div>`}
async function saveProj(id){const n=$('#pn').value.trim();if(!n){$('#merr').innerHTML='<div class="err">Angiv et projektnavn.</div>';return}
 const k=id||uidn();const col=(S.projects[id]||{}).color||PALETTE[Object.keys(S.projects).length%PALETTE.length];
 const o={id:k,name:n,client:$('#pc').value.trim(),cvr:$('#pv').value.replace(/\D/g,''),active:$('#pa').checked,color:col};const rate=Number($('#pr').value.replace(',','.'))||0;
 const chosen={};document.querySelectorAll('#pm input[data-u]').forEach(c=>chosen[c.dataset.u]=c.checked);
 closeModal();await guard(async()=>{let r=await sb.from('projects').upsert(o);if(r.error)throw r.error;r=await sb.from('project_rates').upsert({project_id:k,rate});if(r.error)throw r.error;
  const add=[],del=[];for(const u of S.members){const had=!!(S.assignAll[u]||{})[k],want=!!chosen[u];if(want&&!had)add.push({user_id:u,project_id:k});if(!want&&had)del.push(u)}
  if(add.length){r=await sb.from('assignments').insert(add);if(r.error)throw r.error}
  for(const u of del){r=await sb.from('assignments').delete().eq('user_id',u).eq('project_id',k);if(r.error)throw r.error}
  await loadBase()})}
async function delProj(id){const {error}=await sb.from('projects').delete().eq('id',id);if(error)throw error;await loadBase()}
/* ----- admin: rapport, bilag, Dinero ----- */
function repRows(){const r=S.rep,rows=[];const d=S.adm[r.ym]||{};
 for(const u in d){if(r.u&&r.u!==u)continue;for(const id in d[u]){const e=d[u][id];const p=proj(e.p);if(r.c&&(p.client||'')!==r.c)continue;rows.push(Object.assign({id,u},e))}}
 return rows.sort((a,b)=>a.d.localeCompare(b.d)||(a.t0||'').localeCompare(b.t0||''))}
const amount=e=>e.bl===false?0:e.m/60*(proj(e.p).rate||0);
function clients(){return [...new Set(Object.values(S.projects).map(p=>p.client||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'da'))}
function vRep(){const r=S.rep;const loaded=!!S.adm[r.ym];
 let h=`<div class="card"><h2>Rapport og bilag</h2><div class="g2"><div><label for="ry">Måned</label><input id="ry" type="month" class="fl" value="${r.ym}"></div><div><label for="ru">Medarbejder</label><select id="ru" class="fl"><option value="">Alle</option>${S.members.map(u=>`<option value="${u}" ${r.u===u?'selected':''}>${esc(nm(u))}</option>`).join('')}</select></div>
 <div><label for="rc">Kunde</label><select id="rc" class="fl"><option value="">Alle</option>${clients().map(c=>`<option ${r.c===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div></div>
 <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);text-transform:none;letter-spacing:0;margin-top:14px"><input id="rr" type="checkbox" ${r.rate?'checked':''}> Vis timepris og beløb på bilaget</label>
 <div class="row" style="margin-top:14px"><button class="b a" data-act="rload">${loaded?'Opdatér':'Hent data'}</button><button class="b p" data-act="pdf" ${loaded?'':'disabled'}>Bilag (PDF)</button><button class="b" data-act="dinero" ${loaded?'':'disabled'}>Til Dinero (CSV)</button><button class="b" data-act="csv" ${loaded?'':'disabled'}>Detaljer (CSV)</button></div></div>`;
 if(S.admLoading)return h+'<div class="empty">Henter …</div>';if(!loaded)return h+'<div class="empty">Tryk “Hent data” for at se rapporten.</div>';
 const rows=repRows();const g={};rows.forEach(e=>{const p=proj(e.p),k=e.u+'|'+e.p;const o=g[k]=g[k]||{u:e.u,p:e.p,m:0,b:0,a:0};o.m+=e.m;if(e.bl!==false)o.b+=e.m;o.a+=amount(e)});
 const keys=Object.keys(g).sort((a,b)=>nm(g[a].u).localeCompare(nm(g[b].u),'da')||proj(g[a].p).name.localeCompare(proj(g[b].p).name,'da'));const tot=keys.reduce((s,k)=>({m:s.m+g[k].m,b:s.b+g[k].b,a:s.a+g[k].a}),{m:0,b:0,a:0});
 h+=`<div class="card"><div class="row"><h3 class="sp1">${esc(mname(r.ym))}</h3><span class="mu">${rows.length} registreringer</span></div>${keys.length?`<div class="sc"><table><tr><th>Medarbejder</th><th>Kunde</th><th>Projekt</th><th class="n">Timer</th><th class="n">Fakturerbare</th><th class="n">Timepris</th><th class="n">Beløb</th></tr>${keys.map(k=>{const o=g[k],p=proj(o.p);return `<tr><td>${esc(nm(o.u))}</td><td>${esc(p.client||'')}</td><td>${esc(p.name)}</td><td class="n">${dec(o.m)}</td><td class="n">${dec(o.b)}</td><td class="n">${p.rate?kr(p.rate):'–'}</td><td class="n">${kr(o.a)}</td></tr>`}).join('')}<tr><td colspan="3"><b>I alt</b></td><td class="n"><b>${dec(tot.m)}</b></td><td class="n"><b>${dec(tot.b)}</b></td><td></td><td class="n"><b>${kr(tot.a)}</b></td></tr></table></div>`:'<div class="empty">Ingen registreringer matcher.</div>'}</div>`;return h}
function syncRep(){const g=id=>$('#'+id)?$('#'+id).value:undefined;const r=S.rep;[['ry','ym'],['ru','u'],['rc','c']].forEach(x=>{const v=g(x[0]);if(v!==undefined)r[x[1]]=v});if($('#rr'))r.rate=$('#rr').checked}
const n2=v=>String(Math.round(v*100)/100).replace('.',',');
async function saveFile(filename,data){try{const type=filename.endsWith('.pdf')?'application/pdf':'text/csv;charset=utf-8';const blob=new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}catch(e){S.err='Kunne ikke gemme filen.';render()}}
const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
function csvDetail(){const rows=repRows();const out=[['Dato','Medarbejder','Kunde','Projekt','Beskrivelse','Timer','Fakturerbar','Timepris','Beløb'].map(q).join(';')];
 rows.forEach(e=>{const p=proj(e.p);out.push([q(e.d),q(nm(e.u)),q(p.client||''),q(p.name),q(e.n||''),n2(e.m/60),q(e.bl===false?'Nej':'Ja'),n2(p.rate||0),n2(amount(e))].join(';'))});return '﻿'+out.join('\r\n')}
function csvDinero(){const rows=repRows().filter(e=>e.bl!==false);const g={};rows.forEach(e=>{const p=proj(e.p),k=(p.client||'')+'|'+e.u+'|'+e.p;const o=g[k]=g[k]||{c:p.client||'',cvr:p.cvr||'',u:e.u,p:e.p,m:0};o.m+=e.m});
 const out=[['Kunde','CVR','Beskrivelse','Antal','Enhed','Stykpris ekskl. moms','Beløb ekskl. moms','Periode'].map(q).join(';')];
 Object.keys(g).sort().forEach(k=>{const o=g[k],p=proj(o.p),h=o.m/60;out.push([q(o.c),q(o.cvr),q(nm(o.u)+' – '+p.name+' – '+mname(S.rep.ym)),n2(h),q('timer'),n2(p.rate||0),n2(h*(p.rate||0)),q(S.rep.ym)].join(';'))});return '﻿'+out.join('\r\n')}

/* ----- PDF (bilag) ----- */
function cp(s){let o='';for(const ch of String(s)){let c=ch.charCodeAt(0);if(c===0x2013||c===0x2014)c=0x96;else if(c===0x2019)c=0x92;else if(c>255)c=63;o+=String.fromCharCode(c)}return o}
const pesc=s=>s.replace(/[\\()]/g,m=>'\\'+m);
function tw(s,sz,b){let w=0;for(const c of String(s)){w+=/[0-9]/.test(c)?.556:' .,:;|!'.includes(c)?.278:/[ijl]/.test(c)?.23:/[ftrI]/.test(c)?.32:/[mwMW]/.test(c)?.85:/[A-Z]/.test(c)?.69:.54}return w*sz*(b?1.06:1)}
function wrap(s,sz,maxw){const words=String(s).split(/\s+/),lines=[];let cur='';for(const w of words){const t=cur?cur+' '+w:w;if(tw(t,sz)<=maxw||!cur)cur=t;else{lines.push(cur);cur=w}}if(cur)lines.push(cur);return lines.length?lines:['']}
function mkPdf(){const pages=[];let cur=null;
 const A={np(){cur=[];pages.push(cur);return cur},
  text(x,y,s,sz,o){o=o||{};if(o.al==='r')x-=tw(s,sz,o.b);cur.push(`BT /${o.b?'F2':'F1'} ${sz} Tf ${(o.c||[0,0,0]).join(' ')} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${pesc(cp(s))}) Tj ET`)},
  line(x1,y1,x2,y2,c,w){cur.push(`${(c||[.85,.85,.85]).join(' ')} RG ${w||.5} w ${x1} ${y1} m ${x2} ${y2} l S`)},
  rect(x,y,w,h,c){cur.push(`${c.join(' ')} rg ${x} ${y} ${w} ${h} re f`)},
  count:()=>pages.length,
  footers(label){pages.forEach((p,i)=>{cur=p;A.line(50,48,545,48);A.text(50,34,label,8,{c:[.45,.5,.5]});A.text(545,34,'Side '+(i+1)+' af '+pages.length,8,{al:'r',c:[.45,.5,.5]})})},
  build(){let out='%PDF-1.4\n';const offs=[];const add=s=>{offs.push(out.length);out+=s};const n=pages.length;
   add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
   add('2 0 obj\n<< /Type /Pages /Kids ['+pages.map((_,i)=>(6+2*i)+' 0 R').join(' ')+'] /Count '+n+' >>\nendobj\n');
   add('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
   add('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
   pages.forEach((p,i)=>{const s=p.join('\n');add((5+2*i)+' 0 obj\n<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream\nendobj\n');add((6+2*i)+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(5+2*i)+' 0 R >>\nendobj\n')});
   const xs=out.length;out+='xref\n0 '+(offs.length+1)+'\n0000000000 65535 f \n'+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(offs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xs+'\n%%EOF';
   const u=new Uint8Array(out.length);for(let i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;return u}};return A}
function bilagPdf(){const r=S.rep,rows=repRows().filter(e=>e.bl!==false);const AC=[.85,.28,.06],DK=[.08,.14,.17],MU=[.4,.46,.48];
 const byU={};rows.forEach(e=>(byU[e.u]=byU[e.u]||[]).push(e));const us=Object.keys(byU).sort((a,b)=>nm(a).localeCompare(nm(b),'da'));if(!us.length)return null;
 const P=mkPdf();const cust=r.c||[...new Set(rows.map(e=>proj(e.p).client||''))].filter(Boolean).join(', ')||'';
 us.forEach(u=>{P.np();let y=790;
  P.rect(50,y-6,6,22,AC);P.text(64,y,FIRMA.n,15,{b:1,c:DK});P.text(64,y-14,'CVR '+FIRMA.cvr+' · '+FIRMA.adr,8.5,{c:MU});
  y-=52;P.text(50,y,'Timeoversigt',22,{b:1,c:DK});y-=26;
  const info=[['Medarbejder',nm(u)],['Kunde',cust||'—'],['Periode',mname(r.ym).replace(/^./,c=>c.toUpperCase())]];info.forEach(i=>{P.text(50,y,i[0],9.5,{c:MU});P.text(130,y,i[1],10.5,{b:1,c:DK});y-=16});y-=10;
  const head=()=>{P.rect(50,y-5,495,20,[.93,.96,.97]);P.text(56,y,'Dato',8.5,{b:1,c:MU});P.text(106,y,'Projekt',8.5,{b:1,c:MU});P.text(246,y,'Beskrivelse',8.5,{b:1,c:MU});P.text(540,y,'Timer',8.5,{b:1,c:MU,al:'r'});y-=24};head();
  let sum=0;const per={};
  byU[u].forEach(e=>{const p=proj(e.p);const pl=wrap(p.name,9,125),dl=wrap(e.n||'',9,250);const nl=Math.max(pl.length,dl.length);const hh=nl*12+6;
   if(y-hh<70){P.np();y=800;head()}
   P.text(56,y,prs(e.d).getDate()+'. '+MON[prs(e.d).getMonth()].slice(0,3),9,{c:DK});pl.forEach((l,i)=>P.text(106,y-i*12,l,9,{c:DK}));dl.forEach((l,i)=>P.text(246,y-i*12,l,9,{c:DK}));P.text(540,y,hm(e.m),9,{c:DK,al:'r'});
   y-=hh;P.line(50,y+8,545,y+8);sum+=e.m;per[e.p]=(per[e.p]||0)+e.m});
  if(y<150){P.np();y=800}
  y-=6;P.text(246,y,'Timer i alt',11,{b:1,c:DK});P.text(540,y,hm(sum)+' ('+dec(sum)+' t)',11,{b:1,c:DK,al:'r'});y-=24;
  if(r.rate){P.text(50,y,'Fakturagrundlag (ekskl. moms)',10,{b:1,c:DK});y-=16;let total=0;
   Object.keys(per).forEach(p=>{const pr=proj(p),h=per[p]/60,a=h*(pr.rate||0);total+=a;P.text(56,y,pr.name,9,{c:DK});P.text(400,y,dec(per[p])+' t × '+kr(pr.rate||0),9,{c:MU,al:'r'});P.text(540,y,kr(a),9,{c:DK,al:'r'});y-=14});
   P.line(300,y+8,545,y+8,[.5,.5,.5]);P.text(400,y-4,'I alt ekskl. moms',9.5,{b:1,c:DK,al:'r'});P.text(540,y-4,kr(total),9.5,{b:1,c:DK,al:'r'})}});
 P.footers(FIRMA.n+' · Timeoversigt '+mname(r.ym)+' · Genereret '+todayS().split('-').reverse().join('.'));return P.build()}

/* ----- team ----- */
function vTeam(){const now=todayS().slice(0,7);const d=S.adm[now];
 let h=`<div class="card"><div class="row"><h2 class="sp1">Team</h2><button class="b s" data-act="tload">Opdatér</button></div>
 <div class="g2"><div><label for="in">Medarbejderens e-mail</label><input id="in" type="email" class="fl" placeholder="navn@firma.dk" autocomplete="off"></div><div><label for="inm">Navn</label><input id="inm" class="fl" autocomplete="off"></div></div>
 <div class="row" style="margin-top:12px"><button class="b a" data-act="invite">Invitér medarbejder</button><span class="mu">De får en mail med et link til at vælge adgangskode.</span></div>${S.ok?'<div class="inf" style="margin-top:12px">'+esc(S.ok)+'</div>':''}</div>`;
 if(S.admLoading)return h+'<div class="empty">Henter …</div>';
 h+=`<div class="card">${S.members.length?`<div class="sc"><table><tr><th>Navn</th><th>E-mail</th><th>Projekter</th><th class="n">${esc(mname(now))}</th><th></th></tr>${S.members.map(u=>{const it=d&&d[u]?d[u]:{};const ps=Object.keys(S.assignAll[u]||{}).map(k=>(S.projects[k]||{}).name).filter(Boolean);return `<tr><td>${esc(S.names[u]||'–')}${S.roles[u]==='admin'?' <span class="chip">Admin</span>':''}</td><td>${esc(S.emails[u]||'')}</td><td>${ps.length?esc(ps.join(', ')):'<span class="mu">ingen</span>'}</td><td class="n">${hm(Object.values(it).reduce((s,e)=>s+e.m,0))}</td><td class="r">${u!==uid?`<button class="b s" data-act="role" data-u="${u}">${S.roles[u]==='admin'?'Fjern admin':'Gør til admin'}</button>`:''}</td></tr>`}).join('')}</table></div>`:'<div class="empty">Ingen medarbejdere endnu.</div>'}</div>`;return h}
/* ---------- skal ---------- */
function render(){if(!S.loaded)return;
 const tabs=[['tid','⏱','Tid'],['uge','📅','Uge'],['mdr','🗓','Måned']];if(S.isAdmin)tabs.push(['emp','👷','Timer'],['proj','🏗️','Projekter'],['rep','📊','Rapport'],['team','👥','Team']);
 $('#nav').innerHTML='<div class="brand"><img alt="OS Group" src="'+document.querySelector('header img').src+'"><span>Tidsregistrering</span></div>'+tabs.map(t=>`<button class="${S.view===t[0]?'on':''}" data-act="tab" data-v="${t[0]}"><b>${t[1]}</b>${t[2]}</button>`).join('');
 $('#who').textContent=nm(uid)==='Mig'?'':nm(uid);$('#role').textContent=S.isAdmin?'Administrator':(S.canWrite?'Medarbejder':'Kun læsning');
 let h='';if(S.offline)h+='<div class="inf">Du er offline. Ændringer kan først gemmes, når forbindelsen er tilbage.</div>';if(S.err)h+=`<div class="err">${esc(S.err)}</div>`;if(!S.canWrite)h+='<div class="inf">Du har kun læseadgang. Bed administrator om Bidragyder-adgang for at registrere tid.</div>';
 const tn=$('#tn');if(tn&&!S.timer&&S.view==='tid')S.note=tn.value;const tp=$('#tp');if(tp&&!S.timer&&S.view==='tid'&&tp.value)S.proj=tp.value;
 const V={tid:vTid,uge:vUge,mdr:vMaaned,emp:vEmp,proj:vProj,rep:vRep,team:vTeam};h+=(V[S.view]||vTid)();$('#app').innerHTML=h+'<div class="skywrap">'+SKY+'</div>'}
function tick(){const el=$('#tmr');if(el&&S.timer)el.textContent=hm2(Date.now()-S.timer.start)}
const getE=(u,d,id)=>{const ym=d.slice(0,7);const it=u===uid?S.my[ym]:(S.adm[ym]||{})[u];return it&&it[id]?Object.assign({id},it[id]):null};
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
 if(t.classList.contains('ov')&&ev.target!==t)return;
 if(a==='tab'){S.view=t.dataset.v;S.err='';if(S.isAdmin&&['emp','rep','team','proj'].includes(S.view)){const ym=S.view==='emp'?S.emp.ym:S.view==='rep'?S.rep.ym:todayS().slice(0,7);if(!S.adm[ym]||!S.members.length)loadAdmin([ym])}render();window.scrollTo(0,0)}
 else if(a==='start'){S.proj=$('#tp').value;S.note=$('#tn').value;startTimer()}else if(a==='stop')stopTimer();
 else if(a==='new'){const d=t.dataset.d||todayS();if(!canEditE(d)){S.err='Den måned er låst for redigering.';render();return}openEntry(Object.assign({d},t.dataset.p?{p:t.dataset.p}:{}),uid)}
 else if(a==='eadd'){openEntry({d:S.emp.ym===todayS().slice(0,7)?todayS():S.emp.ym+'-01'},S.emp.u)}
 else if(a==='edit'){const e=getE(t.dataset.u,t.dataset.d,t.dataset.id);if(e)openEntry(e,t.dataset.u)}
 else if(a==='mclose')closeModal();else if(a==='msave')saveModal();
 else if(a==='mdel'){const c=S.editing,u=S.edT;closeModal();guard(()=>delEntry(u,c.d.slice(0,7),c.id))}
 else if(a==='wk'){S.week=addD(S.week,+t.dataset.n);render()}else if(a==='mm'){S.mm=t.dataset.v;render()}
 else if(a==='pnew'){if(!S.members.length)await loadAdmin([todayS().slice(0,7)]);openProj(null)}else if(a==='pedit')openProj(t.dataset.id);else if(a==='psave')saveProj(t.dataset.id);
 else if(a==='pdel'){const id=t.dataset.id;closeModal();guard(()=>delProj(id))}
 else if(a==='eload'){S.emp.u=$('#eu').value;S.emp.ym=$('#ey').value||S.emp.ym;delete S.adm[S.emp.ym];loadAdmin([S.emp.ym])}
 else if(a==='rload'){syncRep();delete S.adm[S.rep.ym];loadAdmin([S.rep.ym])}
 else if(a==='csv'){syncRep();saveFile('timer-'+S.rep.ym+'.csv',csvDetail())}
 else if(a==='dinero'){syncRep();saveFile('dinero-fakturagrundlag-'+S.rep.ym+'.csv',csvDinero())}
 else if(a==='pdf'){syncRep();const b=bilagPdf();if(!b){S.err='Ingen fakturerbare timer at lave bilag af med de valgte filtre.';return render()}saveFile('bilag-'+S.rep.ym+(S.rep.u?'-'+nm(S.rep.u).toLowerCase().replace(/[^a-z0-9æøå]+/g,'-'):'')+'.pdf',b)}
 else if(a==='tload')loadAdmin([todayS().slice(0,7)])});
document.addEventListener('change',ev=>{if(S.view==='rep'&&/^r[yucr]$/.test(ev.target.id)){syncRep();render()}if(S.view==='emp'&&ev.target.id==='eu'){S.emp.u=ev.target.value;render()}});


/* ---------- ekstra handlinger ---------- */
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
 if(a==='logout'){await sb.auth.signOut();location.reload()}
 else if(a==='role'){const u=t.dataset.u,nr=S.roles[u]==='admin'?'user':'admin';await guard(async()=>{const {error}=await sb.from('profiles').update({role:nr}).eq('id',u);if(error)throw error;S.roles[u]=nr})}
 else if(a==='invite'){const email=($('#in').value||'').trim(),name=($('#inm').value||'').trim();if(!/^\S+@\S+\.\S+$/.test(email)){S.err='Angiv en gyldig e-mail.';return render()}
  await guard(async()=>{const {error}=await sb.functions.invoke('invite',{body:{email,name}});if(error)throw new Error('Invitationen kunne ikke sendes. Funktionen "invite" er muligvis ikke oprettet endnu. Du kan i stedet invitere i Supabase under Authentication → Users → Invite user.');S.ok='Invitation sendt til '+email+'.';await loadBase()})}});
window.addEventListener('online',()=>{S.offline=false;render()});window.addEventListener('offline',()=>{S.offline=true;render()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&sb&&uid&&S.loaded)loadTimer().then(render).catch(()=>{})});

/* ---------- login ---------- */
const CFG=window.APP_CONFIG||{};
function showAuth(mode,msg,kind){document.body.classList.add('noauth');const A=$('#auth');
 const f={login:`<h1>Log ind</h1><label for="ae">E-mail</label><input id="ae" type="email" class="fl" autocomplete="username" autofocus><label for="ap">Adgangskode</label><input id="ap" type="password" class="fl" autocomplete="current-password"><div style="margin-top:18px"><button class="b a fl" data-auth="login">Log ind</button></div><p class="mu" style="margin-top:14px;text-align:center"><a href="#" data-auth="to-forgot">Glemt adgangskode?</a></p>`,
 forgot:`<h1>Glemt adgangskode</h1><p class="mu">Skriv din e-mail, så sender vi et link til at vælge en ny.</p><label for="ae">E-mail</label><input id="ae" type="email" class="fl" autocomplete="username"><div style="margin-top:18px"><button class="b a fl" data-auth="forgot">Send link</button></div><p class="mu" style="margin-top:14px;text-align:center"><a href="#" data-auth="to-login">Tilbage til log ind</a></p>`,
 setpw:`<h1>Vælg adgangskode</h1><p class="mu">Mindst 10 tegn.</p><label for="ap">Ny adgangskode</label><input id="ap" type="password" class="fl" autocomplete="new-password"><label for="ap2">Gentag adgangskode</label><input id="ap2" type="password" class="fl" autocomplete="new-password"><div style="margin-top:18px"><button class="b a fl" data-auth="setpw">Gem og fortsæt</button></div>`}[mode];
 A.innerHTML=`<div class="authcard"><div class="authlogo"><img alt="OS Group" src="${document.querySelector('header img').src}"><span>Tidsregistrering</span></div>${msg?`<div class="${kind==='ok'?'inf':'err'}">${esc(msg)}</div>`:''}${f}</div><div class="skywrap">${SKY}</div>`}
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-auth]');if(!t)return;ev.preventDefault();const a=t.dataset.auth;
 if(a==='to-forgot')return showAuth('forgot');if(a==='to-login')return showAuth('login');
 const val=id=>($('#'+id)||{}).value||'';
 try{
  if(a==='login'){const {data,error}=await sb.auth.signInWithPassword({email:val('ae').trim(),password:val('ap')});if(error)return showAuth('login','Forkert e-mail eller adgangskode.');await boot(data.session)}
  else if(a==='forgot'){await sb.auth.resetPasswordForEmail(val('ae').trim(),{redirectTo:location.origin+location.pathname});showAuth('login','Hvis e-mailen findes, er der sendt et link.','ok')}
  else if(a==='setpw'){const p=val('ap');if(p.length<10)return showAuth('setpw','Adgangskoden skal være mindst 10 tegn.');if(p!==val('ap2'))return showAuth('setpw','De to adgangskoder er ikke ens.');
   const {error}=await sb.auth.updateUser({password:p});if(error)return showAuth('setpw',error.message);history.replaceState(null,'',location.pathname);const {data}=await sb.auth.getSession();await boot(data.session)}
 }catch(e){showAuth(a==='setpw'?'setpw':'login',errText(e))}});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&document.body.classList.contains('noauth')){const b=document.querySelector('[data-auth]:is(button)');if(b)b.click()}});

/* ---------- start ---------- */
let ticker=null;
async function boot(session){uid=session.user.id;
 const {data,error}=await sb.from('profiles').select('*').eq('id',uid).maybeSingle();
 if(error||!data){showAuth('login','Din bruger er ikke sat op endnu. Kontakt administrator.');await sb.auth.signOut();return}
 me=data;S.isAdmin=me.role==='admin';S.names[uid]=me.name||'';S.emails[uid]=me.email;S.roles[uid]=me.role;
 document.body.classList.remove('noauth');$('#app').innerHTML='<div class="empty">Indlæser …</div>';
 try{await loadBase();await loadTimer();S.loaded=true;watchMonth(todayS().slice(0,7));if(S.isAdmin)loadAdmin([todayS().slice(0,7)])}catch(e){S.loaded=true;S.err='Kunne ikke hente data: '+errText(e)}
 render();if(!ticker)ticker=setInterval(tick,1000)}
(async function init(){
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
 if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY||!window.supabase){document.body.classList.add('noauth');$('#auth').innerHTML='<div class="authcard"><h1>Ikke sat op endnu</h1><p class="mu">Siden mangler forbindelse til databasen. Udfyld <b>config.js</b> med Supabase-adresse og nøgle.</p></div>';return}
 sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')showAuth('setpw');if(ev==='SIGNED_OUT'&&uid)location.reload()});
 const needPw=/type=(invite|recovery)/.test(location.hash);
 const {data:{session}}=await sb.auth.getSession();
 if(needPw&&session)return showAuth('setpw');
 if(!session)return showAuth('login');
 await boot(session)})();
