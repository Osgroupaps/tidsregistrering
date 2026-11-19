"use strict";
/* Dinero-integration: fakturakladde pr. medarbejder + bilag med logo. Bruger app.js' globale hjælpere. */
let LOGO_B64="",LOGO_W=360,LOGO_H=92;
/* Logoet hentes fra sidens eget <img> og lægges på hvid baggrund som JPEG til PDF'en */
const logoReady=new Promise(res=>{const go=()=>{try{const im=document.querySelector('img[alt="OS Group"]');if(!im||!im.naturalWidth)return false;const c=document.createElement('canvas');c.width=LOGO_W=im.naturalWidth;c.height=LOGO_H=im.naturalHeight;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);LOGO_B64=c.toDataURL('image/jpeg',.92).split(',')[1];return true}catch(e){return false}};let n=0;const t=setInterval(()=>{if(go()||++n>100){clearInterval(t);res()}},100)});
const FIRMA2={web:'osgroup.dk'};
S.dn=S.dn||{open:{},sent:{},busy:'',msg:'',cfg:null,logYm:''};
function dKey(u,c){return u+'|'+c}
function dDrafts(){const r=S.rep,g={};
 repRows().filter(e=>e.bl!==false).forEach(e=>{const p=proj(e.p),c=p.client||'',k=dKey(e.u,c);const o=g[k]=g[k]||{k,u:e.u,c,cvr:p.cvr||'',rows:[],per:{},m:0};o.rows.push(e);o.m+=e.m;const q=o.per[e.p]=o.per[e.p]||{p:e.p,m:0,rate:p.rate||0};q.m+=e.m});
 return Object.values(g).map(o=>{o.lines=Object.values(o.per).map(q=>({description:proj(q.p).name+' – '+nm(o.u)+' – '+mname(r.ym),hours:Math.round(q.m/60*100)/100,rate:q.rate})).sort((a,b)=>a.description.localeCompare(b.description,'da'));
  o.total=o.lines.reduce((s,l)=>s+l.hours*l.rate,0);o.issues=[];if(!o.c)o.issues.push('Projektet mangler kunde');if(o.lines.some(l=>!l.rate))o.issues.push('Et projekt mangler timepris');return o})
 .sort((a,b)=>nm(a.u).localeCompare(nm(b.u),'da')||a.c.localeCompare(b.c,'da'))}
