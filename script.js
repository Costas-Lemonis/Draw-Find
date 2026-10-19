'use strict';
// ====== Δεδομένα (από τα ScriptableObjects του Unity: λέξη + δυσκολία 30/40/60) ======
const WORDS = {"Αντικείμενα": [["Κούπα", 30], ["Μολύβι", 30], ["Κλειδί", 30], ["Βιβλίο", 30], ["Ρολόι", 40], ["Ψαλίδι", 40], ["Καρέκλα", 40], ["Λάμπα", 40], ["Τηλεσκόπιο", 60], ["Πυξίδα", 60], ["Ανεμιστήρας", 60], ["Ραπτομηχανή", 60]], "Φαγητά": [["Μήλο", 30], ["Πίτσα", 30], ["Ψωμί", 30], ["Παγωτό", 30], ["Σουβλάκι", 40], ["Κρουασάν", 40], ["Σαλάτα", 40], ["Κέικ", 40]], "Οχήματα": [["Αυτοκίνητο", 30], ["Ποδήλατο", 30], ["Βάρκα", 30], ["Τρένο", 30], ["Αεροπλάνο", 40], ["Ελικόπτερο", 40], ["Πλοίο", 40], ["Τρακτέρ", 40], ["Διαστημόπλοιο", 60], ["Υποβρύχιο", 60], ["Αερόστατο", 60], ["Φόρμουλα", 60]], "Ζώα": [["Σκύλος", 30], ["Γάτα", 30], ["Ψάρι", 30], ["Πουλί", 30], ["Αλεπού", 40], ["Χελώνα", 40], ["Πάνθηρας", 40], ["Πιγκουίνος", 40], ["Χταπόδι", 60], ["Καμηλοπάρδαλη", 60], ["Ιπποπόταμος", 60], ["Χαμαιλέοντας", 60]]};
const ICONS = {'Οχήματα':'assets/oximata.png','Ζώα':'assets/zoa.png','Αντικείμενα':'🔑','Φαγητά':'🍕'};
const SOLO_NAMES = ['Μουντζούρης','Πινέλας','Σκιτσάκιας','Χρωμάκιας','Μουτζούρα','Σκιτσόλυκος','ΠινέλοΜάστορας','Γραμμούλης','Σβηστήρας','Καμβάς','Σχεδιάκιας','Μουντζουχτής','ΧρωμοΝίντζα','ΣκιτσοΠιτ','ΜικρόΠινέλο','ΣκιτσοΜάγος','ΧρωμοΛύκος','ΜουντζουΡάκος','ΠινέλοΚινγκ','ΣκιτσοΦάντασμα'];
const TEAM_NAMES = ['Κόκκινοι Πινέλες','Μπλε Σκιτσάκηδες','ΧρωμοΝίντζα','ΜουντζουροΛύκοι','ΣκιτσοΜάγοι','ΠινέλοΚινγκς','ΧρωματοΦαντάσματα','ΣκιτσοΔράκοι','ΜουντζουΡάκοι','ΠινέλοΤάγμα','ΣκιτσοΦλόγες','ΧρωμοΤίγρεις','ΜουντζουΧαμός','ΠινέλοΣμήνος','ΣκιτσοΚεραυνοί'];
const COLORS = ['#000000','#e03131','#1c7ed6','#2f9e44','#f59f00','#9c36b5','#8d5524'];
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
const S = {mode:'solo', players:2, teams:2, drawTime:30, guessTime:30, cats:Object.keys(WORDS), names:[], teamNames:[]};
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

const show = html => { app.innerHTML = html; };
const pauseBtn = () => `<button class="sm" onclick="openPause()">Παυση</button>`;

