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
  show(`<h2>Online</h2><p class="sub">Ο ένας φτιάχνει δωμάτιο και οι άλλοι μπαίνουν με τον κωδικό ή τον σύνδεσμο.</p>
  <div class="cols">
    <div class="card"><h3>Φτιάξε δωμάτιο</h3><p class="sub">Γράψε το όνομά σου και κάλεσε τους φίλους σου.</p>
      <input type="text" id="on" maxlength="16" placeholder="Το όνομά σου" value="${esc(myName)}">${btn('Δημιούργησε δωμάτιο','olHost()')}</div>
    <div class="card"><h3>Μπες σε δωμάτιο</h3><p class="sub">Έχεις κωδικό από φίλο; Θα μπεις με το όνομα που έγραψες.</p>
      <input type="text" id="oc" maxlength="4" placeholder="Κωδικός δωματίου" style="text-transform:uppercase">${btn('Μπες σε δωμάτιο','olJoin()')}</div>
  </div>
  <div class="nav col">${btn('Πίσω','modePanel()','gr')}</div>`,'colsscr');
}
function joinFromLink(code){ onlineMenu(); $('#oc').value=code; }
const readName = () => { myName=($('#on').value.trim()||pick(SOLO_NAMES,1)[0]).slice(0,16); };
function netError(e){
  olCleanup();
  const t={ 'peer-unavailable':'Δεν βρέθηκε δωμάτιο με αυτόν τον κωδικό.', cdn:'Δεν φορτώθηκε η βιβλιοθήκη για online. Έλεγξε τη σύνδεσή σου.', timeout:'Η σύνδεση άργησε πολύ. Δοκίμασε ξανά.' }[e&&e.type] || 'Δεν έγινε η σύνδεση. Δοκίμασε ξανά.';
  show(`<h2>Ωχ!</h2><p class="sub">${t}</p><div class="nav col">${btn('Πίσω','onlineMenu()')}</div>`);
}
function olCleanup(){ if(R){clearInterval(R.h);clearTimeout(R.h2)} try{net&&net.close()}catch(e){} net=null; isHost=false; R=null; C={players:[]}; window.onSeg=window.onClear=null; timer.stop(); }
function olExit(){ olCleanup(); menu(); }