/* ----- bilag-PDF med logo ----- */
function b64bytes(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function pdfBuilder(){const pages=[];let cur=null;
 const A={np(){cur=[];pages.push(cur);return cur},
  text(x,y,s,sz,o){o=o||{};if(o.al==='r')x-=tw(s,sz,o.b);cur.push(`BT /${o.b?'F2':'F1'} ${sz} Tf ${(o.c||[0,0,0]).join(' ')} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${pesc(cp(s))}) Tj ET`)},
  line(x1,y1,x2,y2,c,w){cur.push(`${(c||[.85,.85,.85]).join(' ')} RG ${w||.5} w ${x1} ${y1} m ${x2} ${y2} l S`)},
  rect(x,y,w,h,c){cur.push(`${c.join(' ')} rg ${x} ${y} ${w} ${h} re f`)},
  logo(x,y,h){const w=h*LOGO_W/LOGO_H;cur.push(`q ${w.toFixed(2)} 0 0 ${h} ${x} ${y} cm /Im1 Do Q`)},
  each(fn){const c0=cur;pages.forEach((p,i)=>{cur=p;fn(i,pages.length)});cur=c0},
  build(){const chunks=[];let len=0;const offs=[];const put=s=>{const u=typeof s==='string'?Uint8Array.from(s,c=>c.charCodeAt(0)&255):s;chunks.push(u);len+=u.length};
   const obj=(n,body)=>{offs[n]=len;put(n+' 0 obj\n');put(body);put('\nendobj\n')};
   put('%PDF-1.4\n');const n=pages.length,total=5+2*n;
   obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
   obj(2,'<< /Type /Pages /Kids ['+pages.map((_,i)=>(7+2*i)+' 0 R').join(' ')+'] /Count '+n+' >>');
   obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
   obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
   const jpg=b64bytes(LOGO_B64);offs[5]=len;put('5 0 obj\n<< /Type /XObject /Subtype /Image /Width '+LOGO_W+' /Height '+LOGO_H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');put(jpg);put('\nendstream\nendobj\n');
   pages.forEach((p,i)=>{const s=p.join('\n');obj(6+2*i,'<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream');obj(7+2*i,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents '+(6+2*i)+' 0 R >>')});
   const xs=len;let x='xref\n0 '+(total+1)+'\n0000000000 65535 f \n';for(let i=1;i<=total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
   put(x+'trailer\n<< /Size '+(total+1)+' /Root 1 0 R >>\nstartxref\n'+xs+'\n%%EOF');
   const out=new Uint8Array(len);let o=0;chunks.forEach(c=>{out.set(c,o);o+=c.length});return out}};return A}
function bilagLogoPdf(d){const r=S.rep,DK=[.08,.14,.17],MU=[.4,.46,.48],AC=[.85,.28,.06];const P=pdfBuilder();const emp=nm(d.u);
 const dm=s=>{const x=prs(s);return DAY[(x.getDay()+6)%7]+' '+pad(x.getDate())+'.'+pad(x.getMonth()+1)+'.'+x.getFullYear()};
 const newPage=()=>{P.np();P.logo(50,778,38);P.text(545,806,'Medarbejder',8.5,{al:'r',c:MU});P.text(545,790,emp,13,{b:1,al:'r',c:DK});P.line(50,768,545,768,AC,1.2);return 742};
 let y=newPage();
 P.text(50,y,'Timeregistrering',20,{b:1,c:DK});y-=24;
 [['Medarbejder',emp],['Kunde',d.c||'—'],['Periode',mname(r.ym).replace(/^./,c=>c.toUpperCase())]].forEach(i=>{P.text(50,y,i[0],9.5,{c:MU});P.text(130,y,i[1],10.5,{b:1,c:DK});y-=16});y-=8;
 const head=()=>{P.rect(50,y-5,495,20,[.93,.96,.97]);P.text(56,y,'Dato',8.5,{b:1,c:MU});P.text(150,y,'Projekt',8.5,{b:1,c:MU});P.text(290,y,'Beskrivelse',8.5,{b:1,c:MU});P.text(540,y,'Timer',8.5,{b:1,c:MU,al:'r'});y-=24};head();
 let sum=0,last='';const per={};
 d.rows.forEach(e=>{const p=proj(e.p),pl=wrap(p.name,9,130),dl=wrap(e.n||'',9,215),hh=Math.max(pl.length,dl.length)*12+6;
  if(y-hh<80){y=newPage();head();last=''}
  if(e.d!==last){P.text(56,y,dm(e.d),9,{b:1,c:DK});last=e.d}
  pl.forEach((l,i)=>P.text(150,y-i*12,l,9,{c:DK}));dl.forEach((l,i)=>P.text(290,y-i*12,l,9,{c:DK}));P.text(540,y,hm(e.m),9,{c:DK,al:'r'});
  y-=hh;P.line(50,y+8,545,y+8);sum+=e.m;per[e.p]=(per[e.p]||0)+e.m});
 if(y<130){y=newPage()}
 y-=8;P.text(290,y,'Timer i alt',11,{b:1,c:DK});P.text(540,y,hm(sum)+' ('+dec(sum)+' t)',11,{b:1,c:DK,al:'r'});y-=22;
 if(Object.keys(per).length>1){P.text(50,y,'Fordelt på projekt',9.5,{b:1,c:MU});y-=14;Object.keys(per).forEach(k=>{if(y<80){y=newPage()}P.text(56,y,proj(k).name,9,{c:DK});P.text(540,y,hm(per[k])+' ('+dec(per[k])+' t)',9,{al:'r',c:DK});y-=13})}
 P.each((i,n)=>{P.line(50,56,545,56);P.text(50,42,FIRMA.n+' · '+FIRMA.adr+' · CVR '+FIRMA.cvr+' · '+FIRMA2.web,8,{c:MU});P.text(545,42,'Side '+(i+1)+' af '+n,8,{al:'r',c:MU})});
 return P.build()}
function dFile(d){return ('Timeregistrering_'+nm(d.u)+'_'+(d.c||'kunde')+'_'+S.rep.ym).replace(/[^\wæøåÆØÅ-]+/g,'_')+'.pdf'}
/* ----- visning ----- */
const _vRep=vRep;
vRep=function(){let h=_vRep();if(!S.adm[S.rep.ym]||S.admLoading)return h;
 if(S.dn.logYm!==S.rep.ym&&S.dn.loading!==S.rep.ym){const ym=S.rep.ym;S.dn.loading=ym;sb.from('dinero_exports').select('user_id,customer,created_at').eq('ym',ym).then(r=>{S.dn.logYm=ym;S.dn.loading='';S.dn.noTable=!!r.error;S.dn.sent={};(r.data||[]).forEach(x=>{S.dn.sent[dKey(x.user_id,x.customer)]=x.created_at});render()})}
 if(!S.dn.cfg&&!S.dn.cfgBusy){S.dn.cfgBusy=1;sb.functions.invoke('dinero',{body:{action:'status'}}).then(r=>{S.dn.cfg=r.data||{ok:false,error:'Funktionen "dinero" er ikke oprettet endnu.'};S.dn.cfgBusy=0;render()}).catch(()=>{S.dn.cfg={ok:false,error:'Funktionen "dinero" er ikke oprettet endnu.'};S.dn.cfgBusy=0;render()})}
 const ds=dDrafts();const cfg=S.dn.cfg;
 let c=`<div class="card"><h2>Fakturakladder til Dinero</h2><p class="mu">Én kladde pr. medarbejder og kunde for ${esc(mname(S.rep.ym))}. Se kladden og bilaget her, og tryk Overfør for at oprette den som kladde i Dinero.</p>`;
 if(cfg&&!cfg.ok)c+=`<div class="inf" style="margin-top:10px">Dinero er ikke forbundet endnu: ${esc(cfg.missing?'mangler secrets '+cfg.missing.join(', '):cfg.error||'ukendt fejl')}.</div>`;
 if(S.dn.noTable)c+=`<div class="inf" style="margin-top:10px">Tabellen dinero_exports mangler (bruges til at undgå dobbelte overførsler). Kør dinero_exports.sql i Supabase.</div>`;
 if(S.dn.msg)c+=`<div class="inf" style="margin-top:10px">${esc(S.dn.msg)}</div>`;
 c+='</div>';
 if(!ds.length)return h+c+'<div class="empty">Ingen fakturerbare timer i valget.</div>';
 ds.forEach(d=>{const open=S.dn.open[d.k],sent=S.dn.sent[d.k];
  c+=`<div class="card"><div class="row"><h3 class="sp1">${esc(nm(d.u))} → ${esc(d.c||'(ingen kunde)')}</h3><span class="mu">${dec(d.m)} t · ${kr(d.total)} ekskl. moms</span></div>
  ${sent?`<div class="inf" style="margin-top:8px">Overført til Dinero ${esc(String(sent).slice(0,10).split('-').reverse().join('.'))}.</div>`:''}${d.issues.length?`<div class="inf" style="margin-top:8px">${esc(d.issues.join('. '))}.</div>`:''}
  <div class="row" style="margin-top:10px"><button class="b" data-act="dprev" data-k="${esc(d.k)}">${open?'Skjul kladde':'Se kladde'}</button><button class="b" data-act="dbil" data-k="${esc(d.k)}">Bilag (PDF)</button><button class="b a" data-act="dsend" data-k="${esc(d.k)}" ${S.dn.busy||d.issues.length||!(cfg&&cfg.ok)?'disabled':''}>${S.dn.busy===d.k?'Overfører …':sent?'Overfør igen':'Overfør til Dinero'}</button></div>
  ${open?`<div class="sc" style="margin-top:12px"><table><tr><th>Beskrivelse</th><th class="n">Antal (timer)</th><th class="n">Pris</th><th class="n">Beløb</th></tr>${d.lines.map(l=>`<tr><td>${esc(l.description)}</td><td class="n">${n2(l.hours)}</td><td class="n">${kr(l.rate)}</td><td class="n">${kr(l.hours*l.rate)}</td></tr>`).join('')}<tr><td colspan="3"><b>I alt ekskl. moms</b></td><td class="n"><b>${kr(d.total)}</b></td></tr></table></div><p class="mu" style="margin-top:8px">Kunde: ${esc(d.c)}${d.cvr?' · CVR '+esc(d.cvr):''}. Bilaget viser ${d.rows.length} registreringer fordelt på datoer.</p>`:''}</div>`});
 return h+c};
document.addEventListener('click',async ev=>{const t=ev.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;if(!/^d(prev|bil|send)$/.test(a))return;
 const d=dDrafts().find(x=>x.k===t.dataset.k);if(!d)return;
 if(a==='dprev'){S.dn.open[d.k]=!S.dn.open[d.k];render()}
 else if(a==='dbil'){await logoReady;await saveFile(dFile(d),bilagLogoPdf(d))}
 else if(a==='dsend'){S.dn.busy=d.k;S.dn.msg='';render();await logoReady;
  try{const {data,error}=await sb.functions.invoke('dinero',{body:{action:'draft',ym:S.rep.ym,userId:d.u,customer:{name:d.c,cvr:d.cvr},title:'Timer – '+nm(d.u)+' – '+mname(S.rep.ym),comment:'Se bilag: timeregistrering for '+nm(d.u)+', '+mname(S.rep.ym)+'.',lines:d.lines,total:d.total}});
   let msg=data&&data.error;if(error&&!msg){try{msg=(await error.context.json()).error}catch(e){msg='Kunne ikke kontakte funktionen "dinero".'}}
   if(msg)S.dn.msg='Overførslen mislykkedes: '+msg;else{S.dn.sent[d.k]=new Date().toISOString();S.dn.msg='Kladden til '+d.c+' er oprettet i Dinero. Bilaget er hentet som PDF – vedhæft det på kladden i Dinero.';await saveFile(dFile(d),bilagLogoPdf(d))}}
  catch(e){S.dn.msg='Overførslen mislykkedes: '+((e&&e.message)||e)}
  S.dn.busy='';render()}});
