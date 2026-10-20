'use strict';
// ====== Δεδομένα (από τα ScriptableObjects του Unity: λέξη + δυσκολία 30/40/60) ======
const WORDS = {"Αντικείμενα": [["Κούπα", 30], ["Μολύβι", 30], ["Κλειδί", 30], ["Βιβλίο", 30], ["Ρολόι", 40], ["Ψαλίδι", 40], ["Καρέκλα", 40], ["Λάμπα", 40], ["Τηλεσκόπιο", 60], ["Πυξίδα", 60], ["Ανεμιστήρας", 60], ["Ραπτομηχανή", 60]], "Φαγητά": [["Μήλο", 30], ["Πίτσα", 30], ["Ψωμί", 30], ["Παγωτό", 30], ["Σουβλάκι", 40], ["Κρουασάν", 40], ["Σαλάτα", 40], ["Κέικ", 40]], "Οχήματα": [["Αυτοκίνητο", 30], ["Ποδήλατο", 30], ["Βάρκα", 30], ["Τρένο", 30], ["Αεροπλάνο", 40], ["Ελικόπτερο", 40], ["Πλοίο", 40], ["Τρακτέρ", 40], ["Διαστημόπλοιο", 60], ["Υποβρύχιο", 60], ["Αερόστατο", 60], ["Φόρμουλα", 60]], "Ζώα": [["Σκύλος", 30], ["Γάτα", 30], ["Ψάρι", 30], ["Πουλί", 30], ["Αλεπού", 40], ["Χελώνα", 40], ["Πάνθηρας", 40], ["Πιγκουίνος", 40], ["Χταπόδι", 60], ["Καμηλοπάρδαλη", 60], ["Ιπποπόταμος", 60], ["Χαμαιλέοντας", 60]]};
const ICONS = {'Οχήματα':'assets/oximata.png','Ζώα':'assets/zoa.png','Αντικείμενα':'assets/zoa.png','Φαγητά':'assets/zoa.png'}; // όπως στο παιχνίδι: τα 'Αντικείμενα' και 'Φαγητά' έχουν το ίδιο εικονίδιο με τα 'Ζώα'
const SOLO_NAMES = ['Μουντζούρης','Πινέλας','Σκιτσάκιας','Χρωμάκιας','Μουτζούρα','Σκιτσόλυκος','ΠινέλοΜάστορας','Γραμμούλης','Σβηστήρας','Καμβάς','Σχεδιάκιας','Μουντζουχτής','ΧρωμοΝίντζα','ΣκιτσοΠιτ','ΜικρόΠινέλο','ΣκιτσοΜάγος','ΧρωμοΛύκος','ΜουντζουΡάκος','ΠινέλοΚινγκ','ΣκιτσοΦάντασμα'];
const TEAM_NAMES = ['Κόκκινοι Πινέλες','Μπλε Σκιτσάκηδες','ΧρωμοΝίντζα','ΜουντζουροΛύκοι','ΣκιτσοΜάγοι','ΠινέλοΚινγκς','ΧρωματοΦαντάσματα','ΣκιτσοΔράκοι','ΜουντζουΡάκοι','ΠινέλοΤάγμα','ΣκιτσοΦλόγες','ΧρωμοΤίγρεις','ΜουντζουΧαμός','ΠινέλοΣμήνος','ΣκιτσοΚεραυνοί'];
const TEAM_TIME = 60;                 // TeamRoundTimer: 60 δευτ.
const BASE = 80, FIRST_BONUS = 40, MAX_PTS = 300, PAINTER_PTS = 1; // ScoreManager

// ====== Βοηθητικά ======
const $ = s => document.querySelector(s), app = $('#app');
const pad = n => String(n).padStart(2,'0');
const pick = (arr,n) => { const a=[...arr],o=[]; while(o.length<n&&a.length) o.push(a.splice(Math.random()*a.length|0,1)[0]); return o; };
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function normGreek(s){ // όπως το NormalizeGreek του Unity (+ τελικό ς)
  return s.toLowerCase().replace(/[άέήίόύώϊΐϋΰ]/g,c=>({'ά':'α','έ':'ε','ή':'η','ί':'ι','ό':'ο','ύ':'υ','ώ':'ω','ϊ':'ι','ΐ':'ι','ϋ':'υ','ΰ':'υ'}[c])).replace(/ς/g,'σ').trim();
}
const snd = {click:new Audio('assets/click2.ogg'), sel:new Audio('assets/select_001.ogg')};
function play(k){ try{ const a=snd[k].cloneNode(); a.play().catch(()=>{}); }catch(e){} }
document.addEventListener('click',e=>{ if(e.target.closest('.cat,.opt')) play('sel'); else if(e.target.closest('button')) play('click'); });

