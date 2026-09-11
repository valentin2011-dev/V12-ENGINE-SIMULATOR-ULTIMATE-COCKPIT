const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let running=false,rpm=0,target=0,gear=0,mode="comfort",muted=false,last=performance.now();
let speed=0,brake=0,decel=false,audio=null,shiftTimer=null;
const MAX_RPM=10000,REDLINE=9500,IDLE=850;
const ratios=[0,3.18,2.08,1.55,1.20,.96,.78,.63];
const modeCfg={comfort:{throttle:62,drop:2600},sport:{throttle:78,drop:3300},sportplus:{throttle:92,drop:4100}};
for(let i=0;i<=36;i++){const m=document.createElement("i");m.className="mark"+(i%3===0?" major":"")+(i>=32?" red":"");m.style.transform=`translate(-50%,-50%) rotate(${-132+i*7.333}deg)`;$("#ringMarks").append(m)}

// REAL V12 SAMPLE ENGINE: one original recording, three overlapping layers,
// RPM-driven playback rate, crossfaded loop windows, throttle envelope and shift transients.
const SOURCE="assets/audio/v12_source.mp3";
const LOOP_WINDOWS=[
  {rpm:900,start:16.0,end:18.0,level:.72},
  {rpm:2200,start:20.5,end:22.5,level:.72},
  {rpm:3600,start:26.0,end:28.0,level:.76},
  {rpm:5000,start:34.0,end:36.0,level:.80},
  {rpm:6500,start:46.0,end:48.0,level:.86},
  {rpm:8000,start:54.0,end:56.0,level:.90},
  {rpm:9000,start:60.0,end:62.0,level:.94}
];
function ensureAudio(){
  if(audio)return audio;
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  const ctx=new C();
  const master=ctx.createGain();
  const compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-20;compressor.knee.value=12;compressor.ratio.value=3.2;compressor.attack.value=.008;compressor.release.value=.12;
  const body=ctx.createBiquadFilter();body.type="lowpass";body.frequency.value=2300;body.Q.value=.45;
  const air=ctx.createBiquadFilter();air.type="highpass";air.frequency.value=55;air.Q.value=.25;
  const presence=ctx.createBiquadFilter();presence.type="peaking";presence.frequency.value=1500;presence.Q.value=.8;presence.gain.value=0;
  air.connect(body).connect(presence).connect(compressor).connect(master).connect(ctx.destination);
  master.gain.value=0;
  audio={ctx,master,compressor,body,air,presence,buffers:[],layers:[],ready:false,loading:true};
  $("#audioState").textContent="LOADING";
  fetch(SOURCE).then(r=>{if(!r.ok)throw Error("Audio HTTP "+r.status);return r.arrayBuffer()}).then(b=>ctx.decodeAudioData(b)).then(buf=>{
    audio.buffers=[buf];
    LOOP_WINDOWS.forEach((w,i)=>{
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buf;src.loop=true;src.loopStart=w.start;src.loopEnd=w.end;gain.gain.value=0;src.connect(gain).connect(air);src.start(0,w.start);audio.layers.push({src,gain,rpm:w.rpm,base:w.level});
    });
    audio.ready=true;audio.loading=false;$("#audioState").textContent="V12 READY";
  }).catch(err=>{console.warn(err);audio.loading=false;$("#audioState").textContent="AUDIO ERROR"});
  return audio;
}
function envelope(r){
  const weights=[];let sum=0;
  audio.layers.forEach(l=>{const d=Math.abs(r-l.rpm);const w=Math.max(0,1-d/1250);weights.push(w);sum+=w});
  if(sum<.001){const nearest=audio.layers.reduce((a,b)=>Math.abs(b.rpm-r)<Math.abs(a.rpm-r)?b:a);return audio.layers.map(l=>l===nearest?1:0)}
  return weights.map(w=>w/sum);
}
function audioUpdate(){
  if(!audio||!audio.ready)return;
  const now=audio.ctx.currentTime,r=Math.max(120,rpm),th=Number($("#throttle").value)/100;
  const weights=envelope(r);
  audio.layers.forEach((l,i)=>{
    // Playback-rate is referenced to each recorded RPM zone. This changes pitch AND speed,
    // while crossfading neighboring real V12 recordings to avoid synthetic oscillator sound.
    const rate=Math.max(.58,Math.min(1.65,r/l.rpm));
    const throttleGain=.16+th*.95;
    const brakingGain=decel?.52:1;
    const limiter=r>=REDLINE-.5?.78:1;
    const g=muted?0:(running?weights[i]*l.base*throttleGain*brakingGain*limiter:0);
    l.gain.gain.setTargetAtTime(g,now,.045);
    l.src.playbackRate.setTargetAtTime(rate,now,.055);
  });
  audio.body.frequency.setTargetAtTime(1350+r*.34+th*650,now,.08);
  audio.presence.gain.setTargetAtTime((th*3)+(r/REDLINE)*2,now,.08);
  audio.master.gain.setTargetAtTime(muted?0:(running?.72:0),now,.035);
}
function triggerShift(up){
  if(!audio?.ready||muted)return;
  const buf=audio.buffers[0],ctx=audio.ctx,src=ctx.createBufferSource(),g=ctx.createGain(),now=ctx.currentTime;
  src.buffer=buf;const start=up?59.7:43.4;src.loop=false;src.playbackRate.value=up?.95:1.22;
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.20,now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+.30);
  src.connect(g).connect(audio.presence);src.start(now,start);src.stop(now+.33);
}
function setRunning(v){
  running=v;
  if(v){const a=ensureAudio();a?.ctx.resume();target=Math.max(IDLE,rpm||IDLE);setUiRunning(true);}
  else{target=0;setUiRunning(false);$("#throttle").value=0;setThrottle(0);brake=0;decel=false;}
}
function setUiRunning(v){
  $("#start").classList.toggle("running",v);$("#start span").textContent=v?"STOP ENGINE":"START ENGINE";
  $("#trackStart").classList.toggle("running",v);$("#trackStart span").textContent=v?"STOP ENGINE":"START ENGINE";
  $("#state").textContent=v?"RUNNING":"STANDBY";$("#footerState").textContent=v?"RUNNING":"OFF";
  $("#statusDot").parentElement.classList.toggle("running",v);$("#trackDot").parentElement.classList.toggle("running",v);
  $("#trackState").textContent=v?"RUNNING":"STANDBY";
}
$("#start").onclick=()=>setRunning(!running);$("#trackStart").onclick=()=>setRunning(!running);
function setThrottle(v){v=Math.max(0,Math.min(100,Math.round(v)));$("#throttle").value=v;$("#throttleValue").textContent=v+"%";$("#throttleValue2").textContent=v+"%";$("#trackThrottleValue").textContent=v+"%"}
$("#throttle").oninput=()=>setThrottle($("#throttle").value);
function bindHold(el,down,up){el.addEventListener("pointerdown",e=>{e.preventDefault();el.classList.add("pressed");down()});["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>{el.classList.remove("pressed");up()}))}
bindHold($("#throttlePedal"),()=>setThrottle(100),()=>setThrottle(0));bindHold($("#trackThrottle"),()=>setThrottle(100),()=>setThrottle(0));
bindHold($("#brakePedal"),()=>brake=100,()=>brake=0);bindHold($("#trackBrake"),()=>brake=100,()=>brake=0);
bindHold($("#decelPedal"),()=>decel=true,()=>decel=false);bindHold($("#trackDecel"),()=>decel=true,()=>decel=false);
$$(".modeBtn").forEach(b=>b.onclick=()=>{$$(".modeBtn").forEach(x=>x.classList.remove("active"));b.classList.add("active");mode=b.dataset.mode;$("#modeBadge").textContent=b.textContent;$("#trackMode").textContent=b.textContent});
function shift(d){if(!running)return;if(d>0&&gear<7){gear++;target=Math.max(1500,rpm*.62);triggerShift(true);flash("UPSHIFT")}if(d<0&&gear>1){gear--;target=Math.min(REDLINE,rpm*1.42+650);triggerShift(false);flash("DOWNSHIFT")}}
function flash(t){$("#shift").textContent=t;$("#trackShift").textContent=t;clearTimeout(shiftTimer);shiftTimer=setTimeout(()=>{$("#shift").textContent="READY";$("#trackShift").textContent="READY"},450)}
$("#up").onclick=$("#trackUp").onclick=()=>shift(1);$("#down").onclick=$("#trackDown").onclick=()=>shift(-1);
$("#mute").onclick=()=>{muted=!muted;$("#mute").textContent=muted?"SOUND OFF":"SOUND ON";if(!muted)ensureAudio()?.ctx.resume()};
function render(){
  const ratio=ratios[Math.max(gear,1)];
  let desiredSpeed=gear?Math.min(320,rpm/REDLINE*320*(ratio/ratios[1])):0;
  speed+=(desiredSpeed-speed)*.055;speed=Math.max(0,speed-(brake?2.7:0)*.18);
  const temp=running?Math.round(78+rpm/88):"--",oil=running?Math.round(74+rpm/102):"--",p=running?Math.round(70+720*(rpm/REDLINE)*Number($("#throttle").value)/100):"--";
  const rtxt=Math.round(rpm).toString().padStart(4,"0"),stxt=Math.round(speed).toString().padStart(3,"0"),gtxt=gear?gear:"N";
  $("#rpm").textContent=rtxt;$("#speed").textContent=stxt;$("#gear").textContent=gtxt;$("#engineTemp").textContent=temp+"°C";$("#oilTemp").textContent=oil+"°C";$("#oilPressure").textContent=running?(1.1+rpm/4100).toFixed(1)+" bar":"-- bar";$("#power").textContent=p+" HP";
  $("#trackRpm").textContent=rtxt;$("#trackSpeed").textContent=stxt;$("#trackGear").textContent=gtxt;$("#trackTemp").textContent=temp+"°C";$("#trackOil").textContent=oil+"°C";$("#trackOilPressure").textContent=running?(1.1+rpm/4100).toFixed(1)+" bar":"-- bar";$("#trackPower").textContent=p+" HP";
  const angle=-132+(rpm/MAX_RPM)*264;$("#needle").style.transform=`translate(-50%,-100%) rotate(${angle}deg)`;$("#trackProgress").style.transform=`rotate(${(-135+(rpm/REDLINE)*270)}deg)`;
  $("#brakeValue").textContent=brake+"%";$("#trackBrakeValue").textContent=brake+"%";
}
function loop(t){
  const dt=Math.min(.05,(t-last)/1000);last=t;
  if(running){
    const th=Number($("#throttle").value),cfg=modeCfg[mode];
    if(th>0)target=Math.min(REDLINE,IDLE+th*cfg.throttle);else if(decel)target=Math.max(IDLE,rpm-cfg.drop*1.65*dt);else target=Math.max(IDLE,rpm-cfg.drop*dt);
    if(brake)target=Math.max(IDLE,target-2600*dt);
    rpm+=(target-rpm)*Math.min(1,5.8*dt);
    if(rpm>=REDLINE){rpm=REDLINE;target=REDLINE;flash("LIMITER")}
  }else{rpm=Math.max(0,rpm-5200*dt);speed=Math.max(0,speed-80*dt);if(rpm<60)gear=0}
  render();audioUpdate();requestAnimationFrame(loop)
}
requestAnimationFrame(loop);
document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();setRunning(!running)}if(e.key==="ArrowRight")shift(1);if(e.key==="ArrowLeft")shift(-1);if(e.key==="ArrowUp")setThrottle(100);if(e.key==="ArrowDown")setThrottle(0)});