// ====== Μενού ======
function menu(){
  timer.stop(); paused=false; G=null; $('#ov')?.remove();
  show(`<img class="logo" src="assets/logo.png" alt="Ζωγράφισε & βρες">
  <button class="main" onclick="modePanel()">Ξεκίνα</button>`);
}
function modePanel(){
  show(`<h2>Τρόποι παιχνιδιού</h2>
  <p>Διαλεξε τι θες να παιξεις, μπορεις να παιξεις και ατομικα και σε ομαδες.</p>
  <div class="card"><h2>Παίξε ατομικά</h2><p>Ένας παίκτης ζωγραφίζει τη λέξη και μετά δίνει τη συσκευή στους υπόλοιπους για να τη βρουν.</p>
  <button class="main" onclick="soloSetup1()">Παίξε ατομικά</button></div>
  <div class="card"><h2>Λεξομαχία 60</h2><p>Ένας παίκτης βλέπει μια κρυφή λέξη, τη ζωγραφίζει, και η ομάδα του πρέπει να βρει τις περισσότερες μέσα σε 1 λεπτό.</p>
  <button class="main" onclick="teamSetup1()">Παίξε ομαδικά</button></div>
  <div class="card"><h2>Online</h2><p>Παίξε με φίλους από οπουδήποτε, ο καθένας από τη δική του συσκευή.</p>
  <button class="main" onclick="onlineMenu()">Παίξε online</button></div>
  <div class="row"><button onclick="menu()">Πίσω</button><button onclick="instructions()">Οδηγίες</button></div>`);
}
function instructions(){
  show(`<h2>Οδηγίες Παιχνιδιού</h2>
  <div class="card"><h2>Ζωγράφισε τη λέξη</h2><ol><li>Ο παιχτης ζωγραφίζει την κρυφή λέξη.</li><li>Μόλις τελειώσει, δίνει τη συσκευή στους υπόλοιπους παίκτες.</li><li>Οι παίκτες προσπαθούν να μαντέψουν τη λέξη από τη ζωγραφιά.</li></ol></div>
  <div class="card"><h2>Λεξομαχία 60</h2><ol><li>Ο παιχτης ζωγραφίζει τις κρυφές λέξεις.</li><li>Παράλληλα δείχνει τη συσκευή στους υπόλοιπους παίκτες, χωρίς να δουν την λέξη.</li><li>Οι παίκτες προσπαθούν να μαντέψουν τις λέξεις από τις ζωγραφιές μέσα σε 1 λεπτό.</li></ol></div>
  <button onclick="modePanel()">Κλείσιμο</button>`);
}

// ====== Βήματα ρυθμίσεων ======
const stepper = (id,val) => `<div class="stepper"><button onclick="step('${id}',-1)">−</button><span id="${id}">${val}</span><button onclick="step('${id}',1)">+</button></div>`;
function step(id,d){ const k=id==='pc'?'players':'teams'; S[k]=Math.min(20,Math.max(2,S[k]+d)); $('#'+id).textContent=S[k]; }
const timeOpts = (key,label) => `<div class="card"><p>${label}</p><div class="row">${[30,40,60].map(t=>`<button class="opt ${S[key]===t?'on':''}" onclick="setTime('${key}',${t})">${t} δευτ</button>`).join('')}</div></div>`;
function setTime(key,t){ S[key]=t; document.querySelectorAll(`[onclick^="setTime('${key}'"]`).forEach(b=>b.classList.toggle('on',b.textContent.startsWith(t+' '))); }

