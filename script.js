const BT_SPP_UUID='00001101-0000-1000-8000-00805f9b34fb';
const COLORS=['#ff4d6d','#ff9f1c','#ffe66d','#2ec4b6','#4cc9f0','#7b61ff','#f15bb5','#80ed99'];
const PATTERNS=[['CHASER','➡️ Chaser'],['REVERSE','⬅️ Reverse'],['PINGPONG','↔️ Ping-Pong'],['ALTERNATE','🔀 Alternate'],
 ['BLINKALL','✨ Blink All'],['TWINKLE','🌟 Twinkle'],['FILL','📶 Fill'],['CENTER','🎯 Center Out'],['AUTO','🎆 Auto Mix'],
 ['COMET','☄️ Comet'],['SPARKLE','💫 Sparkle'],['WAVE','🌊 Wave'],['HEARTBEAT','💓 Heartbeat'],['DIYA','🪔 Diya Glow'],
 ['SCAN2','⇄ Two Chasers'],['BOUNCE2','🔁 Bounce Meet'],['INWARD','⏩ Close In'],['PAIRS','👯 Pairs'],['TRIPLE','3️⃣ Every Third'],['QUAD','🚂 Train'],['FILLR','📶 Fill Right'],['DRAIN','🔻 Drain'],['FILLDRAIN','🔄 Fill & Drain'],['RANDOM','🎲 Random'],['STROBE','⚡ Strobe'],['HALVES','◐ Halves'],['BINARY','💻 Binary Count'],['KNIGHT','🚗 Scanner'],['SPLIT','↔️ Split Out'],['BLOCKS','🧱 Blocks'],['RANDOM1','🎯 Single Random'],['RAIN','🌧 Rain'],['SPREAD','🌸 Spread'],['MARCH','🥁 March'],['STOP','⏹ Stop']];