// ====== Κατάσταση ======
const S = {mode:'solo', players:2, teams:2, drawTime:30, guessTime:30, cats:[], names:[], teamNames:[]};
let paused = false, used = new Set();
let G = null;   // κατάσταση παιχνιδιού

// ====== WordManager ======
function randomWord(){
  const cats = S.cats.length ? S.cats : Object.keys(WORDS);
  const all = cats.flatMap(c=>WORDS[c]);
  let pool = all.filter(w=>w[1]===S.drawTime && !used.has(w[0]));
  if(!pool.length) pool = all.filter(w=>!used.has(w[0]));
  if(!pool.length){ used.clear(); pool = all; }
  const w = pool[Math.random()*pool.length|0][0];
  used.add(w); return w;
}

// ====== Χρονόμετρο (σταματά στην παύση) ======
const timer = {t:0,total:0,run:false,h:0,cb:null,sel:'#tm',
  start(sec,cb,sel='#tm'){ this.stop(); this.t=this.total=sec; this.cb=cb; this.sel=sel; this.run=true; this.last=performance.now(); this.draw();
    this.h=setInterval(()=>{ const n=performance.now(),d=(n-this.last)/1000; this.last=n; if(!this.run||paused) return;
      this.t-=d; if(this.t<=0){ this.t=0; this.draw(); const cb=this.cb; this.stop(); cb&&cb(); } else this.draw(); },100); },
  stop(){ this.run=false; clearInterval(this.h); },
  draw(){ const el=$(this.sel); if(!el) return; const s=Math.ceil(Math.max(0,this.t)); el.textContent=pad(s/60|0)+':'+pad(s%60); }};


// ====== Βοηθητικά UI ======
function show(html,cls=''){ document.body.classList.toggle('bluebg',cls.includes('bluescr')); app.innerHTML=`<div class="scr ${cls}">${html}</div>`; window.scrollTo(0,0); }
const btn = (label,fn,cls='bl') => `<button class="${cls}" onclick="${fn}">${label}</button>`;
const nav = (back,next,nl='Επόμενο') => `<div class="nav">${btn('Πίσω',back,'gr')}${btn(nl,next,'bl')}</div>`;
const pb = () => `<button class="pb" onclick="openPause()">Παυση</button>`;
const countPanel = (id,v) => `<div class="count"><button class="pm minus" aria-label="−" onclick="step('${id}',-1)"></button><span id="${id}">${v}</span><button class="pm" aria-label="+" onclick="step('${id}',1)"></button></div>`;
function step(id,d){ const k=id==='pc'?'players':'teams'; S[k]=Math.min(20,Math.max(2,S[k]+d)); $('#'+id).textContent=S[k]; }
function setTime(t){ S.drawTime=S.guessTime=t; document.querySelectorAll('.tb').forEach(b=>b.classList.toggle('on',parseInt(b.textContent)===t)); }
const timeBoxes = () => `<div class="times">${[30,40,60].map(t=>`<button class="tb ${S.drawTime===t?'on':''}" onclick="setTime(${t})">${t} δευτ</button>`).join('')}</div>`;