function soloSetup1(){
  S.mode='solo';
  show(`<h2>Αριθμός παιχτών</h2><p>Διαλεξε τον αριθμο των παιχτων που θα παιξουν (2-20).</p>
  <div class="card">${stepper('pc',S.players)}</div>
  ${timeOpts('drawTime','Χρόνος ζωγραφικής (δυσκολία λέξεων)')}
  ${timeOpts('guessTime','Διαλεξε τον χρονο που θα εχει ο καθε παιχτης στη διαθεση του.')}
  <div class="row"><button onclick="modePanel()">Πίσω</button><button class="main" onclick="soloSetup2()">Επόμενο</button></div>`);
}
function nameFields(n,pool,ph){
  const names=pick(pool,n); while(names.length<n) names.push((ph==='ομάδας'?'Ομάδα':'Παίκτης')+(100+Math.random()*900|0));
  return names.map((nm,i)=>`<input type="text" class="nm" maxlength="24" placeholder="Γράψε όνομα ${ph==='ομάδας'?'ομάδας':'παίκτη'} ${i+1}" value="${esc(nm)}">`).join('');
}
function readNames(pool){
  const used=new Set(); return [...document.querySelectorAll('.nm')].map(e=>e.value.trim()).map(v=>{ if(v) {used.add(v);return v;} const f=pool.filter(x=>!used.has(x)); const r=f.length?f[Math.random()*f.length|0]:'Παίκτης'+(100+Math.random()*900|0); used.add(r); return r; });
}
function soloSetup2(){
  show(`<h2>Όνομα παιχτών</h2><p>Βάλε τα ονόματα που θες ή και όχι... τότε θα δοθούν τυχαία ονόματα.</p>
  <div class="names">${nameFields(S.players,SOLO_NAMES,'παίκτη')}</div>
  <div class="row"><button onclick="soloSetup1()">Πίσω</button><button class="main" onclick="S.names=readNames(SOLO_NAMES);catSetup('solo')">Επόμενο</button></div>`);
}
function catSetup(mode){
  const cats=Object.keys(WORDS), all=cats.every(c=>S.cats.includes(c));
  const back = mode==='solo' ? 'soloSetup2()' : 'teamSetup2()';
  show(`<h2>Κατηγορίες λέξεων</h2><p>Διάλεξε τις κατηγορίες από τις οποίες θες να εμφανίζονται λέξεις.</p>
  <div class="row"><div class="cat ${all?'on':''}" onclick="toggleCat('*','${mode}')"><span class="ic">⭐</span>Όλα</div>
  ${cats.map(c=>`<div class="cat ${S.cats.includes(c)?'on':''}" onclick="toggleCat('${c}','${mode}')">${ICONS[c].endsWith('.png')?`<img src="${ICONS[c]}" alt="">`:`<span class="ic">${ICONS[c]}</span>`}${c}</div>`).join('')}</div>
  <div class="row"><button onclick="${back}">Πίσω</button><button class="main" onclick="${mode==='solo'?'startSolo()':'teamNames()'}">${mode==='solo'?'Παίξε':'Επόμενο'}</button></div>`);
}
function toggleCat(c,mode){
  const cats=Object.keys(WORDS);
  if(c==='*') S.cats = cats.every(x=>S.cats.includes(x)) ? [] : [...cats];
  else S.cats = S.cats.includes(c) ? S.cats.filter(x=>x!==c) : [...S.cats,c];
  catSetup(mode);
}
function teamSetup1(){
  S.mode='team';
  show(`<h2>Αριθμός ομάδων</h2><p>Διαλεξε τον αριθμο των παιχτων/ομαδων που θα παιξουν (2-20).</p>
  <div class="card">${stepper('tc',S.teams)}</div>
  <div class="row"><button onclick="modePanel()">Πίσω</button><button class="main" onclick="catSetup('team')">Επόμενο</button></div>`);
}
const teamSetup2 = teamSetup1;
function teamNames(){
  show(`<h2>Ονόματα ομάδων</h2><p>Βάλε τα ονόματα που θες ή και όχι... τότε θα δοθούν τυχαία ονόματα.</p>
  <div class="names">${nameFields(S.teams,TEAM_NAMES,'ομάδας')}</div>
  <div class="row"><button onclick="catSetup('team')">Πίσω</button><button class="main" onclick="startTeams(readNames(TEAM_NAMES))">Ξεκίνα</button></div>`);
}

// ====== Καμβάς ζωγραφικής (TextureDrawing) ======
const tool = {eraser:false, color:COLORS[0], r:15};
function toolbar(){
  return `<div class="row">${COLORS.map(c=>`<button class="sw ${!tool.eraser&&tool.color===c?'on':''}" style="background:${c}" onclick="setTool('color','${c}')" aria-label="χρώμα"></button>`).join('')}</div>
  <div class="row"><button class="sm tool ${!tool.eraser?'on':''}" onclick="setTool('brush')">Μολύβι</button><button class="sm tool ${tool.eraser?'on':''}" onclick="setTool('eraser')">Σβήστρα</button>
  ${[6,15,30].map(r=>`<button class="sm tool ${tool.r===r?'on':''}" onclick="setTool('size',${r})">${r===6?'•':r===15?'●':'⬤'}</button>`).join('')}
  <button class="sm" onclick="clearCanvas()">Καθάρισμα</button></div>`;
}
function setTool(k,v){
  if(k==='color'){tool.color=v;tool.eraser=false} else if(k==='brush') tool.eraser=false; else if(k==='eraser') tool.eraser=true; else tool.r=v;
  const t=$('#tools'); if(t) t.innerHTML=toolbar();
}
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
  o.innerHTML=`<div class="card" style="max-width:380px"><h2>Παυση</h2><button class="main" onclick="closePause()">Συνεχεια</button><button onclick="menu()">Εξοδος</button></div>`;
  document.body.appendChild(o);
}
function closePause(){ $('#ov')?.remove(); paused=false; }

