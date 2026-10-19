'use strict';
// ====== ONLINE: δωμάτια με κωδικό. Peer-to-peer (WebRTC) μέσω PeerJS, χωρίς δικό σου server. ======
// Ο παίκτης που φτιάχνει το δωμάτιο είναι ο «οικοδεσπότης»: κρατά τη λέξη, τον χρόνο και τα σκορ.
const PEER_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MAX_PLAYERS = 12, BC = location.search.includes('bc'); // ?bc = δοκιμή τοπικά με BroadcastChannel
let net = null, isHost = false, myId = '', myName = '', R = null, C = {players:[]};

// ---------- Μεταφορά μηνυμάτων ----------
function loadPeer(){ return new Promise((ok,no)=>{ if(window.Peer) return ok(); const s=document.createElement('script'); s.src=PEER_CDN; s.onload=ok; s.onerror=()=>no({type:'cdn'}); document.head.appendChild(s); }); }
function peerNet(){
  let peer, conns={}, hc;
  return {
    get id(){ return peer&&peer.id; },
    async open(role,code,h){
      await loadPeer();
      return new Promise((res,rej)=>{
        setTimeout(()=>rej({type:'timeout'}),15000);
        if(role==='host'){
          peer=new Peer('dgame-'+code); peer.on('open',()=>res()); peer.on('error',rej);
          peer.on('connection',c=>{ c.on('open',()=>{conns[c.peer]=c;h.onPeer(c.peer)}); c.on('data',m=>h.onMsg(c.peer,m)); c.on('close',()=>{delete conns[c.peer];h.onClose(c.peer)}); });
        } else {
          peer=new Peer(); peer.on('error',rej);
          peer.on('open',()=>{ hc=peer.connect('dgame-'+code,{reliable:true}); hc.on('open',()=>res()); hc.on('data',m=>h.onMsg('host',m)); hc.on('close',()=>h.onClose('host')); });
        }
      });
    },
    send(to,m){ const c=to==='host'?hc:conns[to]; if(c&&c.open) c.send(m); },
    bcast(m){ Object.values(conns).forEach(c=>c.open&&c.send(m)); },
    close(){ try{peer&&peer.destroy()}catch(e){} }
  };
}
function bcNet(){ // μόνο για δοκιμές (ίδιο πρόγραμμα περιήγησης, πολλά tabs)
  const id=Math.random().toString(36).slice(2); let ch,role,h,ok;
  const post=(to,m)=>ch.postMessage({from:id,to,m});
  return {
    id,
    open(r,code,hd){ role=r;h=hd;ch=new BroadcastChannel('dg-'+code);
      ch.onmessage=e=>{ const {from,to,m}=e.data; if(from===id) return;
        if(role==='host'){ if(to!=='host') return; if(m.t==='_join'){h.onPeer(from);post(from,{t:'_ok'})} else if(m.t==='_leave') h.onClose(from); else h.onMsg(from,m); }
        else { if(to!==id&&to!=='*') return; if(m.t==='_ok') ok&&ok(); else h.onMsg('host',m); } };
      if(role==='host') return Promise.resolve();
      return new Promise((res,rej)=>{ ok=res; post('host',{t:'_join'}); setTimeout(()=>rej({type:'peer-unavailable'}),1500); }); },
    send(to,m){ post(role==='host'?to:'host',m); },
    bcast(m){ post('*',m); },
    close(){ if(role!=='host') post('host',{t:'_leave'}); ch&&ch.close(); }
  };
}
const makeNet = () => BC ? bcNet() : peerNet();
addEventListener('beforeunload',()=>{ try{net&&net.close()}catch(e){} });

