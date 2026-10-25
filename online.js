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
  show(`<h2>Δημιουργία δωματίου...</h2>`);
  net=makeNet(); isHost=true; myId='host';
  R={code,players:[{id:'host',name:myName,score:0,team:0}],started:false,teamNames:pick(TEAM_NAMES,2),settings:{mode:'solo',time:S.drawTime,cats:[...S.cats],teams:2}};
  try{ await net.open('host',code,{onPeer:()=>{},onMsg:hostMsg,onClose:hostLeft}); lobbyCast(); }
  catch(e){ if(e&&e.type==='unavailable-id'&&n<5){ olCleanup(); return olHost(n+1); } netError(e); }
}
const scores = () => R.players.map(p=>({id:p.id,name:p.name,score:p.score,team:p.team}));
function hsend(to,m){ if(to==='host') clientMsg(m); else net.send(to,m); }
function hcast(m){ net.bcast(m); clientMsg(m); }
function lobbyCast(){ hcast({t:'lobby',code:R.code,players:scores(),settings:R.settings,teamNames:R.teamNames}); }
function hostMsg(from,m){
  if(m.t==='hello'){
    if(R.started||R.players.length>=MAX_PLAYERS) return net.send(from,{t:'full'});
    if(!R.players.find(p=>p.id===from)) R.players.push({id:from,name:String(m.name||'Παίκτης').slice(0,16),score:0,team:leastTeam()});
    return lobbyCast();
  }
  if(m.t==='team'&&!R.started){       // ο παίκτης μπαίνει σε ομάδα της επιλογής του
    const p=R.players.find(x=>x.id===from);
    if(p&&Number.isInteger(m.team)&&m.team>=0&&m.team<R.teamNames.length){ p.team=m.team; lobbyCast(); } return; }
  if(m.t==='cat'&&!R.started){          // οποιοσδήποτε παίκτης μπορεί να επιλέξει/αποεπιλέξει κατηγορία
    if(WORDS[m.cat]&&R.players.some(p=>p.id===from)){ const st=R.settings; st.cats=st.cats.includes(m.cat)?st.cats.filter(x=>x!==m.cat):[...st.cats,m.cat]; lobbyCast(); } return; }
  if(m.t==='tname'&&!R.started){       // οποιοσδήποτε παίκτης μπορεί να μετονομάσει τη δική του ομάδα
    const p=R.players.find(x=>x.id===from), nm=String(m.name||'').replace(/\s+/g,' ').trim().slice(0,18);
    if(p&&nm&&p.team>=0&&p.team<R.teamNames.length){ R.teamNames[p.team]=nm; lobbyCast(); } return; }
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
const teamCount = () => { const n=R.teamNames.length, c=Array(n).fill(0); R.players.forEach(p=>{ if(p.team>=0&&p.team<n) c[p.team]++; }); return c; };
const leastTeam = () => { const c=teamCount(); return c.indexOf(Math.min(...c)); };
const teamsOk = (players,n) => { const c=Array(n).fill(0); players.forEach(p=>{ if(p.team>=0&&p.team<n) c[p.team]++; }); return n>=2&&c.every(x=>x>=2); };
function hostStart(){
  const st=R.settings;
  if(R.players.length<2) return;
  if(st.mode==='team'&&!teamsOk(R.players,R.teamNames.length)) return;       // κάθε ομάδα θέλει τουλάχιστον 2 παίκτες
  S.drawTime = st.mode==='team' ? 30 : st.time;                    // όπως και offline: στη Λεξομαχία η δυσκολία είναι 30
  S.cats=[...st.cats];                                              // κενό = όλες οι κατηγορίες
  used=new Set(); R.started=true; R.mode=st.mode;
  if(R.mode==='team'){ R.teams=R.teamNames.map(n=>({name:n,score:0})); R.pidx=R.teams.map(()=>0); R.rounds=Math.max(...teamCount()); R.turn=0; nextTurn(); }   // γύροι = μέγεθος της μεγαλύτερης ομάδας, ώστε να ζωγραφίσουν όλοι
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
const MAX_TEAMS = 6;
function olSettings(k,v){ if(!isHost) return;
  const st=R.settings, spread=()=>R.players.forEach((p,i)=>p.team=i%R.teamNames.length);
  if(k==='time') st.time=v;
  else if(k==='mode'){ st.mode=v; if(v==='team') spread(); }
  else if(k==='addteam'){ if(R.teamNames.length>=MAX_TEAMS) return; const free=TEAM_NAMES.filter(n=>!R.teamNames.includes(n)); R.teamNames.push(free.length?free[Math.random()*free.length|0]:'Ομάδα '+(R.teamNames.length+1)); st.teams=R.teamNames.length; }
  else if(k==='rmteam'){ if(R.teamNames.length<=2||v<0||v>=R.teamNames.length) return;
    R.teamNames.splice(v,1); st.teams=R.teamNames.length;
    R.players.forEach(p=>{ if(p.team===v) p.team=-1; else if(p.team>v) p.team--; });          // οι παίκτες της ομάδας που φεύγει μοιράζονται στις υπόλοιπες
    R.players.forEach(p=>{ if(p.team===-1) p.team=leastTeam(); }); }
  else st.cats=st.cats.includes(v)?st.cats.filter(c=>c!==v):[...st.cats,v];
  lobbyCast(); }
function olCat(c){ if(isHost) olSettings('cat',c); else net.send('host',{t:'cat',cat:c}); }
function olGoTeam(t){
  if(isHost){ const p=R.players.find(x=>x.id==='host'); if(p&&t>=0&&t<R.teamNames.length){ p.team=t; lobbyCast(); } }
  else net.send('host',{t:'team',team:t});
}
function olRename(el){
  const name=el.value.replace(/\s+/g,' ').trim().slice(0,18); if(!name){ lobbyView(); return; }
  if(isHost){ const p=R.players.find(x=>x.id==='host'); if(p){ R.teamNames[p.team]=name; lobbyCast(); } }
  else net.send('host',{t:'tname',name});
}

// ---------- ΟΜΑΔΙΚΟ (Λεξομαχία 60″) στον οικοδεσπότη ----------
function nextTurn(){
  const n=R.teams.length, total=n*R.rounds;
  while(R.turn<total && R.players.filter(p=>p.team===R.turn%n).length<2) R.turn++;   // παραλείπονται ομάδες χωρίς αρκετούς παίκτες
  if(R.turn>=total||R.players.length<2) return finish();
  const ti=R.turn%n, mem=R.players.filter(p=>p.team===ti), painter=mem[R.pidx[ti]++%mem.length];
  R.team=ti; R.painter=painter.id; R.word=randomWord(); R.left=R.total=TEAM_TIME; R.live=true; R.found=0;
  hcast({t:'tround',team:ti,teamName:R.teams[ti].name,painter:painter.id,painterName:painter.name,members:mem.map(p=>p.id),i:Math.floor(R.turn/n)+1,n:R.rounds,total:R.left,teams:R.teams});
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
  show(`<h2>Σύνδεση στο δωμάτιο ${esc(code)}...</h2>`);
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
  if(T==='tfound'){ C.teams=m.teams; const f=$('#fb'); if(f) f.textContent='Σωστό! Επόμενη λέξη...'; const i=$('#gi'); if(i) i.value=''; return; }
  if(T==='tend'){ C.teams=m.teams; return endTeamView(m); }
  if(T==='word'){ const w=$('#ow'); if(w) w.textContent=m.word; C.word=m.word; return; }
  if(T==='s'){ const c=$('#cv'); if(c&&!isPainter()) drawSeg(c.getContext('2d'),m); return; }
  if(T==='clear'){ const c=$('#cv'); if(c&&!isPainter()) c.getContext('2d').clearRect(0,0,c.width,c.height); return; }
  if(T==='tick'){ C.left=m.left; return tickView(); }
  if(T==='wrong'){ const f=$('#fb'); if(f) f.textContent='Λάθος! Προσπάθησε ξανά.'; return; }
  if(T==='found'){ C.players=m.players;
    if(m.id===myId){ const f=$('#fb'); if(f) f.textContent='Σωστό!'; const i=$('#gi'); if(i) i.disabled=true; } return; }
  if(T==='end'){ C.players=m.players; return endView(m); }
  if(T==='final'){ C.players=m.players; C.teams=m.teams; C.mode=m.teams?'team':'solo'; return finalView(); }
}
const isPainter = () => C.painter===myId;
const tickView = () => { const t=$('#tm'); if(!t) return; const s=Math.max(0,C.left); t.textContent=pad(s/60|0)+':'+pad(s%60); };
function copyLink(btn){
  const link=location.origin+location.pathname+'?'+(BC?'bc&':'')+'room='+C.code;
  try{ navigator.clipboard.writeText(link); }catch(e){}
  btn.textContent='Αντιγράφηκε!'; setTimeout(()=>{ btn.textContent='Αντιγραφή συνδέσμου'; },1500);
}
function lobbyView(){
  // κρατάμε το κείμενο που πληκτρολογεί ο παίκτης στο πεδίο ονόματος ομάδας όταν η οθόνη ξαναζωγραφίζεται
  const ae=document.activeElement, keep=ae&&ae.classList&&ae.classList.contains('tn')?{team:ae.dataset.team,value:ae.value,pos:ae.selectionStart}:null;
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  const names=C.teamNames||[], set=C.settings||{mode:'solo',time:30,cats:[]}, team=set.mode==='team', ro=isHost?'':' ro';
  const me=C.players.find(p=>p.id===myId), myTeam=me?me.team:-1;
  const entry=p=>`<div class="entry ${p.id==='host'?'':'grey'}"><span>${esc(p.name)}${p.id==='host'?' ⭐':''}${p.id===myId?' (εσύ)':''}</span></div>`;
  const teamBlock=t=>{
    const mine=t===myTeam, members=C.players.filter(p=>p.team===t);
    return `<div class="tteam"><div class="thead">${mine?`<input type="text" class="tn" data-team="${t}" maxlength="18" value="${esc(names[t])}" aria-label="Όνομα ομάδας" onchange="olRename(this)" onkeydown="if(event.key==='Enter')this.blur()">`:`<b class="tname">${esc(names[t])}</b>`}
      ${mine?'':`<button class="sm" onclick="olGoTeam(${t})">Μπες</button>`}${isHost&&names.length>2?`<button class="sm x" onclick="olSettings('rmteam',${t})" aria-label="Αφαίρεση ομάδας">✕</button>`:''}</div>
      ${members.map(entry).join('')||'<p class="sub">—</p>'}</div>`;
  };
  const list=team ? names.map((_,t)=>teamBlock(t)).join('') : C.players.map(entry).join('');
  const ok=!team||teamsOk(C.players,names.length);
  const opt=(k,v,label,on)=>`<button class="tb ${on?'on':''}" onclick="olSettings('${k}',${typeof v==='number'?v:`'${v}'`})">${label}</button>`;
  show(`<div class="lobby">
    <div class="ltop">
      <div class="lwait">${isHost?'':'Περιμένουμε τον οικοδεσπότη να ξεκινήσει...'}</div>
      <div class="lhead"><h2>Δωμάτιο</h2>
        <div class="lmode"><p class="sub">Τρόπος παιχνιδιού</p><div class="times${ro}">${opt('mode','solo','Ζωγράφισε τη λέξη',!team)}${opt('mode','team','Λεξομαχία 60″',team)}</div></div></div>
      <div class="lcode"><p class="sub">Κωδικός δωματίου</p><div class="code">${esc(C.code)}</div><button class="sm" onclick="copyLink(this)">Αντιγραφή συνδέσμου</button></div>
    </div>
    <div class="lset">
      ${team?`<p class="sub">Οι γύροι είναι όσοι και οι παίκτες της μεγαλύτερης ομάδας: ο καθένας ζωγραφίζει με τη σειρά του και οι συμπαίκτες του μαντεύουν.</p>`
        :`<p class="sub">Χρόνος γύρου</p><div class="times${ro}">${[30,40,60].map(t=>opt('time',t,t+' δευτ.',set.time===t)).join('')}</div>`}
      <p class="sub">Κατηγορίες (τις διαλέγουν όλοι· αν δεν επιλεγεί καμία, παίζουν όλες)</p>
      <div class="tiles">${Object.keys(WORDS).map(c=>`<div class="tile ${set.cats.includes(c)?'on':''}" onclick="olCat('${c}')">${iconHtml(c)}${c}</div>`).join('')}</div>
    </div>
    <div class="lplay"><p class="sub">${team?'Ομάδες':`Παίκτες (${C.players.length}/${MAX_PLAYERS})`}</p>
      <div class="list">${list}</div>
      ${team&&isHost&&names.length<MAX_TEAMS?`<button class="sm" onclick="olSettings('addteam')">+ Προσθήκη ομάδας</button>`:''}
      ${ok?'':`<p class="sub warn">Κάθε ομάδα χρειάζεται τουλάχιστον 2 παίκτες.</p>`}</div>
    <div class="lnav nav">${btn('Έξοδος','olExit()','gr')}${isHost?`<button class="bl" ${C.players.length<2||!ok?'disabled':''} onclick="hostStart()">${C.players.length<2?'Περιμένουμε...':'Ξεκίνα'}</button>`:`<button class="bl" disabled>Περιμένουμε...</button>`}</div>
  </div>`,'lobbyscr');
  if(keep){ const el=document.querySelector(`.tn[data-team="${keep.team}"]`); if(el){ el.value=keep.value; el.focus(); try{ el.setSelectionRange(keep.pos,keep.pos); }catch(e){} } }
}
function roundView(m){
  C.painter=m.painter; C.players=m.players; C.left=m.total; C.word=''; $('#ov')?.remove();
  const me=isPainter();
  show(`<div class="play"><div class="hd"><span class="rd">Γύρος ${m.i}/${m.n}</span><span class="timer" id="tm"></span><button class="pb" onclick="olExit()">Έξοδος</button></div>
  <div class="board"><canvas id="cv" width="1024" height="728"></canvas></div>
  <div class="ctl"><p class="sub">${me?'Σειρά σου! Ζωγράφισε: <b id="ow">...</b>':`${esc(m.painterName)} ζωγραφίζει...`}</p>
  ${me?`<div class="tools" id="tools">${toolbar()}</div>${btn('Ολοκλήρωση γύρου',"olSend({t:'done'})",'gr wide')}`
  :`<div class="fb" id="fb"></div><div class="rr">${btn('Υποβολή','olGuess()','ye')}</div><input type="text" class="plain" id="gi" placeholder="Γράψε την απάντησή σου..." autocomplete="off">`}</div></div>`,me?'wide paintscr':'wide');
  if(me){ initCanvas(); rotHint(); window.onSeg=s=>olSend(s); window.onClear=()=>olSend({t:'clear'}); }
  else { window.onSeg=window.onClear=null; $('#gi').addEventListener('keydown',e=>{ if(e.key==='Enter') olGuess(); }); }
  tickView();
}
function olSend(m){
  if(isHost){ if(m.t==='done') endRound(); else if(m.t==='pass') hostPass(); else R.players.forEach(p=>{ if(p.id!=='host') net.send(p.id,m); }); }
  else net.send('host',m);
}
function olGuess(){ const i=$('#gi'); const v=i.value.trim(); if(!v||i.disabled) return; if(isHost) (R.mode==='team'?teamGuess:hostGuess)('host',v); else net.send('host',{t:'guess',text:v}); i.value=''; }
function endView(m){
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<div class="card" style="gap:8px"><h2>Η λέξη ήταν: ${esc(m.word)}</h2>${scoreRows(m.players)}<p class="sub">Ο επόμενος γύρος ξεκινά σε λίγο...</p></div>`;
  document.body.appendChild(o);
}
function finalView(){
  window.onSeg=window.onClear=null; $('#ov')?.remove();
  show(`<h2>Τέλος παιχνιδιού!</h2><div class="list">${scoreRows(C.mode==='team'?C.teams:C.players)}</div><div class="nav col">${btn('Πίσω στο μενού','olExit()')}</div>`);
}
// ---------- Λεξομαχία 60″: οθόνες ----------
function teamRoundView(m){
  C.painter=m.painter; C.left=m.total; C.word=''; $('#ov')?.remove();
  const me=isPainter(), mate=m.members.includes(myId);
  show(`<div class="play"><div class="hd"><span class="rd">Γύρος ${m.i}/${m.n}</span><span class="timer" id="tm"></span><button class="pb" onclick="olExit()">Έξοδος</button></div>
  <div class="board"><canvas id="cv" width="1024" height="728"></canvas></div>
  <div class="ctl"><p class="sub">Παίζει η ομάδα: <b>${esc(m.teamName)}</b><br>${me?'Ζωγραφίζεις εσύ!':esc(m.painterName)+' ζωγραφίζει'}</p>
  ${me?`<div class="wordbox" id="ow">...</div><div class="tools" id="tools">${toolbar()}</div>${btn('Πάσο',"olSend({t:'pass'})",'gr wide')}`
  :mate?`<div class="fb" id="fb"></div><div class="rr">${btn('Υποβολή','olGuess()','ye')}</div><input type="text" class="plain" id="gi" placeholder="Γράψε την απάντησή σου..." autocomplete="off">`
  :`<p class="sub">Παίζει η άλλη ομάδα. Περίμενε τη σειρά σου!</p>`}</div></div>`,me?'wide paintscr':'wide');
  if(me){ initCanvas(); rotHint(); window.onSeg=s=>olSend(s); window.onClear=()=>olSend({t:'clear'}); }
  else { window.onSeg=window.onClear=null; const i=$('#gi'); if(i) i.addEventListener('keydown',e=>{ if(e.key==='Enter') olGuess(); }); }
  tickView();
}
function endTeamView(m){
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<div class="card" style="gap:8px"><h2>${esc(m.teamName)}: ${m.found} ${m.found===1?'λέξη':'λέξεις'}</h2>${scoreRows(m.teams)}<p class="sub">Η επόμενη ομάδα ξεκινά σε λίγο...</p></div>`;
  document.body.appendChild(o);
}
// Άνοιγμα από σύνδεσμο ?room=ΚΩΔΙΚΟΣ
{ const room=new URLSearchParams(location.search).get('room'); if(room) joinFromLink(room.toUpperCase().slice(0,4)); }