// ====== ΑΤΟΜΙΚΟ ΠΑΙΧΝΙΔΙ (GameManager) ======
function startSolo(){
  if(!S.cats.length) S.cats=Object.keys(WORDS);
  used=new Set(); paused=false;
  G={players:S.names.map(n=>({name:n,score:0})), painter:0};
  startRound();
}
function startRound(){
  G.word=randomWord(); G.firstCorrect=false;
  const p=G.players[G.painter];
  show(`<div class="top">${pauseBtn()}<span></span></div>
  <h2>${esc(p.name)}, σειρά σου να δείξεις το ταλέντο που έχεις στην ζωγραφική!</h2>
  <div class="scratch"><span id="sw">${esc(G.word)}</span><canvas id="sc" width="908" height="316"></canvas></div>
  <button class="main" onclick="startDrawing()">Ξεκίνα</button>`);
  initScratch();
}
function initScratch(){ // ScratchReveal: ξύσε για να δεις τη λέξη
  const c=$('#sc'), x=c.getContext('2d'), img=new Image(); let down=false, moves=0;
  // Ξεχωριστός μικρός καμβάς που μετράει πόσο έχει σβηστεί (δουλεύει και με file://, χωρίς "tainted canvas")
  const cov=document.createElement('canvas'); cov.width=227; cov.height=79; const cx=cov.getContext('2d'); cx.fillStyle='#000';
  img.onload=()=>x.drawImage(img,0,0,c.width,c.height); img.src='assets/scratch.png';
  const erase=e=>{ const r=c.getBoundingClientRect(), px=(e.clientX-r.left)*c.width/r.width, py=(e.clientY-r.top)*c.height/r.height;
    x.globalCompositeOperation='destination-out'; x.beginPath(); x.arc(px,py,40,0,7); x.fill();
    cx.beginPath(); cx.arc(px/4,py/4,10,0,7); cx.fill(); };
  const check=()=>{ const d=cx.getImageData(0,0,cov.width,cov.height).data; let t=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) t++; if(t/(d.length/4)>0.6) c.remove(); };
  c.onpointerdown=e=>{ if(paused) return; down=true; c.setPointerCapture(e.pointerId); erase(e); };
  c.onpointermove=e=>{ if(!down||paused) return; erase(e); if(++moves%6===0) check(); };
  c.onpointerup=()=>{ down=false; check(); };
}
function startDrawing(){
  const p=G.players[G.painter];
  show(`<div class="top">${pauseBtn()}<span class="timer" id="tm"></span><span class="fb">${esc(p.name)}</span></div>
  <div class="board"><canvas id="cv" width="1024" height="640"></canvas></div>
  <div id="tools">${toolbar()}</div>
  <button class="main" onclick="endDrawing()">Ολοκλήρωση γύρου</button>`);
  initCanvas();
  timer.start(S.drawTime, endDrawing);
}
function endDrawing(){
  timer.stop(); G.img=snapshot();
  G.order=G.players.map((_,i)=>i).filter(i=>i!==G.painter); G.gi=0;
  nextGuesser();
}
function nextGuesser(){
  if(G.gi>=G.order.length) return showScores();
  const g=G.players[G.order[G.gi]];
  show(`<div class="top">${pauseBtn()}<span></span></div>
  <h2>${esc(g.name)}, θα καταφέρεις να βρεις την λέξη από την ζωγραφιά?</h2>
  <button class="main" onclick="startGuess()">Ξεκίνα</button>`);
}
function startGuess(){
  show(`<div class="top">${pauseBtn()}<span class="timer" id="tm"></span><span></span></div>
  <div class="board"><img src="${G.img}" alt="Ζωγραφιά"></div>
  <input type="text" id="gi" placeholder="Γράψε την απάντηση σου" autocomplete="off">
  <div class="fb" id="fb"></div>
  <button class="main" onclick="submitGuess()">Μάντεψε</button>`);
  $('#gi').addEventListener('keydown',e=>{ if(e.key==='Enter') submitGuess(); });
  timer.start(S.guessTime, ()=>{ G.gi++; nextGuesser(); });
}
function submitGuess(){
  const v=$('#gi').value.trim(); if(!v) return;
  if(normGreek(v)!==normGreek(G.word)){ $('#fb').textContent='Λάθος! Προσπάθησε ξανά.'; return; }
  $('#fb').textContent='Σωστό!';
  const ratio=Math.min(1,Math.max(0,timer.t/Math.max(.0001,S.guessTime)));       // ScoreManager.AwardForCorrectGuess
  let pts=BASE+Math.round(BASE*ratio); if(!G.firstCorrect) pts+=FIRST_BONUS; pts=Math.min(pts,MAX_PTS);
  G.firstCorrect=true; G.players[G.order[G.gi]].score+=pts; G.players[G.painter].score+=PAINTER_PTS;
  timer.stop(); G.gi++; setTimeout(nextGuesser,700);
}
function scoreRows(list){
  const colors=['var(--gold)','#ccc','var(--bronze)'];
  return [...list].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="entry" style="background:${colors[i]||'var(--soft)'}"><span>${i+1}. ${esc(p.name)}</span><b>${p.score}</b></div>`).join('');
}
function showScores(){
  const last=G.painter===G.players.length-1;
  show(`<h2>Βαθμολογία</h2><p>Η λέξη ήταν: <b>${esc(G.word)}</b></p>
  <div class="card" style="max-height:55vh;overflow:auto">${scoreRows(G.players)}</div>
  <button class="main" onclick="${last?'menu()':'nextPainter()'}">${last?'Παίξε Ξανά':'Επόμενος Γύρος'}</button>`);
}
function nextPainter(){ G.painter=(G.painter+1)%G.players.length; startRound(); }

// ====== ΟΜΑΔΙΚΟ ΠΑΙΧΝΙΔΙ — Λεξομαχία 60 (TeamGameManager) ======
function startTeams(names){
  S.teamNames=names; if(!S.cats.length) S.cats=Object.keys(WORDS);
  used=new Set(); paused=false;
  G={teams:names.map(n=>({name:n,score:0})), cur:0};
  teamTurn();
}
function teamTurn(){
  timer.stop(); G.started=false; G.covered=true; G.word=randomWord();
  const t=G.teams[G.cur];
  show(`<div class="top">${pauseBtn()}<span></span></div>
  <p>Παίζει η ομάδα: ${esc(t.name)}</p>
  <h2>${esc(t.name)}, σειρά σου διαλεξε εναν παιχτη για ζωγράφο!</h2>
  <button class="main" onclick="painterPhase()">Ξεκινάμε</button>`);
}
function painterPhase(){
  const t=G.teams[G.cur];
  show(`<div class="top">${pauseBtn()}<span class="timer" id="tm">01:00</span><span>${esc(t.name)}: ${t.score}</span></div>
  <div class="row"><div class="wordbox cover" id="wb"></div><button class="sm" id="wbtn" onclick="toggleWord()"></button></div>
  <div class="board"><canvas id="cv" width="1024" height="640"></canvas></div>
  <div id="tools">${toolbar()}</div>
  <div class="row"><button class="main" onclick="teamCorrect()">Σωστό</button><button onclick="teamPass()">Πάσο</button></div>`);
  initCanvas(); coverWord(true);
}
function coverWord(c){ // WordCoverController
  clearTimeout(G.hide); G.covered=c;
  const wb=$('#wb'); if(!wb) return;
  wb.classList.toggle('cover',c); wb.textContent=c?'• • • • •':G.word;
  $('#wbtn').textContent=c?'Δείξε την λέξη':'Κρύψε την λέξη';
  if(!c) G.hide=setTimeout(()=>coverWord(true),2000);   // αυτόματη απόκρυψη μετά από 2 δευτ.
}
function toggleWord(){
  if(!G.started){ G.started=true; timer.start(TEAM_TIME, teamTimeUp); }   // το χρονόμετρο ξεκινά στο πρώτο «Δείξε»
  coverWord(!G.covered);
}
function newWord(){ G.word=randomWord(); clearCanvas(); coverWord(true); }
function teamCorrect(){ G.teams[G.cur].score++; newWord(); $('.top span:last-child').textContent=`${G.teams[G.cur].name}: ${G.teams[G.cur].score}`; }
function teamPass(){ newWord(); }
function teamTimeUp(){
  clearTimeout(G.hide);
  show(`<h2>Βαθμολογία</h2><div class="card" style="max-height:60vh;overflow:auto">${scoreRows(G.teams)}</div>
  <button class="main" onclick="G.cur=(G.cur+1)%G.teams.length;teamTurn()">Επόμενη ομάδα</button>`);
}

menu();