// ---------- Μενού online ----------
function onlineMenu(){
  myName = myName || pick(SOLO_NAMES,1)[0];
  show(`<h2>Online</h2><p>Ο ένας φτιάχνει δωμάτιο και οι άλλοι μπαίνουν με τον κωδικό ή τον σύνδεσμο.</p>
  <div class="card"><input type="text" id="on" maxlength="16" placeholder="Το όνομά σου" value="${esc(myName)}">
  <button class="main" onclick="olHost()">Δημιούργησε δωμάτιο</button>
  <input type="text" id="oc" maxlength="4" placeholder="Κωδικός δωματίου" style="text-transform:uppercase">
  <button onclick="olJoin()">Μπες σε δωμάτιο</button></div>
  <button onclick="modePanel()">Πίσω</button>`);
}
function joinFromLink(code){ onlineMenu(); $('#oc').value=code; }
const readName = () => { myName=($('#on').value.trim()||pick(SOLO_NAMES,1)[0]).slice(0,16); };
function netError(e){
  olCleanup();
  const t={ 'peer-unavailable':'Δεν βρέθηκε δωμάτιο με αυτόν τον κωδικό.', cdn:'Δεν φορτώθηκε η βιβλιοθήκη για online. Έλεγξε τη σύνδεσή σου.', timeout:'Η σύνδεση άργησε πολύ. Δοκίμασε ξανά.' }[e&&e.type] || 'Δεν έγινε η σύνδεση. Δοκίμασε ξανά.';
  show(`<h2>Ωχ!</h2><p>${t}</p><button class="main" onclick="onlineMenu()">Πίσω</button>`);
}
function olCleanup(){ if(R){clearInterval(R.h);clearTimeout(R.h2)} try{net&&net.close()}catch(e){} net=null; isHost=false; R=null; C={players:[]}; window.onSeg=window.onClear=null; timer.stop(); }
function olExit(){ olCleanup(); menu(); }

// ---------- ΟΙΚΟΔΕΣΠΟΤΗΣ ----------
async function olHost(n=0){
  if(n===0) readName();
  const code=Array.from({length:4},()=>LETTERS[Math.random()*LETTERS.length|0]).join('');
  show(`<h2>Δημιουργία δωματίου…</h2>`);
  net=makeNet(); isHost=true; myId='host';
  R={code,players:[{id:'host',name:myName,score:0}],started:false,settings:{time:S.drawTime,cats:[...S.cats]}};
  try{ await net.open('host',code,{onPeer:()=>{},onMsg:hostMsg,onClose:hostLeft}); lobbyCast(); }
  catch(e){ if(e&&e.type==='unavailable-id'&&n<5){ olCleanup(); return olHost(n+1); } netError(e); }
}
const scores = () => R.players.map(p=>({id:p.id,name:p.name,score:p.score}));
function hsend(to,m){ if(to==='host') clientMsg(m); else net.send(to,m); }
function hcast(m){ net.bcast(m); clientMsg(m); }
function lobbyCast(){ hcast({t:'lobby',code:R.code,players:scores(),settings:R.settings}); }
function hostMsg(from,m){
  if(m.t==='hello'){
    if(R.started||R.players.length>=MAX_PLAYERS) return net.send(from,{t:'full'});
    if(!R.players.find(p=>p.id===from)) R.players.push({id:from,name:String(m.name||'Παίκτης').slice(0,16),score:0});
    return lobbyCast();
  }
  if(!R.started) return;
  if(m.t==='s'||m.t==='clear'){ if(from!==R.painter) return; R.players.forEach(p=>{ if(p.id!==from&&p.id!=='host') net.send(p.id,m); }); if(from!=='host') clientMsg(m); }
  else if(m.t==='done'&&from===R.painter) endRound();
  else if(m.t==='guess') hostGuess(from,String(m.text||''));
}
function hostLeft(id){
  if(!R) return;
  R.players=R.players.filter(p=>p.id!==id);
  if(!R.started) return lobbyCast();
  if(R.players.length<2) return finish();
  if(id===R.painter&&R.live) endRound();
  else if(R.live) checkAll();
}
function hostStart(){
  if(R.players.length<2) return;
  S.drawTime=R.settings.time; S.cats=R.settings.cats.length?R.settings.cats:Object.keys(WORDS); used=new Set();
  R.started=true; R.queue=R.players.map(p=>p.id); R.total=R.queue.length; R.round=0;
  nextRound();
}
function nextRound(){
  while(R.queue.length&&!R.players.find(p=>p.id===R.queue[0])) R.queue.shift();
  if(!R.queue.length||R.players.length<2) return finish();
  R.painter=R.queue.shift(); R.round++; R.word=randomWord(); R.left=R.settings.time; R.correct=new Set(); R.live=true;
  const pn=R.players.find(p=>p.id===R.painter).name;
  hcast({t:'round',painter:R.painter,painterName:pn,i:R.round,n:R.total,total:R.left,players:scores()});
  hsend(R.painter,{t:'word',word:R.word});
  clearInterval(R.h);
  R.h=setInterval(()=>{ R.left--; hcast({t:'tick',left:R.left}); if(R.left<=0) endRound(); },1000);
}
function hostGuess(from,text){
  if(!R.live||from===R.painter||R.correct.has(from)) return;
  if(normGreek(text)!==normGreek(R.word)) return hsend(from,{t:'wrong'});
  const ratio=Math.min(1,Math.max(0,R.left/R.settings.time));
  let pts=BASE+Math.round(BASE*ratio); if(!R.correct.size) pts+=FIRST_BONUS; pts=Math.min(pts,MAX_PTS);
  const g=R.players.find(p=>p.id===from), pa=R.players.find(p=>p.id===R.painter);
  g.score+=pts; if(pa) pa.score+=PAINTER_PTS; R.correct.add(from);
  hcast({t:'found',id:from,name:g.name,pts,players:scores()});
  checkAll();
}
function checkAll(){ if(R.players.filter(p=>p.id!==R.painter).every(p=>R.correct.has(p.id))) endRound(); }
function endRound(){
  if(!R.live) return; R.live=false; clearInterval(R.h);
  hcast({t:'end',word:R.word,players:scores()});
  R.h2=setTimeout(nextRound,6000);
}
function finish(){ clearInterval(R.h); clearTimeout(R.h2); R.live=false; hcast({t:'final',players:scores()}); }
function olSettings(k,v){ if(!isHost) return;
  if(k==='time') R.settings.time=v;
  else R.settings.cats=R.settings.cats.includes(v)?R.settings.cats.filter(c=>c!==v):[...R.settings.cats,v];
  lobbyCast(); }