// ====== Μενού ======
function menu(){
  timer.stop(); paused=false; G=null; $('#ov')?.remove();
  show(`<div class="mid"><img class="logo" src="assets/logo.png" alt="Ζωγράφισε & βρες"></div>
  <div class="nav col">${btn('Παίξε','modePanel()')}${btn('Οδηγίες','instructions()')}</div>`);
}
function modePanel(){
  show(`<h2>Τρόποι παιχνιδιού</h2><p class="sub">Διαλεξε τι θες να παιξεις, μπορεις να παιξεις και ατομικα και σε ομαδες.</p>
  <div class="duo">
    <div class="card"><h3>Offline</h3><p class="sub">Παίξτε όλοι μαζί στην ίδια συσκευή, ατομικά ή σε ομάδες.</p>${btn('Παίξε offline','offlineModes()')}</div>
    <div class="card"><h3>Online</h3><p class="sub">Παίξε με φίλους από οπουδήποτε, ο καθένας από τη δική του συσκευή.</p>${btn('Παίξε online','onlineMenu()')}</div>
  </div>
  <div class="nav col">${btn('Κλείσιμο','menu()','gr')}</div>`,'duoscr');
}
function offlineModes(){
  show(`<h2>Offline</h2><p class="sub">Διαλεξε τον τροπο παιχνιδιου.</p>
  <div class="card"><h3>Ζωγράφισε τη λέξη</h3><p class="sub">Ένας παίκτης ζωγραφίζει τη λέξη και μετά δίνει τη συσκευή στους υπόλοιπους για να τη βρουν.</p>${btn('Ξεκίνα','soloSetup1()')}</div>
  <div class="card"><h3>Λεξομαχία 60΄΄</h3><p class="sub">Ένας παίκτης βλέπει μια κρυφή λέξη, τη ζωγραφίζει, και η ομάδα του πρέπει να βρει τις περισσότερες μέσα σε 1 λεπτό.</p>${btn('Ξεκίνα','teamSetup1()')}</div>
  <div class="nav col">${btn('Πίσω','modePanel()','gr')}</div>`);
}
function instructions(){
  show(`<h2>Οδηγίες Παιχνιδιού</h2>
  <h3 class="red">Ζωγράφισε τη λέξη</h3><ol><li>Ο παιχτης ζωγραφίζει την κρυφή λέξη.</li><li>Μόλις τελειώσει, δίνει τη συσκευή στους υπόλοιπους παίκτες.</li><li>Οι παίκτες προσπαθούν να μαντέψουν τη λέξη από τη ζωγραφιά.</li></ol>
  <h3 class="red">Λεξομαχία 60΄΄</h3><ol><li>Ο παιχτης ζωγραφίζει τις κρυφές λέξεις.</li><li>Παράλληλα δείχνει τη συσκευή στους υπόλοιπους παίκτες, χωρίς να δουν την λέξη.</li><li>Οι παίκτες προσπαθούν να μαντέψουν τις λέξεις από τις ζωγραφιές μέσα σε 1 λεπτό.</li></ol>
  <div class="nav col">${btn('Κλείσιμο','menu()')}</div>`);
}

// ====== Ρυθμίσεις ======
function soloSetup1(){
  S.mode='solo';
  show(`<h2>Αριθμός παιχτών</h2><p class="sub">Διαλεξε τον αριθμο των παιχτων που θα παιξουν (2-20).</p>${countPanel('pc',S.players)}
  <h2>Χρόνος γύρου</h2><p class="sub">Διαλεξε τον χρονο που θα εχει ο καθε παιχτης στη διαθεση του.</p>${timeBoxes()}
  ${nav('offlineModes()','soloSetup2()')}`);
}
function nameFields(n,pool,ph){
  const names=pick(pool,n); while(names.length<n) names.push((ph==='ομάδας'?'Ομάδα':'Παίκτης')+(100+Math.random()*900|0));
  return names.map((nm,i)=>`<input type="text" class="nm" maxlength="24" placeholder="Γράψε όνομα ${ph==='ομάδας'?'ομάδας':'παίκτη'} ${i+1}" value="${esc(nm)}">`).join('');
}
function readNames(pool){
  const u=new Set(); return [...document.querySelectorAll('.nm')].map(e=>e.value.trim()).map(v=>{ if(v){u.add(v);return v;} const f=pool.filter(x=>!u.has(x)); const r=f.length?f[Math.random()*f.length|0]:'Παίκτης'+(100+Math.random()*900|0); u.add(r); return r; });
}
function soloSetup2(){
  show(`<h2>Όνομα παιχτών</h2><p class="sub">Βάλε τα ονόματα που θες ή και όχι... τότε θα δοθούν τυχαία ονόματα.</p>
  <div class="names">${nameFields(S.players,SOLO_NAMES,'παίκτη')}</div>
  ${nav('soloSetup1()',"S.names=readNames(SOLO_NAMES);catSetup('solo')")}`);
}
function tiles(mode){
  const cats=Object.keys(WORDS), all=cats.every(c=>S.cats.includes(c));
  const t=(k,label,ic,on)=>`<div class="tile ${on?'on':''}" onclick="toggleCat('${k}','${mode}')">${ic?`<img src="${ic}" alt="">`:''}${label}</div>`;
  return `<div class="tiles">${t('*','Όλα','',all)}${['Ζώα','Οχήματα','Αντικείμενα','Φαγητά'].map(c=>t(c,c,ICONS[c],S.cats.includes(c))).join('')}</div>`;
}
const catHead = `<h2>Κατηγορίες λέξεων</h2><p class="sub">Διάλεξε τις κατηγορίες από τις οποίες θες να εμφανίζονται λέξεις. Αν δεν διαλέξεις καμία, θα εμφανίζονται λέξεις από όλες.</p>`;
function catSetup(mode){ show(`${catHead}${tiles('solo')}${nav('soloSetup2()','startSolo()','Παίξε')}`); }
function toggleCat(c,mode){
  const cats=Object.keys(WORDS);
  if(c==='*') S.cats=cats.every(x=>S.cats.includes(x))?[]:[...cats];
  else S.cats=S.cats.includes(c)?S.cats.filter(x=>x!==c):[...S.cats,c];
  mode==='solo'?catSetup('solo'):teamSetup1();
}
function teamSetup1(){
  S.mode='team';
  show(`<h2>Αριθμός ομάδων</h2><p class="sub">Διαλεξε τον αριθμο των παιχτων/ομαδων που θα παιξουν (2-20).</p>${countPanel('tc',S.teams)}
  ${catHead}${tiles('team')}${nav('offlineModes()','teamNames()')}`);
}
function teamNames(){
  show(`<h2>Ονόματα ομάδων</h2><p class="sub">Βάλε τα ονόματα που θες ή και όχι... τότε θα δοθούν τυχαία ονόματα.</p>
  <div class="names">${nameFields(S.teams,TEAM_NAMES,'ομάδας')}</div>
  ${nav('teamSetup1()','startTeams(readNames(TEAM_NAMES))','Παίξε')}`);
}