const AUTO_LIST=PATTERNS.map(p=>p[0]).filter(k=>k!=='AUTO'&&k!=='STOP');
const PRESETS=[['🪔 Diya Row','10101010'],['🌕 Centre Glow','00111100'],['🎀 Edges','11000011'],['🏮 Full Bright','11111111']];
const GREETINGS=['Happy Diwali','शुभ दीपावली','শুভ দীপাবলি','Shubh Deepavali'];
const $=id=>document.getElementById(id);
let port,writer,reader,keepReading=false,demo=false,connected=false,curBits='00000000';
const store={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

/* ---------- build UI ---------- */
const tiles=[],hangs=[],chips={};
COLORS.forEach((c,i)=>{
  const h=document.createElement('div');h.className='hb';h.style.setProperty('--c',c);$('hang').appendChild(h);hangs.push(h);
  const t=document.createElement('button');t.className='tile';t.disabled=true;t.style.setProperty('--c',c);
  t.innerHTML=`<div class="lamp"></div><span>Relay ${i+1}</span>`;
  t.onclick=()=>send(`R${i+1}:${t.classList.contains('on')?0:1}`);
  $('tiles').appendChild(t);tiles.push(t);
});
PATTERNS.forEach(([k,l])=>{
  const b=document.createElement('button');b.className='chip'+(k==='STOP'?' stop':'');b.textContent=l;b.disabled=true;
  b.onclick=()=>send('PAT:'+k);$('pats').appendChild(b);chips[k]=b;
});

function log(m){const t=new Date().toLocaleTimeString([], {hour12:false});$('log').textContent+=`[${t}] ${m}\n`;$('log').scrollTop=1e9}

/* ---------- state display ---------- */
function setConnected(c){
  connected=c;
  $('dot').classList.toggle('on',c);
  $('statusText').textContent=c?(demo?'Demo mode':'Connected'):'Disconnected';
  $('connectBtn').textContent=c&&!demo?'Disconnect':'Connect to HC-05';
  $('connectBtn').classList.toggle('live',c&&!demo);
  $('demoBtn').classList.toggle('active',demo);$('demoBtn').textContent=demo?'⏹ Exit Demo':'🧪 Demo Mode';
  tiles.forEach(t=>t.disabled=!c);Object.values(chips).forEach(b=>b.disabled=!c);
  ['allOn','allOff','speed','sleep','party','saveScene'].forEach(id=>$(id).disabled=!c);
  document.querySelectorAll('#scenes .chip').forEach(b=>b.disabled=!c);
  if(!c){showBits('00000000');showPattern('STOP');setParty(false);$('sleep').value='0';setSleep(0)}
}
function showBits(bits){
  curBits=bits;
  tiles.forEach((t,i)=>{const on=bits[i]==='1';t.classList.toggle('on',on);hangs[i].classList.toggle('on',on)});
  $('lit').textContent=[...bits].filter(x=>x==='1').length+'/8 lit';
}
function showPattern(p){Object.entries(chips).forEach(([k,b])=>b.classList.toggle('active',k===p&&p!=='STOP'))}

/* ---------- scenes ---------- */
function renderScenes(){
  $('scenes').innerHTML='';
  const custom=store.get('scenes',[]);
  [...PRESETS.map(s=>[...s,false]),...custom.map(s=>[...s,true])].forEach(([name,mask,del],idx)=>{
    const b=document.createElement('button');b.className='chip';b.disabled=!connected;b.textContent=name;
    b.onclick=()=>send('MASK:'+mask);
    if(del){const x=document.createElement('span');x.className='x';x.textContent='✕';
      x.onclick=e=>{e.stopPropagation();store.set('scenes',custom.filter(c=>c[0]!==name));renderScenes()};b.appendChild(x)}
    $('scenes').appendChild(b);
  });
}
$('saveScene').onclick=()=>{
  const n=prompt('Name this scene:');if(!n)return;
  const c=store.get('scenes',[]).filter(s=>s[0]!==n);c.push(['⭐ '+n.slice(0,16),curBits]);store.set('scenes',c);renderScenes();
};

/* ---------- demo simulator (mirrors the Arduino sketch) ---------- */
const sim={bits:Array(8).fill(0),pat:'STOP',spd:300,step:0,t:null};
const rnd=n=>Math.random()*n|0;
function frame(p,s){
  const b=sim.bits,N=8,all=v=>b.fill(v?1:0);
  switch(p){
    case'CHASER':all(0);b[s%N]=1;break;
    case'REVERSE':all(0);b[N-1-s%N]=1;break;
    case'PINGPONG':{let x=s%14;if(x>7)x=14-x;all(0);b[x]=1;break}
    case'ALTERNATE':for(let i=0;i<N;i++)b[i]=(i+s)%2===0?1:0;break;
    case'BLINKALL':all(s%2===0);break;
    case'TWINKLE':b[rnd(N)]^=1;break;
    case'FILL':{const n=s%(N+1);for(let i=0;i<N;i++)b[i]=i<n?1:0;break}
    case'CENTER':{const n=s%5;if(n===4)all(0);else for(let i=0;i<N;i++)b[i]=i>=3-n&&i<=4+n?1:0;break}
    case'COMET':{const h=s%(N+3);for(let i=0;i<N;i++)b[i]=i<=h&&i>h-3?1:0;break}
    case'SPARKLE':all(0);for(let k=0;k<3;k++)b[rnd(N)]=1;break;
    case'WAVE':{let x=s%12;if(x>6)x=12-x;for(let i=0;i<N;i++)b[i]=i===x||i===x+1?1:0;break}
    case'HEARTBEAT':all(s%6===0||s%6===2);break;
    case'SCAN2':for(let i=0;i<N;i++)b[i]=i===s%N||i===N-1-s%N?1:0;break;
    case'BOUNCE2':{let p=s%14;if(p>7)p=14-p;for(let i=0;i<N;i++)b[i]=i===p||i===N-1-p?1:0;break}
    case'INWARD':{const n=s%5;for(let i=0;i<N;i++)b[i]=i<n||i>=N-n?1:0;break}
    case'PAIRS':for(let i=0;i<N;i++)b[i]=(Math.floor(i/2)+s)%2===0?1:0;break;
    case'TRIPLE':for(let i=0;i<N;i++)b[i]=(i+s)%3===0?1:0;break;
    case'QUAD':for(let i=0;i<N;i++)b[i]=(i+s)%4<2?1:0;break;
    case'FILLR':{const n=s%(N+1);for(let i=0;i<N;i++)b[i]=i>=N-n?1:0;break}
    case'DRAIN':{const n=N-s%(N+1);for(let i=0;i<N;i++)b[i]=i<n?1:0;break}
    case'FILLDRAIN':{const x=s%16,n=x<=8?x:16-x;for(let i=0;i<N;i++)b[i]=i<n?1:0;break}
    case'RANDOM':for(let i=0;i<N;i++)b[i]=rnd(2);break;
    case'STROBE':all(s%4===0);break;
    case'HALVES':for(let i=0;i<N;i++)b[i]=(i<4)===(s%2===0)?1:0;break;
    case'BINARY':for(let i=0;i<N;i++)b[i]=(s>>i)&1;break;
    case'KNIGHT':{let p=s%14;if(p>7)p=14-p;for(let i=0;i<N;i++)b[i]=Math.abs(i-p)<=1?1:0;break}
    case'SPLIT':{const n=s%4;for(let i=0;i<N;i++)b[i]=i===3-n||i===4+n?1:0;break}
    case'BLOCKS':for(let i=0;i<N;i++)b[i]=(Math.floor(i/4)+Math.floor(s/2))%2===0?1:0;break;
    case'RANDOM1':all(0);b[rnd(N)]=1;break;
    case'RAIN':for(let i=N-1;i>0;i--)b[i]=b[i-1];b[0]=Math.random()<.35?1:0;break;
    case'SPREAD':{for(let i=7;i>4;i--)b[i]=b[i-1];for(let i=0;i<3;i++)b[i]=b[i+1];const r=Math.random()<.35?1:0;b[3]=b[4]=r;break}
    case'MARCH':for(let i=0;i<N;i++)b[i]=(i+s)%4===0?1:0;break;
    case'DIYA':for(let i=0;i<N;i++)b[i]=(i>=2&&i<=5)||Math.random()<.65?1:0;break;
  }
}
function simReply(full){
  const bits=sim.bits.join('');
  if(full)simLine(`STATUS:R=${bits},PAT=${sim.pat},SPD=${sim.spd}`);else simLine('R='+bits);
}
const simLine=l=>setTimeout(()=>handleLine(l),0);
function simRun(){
  clearInterval(sim.t);
  if(sim.pat==='STOP')return;
  sim.t=setInterval(()=>{frame(sim.pat==='AUTO'?AUTO_LIST[Math.floor(sim.step/24)%AUTO_LIST.length]:sim.pat,sim.step++);simReply(false)},sim.spd);
}
function simCommand(cmd){
  cmd=cmd.trim().toUpperCase();
  const stop=()=>{sim.pat='STOP';clearInterval(sim.t)};
  if(/^R[1-8]:[01]$/.test(cmd)){stop();sim.bits[cmd[1]-1]=+cmd[3]}
  else if(cmd==='ALL_ON'){stop();sim.bits.fill(1)}
  else if(cmd==='ALL_OFF'){stop();sim.bits.fill(0)}
  else if(/^MASK:[01]{8}$/.test(cmd)){stop();sim.bits=[...cmd.slice(5)].map(Number)}
  else if(cmd.startsWith('PAT:')){const n=cmd.slice(4);
    if(n!=='STOP'&&!PATTERNS.some(p=>p[0]===n))return;
    sim.bits.fill(0);sim.pat=n;sim.step=0;simRun()}
  else if(cmd.startsWith('SPEED:')){sim.spd=Math.min(2000,Math.max(100,parseInt(cmd.slice(6))||300));if(sim.pat!=='STOP')simRun()}
  else if(cmd!=='STATUS')return;
  simReply(true);
}

/* ---------- transport ---------- */
async function send(cmd){
  if(demo){simCommand(cmd);log('→ '+cmd);return}
  if(!writer)return;
  await writer.write(new TextEncoder().encode(cmd+'\n'));log('→ '+cmd);
}
function handleLine(l){
  if(!l)return;
  const b=l.match(/R=([01]{8})/);if(b)showBits(b[1]);
  const p=l.match(/PAT=(\w+)/);if(p)showPattern(p[1]);
  const s=l.match(/SPD=(\d+)/);if(s){$('speed').value=s[1];$('speedVal').textContent=s[1]+' ms'}
  if(l.startsWith('STATUS'))log('← '+l);
}
async function readLoop(){
  const dec=new TextDecoder();let buf='';
  while(port&&port.readable&&keepReading){
    reader=port.readable.getReader();
    try{while(true){const{value,done}=await reader.read();if(done)break;buf+=dec.decode(value);
      let i;while((i=buf.indexOf('\n'))>=0){handleLine(buf.slice(0,i).trim());buf=buf.slice(i+1)}}}
    catch(e){log('Read error: '+e.message)}finally{reader.releaseLock()}
  }
}
async function connect(){
  try{
    const android=/Android/i.test(navigator.userAgent);
    port=android?await navigator.serial.requestPort({filters:[{bluetoothServiceClassId:BT_SPP_UUID}]}):await navigator.serial.requestPort();
    await port.open({baudRate:9600});
    writer=port.writable.getWriter();keepReading=true;
    setConnected(true);log('Connected');readLoop();send('STATUS');
    send('SPEED:'+store.get('speed',300));
  }catch(e){log('Connect failed: '+e.message);port=null}
}
async function disconnect(){
  keepReading=false;
  try{if(reader)await reader.cancel()}catch{}
  try{if(writer)writer.releaseLock()}catch{}
  try{if(port)await port.close()}catch{}
  writer=reader=port=null;setConnected(false);log('Disconnected');
}
function toggleDemo(){
  if(demo){demo=false;clearInterval(sim.t);sim.pat='STOP';sim.bits.fill(0);setConnected(false);log('Demo stopped');return}
  if(port)return log('Disconnect the real device first.');
  demo=true;setConnected(true);log('Demo mode: simulating the 8 relays');simReply(true);
}

/* ---------- timers ---------- */
let sleepT=null,sleepEnd=0,partyT=null;
function setSleep(min){
  clearInterval(sleepT);$('sleepLeft').textContent='';
  if(!min)return;
  sleepEnd=Date.now()+min*60000;
  sleepT=setInterval(()=>{
    const left=sleepEnd-Date.now();
    if(left<=0){clearInterval(sleepT);$('sleepLeft').textContent='';$('sleep').value='0';send('ALL_OFF');log('Sleep timer: lights off 🌙');return}
    $('sleepLeft').textContent=`${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')} left`;
  },1000);
}
function setParty(on){
  clearInterval(partyT);$('party').classList.toggle('active',on);$('party').textContent='🎉 Party Mode: '+(on?'On':'Off');
  if(!on)return;
  const next=()=>{send('PAT:'+AUTO_LIST[rnd(AUTO_LIST.length)])};next();partyT=setInterval(next,12000);
}
$('sleep').onchange=e=>setSleep(+e.target.value);
$('party').onclick=()=>setParty(!partyT||!$('party').classList.contains('active'));

/* ---------- controls ---------- */
$('connectBtn').onclick=()=>demo?toggleDemo():(port?disconnect():connect());
$('demoBtn').onclick=toggleDemo;
$('allOn').onclick=()=>send('ALL_ON');$('allOff').onclick=()=>send('ALL_OFF');
$('speed').oninput=e=>$('speedVal').textContent=e.target.value+' ms';
$('speed').onchange=e=>{store.set('speed',+e.target.value);send('SPEED:'+e.target.value)};
document.addEventListener('keydown',e=>{
  if(!connected||/INPUT|SELECT/.test(e.target.tagName))return;
  if(e.key>='1'&&e.key<='8')tiles[e.key-1].click();
  else if(e.key==='a')send('ALL_ON');else if(e.key==='o')send('ALL_OFF');else if(e.key===' '){e.preventDefault();send('PAT:STOP')}
});

/* ---------- countdown ---------- */
(function(){
  const d=Math.ceil((new Date(2026,10,8)-new Date().setHours(0,0,0,0))/864e5);
  $('count').textContent=d>0?`🪔 ${d} day${d>1?'s':''} to Diwali (8 Nov 2026)`:d===0?'🎆 Happy Diwali — today!':'🪔 Wishing you light & joy';
})();

/* ---------- init ---------- */
$('speed').value=store.get('speed',300);$('speedVal').textContent=$('speed').value+' ms';
renderScenes();
if(!('serial' in navigator)){log('Web Serial not supported here. Use Chrome/Edge, or try Demo Mode.');$('connectBtn').disabled=true}
setConnected(false);