// ---------- ΠΑΙΚΤΗΣ (guest) ----------
async function olJoin(){
  readName(); const code=($('#oc').value||'').trim().toUpperCase();
  if(code.length!==4) return alert('Βάλε τον κωδικό των 4 γραμμάτων.');
  show(`<h2>Σύνδεση στο δωμάτιο ${esc(code)}…</h2>`);
  net=makeNet(); isHost=false;
  try{
    await net.open('guest',code,{onMsg:(f,m)=>clientMsg(m),onClose:()=>{ if(net){ alert('Ο οικοδεσπότης αποχώρησε από το δωμάτιο.'); olExit(); } }});
    myId=net.id; net.send('host',{t:'hello',name:myName});
  }catch(e){ netError(e); }
}

// ---------- Οθόνες ----------
function clientMsg(m){
  const T=m.t;
  if(T==='lobby'){ C.code=m.code; C.players=m.players; C.settings=m.settings; return lobbyView(); }
  if(T==='full'){ alert('Το δωμάτιο είναι γεμάτο ή το παιχνίδι έχει ήδη ξεκινήσει.'); return olExit(); }
  if(T==='round') return roundView(m);
  if(T==='word'){ const w=$('#ow'); if(w) w.textContent=m.word; C.word=m.word; return; }
  if(T==='s'){ const c=$('#cv'); if(c&&!isPainter()) drawSeg(c.getContext('2d'),m); return; }
  if(T==='clear'){ const c=$('#cv'); if(c&&!isPainter()) c.getContext('2d').clearRect(0,0,c.width,c.height); return; }
  if(T==='tick'){ C.left=m.left; return tickView(); }
  if(T==='wrong'){ const f=$('#fb'); if(f) f.textContent='Λάθος! Προσπάθησε ξανά.'; return; }
  if(T==='found'){ C.players=m.players; sbView(); logLine(`${esc(m.name)} βρήκε τη λέξη! +${m.pts}`);
    if(m.id===myId){ const f=$('#fb'); if(f) f.textContent=`Σωστό! +${m.pts}`; const i=$('#gi'); if(i) i.disabled=true; } return; }
  if(T==='end'){ C.players=m.players; return endView(m); }
  if(T==='final'){ C.players=m.players; return finalView(); }
}
const isPainter = () => C.painter===myId;
const tickView = () => { const t=$('#tm'); if(!t) return; const s=Math.max(0,C.left); t.textContent=pad(s/60|0)+':'+pad(s%60); };
function lobbyView(){
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  const link=location.origin+location.pathname+'?'+(BC?'bc&':'')+'room='+C.code;
  const set=C.settings||{time:30,cats:[]};
  show(`<h2>Δωμάτιο ${esc(C.code)}</h2>
  <div class="card"><p>Στείλε αυτόν τον σύνδεσμο στους φίλους σου:</p><input type="text" readonly value="${esc(link)}" onclick="this.select()">
  <button class="sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(link)}')">Αντιγραφή</button></div>
  <div class="card"><p>Παίκτες (${C.players.length}/${MAX_PLAYERS})</p>${C.players.map(p=>`<div class="entry"><span>${esc(p.name)}${p.id==='host'?' ⭐':''}${p.id===myId?' (εσύ)':''}</span></div>`).join('')}</div>
  ${isHost?`<div class="card"><p>Χρόνος γύρου</p><div class="row">${[30,40,60].map(t=>`<button class="opt ${set.time===t?'on':''}" onclick="olSettings('time',${t})">${t} δευτ</button>`).join('')}</div>
  <p>Κατηγορίες</p><div class="row">${Object.keys(WORDS).map(c=>`<button class="opt ${set.cats.includes(c)?'on':''}" onclick="olSettings('cat','${c}')">${c}</button>`).join('')}</div></div>
  <button class="main" ${C.players.length<2?'disabled':''} onclick="hostStart()">${C.players.length<2?'Περιμένουμε παίκτες…':'Ξεκίνα'}</button>`
  :`<p>Περιμένουμε τον οικοδεσπότη να ξεκινήσει…</p>`}
  <button onclick="olExit()">Έξοδος</button>`);
}
function roundView(m){
  C.painter=m.painter; C.players=m.players; C.left=m.total; C.word=''; $('#ov')?.remove();
  const me=isPainter();
  show(`<div class="top"><button class="sm" onclick="olExit()">Έξοδος</button><span class="timer" id="tm"></span><span>Γύρος ${m.i}/${m.n}</span></div>
  <p>${me?'Σειρά σου! Ζωγράφισε: <b id="ow">…</b>':`${esc(m.painterName)} ζωγραφίζει…`}</p>
  <div class="board"><canvas id="cv" width="1024" height="640"></canvas></div>
  ${me?`<div id="tools">${toolbar()}</div><button class="main" onclick="olSend({t:'done'})">Ολοκλήρωση γύρου</button>`
  :`<input type="text" id="gi" placeholder="Γράψε την απάντηση σου" autocomplete="off"><div class="fb" id="fb"></div><button class="main" onclick="olGuess()">Μάντεψε</button>`}
  <div class="card" id="sb"></div><div class="card" id="log" style="max-height:120px;overflow:auto"></div>`);
  if(me){ initCanvas(); window.onSeg=s=>olSend(s); window.onClear=()=>olSend({t:'clear'}); }
  else { window.onSeg=window.onClear=null; $('#gi').addEventListener('keydown',e=>{ if(e.key==='Enter') olGuess(); }); }
  tickView(); sbView();
}
function olSend(m){
  if(isHost){ if(m.t==='done') endRound(); else R.players.forEach(p=>{ if(p.id!=='host') net.send(p.id,m); }); }
  else net.send('host',m);
}
function olGuess(){ const i=$('#gi'); const v=i.value.trim(); if(!v||i.disabled) return; if(isHost) hostGuess('host',v); else net.send('host',{t:'guess',text:v}); i.value=''; }
function sbView(){ const e=$('#sb'); if(e) e.innerHTML=scoreRows(C.players); }
function logLine(h){ const l=$('#log'); if(l){ l.insertAdjacentHTML('afterbegin',`<div>${h}</div>`); } }
function endView(m){
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<div class="card" style="max-width:420px"><h2>Η λέξη ήταν: ${esc(m.word)}</h2>${scoreRows(m.players)}<p>Ο επόμενος γύρος ξεκινά σε λίγο…</p></div>`;
  document.body.appendChild(o);
}
function finalView(){
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  show(`<h2>Τέλος παιχνιδιού!</h2><div class="card">${scoreRows(C.players)}</div><button class="main" onclick="olExit()">Πίσω στο μενού</button>`);
}
// Άνοιγμα από σύνδεσμο ?room=ΚΩΔΙΚΟΣ
{ const room=new URLSearchParams(location.search).get('room'); if(room) joinFromLink(room.toUpperCase().slice(0,4)); }