// ====== Εργαλεία ζωγραφικής ======
const tool = {eraser:false, color:'#000', r:15};
function toolbar(){
  return `<button class="sm ${!tool.eraser?'on':''}" onclick="setTool('brush')">Μολύβι</button><button class="sm ${tool.eraser?'on':''}" onclick="setTool('eraser')">Σβήστρα</button><button class="sm" onclick="clearCanvas()">Καθάρισμα</button>`;
}
function setTool(k){ tool.eraser=(k==='eraser'); const t=$('#tools'); if(t) t.innerHTML=toolbar(); }

// ====== Καμβάς ζωγραφικής ======
function drawSeg(x,s){ // ένα κομμάτι γραμμής (χρησιμοποιείται και για τη ζωντανή μετάδοση online)
  x.globalCompositeOperation=s.e?'destination-out':'source-over'; x.strokeStyle=x.fillStyle=s.c; x.lineWidth=s.r*2; x.lineCap=x.lineJoin='round'; x.beginPath();
  if(s.a[0]===s.b[0]&&s.a[1]===s.b[1]){ x.arc(s.a[0],s.a[1],s.r,0,7); x.fill(); } else { x.moveTo(s.a[0],s.a[1]); x.lineTo(s.b[0],s.b[1]); x.stroke(); }
}
function initCanvas(){
  const c=$('#cv'), x=c.getContext('2d'); let down=false, last=null;
  const pt=e=>{const r=c.getBoundingClientRect();return[Math.round((e.clientX-r.left)*c.width/r.width*10)/10,Math.round((e.clientY-r.top)*c.height/r.height*10)/10]};
  const seg=(a,b)=>{ const s={t:'s',a,b,c:tool.color,r:tool.r,e:tool.eraser}; drawSeg(x,s); if(window.onSeg) window.onSeg(s); };
  c.onpointerdown=e=>{ if(paused) return; down=true; c.setPointerCapture(e.pointerId); last=pt(e); seg(last,last); };
  c.onpointermove=e=>{ if(!down||paused) return; const p=pt(e); seg(last,p); last=p; };
  c.onpointerup=c.onpointercancel=()=>{down=false;last=null};
}
function clearCanvas(){ const c=$('#cv'); c.getContext('2d').clearRect(0,0,c.width,c.height); if(window.onClear) window.onClear(); }
function snapshot(){ // ζωγραφιά πάνω σε λευκό φόντο
  const c=$('#cv'), t=document.createElement('canvas'); t.width=c.width; t.height=c.height;
  const x=t.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,t.width,t.height); x.drawImage(c,0,0); return t.toDataURL('image/png');
}