// ---------- ΟΙΚΟΔΕΣΠΟΤΗΣ ----------
async function olHost(n=0){
  if(n===0) readName();
  const code=Array.from({length:4},()=>LETTERS[Math.random()*LETTERS.length|0]).join('');
  show(`<h2>Δημιουργία δωματίου…</h2>`);
  net=makeNet(); isHost=true; myId='host';
  R={code,players:[{id:'host',name:myName,score:0,team:0}],started:false,teamNames:pick(TEAM_NAMES,4),settings:{mode:'solo',time:S.drawTime,cats:[...S.cats],teams:2,rounds:2}};
  try{ await net.open('host',code,{onPeer:()=>{},onMsg:hostMsg,onClose:hostLeft}); lobbyCast(); }
  catch(e){ if(e&&e.type==='unavailable-id'&&n<5){ olCleanup(); return olHost(n+1); } netError(e); }
}
const scores = () => R.players.map(p=>({id:p.id,name:p.name,score:p.score,team:p.team}));
function hsend(to,m){ if(to==='host') clientMsg(m); else net.send(to,m); }
function hcast(m){ net.bcast(m); clientMsg(m); }
function lobbyCast(){ hcast({t:'lobby',code:R.code,players:scores(),settings:R.settings,teamNames:R.teamNames.slice(0,R.settings.teams)}); }
function hostMsg(from,m){
  if(m.t==='hello'){
    if(R.started||R.players.length>=MAX_PLAYERS) return net.send(from,{t:'full'});
    if(!R.players.find(p=>p.id===from)) R.players.push({id:from,name:String(m.name||'Παίκτης').slice(0,16),score:0,team:leastTeam()});
    return lobbyCast();
  }
  if(m.t==='team'&&!R.started){ const p=R.players.find(x=>x.id===from); if(p){ p.team=(p.team+1)%R.settings.teams; lobbyCast(); } return; }
  if(!R.started) return;
  if(m.t==='s'||m.t==='clear'){ if(from!==R.painter) return; R.players.forEach(p=>{ if(p.id!==from&&p.id!=='host') net.send(p.id,m); }); if(from!=='host') clientMsg(m); }
  else if(m.t==='done'&&from===R.painter&&R.mode==='solo') endRound();
  else if(m.t==='pass'&&from===R.painter&&R.mode==='team') hostPass();
  else if(m.t==='guess') (R.mode==='team'?teamGuess:hostGuess)(from,String(m.text||''));
}
function hostLeft(id){
  if(!R) return;
  R.players=R.players.filter(p=>p.id!==id);
  if(!R.started) return lobbyCast();
  if(R.players.length<2) return finish();
  if(R.mode==='team'){ if(id===R.painter&&R.live) endTurn(); return; }
  if(id===R.painter&&R.live) endRound();
  else if(R.live) checkAll();
}
const teamCount = () => { const n=R.settings.teams, c=Array(n).fill(0); R.players.forEach(p=>{ if(p.team<n) c[p.team]++; }); return c; };
const leastTeam = () => { const c=teamCount(); return c.indexOf(Math.min(...c)); };
const teamsOk = (players,n) => { const c=Array(n).fill(0); players.forEach(p=>{ if(p.team<n) c[p.team]++; }); return c.every(x=>x>=2); };
function hostStart(){
  const st=R.settings;
  if(R.players.length<2) return;
  if(st.mode==='team'&&!teamsOk(R.players,st.teams)) return;       // κάθε ομάδα θέλει τουλάχιστον 2 παίκτες
  S.drawTime = st.mode==='team' ? 30 : st.time;                    // όπως και offline: στη Λεξομαχία η δυσκολία είναι 30
  S.cats=[...st.cats];                                              // κενό = όλες οι κατηγορίες
  used=new Set(); R.started=true; R.mode=st.mode;
  if(R.mode==='team'){ R.teams=R.teamNames.slice(0,st.teams).map(n=>({name:n,score:0})); R.pidx=R.teams.map(()=>0); R.turn=0; nextTurn(); }
  else { R.queue=R.players.map(p=>p.id); R.total=R.queue.length; R.round=0; nextRound(); }
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
function finish(){ clearInterval(R.h); clearTimeout(R.h2); R.live=false; hcast({t:'final',players:scores(),teams:R.mode==='team'?R.teams:null}); }
function olSettings(k,v){ if(!isHost) return;
  const st=R.settings, spread=()=>R.players.forEach((p,i)=>p.team=i%st.teams);
  if(k==='time') st.time=v;
  else if(k==='mode'){ st.mode=v; if(v==='team') spread(); }
  else if(k==='teams'){ st.teams=v; spread(); }
  else if(k==='rounds') st.rounds=v;
  else st.cats=st.cats.includes(v)?st.cats.filter(c=>c!==v):[...st.cats,v];
  lobbyCast(); }
function olSwitchTeam(){
  if(isHost){ const p=R.players.find(x=>x.id==='host'); p.team=(p.team+1)%R.settings.teams; lobbyCast(); }
  else net.send('host',{t:'team'});
}

// ---------- ΟΜΑΔΙΚΟ (Λεξομαχία 60΄΄) στον οικοδεσπότη ----------
function nextTurn(){
  const n=R.teams.length, total=n*R.settings.rounds;
  while(R.turn<total && R.players.filter(p=>p.team===R.turn%n).length<2) R.turn++;   // παραλείπονται ομάδες χωρίς αρκετούς παίκτες
  if(R.turn>=total||R.players.length<2) return finish();
  const ti=R.turn%n, mem=R.players.filter(p=>p.team===ti), painter=mem[R.pidx[ti]++%mem.length];
  R.team=ti; R.painter=painter.id; R.word=randomWord(); R.left=R.total=TEAM_TIME; R.live=true; R.found=0;
  hcast({t:'tround',team:ti,teamName:R.teams[ti].name,painter:painter.id,painterName:painter.name,members:mem.map(p=>p.id),i:Math.floor(R.turn/n)+1,n:R.settings.rounds,total:R.left,teams:R.teams});
  hsend(painter.id,{t:'word',word:R.word});
  clearInterval(R.h);
  R.h=setInterval(()=>{ R.left--; hcast({t:'tick',left:R.left}); if(R.left<=0) endTurn(); },1000);
}
function newTeamWord(){ R.word=randomWord(); hsend(R.painter,{t:'word',word:R.word}); hcast({t:'wipe'}); }
function teamGuess(from,text){
  const g=R.players.find(p=>p.id===from);
  if(!R.live||!g||g.team!==R.team||from===R.painter) return;       // μαντεύουν μόνο οι συμπαίκτες του ζωγράφου
  if(normGreek(text)!==normGreek(R.word)) return hsend(from,{t:'wrong'});
  R.teams[R.team].score++; R.found++;
  hcast({t:'tfound',name:g.name,teams:R.teams});
  newTeamWord();
}
function hostPass(){ if(R.live) newTeamWord(); }
function endTurn(){
  if(!R.live) return; R.live=false; clearInterval(R.h);
  hcast({t:'tend',teams:R.teams,teamName:R.teams[R.team].name,found:R.found});
  R.turn++; R.h2=setTimeout(nextTurn,6000);
}

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
  if(T==='lobby'){ C.code=m.code; C.players=m.players; C.settings=m.settings; C.teamNames=m.teamNames; return lobbyView(); }
  if(T==='full'){ alert('Το δωμάτιο είναι γεμάτο ή το παιχνίδι έχει ήδη ξεκινήσει.'); return olExit(); }
  if(T==='round'){ C.mode='solo'; return roundView(m); }
  if(T==='tround'){ C.mode='team'; C.team=m.team; C.members=m.members; C.teams=m.teams; return teamRoundView(m); }
  if(T==='wipe'){ const c=$('#cv'); if(c) c.getContext('2d').clearRect(0,0,c.width,c.height); return; }
  if(T==='tfound'){ C.teams=m.teams; sbView(); logLine(`${esc(m.name)} βρήκε τη λέξη! +1`); const f=$('#fb'); if(f) f.textContent='Σωστό! Επόμενη λέξη…'; const i=$('#gi'); if(i) i.value=''; return; }
  if(T==='tend'){ C.teams=m.teams; return endTeamView(m); }
  if(T==='word'){ const w=$('#ow'); if(w) w.textContent=m.word; C.word=m.word; return; }
  if(T==='s'){ const c=$('#cv'); if(c&&!isPainter()) drawSeg(c.getContext('2d'),m); return; }
  if(T==='clear'){ const c=$('#cv'); if(c&&!isPainter()) c.getContext('2d').clearRect(0,0,c.width,c.height); return; }
  if(T==='tick'){ C.left=m.left; return tickView(); }
  if(T==='wrong'){ const f=$('#fb'); if(f) f.textContent='Λάθος! Προσπάθησε ξανά.'; return; }
  if(T==='found'){ C.players=m.players; sbView(); logLine(`${esc(m.name)} βρήκε τη λέξη! +${m.pts}`);
    if(m.id===myId){ const f=$('#fb'); if(f) f.textContent=`Σωστό! +${m.pts}`; const i=$('#gi'); if(i) i.disabled=true; } return; }
  if(T==='end'){ C.players=m.players; return endView(m); }
  if(T==='final'){ C.players=m.players; C.teams=m.teams; C.mode=m.teams?'team':'solo'; return finalView(); }
}
const isPainter = () => C.painter===myId;
const tickView = () => { const t=$('#tm'); if(!t) return; const s=Math.max(0,C.left); t.textContent=pad(s/60|0)+':'+pad(s%60); };
function lobbyView(){
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  const link=location.origin+location.pathname+'?'+(BC?'bc&':'')+'room='+C.code;
  const set=C.settings||{mode:'solo',time:30,cats:[],teams:2,rounds:2}, team=set.mode==='team';
  const entry=p=>`<div class="entry"><span>${esc(p.name)}${p.id==='host'?' ⭐':''}${p.id===myId?' (εσύ)':''}</span></div>`;
  const names=C.teamNames||[];
  const list=team ? Array.from({length:set.teams},(_,t)=>`<p class="sub"><b>${esc(names[t]||'Ομάδα '+(t+1))}</b></p>`+(C.players.filter(p=>p.team===t).map(entry).join('')||'<p class="sub">—</p>')).join('')
                  : C.players.map(entry).join('');
  const ok=!team||teamsOk(C.players,set.teams), opt=(k,v,label,on)=>`<button class="tb ${on?'on':''}" onclick="olSettings('${k}',${typeof v==='number'?v:`'${v}'`})">${label}</button>`;
  const modeName={solo:'Ζωγράφισε τη λέξη',team:'Λεξομαχία 60΄΄'}[set.mode];
  show(`<h2>Δωμάτιο</h2>
  <div class="cols lob">
    <div class="colx">
      <div class="card"><p class="sub">Κωδικός δωματίου</p><div class="code">${esc(C.code)}</div>
        <p class="sub">Στείλε αυτόν τον σύνδεσμο στους φίλους σου:</p><input type="text" class="plain" readonly value="${esc(link)}" onclick="this.select()">
        <button class="sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(link)}')">Αντιγραφή</button></div>
    </div>
    <div class="colx">
      <p class="sub">Τρόπος παιχνιδιού</p>
      ${isHost?`<div class="times">${opt('mode','solo','Ζωγράφισε τη λέξη',!team)}${opt('mode','team','Λεξομαχία 60΄΄',team)}</div>`:`<p><b>${modeName}</b></p>`}
      <p class="sub">Παίκτες (${C.players.length}/${MAX_PLAYERS})</p>
      <div class="list">${list}</div>
      ${team?`<button class="sm" onclick="olSwitchTeam()">Άλλαξε ομάδα</button>`:''}
      ${isHost?(team?`<p class="sub">Ομάδες</p><div class="times">${[2,3,4].map(n=>opt('teams',n,n,set.teams===n)).join('')}</div>
        <p class="sub">Γύροι (πόσες φορές παίζει κάθε ομάδα)</p><div class="times">${[1,2,3].map(n=>opt('rounds',n,n,set.rounds===n)).join('')}</div>`
        :`<p class="sub">Χρόνος γύρου</p><div class="times">${[30,40,60].map(t=>opt('time',t,t+' δευτ',set.time===t)).join('')}</div>`)+
      `<p class="sub">Κατηγορίες (αν δεν διαλέξεις καμία, παίζουν όλες)</p><div class="tiles">${['Ζώα','Οχήματα','Αντικείμενα','Φαγητά'].map(c=>`<div class="tile ${set.cats.includes(c)?'on':''}" onclick="olSettings('cat','${c}')"><img src="${ICONS[c]}" alt="">${c}</div>`).join('')}</div>`:''}
    </div>
  </div>
  ${ok?'':`<p class="sub" style="color:var(--red)">Κάθε ομάδα χρειάζεται τουλάχιστον 2 παίκτες.</p>`}
  ${isHost?`<div class="nav">${btn('Έξοδος','olExit()','gr')}<button class="bl" ${C.players.length<2||!ok?'disabled':''} onclick="hostStart()">${C.players.length<2?'Περιμένουμε…':'Ξεκίνα'}</button></div>`
  :`<p class="sub">Περιμένουμε τον οικοδεσπότη να ξεκινήσει…</p><div class="nav col">${btn('Έξοδος','olExit()','gr')}</div>`}`,'colsscr');
}
function roundView(m){
  C.painter=m.painter; C.players=m.players; C.left=m.total; C.word=''; $('#ov')?.remove();
  const me=isPainter();
  show(`<div class="play"><div class="hd"><span class="rd">Γύρος ${m.i}/${m.n}</span><span class="timer" id="tm"></span><button class="pb" onclick="olExit()">Εξοδος</button></div>
  <div class="board"><canvas id="cv" width="1024" height="728"></canvas></div>
  <div class="ctl"><p class="sub">${me?'Σειρά σου! Ζωγράφισε: <b id="ow">…</b>':`${esc(m.painterName)} ζωγραφίζει…`}</p>
  ${me?`<div class="tools" id="tools">${toolbar()}</div>${btn('Ολοκλήρωση γύρου',"olSend({t:'done'})",'gr wide')}`
  :`<div class="fb" id="fb"></div><div class="rr">${btn('Υποβολή','olGuess()','ye')}</div><input type="text" class="plain" id="gi" placeholder="Γράψε την απάντηση σου..." autocomplete="off">`}
  <div id="sb" style="display:flex;flex-direction:column;gap:6px"></div><div class="sub" id="log" style="max-height:90px;overflow:auto"></div></div></div>`,'wide');
  if(me){ initCanvas(); window.onSeg=s=>olSend(s); window.onClear=()=>olSend({t:'clear'}); }
  else { window.onSeg=window.onClear=null; $('#gi').addEventListener('keydown',e=>{ if(e.key==='Enter') olGuess(); }); }
  tickView(); sbView();
}
function olSend(m){
  if(isHost){ if(m.t==='done') endRound(); else if(m.t==='pass') hostPass(); else R.players.forEach(p=>{ if(p.id!=='host') net.send(p.id,m); }); }
  else net.send('host',m);
}
function olGuess(){ const i=$('#gi'); const v=i.value.trim(); if(!v||i.disabled) return; if(isHost) (R.mode==='team'?teamGuess:hostGuess)('host',v); else net.send('host',{t:'guess',text:v}); i.value=''; }
function sbView(){ const e=$('#sb'); if(e) e.innerHTML=scoreRows(C.mode==='team'?C.teams:C.players); }
function logLine(h){ const l=$('#log'); if(l){ l.insertAdjacentHTML('afterbegin',`<div>${h}</div>`); } }
function endView(m){
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<div class="card" style="gap:8px"><h2>Η λέξη ήταν: ${esc(m.word)}</h2>${scoreRows(m.players)}<p class="sub">Ο επόμενος γύρος ξεκινά σε λίγο…</p></div>`;
  document.body.appendChild(o);
}
function finalView(){
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  show(`<h2>Τέλος παιχνιδιού!</h2><div class="list">${scoreRows(C.mode==='team'?C.teams:C.players)}</div><div class="nav col">${btn('Πίσω στο μενού','olExit()')}</div>`);
}
// ---------- Λεξομαχία 60΄΄: οθόνες ----------
function teamRoundView(m){
  C.painter=m.painter; C.left=m.total; C.word=''; $('#ov')?.remove();
  const me=isPainter(), mate=m.members.includes(myId);
  show(`<div class="play"><div class="hd"><span class="rd">Γύρος ${m.i}/${m.n}</span><span class="timer" id="tm"></span><button class="pb" onclick="olExit()">Εξοδος</button></div>
  <div class="board"><canvas id="cv" width="1024" height="728"></canvas></div>
  <div class="ctl"><p class="sub">Παίζει η ομάδα: <b>${esc(m.teamName)}</b><br>${me?'Ζωγραφίζεις εσύ!':esc(m.painterName)+' ζωγραφίζει'}</p>
  ${me?`<div class="wordbox" id="ow">…</div><div class="tools" id="tools">${toolbar()}</div>${btn('Πάσο',"olSend({t:'pass'})",'gr wide')}`
  :mate?`<div class="fb" id="fb"></div><div class="rr">${btn('Υποβολή','olGuess()','ye')}</div><input type="text" class="plain" id="gi" placeholder="Γράψε την απάντηση σου..." autocomplete="off">`
  :`<p class="sub">Παίζει η άλλη ομάδα. Περίμενε τη σειρά σου!</p>`}
  <div id="sb" class="list"></div><div class="sub" id="log" style="max-height:90px;overflow:auto"></div></div></div>`,'wide');
  if(me){ initCanvas(); window.onSeg=s=>olSend(s); window.onClear=()=>olSend({t:'clear'}); }
  else { window.onSeg=window.onClear=null; const i=$('#gi'); if(i) i.addEventListener('keydown',e=>{ if(e.key==='Enter') olGuess(); }); }
  tickView(); sbView();
}
function endTeamView(m){
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<div class="card" style="gap:8px"><h2>${esc(m.teamName)}: ${m.found} ${m.found===1?'λέξη':'λέξεις'}</h2>${scoreRows(m.teams)}<p class="sub">Η επόμενη ομάδα ξεκινά σε λίγο…</p></div>`;
  document.body.appendChild(o);
}
// Άνοιγμα από σύνδεσμο ?room=ΚΩΔΙΚΟΣ
{ const room=new URLSearchParams(location.search).get('room'); if(room) joinFromLink(room.toUpperCase().slice(0,4)); }