// ====== Παύση ======
function openPause(){
  paused=true;
  const o=document.createElement('div'); o.className='ov'; o.id='ov';
  o.innerHTML=`<h2>Παυση</h2>${btn('Συνεχεια','closePause()','gr')}${btn('Εξοδος','menu()','gr')}`;
  document.body.appendChild(o);
}
function closePause(){ $('#ov')?.remove(); paused=false; }

// ====== ΑΤΟΜΙΚΟ ΠΑΙΧΝΙΔΙ ======
function startSolo(){
  used=new Set(); paused=false;   // αν δεν έχει επιλεγεί καμία κατηγορία, το randomWord() παίρνει από όλες
  G={players:S.names.map(n=>({name:n,score:0})), painter:0};
  startRound();
}
function startRound(){
  G.word=randomWord(); G.firstCorrect=false;
  const p=G.players[G.painter];
  show(`<h2>${esc(p.name)}, σειρά σου να δείξεις το ταλέντο που έχεις στην ζωγραφική!</h2>
  <div class="mid"><div class="scratch"><span>${esc(G.word)}</span><canvas id="sc" width="908" height="316"></canvas></div></div>
  <div class="nav col">${btn('Ζωγράφισε','startDrawing()','ye')}</div>`,'bluescr');
  initScratch();
}
function initScratch(){ // ScratchReveal: ξύσε για να δεις τη λέξη
  const c=$('#sc'), x=c.getContext('2d'), img=new Image(); let down=false, moves=0;
  const cov=document.createElement('canvas'); cov.width=227; cov.height=79; const cx=cov.getContext('2d'); cx.fillStyle='#000';
  img.onload=()=>x.drawImage(img,0,0,c.width,c.height); img.src='assets/scratch.png';
  const erase=e=>{ const r=c.getBoundingClientRect(), px=(e.clientX-r.left)*c.width/r.width, py=(e.clientY-r.top)*c.height/r.height;
    x.globalCompositeOperation='destination-out'; x.beginPath(); x.arc(px,py,40,0,7); x.fill(); cx.beginPath(); cx.arc(px/4,py/4,10,0,7); cx.fill(); };
  const check=()=>{ const d=cx.getImageData(0,0,cov.width,cov.height).data; let t=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) t++; if(t/(d.length/4)>0.6) c.remove(); };
  c.onpointerdown=e=>{ if(paused) return; down=true; c.setPointerCapture(e.pointerId); erase(e); };
  c.onpointermove=e=>{ if(!down||paused) return; erase(e); if(++moves%6===0) check(); };
  c.onpointerup=()=>{ down=false; check(); };
}
const portrait = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
const hd = () => `<div class="hd"><span class="timer" id="tm"></span>${pb()}</div>`;
function startDrawing(){
  G.pt=portrait();
  show(`<div class="play">${hd()}<div class="board ${G.pt?'pt':''}"><canvas id="cv" width="${G.pt?768:1024}" height="${G.pt?1079:728}"></canvas></div>
  <div class="ctl"><div class="tools" id="tools">${toolbar()}</div>${btn('Ολοκλήρωση γύρου','endDrawing()','gr wide')}</div></div>`,'wide');
  initCanvas(); timer.start(S.drawTime, endDrawing);
}
function endDrawing(){
  timer.stop(); G.img=snapshot();
  G.order=G.players.map((_,i)=>i).filter(i=>i!==G.painter); G.gi=0;
  nextGuesser();
}
function nextGuesser(){
  if(G.gi>=G.order.length) return showScores();
  const g=G.players[G.order[G.gi]];
  show(`<h2>${esc(g.name)}, θα καταφέρεις να βρεις την λέξη από την ζωγραφιά?</h2><div class="mid"></div>
  <div class="nav col">${btn('Ξεκίνα','startGuess()','ye')}</div>`,'bluescr');
}
function startGuess(){
  show(`<div class="play">${hd()}<div class="board ${G.pt?'pt':''}"><img src="${G.img}" alt="Ζωγραφιά"></div>
  <div class="ctl"><div class="fb" id="fb"></div><div class="rr">${btn('Υποβολή','submitGuess()','ye')}</div>
  <input type="text" class="plain" id="gi" placeholder="Γράψε την απάντηση σου..." autocomplete="off"></div></div>`,'wide');
  $('#gi').addEventListener('keydown',e=>{ if(e.key==='Enter') submitGuess(); });
  timer.start(S.guessTime, ()=>{ G.gi++; nextGuesser(); });
}
function submitGuess(){
  const v=$('#gi').value.trim(); if(!v) return;
  if(normGreek(v)!==normGreek(G.word)){ $('#fb').textContent='Λάθος! Προσπάθησε ξανά.'; return; }
  $('#fb').textContent='Σωστό!';
  const ratio=Math.min(1,Math.max(0,timer.t/Math.max(.0001,S.guessTime)));
  let pts=BASE+Math.round(BASE*ratio); if(!G.firstCorrect) pts+=FIRST_BONUS; pts=Math.min(pts,MAX_PTS);
  G.firstCorrect=true; G.players[G.order[G.gi]].score+=pts; G.players[G.painter].score+=PAINTER_PTS;
  timer.stop(); G.gi++; setTimeout(nextGuesser,700);
}
function scoreRows(list){
  const cls=['gold','silver','bronze'];
  return [...list].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="entry ${cls[i]||''}"><span>${i+1}. ${esc(p.name)}</span><b>${p.score}</b></div>`).join('');
}
function showScores(){
  const last=G.painter===G.players.length-1;
  show(`<h2>Βαθμολογία</h2><p class="sub">Η λέξη ήταν: <b>${esc(G.word)}</b></p>
  <div class="list">${scoreRows(G.players)}</div>
  <div class="nav col">${btn(last?'Παίξε Ξανά':'Επόμενος Γύρος',last?'menu()':'nextPainter()')}</div>`);
}
function nextPainter(){ G.painter=(G.painter+1)%G.players.length; startRound(); }

// ====== ΟΜΑΔΙΚΟ — Λεξομαχία 60 ======
function startTeams(names){
  S.teamNames=names;
  used=new Set(); paused=false;
  G={teams:names.map(n=>({name:n,score:0})), cur:0};
  teamTurn();
}
function teamTurn(){
  timer.stop(); G.started=false; G.covered=true; G.word=randomWord();
  show(`<h2>Παίζει η ομάδα:<br>${esc(G.teams[G.cur].name)}</h2><div class="mid"></div>
  <div class="nav col">${btn('Ζωγράφισε','painterPhase()','gr')}</div>`,'bluescr');
}
function painterPhase(){
  show(`<div class="play">${hd().replace('></span>','>01:00</span>')}<div class="board"><canvas id="cv" width="1024" height="728"></canvas></div>
  <div class="ctl"><div class="wordbox cover" id="wb"></div><button class="gr wide" id="wbtn" onclick="toggleWord()"></button>
  <div class="tools" id="tools">${toolbar()}</div><div class="r">${btn('Πάσο','teamPass()','gr')}${btn('Σωστό','teamCorrect()','gr')}</div></div></div>`,'wide');
  initCanvas(); coverWord(true);
}
function coverWord(c){ // WordCoverController
  clearTimeout(G.hide); G.covered=c;
  const wb=$('#wb'); if(!wb) return;
  wb.classList.toggle('cover',c); wb.textContent=c?'':G.word;
  const b=$('#wbtn'); b.textContent=c?'Δείξε την λέξη':'Κρύψε την λέξη'; b.className=(c?'gr':'ye')+' wide';
  if(!c) G.hide=setTimeout(()=>coverWord(true),2000);
}
function toggleWord(){
  if(!G.started){ G.started=true; timer.start(TEAM_TIME, teamTimeUp); }
  coverWord(!G.covered);
}
function newWord(){ G.word=randomWord(); clearCanvas(); coverWord(true); }
function teamCorrect(){ G.teams[G.cur].score++; newWord(); }
function teamPass(){ newWord(); }
function teamTimeUp(){
  clearTimeout(G.hide);
  show(`<h2>Βαθμολογία</h2><div class="list">${scoreRows(G.teams)}</div>
  <div class="nav col">${btn('Επόμενη ομάδα','G.cur=(G.cur+1)%G.teams.length;teamTurn()')}</div>`);
}

menu();
