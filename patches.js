;
/* ===== bos-mobile-apk-ready-script ===== */
(function(){
  'use strict';
  /* Capacitor-safe bridge: works in browser too */
  const isNative=!!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.getPlatform?.() !== 'web'));
  document.documentElement.classList.toggle('bos-native-app',isNative);


  /* Android hardware back support. Capacitor App plugin is optional, so browser never crashes. */
  function appBack(){
    const modal=document.querySelector('.modal.open,.sheet.open,#queue-panel.open,#lyrics-view.open');
    if(modal){
      const close=document.querySelector('[data-close],.close-btn,.modal-close');
      if(close) close.click(); else modal.classList.remove('open');
      return;
    }
    if(typeof window.goBack==='function') { window.goBack(); return; }
    if(location.hash) history.back();
  }
  try{
    const AppPlugin=window.Capacitor?.Plugins?.App;
    if(AppPlugin?.addListener) AppPlugin.addListener('backButton',({canGoBack})=>{ if(canGoBack) appBack(); else AppPlugin.exitApp?.(); });
  }catch(e){}

  /* Pause non-essential visual work when app/tab is hidden; audio itself is untouched. */
  document.addEventListener('visibilitychange',()=>{
    document.documentElement.classList.toggle('bos-app-hidden',document.hidden);
  });

  /* Better mobile viewport handling when Android keyboard opens. */
  const vv=window.visualViewport;
  if(vv){
    const sync=()=>document.documentElement.style.setProperty('--bos-vvh',vv.height+'px');
    vv.addEventListener('resize',sync,{passive:true}); sync();
  }
})();
;
/* ===== bos-smart-suggestions-v2-script ===== */
(function BoosterSmartSuggestionsV2(){
  'use strict';
  if(typeof window.State==='undefined'||typeof window.Store==='undefined'||typeof window.Api==='undefined') return;
  const KEY='boosterSmartLearningV2';
  const PREF_KEY='boosterPreferences';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}};
  const save=x=>{try{localStorage.setItem(KEY,JSON.stringify(x));}catch(_){}};
  const norm=x=>String(x||'').toLowerCase().replace(/&amp;/g,'&').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  const artist=t=>norm(String(t&&t.artistName||'').split(',')[0]);
  const album=t=>norm(t&&t.albumName||t&&t.album||'');
  const title=t=>norm(t&&t.name||'');
  const family=t=>title(t)+'||'+artist(t);
  const prefs=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{};}catch(_){return{};}};
  const get=()=>{const x=load();x.tracks=x.tracks||{};x.artists=x.artists||{};x.albums=x.albums||{};x.blockedTracks=x.blockedTracks||{};x.blockedArtists=x.blockedArtists||{};x.blockedAlbums=x.blockedAlbums||{};x.events=x.events||[];return x;};
  let model=get(), lastTrackId='', startedAt=0, lastDuration=0, lastProgress=0, busy=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function trackKey(t){return String(t&&t.id||'')+'||'+family(t);}
  function updateTrack(t,kind,ratio){if(!t)return;const k=trackKey(t),a=artist(t),al=album(t),m=model.tracks[k]||(model.tracks[k]={plays:0,completes:0,skips:0,seconds:0,last:0,ratio:0});
    if(kind==='start')m.plays++;
    if(kind==='complete')m.completes++;
    if(kind==='skip')m.skips++;
    if(kind==='progress'&&Number.isFinite(ratio))m.ratio=Math.max(m.ratio||0,ratio);
    m.last=Date.now();
    if(a){const am=model.artists[a]||(model.artists[a]={plays:0,completes:0,skips:0,last:0});am.plays+=(kind==='start'?1:0);am.completes+=(kind==='complete'?1:0);am.skips+=(kind==='skip'?1:0);am.last=Date.now();}
    if(al){const bm=model.albums[al]||(model.albums[al]={plays:0,completes:0,skips:0,last:0});bm.plays+=(kind==='start'?1:0);bm.completes+=(kind==='complete'?1:0);bm.skips+=(kind==='skip'?1:0);bm.last=Date.now();}
    model.events.unshift({id:t.id||'',a,al,kind,ratio:Number(ratio)||0,at:Date.now()});if(model.events.length>120)model.events.length=120;save(model);
  }
  function begin(t){
    if(!t||lastTrackId===trackKey(t))return;
    if(lastTrackId&&State.currentTrack&&lastProgress<.72) updateTrack(State.currentTrack,'skip',lastProgress);
    lastTrackId=trackKey(t);startedAt=Date.now();lastDuration=0;lastProgress=0;updateTrack(t,'start',0);
  }
  function onProgress(){const t=State.currentTrack,a=typeof primaryAudio==='function'?primaryAudio():null;if(!t||!a)return;lastDuration=Number(a.duration)||Number(t.duration)||0;const r=lastDuration>0?clamp((Number(a.currentTime)||0)/lastDuration,0,1):0;if(r>lastProgress+0.03){lastProgress=r;updateTrack(t,'progress',r);}}
  function onEnded(){const t=State.currentTrack;if(t){lastProgress=1;updateTrack(t,'complete',1);}}
  function blocked(t){return !!(model.blockedTracks[trackKey(t)]||model.blockedArtists[artist(t)]|| (album(t)&&model.blockedAlbums[album(t)]));}
  function isFav(t){return Array.isArray(State.favSongs)&&State.favSongs.some(x=>x&&x.id===t.id);}
  function prefScore(t){const p=prefs(),a=artist(t),l=norm(t&&t.language),m=model.tracks[trackKey(t)]||{},am=model.artists[a]||{};let s=0;
    (p.artists||[]).forEach(x=>{const n=norm(x);if(n===a)s+=95;else if(a&&(a.includes(n)||n.includes(a)))s+=45;});
    (p.languages||[]).forEach(x=>{if(norm(x)===l)s+=28;});
    if(isFav(t))s+=72;
    s+=Math.min(48,(m.completes||0)*18);s+=Math.min(24,(m.plays||0)*5);s-=Math.min(70,(m.skips||0)*22);
    s+=Math.min(42,(am.completes||0)*9);s-=Math.min(45,(am.skips||0)*12);
    if(m.ratio>.82)s+=18;if(m.ratio<.2&&m.skips)s-=20;
    return s;
  }
  function diversityPenalty(t,selected){const a=artist(t),al=album(t);let p=0;for(const x of selected){if(artist(x)===a)p+=42;if(al&&album(x)===al)p+=58;}return p;}
  function weightedPick(pool,selected){if(!pool.length)return null;const scored=pool.map(t=>({t,s:prefScore(t)-diversityPenalty(t,selected)})).sort((x,y)=>y.s-x.s);const top=scored.slice(0,Math.min(8,scored.length));return top[Math.floor(Math.random()*top.length)].t;}
  function languageSeeds(){const p=prefs(),ls=(p.languages||[]).slice(0,4);return ls.length?ls.map(x=>x+' trending songs'):['Indian trending songs','Hindi new songs','Marathi trending songs'];}
  function tasteSeeds(current){const p=prefs(),out=[];if(current){if(current.name)out.push(String(current.name));if(current.artistName)out.push(String(current.artistName).split(',')[0]+' similar songs');if(current.language)out.push(String(current.language)+' trending songs');} (p.artists||[]).slice(0,6).forEach(a=>out.push(a+' songs'));return [...new Set(out.concat(languageSeeds(),'Indian music discovery'))].slice(0,10);}
  async function search(q,page=0){try{const r=await Api.searchSongs(q,page,24);return (r&&r.data&&Array.isArray(r.data.results)?r.data.results:[]).map(x=>typeof normalizeSong==='function'?normalizeSong(x):x).filter(x=>x&&x.id&&!blocked(x));}catch(_){return[];}}
  async function candidates(mode){
    const current=State.currentTrack,p=mode==='surprise'?[]:tasteSeeds(current), qs=mode==='discovery'?[...p,'new Indian songs','new Hindi songs','Indian indie discovery']:p;
    const packs=await Promise.all(qs.map((q,i)=>search(q,i%2)));let all=packs.flat(),seen=new Set(),pool=[];
    for(const t of all){const k=trackKey(t);if(!seen.has(k)&&!blocked(t)&&(!current||k!==trackKey(current))){seen.add(k);pool.push(t);}}
    return pool;
  }
  async function build(mode='personalized',count=8){if(busy)return[];busy=true;try{const pool=await candidates(mode);if(!pool.length)return[];const selected=[],used=new Set();let target=count;
      if(mode==='discovery'){const sorted=pool.slice().sort((a,b)=>prefScore(b)-prefScore(a));const familiar=sorted.slice(0,Math.ceil(target*.7));const fresh=sorted.slice(Math.ceil(target*.7));while(selected.length<target&&familiar.length){const t=weightedPick(familiar.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}while(selected.length<target&&fresh.length){const t=weightedPick(fresh.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}}
      else if(mode==='surprise'){const sorted=pool.slice().sort((a,b)=>prefScore(b)-prefScore(a));const taste=sorted.slice(0,Math.max(1,Math.ceil(target*.7))),fresh=sorted.slice(Math.ceil(target*.7));const freshArtist=[];const known=new Set(Object.keys(model.artists));fresh.forEach(t=>{if(!known.has(artist(t)))freshArtist.push(t);});
        while(selected.length<Math.ceil(target*.7)&&taste.length){const t=weightedPick(taste.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}
        while(selected.length<Math.ceil(target*.9)&&freshArtist.length){const t=weightedPick(freshArtist.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}
        while(selected.length<target){const t=weightedPick(pool.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}
      } else {while(selected.length<target){const t=weightedPick(pool.filter(x=>!used.has(trackKey(x))),selected);if(!t)break;used.add(trackKey(t));selected.push(t);}}
      return selected;
    }finally{busy=false;}}
  function play(t){if(!t)return;closePopSafe();try{Player.play(t,[t],0,{autoTransition:false});}catch(_){try{Player.play(t);}catch(__){}}}
  function closePopSafe(){const x=document.getElementById('bos-pop');if(x)x.classList.remove('open');}
  function renderList(list,label){const root=document.getElementById('bos-smart-v2-list');if(!root)return;root.innerHTML='';if(!list.length){root.innerHTML='<div class="ss-empty">No fresh picks yet. Play a few songs and Booster OS will learn your taste.</div>';return;}
    list.forEach((t,i)=>{const row=document.createElement('div');row.className='ss-track';row.title='Play '+(t.name||'');row.innerHTML='<img loading="lazy" decoding="async" class="ss-art" src="'+String(t.image||t.imageUrl||'')+'" onerror="this.style.visibility=\'hidden\'"><div><div class="ss-name">'+esc(t.name||'Unknown')+'</div><div class="ss-artist">'+esc(t.artistName||'Unknown artist')+'</div></div><div class="ss-score">'+Math.max(0,Math.round(prefScore(t)))+'</div>';row.addEventListener('click',()=>play(t));root.appendChild(row);});
    const sub=document.getElementById('bos-smart-v2-sub');if(sub)sub.textContent=label+' • artist + album diversity protected';
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function currentNotVibe(type){const t=State.currentTrack;if(!t)return;const k=trackKey(t),a=artist(t),al=album(t);if(type==='song')model.blockedTracks[k]=true;if(type==='artist'&&a)model.blockedArtists[a]=true;if(type==='album'&&al)model.blockedAlbums[al]=true;save(model);renderState();refresh('personalized');}
  function renderState(){const root=document.getElementById('bos-smart-v2');if(!root)return;const d=root.querySelector('[data-mode]');if(d)d.textContent='Discovery Mode: '+(root.dataset.discovery==='1'?'ON':'OFF');const t=State.currentTrack;if(t){const stat=model.tracks[trackKey(t)]||{};const badge=root.querySelector('.ss-badges');if(badge)badge.innerHTML='<span class="ss-badge">Completion '+Math.round((stat.ratio||0)*100)+'%</span><span class="ss-badge">Plays '+(stat.plays||0)+'</span><span class="ss-badge">Skips '+(stat.skips||0)+'</span>';}}
  async function refresh(mode){const root=document.getElementById('bos-smart-v2');if(!root)return;const btn=root.querySelector('#bos-ss-refresh');if(btn){btn.disabled=true;btn.textContent='⏳ Loading…';}const list=await build(mode|| (root.dataset.discovery==='1'?'discovery':'personalized'),8);renderList(list,mode==='surprise'?'Smart Surprise':'Personalized Suggestions');if(btn){btn.disabled=false;btn.textContent='↻ Refresh';}}
  function openSmart(){const p=document.getElementById('bos-pop');if(p)p.classList.add('open');const root=document.getElementById('bos-smart-v2');if(root)refresh(root.dataset.discovery==='1'?'discovery':'personalized');}
  function inject(){const p=document.getElementById('bos-pop');if(!p||document.getElementById('bos-smart-v2'))return;const box=document.createElement('div');box.id='bos-smart-v2';box.dataset.discovery='0';box.innerHTML='<div class="ss-head"><div><div class="ss-title">🧠 Smart Suggestions</div><div class="ss-sub" id="bos-smart-v2-sub">Learns from plays, skips and completions</div></div></div><div class="ss-actions"><button id="bos-ss-refresh">↻ Refresh</button><button id="bos-ss-surprise">🎲 Smart Surprise</button><button id="bos-ss-discovery" class="ss-toggle"><span data-mode>Discovery Mode: OFF</span></button><button id="bos-ss-more">✨ More Like This</button></div><div class="ss-vibe"><button id="bos-ss-song" class="ss-danger">🚫 Not This Song</button><button id="bos-ss-artist" class="ss-danger">🚫 Not This Artist</button></div><div class="ss-actions" style="margin-top:7px"><button id="bos-ss-album" class="ss-danger">🚫 Not This Album</button><button id="bos-ss-clear">↺ Reset Learning</button></div><div class="ss-badges"></div><div class="ss-list" id="bos-smart-v2-list"><div class="ss-empty">Open Smart Suggestions to build your first personalized queue.</div></div>';p.appendChild(box);
    box.querySelector('#bos-ss-refresh').onclick=()=>refresh(box.dataset.discovery==='1'?'discovery':'personalized');
    box.querySelector('#bos-ss-surprise').onclick=async()=>renderList(await build('surprise',8),'Smart Surprise • 70% taste / 20% new artists / 10% wildcard');
    box.querySelector('#bos-ss-discovery').onclick=()=>{box.dataset.discovery=box.dataset.discovery==='1'?'0':'1';renderState();refresh(box.dataset.discovery==='1'?'discovery':'personalized');};
    box.querySelector('#bos-ss-more').onclick=async()=>renderList(await build('personalized',8),'More Like This • current taste');
    box.querySelector('#bos-ss-song').onclick=()=>currentNotVibe('song');box.querySelector('#bos-ss-artist').onclick=()=>currentNotVibe('artist');box.querySelector('#bos-ss-album').onclick=()=>currentNotVibe('album');
    box.querySelector('#bos-ss-clear').onclick=()=>{model={tracks:{},artists:{},albums:{},blockedTracks:{},blockedArtists:{},blockedAlbums:{},events:[]};save(model);renderState();refresh('personalized');};
    const fab=document.getElementById('bos-fab');if(fab)fab.addEventListener('click',()=>setTimeout(renderState,20));
  }
  // Wrap playback entry so every genuinely started track becomes a learning signal.
  const oldPlay=Player.play;Player.play=async function(){const r=await oldPlay.apply(this,arguments);if(r&&State.currentTrack)begin(State.currentTrack);return r;};
  const oldNext=Player.next;Player.next=async function(auto){if(State.currentTrack&&!auto&&lastProgress<.72)updateTrack(State.currentTrack,'skip',lastProgress);return oldNext.apply(this,arguments);};
  document.addEventListener('timeupdate',onProgress,true);document.addEventListener('ended',onEnded,true);
  // Catch programmatic audio elements too, without assuming a particular audio element id.
  setInterval(onProgress,3000);
  function boot(){inject();renderState();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

  window.BoosterSmartLearning={refresh,model:()=>get(),notMyVibe:currentNotVibe};
})();
;
/* ===== bos-v7-diagnostics ===== */
/* ============================================================ BOOSTER V7 DIAGNOSTICS
   Exposes a small non-invasive diagnostic API for debugging playback.
   ============================================================ */
window.BoosterDiagnostics = {
  snapshot(){
    const a=typeof primaryAudio==='function'?primaryAudio():null;
    const t=State.currentTrack||null;
    return {trackId:t&&t.id||null,title:t&&t.name||null,playing:!!(a&&!a.paused),time:a&&Number.isFinite(a.currentTime)?a.currentTime:0,duration:a&&Number.isFinite(a.duration)?a.duration:0,queueLength:Array.isArray(State.queue)?State.queue.length:0,queueIndex:Number(State.queueIndex)||0,network:a&&a.networkState||0,readyState:a&&a.readyState||0,src:!!(a&&a.currentSrc)};
  }
};
;
/* ===== bos-v9-voicecut-bass-script ===== */
(function BoosterV9VoiceCutBass(){
  'use strict';
  /* v7 — Voice Cut (karaoke) + Only Voice (acapella-ish) + proper Bass Boost + keyboard shortcuts.
     Graph:  audio -> master -> [off | cut | only] (crossfaded routes) -> mix -> bass shelf -> bass peak -> out -> speakers */
  const $=id=>document.getElementById(id);
  const A=()=>$('audio-el'), B=()=>$('audio-el-2');
  const RT2=Math.SQRT1_2;

  let ctx=null, dry=null, revSend=null, revWet=null, revOn=(localStorage.getItem('boosterReverb')==='1'), master=null, mix=null, bassShelf=null, bassPeak=null, outGain=null, mudCut=null, comp=null, exGain=null, analyser=null;
  const routes={};            // off / cut / only -> GainNode
  const sources=new Map();
  const normOn=()=>{try{return !!(window.State&&window.State.settings&&window.State.settings.normalizeVolume);}catch(_){return false;}};
  let mode='off', bassOn=false, bassDb=0, bassVib=false, activeAudio=null, resumeHooked=false;

  const DESC={
    off:'Original sound.',
    cut:'Voice removed, music + bass stay. Best on stereo studio tracks (vocal in the centre).',
    only:'Only the voice stays, bass/drums/wide music reduced. Cleanest when the vocal is centred.'
  };

  function loadState(){
    try{
      const x=JSON.parse(localStorage.getItem('boosterV9VoiceBass')||'{}');
      mode=(x.mode==='cut'||x.mode==='only')?x.mode:(x.voiceCut?'cut':'off');
      bassOn=!!x.bassOn;
      bassDb=Math.max(0,Math.min(12,Number(x.bassDb)||0));
      bassVib=!!x.bassVib;
    }catch(_){}
  }
  function saveState(){try{localStorage.setItem('boosterV9VoiceBass',JSON.stringify({mode,bassOn,bassDb,bassVib}));}catch(_){}}
  function say(m){try{if(typeof toast==='function')toast(m);}catch(_){}}

  function setButton(id,on){
    const b=$(id); if(!b)return;
    b.classList.toggle('active',!!on);
    const sp=b.querySelector('span'); if(sp)sp.textContent=on?'ON':'OFF';
  }
  function updateUI(){
    setButton('bos-v9-voice-cut',mode==='cut');
    setButton('bos-v9-voice-only',mode==='only');
    setButton('bos-v9-bass-toggle',bassOn);
    setButton('bos-v9-bass-vib',bassVib);
    const r=$('bos-v9-bass-range'),v=$('bos-v9-bass-value'),d=$('bos-v9-fx-desc');
    if(r){r.value=String(bassDb);r.style.setProperty('--p',(bassDb/12*100)+'%');}
    if(v)v.textContent=(bassOn?bassDb:0)+' dB';
    if(d)d.textContent=DESC[mode];
  }

  /* Linkwitz-Riley 4th order = two identical Butterworth biquads (flat when low+high are summed) */
  function lr4(type,freq){
    const a=ctx.createBiquadFilter(), b=ctx.createBiquadFilter();
    a.type=b.type=type; a.frequency.value=b.frequency.value=freq; a.Q.value=b.Q.value=RT2;
    a.connect(b); return {in:a,out:b};
  }
  function newRoute(v){const g=ctx.createGain(); g.gain.value=v; g.connect(mix); return g;}

  function build(){
    if(ctx)return true;
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return false;
    try{
      ctx=new C({latencyHint:'interactive'});
      master=ctx.createGain();
      master.channelCount=2; master.channelCountMode='explicit'; master.channelInterpretation='speakers';
      mix=ctx.createGain();
      mix.channelCount=2; mix.channelCountMode='explicit'; mix.channelInterpretation='speakers';

      routes.off=newRoute(1); master.connect(routes.off);

      /* CLEAR BASS: tight sub shelf + punch peak, mud cut at ~250 Hz, harmonic exciter (so bass is
         audible on phone speakers), and a limiter so boosted bass never clips/distorts. */
      bassShelf=ctx.createBiquadFilter(); bassShelf.type='lowshelf'; bassShelf.frequency.value=85;
      bassPeak=ctx.createBiquadFilter();  bassPeak.type='peaking';  bassPeak.frequency.value=62; bassPeak.Q.value=1.1;
      mudCut=ctx.createBiquadFilter();    mudCut.type='peaking';    mudCut.frequency.value=260; mudCut.Q.value=.9; mudCut.gain.value=0;
      comp=ctx.createDynamicsCompressor();
      comp.threshold.value=-1; comp.knee.value=6; comp.ratio.value=12; comp.attack.value=.003; comp.release.value=.14;
      outGain=ctx.createGain();
      dry=ctx.createGain(); mix.connect(dry); dry.connect(bassShelf); buildReverb(); bassShelf.connect(bassPeak);
      bassPeak.connect(mudCut); mudCut.connect(comp);
      // exciter: low band -> soft saturation -> keep only upper harmonics (110-450 Hz) -> blend in
      const exLP=ctx.createBiquadFilter(); exLP.type='lowpass'; exLP.frequency.value=130; exLP.Q.value=.7;
      const ws=ctx.createWaveShaper(); const cur=new Float32Array(1024);
      for(let i=0;i<1024;i++){const x=i/512-1; cur[i]=Math.tanh(3*x);} ws.curve=cur; ws.oversample='4x';
      const exHP=ctx.createBiquadFilter(); exHP.type='highpass'; exHP.frequency.value=110; exHP.Q.value=.7;
      const exLP2=ctx.createBiquadFilter(); exLP2.type='lowpass'; exLP2.frequency.value=450; exLP2.Q.value=.7;
      exGain=ctx.createGain(); exGain.gain.value=0;
      mix.connect(exLP); exLP.connect(ws); ws.connect(exHP); exHP.connect(exLP2); exLP2.connect(exGain); exGain.connect(comp);
      comp.connect(outGain); outGain.connect(ctx.destination);
      analyser=ctx.createAnalyser(); analyser.fftSize=1024; analyser.smoothingTimeConstant=.2; bassPeak.connect(analyser);
      return true;
    }catch(err){console.warn('[Booster FX] AudioContext build failed',err);ctx=null;return false;}
  }

  /* VOICE CUT: side signal (L-R) in phase on both ears, above 130 Hz.
     Below 130 Hz the ORIGINAL stereo is kept, so kick + bass line stay full. */
  function buildCut(){
    if(routes.cut)return;
    const g=routes.cut=newRoute(0);
    const split=ctx.createChannelSplitter(2); master.connect(split);
    const gl=ctx.createGain(), gr=ctx.createGain(); gl.gain.value=RT2; gr.gain.value=-RT2;
    const side=ctx.createGain(); side.channelCount=1; side.channelCountMode='explicit';
    split.connect(gl,0); split.connect(gr,1); gl.connect(side); gr.connect(side);
    const hp=lr4('highpass',130); side.connect(hp.in);
    const makeup=ctx.createGain(); makeup.gain.value=1.4; hp.out.connect(makeup);
    const merge=ctx.createChannelMerger(2); makeup.connect(merge,0,0); makeup.connect(merge,0,1); merge.connect(g);
    const lp=lr4('lowpass',130); master.connect(lp.in); lp.out.connect(g);
  }

  /* ONLY VOICE: centre (L+R)/2 only, band-limited to the vocal range, small presence lift. */
  function buildOnly(){
    if(routes.only)return;
    const g=routes.only=newRoute(0);
    const mid=ctx.createGain(); mid.channelCount=1; mid.channelCountMode='explicit'; mid.channelInterpretation='speakers';
    master.connect(mid);
    const hp=lr4('highpass',200); mid.connect(hp.in);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=8000; lp.Q.value=RT2; hp.out.connect(lp);
    const pres=ctx.createBiquadFilter(); pres.type='peaking'; pres.frequency.value=2800; pres.Q.value=.8; pres.gain.value=2.5; lp.connect(pres);
    const makeup=ctx.createGain(); makeup.gain.value=1.5; pres.connect(makeup); makeup.connect(g);
  }

  function apply(){
    if(!ctx)return;
    if(mode==='cut')buildCut(); else if(mode==='only')buildOnly();
    const t=ctx.currentTime;
    Object.keys(routes).forEach(k=>routes[k].gain.setTargetAtTime(k===(mode==='off'?'off':mode)?1:0,t,.025));

    const db=bassOn?Math.min(12,bassDb):0;
    bassShelf.gain.setTargetAtTime(db*.8,t,.03);
    bassPeak.gain.setTargetAtTime(db*.4,t,.03);
    mudCut.gain.setTargetAtTime(-db*.3,t,.03);
    exGain.gain.setTargetAtTime(db/12*.45,t,.03);
    const nm=normOn();
    comp.threshold.setTargetAtTime(nm?-20:-1,t,.05); comp.knee.setTargetAtTime(nm?20:6,t,.05);
    comp.ratio.setTargetAtTime(nm?3:12,t,.05); comp.attack.setTargetAtTime(nm?.01:.003,t,.05); comp.release.setTargetAtTime(nm?.25:.14,t,.05);
    outGain.gain.setTargetAtTime(Math.pow(10,-db*.4/20)*(nm?2:1),t,.03);   // loudness compensation (+ makeup when normalizing)
    vibCheck();
  }

  function sourceFor(el){
    if(!ctx||!el)return null;
    if(sources.has(el))return sources.get(el);
    try{
      if(!el.crossOrigin)el.crossOrigin='anonymous';
      const s=ctx.createMediaElementSource(el); s.connect(master); sources.set(el,s); return s;
    }catch(err){console.warn('[Booster FX] attach failed',err);return null;}
  }
  function hookResume(){
    if(resumeHooked)return; resumeHooked=true;
    const go=()=>{if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});};
    ['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,go,{passive:true}));
  }
  function ensure(el){
    if(!build())return false;
    const a=A(),b=B(); if(a)sourceFor(a); if(b)sourceFor(b);
    const target=el||a||b; if(target)activeAudio=target;
    if(ctx.state!=='running')ctx.resume().catch(()=>{});
    hookResume(); apply();
    return !!(target&&sources.has(target));
  }
  function playingDeck(){const a=A(),b=B();return (a&&!a.paused)?a:(b&&!b.paused)?b:(a||b);}

  function open(){const p=$('bos-v9-fx-panel');if(p)p.classList.add('open');updateUI();}
  function close(){const p=$('bos-v9-fx-panel');if(p)p.classList.remove('open');}
  function togglePanel(){const p=$('bos-v9-fx-panel');if(p&&p.classList.contains('open'))close();else open();}

  function setMode(next,silent){
    if(next!=='off'&&!ensure(playingDeck())){
      mode='off';updateUI();
      try{alert('Voice effects could not start in this browser. Reload the song once and try again.');}catch(_){}
      return;
    }
    mode=next; saveState(); if(ctx)ensure(activeAudio||playingDeck()); updateUI();
    if(!silent)say(mode==='cut'?'🎤 Voice Cut ON':mode==='only'?'🎙 Only Voice ON':'Voice effects OFF');
  }
  const toggleMode=m=>setMode(mode===m?'off':m);

  function setBass(on,db,silent){
    bassDb=Math.max(0,Math.min(12,db)); bassOn=on&&bassDb>0;
    saveState(); updateUI();
    if(bassOn||ctx)ensure(activeAudio||playingDeck());
    if(!silent)say(bassOn?'🔊 Bass Boost +'+bassDb+' dB':'Bass Boost OFF');
  }
  /* ===== BASS VIBRATION: low-band beat detector -> navigator.vibrate pulses ===== */
  let vibRaf=0, vibAvg=0, vibLast=0; const vibBuf=new Uint8Array(512);
  const vibSupported=()=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
  function vibLoop(){
    vibRaf=0;
    if(!(bassVib&&bassOn&&analyser&&vibSupported()))return;
    const el=activeAudio||playingDeck();
    if(el&&!el.paused&&ctx&&ctx.state==='running'){
      analyser.getByteFrequencyData(vibBuf);
      const w=ctx.sampleRate/analyser.fftSize; const hi=Math.max(2,Math.round(140/w));
      let e=0,n=0; for(let i=1;i<=hi;i++){e+=vibBuf[i];n++;} e/=n;
      vibAvg=vibAvg*.94+e*.06;
      const now=performance.now();
      if(e>110&&e>vibAvg*1.18&&now-vibLast>110){
        vibLast=now;
        const ms=Math.round(Math.min(45,12+(e-vibAvg)*.35+bassDb));
        try{navigator.vibrate(ms);}catch(_){}
      }
    }
    vibRaf=requestAnimationFrame(vibLoop);
  }
  function vibCheck(){ if(bassVib&&bassOn&&vibSupported()){ if(!vibRaf)vibRaf=requestAnimationFrame(vibLoop); } else if(vibRaf){cancelAnimationFrame(vibRaf);vibRaf=0;try{navigator.vibrate(0);}catch(_){}} }
  function toggleVib(){
    if(!vibSupported()){say('📳 Vibration is not supported on this device/browser');return;}
    bassVib=!bassVib; saveState(); updateUI();
    if(bassVib&&!bassOn)setBass(true,bassDb||6,true); else if(ctx)ensure(activeAudio||playingDeck());
    vibCheck(); try{if(bassVib)navigator.vibrate(30);}catch(_){}
    say(bassVib?'📳 Bass Vibration ON':'Bass Vibration OFF');
  }
  function toggleBass(){bassOn?setBass(false,bassDb):setBass(true,bassDb||6);}
  function nudgeBass(d){setBass(true,(bassOn?bassDb:0)+d);}

  function seekBy(sec){
    try{
      const el=(typeof primaryAudio==='function')?primaryAudio():playingDeck(); if(!el)return;
      const t=Math.max(0,Math.min((el.currentTime||0)+sec,el.duration||1e9));
      if(typeof Player!=='undefined'&&Player.seekTo)Player.seekTo(t); else el.currentTime=t;
    }catch(_){}
  }
  function toggleLyrics(){
    const fp=$('full-player'); if(!fp||!fp.classList.contains('open'))return;
    const open=typeof State!=='undefined'&&State.lyricsOpen;
    const btn=$(open?'lyrics-close':'fp-lyrics-open'); if(btn)btn.click();
  }

  function onKey(e){
    if(e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented)return;
    const t=e.target, tag=t&&t.tagName;
    const typing=tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable)||(tag==='INPUT'&&!/^(range|checkbox|radio|button)$/.test(t.type));
    if(typing)return;
    const k=e.key;
    const on=tag==='INPUT'&&t.type==='range';
    if(!e.shiftKey){
      if(k==='v'||k==='V'){e.preventDefault();toggleMode('cut');return;}
      if(k==='o'||k==='O'){e.preventDefault();toggleMode('only');return;}
      if(k==='b'||k==='B'){e.preventDefault();toggleBass();return;}
      if(k==='f'||k==='F'){e.preventDefault();togglePanel();return;}
      if(k==='l'||k==='L'){e.preventDefault();toggleLyrics();return;}
      if(k===']'){e.preventDefault();nudgeBass(1);return;}
      if(k==='['){e.preventDefault();nudgeBass(-1);return;}
      if(!on&&k==='ArrowRight'){e.preventDefault();seekBy(5);return;}
      if(!on&&k==='ArrowLeft'){e.preventDefault();seekBy(-5);return;}
    }
    if(k==='?'){e.preventDefault();open();const d=$('bos-v9-keys');if(d)d.open=true;}
  }

  function wire(){
    loadState(); updateUI();
    const openBtn=$('bos-fx');
    if(openBtn)openBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();},true);
    const c=$('bos-v9-fx-close'); if(c)c.onclick=close;
    const bind=(id,fn)=>{const b=$(id);if(b)b.onclick=e=>{e.preventDefault();e.stopPropagation();fn();};};
    bind('bos-v9-voice-cut',()=>toggleMode('cut'));
    bind('bos-v9-voice-only',()=>toggleMode('only'));
    bind('bos-v9-bass-toggle',toggleBass);
    bind('bos-v9-bass-vib',toggleVib);
    const r=$('bos-v9-bass-range');
    if(r)r.oninput=function(){setBass(true,Number(this.value)||0,true);};
    [A(),B()].forEach(el=>{
      if(!el)return;
      el.addEventListener('play',()=>{activeAudio=el;if(mode!=='off'||bassOn||normOn())ensure(el);},{passive:true});
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.addEventListener('keydown',onKey);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  window.BoosterV9VoiceBass={open,close,ensure,setMode,setBass,setNormalize:function(on){ if(on)return !!ensure(playingDeck()); if(ctx)apply(); return true; },getState:()=>({mode,voiceCut:mode==='cut',voiceOnly:mode==='only',bassOn,bassDb,bassVib})};

  /* ===== v8: REVERB ON MANUAL SONG CHANGE =====
     Old song is fed into a convolver (generated hall IR) while dry ducks out; src then changes, so the
     reverb tail of the old song rings under the new song, which fades in. Auto-advance/crossfade is untouched. */
  function makeIR(sec){const n=(ctx.sampleRate*sec)|0,b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<n;i++){const t=i/n;lp+=(Math.random()*2-1-lp)*(.6-.45*t);d[i]=lp*Math.pow(1-t,3);}}return b;}
  function buildReverb(){const cv=ctx.createConvolver();cv.buffer=makeIR(3);revSend=ctx.createGain();revSend.gain.value=0;revWet=ctx.createGain();revWet.gain.value=1.6;master.connect(revSend);revSend.connect(cv);cv.connect(revWet);revWet.connect(bassShelf);}
  function reverbSwitch(){
    if(!revOn)return 0;
    const a=playingDeck(); if(!a||a.paused||!a.src||a.currentTime<.5)return 0;
    if(!ensure(a)||!ctx||!revSend)return 0;
    const t=ctx.currentTime;
    revSend.gain.cancelScheduledValues(t); revSend.gain.setTargetAtTime(1,t,.012);
    dry.gain.cancelScheduledValues(t); dry.gain.setTargetAtTime(0,t,.035);
    setTimeout(()=>{const n=ctx.currentTime; revSend.gain.setTargetAtTime(0,n,.1); dry.gain.cancelScheduledValues(n); dry.gain.setTargetAtTime(1,n+.05,.06);},150);
    return 150;
  }
  function attachExtra(el){ if(!build())return false; sourceFor(el); hookResume(); apply(); if(ctx.state!=='running')ctx.resume().catch(()=>{}); return sources.has(el); }
  window.BoosterFX={reverbSwitch:reverbSwitch,attach:attachExtra,setReverb:function(v){revOn=!!v;try{localStorage.setItem('boosterReverb',v?'1':'0');}catch(_){}}};
  const _play=Player.play;
  Player.play=async function(t,c,i,o){
    if(!(o&&o.autoTransition)){try{reverbSwitch();}catch(_){}}
    return _play.apply(this,arguments);
  };
  (function reverbUI(){
    const p=$('bos-v9-fx-panel'),note=p&&p.querySelector('.bos-v9-fx-note'); if(!p||!note)return;
    const r=document.createElement('div'); r.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;font-size:13px;color:#fff';
    r.innerHTML='<span>🌊 Reverb when I change song</span><button id="bos-reverb-t" type="button" style="padding:6px 14px;border-radius:99px;border:0;font-weight:700;cursor:pointer"></button>';
    note.before(r); const b=r.querySelector('button');
    const paint=()=>{b.textContent=revOn?'ON':'OFF';b.style.background=revOn?'var(--accent)':'rgba(255,255,255,.12)';b.style.color='#fff';};
    b.onclick=()=>{BoosterFX.setReverb(!revOn);paint();say(revOn?'🌊 Reverb transition ON':'Reverb transition OFF');}; paint();
  })();

})();
;
/* ===== bos-final-reliability-patch ===== */
(function BoosterFinalReliabilityPatch(){
  'use strict';
  const $=id=>document.getElementById(id);
  const storeKey='booster_sleep_timer_v1';
  let sleepTimerId=0, sleepEnd=0, sleepFadeTimer=0;

  /* ---------------- Sleep Timer ---------------- */
  function saveSleep(v){try{localStorage.setItem(storeKey,JSON.stringify(v));}catch(_){}
  }
  function readSleep(){try{return JSON.parse(localStorage.getItem(storeKey)||'null');}catch(_){return null;}}
  function clearSleep(){
    if(sleepTimerId)clearTimeout(sleepTimerId); sleepTimerId=0;
    if(sleepFadeTimer)clearInterval(sleepFadeTimer); sleepFadeTimer=0; sleepEnd=0;
    saveSleep(null); updateSleepUI();
  }
  function stopPlayback(){try{if(typeof Player!=='undefined')Player.pause();}catch(_){}
  }
  function expireSleep(){
    if(sleepTimerId)clearTimeout(sleepTimerId); sleepTimerId=0;
    if(sleepFadeTimer)clearInterval(sleepFadeTimer);
    const a=typeof primaryAudio==='function'?primaryAudio():null;
    const startVol=Number(State&&State.volume)||1, fadeMs=10000, started=Date.now();
    sleepFadeTimer=setInterval(()=>{
      const p=Math.min(1,(Date.now()-started)/fadeMs);
      try{if(a)a.volume=startVol*(1-p);}catch(_){}
      if(p>=1){clearInterval(sleepFadeTimer);sleepFadeTimer=0;stopPlayback();try{if(a)a.volume=startVol;}catch(_){} clearSleep();}
    },100);
    updateSleepUI();
  }
  function startSleep(min){
    clearSleep();
    min=Math.max(1,Number(min)||0);
    sleepEnd=Date.now()+min*60000;
    saveSleep({end:sleepEnd});
    sleepTimerId=setTimeout(expireSleep,min*60000);
    updateSleepUI();
    toast('Sleep Timer: '+min+' min');
  }
  function remaining(){return sleepEnd?Math.max(0,Math.ceil((sleepEnd-Date.now())/60000)):0;}
  function updateSleepUI(){
    const b=$('bos-sleep-status'); if(b)b.textContent=sleepEnd?'Sleep Timer • '+remaining()+' min':'Sleep Timer • Off';
  }
  function injectSleep(){
    const pop=$('bos-pop'); if(!pop||$('bos-sleep-card'))return;
    const box=document.createElement('div'); box.id='bos-sleep-card'; box.innerHTML=`<div class="bos-sleep-title">⏱ Sleep Timer</div><div class="bos-sleep-status" id="bos-sleep-status">Sleep Timer • Off</div><div class="bos-sleep-actions"><button data-sleep="15">15m</button><button data-sleep="30">30m</button><button data-sleep="45">45m</button><button data-sleep="60">60m</button><button data-sleep="0">Off</button></div>`;
    pop.appendChild(box);
    box.querySelectorAll('[data-sleep]').forEach(btn=>btn.addEventListener('click',()=>{const m=Number(btn.dataset.sleep);if(m)startSleep(m);else clearSleep();}));
    const saved=readSleep(); if(saved&&saved.end>Date.now()){sleepEnd=saved.end;const ms=sleepEnd-Date.now();sleepTimerId=setTimeout(()=>expireSleep(),ms); if(ms<=0)clearSleep();}
    updateSleepUI();
  }

  /* ---------------- Audio recovery ---------------- */
  const retryMap=new WeakMap();
  function bindAudioRecovery(el){
    if(!el||el.dataset.bosRecoveryBound)return; el.dataset.bosRecoveryBound='1';
    const recover=()=>{
      const track=State.currentTrack; if(!track)return;
      const n=(retryMap.get(el)||0)+1; retryMap.set(el,n);
      if(n>2)return;
      const old=el.src;
      setTimeout(()=>{if(!track||!bestAudioUrl(track))return;try{el.src=old||bestAudioUrl(track);el.load();el.play().catch(()=>{});}catch(_){}},Math.min(1200,n*450));
    };
    el.addEventListener('error',recover); el.addEventListener('stalled',recover); el.addEventListener('abort',()=>retryMap.delete(el));
    el.addEventListener('playing',()=>retryMap.delete(el));
  }

  /* ---------------- Diagnostics / health check ---------------- */
  window.BoosterHealth={
    run(){
      const a=typeof primaryAudio==='function'?primaryAudio():null;
      const t=State.currentTrack;
      const q=Array.isArray(State.queue)?State.queue:[];
      const ids=new Set(), families=new Set(), dupIds=[], dupFamilies=[];
      const norm=v=>String(v||'').toLowerCase().replace(/\\([^)]*\\)|\\[[^]]*\\]|\\{[^}]*\\}/g,' ').replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
      for(const x of q){const id=String(x&&x.id||'');const f=norm(x&&x.name)+'||'+norm(x&&x.artistName);if(id&&ids.has(id))dupIds.push(id);if(f&&families.has(f))dupFamilies.push(f);ids.add(id);families.add(f);}
      return {track:t&&t.name||null,playing:!!(a&&!a.paused),readyState:a&&a.readyState||0,networkState:a&&a.networkState||0,queue:q.length,duplicateIds:dupIds.length,duplicateFamilies:dupFamilies.length,crossfadeRunning:typeof crossfadeRunning!=='undefined'&&crossfadeRunning,autoTransition:!!State._autoTransitionInFlight,sleepTimerMinutes:remaining()};
    }
  };

  function boot(){
    const css=document.createElement('style');css.textContent=`#bos-sleep-card{margin-top:10px;padding:12px;border:1px solid var(--glass-1-brd,rgba(255,255,255,.12));border-radius:16px;background:var(--glass-1-bg,rgba(255,255,255,.05));}#bos-sleep-card .bos-sleep-title{font-weight:800;font-size:13px;}#bos-sleep-card .bos-sleep-status{font-size:11px;opacity:.65;margin:3px 0 9px}.bos-sleep-actions{display:flex;gap:6px;flex-wrap:wrap}.bos-sleep-actions button{border:1px solid var(--glass-1-brd,rgba(255,255,255,.12));background:transparent;color:inherit;border-radius:999px;padding:6px 10px;font-size:11px;cursor:pointer}`;document.head.appendChild(css);
    injectSleep(); [typeof audioA!=='undefined'?audioA:null,typeof audioB!=='undefined'?audioB:null].forEach(bindAudioRecovery);
    // Persisted timer recovery: do not recreate a timer after expiry.
    const saved=readSleep(); if(saved&&saved.end>Date.now()){sleepEnd=saved.end; if(sleepTimerId)clearTimeout(sleepTimerId); sleepTimerId=setTimeout(()=>{sleepEnd=Date.now();expireSleep();},saved.end-Date.now());}
    setInterval(()=>{if(sleepEnd&&!document.hidden)updateSleepUI();},15000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
;
/* ===== bos-second-round-smart-engine ===== */
(function BoosterSecondRoundSmartEngine(){
  'use strict';
  const KEY='booster_smart_stats_v2';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v||'').toLowerCase().replace(/&quot;|&#34;/g,'"').replace(/&amp;|&#38;/g,'&').replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,' ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  const artist=t=>clean(t&&t.artistName).split(' ,')[0].split(',')[0].trim();
  const family=t=>{
    if(!t)return '';
    let n=clean(t.name);
    const words=['official video','official audio','official','audio','video','lyrics','lyric','remix','remastered','reprise','cover','unplugged','lofi','lo-fi','slowed','reverb','speed up','sped up','nightcore','acoustic','instrumental','karaoke','live','edit','mix','duet','version','extended','8d','bass boosted'];
    words.sort((a,b)=>b.length-a.length).forEach(w=>n=n.replace(new RegExp('(^|\\s)'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)','gi'),' '));
    return n.replace(/\s+/g,' ').trim()+'||'+artist(t);
  };
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return {};}}
  function save(x){try{localStorage.setItem(KEY,JSON.stringify(x));}catch(_){} }
  let stats=load();
  const get=id=>stats[String(id)]||(stats[String(id)]={plays:0,seconds:0,skips:0,last:0});
  let lastTrackId=null,lastStart=0,lastCounted=0;
  function recordStart(t){if(!t||!t.id)return;const id=String(t.id);const st=get(id);st.plays++;st.last=Date.now();stats[id]=st;save(stats);lastTrackId=id;lastStart=Date.now();lastCounted=0;}
  function recordProgress(t,sec){if(!t||!t.id||!Number.isFinite(sec))return;const id=String(t.id);const st=get(id);if(id===lastTrackId){const delta=Math.max(0,sec-lastCounted);if(delta<20){st.seconds+=delta;lastCounted=sec;stats[id]=st;}}}
  function recordSkip(t,sec){if(!t||!t.id)return;const id=String(t.id);if(id!==lastTrackId)return;const st=get(id);if(sec<25&&Date.now()-lastStart>3000)st.skips++;stats[id]=st;save(stats);}
  function score(t,current,index){
    const st=t&&t.id?get(t.id):{plays:0,seconds:0,skips:0,last:0};
    const a=artist(t), ca=artist(current), cf=family(current), tf=family(t);
    let s=0;
    if(a&&a!==ca)s+=70; else if(a===ca)s-=95;
    if(tf===cf)s-=160;
    s-=Math.min(60,st.plays*8);
    s-=Math.min(45,st.skips*15);
    if(st.last&&Date.now()-st.last<6*60*60*1000)s-=25;
    if(t.duration>=150&&t.duration<=360)s+=5;
    s+=Math.max(0,20-index);
    return s;
  }
  function rebalanceQueue(){
    if(!window.State||!Array.isArray(State.queue)||!State.currentTrack)return;
    const start=Number(State.queueIndex)||0, current=State.currentTrack;
    if(start<0||start>=State.queue.length)return;
    const future=State.queue.slice(start+1).filter(Boolean);
    const seenIds=new Set(),seenFamilies=new Set(),clean=[];
    for(const t of future){const id=String(t.id||''),fk=family(t);if(!id||seenIds.has(id)||seenFamilies.has(fk)||fk===family(current))continue;seenIds.add(id);seenFamilies.add(fk);clean.push(t);}
    clean.sort((a,b)=>score(b,current,clean.indexOf(b))-score(a,current,clean.indexOf(a)));
    // Keep a little randomness so the engine doesn't become deterministic.
    if(clean.length>3 && Math.random()<0.45){const top=clean.splice(0,Math.min(3,clean.length));top.sort(()=>Math.random()-.5);clean.unshift(...top);}
    State.queue=State.queue.slice(0,start+1).concat(clean);
    if(State.shuffle&&typeof Queue!=='undefined')Queue.buildShuffleOrder();
    if(typeof Queue!=='undefined')Queue.persist();
  }
  function healthText(){
    const h=window.BoosterHealth&&BoosterHealth.run?BoosterHealth.run():null;
    if(!h){toast('Diagnostics are not ready yet.','error');return;}
    const parts=[];
    parts.push((h.playing?'▶ Playing':'⏸ Paused'));
    parts.push('Queue '+h.queue);
    if(h.duplicateIds||h.duplicateFamilies)parts.push('Duplicates '+(h.duplicateIds+h.duplicateFamilies));
    parts.push(h.crossfadeRunning?'Crossfade active':'Crossfade ready');
    if(h.sleepTimerMinutes)parts.push('Sleep '+h.sleepTimerMinutes+'m');
    toast(parts.join(' • '), (h.duplicateIds||h.duplicateFamilies)?'error':'');
    console.table(h);
  }
  function wire(){
    const health=$('bos-health');
    if(health)health.addEventListener('click',e=>{e.preventDefault();healthText();});
    const A=typeof audioA!=='undefined'?audioA:null, B=typeof audioB!=='undefined'?audioB:null;
    [A,B].forEach(el=>{if(!el)return;el.addEventListener('timeupdate',()=>{if(el===primaryAudio()&&State.currentTrack)recordProgress(State.currentTrack,el.currentTime);});});
    // Record starts without replacing the existing Player implementation.
    if(typeof Player!=='undefined'&&!Player.__bosSmartWrapped){
      const originalPlay=Player.play.bind(Player);
      Player.play=async function(track,ctx,index,opts){
        const auto=opts&&opts.autoTransition===true;
        if(auto)rebalanceQueue();
        const result=await originalPlay(track,ctx,index,opts);
        if(result&&track){recordStart(track);if(auto)setTimeout(rebalanceQueue,120);}
        return result;
      };
      Player.__bosSmartWrapped=true;
    }
    const primary=typeof primaryAudio==='function'?primaryAudio():null;
    if(primary&&!primary.__bosSmartSkip){
      primary.addEventListener('ended',()=>{if(State.currentTrack)recordProgress(State.currentTrack,primary.duration||0);});
      primary.__bosSmartSkip=true;
    }
    setInterval(()=>{if(typeof State!=='undefined'&&State&&State.currentTrack&&typeof primaryAudio==='function'){const a=primaryAudio();if(a&&!a.paused)recordProgress(State.currentTrack,a.currentTime);}},10000);
  }
  window.BoosterSmartEngine={
    stats:()=>JSON.parse(JSON.stringify(stats)),
    rebalanceQueue,
    resetStats:()=>{stats={};save(stats);toast('Smart listening data reset');},
    health:healthText
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
;
/* ===== bos-adaptive-fps ===== */
(function(){
  'use strict';
  let rafFrames=0,rafStart=0,last=0,measured=60;
  let running=true;
  function sample(now){
    if(!rafStart)rafStart=now; if(last&&now-last<80)rafFrames++; last=now;
    if(now-rafStart>=1000){
      measured=Math.max(30,Math.min(240,Math.round(rafFrames*1000/(now-rafStart))));
      document.documentElement.style.setProperty('--bos-refresh-rate',String(measured));
      document.documentElement.dataset.bosFps=measured>=110?'120plus':measured>=80?'high':'standard';
      rafFrames=0;rafStart=now;running=false;
      return;
    }
    requestAnimationFrame(sample);
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!running){running=true;rafStart=0;last=0;rafFrames=0;requestAnimationFrame(sample);}});
  const css=document.createElement('style');
  css.id='bos-adaptive-fps-style';
  css.textContent=`
    :root{--bos-refresh-rate:60}
    @media(prefers-reduced-motion:reduce){html *{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
  `;
  document.head.appendChild(css);
  requestAnimationFrame(sample);
})();
;
/* ===== bos-motion-script ===== */
(function BosMotion(){
  'use strict';
  /* Apple-style motion layer. Drives the EXISTING #mini-player, #full-player and #bottom-nav.
     It never creates a second player or touches the audio engine: the single source of
     truth for "player open" stays the `.open` class that openFullPlayer()/closeFullPlayer()
     already toggle, so every existing entry point (tap, swipe-up, back button, history,
     keyboard, lyrics bubble) animates without any call site being changed. */
  const root=document.documentElement;
  const fp=document.getElementById('full-player');
  const mini=document.getElementById('mini-player');
  const miniArt=document.getElementById('mini-art-wrap');
  const nav=document.getElementById('bottom-nav');
  const vs=document.getElementById('view-scroll');
  if(!fp||!mini||!miniArt||!nav||window.BosMotion) return;

  try{
    const art=fp.querySelector('.fp-art-wrap');
    const fpBg=fp.querySelector('.fp-bg'); const fpGrad=fp.querySelector('.fp-grad');
    const scrim=fp.querySelector('.fp-scrim');
    const tint=document.createElement('div'); tint.className='bos-fp-tint'; tint.setAttribute('aria-hidden','true'); fp.insertBefore(tint,fp.firstChild);
    const busyOn=()=>{ fp.classList.add('bos-busy'); mini.classList.add('bos-mv'); root.classList.add('bos-sheet-busy'); };
    const busyOff=()=>{ mini.classList.remove('bos-mv'); root.classList.remove('bos-sheet-busy'); };
    const content=['.fp-head','.fp-meta','.fp-progress-wrap','.fp-controls','.fp-side-actions']
      .map(s=>fp.querySelector(s)).filter(Boolean);
    const mqMobile=window.matchMedia('(max-width:980px)');
    const mqReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
    const IND=!!(window.CSS&&CSS.supports&&CSS.supports('translate','1px')&&CSS.supports('scale','1'));
    const clamp=(v,a,b)=>v<a?a:v>b?b:v;
    const lerp=(a,b,t)=>a+(b-a)*t;
    const ss=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x);};
    const instant=()=>mqReduce.matches;
    const noMorph=()=>mqReduce.matches;   /* Apple Music-style mini<->full morph is ON (only prefers-reduced-motion makes it instant) */

    /* ------------------------------------------------------------------ springs */
    function Spring(k,z,x,e){this.k=k;this.z=z;this.x=x;this.t=x;this.v=0;this.e=e||.0008;}
    Spring.prototype.step=function(dt){
      const c=2*Math.sqrt(this.k)*this.z, n=Math.max(1,Math.ceil(dt/.008)), h=dt/n;
      for(let i=0;i<n;i++){ this.v+=(-this.k*(this.x-this.t)-c*this.v)*h; this.x+=this.v*h; }
    };
    Spring.prototype.rest=function(){return Math.abs(this.x-this.t)<this.e&&Math.abs(this.v)<this.e*12;};
    const P =new Spring(780,.68,0,.0012);   /* player open progress 0..1 (snappy, tuned to the reference video) */
    const OPEN_K=780,OPEN_Z=.68,CLOSE_K=650,CLOSE_Z=1;
    const DY=new Spring(300,.8,0,.1);       /* finger drag offset in px             */
    const D =new Spring(620,.55,0);          /* tab-bar dock progress 0..1           */
    const springs=[P,DY,D];

    let raf=0,last=0;
    let fresh=0;
    function kick(){ if(raf) return; last=performance.now(); fresh=3; raf=requestAnimationFrame(tick); }
    function tick(now){
      raf=0;
      /* small max step + gentle first frames: a stalled frame (layout/raster at tap time) must not teleport the sheet */
      let dt=clamp((now-last)/1000,.004,.028); last=now;
      if(fresh>0){ dt=Math.min(dt,.014); fresh--; }
      let busy=false;
      for(const s of springs){
        if(s.rest()){ s.x=s.t; s.v=0; continue; }
        s.step(dt);
        if(s.rest()){ s.x=s.t; s.v=0; } else busy=true;
      }
      renderDock();
      if(sheetBusy&&!dragging&&!waRun) renderSheet();
      if(busy) raf=requestAnimationFrame(tick);
      else if(sheetBusy&&!dragging&&!waRun) finalize();
    }

    /* ------------------------------------------------------------------ geometry cache */
    let M=null;
    function measure(){
      const W=fp.clientWidth||window.innerWidth, H=fp.clientHeight||window.innerHeight;
      let m=mini.getBoundingClientRect(), ma=miniArt.getBoundingClientRect();
      if(m.width<20||m.height<20){           /* mini hidden by a setting: morph from where it would sit */
        m={left:W*.04,top:H-96,width:W*.92,height:64};
        ma={left:W*.04+10,top:H-96+10,width:44,height:44};
      }
      const pt=art.style.translate, ps=art.style.scale;
      art.style.translate='none'; art.style.scale='none';
      const fa=art.getBoundingClientRect();
      /* resting look of the artwork once the morph is finished (e.g. paused artwork rests at scale .88): the morph must end exactly there,
         otherwise the art visibly shrinks after opening / jumps bigger when closing starts */
      const ptr=art.style.transition; art.style.transition='none'; art.style.scale=''; art.style.translate='';
      const acs=getComputedStyle(art); let rs=parseFloat(acs.scale); if(!(rs>0)) rs=1; const rr=parseFloat(acs.borderTopLeftRadius)||26;
      art.style.transition=ptr; art.style.translate=pt; art.style.scale=ps;
      const cs=getComputedStyle(mini), as=getComputedStyle(miniArt);
      M={W,H,
        mini:{x:m.left,y:m.top,w:m.width,h:m.height},
        ma:{x:ma.left,y:ma.top,w:ma.width,h:ma.height},
        fa:{x:fa.left,y:fa.top,w:fa.width||1,h:fa.height||1},
        rad:parseFloat(cs.borderTopLeftRadius)||24,
        mar:parseFloat(as.borderTopLeftRadius)||14, rs:rs, rr:rr};
    }

    /* ------------------------------------------------------------------ sheet rendering */
    let wantOpen=fp.classList.contains('open'), sheetBusy=false, dragging=false, holdDY=false, pendingV=0, waRun=null;
    if(wantOpen){ P.x=P.t=1; fp.classList.add('bos-vis'); mini.style.opacity='0'; }

    /* corner radius measured from the reference: mini radius -> larger (~44px) while rising -> square when fully open */
    function radiusAt(p){ p=clamp(p,0,1); const r0=(M&&M.rad)||28; return lerp(r0,Math.max(r0,44),ss(0,.7,p))*(1-ss(.92,1,p)); }
    function renderSheet(){
      if(!M) measure();
      const p=clamp(P.x,0,1), W=M.W, H=M.H, r=M.mini;
      const x=lerp(r.x,0,p), y=lerp(r.y,0,p), w=lerp(r.w,W,p), h=lerp(r.h,H,p);
      const R=radiusAt(p);
      fp.style.clipPath='inset('+y+'px '+(W-x-w)+'px '+(H-y-h)+'px '+x+'px round '+R+'px)';
      const k=ss(0,.55,p);
      fpBg.style.setProperty('--k',k); scrim.style.setProperty('--k',k); if(fpGrad) fpGrad.style.setProperty('--k',k);
      tint.style.opacity=ss(0,.4,p); fp.style.setProperty('--k2',ss(.08,.62,p));
      const c=ss(.78,1,p), ty=(1-p)*36;
      for(let i=0;i<content.length;i++){
        content[i].style.opacity=c;
        if(IND) content[i].style.translate='0 '+ty+'px';
      }
      mini.style.opacity=1-ss(.1,.42,p);
      /* the mini art stays fully opaque underneath while the sheet art fades over it - two half-transparent layers crossfading dip to ~75% (visible blink) */
      miniArt.style.opacity=IND?(1-ss(.09,.1,p)):(1-ss(0,.1,p));
      if(IND){
        const s=lerp(M.ma.w/M.fa.w,M.rs,p);
        const cx=lerp(M.ma.x+M.ma.w/2,M.fa.x+M.fa.w/2,p)-(M.fa.x+M.fa.w/2);
        const cy=lerp(M.ma.y+M.ma.h/2,M.fa.y+M.fa.h/2,p)-(M.fa.y+M.fa.h/2);
        art.style.translate=cx+'px '+cy+'px';
        art.style.scale=s;
        art.style.borderRadius=(lerp(M.mar,M.rr*M.rs,p)/s)+'px';
        art.style.opacity=ss(0,.1,p);
      }
    }
    function finalize(){
      sheetBusy=false; window.__bosSheetEnd=Date.now();
      fp.style.clipPath=''; fp.style.transform=''; tint.style.opacity=''; fp.style.removeProperty('--k2');
      content.forEach(el=>{el.style.opacity='';el.style.translate='';});
      art.style.translate=''; art.style.scale=''; art.style.borderRadius=''; art.style.opacity='';
      fpBg.style.removeProperty('--k'); scrim.style.removeProperty('--k'); if(fpGrad) fpGrad.style.removeProperty('--k');
      fp.classList.remove('bos-busy','bos-dragging');
      P.x=P.t=wantOpen?1:0; P.v=0;
      mini.style.transition=''; mini.style.translate='';
      if(wantOpen){ mini.style.opacity='0'; miniArt.style.opacity='0'; }
      else{ mini.style.opacity=''; miniArt.style.opacity=''; fp.classList.remove('bos-vis'); }
      busyOff();
    }
    /* ---- Compositor path (default, built for 4 GB phones): the SAME spring is sampled once into keyframes and the browser
       (WAAPI) plays them - clip-path / opacity / translate / scale run off the main thread, so no JS runs per frame. ---- */
    const WA_OK=typeof fp.animate==='function';
    let K_REG=false; try{ CSS.registerProperty({name:'--k',syntax:'<number>',inherits:false,initialValue:'1'}); K_REG=true; }catch(_){ K_REG=!!(window.CSS&&CSS.registerProperty)&&true; }
    function waTraj(p0,v0,target,k,z){
      const sp=new Spring(k,z,clamp(p0,0,1),.0012); sp.t=target; sp.v=v0||0;
      const out=[clamp(p0,0,1)];   /* samples may overshoot 0..1 = the bounce */
      for(let i=0;i<48;i++){ sp.step(1/60); out.push(clamp(sp.x,-.05,1.07)); if(sp.rest()) break; }
      out[out.length-1]=target; return out;
    }
    function waProgress(){
      if(!waRun) return P.x;
      const tr=waRun.tr, t=waRun.anims[0].effect.getComputedTiming();
      const f=clamp(+t.progress||0,0,1)*(tr.length-1), i=Math.min(tr.length-2,Math.floor(f));
      return lerp(tr[i],tr[i+1],f-i);
    }
    function stopWA(){
      if(!waRun) return;
      const r=waRun; P.x=P.t=waProgress(); P.v=0;
      renderSheet();                                   /* write the current frame inline first, then drop the animations: no flash */
      waRun=null; r.anims.forEach(a=>{ a.onfinish=null; try{a.cancel();}catch(_){} });
    }
    function waMove(o,p0,v0){
      if(!M) measure();
      P.x=P.t=clamp(p0,0,1); P.v=0; renderSheet();
      const tr=waTraj(p0,v0,o?1:0,o?OPEN_K:CLOSE_K,o?OPEN_Z:CLOSE_Z), n=tr.length, W=M.W, H=M.H, r=M.mini;
      const baseBg=document.body.getAttribute('data-theme')==='light'?.5:.7;
      const opt={duration:Math.max(16,(n-1)*1000/60),easing:'linear',fill:'forwards'};
      const A=[];
      const add=(el,fn)=>{ if(el) A.push(el.animate(tr.map((p,i)=>Object.assign({offset:i/(n-1)},fn(p))),opt)); };
      add(fp,p=>{ p=clamp(p,0,1); const x=lerp(r.x,0,p), y=lerp(r.y,0,p), w=lerp(r.w,W,p), h=lerp(r.h,H,p);
        return {clipPath:'inset('+y+'px '+(W-x-w)+'px '+(H-y-h)+'px '+x+'px round '+radiusAt(p)+'px)'}; });
      A.push(fp.animate(tr.map((p,i)=>({offset:i/(n-1),opacity:ss(.08,.62,p)})),Object.assign({pseudoElement:'::before'},opt)));   /* dark glass layer: 0 at the mini player -> no black ring/card */
      add(tint,p=>({opacity:ss(0,.4,p)}));
      add(fpBg,p=>({opacity:baseBg*ss(0,.55,p)}));
      add(fpGrad,p=>({opacity:ss(0,.55,p)}));
      if(K_REG) add(scrim,p=>({'--k':String(ss(0,.55,p))}));   /* scrim opacity is !important via var(--k): animate the (registered) variable itself */
      content.forEach(el=>add(el,p=>{ const f={opacity:ss(.78,1,p)}; if(IND) f.translate='0 '+((1-clamp(p,0,1))*36)+'px'; return f; }));
      add(mini,p=>({opacity:1-ss(.1,.42,p)}));
      add(miniArt,p=>({opacity:IND?(1-ss(.09,.1,p)):(1-ss(0,.1,p))}));
      if(IND) add(art,p=>{
        p=clamp(p,0,1);   /* reference artwork settles without overshoot */
        const sc=lerp(M.ma.w/M.fa.w,M.rs,p);
        const cx=lerp(M.ma.x+M.ma.w/2,M.fa.x+M.fa.w/2,p)-(M.fa.x+M.fa.w/2);
        const cy=lerp(M.ma.y+M.ma.h/2,M.fa.y+M.fa.h/2,p)-(M.fa.y+M.fa.h/2);
        return {translate:cx+'px '+cy+'px',scale:sc,borderRadius:(lerp(M.mar,M.rr*M.rs,clamp(p,0,1))/sc)+'px',opacity:ss(0,.1,p)};
      });
      const run={anims:A,tr}; waRun=run;
      A[0].onfinish=()=>{ if(waRun!==run) return; waRun=null; finalize(); A.forEach(a=>{ try{a.cancel();}catch(_){} }); };
    }
    function setOpen(o){
      if(dragging) abortDrag();
      if(waRun) stopWA();
      wantOpen=o;
      if(!sheetBusy&&((o&&P.x<=.001)||(!o&&P.x>=.999))) measure();
      if(o) fp.classList.add('bos-vis');
      sheetBusy=true; busyOn();
      if(noMorph()){ P.x=P.t=o?1:0; P.v=0; renderSheet(); finalize(); return; }
      if(WA_OK){ const v=pendingV; pendingV=0; waMove(o,P.x,v); return; }
      P.t=o?1:0; P.k=o?OPEN_K:CLOSE_K; P.z=o?OPEN_Z:CLOSE_Z;
      if(pendingV){ P.v=pendingV; pendingV=0; }
      renderSheet(); kick();
    }
    new MutationObserver(()=>{
      const o=fp.classList.contains('open');
      if(o!==wantOpen) setOpen(o);
    }).observe(fp,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',()=>{ if(!sheetBusy) M=null; },{passive:true});

    /* ------------------------------------------------------------------ one finger-driven gesture for open AND close
       progress p (0 = mini, 1 = full) = p0 - fingerDy / travel. The sheet edge tracks the finger 1:1,
       release projects velocity, then the same spring settles it. Interruptible mid-flight. */
    const PROTECT='button:not(.fp-artist):not(.fp-album):not(.mini-artist):not(.mini-album),a,input,select,textarea,[role="button"],.seek-track';
    let g=null, dragRaf=0, noClickUntil=0;
    const travel=()=>Math.max(180,(M&&M.mini.y)||fp.clientHeight*.8);
    function lyricsUp(){ const lv=document.getElementById('lyrics-view'); return !!(lv&&lv.classList.contains('open')); }
    function scheduleRender(){ if(dragRaf) return; dragRaf=requestAnimationFrame(()=>{ dragRaf=0; if(dragging) renderSheet(); }); }
    function abortDrag(){
      if(g&&g.active){ try{g.host.releasePointerCapture(g.id);}catch(_){} }
      g=null; dragging=false; fp.classList.remove('bos-dragging'); mini.style.transition='';
      if(dragRaf){ cancelAnimationFrame(dragRaf); dragRaf=0; }
    }
    function activate(){
      if(waRun) stopWA();
      if(noMorph()){ g.active=true; P.v=0; P.t=P.x; g.p0=P.x; try{g.host.setPointerCapture(g.id);}catch(_){} return; }   /* no live morph: swipe only decides open/close on release */
      if(!sheetBusy||!M) measure();
      dragging=true; sheetBusy=true; g.active=true;
      fp.classList.add('bos-vis','bos-dragging'); busyOn();
      mini.style.setProperty('transition','none','important');
      try{g.host.setPointerCapture(g.id);}catch(_){}
      P.v=0; P.t=P.x; g.p0=P.x;
    }
    function onDown(e,host){
      if(g||e.isPrimary===false) return;
      if(e.pointerType==='mouse'&&e.button!==0) return;
      const t=e.target;
      if(t&&t.closest&&t.closest(PROTECT)) return;
      if(host===fp){ if(lyricsUp()) return; if(!wantOpen&&!sheetBusy) return; }
      else { if(!mini.classList.contains('show')) return; if(wantOpen&&!sheetBusy) return; }
      g={id:e.pointerId,host:host,x0:e.clientX,y0:e.clientY,p0:P.x,active:false,s:[{t:e.timeStamp,y:e.clientY}]};
      if(sheetBusy&&!dragging) activate();              /* catch the sheet mid-flight */
    }
    function onMove(e){
      if(!g||e.pointerId!==g.id) return;
      if(!g.active){
        const dx=e.clientX-g.x0, dy=e.clientY-g.y0, ax=Math.abs(dx), ay=Math.abs(dy);
        if(ax<12&&ay<12) return;                         /* touch slop: decide intent only after a real movement */
        if(ax>ay*1.25){ g=null; return; }                /* clearly horizontal = next / previous, untouched */
        activate();
        g.y0=e.clientY; g.p0=P.x;                        /* re-anchor so the sheet doesn't snap by the slop distance */
      }
      const s=g.s; s.push({t:e.timeStamp,y:e.clientY}); while(s.length>2&&e.timeStamp-s[0].t>90) s.shift();
      const T=travel();
      let p=g.p0-(e.clientY-g.y0)/T;
      if(p>1){ g.y0=e.clientY; g.p0=1; p=1; }           /* no dead zone after over-pulling past fully open */
      if(p<0&&!noMorph()){ const ex=-p*T; mini.style.translate='0 '+(28*(1-Math.exp(-ex/120)))+'px'; }
      else if(mini.style.translate) mini.style.translate='';
      P.x=P.t=clamp(p,0,1); P.v=0;
      if(!noMorph()) scheduleRender();
    }
    function settle(open,pv){
      pendingV=pv;
      if(open!==wantOpen){
        noClickUntil=0;
        if(open) miniArt.click();                        /* the app's own open path: history, state, lyrics */
        else { const cb=document.getElementById('fp-close'); if(cb) cb.click(); }
        if(fp.classList.contains('open')===open) return; /* observer -> setOpen() finishes with the same spring */
        pendingV=0;
      }
      sheetBusy=true; fp.classList.add('bos-vis'); busyOn();
      if(noMorph()){ P.x=P.t=wantOpen?1:0; P.v=0; renderSheet(); finalize(); return; }
      if(WA_OK){ pendingV=0; waMove(wantOpen,P.x,pv); return; }
      P.t=wantOpen?1:0; P.k=wantOpen?OPEN_K:CLOSE_K; P.z=wantOpen?OPEN_Z:CLOSE_Z; P.v=pv;
      renderSheet(); kick();
    }
    function onUp(e,cancel){
      if(!g||(e&&e.pointerId!==g.id)) return;
      const d=g; g=null;
      if(!d.active) return;
      if(dragRaf){ cancelAnimationFrame(dragRaf); dragRaf=0; }
      dragging=false; fp.classList.remove('bos-dragging');
      mini.style.transition=''; mini.style.translate='';
      try{d.host.releasePointerCapture(d.id);}catch(_){}
      noClickUntil=performance.now()+(cancel?0:450);
      const s=d.s, a=s[0], b=s[s.length-1];
      const vy=(b.y-a.y)/Math.max(b.t-a.t,16);           /* px per ms, + = down (V18: never divide by ~0 on a slow frame) */
      const pv=clamp(-vy*1000/travel(),-8,8);            /* progress per second */
      const p=clamp(P.x,0,1);
      let open;
      if(cancel) open=d.p0>.5;
      else if(Math.abs(vy)>.35) open=vy<0;               /* a flick decides */
      else{ const pp=p+pv*.12; open=d.p0>.5 ? pp>.72 : pp>.28; } /* otherwise ~28% of the travel is enough either way */
      settle(open,pv);
    }
    [mini,fp].forEach(h=>{
      h.addEventListener('pointerdown',e=>onDown(e,h));
      h.addEventListener('pointermove',onMove);
      h.addEventListener('pointerup',e=>onUp(e,false));
      h.addEventListener('pointercancel',e=>onUp(e,true));
      h.addEventListener('lostpointercapture',e=>{ /* V18: touch starts with an implicit capture on the child that was touched; handing capture to the host fires this on that child and used to cancel every swipe that did not start on the bare container */ if(g&&g.active&&e.pointerId===g.id&&e.target===g.host) onUp(e,true); });
      h.addEventListener('click',e=>{ if(performance.now()<noClickUntil){ e.stopPropagation(); e.preventDefault(); } },true);
      h.addEventListener('dragstart',e=>e.preventDefault());
    });
    document.addEventListener('visibilitychange',()=>{ if(document.hidden&&g&&g.active) onUp(null,true); });
    const miniInfo=document.getElementById('mini-info');
    if(miniInfo){
      miniInfo.tabIndex=0; miniInfo.setAttribute('aria-label','Open player');
      miniInfo.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&e.target===miniInfo){ e.preventDefault(); miniArt.click(); } });
    }

    /* ------------------------------------------------------------------ tab bar: dock + capsule */
    const items=Array.prototype.slice.call(nav.querySelectorAll('.bn-item'));
    const pill=document.createElement('div');
    pill.className='bn-pill'; pill.setAttribute('aria-hidden','true');
    nav.insertBefore(pill,nav.firstChild);
    const geo={cx:[],nw:0};
    let activeIdx=-2, lastD=-1;

    function activeIndex(){ for(let i=0;i<items.length;i++) if(items[i].classList.contains('active')) return i; return -1; }
    function placePill(i,instantly){
      if(i<0||!items[i]){ pill.classList.add('is-hidden'); return; }
      pill.classList.remove('is-hidden');
      const n=items[i];
      if(instantly) pill.style.transition='none';
      pill.style.width=n.offsetWidth+'px';
      pill.style.transform='translate3d('+n.offsetLeft+'px,0,0)';
      if(instantly){ void pill.offsetWidth; pill.style.transition=''; }
    }
    function layoutNav(instantly){
      if(!mqMobile.matches) return;
      const nw=nav.clientWidth; if(!nw) return;
      geo.nw=nw; geo.cx=items.map(n=>n.offsetLeft+n.offsetWidth/2);
      const si=items.findIndex(n=>n.dataset.nav==='search');
      const hi=items.findIndex(n=>n.dataset.nav==='home');
      const ai=activeIndex(); activeIdx=ai;
      const li=(ai>=0&&ai!==si)?ai:hi;
      items.forEach((n,i)=>{ n.classList.toggle('bn-left',i===li); n.classList.toggle('bn-right',i===si); });
      if(li>=0&&si>=0){
        nav.style.setProperty('--bn-cr',nw-50);
        nav.style.setProperty('--bn-ax',25-geo.cx[li]);
        nav.style.setProperty('--bn-sx',(nw-25)-geo.cx[si]);
      }
      placePill(ai,instantly);
    }
    new MutationObserver(()=>{ if(activeIndex()!==activeIdx) layoutNav(false); })
      .observe(nav,{attributes:true,attributeFilter:['class'],subtree:true});
    let rs=0;
    const onResize=()=>{
      if(rs) return;
      rs=requestAnimationFrame(()=>{ rs=0;
        if(!mqMobile.matches){ dockTo(0,true); return; }
        layoutNav(true);
      });
    };
    window.addEventListener('resize',onResize,{passive:true});
    window.addEventListener('orientationchange',onResize,{passive:true});
    window.addEventListener('load',()=>layoutNav(true),{once:true});

    function renderDock(){
      const d=clamp(D.x,0,1.03);
      if(Math.abs(d-lastD)<.0004) return; lastD=d;
      nav.style.setProperty('--bn-d',d); mini.style.setProperty('--bn-d',d);
      nav.style.setProperty('--bn-e',d<1?1-Math.pow(1-d,4):d);   /* front-loaded: the bar collapses first, the mini player then drops in */
    }
    function dockTo(v,snap){
      if(!mqMobile.matches) v=0;
      nav.classList.toggle('bn-docked',v>.5);
      if(D.t===v&&!snap) return;
      D.t=v;
      if(snap||instant()){ D.x=v; D.v=0; renderDock(); return; }
      kick();
    }

    /* scroll-driven dock (iOS-26 style, from the video): scroll down -> tab bar minimizes into [home][mini player][search];
       scroll up / reach the top / tap the bar -> it expands again. Passive listener, only touches the dock spring. */
    {
      let lastY=vs.scrollTop, acc=0, lastInput=-1e9;
      const mark=()=>{ lastInput=performance.now(); };
      ['touchstart','touchmove','touchend','wheel','pointerdown','keydown'].forEach(ev=>vs.addEventListener(ev,mark,{passive:true}));
      vs.addEventListener('scroll',()=>{
        const y=vs.scrollTop, dy=y-lastY; lastY=y;
        if(!mqMobile.matches||fp.classList.contains('open')||sheetBusy||Date.now()-(window.__bosSheetEnd||0)<900){ acc=0; return; }
        if(y<24){ acc=0; if(D.t>.5) dockTo(0); return; }
        if(performance.now()-lastInput>1500){ acc=0; return; }   /* programmatic scroll (view restore after back / close) is ignored */
        if((dy>0)!==(acc>0)) acc=0;
        acc+=dy;
        if(acc>28&&D.t<.5) dockTo(1);
        else if(acc<-16&&D.t>.5) dockTo(0);
      },{passive:true});
    }
    nav.addEventListener('click',()=>{ if(D.t>.5) dockTo(0); });

    /* sliding selection capsule that follows the finger */
    let nd=null;
    const nearest=cx=>{
      const lx=cx-nav.getBoundingClientRect().left; let b=0,bd=1e9;
      for(let i=0;i<geo.cx.length;i++){ const d=Math.abs(geo.cx[i]-lx); if(d<bd){bd=d;b=i;} }
      return b;
    };
    let hotIdx=-1;
    function setHot(i){ if(i===hotIdx) return; if(hotIdx>=0) items[hotIdx].classList.remove('bn-hot'); hotIdx=i; if(i>=0) items[i].classList.add('bn-hot'); }
    nav.addEventListener('pointerdown',e=>{
      if(e.button>0||!mqMobile.matches||nav.classList.contains('bn-docked')) return;
      const it=e.target.closest&&e.target.closest('.bn-item'); if(!it) return;
      nd={id:e.pointerId,x0:e.clientX,idx:items.indexOf(it),drag:false};
      pill.classList.add('is-press');
    });
    nav.addEventListener('pointermove',e=>{
      if(!nd||e.pointerId!==nd.id) return;
      if(!nd.drag){
        if(Math.abs(e.clientX-nd.x0)<7) return;
        nd.drag=true; try{nav.setPointerCapture(e.pointerId);}catch(_){}
        pill.classList.add('is-drag'); pill.classList.remove('is-hidden');
      }
      const r=nav.getBoundingClientRect(), pw=items[0].offsetWidth;
      const x=clamp(e.clientX-r.left-pw/2,items[0].offsetLeft,items[items.length-1].offsetLeft);
      pill.style.transform='translate3d('+x+'px,0,0)';
      setHot(nearest(e.clientX));
    });
    function endNav(e,cancel){
      if(!nd||(e&&e.pointerId!==nd.id)) return;
      const d=nd; nd=null;
      pill.classList.remove('is-press','is-drag'); setHot(-1);
      try{nav.releasePointerCapture(d.id);}catch(_){}
      if(d.drag&&!cancel){
        const i=nearest(e.clientX);
        placePill(i,false);
        if(i!==activeIndex()) items[i].click(); else placePill(i,false);
      }else if(d.drag){ placePill(activeIndex(),false); }
      else if(!cancel){ placePill(d.idx,false); }
    }
    nav.addEventListener('pointerup',e=>endNav(e,false));
    nav.addEventListener('pointercancel',e=>endNav(e,true));

    /* ------------------------------------------------------------------ boot */
    layoutNav(true);
    renderDock();
    window.BosMotion={P:P,D:D,DY:DY,dockTo:dockTo,layout:layoutNav};
    root.classList.add('bos-motion');          /* last step: only now do the gated CSS rules take effect */
  }catch(err){
    root.classList.remove('bos-motion');
    console.warn('Booster OS motion layer disabled:',err);
  }
})();
;
/* ===== bos-v12-micro-script ===== */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-action^="toggle-fav"]');
    if(!b||reduce.matches)return;
    var a=b.dataset.action,id=b.dataset.id;
    requestAnimationFrame(function(){          /* after the app handler (it may have re-rendered the node) */
      var n=b.isConnected?b:document.querySelector('[data-action="'+a+'"]'+(id?'[data-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]':''));
      if(!n||!n.classList.contains('active'))return;   /* burst only when it became a favourite */
      n.classList.remove('bos-heart-pop');void n.offsetWidth;n.classList.add('bos-heart-pop');
      setTimeout(function(){n.classList.remove('bos-heart-pop');},520);
    });
  });
})();
;
/* ===== bos-v13-motion-script ===== */
(function(){
  var B=document.body,de=document.documentElement;
  function off(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
  var vis=function(el){if(!el)return false;var r=el.getBoundingClientRect();return r.width>8&&r.height>8&&r.bottom>0&&r.top<innerHeight;};
})();
;
/* ===== bos-v16-player-motion-script ===== */
(function(){
  var B=document.body,de=document.documentElement;
  function off(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
  var fpPlay=document.getElementById('fp-play'),miniPlay=document.getElementById('mini-play');
  /* Both of these read the app's own play/pause icon, which the app derives from the real audio state. */
  function isPlayingIcon(btn){return !!(btn&&btn.querySelector('rect'));}
  function sync(){B.classList.toggle('bos-art-play',isPlayingIcon(fpPlay)||isPlayingIcon(miniPlay));}
  function pop(btn){
    var ic=btn&&btn.firstElementChild;
    if(!ic||off()||!ic.animate)return;
    ic.animate([{transform:'scale(.55) rotate(-70deg)',opacity:0},{transform:'scale(1.12) rotate(6deg)',opacity:1,offset:.65},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.34,1.3,.64,1)'});
  }
  [fpPlay,miniPlay].forEach(function(b){
    if(!b)return;
    new MutationObserver(function(){sync();pop(b);}).observe(b,{childList:true});
  });
  sync();
  /* Song change: artwork refocuses, title and artist slide in. Visual only; the app still sets the text and image. */
  var art=document.getElementById('fp-art'),title=document.getElementById('fp-title'),artist=document.getElementById('fp-artist'),mt=document.getElementById('mini-title');
  function slide(el,d){
    if(!el||off()||!el.animate||document.getElementById('full-player').classList.contains('bos-car-swap'))return;
    el.animate([{translate:'18px 0',opacity:0},{translate:'0 0',opacity:1}],{duration:340,delay:d||0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  }
  var lastTitle=title?title.textContent:'';
  if(title)new MutationObserver(function(){
    var t=title.textContent;if(t===lastTitle)return;lastTitle=t;
    if(t==='—'||!t)return;
    slide(title);slide(artist,50);slide(mt);
  }).observe(title,{childList:true,characterData:true,subtree:true});
  var lastSrc=art?art.getAttribute('src'):'';
  if(art)new MutationObserver(function(){
    var u=art.getAttribute('src');if(u===lastSrc)return;lastSrc=u;
    if(!u||off()||!art.animate||document.getElementById('full-player').classList.contains('bos-car-swap'))return;
    art.animate([{opacity:.15,transform:'scale(1.12)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
  }).observe(art,{attributes:true,attributeFilter:['src']});
})();
;
/* ===== bos-v17-pack ===== */
(function(){"use strict";
var R=matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function label(b){if(b.getAttribute("aria-label")||b.textContent.trim()||b.getAttribute("aria-labelledby"))return;
var l=b.title||b.dataset.action||b.dataset.nav||b.id||"";l=String(l).replace(/[-_]+/g," ").trim();if(l)b.setAttribute("aria-label",l);}
function pass(root){try{(root.matches&&root.matches("button")?[root]:[]).concat([].slice.call(root.querySelectorAll?root.querySelectorAll("button"):[])).forEach(label);}catch(e){}}
var q=[],t=0;
function stagger(nodes){var n=0;nodes.forEach(function(el){if(n>=14||el.classList.contains("bos-in"))return;
el.style.animationDelay=(n*40)+"ms";el.classList.add("bos-in");n++;
el.addEventListener("animationend",function f(e){if(e.target!==el)return;el.classList.remove("bos-in");el.style.animationDelay="";el.removeEventListener("animationend",f);});});}
function flush(){t=0;var items=[];q.forEach(function(n){if(n.nodeType!==1)return;pass(n);
if(!R){if(n.matches&&n.matches(".row-item,.card"))items.push(n);
else if(n.querySelectorAll)items.push.apply(items,n.querySelectorAll(".row-item,.card"));}});q=[];if(items.length)stagger(items);}
function boot(){pass(document.body);var v=document.getElementById("view-scroll");if(!v)return;
new MutationObserver(function(m){m.forEach(function(r){q.push.apply(q,r.addedNodes);});if(!t)t=requestAnimationFrame(flush);}).observe(v,{childList:true,subtree:true});
var bq=[],bt=0;
function tuneImgs(n){try{if(n.tagName==="IMG"){if(!n.decoding||n.decoding==="auto")n.decoding="async";}else if(n.querySelectorAll){var im=n.querySelectorAll("img");for(var i=0;i<im.length;i++){if(im[i].decoding!=="async")im[i].decoding="async";}}}catch(e){}}
function bflush(){bt=0;var l=bq;bq=[];for(var i=0;i<l.length;i++){var n=l[i];if(n.nodeType===1&&n.isConnected){pass(n);tuneImgs(n);}}}
new MutationObserver(function(m){for(var i=0;i<m.length;i++){var a=m[i].addedNodes;for(var j=0;j<a.length;j++)bq.push(a[j]);}if(!bt)bt=(window.requestIdleCallback?requestIdleCallback(bflush,{timeout:300}):setTimeout(bflush,60));}).observe(document.body,{childList:true,subtree:true});}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
if(navigator.vibrate&&!R)document.addEventListener("pointerdown",function(e){
if(e.pointerType==="mouse")return;if(e.target.closest&&e.target.closest(".play-btn,.ctrl-btn,.heart-btn,.bn-item,.nav-item,.btn"))try{navigator.vibrate(6);}catch(_){}},{passive:true});
})();
;
/* ===== bos-qa-fx-js ===== */
(function(){"use strict";
var $=function(i){return document.getElementById(i);};
function stag(root,sel){var n=0;root.querySelectorAll(sel).forEach(function(e){e.style.setProperty("--i",n++);});}
function watch(id,sel,anchor){var el=$(id);if(!el)return;var was=false;
new MutationObserver(function(){var o=el.classList.contains("open");if(o&&!was){stag(el,sel);
if(anchor){var f=$("bos-fab");if(f){var r=f.getBoundingClientRect(),b=el.getBoundingClientRect();
el.style.setProperty("--ox",Math.round(r.left+r.width/2-b.left)+"px");el.style.setProperty("--oy",Math.round(r.top+r.height/2-b.top)+"px");}}}
was=o;el.setAttribute("aria-hidden",o?"false":"true");}).observe(el,{attributes:true,attributeFilter:["class"]});}
function boot(){
watch("bos-pop",".bos-pop-head,.bos-pop-h,.bos-btn,#bos-sleep-card",true);
watch("bos-v9-fx-panel",".bos-v9-fx-head,.bos-v9-fx-actions button,.bos-v9-fx-row,.bos-v9-fx-note",false);
var pop=$("bos-pop");if(pop)pop.addEventListener("pointermove",function(e){var b=e.target.closest&&e.target.closest(".bos-btn");if(!b)return;var r=b.getBoundingClientRect();b.style.setProperty("--mx",(e.clientX-r.left)+"px");b.style.setProperty("--my",(e.clientY-r.top)+"px");},{passive:true});
var rg=$("bos-v9-bass-range"),val=$("bos-v9-bass-value");
if(rg){var fill=function(){rg.style.setProperty("--p",((rg.value-rg.min)/(rg.max-rg.min)*100)+"%");};fill();
rg.addEventListener("input",function(){fill();if(val){val.classList.remove("bump");void val.offsetWidth;val.classList.add("bump");}if(navigator.vibrate&&matchMedia("(pointer:coarse)").matches)try{navigator.vibrate(3);}catch(e){}});}
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;["bos-pop","bos-v9-fx-panel"].forEach(function(i){var x=$(i);if(x)x.classList.remove("open");});});
document.addEventListener("click",function(e){var p=$("bos-v9-fx-panel");if(p&&p.classList.contains("open")&&!e.target.closest("#bos-v9-fx-panel,#bos-fx,#bos-fab"))p.classList.remove("open");});
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();
;
/* ===== bos-v20-js ===== */
(function(){"use strict";
var R=matchMedia("(prefers-reduced-motion: reduce)").matches,H=document.documentElement;
/* page transitions */
var orig=window.navigate;
if(false){
window.navigate=function(){var a=arguments,self=this,r,ran=false;
try{H.classList.add("bos-vt");
var t=document.startViewTransition(function(){ran=true;r=orig.apply(self,a);});
t.ready.catch(function(){});t.updateCallbackDone.catch(function(e){console.warn("navigate:",e);});
t.finished.then(function(){H.classList.remove("bos-vt");},function(){H.classList.remove("bos-vt");});
}catch(e){H.classList.remove("bos-vt");if(!ran)r=orig.apply(self,a);}
return r;};}
/* close animation for the two panels */
function out(id,sel){var el=document.getElementById(id);if(!el)return;var was=el.classList.contains("open"),tm=0;
new MutationObserver(function(){var o=el.classList.contains("open");
if(o){clearTimeout(tm);if(el.classList.contains("bos-out"))el.classList.remove("bos-out");}
else if(was&&!R){var n=el.querySelectorAll(sel).length;el.style.setProperty("--n",n);el.classList.add("bos-out");clearTimeout(tm);tm=setTimeout(function(){if(el.classList.contains("bos-out"))el.classList.remove("bos-out");},480);}
was=o;}).observe(el,{attributes:true,attributeFilter:["class"]});}
function boot(){
out("bos-pop",".bos-pop-head,.bos-pop-h,.bos-btn,#bos-sleep-card");
out("bos-v9-fx-panel",".bos-v9-fx-head,.bos-v9-fx-actions button,.bos-v9-fx-row,.bos-v9-fx-note");}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
/* ripple on every button type */
var SEL=".btn,.icon-btn,.ctrl-btn,.nav-item,.bn-item,.stab,.seg-opt,.bos-btn,.bos-chip,.bos-v9-fx-actions button,.bos-v9-fx-close,.bos-lang,.bos-mood-close,.row-item,.card-play";
if(!R)document.addEventListener("pointerdown",function(e){
var b=e.target.closest&&e.target.closest(SEL);if(!b||b.disabled)return;
var r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*2.2,x=document.createElement("span");
b.classList.add("bos-rip-host");x.className="bos-rip";
x.style.cssText="width:"+d+"px;height:"+d+"px;left:"+(e.clientX-r.left-d/2)+"px;top:"+(e.clientY-r.top-d/2)+"px";
b.appendChild(x);x.addEventListener("animationend",function(){x.remove();});setTimeout(function(){x.remove();},900);},{passive:true,capture:true});
})();
;
/* ===== bos-v21-js ===== */
(function(){"use strict";
var H=document.documentElement,$=function(i){return document.getElementById(i);},coarse=matchMedia("(pointer:coarse)").matches;
function vib(n){if(coarse&&navigator.vibrate)try{navigator.vibrate(n);}catch(e){}}
function replay(el,c){el.classList.remove(c);void el.offsetWidth;el.classList.add(c);el.addEventListener("animationend",function f(e){if(e.target!==el)return;el.classList.remove(c);el.removeEventListener("animationend",f);});}
function boot(){
var au=[$("audio-el"),$("audio-el-2")].filter(Boolean);
function st(){H.classList.toggle("bos-playing",au.some(function(a){return !a.paused&&!a.ended;}));}
au.forEach(function(a){["play","pause","ended","playing","emptied"].forEach(function(e){a.addEventListener(e,st);});
["waiting","stalled","loadstart"].forEach(function(e){a.addEventListener(e,function(){if(!a.paused||e==="loadstart")H.classList.add("bos-buffering");});});
["playing","canplay","pause","error","emptied"].forEach(function(e){a.addEventListener(e,function(){H.classList.remove("bos-buffering");});});});
["fp-play","mini-play"].forEach(function(id){var b=$(id);if(!b||b.querySelector(".bos-arc"))return;var i=document.createElement("i");i.className="bos-arc";b.appendChild(i);
var busy=false;new MutationObserver(function(){if(busy)return;var v=b.querySelector("svg");if(v){busy=true;replay(v,"bos-sym");setTimeout(function(){busy=false;},120);}}).observe(b,{childList:true,subtree:true,attributes:true,attributeFilter:["d"]});});
document.addEventListener("pointerup",function(e){var b=e.target.closest&&e.target.closest(".ctrl-btn,.play-btn,.icon-btn,.heart-btn");if(b)replay(b,"bos-bounce");},{passive:true});
document.addEventListener("click",function(e){var h=e.target.closest&&e.target.closest("#fp-heart,#mini-heart,.heart-btn");if(h){setTimeout(function(){if(h.classList.contains("active")){var r=document.createElement("i");r.className="bos-burst";h.appendChild(r);setTimeout(function(){r.remove();},700);vib([8,30,8]);}else vib(6);},30);}
var k=e.target.closest&&e.target.closest("#fp-next,#mini-next,#fp-prev,#mini-prev");if(k){var w=document.querySelector(".fp-art-wrap");vib(10);if(w){var n=/next/.test(k.id);w.classList.remove("bos-skn","bos-skp");void w.offsetWidth;w.classList.add(n?"bos-skn":"bos-skp");setTimeout(function(){w.classList.remove("bos-skn","bos-skp");},650);}}},true);
var lv=0,lt=0;document.addEventListener("input",function(e){var r=e.target;if(!r||r.type!=="range")return;var now=Date.now();if(r.value!==lv&&now-lt>40){lv=r.value;lt=now;vib(2);}},{passive:true});
st();}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();
;
/* ===== bos-v20-visibility ===== */
document.addEventListener("visibilitychange",function(){document.documentElement.classList.toggle("bos-hidden",document.hidden);});
;
/* ===== bos-v23-fasttap ===== */
/* V23: instant press feedback on pointerdown (no waiting for the click / network / animation) */
(function(){"use strict";
var SEL='button,[data-action],.card,.row-item,.stab,.seg-opt,.bn-item,.nav-item,.toggle,[role="button"],.bos-cmdk-item,.bos-lang,.bos-artist-card';
var cur=null,x0=0,y0=0,tm=0;
function clr(){if(tm){clearTimeout(tm);tm=0;}if(cur){cur.classList.remove("bos-press");cur=null;}}
document.addEventListener("pointerdown",function(e){
  if(e.pointerType==="mouse")return;
  var t=e.target&&e.target.closest&&e.target.closest(SEL);
  if(!t||t.disabled)return;
  clr();cur=t;x0=e.clientX;y0=e.clientY;t.classList.add("bos-press");
},{passive:true,capture:true});
document.addEventListener("pointermove",function(e){if(cur&&(Math.abs(e.clientX-x0)>8||Math.abs(e.clientY-y0)>8))clr();},{passive:true,capture:true});
document.addEventListener("pointerup",function(){if(cur&&!tm)tm=setTimeout(clr,80);},{passive:true,capture:true});
document.addEventListener("pointercancel",clr,{passive:true,capture:true});
document.addEventListener("scroll",clr,{passive:true,capture:true});
})();
;
/* ===== bos-wakelock ===== */
(function(){let wl=null;
async function lock(){try{if('wakeLock' in navigator&&!wl&&document.visibilityState==='visible'){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null;});}}catch(e){}}
function unlock(){try{if(wl){wl.release();wl=null;}}catch(e){}}
document.addEventListener('play',()=>{const fp=document.getElementById('full-player');if(fp&&fp.classList.contains('open'))lock();},true);
document.addEventListener('pause',unlock,true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const fp=document.getElementById('full-player');const a=document.getElementById('audio-el');if(fp&&fp.classList.contains('open')&&a&&!a.paused)lock();}});
})();
;
/* ===== bos-playlists-lyoff ===== */
(function(){
'use strict';
const KEY='boosterOS_userPlaylists_v1',OFFK='boosterOS_lyoff_v1';
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let pls=ld(KEY,[]),offs=ld(OFFK,{}),curPid=null,pickTrack=null,nameRes=null;
const mixes={};function getP(id){return pls.find(x=>x.id===id)||mixes[id];}
const $$id=i=>document.getElementById(i);
const savePl=()=>sv(KEY,pls);
const uid=()=>'upl_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const plusSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
const curId=()=>State.currentTrack?String(State.currentTrack.id):'';
const getOff=()=>Number(offs[curId()])||0;

/* ---------- Lyrics offset (per track) ---------- */
const _ua=window.updateActiveLyric;
if(typeof _ua==='function')window.updateActiveLyric=function(t,f){return _ua.call(this,(Number(t)||0)+getOff(),f);};
const _sl=window.seekToLyric;
if(typeof _sl==='function')window.seekToLyric=function(t){return _sl.call(this,(Number(t)||0)-getOff());};
function offLabel(){const o=getOff();return (o>0?'+':'')+o.toFixed(1)+'s';}
function setOff(v){const id=curId();if(!id)return;v=Math.max(-10,Math.min(10,Math.round(v*10)/10));if(v===0)delete offs[id];else offs[id]=v;sv(OFFK,offs);paintOff();try{window.updateActiveLyric(primaryAudio().currentTime||0,true);}catch(e){}}
function paintOff(){const el=$$id('bos-lyoff-v');if(el)el.textContent=offLabel();}

/* ---------- DOM ---------- */
function build(){
  const head=document.querySelector('#lyrics-view .lyrics-head');
  if(!$$id('bos-pl-sheet')){
    document.body.insertAdjacentHTML('beforeend','<div id="bos-pl-sheet"></div><div id="bos-pl-pick" data-bos-pl="close-pick"><div class="bos-pl-box" id="bos-pl-pick-box"></div></div><div id="bos-pl-name"><div class="bos-pl-box"><h3 id="bos-pl-name-t">Playlist name</h3><input id="bos-pl-name-i" maxlength="60" placeholder="My playlist"><div class="bos-pl-row"><button class="btn btn-ghost" data-bos-pl="name-cancel">Cancel</button><button class="btn btn-primary" data-bos-pl="name-ok">Save</button></div></div></div>');
  }
}
function askName(title,init){return new Promise(res=>{nameRes=res;$$id('bos-pl-name-t').textContent=title;const i=$$id('bos-pl-name-i');i.value=init||'';$$id('bos-pl-name').classList.add('open');setTimeout(()=>i.focus(),50);});}
function nameDone(ok){const v=$$id('bos-pl-name-i').value.trim();$$id('bos-pl-name').classList.remove('open');if(nameRes){nameRes(ok&&v?v:null);nameRes=null;}}

/* ---------- Playlist logic ---------- */
function create(name){const p={id:uid(),name:name,tracks:[],created:Date.now()};pls.unshift(p);savePl();return p;}
function addTo(pid,t){const p=pls.find(x=>x.id===pid);if(!p||!t)return;if(p.tracks.some(x=>String(x.id)===String(t.id))){toast('Already in '+p.name);return;}p.tracks.push(t);savePl();toast('Added to '+p.name);refreshUI();}
function refreshUI(){if(curPid&&$$id('bos-pl-sheet').classList.contains('open'))renderSheet();if(State.view==='library'&&State.libTab==='playlists'&&typeof window.renderLibrary==='function')window.renderLibrary();}
function openPicker(t){if(!t){toast('Play a song first');return;}pickTrack=t;
  const box=$$id('bos-pl-pick-box');
  box.innerHTML='<h3>Add to playlist</h3><button class="bos-pl-item" data-bos-pl="pick-new"><div class="bos-pl-ph">+</div><div>New playlist</div></button>'
   +pls.map(p=>'<button class="bos-pl-item" data-bos-pl="pick" data-pid="'+esc(p.id)+'">'+(p.tracks[0]&&p.tracks[0].image?'<img loading="lazy" decoding="async" src="'+esc(p.tracks[0].image)+'" alt="">':'<div class="bos-pl-ph">♪</div>')+'<div>'+esc(p.name)+'<small>'+p.tracks.length+' songs</small></div></button>').join('');
  $$id('bos-pl-pick').classList.add('open');}
function closePicker(){$$id('bos-pl-pick').classList.remove('open');}
function renderSheet(){
  const s=$$id('bos-pl-sheet'),p=getP(curPid);if(!p){s.classList.remove('open');return;}
  const n=p.tracks.length,key='bos-pl-'+p.id;storeCtx(key,p.tracks);
  s.innerHTML='<div class="bos-pl-head"><button class="icon-btn" data-bos-pl="close-sheet" aria-label="Back">'+backIcon()+'</button><div class="bos-pl-title">'+esc(p.name)+'<small>'+n+' songs</small></div>'+(p.temp?'<button class="btn btn-ghost" data-bos-pl="savemix">Save as playlist</button>':'<button class="icon-btn" data-bos-pl="rename" aria-label="Rename">✎</button><button class="icon-btn" data-bos-pl="delete" aria-label="Delete playlist">'+svgTrash()+'</button>')+'</div>'
   +(n?'<div class="detail-actions" style="margin-bottom:16px;"><button class="btn btn-primary" data-bos-pl="playall">'+svgPlay()+' Play All</button><button class="btn btn-ghost" data-bos-pl="shuffle">Shuffle</button></div><div class="row-list">'+p.tracks.map((t,i)=>songRow(t,i,{ctxKey:key})).join('')+'</div>'
     :'<div style="padding:40px 10px;text-align:center;color:var(--text-2)">Empty playlist. Tap the + button on any song to add it here.</div>');
  s.querySelectorAll('.row-item').forEach((r,i)=>{r.dataset.idx=i;const a=r.querySelector('[data-bos-pl="add"]');if(a&&!p.temp){a.setAttribute('data-bos-pl','rm');a.setAttribute('aria-label','Remove');a.innerHTML=svgTrash();}});
  s.classList.add('open');}
function playList(list,i){if(list.length)Player.play(list[i||0],list,i||0);}
function injectLib(){
  const body=document.getElementById('library-body');if(!body||document.getElementById('bos-mypl'))return;
  const d=document.createElement('div');d.id='bos-mypl';d.style.marginBottom='22px';
  d.innerHTML='<div class="section-head"><div><div class="section-title">My Playlists</div><div class="section-sub">Created by you</div></div><button class="btn btn-primary" data-bos-pl="new">+ New playlist</button></div>'
   +(pls.length?'<div class="grid">'+pls.map(p=>'<div class="card" data-bos-pl="open" data-pid="'+esc(p.id)+'"><div class="card-art">'+(p.tracks[0]&&p.tracks[0].image?'<img src="'+esc(p.tracks[0].image)+'" alt="" loading="lazy">':'<div class="bos-pl-ph" style="width:100%;height:100%;border-radius:0;font-size:36px">♪</div>')+'</div><div class="card-title">'+esc(p.name)+'</div><div class="card-sub">'+p.tracks.length+' songs</div></div>').join('')+'</div>'
     :'<div style="color:var(--text-2);font-size:14px">No playlists yet. Create one, then add songs with the + button.</div>');
  body.insertBefore(d,body.firstChild);}

/* ---------- Wrap renderers ---------- */
const _rl=window.renderLibrary;
if(typeof _rl==='function')window.renderLibrary=function(){const r=_rl.apply(this,arguments);if(State.libTab==='playlists')injectLib();return r;};
const _sr=window.songRow;
if(typeof _sr==='function')window.songRow=function(t){const h=_sr.apply(this,arguments);return h.replace('<div class="row-dur">','<button class="ctrl-btn" data-bos-pl="add" data-id="'+esc(t.id)+'" aria-label="Add to playlist">'+plusSvg+'</button><div class="row-dur">');};

/* ---------- Click handling (capture so it wins over row play) ---------- */
document.addEventListener('click',async function(e){
  const t=e.target;
  const o=t.closest&&t.closest('[data-bos-off],#bos-lyoff-v');
  if(o){e.preventDefault();e.stopPropagation();if(o.id==='bos-lyoff-v')setOff(0);else setOff(getOff()+Number(o.dataset.bosOff));return;}
  const b=t.closest&&t.closest('[data-bos-pl]');
  if(b){
    e.preventDefault();e.stopPropagation();
    const a=b.dataset.bosPl,pid=b.dataset.pid||curPid,p=getP(pid);
    if(a==='add')openPicker(findTrackById(b.dataset.id));
    else if(a==='add-current')openPicker(State.currentTrack);
    else if(a==='close-pick'){if(t===b)closePicker();}
    else if(a==='pick'){addTo(b.dataset.pid,pickTrack);closePicker();}
    else if(a==='pick-new'){const tr=pickTrack;closePicker();const nm=await askName('New playlist','');if(nm){const np=create(nm);addTo(np.id,tr);}}
    else if(a==='new'){const nm=await askName('New playlist','');if(nm){create(nm);refreshUI();}}
    else if(a==='name-ok')nameDone(true);
    else if(a==='name-cancel')nameDone(false);
    else if(a==='open'){curPid=b.dataset.pid;renderSheet();}
    else if(a==='close-sheet'){$$id('bos-pl-sheet').classList.remove('open');curPid=null;refreshUI();}
    else if(a==='rename'&&p){const nm=await askName('Rename playlist',p.name);if(nm){p.name=nm;savePl();renderSheet();}}
    else if(a==='delete'&&p){if(await confirmModal('Delete "'+p.name+'"?','This playlist will be removed from this device.')){pls=pls.filter(x=>x.id!==p.id);savePl();$$id('bos-pl-sheet').classList.remove('open');curPid=null;refreshUI();toast('Playlist deleted');}}
    else if(a==='savemix'&&p){const np=create(p.name);np.tracks=p.tracks.slice();savePl();toast('Saved to My Playlists');}
    else if(a==='playall'&&p)playList(p.tracks,0);
    else if(a==='shuffle'&&p)playList(shuffleArray(p.tracks),0);
    else if(a==='rm'&&p){const row=b.closest('.row-item');const i=row?Number(row.dataset.idx):-1;if(i>=0){p.tracks.splice(i,1);savePl();renderSheet();}}
    return;
  }
  const row=t.closest&&t.closest('#bos-pl-sheet .row-item');
  if(row&&!t.closest('button')){const p=getP(curPid);if(p){e.preventDefault();e.stopPropagation();playList(p.tracks,Number(row.dataset.idx)||0);}}
},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='bos-pl-name-i'){e.preventDefault();nameDone(true);}if(e.key==='Escape'){if($$id('bos-pl-name')&&$$id('bos-pl-name').classList.contains('open'))nameDone(false);else closePicker();}},true);

function boot(){build();paintOff();setInterval(()=>{if(document.hidden)return;build();paintOff();},1500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.BoosterPlaylists={list:()=>pls,registerMix:m=>{mixes[m.id]=m;},openPicker:openPicker,replaceTrack:function(oid,nt){var ch=false;pls.forEach(function(p){(p.tracks||[]).forEach(function(x,i){if(x&&String(x.id)===String(oid)){p.tracks[i]=Object.assign({},nt);ch=true;}});});if(ch)savePl();return ch;}};
})();
;
/* ===== bos-v3-features ===== */
(function(){
'use strict';
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const gid=i=>document.getElementById(i);
/* ===== Search: recent searches, browse chips, top result ===== */
const RK='boosterOS_recentSearches_v1';
const BROWSE=['Hindi Hits','Punjabi Hits','Marathi Songs','Romantic','Party','Lo-fi Chill','90s Bollywood','Workout','Sad Songs','Devotional','Indie','Old is Gold'];
function saveRecent(q){q=String(q||'').trim();if(q.length<2)return;let r=ld(RK,[]).filter(x=>x.toLowerCase()!==q.toLowerCase());r.unshift(q);sv(RK,r.slice(0,8));}
function runQuery(q){const i=gid('search-input');if(i)i.value=q;State.searchQuery=q;const c=gid('search-clear');if(c)c.style.display='';saveRecent(q);window.runSearch();}
const _rse=window.renderSearchEmpty;
if(typeof _rse==='function')window.renderSearchEmpty=function(){const r=_rse.apply(this,arguments);try{const res=gid('search-results'),rec=ld(RK,[]);if(!res)return r;
  res.insertAdjacentHTML('beforeend',(rec.length?'<div class="bos-h"><span>Recent searches</span><button data-bos-clear="1">Clear</button></div><div class="bos-chips">'+rec.map(q=>'<button class="stab" data-bos-q="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div>':'')
   +'<div class="bos-h"><span>Browse all</span></div><div class="bos-chips">'+BROWSE.map(q=>'<button class="stab" data-bos-q="'+esc(q)+'">'+esc(q)+'</button>').join('')+'</div>');}catch(e){}return r;};
const _rs=window.runSearch;
if(typeof _rs==='function')window.runSearch=async function(){const r=await _rs.apply(this,arguments);
  try{if(State.searchTab==='all'&&State.searchQuery){const res=gid('search-results'),list=ctxStore.get('search-all');
   if(res&&list&&list[0]&&res.querySelector('.row-list')&&!res.querySelector('#bos-top')){const t=list[0];
    res.insertAdjacentHTML('afterbegin','<div id="bos-top"><div class="section-title" style="margin:6px 0 10px;">Top result</div><div class="bos-top-card" data-action="play-song" data-id="'+esc(t.id)+'" data-ctx="search-all"><img loading="lazy" decoding="async" src="'+esc(t.image)+'" alt="" onerror="this.src=\''+FALLBACK_ART+'\'"><div style="min-width:0"><b>'+esc(t.name)+'</b><small>Song • '+esc(t.artistName)+'</small></div></div></div>');}}}catch(e){}return r;};
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
  const q=t.closest('[data-bos-q]');if(q){e.preventDefault();e.stopPropagation();runQuery(q.dataset.bosQ);return;}
  if(t.closest('[data-bos-clear]')){e.preventDefault();e.stopPropagation();sv(RK,[]);window.renderSearchEmpty();return;}
  if(t.closest('#search-results [data-action]'))saveRecent(State.searchQuery);
},true);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='search-input')saveRecent(e.target.value);},true);

/* ===== Daily Mix ===== */
async function buildMixes(){
  const day=new Date().toISOString().slice(0,10),ck='bos_dailymix_'+day;
  try{Object.keys(localStorage).forEach(k=>{if(k.indexOf('bos_dailymix_')===0&&k!==ck)localStorage.removeItem(k);});}catch(e){}
  const c=ld(ck,null);if(c&&c.length)return c;
  const w=new Map(),add=(t,wt)=>{const a=String(t&&t.artistName||'').split(',')[0].trim();if(!a||/unknown/i.test(a))return;w.set(a,(w.get(a)||0)+wt);};
  (State.history||[]).slice(0,60).forEach(t=>add(t,1));(State.favSongs||[]).forEach(t=>add(t,3));
  const top=[...w.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const out=[],used=new Set(),ex=r=>((r&&r.data&&r.data.results)||[]).map(normalizeSong).filter(Boolean);
  for(const a of top){
    const [r1,r2]=await Promise.all([Api.searchSongs(a,0,25).catch(()=>null),Api.searchSongs(a+' similar songs',0,25).catch(()=>null)]);
    const pool=[],seen=new Set();
    for(const t of shuffleArray(ex(r1).slice(0,14).concat(ex(r2)))){const fk=SmartRadio.familyKey(t)||String(t.id);if(!t.id||seen.has(fk)||used.has(t.id))continue;seen.add(fk);pool.push(t);if(pool.length>=25)break;}
    if(pool.length<5)continue;pool.forEach(t=>used.add(t.id));
    const others=[...new Set(pool.map(t=>String(t.artistName).split(',')[0].trim()).filter(x=>x&&x!==a))].slice(0,2);
    out.push({id:'mix_'+(out.length+1),name:'Daily Mix '+(out.length+1),sub:[a].concat(others).join(', ')+' and more',tracks:pool,temp:true});
  }
  if(out.length)sv(ck,out);return out;
}
let mixBusy=false;
async function injectDaily(){
  const home=gid('view-home');if(!home||gid('sec-dailymix')||mixBusy||!home.querySelector('.section'))return;
  mixBusy=true;try{const mixes=await buildMixes();if(!mixes.length||gid('sec-dailymix'))return;
    mixes.forEach(m=>window.BoosterPlaylists&&window.BoosterPlaylists.registerMix(m));
    const d=document.createElement('div');d.className='section';d.id='sec-dailymix';
    d.innerHTML='<div class="section-head"><div><div class="section-title">Daily Mix</div><div class="section-sub">Made from what you play and like</div></div></div><div class="hscroll">'
      +mixes.map(m=>'<div class="card" data-bos-pl="open" data-pid="'+esc(m.id)+'"><div class="card-art"><img src="'+esc(m.tracks[0].image)+'" alt="" loading="lazy" onerror="this.src=\''+FALLBACK_ART+'\'"></div><div class="card-title">'+esc(m.name)+'</div><div class="card-sub">'+esc(m.sub)+'</div></div>').join('')+'</div>';
    const first=home.querySelector('.section');if(first&&first.id==='sec-recently-played-home')first.after(d);else home.insertBefore(d,home.firstChild);
  }catch(e){}finally{mixBusy=false;}
}
const _rh=window.renderHome;
if(typeof _rh==='function')window.renderHome=async function(){const r=await _rh.apply(this,arguments);setTimeout(injectDaily,60);return r;};

/* ===== Autoplay controls in Queue panel ===== */
function apPaint(){const b=document.querySelector('[data-bos-ap="toggle"]');if(!b)return;const on=!!(State.settings&&State.settings.autoplayNext);b.textContent='Autoplay: '+(on?'On':'Off');b.classList.toggle('active',on);}
function apBuild(){const head=document.querySelector('#queue-panel .queue-head');if(!head||gid('bos-ap'))return;const d=document.createElement('div');d.id='bos-ap';
  d.innerHTML='<button class="stab" data-bos-ap="toggle"></button><button class="stab" data-bos-ap="radio">New radio from this song</button>';head.after(d);apPaint();}
document.addEventListener('click',async e=>{const b=e.target.closest&&e.target.closest('[data-bos-ap]');if(!b)return;e.preventDefault();e.stopPropagation();
  if(b.dataset.bosAp==='toggle'){State.settings.autoplayNext=!State.settings.autoplayNext;saveSettings();apPaint();toast('Autoplay '+(State.settings.autoplayNext?'on':'off'));}
  else{if(!State.currentTrack){toast('Play a song first');return;}
    try{State.queue.splice(State.queueIndex+1);State.smartRadioRefillToken++;State.smartQueueBusy=false;if(State.shuffle&&Queue.buildShuffleOrder)Queue.buildShuffleOrder();toast('Building radio…');await SmartRadio.refill(24);renderQueuePanel();}catch(err){toast('Could not build radio');}}
},true);

function boot(){apBuild();apPaint();setInterval(()=>{if(document.hidden)return;apBuild();apPaint();},2000);
  const home=gid('view-home');if(home){new MutationObserver(debounce(injectDaily,400)).observe(home,{childList:true});}
  setTimeout(injectDaily,2000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
;
/* ===== bos-v6-liquid-js ===== */
(function(){
  /* viewport: edge-to-edge in landscape (notch safe) */
  try{
    var m=document.querySelector('meta[name=viewport]');
    if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
    if(!/viewport-fit/.test(m.content))m.content=(m.content||'width=device-width, initial-scale=1')+', viewport-fit=cover';
  }catch(e){}

  /* sliding selection pill (SwiftUI matchedGeometryEffect feel) */
  function setup(){
    var sb=document.getElementById('sidebar');if(!sb)return;
    var pill=document.getElementById('bos-pill');
    if(!pill){pill=document.createElement('div');pill.id='bos-pill';sb.insertBefore(pill,sb.firstChild);}
    var raf=0;
    function place(first){
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(function(){
        var a=sb.querySelector('.nav-item.active');
        if(!a||sb.offsetParent===null){pill.classList.remove('on');return;}
        var cs=getComputedStyle(sb);
        pill.style.height=a.offsetHeight+'px';
        if(first){pill.style.transition='none';}
        pill.style.transform='translateY('+a.offsetTop+'px)';
        pill.classList.add('on');
        if(first){void pill.offsetWidth;pill.style.transition='';}
      });
    }
    new MutationObserver(function(){place(false)}).observe(sb,{subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',function(){place(true)});
    var app=document.getElementById('app');
    if(app)new MutationObserver(function(){setTimeout(function(){place(false)},320)}).observe(app,{attributes:true,attributeFilter:['class']});
    sb.addEventListener('scroll',function(){},{passive:true});
    setTimeout(function(){place(true)},400);setTimeout(function(){place(true)},1200);
  }

  /* pointer-follow light on cards (desktop only) */
  if(matchMedia('(hover:hover) and (min-width:981px)').matches){
    document.addEventListener('pointermove',function(e){
      var c=e.target.closest&&e.target.closest('.card-art');
      if(!c)return;
      var r=c.getBoundingClientRect();
      c.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
      c.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
    },{passive:true});
    var st=document.createElement('style');
    st.textContent='.card-art::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.22),transparent 55%)}.card:hover .card-art::after{opacity:1}';
    document.head.appendChild(st);
  }

  /* keyboard shortcuts on laptop: Space = play/pause, arrows = prev/next */
  document.addEventListener('keydown',function(e){
    var t=e.target,tag=t&&t.tagName;
    if(e.defaultPrevented)return;
    if(tag==='INPUT'||tag==='TEXTAREA'||(t&&t.isContentEditable))return;
    var id=null;
    if(e.code==='Space')id='mini-play';
    else if(e.code==='ArrowRight'&&e.shiftKey)id='mini-next';
    else if(e.code==='ArrowLeft'&&e.shiftKey)id='mini-prev';
    if(id){var b=document.getElementById(id);if(b){e.preventDefault();b.click();}}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
;
/* ===== bos-v24-turbo-js ===== */
(function(){'use strict';
  var vs=document.getElementById('view-scroll'); if(!vs) return;
  var root=document.documentElement, t=0;
  vs.addEventListener('scroll',function(){
    if(!root.classList.contains('bos-scrolling')) root.classList.add('bos-scrolling');
    clearTimeout(t); t=setTimeout(function(){root.classList.remove('bos-scrolling');},140);
  },{passive:true});
})();
;
/* ===== bos-v25-lyricfix ===== */
/* v25: lyric spelling cleaner (runs on every lyric before display; never edits the cache) */
(function(){
'use strict';
var CP={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
function demoji(s){
  if(!/[\u00C2\u00C3\u00E2][\u0080-\u00BF\u0152-\u2122]/.test(s)) return s;
  try{
    var bytes=[],i,c;
    for(i=0;i<s.length;i++){ c=s.charCodeAt(i); if(c<256) bytes.push(c); else if(CP[c]) bytes.push(CP[c]); else return s; }
    return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
  }catch(e){ return s; }
}
var ENT={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',rsquo:"'",lsquo:"'",ldquo:'"',rdquo:'"',hellip:'...'};
function ents(s){
  if(s.indexOf('&')<0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,function(m,g){
    try{
      if(g.charAt(0)==='#') return String.fromCodePoint(g.charAt(1).toLowerCase()==='x'?parseInt(g.slice(2),16):parseInt(g.slice(1),10));
    }catch(e){ return m; }
    var v=ENT[g.toLowerCase()]; return v===undefined?m:v;
  });
}
/* canonical : common wrong / mixed spellings (Hinglish) */
var GROUPS=[
['tumhe','tumhein','tumhain','tumhen','tumhey'],['mujhe','mujhey','mujhay','mjhe','mujhee'],['tujhe','tujhey','tujhay','tujhee'],
['nahi','nhi','nahee','nahii','nahiin','nahin'],['kyun','kyu','kyon','kyoon','kyunn'],['kyunki','kyonki','kyuki','kyunke'],['kya','kyaa','kyaaa'],
['bhi','bhee','bhii'],['abhi','abhee'],['kabhi','kabhee'],['sabhi','sabhee'],['phir','fir','phirr'],['pyaar','pyar','pyaaar','pyaarr'],
['mohabbat','mohobbat','muhabbat','mohabat','muhobbat'],['ishq','ishk','ishaq'],['dil','dill'],['zindagi','zindagee','zindgi','zindagii','jindagi','zindaghi'],
['aankhen','ankhen','aankhein','ankhein','aankhe','ankhe'],['aasman','asman','aasmaan','asmaan'],['barsaat','barsat'],
['khwaab','khwab','khawab','khawaab','khuwab','khvab'],['intezaar','intezar','intazaar','intazar'],['ehsaas','ehsas','ahsaas','ahsas'],
['duniya','dunia','duniyaa','dunya'],['yaadein','yaaden','yaadain','yadein','yaden'],['hamesha','humesha','hamesa','hameshaa','humesa'],
['saath','sath','saathh'],['bahut','bohot','bahot','bohut','bhut','bahuth'],['zara','zra'],
['tumhara','tumhaara','tumara','tumhra'],['tumhare','tumhaare','tumare'],['tumhari','tumhaari','tumari'],
['mera','meraa'],['meri','meree'],['mere','merey','meray'],['tera','teraa'],['teri','teree'],['tere','terey','teray'],
['apna','apnaa'],['apni','apnee'],['apne','apney'],['humara','hamara','humaara','hamaara'],['jaan','jaann','jaaan'],
['jahan','jahaan'],['kahan','kahaan'],['yahan','yahaan'],['wahan','wahaan','vahan','vahaan'],['subah','subha','subaha','subeh'],
['mausam','mosam','mausaam'],['mehfil','mahfil','mehfeel'],['bewafa','bevafa','bewafaa'],['wafa','vafa'],['dua','duaa'],
['shayad','shaayad','shayed'],['waqt','vaqt','vakt','wakt'],['zamana','zamaana','jamana','jamaana'],['zaroor','zaruur','zarur','jaroor','jarur'],
['mushkil','mushqil','muskil'],['kaise','kaisey','kaisay'],['jaise','jaisey'],['aise','aisey','aisay'],['waise','vaise','waisey'],
['kuch','kuchh'],['koi','koyi','koee'],['jhooth','jhoot','jhut','jhuth'],['tanha','tanhaa'],['tanhai','tanhaai','tanhayi'],
['kismat','kismet','qismat'],['sukoon','sukun','sukhoon'],['junoon','junun'],['rooh','ruh'],['manzil','manjil'],['tarah','tarha'],
['baatein','baaten','baatain','baten'],['khushi','khushee','khushii','khoshi'],['khushboo','khushbu','khushbo'],['chehra','chehraa','chahra'],
['tasveer','tasweer','tasvir'],['tamanna','tamannaa','tammana'],['ummeed','umeed','umid','ummid'],['ilzaam','ilzam'],['hain','hein','haiin']
];
var DICT={};
GROUPS.forEach(function(g){ for(var i=1;i<g.length;i++) DICT[g[i]]=g[0]; });
var CONTR={dont:"don't",cant:"can't",wont:"won't",didnt:"didn't",doesnt:"doesn't",isnt:"isn't",wasnt:"wasn't",arent:"aren't",couldnt:"couldn't",wouldnt:"wouldn't",shouldnt:"shouldn't",havent:"haven't",hasnt:"hasn't",aint:"ain't",youre:"you're",theyre:"they're",thats:"that's",whats:"what's",theres:"there's",heres:"here's",ive:"I've",ill:null,im:null};
function caseLike(src,out){
  if(src.length>1 && src===src.toUpperCase()) return out.toUpperCase();
  if(src.charAt(0)!==src.charAt(0).toLowerCase()) return out.charAt(0).toUpperCase()+out.slice(1);
  return out;
}
function fixToken(t){
  var low=t.toLowerCase(), r;
  if(low==='i') return 'I';
  if(low.charAt(0)==='i'&&low.charAt(1)==="'"){ return 'I'+t.slice(1).toLowerCase(); }
  if(CONTR.hasOwnProperty(low)&&CONTR[low]){ return caseLike(t,CONTR[low]); }
  if(DICT.hasOwnProperty(low)) return caseLike(t,DICT[low]);
  return t;
}
var TOK=/[A-Za-z]+(?:'[A-Za-z]+)?/g;
function fixWords(s){ return s.replace(TOK,fixToken); }
function fixLine(s,first){
  if(!s) return s;
  s=demoji(String(s)); s=ents(s);
  s=s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g,'').replace(/\u00A0/g,' ');
  s=s.replace(/[\u2018\u2019\u02BC`´]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u2026/g,'...');
  s=s.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]{1,20}>/g,'');
  s=s.replace(/[ \t]{2,}/g,' ');
  s=s.replace(/\s+([,.!?;:])/g,'$1').replace(/([,;:!?])(?=[A-Za-z])/g,'$1 ').replace(/([!?]){3,}/g,'$1$1').replace(/\.{4,}/g,'...');
  s=s.trim();
  var letters=s.replace(/[^A-Za-z]/g,'');
  if(letters.length>=5 && letters===letters.toUpperCase() && !/[\u0900-\u0D7F]/.test(s)) s=s.toLowerCase();
  s=fixWords(s);
  if(first!==false && /^[a-z]/.test(s)) s=s.charAt(0).toUpperCase()+s.slice(1);
  return s;
}
function fixFragment(s){ if(!s) return s; s=demoji(String(s)); s=ents(s); s=s.replace(/[\u2018\u2019\u02BC`´]/g,"'"); return fixWords(s); }
window.bosFixLyrics=function(data){
  try{
    if(!data||!data.lines) return data;
    var copy=Object.assign({},data);
    copy.lines=data.lines.map(function(l,idx){
      if(!l) return l;
      var c=Object.assign({},l);
      c.text=fixLine(l.text);
      if(l.words&&l.words.length){
        c.words=l.words.map(function(w,wi){
          var t=fixFragment(w.text);
          if(wi===0&&/^[a-z]/.test(t||'')) t=t.charAt(0).toUpperCase()+t.slice(1);
          return Object.assign({},w,{text:t});
        });
        if(l._wt) c._wt=l._wt;
      }
      return c;
    });
    return copy;
  }catch(e){ return data; }
};
window.__bosLyricFix={fixLine:fixLine,demoji:demoji};
})();
;
/* ===== yt-source ===== */
(function(){
  // ==== SMART SERVER POOL: health-ranked, self-healing, auto-fallback ====
  // Servers are ranked by measured speed. A server that fails goes on a short "cooldown"
  // and the next fastest one is used instantly. Rankings are remembered between visits.
  var BASE_SERVERS = [
    'https://invidious.tiekoetter.com',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://inv.miningtcup.me'
  ];
  // ==== YouTube Music (InnerTube) source, SimpMusic-style: deploy ytm-stream-worker.js and paste its URL here ====
  // Or without editing: open the console and run  localStorage.setItem('bos_ytm_endpoint','https://your-worker.workers.dev')
  var YTM_ENDPOINT = window.BOOSTER_SERVER || '';
  try { YTM_ENDPOINT = (localStorage.getItem('bos_ytm_endpoint') || YTM_ENDPOINT).replace(/\/$/, ''); } catch (e) {}
  function srcUrl(h, id){ return h === 'ytm' ? YTM_ENDPOINT + '/ytm/stream?id=' + encodeURIComponent(id) : h + '/latest_version?id=' + encodeURIComponent(id) + '&itag=140&local=true'; }
  // ==== Piped (no server needed): public API that returns ready-to-play audio URLs ====
  var PIPED = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.leptons.xyz'];
  var ppCache = {};
  (function(){
    var c = lsGet('bos_pp_hosts_v1'); if (c && c.hosts && c.hosts.length) PIPED = c.hosts.concat(PIPED.filter(function(h){ return c.hosts.indexOf(h) < 0; })).slice(0, 10);
    if (c && Date.now() - c.t < 6 * 3600 * 1000) return;
    var ac = new AbortController(), tm = setTimeout(function(){ ac.abort(); }, 6000);
    fetch('https://piped-instances.kavin.rocks/', { signal: ac.signal }).then(function(r){ return r.json(); }).then(function(l){
      var u = (l || []).map(function(x){ return x && x.api_url; }).filter(function(x){ return /^https:\/\/[a-z0-9.-]+$/i.test(x || ''); }).slice(0, 8);
      if (!u.length) return;
      lsSet('bos_pp_hosts_v1', { t: Date.now(), hosts: u });
      PIPED = u.concat(PIPED.filter(function(h){ return u.indexOf(h) < 0; })).slice(0, 10);
    }).catch(function(){}).finally(function(){ clearTimeout(tm); });
  })();
  var ppPending = {};
  function ppResolve(id){
    var hit = ppCache[id]; if (hit && Date.now() - hit.t < 1500000) return Promise.resolve(hit.u);
    if (ppPending[id]) return ppPending[id];
    var pr = new Promise(function(ok, no){
      var over = false, fails = 0, ctls = [];
      function stopAll(){ ctls.forEach(function(c){ try { c.abort(); } catch (e) {} }); }
      PIPED.forEach(function(h){
        var c = new AbortController(), tm = setTimeout(function(){ c.abort(); }, 6000); ctls.push(c);
        fetch(h + '/streams/' + encodeURIComponent(id), { signal: c.signal })
          .then(function(r){ if (!r.ok) throw 0; return r.json(); })
          .then(function(d){
            clearTimeout(tm);
            var a = (d.audioStreams || []).filter(function(x){ return x && x.url && !x.videoOnly; });
            var m = a.filter(function(x){ return /m4a|mp4/i.test((x.format || '') + (x.mimeType || '')); });
            var best = (m.length ? m : a).sort(function(x, y){ return (y.bitrate || 0) - (x.bitrate || 0); })[0];
            if (!best) throw 0;
            if (over) return; over = true; ppCache[id] = { t: Date.now(), u: best.url }; stopAll(); ok(best.url);
          })
          .catch(function(){ clearTimeout(tm); if (++fails >= PIPED.length && !over) { over = true; no(new Error('piped')); } });
      });
    });
    ppPending[id] = pr;
    var clr = function(){ delete ppPending[id]; }; pr.then(clr, clr);
    return pr;
  }
  // YouTube Music catalog search (filter=music_songs) via Piped; falls back to normal Invidious search
  function musicSearch(q){
    if (YTM_ENDPOINT) return fetch(YTM_ENDPOINT + '/ytm/search?q=' + encodeURIComponent(q)).then(function(r){ if (!r.ok) throw 0; return r.json(); }).then(function(l){ if (!l.length) throw 0; return l; }).catch(function(){ return musicSearchPiped(q); });
    return musicSearchPiped(q);
  }
  function musicSearchPiped(q){
    return new Promise(function(ok, no){
      var over = false, fails = 0;
      function giveUp(){ if (over) return; over = true; searchAll(q).then(ok, no); }
      PIPED.forEach(function(h){
        var c = new AbortController(), tm = setTimeout(function(){ c.abort(); }, 6000);
        fetch(h + '/search?filter=music_songs&q=' + encodeURIComponent(q), { signal: c.signal })
          .then(function(r){ if (!r.ok) throw 0; return r.json(); })
          .then(function(d){
            clearTimeout(tm);
            var l = ((d && d.items) || []).map(function(x){
              var m = /[?&]v=([\w-]{11})/.exec((x && x.url) || '');
              return m ? { videoId: m[1], title: x.title, author: x.uploaderName || '', lengthSeconds: x.duration || 0 } : null;
            }).filter(Boolean);
            if (!l.length) throw 0;
            if (over) return; over = true; ok(l);
          })
          .catch(function(){ clearTimeout(tm); if (++fails >= PIPED.length) giveUp(); });
      });
    });
  }
  function pRace(urlFn, pick){
    return new Promise(function(ok, no){
      var over = false, fails = 0;
      PIPED.forEach(function(h){
        var c = new AbortController(), tm = setTimeout(function(){ c.abort(); }, 7000);
        fetch(urlFn(h), { signal: c.signal }).then(function(r){ if (!r.ok) throw 0; return r.json(); })
          .then(function(d){ clearTimeout(tm); var v = pick(d) || []; if (!v.length) throw 0; if (over) return; over = true; ok(v); })
          .catch(function(){ clearTimeout(tm); if (++fails >= PIPED.length && !over) { over = true; no(new Error('piped')); } });
      });
    });
  }
  function musicPlaylists(q){
    return pRace(function(h){ return h + '/search?filter=music_playlists&q=' + encodeURIComponent(q); }, function(d){
      return ((d && d.items) || []).map(function(x){
        var m = /[?&]list=([\w-]+)/.exec((x && x.url) || '');
        return m ? { type: 'playlist', playlistId: m[1], title: x.name || x.title || '', author: x.uploaderName || '', videoCount: x.videos || 0, playlistThumbnail: x.thumbnail || '' } : null;
      }).filter(Boolean);
    });
  }
  function musicPlaylistSongs(id){
    return pRace(function(h){ return h + '/playlists/' + encodeURIComponent(id); }, function(d){
      return ((d && d.relatedStreams) || []).map(function(x){
        var m = /[?&]v=([\w-]{11})/.exec((x && x.url) || '');
        return m ? { videoId: m[1], title: x.title, author: (x.uploaderName || '').replace(/ - Topic$/i, ''), lengthSeconds: x.duration || 0 } : null;
      }).filter(Boolean);
    });
  }
  var DISCOVER = true;            // also pull a few extra live servers from api.invidious.io (set false to disable)
  var SERVERS = BASE_SERVERS.slice();
  var HEALTH = {}, LSK = 'bos_inv_health_v2', LSX = 'bos_inv_extra_v1';
  function lsGet(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function addHosts(list){ (list || []).forEach(function(h){ if (typeof h === 'string' && SERVERS.indexOf(h) < 0) SERVERS.push(h); }); }
  (function(){
    var h = lsGet(LSK); if (h && typeof h === 'object') HEALTH = h;
    try { Object.keys(HEALTH).forEach(function(k){ var r = HEALTH[k]; if (r) { r.until = 0; r.fails = Math.min(r.fails || 0, 1); } }); } catch (e) {}   // a flaky moment last session must not blacklist every server today
    var x = lsGet(LSX); if (x && x.hosts) addHosts(x.hosts);
  })();
  function rec(h){ return HEALTH[h] || (HEALTH[h] = { lat: 1500, fails: 0, until: 0, seen: 0 }); }
  var saveT = 0;
  function save(){ clearTimeout(saveT); saveT = setTimeout(function(){ lsSet(LSK, HEALTH); }, 600); }
  function markGood(h, ms){ var r = rec(h); r.lat = r.seen ? Math.round(r.lat * 0.6 + ms * 0.4) : Math.round(ms); r.seen = 1; r.fails = 0; r.until = 0; save(); }
  function markBad(h){ var r = rec(h); r.fails++; r.until = Date.now() + Math.min(8000 * Math.pow(2, Math.min(r.fails, 5) - 1), 90000); save(); }
  function markSlow(h){ var r = rec(h); r.lat = Math.min((r.lat || 1500) + 800, 9000); save(); }
  function ranked(){
    var now = Date.now();
    var up = SERVERS.filter(function(h){ return rec(h).until <= now; }).sort(function(a, b){ return rec(a).lat - rec(b).lat; });
    var down = SERVERS.filter(function(h){ return rec(h).until > now; }).sort(function(a, b){ return rec(a).until - rec(b).until; });
    return up.concat(down);
  }
  function best(){ return ranked()[0]; }
  function isCool(h){ return rec(h).until > Date.now(); }

  var warmed = {};
  function warm(){
    ranked().slice(0, 2).forEach(function(h){
      if (warmed[h]) return; warmed[h] = 1;
      ['dns-prefetch', 'preconnect'].forEach(function(rel){ var l = document.createElement('link'); l.rel = rel; l.href = h; document.head.append(l); });
    });
  }

  // light health check: measures real response time of every server
  function ping(h){
    var c = new AbortController(), t0 = performance.now(), tm = setTimeout(function(){ c.abort(); }, 3500);
    return fetch(h + '/api/v1/stats', { signal: c.signal, cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('bad'); return r.json(); })
      .then(function(){ markGood(h, performance.now() - t0); })
      .catch(function(){ markSlow(h); })           // soft penalty only: some servers hide /stats but still work
      .finally(function(){ clearTimeout(tm); });
  }
  var lastCheck = 0;
  function checkAll(){ lastCheck = Date.now(); return Promise.all(SERVERS.map(ping)).then(warm); }

  function discover(){
    if (!DISCOVER) return;
    var x = lsGet(LSX); if (x && Date.now() - x.t < 6 * 3600 * 1000) return;
    var c = new AbortController(), tm = setTimeout(function(){ c.abort(); }, 6000);
    fetch('https://api.invidious.io/instances.json?sort_by=health', { signal: c.signal })
      .then(function(r){ return r.json(); })
      .then(function(list){
        var hosts = [];
        list.forEach(function(e){
          var m = e && e[1];
          if (m && m.type === 'https' && m.api === true && m.cors === true && /^https:\/\/[a-z0-9.-]+$/i.test(m.uri || '')) hosts.push(m.uri);
        });
        hosts = hosts.filter(function(h){ return BASE_SERVERS.indexOf(h) < 0; }).slice(0, 5);
        lsSet(LSX, { t: Date.now(), hosts: hosts }); addHosts(hosts); checkAll();
      })
      .catch(function(){})
      .finally(function(){ clearTimeout(tm); });
  }
  warm(); checkAll(); discover();
  setInterval(function(){ if (!document.hidden) checkAll(); }, 90000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && Date.now() - lastCheck > 60000) checkAll(); });
  window.addEventListener('online', function(){ checkAll(); });

  var $ = function(s){ return document.querySelector(s); };
  var ov = $('#yt-ov'), q = $('#yt-q'), msg = $('#yt-msg'), list = $('#yt-list'), stage = $('#yt-stage');
  var say = function(t){ msg.textContent = t || ''; };
  var tracks = [], session = 0, enc = encodeURIComponent;

  function pauseApp(){ ['audio-el','audio-el-2'].forEach(function(id){ var a = document.getElementById(id); if (a) { try { a.pause(); } catch (e) {} } }); }

  // ---- fastest servers first, others join if slow or failing; first answer wins ----
  var scache = {};
  function race(key, urlFn, pick){
    var hit = scache[key];
    if (hit && Date.now() - hit.t < 300000) return Promise.resolve(hit.v);
    return new Promise(function(ok, no){
      var order = ranked(), idx = 0, live = 0, over = false, ctls = [], timers = [];
      function finish(){ over = true; ctls.forEach(function(c){ c.abort(); }); timers.forEach(clearTimeout); }
      function launch(){
        if (over) return;
        if (idx >= order.length) { if (!live) { over = true; timers.forEach(clearTimeout); no(new Error('all failed')); } return; }
        var h = order[idx++], c = new AbortController(), t0 = performance.now();
        live++; ctls.push(c);
        var tm = setTimeout(function(){ c.abort(); }, 2500);
        fetch(urlFn(h), { signal: c.signal })
          .then(function(r){ if (!r.ok) throw new Error('bad'); return r.json(); })
          .then(function(d){
            clearTimeout(tm);
            var v = pick(d) || [];
            markGood(h, performance.now() - t0);
            if (over) return;
            if (!v.length) { live--; launch(); return; }   // empty answer: not the server's fault, ask the next one
            v.forEach(function(x){ if (x && typeof x === 'object') x._host = h; });
            finish(); scache[key] = { t: Date.now(), v: v }; ok(v);
          })
          .catch(function(){ clearTimeout(tm); live--; if (!over) { markBad(h); launch(); } });
      }
      launch(); launch(); launch();                          // three fastest servers right away
      timers.push(setTimeout(launch, 350), setTimeout(launch, 800));   // more join if still waiting
    });
  }
  // type: 'video' (songs), 'playlist' (playlists / albums), 'channel' (artists)
  function searchInv(term, type){
    type = type || 'video';
    return race('s:' + type + ':' + String(term).toLowerCase(),
      function(h){ return h + '/api/v1/search?type=' + type + '&q=' + enc(term); },
      function(d){ return (Array.isArray(d) ? d : []).filter(function(x){ return x && x.type === type; }); });
  }

  // ---- BOOSTER FIX: Invidious servers are mostly dead now, so video search tries several sources in parallel ----
  function anyGood(ps){
    return new Promise(function(ok, no){
      var n = ps.length, done = false;
      function miss(){ if (!done && --n === 0) no(new Error('none')); }
      ps.forEach(function(p){ Promise.resolve(p).then(function(v){ if (done) return; if (v && v.length) { done = true; ok(v); } else miss(); }, miss); });
    });
  }
  function ytDur(s){ return String(s || '').split(':').reduce(function(a, x){ return a * 60 + (+x || 0); }, 0); }
  // YouTube results page, fetched through your Booster worker (/p?u=) and parsed
  function ytWebSearch(term){
    var c = new AbortController(), tm = setTimeout(function(){ c.abort(); }, 4500);
    return fetch('https://www.youtube.com/results?hl=en&gl=IN&sp=EgIQAQ%253D%253D&search_query=' + enc(term), { signal: c.signal })
      .then(function(r){ if (!r.ok) throw 0; return r.text(); })
      .then(function(h){
        clearTimeout(tm);
        var m = /ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(h); if (!m) throw 0;
        var d = JSON.parse(m[1]), out = [], seen = {};
        (function w(n){
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { n.forEach(w); return; }
          var v = n.videoRenderer;
          if (v && v.videoId && !seen[v.videoId]) {
            seen[v.videoId] = 1;
            var t = v.title ? ((v.title.runs && v.title.runs.map(function(r){ return r.text; }).join('')) || v.title.simpleText || '') : '';
            var a = v.ownerText && v.ownerText.runs && v.ownerText.runs[0] ? v.ownerText.runs[0].text : '';
            out.push({ videoId: v.videoId, title: t, author: a, lengthSeconds: ytDur(v.lengthText && v.lengthText.simpleText) });
            return;
          }
          for (var k in n) w(n[k]);
        })(d);
        if (!out.length) throw 0; return out;
      }).catch(function(e){ clearTimeout(tm); throw e; });
  }
  function pipedVideoSearch(term){
    return pRace(function(h){ return h + '/search?filter=videos&q=' + enc(term); }, function(d){
      return ((d && d.items) || []).map(function(x){
        var m = /[?&]v=([\w-]{11})/.exec((x && x.url) || '');
        return m ? { videoId: m[1], title: x.title, author: x.uploaderName || '', lengthSeconds: x.duration || 0 } : null;
      }).filter(Boolean);
    });
  }
  function ytmWorkerSearch(term){
    if (!YTM_ENDPOINT) return Promise.reject(0);
    return fetch(YTM_ENDPOINT + '/ytm/search?q=' + enc(term)).then(function(r){ if (!r.ok) throw 0; return r.json(); }).then(function(l){ if (!Array.isArray(l) || !l.length) throw 0; return l; });
  }
  function ytWorkerSearch(term){
    if (!YTM_ENDPOINT) return Promise.reject(0);
    return fetch(YTM_ENDPOINT + '/yt/search?q=' + enc(term)).then(function(r){ if (!r.ok) throw 0; return r.json(); }).then(function(l){ if (!Array.isArray(l) || !l.length) throw 0; return l; });
  }
  var vcache = {};
  function searchAll(term, type){
    type = type || 'video';
    if (type !== 'video') return searchInv(term, type);
    var key = String(term).toLowerCase(), hit = vcache[key];
    if (hit && Date.now() - hit.t < 300000) return Promise.resolve(hit.v);
    var a = anyGood([ytWorkerSearch(term), searchInv(term, type), pipedVideoSearch(term)]).catch(function(){ return []; });
    var b = ytmWorkerSearch(term).catch(function(){ return []; });
    return new Promise(function(ok){
      var aDone = false;
      function fin(v){ if (v && v.length) vcache[key] = { t: Date.now(), v: v }; ok(v || []); }
      a.then(function(v){ aDone = true; if (v && v.length) fin(v); else b.then(fin); });
      b.then(function(v){ if (!aDone && v && v.length) setTimeout(function(){ fin(v); }, 600); });   // real videos get a short head start over the music-only list
    });
  }
  // all songs inside a playlist / of a channel
  function collection(kind, id){
    return race('c:' + kind + ':' + id,
      function(h){ return h + '/api/v1/' + (kind === 'channel' ? 'channels/' + enc(id) + '/videos' : 'playlists/' + enc(id)); },
      function(d){ var a = Array.isArray(d) ? d : ((d && d.videos) || []); return a.filter(function(x){ return x && x.videoId; }); });
  }

  async function search(term){
    list.innerHTML = ''; say('Searching...');
    try {
      var vids = await searchAll(term);
      tracks = vids.map(function(v){ return { id: v.videoId, name: v.title, artist: v.author || '' }; });
      render(); say('');
    } catch (e) {
      say('Search is not available right now. Try again in a minute.');
    }
  }

  function render(){
    list.innerHTML = '';
    tracks.forEach(function(t, i){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'it';
      var im = document.createElement('img'); im.src = 'https://i.ytimg.com/vi/' + t.id + '/mqdefault.jpg'; im.alt = ''; im.loading = 'lazy';
      var box = document.createElement('div');
      var n = document.createElement('b'); n.textContent = t.name;
      var a = document.createElement('small'); a.textContent = t.artist;
      box.append(n, a); b.append(im, box);
      b.onclick = function(){ playAt(i); };
      list.append(b);
    });
  }

  // ---- playback ----
  function showEmbed(host, t, hid){
    if (hid) { YTV.load(host, t.id, YTV.base || 0); return; }
    YTV.off();
    stage.innerHTML = '';
    var f = document.createElement('iframe');
    f.className = 'fr'; f.allowFullscreen = true; f.allow = 'autoplay; picture-in-picture';
    f.src = host + '/embed/' + enc(t.id) + '?autoplay=1&quality=medium';
    var title = document.createElement('div');
    title.style.cssText = 'margin:8px 2px 0;font-weight:600'; title.textContent = t.name;
    stage.append(f, title); stage.classList.add('on');
  }

  // Quietly checks that a server can really deliver this video (a plain <video> needs no permission headers).
  function probe(host, id, ms){
    return new Promise(function(ok, bad){
      var v = document.createElement('video'), done = false, t0 = performance.now();
      v.preload = 'metadata'; v.muted = true;
      var end = function(good){
        if (done) return; done = true; clearTimeout(timer);
        v.removeAttribute('src'); try { v.load(); } catch (e) {}
        if (good) { markGood(host, performance.now() - t0); ok(host); } else { markBad(host); bad(new Error(host)); }
      };
      var timer = setTimeout(function(){ end(false); }, ms);
      v.onloadedmetadata = function(){ end(true); };
      v.onerror = function(){ end(false); };
      v.src = host + '/latest_version?id=' + enc(id) + '&itag=140&local=true';
    });
  }

  // Verifies servers in order of speed. If one is slow (1.2 s) the next starts at once; if one fails the next starts instantly.
  function pickHost(id, order, my){
    return new Promise(function(ok, no){
      var idx = 0, pending = 0, done = false;
      function next(){
        if (done || my !== session) return;
        if (idx >= order.length) { if (!pending) { done = true; no(new Error('none')); } return; }
        if (pending >= 3) return;
        var h = order[idx++]; pending++;
        probe(h, id, 4000).then(function(x){ if (!done) { done = true; ok(x); } },
                                function(){ pending--; next(); });
        setTimeout(next, 1200);
      }
      next();
    });
  }

  async function playAt(i, hid){
    var t = tracks[i], my = ++session;
    pauseApp(); say('');
    if (hid) { YTV.start(t.id, 0); return; }              // Main Search: real audio, auto-failover inside
    var order = ranked();
    showEmbed(order[0], t, hid);                         // starts at once on the fastest known server
    try {
      var host = await pickHost(t.id, order, my);        // meanwhile: verify, fall back automatically
      if (my !== session) return;
      if (host !== order[0]) { showEmbed(host, t, hid); say('Switched to ' + host.replace('https://', '') + ' (faster)'); }
    } catch (e) {
      if (my === session) { say('Servers are busy, retrying...'); checkAll(); }
    }
  }


  // ---- BOOSTER + : YouTube songs as real tracks (favorites, own queue, video mode) ----
  function thumb(id){ return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
  function isYt(t){ return !!t && t.source === 'youtube'; }
  function vidOf(t){ return (t && (t.videoId || String(t.id || '').replace(/^yt_/, ''))) || ''; }
  function cleanAuthor(a){ return String(a || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim(); }
  function mkTrack(v){
    var id = v.videoId;
    return { id: 'yt_' + id, videoId: id, name: v.title || 'Untitled', artistName: cleanAuthor(v.author), albumName: '',
             image: thumb(id), duration: +v.lengthSeconds || 0, source: 'youtube' };
  }
  function normTrack(t){
    var id = vidOf(t); if (!id) return t;
    if (t.videoId === id && t.image && t.source === 'youtube') return t;
    return Object.assign({}, t, { videoId: id, id: 'yt_' + id, source: 'youtube', image: t.image || thumb(id),
                                  albumName: t.albumName || '', artistName: t.artistName || t.artist || '' });
  }
  function famOf(title){
    return String(title || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/official|video|audio|lyrical|lyrics|full song|hd|4k/g, ' ')
      .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
  }
  function related(id){
    return race('r:' + id,
      function(h){ return h + '/api/v1/videos/' + enc(id) + '?fields=recommendedVideos'; },
      function(d){ return (d && Array.isArray(d.recommendedVideos) ? d.recommendedVideos : []).filter(function(x){ return x && x.videoId; }); });
  }

  var YTV = (function(){
    var App = window.BosApp || {};
    var State = App.State, renderMiniPlayer = App.renderMiniPlayer, renderFullPlayer = App.renderFullPlayer, renderQueuePanel = App.renderQueuePanel,
        SystemMedia = App.SystemMedia, updateAmbient = App.updateAmbient, loadLyricsFor = App.loadLyricsFor,
        updatePlayIcons = App.updatePlayIcons, paintProgress = App.paintProgress, fmtTime = App.fmtTime,
        History = App.History, Store = App.Store, toast = App.toast || function(){};
    var FP = document.getElementById('full-player');
    // mode 'audio' = real audio stream (survives screen-off); 'iframe' = embed (last resort only)
    // vid = video mode switched on; vidReady = the <video> has taken over the sound
    var Y = { on:false, playing:false, id:'', dur:0, base:0, t0:0, host:best(), fr:null, tm:0,
              au:null, mode:'', tried:[], tok:0, wd:0, vol:((State && isFinite(State.volume)) ? Math.max(0, Math.min(1, State.volume)) : 1), rate:1, muted:!!(State && State.muted) };
    function el(){ return Y.au; }
    var fake = {
      get currentTime(){
        if (Y.mode === 'audio') { var e = el(); return (e && e.currentTime) || 0; }
        if (!Y.playing) return Y.base; var c = Y.base + (Date.now()-Y.t0)/1000; return Y.dur ? Math.min(c, Y.dur) : c;
      },
      set currentTime(v){ Y.seek(v); },
      get duration(){ if (Y.dur) return Y.dur; var e = el(), d = e && e.duration; return (d && isFinite(d)) ? d : NaN; },
      get paused(){ return !Y.playing; }, get ended(){ return false; },
      get volume(){ return Y.vol; }, set volume(v){ Y.vol = v; if (Y.au && !Y.xfIn) try { Y.au.volume = v; } catch (x) {} },   // while a BOOSTER+ crossfade ramps, the fade loop owns element volumes and reads Y.vol
      get muted(){ return Y.muted; }, set muted(v){ Y.muted = !!v; if (Y.au) Y.au.muted = !!v; },
      get playbackRate(){ return Y.rate; }, set playbackRate(v){ Y.rate = v || 1; if (Y.au) try { Y.au.playbackRate = Y.rate; } catch (x) {} },
      readyState:4, src:'yt',
      play:function(){ Y.resume(); return Promise.resolve(); }, pause:function(){ Y.halt(); },
      load:function(){}, addEventListener:function(){}, removeEventListener:function(){}
    };
    window.__bosYT = { prep: function(id){ try { if (id && !(Y.on && Y.id === id)) prep({ videoId: id }); } catch (e) {} }, get on(){ return Y.on; }, fake: fake, off: function(){ Y.off(); }, hosts: function(){ try{ return ranked().slice(0,3); }catch(e){ return []; } }, piped: function(){ try{ return PIPED.slice(0,4); }catch(e){ return []; } } };

    // ---------- real audio element ----------
    function onEnded(){
      Y.playing = false; Y.base = Y.dur || 0; icons();
      try { if (window.BosYT && window.BosYT.next) window.BosYT.next(true); } catch (e) {}
    }
    function audio(){
      if (Y.au) return Y.au; Y.au = mkAudio(); return Y.au;
    }
    function mkAudio(){
      var a = document.createElement('audio');
      a.id = 'yt-audio-el'; a.preload = 'auto'; a.setAttribute('playsinline', '');
      a.addEventListener('error', function(){ if (a.getAttribute('src')) Y.fail(a._tok); });
      a.addEventListener('ended', function(){ if (Y.mode !== 'audio' || !Y.on || Y.xfBusy) return; onEnded(); });
      a.addEventListener('playing', function(){ if (a === Y.au) setLoading(false); });
      a.addEventListener('waiting', function(){ if (a === Y.au && Y.on && Y.playing && Y.mode === 'audio') setLoading(true); });
      document.body.append(a); return a;
    }
    function stopAudio(){
      clearTimeout(Y.wd);
      if (Y.au) { try { Y.au.pause(); } catch (e) {} Y.au.onloadedmetadata = null; Y.au.onplaying = null; Y.au.removeAttribute('src'); try { Y.au.load(); } catch (e) {} }
    }
    // start a song: fastest server first; if it errors or stalls, the next server is tried automatically
    Y.start = function(id, start){
      if (Y.pre && Y.pre.id !== id) killPre();
      Y.id = id; Y.tried = []; Y.base = start || 0; Y.playing = true; Y.mode = 'audio';
      if (Y.fr) Y.fr.src = 'about:blank';
      setLoading(true); Y.next(); icons();
    };
    Y.next = function(){
      var tok = ++Y.tok;
      var ut = function(x){ return Y.tried.indexOf(x) < 0; };
      var h = ((YTM_ENDPOINT && ut('ytm') && !window.__boosterDown()) ? 'ytm' : null) || ranked().filter(function(x){ return ut(x) && !isCool(x); })[0] || (ut('pp') ? 'pp' : null) || ranked().filter(ut)[0];   /* ORDER: 1) your Worker 2) Invidious 3) Piped */
      if (!h) {
        // AUTO-RETRY: every source failed -> try the SAME song again (up to MAX_RETRY times) before giving up
        var MAX_RETRY = 3, sid = Y.id;
        if (Y.rtId !== sid) { Y.rtId = sid; Y.rt = 0; }
        if (Y.rt < MAX_RETRY) {
          Y.rt++;
          if (Y.rt > 1) { try { toast('Retrying the same song… (' + Y.rt + '/' + MAX_RETRY + ')'); } catch (e) {} }   // first retry is silent (spinner only)
          setLoading(true); clearTimeout(Y.rtT);
          Y.rtT = setTimeout(function(){
            if (!Y.on || Y.tok !== tok || Y.id !== sid || Y.mode !== 'audio' || !Y.playing) return;   // user skipped / paused / changed song meanwhile
            try { SERVERS.forEach(function(sv){ rec(sv).until = 0; }); } catch (e) {}                  // clear server cooldowns so they can be tried again
            Y.tried = []; Y.next();
          }, 1500 * Y.rt);
          return;
        }
        Y.rt = 0;
        try { toast('No audio source is reachable right now. Set up the worker (YTM_ENDPOINT).', 'error'); } catch (e) {} Y.mode = 'iframe'; stopAudio(); Y.load(best(), Y.id, Y.base); return;   // last resort: YouTube player plays the same song
      }
      Y.tried.push(h); if (h !== 'ytm' && h !== 'pp') Y.host = h;
      var pre = (Y.pre && Y.pre.id === Y.id && !Y.pre.bad && !(Y.base > 1)) ? Y.pre : null;
      if (pre) {   // the next song was already buffered in the background: use it, start is instant
        Y.pre = null; var oe = Y.au;
        if (oe && oe !== pre.a) { try { oe.pause(); oe.removeAttribute('src'); oe.load(); if (oe.remove) oe.remove(); } catch (e) {} }
        Y.au = pre.a; h = pre.host; if (h !== 'ytm' && h !== 'pp') Y.host = h; Y.tried = [h];
      }
      Y.cur = h;
      var a = audio(), t0 = performance.now(), startAt = Y.base;
      clearTimeout(Y.wd); a._tok = tok;
      a.onloadedmetadata = function(){
        if (tok !== Y.tok) return;
        if (!Y.dur && isFinite(a.duration)) Y.dur = a.duration;
        if (startAt > 1) { try { a.currentTime = startAt; } catch (e) {} }
      };
      a.onplaying = function(){
        if (tok !== Y.tok) return;
        clearTimeout(Y.wd); setLoading(false); markGood(h, performance.now() - t0); Y.tried = [h]; Y.rt = 0;
      };
      if (!pre) {
        if (h === 'pp') {
          try { a.removeAttribute('src'); a.load(); } catch (e) {}
          ppResolve(Y.id).then(function(u){
            if (tok !== Y.tok) return;
            a.src = u; var q = a.play();
            if (q && q.catch) q.catch(function(e){ if (tok === Y.tok && e && e.name === 'NotAllowedError') { Y.playing = false; setLoading(false); icons(); } });
          }, function(){ Y.fail(tok); });
        } else a.src = srcUrl(h, Y.id);
      }
      a.volume = Y.xfIn ? 0 : Y.vol; a.muted = Y.muted; a.playbackRate = Y.rate;
      var p = (h === 'pp' && !pre) ? null : a.play();
      if (p && p.catch) p.catch(function(e){
        if (tok !== Y.tok) return;
        if (e && e.name === 'NotAllowedError') { Y.playing = false; setLoading(false); icons(); }   // browser wants a tap: play button works
      });
      /* watchdog: a server that is answering (metadata/data arriving) gets up to 14s - the old fixed 2.5s timeout declared slow-but-working servers dead and burned through all of them */
      var wdT0 = performance.now();
      var wdChk = function(){
        if (tok !== Y.tok || !Y.playing || a.readyState >= 3) return;
        var el = performance.now() - wdT0;
        if ((a.readyState >= 1 || (a.buffered && a.buffered.length)) && el < 14000) { Y.wd = setTimeout(wdChk, 1500); return; }
        Y.fail(tok);
      };
      Y.wd = setTimeout(wdChk, h === 'pp' ? 8000 : h === 'ytm' ? 3500 : 5000);
    };
    Y.fail = function(tok){
      if (tok !== Y.tok || !Y.on || Y.mode !== 'audio') return;
      if (Y.cur === 'ytm') { try { window.__boosterMarkDown(); } catch (e) {} }
      markBad(Y.cur || Y.host);
      var pos = Y.au && Y.au.currentTime; if (pos > 1) Y.base = pos;   // keep the position when a server drops mid-song
      Y.next();
    };


    // ---------- pre-load the NEXT song in the background so it starts instantly ----------
    function killPre(){ var p = Y.pre; Y.pre = null; if (p && p.a) { try { p.a.pause(); p.a.removeAttribute('src'); p.a.load(); if (p.a.remove) p.a.remove(); } catch (e) {} } }
    function prep(t){
      var id = vidOf(t); if (!id || (Y.pre && Y.pre.id === id)) return;
      killPre(); var hst = YTM_ENDPOINT ? 'ytm' : (ranked().filter(function(x){ return !isCool(x); })[0] || ranked()[0]); if (!hst) return;
      var a = mkAudio(); a.id = 'yt-audio-pre'; a.preload = 'auto'; a.volume = 0;
      var rec = { id: id, a: a, host: hst, bad: false };
      a.addEventListener('error', function(){ rec.bad = true; });
      a.src = srcUrl(hst, id); try { a.load(); } catch (e) {}
      Y.pre = rec;
      try { ppResolve(id).catch(function(){}); } catch (e) {}
    }
    // ---------- CROSSFADE (BOOSTER +): next song starts on its own audio element while this one fades out ----------
    function startXF(old, cf){
      try { toast('Crossfading…'); } catch (x) {} try { console.log('[BOOSTER+] crossfade start'); } catch (x) {}
      Y.xfBusy = true; Y.xfIn = true; Y.au = null;
      var t0 = 0, len = 0, started = false, iv = 0;
      function done(){ clearInterval(iv); try { old.pause(); old.removeAttribute('src'); old.load(); if (old.remove) old.remove(); } catch (x) {} Y.xfIn = false; Y.xfBusy = false; if (Y.au) try { Y.au.volume = Y.vol; } catch (x) {} }
      Promise.resolve(window.BosYT.next(true)).then(function(ok){ if (ok === false) { clearInterval(iv); Y.au = old; try { old.volume = Y.vol; } catch (x) {} Y.xfIn = false; Y.xfBusy = false; } }, function(){ clearInterval(iv); Y.au = old; try { old.volume = Y.vol; } catch (x) {} Y.xfIn = false; Y.xfBusy = false; });
      iv = setInterval(function(){
        var n = Y.au, od = (isFinite(old.duration) && old.duration > 0) ? old.duration : (Y.xfDur || 0), rem = od - (old.currentTime || 0);
        if (!started) {
          if (n && n !== old && !n.paused && n.readyState >= 3 && n.currentTime > 0) { started = true; t0 = Date.now(); len = Math.max(1, rem - .7); }
          else { if (old.ended || rem < .8) done(); return; }   // next song was too slow: no crossfade, plain switch
        }
        var p = Math.min(1, (Date.now() - t0) / (len * 1000));
        try { old.volume = Math.max(0, Y.vol * (1 - p)); } catch (x) {}
        try { if (n && n !== old) n.volume = Y.vol * p; } catch (x) {}
        if (p >= 1) done();
      }, 80);
    }
    setInterval(function(){
      try {
        if (!Y.on || Y.mode !== 'audio' || !Y.playing || Y.xfBusy) return;
        var St = State, st = St.settings || {}; if (st.crossfade === false || st.autoplayNext === false || St.repeat === 'one') return;
        var e = Y.au; if (!e) return;
        var d = (isFinite(e.duration) && e.duration > 0) ? e.duration : Y.dur, cf = Math.min(+st.crossfadeDuration || 8, 12);   // streams can report Infinity: use the known song length
        if (!d || !isFinite(d) || d < cf * 2.5) return;
        var rem = d - e.currentTime, ni = St.shuffle ? St.shuffleOrder[0] : St.queueIndex + 1, nt = St.queue[ni];
        if (rem <= 50 && rem > 1 && nt && nt.source === 'youtube') prep(nt);
        if (rem > cf + 1 || rem <= 1) return; Y.xfDur = d;
        if (!nt || nt.source !== 'youtube') { if (!St.queue[ni]) { try { refillRelated(false); } catch (x) {} } return; }
        startXF(e, cf);
      } catch (x) {}
    }, 250);

    // ---------- iframe fallback (old method) ----------
    function frame(){
      if (Y.fr) return Y.fr;
      var f = document.createElement('iframe');
      f.allow = 'autoplay; picture-in-picture'; f.setAttribute('aria-hidden','true'); f.tabIndex = -1;
      f.style.cssText = 'position:fixed;left:0;top:0;width:6px;height:6px;opacity:0;border:0;pointer-events:none;z-index:60';
      document.body.append(f); Y.fr = f; return f;
    }
    function place(){
      if (!Y.fr) return;
      var fp = document.getElementById('full-player');
      var art = document.getElementById(fp && fp.classList.contains('open') ? 'fp-art' : 'mini-art');
      if (!art) return; var r = art.getBoundingClientRect();
      Y.fr.style.left = Math.round(r.left + r.width/2 - 3) + 'px';
      Y.fr.style.top = Math.round(r.top + r.height/2 - 3) + 'px';
    }
    setInterval(function(){ if(!document.hidden) place(); }, 300); window.addEventListener('resize', place);

    Y.load = function(host, id, start){
      setLoading(false); Y.host = host; Y.id = id; Y.base = start || 0; Y.t0 = Date.now(); Y.playing = true; Y.mode = 'iframe';
      frame().src = host + '/embed/' + enc(id) + '?autoplay=1&quality=medium' + (start > 1 ? '&start=' + Math.floor(start) : '');
      place(); icons();
    };
    Y.begin = function(t, light){
      Y.on = true; Y.dur = t.duration || 0; Y.base = 0; pauseApp();
      try { if (isFinite(State.volume)) Y.vol = Math.max(0, Math.min(1, State.volume)); Y.muted = !!State.muted; if (Y.au) Y.au.muted = Y.muted; } catch (e) {}   // local -> YouTube must start at the shared volume / mute state
      State.currentTrack = t; State.isPlaying = true;
      if (light) return;
      Y.beginUI(t);
    };
    Y.beginUI = function(t){
      try {
        try { History.add(t); Store.set('lastSong', t); } catch (e) {}
        renderMiniPlayer(); renderFullPlayer(); icons();
        try { renderQueuePanel(); } catch (e) {}
        try { SystemMedia.update(t); } catch (e) {}
        try { updateAmbient(t); } catch (e) {}
        var tt = document.getElementById('time-total'); if (tt && Y.dur) tt.textContent = fmtTime(Y.dur);
        if (typeof loadLyricsFor === 'function') loadLyricsFor(t);
      } catch (e) {}
    };
    Y.seek = function(v){
      v = Math.max(0, Math.min(+v || 0, Y.dur || 1e9)); Y.base = v; Y.t0 = Date.now();
      if (Y.mode === 'audio') {
        var e = el(); if (e) try { e.currentTime = v; } catch (x) {}
        return;
      }
      if (!Y.playing) return;
      clearTimeout(Y.tm); Y.tm = setTimeout(function(){ Y.load(Y.host, Y.id, Y.base); }, 250);
    };
    Y.halt = function(){
      if (!Y.playing) return; setLoading(false);
      if (Y.mode === 'audio') {
        var e = el(); Y.base = e ? e.currentTime : Y.base;
        try { if (Y.au) Y.au.pause(); } catch (x) {}
        Y.playing = false; clearTimeout(Y.wd); icons(); return;
      }
      Y.base = fake.currentTime; Y.playing = false;
      clearTimeout(Y.tm); if (Y.fr) Y.fr.src = 'about:blank'; icons();
    };
    Y.resume = function(){
      if (!Y.id || Y.playing) return;
      if (Y.mode === 'audio') {
        var a = Y.au;
        if (!a || !a.getAttribute('src') || a.error) { Y.start(Y.id, Y.base); return; }
        if (Y.dur && Y.base >= Y.dur - 0.5) { try { a.currentTime = 0; } catch (e) {} Y.base = 0; }
        Y.playing = true; icons();
        var p = a.play(); if (p && p.catch) p.catch(function(){ Y.playing = false; icons(); });
        return;
      }
      Y.load(isCool(Y.host) ? best() : Y.host, Y.id, Y.base);
    };
    Y.off = function(){
      Y.on = false; Y.playing = false; Y.base = 0; Y.mode = ''; Y.tok++; clearTimeout(Y.tm); killPre(); setLoading(false);
      stopAudio();
      if (Y.fr) Y.fr.src = 'about:blank';
    };
    // loading ring on the play/pause buttons (uses the app's existing html.bos-buffering ring)
    function setLoading(on){ Y.loading = !!on; clearTimeout(Y.lt); if (on) Y.lt = setTimeout(function(){ setLoading(false); }, 20000); try { document.documentElement.classList.toggle('bos-buffering', !!on); } catch (e) {} }
    function icons(){ try { State.isPlaying = Y.playing; updatePlayIcons(); } catch (e) {} try { if (SystemMedia && SystemMedia.state) SystemMedia.state(); } catch (e) {} }
    // the app paints progress/time only from real <audio> events, so drive it from our own clock
    setInterval(function(){
      if (!Y.on) return;
      try {
        if (Y.mode === 'iframe' && Y.playing && Y.dur && fake.currentTime >= Y.dur - 0.3) { Y.halt(); Y.base = Y.dur; }
        if (State.currentTrack && State.currentTrack.source === 'youtube') {
          if (State.isPlaying !== Y.playing) { State.isPlaying = Y.playing; updatePlayIcons(); }
          document.documentElement.classList.toggle('bos-playing', !!Y.playing);   // art springs up while a YouTube song plays
          document.documentElement.classList.toggle('bos-buffering', !!Y.loading && !!Y.playing);
          if (Y.dur || fake.duration) paintProgress(fake);
          if (SystemMedia && SystemMedia.position && Date.now() - (Y._mp || 0) > 1000) { Y._mp = Date.now(); SystemMedia.position(); }   // keep the lock-screen scrubber in sync for YouTube songs
        }
      } catch (e) {}
    }, 400);

    // play / pause buttons control the YouTube song while it is the current song
    ['mini-play','fp-play'].forEach(function(id){
      var b = document.getElementById(id); if (!b) return;
      b.addEventListener('click', function(e){
        var t = State.currentTrack; if (!t || t.source !== 'youtube') return;
        e.stopImmediatePropagation(); e.preventDefault();
        window.BosYT.toggle();
      }, true);
    });
    // any normal app song starting stops the YouTube song
    function stopIfOtherSong(){
      if (!Y.on) return;
      var t = State.currentTrack;
      if (t && t.source !== 'youtube') { Y.off(); try { State.isPlaying = true; updatePlayIcons(); } catch (e) {} }
    }
    ['play', 'playing'].forEach(function(ev){
      document.addEventListener(ev, function(e){
        var el2 = e.target;
        if (Y.on && el2 && el2.tagName === 'AUDIO' && el2 !== Y.au) Y.off();
      }, true);
    });
    setInterval(stopIfOtherSong, 150);
    /* the local players' own 'pause/emptied' events clear the ring: put it back while a YouTube song is still loading */
    ['pause', 'emptied', 'canplay'].forEach(function(ev){
      document.addEventListener(ev, function(e){
        var x = e.target; if (!Y.on || !Y.loading || !x || x.tagName !== 'AUDIO' || x === Y.au) return;
        setTimeout(function(){ if (Y.loading) document.documentElement.classList.add('bos-buffering'); }, 0);
      }, true);
    });

    return Y;
  })();

  // ---- YouTube queue: its own list of YouTube songs, filled with related songs ----
  var refilling = false, recentIds = [], artistHist = [];
  var BAD_RE = /\b(reaction|reacts?|trailer|teaser|interview|full album|jukebox|mashup|nonstop|non-stop|\d+\s*hours?|podcast|review|making of|behind the scenes|shorts?|tutorial|karaoke|status|ringtone|bgm)\b/i;
  var VARIANT_RE = /\b(slowed|reverb|lofi|lo-fi|remix|sped up|8d|bass boosted|cover|nightcore)\b/i;
  function noteTrack(t){
    if (!t) return; var id = t.id;
    recentIds = recentIds.filter(function(x){ return x !== id; }); recentIds.unshift(id); recentIds.length = Math.min(recentIds.length, 60);
    var a = String(t.artistName || '').toLowerCase(); if (a) { artistHist.unshift(a); artistHist.length = Math.min(artistHist.length, 30); }
  }
  function scoreVid(v, cur, wantVariant){
    var title = String(v.title || ''), au = cleanAuthor(v.author).toLowerCase(), ca = String(cur.artistName || '').toLowerCase();
    var len = +v.lengthSeconds || 0, cl = +cur.duration || 0, sc = 0;
    if (au && ca && (au === ca || au.indexOf(ca) >= 0 || ca.indexOf(au) >= 0)) sc += 3;
    var seen = artistHist.filter(function(x){ return x === au; }).length;
    if (artistHist.indexOf(au) >= 0) sc += Math.min(seen, 3) * 0.8;      // artists you keep playing
    if (cl && len) { var d = Math.abs(len - cl); sc += d < 60 ? 1.5 : d < 150 ? 0.7 : 0; }
    if (/\b(official|audio|lyrical|lyrics|video)\b/i.test(title)) sc += 0.8;
    if (/topic/i.test(String(v.author || ''))) sc += 1;
    if (!wantVariant && VARIANT_RE.test(title)) sc -= 3;
    if (+v.viewCount > 1e6) sc += 0.5;
    sc -= Math.random() * 0.6;                                          // small shuffle so radio is not identical every time
    return sc;
  }
  async function refillRelated(force){
    var S = window.BosApp.State, Q = window.BosApp.Queue;
    if (refilling || !isYt(S.currentTrack)) return false;
    var ahead = S.queue.length - (S.queueIndex + 1);
    if (!force && ahead >= 6) return false;
    refilling = true; var cur = S.currentTrack, added = false;
    try {
      noteTrack(cur);
      var vids = [], prev = S.queue[S.queueIndex - 1];
      var jobs = [related(vidOf(cur)).catch(function(){ return []; })];
      if (isYt(prev) && vidOf(prev) !== vidOf(cur)) jobs.push(related(vidOf(prev)).catch(function(){ return []; }));
      var res = await Promise.all(jobs);
      vids = res[0].concat((res[1] || []).slice(0, 8));
      if (vids.length < 8 && cur.artistName) { try { vids = vids.concat(await searchAll((cur.artistName + ' songs').trim())); } catch (e) {} }
      var S2 = window.BosApp.State;
      if (!isYt(S2.currentTrack) || S2.currentTrack.id !== cur.id) return false;   // user moved on: never mix lists
      var have = {}, fams = {}, per = {}, out = [];
      S2.queue.forEach(function(t){ if (t) { have[t.id] = 1; fams[famOf(t.name)] = 1; } });
      recentIds.forEach(function(id){ have[id] = 1; });
      var wantVariant = VARIANT_RE.test(String(cur.name || ''));
      var cands = [], seenV = {};
      vids.forEach(function(v){
        if (!v || !v.videoId || seenV[v.videoId]) return; seenV[v.videoId] = 1;
        var len = +v.lengthSeconds || 0; if (len && (len < 75 || len > 540)) return;
        if (BAD_RE.test(String(v.title || ''))) return;
        cands.push({ v: v, s: scoreVid(v, cur, wantVariant) });
      });
      cands.sort(function(a, b){ return b.s - a.s; });
      for (var k = 0; k < cands.length && out.length < 12; k++) {
        var v = cands[k].v, id = 'yt_' + v.videoId; if (have[id]) continue;
        var f = famOf(v.title); if (fams[f]) continue;
        var au = v.author || ''; per[au] = (per[au] || 0) + 1; if (per[au] > 2) continue;
        have[id] = 1; fams[f] = 1; out.push(mkTrack(v));
      }
      if (out.length) {
        out.forEach(function(t){ t._auto = 1; }); var start = S2.queue.length; S2.queue.push.apply(S2.queue, out);
        if (S2.shuffle) for (var j = start; j < S2.queue.length; j++) S2.shuffleOrder.push(j);
        Q.persist(); try { window.BosApp.renderQueuePanel(); } catch (e) {}
        added = true;
      }
    } finally { refilling = false; }
    return added;
  }
  // Rebuild everything after the current song as a fresh "radio" from it
  async function radio(){
    var App = window.BosApp, S = App.State, Q = App.Queue;
    if (!isYt(S.currentTrack)) return false;
    S.queue.splice(S.queueIndex + 1); if (S.shuffle) { try { Q.buildShuffleOrder(); } catch (e) {} }
    Q.persist(); refilling = false;
    var ok = await refillRelated(true);
    try { App.toast(ok ? 'YouTube radio ready' : 'Could not load suggestions', ok ? 'success' : 'error'); } catch (e) {}
    return ok;
  }

  async function playTrack(track, ctx, idx, opts){
    if (!track) return false;
    var S = window.BosApp.State, Q = window.BosApp.Queue;
    track = normTrack(track);
    var id = vidOf(track); if (!id) return false;
    if (ctx && ctx.length) {
      var list = ctx.filter(isYt).map(normTrack);
      var i = list.findIndex(function(t){ return t.id === track.id; });
      if (i < 0) { list.unshift(track); i = 0; }
      list[i] = track;
      Q.setQueue(list, i);                                    // YouTube song -> YouTube queue
    } else {
      var qi = (S.queue[S.queueIndex] && S.queue[S.queueIndex].id === track.id) ? S.queueIndex
             : S.queue.findIndex(function(t){ return t && t.id === track.id; });
      if (qi >= 0) { S.queueIndex = qi; Q.persist(); } else Q.setQueue([track], 0);
    }
    S.smartRadioActive = false;
    session++; try { window.BosApp.haltJio(); } catch (e) {} pauseApp();
    YTV.begin(track, true);   // light state only, so the stream request goes out first
    YTV.start(id, 0);
    YTV.beginUI(track);       // then the heavy UI / lyrics work
    setTimeout(function(){ refillRelated(false); }, 300);
    return true;
  }

  // Used by the main Search page and by favorites / history / queue (through Player.play)
  /* BOOSTER server first for playlists / artist songs (/list), old servers stay as fallback */
  function bList(kind, id){
    var S = window.BOOSTER_DL_SERVER; if (!S || window.__boosterDown()) return Promise.reject(0);
    var ac = new AbortController(), tm = setTimeout(function(){ ac.abort(); }, 9000);
    return fetch(S + '/list?kind=' + kind + '&id=' + enc(id), { signal: ac.signal })
      .then(function(r){ clearTimeout(tm); if (!r.ok) throw 0; return r.json(); })
      .then(function(l){ if (!Array.isArray(l) || !l.length) throw 0; return l; })
      .catch(function(e){ clearTimeout(tm); window.__boosterMarkDown(); throw e; });
  }
  var collection0 = collection, musicPlaylistSongs0 = musicPlaylistSongs;
  collection = function(kind, id){ return bList(kind === 'channel' ? 'channel' : 'playlist', id).catch(function(){ return collection0(kind, id); }); };
  musicPlaylistSongs = function(id){ return bList('playlist', id).catch(function(){ return musicPlaylistSongs0(id); }); };
  window.BosYT = {
    search: searchAll,
    audioSources: function(id){ var o=[]; if (YTM_ENDPOINT) o.push(function(){ return Promise.resolve(srcUrl('ytm', id)); }); ranked().forEach(function(h){ o.push(function(){ return Promise.resolve(srcUrl(h, id)); }); }); o.push(function(){ return ppResolve(id); }); return o; },
    musicSearch: musicSearch,
    musicPlaylists: musicPlaylists,
    musicPlaylistSongs: musicPlaylistSongs,
    collection: collection,
    playTrack: playTrack,
    play: function(vids, i){
      var list = (vids || []).filter(function(v){ return v && v.videoId; }).map(mkTrack);
      if (!list.length) return false;
      var want = vids[i] && vids[i].videoId, idx = list.findIndex(function(t){ return t.videoId === want; });
      if (idx < 0) idx = 0;
      return playTrack(list[idx], list, idx, { autoTransition: false });
    },
    next: async function(auto){
      var App = window.BosApp, S = App.State, Q = App.Queue; if (!isYt(S.currentTrack)) return false;
      if (auto && S.settings && S.settings.autoplayNext === false) return false;
      if (auto && S.repeat === 'one') { YTV.seek(0); YTV.resume(); return true; }
      var ni = -1;
      if (S.shuffle) { if (!S.shuffleOrder.length) Q.buildShuffleOrder(); ni = S.shuffleOrder.shift(); } else ni = S.queueIndex + 1;
      if (ni == null || ni < 0 || ni >= S.queue.length) {
        if (S.repeat === 'all' && S.queue.length) ni = 0;
        else {
          await refillRelated(true);
          if (!isYt(S.currentTrack)) return false;
          ni = S.shuffle ? S.shuffleOrder.shift() : S.queueIndex + 1;
          if (ni == null || ni < 0 || ni >= S.queue.length) { return false; }
        }
      }
      var t = S.queue[ni]; if (!t) return false;
      S.queueIndex = ni; Q.persist();
      var ok = isYt(t) ? await playTrack(t, null, null, { autoTransition: !!auto }) : await App.Player.play(t, null, null, { autoTransition: !!auto });
      setTimeout(function(){ refillRelated(false); }, 400);
      return ok;
    },
    prev: function(){
      var App = window.BosApp, S = App.State, Q = App.Queue; if (!isYt(S.currentTrack) || !S.queue.length) return;
      if (YTV.on && window.__bosYT.fake.currentTime > 4) { window.__bosYT.fake.currentTime = 0; return; }
      var pi = S.queueIndex - 1;
      if (pi < 0) { if (S.repeat === 'all') pi = S.queue.length - 1; else { window.__bosYT.fake.currentTime = 0; return; } }
      S.queueIndex = pi; Q.persist();
      var t = S.queue[pi];
      if (isYt(t)) playTrack(t, null, null, { autoTransition: false }); else App.Player.play(t, null, null, { autoTransition: false });
    },
    toggle: function(){
      var S = window.BosApp.State;
      if (!YTV.on) { if (isYt(S.currentTrack)) playTrack(S.currentTrack, null, null, {}); return; }
      YTV.playing ? YTV.halt() : YTV.resume();
    },
    radio: radio,
    pause: function(){ if (YTV.on) YTV.halt(); },
    resume: function(){ var S = window.BosApp.State; if (!YTV.on) { if (isYt(S.currentTrack)) playTrack(S.currentTrack, null, null, {}); return; } YTV.resume(); }
  };

  // ---- zero-delay: resolve the stream link while the finger is still going down / while the song is on screen ----
  window.BosYT.warm = function(id){ if (id) { try { window.__bosYT.prep(id); } catch (e) {} } };
  (function(){
    function idOf(el){
      try {
        if (el.classList.contains('yt-res')) { var r = ((window.BosApp.State._ytRes) || [])[+el.dataset.yi]; return r && r.videoId; }
        var d = el.dataset.id || ''; return /^yt_/.test(d) ? d.slice(3) : '';
      } catch (e) { return ''; }
    }
    var SEL = '.yt-res,[data-action="play-song"][data-id^="yt_"]';
    document.addEventListener('pointerdown', function(e){
      var el = e.target && e.target.closest ? e.target.closest(SEL) : null; if (!el) return;
      var wid = idOf(el);
      if (wid) { window.BosYT.warm(wid); return; }
      try { var rr = el.classList.contains('yt-res') ? ((window.BosApp.State._ytRes) || [])[+el.dataset.yi] : null;
        if (rr && rr.it && !rr.videoId && window.BosIT) window.BosIT.ytFor(rr).then(function(v){ if (v && v.videoId) window.BosYT.warm(v.videoId); }); } catch (x) {}
    }, { passive: true, capture: true });
    if (!('IntersectionObserver' in window)) return;
    var q = [], seen = {}, act = 0;
    function pump(){ while (act < 2 && q.length) { var r = q.shift(); act++; Promise.resolve(window.BosIT && window.BosIT.ytFor ? window.BosIT.ytFor(r) : null).catch(function(){}).then(function(){ act--; pump(); }); } }
    var io = new IntersectionObserver(function(es){ es.forEach(function(en){
      if (!en.isIntersecting) return; io.unobserve(en.target);
      var tg = en.target, r = tg.classList && tg.classList.contains('yt-res') ? ((window.BosApp.State._ytRes) || [])[+tg.dataset.yi] : null; if (!r || !r.it || r.videoId) return; var key = (r.artist || '') + '|' + (r.title || ''); if (seen[key]) return; seen[key] = 1; q.push(r); pump();
    }); }, { rootMargin: '150px' });
    function scan(n){ if (!n || n.nodeType !== 1) return; if (n.matches && n.matches(SEL)) io.observe(n); if (n.querySelectorAll) n.querySelectorAll(SEL).forEach(function(x){ io.observe(x); }); }
    function go(){ var host = document.getElementById('view-scroll') || document.body; scan(host); new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(scan); }); }).observe(host, { childList: true, subtree: true }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  })();

  function openYT(){ ov.classList.add('on'); q.focus(); if (window.BosMotion && window.BosMotion.layout) setTimeout(function(){ try { window.BosMotion.layout(false); } catch (e) {} }, 0); }
  $('#yt-open').onclick = openYT;
  ['yt-open-bn', 'yt-open-sb'].forEach(function(id){
    var b = document.getElementById(id); if (!b) return;
    b.addEventListener('click', openYT);
    b.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openYT(); } });
  });
  $('#yt-x').onclick = function(){ ov.classList.remove('on'); };
  $('#yt-go').onclick = function(){ if (q.value.trim()) search(q.value.trim()); };
  q.addEventListener('keydown', function(e){ if (e.key === 'Enter' && q.value.trim()) search(q.value.trim()); });
})();
;
/* ===== bos-auto-meta ===== */
/* AUTO META: MusicBrainz + TheAudioDB + iTunes race for every search result (BOOSTER and BOOSTER +). The first valid answer wins. */
(function(){"use strict";
var KEY="bos_meta_v3",mem={},busy=0,queue=[],tm=0;
try{mem=JSON.parse(localStorage.getItem(KEY)||"{}");}catch(e){}
function save(){try{var k=Object.keys(mem);if(k.length>400)k.slice(0,100).forEach(function(x){delete mem[x];});localStorage.setItem(KEY,JSON.stringify(mem));}catch(e){}}
function words(s){return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(Boolean);}
function sim(a,b){var A=words(a),B=new Set(words(b)),c=0;if(!A.length||!B.size)return 0;A.forEach(function(w){if(B.has(w))c++;});return c/Math.max(A.length,B.size);}
var NOISE=/official|video|audio|lyric|visuali[sz]er|\bhd\b|4k|full\s+song|\bmv\b|remaster|karaoke|from\s|feat|ft\./i;
function clean(s){return String(s||"").replace(/\s*[\(\[][^\)\]]*[\)\]]/g,function(m){return NOISE.test(m)?"":m;}).split(/\s*\|\s*/)[0].replace(/\s*-\s*topic$/i,"").replace(/\s+/g," ").trim();}
function guess(title,artist,yt){
  var t=clean(title),a=String(artist||"").split(/,|&/)[0].replace(/\s*-\s*Topic$/i,"").replace(/VEVO$/i,"").trim(),m=t.split(/\s+[-–—:]\s+/);
  if(yt&&m.length>=2)return{title:m.slice(1).join(" - "),artist:m[0],alt:m[0]};
  return{title:t,artist:a,alt:""};
}
function get(url){var c=new AbortController(),t=setTimeout(function(){c.abort();},7000);
  return fetch(url,{signal:c.signal}).then(function(r){clearTimeout(t);if(!r.ok)throw 0;return r.json();});}
/* providers: each resolves {title,artist,album,year,art,src} or rejects */
var P={
  MusicBrainz:function(q){
    return get("https://musicbrainz.org/ws/2/recording?fmt=json&limit=3&query="+encodeURIComponent('recording:"'+q.title+'" AND artist:"'+q.artist+'"')).then(function(d){
      var r=(d.recordings||[])[0];if(!r)throw 0;var rel=(r.releases||[])[0]||{};
      return{title:r.title,artist:((r["artist-credit"]||[])[0]||{}).name||"",album:rel.title||"",year:(rel.date||r["first-release-date"]||"").slice(0,4),art:rel.id?"https://coverartarchive.org/release/"+rel.id+"/front-250":"",src:"MusicBrainz"};});
  },
  TheAudioDB:function(q){
    return get("https://www.theaudiodb.com/api/v1/json/2/searchtrack.php?s="+encodeURIComponent(q.artist)+"&t="+encodeURIComponent(q.title)).then(function(d){
      var r=d&&d.track&&d.track[0];if(!r)throw 0;
      return{title:r.strTrack,artist:r.strArtist,album:r.strAlbum||"",year:r.intYearReleased||"",art:r.strTrackThumb||"",src:"TheAudioDB"};});
  },
  iTunes:function(q){
    return (window.BosIT&&window.BosIT.get||get)("https://itunes.apple.com/search?media=music&entity=song&country=IN&limit=3&term="+encodeURIComponent(q.artist+" "+q.title)).then(function(d){
      var r=(d.results||[])[0];if(!r)throw 0;
      return{title:r.trackName,artist:r.artistName,album:r.collectionName||"",year:(r.releaseDate||"").slice(0,4),art:(r.artworkUrl100||"").replace("100x100","300x300"),src:"iTunes"};});
  }
};
function ok(m,q){return m&&m.title&&Math.max(sim(m.title,q.title),q.alt?sim(m.title,q.alt):0)>=.6&&(!q.artist||sim(m.artist,q.artist)>0||sim(m.artist,q.alt)>0||sim(m.title+" "+m.artist,q.title+" "+q.artist)>=.5);}
function race(q){
  return new Promise(function(res,rej){var left=3;
    Object.keys(P).forEach(function(n){
      var p;try{p=P[n](q);}catch(e){p=Promise.reject();}
      p.then(function(m){if(ok(m,q))res(m);else if(!--left)rej();},function(){if(!--left)rej();});
    });});
}
function paint(row,m,yt){
  var card=row.classList.contains("card");
  var t=yt?row.querySelector("b"):row.querySelector(card?".card-title":".row-title"),s=yt?row.querySelector("small"):row.querySelector(card?".card-sub":".row-sub"),im=row.querySelector("img");
  if(t&&m.title)t.textContent=m.title;
  if(s)s.innerHTML=card?esc(m.artist):esc(m.artist)+(m.album?" · "+esc(m.album):"")+(m.year?" · "+esc(m.year):"")+' <span style="opacity:.45;font-size:.8em">· '+esc(m.src)+'</span>';
  if(im&&m.art&&im.dataset.mArt!==m.art){var x=new Image();x.onload=function(){im.src=m.art;im.dataset.mArt=m.art;};x.src=m.art;}
  row.dataset.bosMeta="1";
}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function info(row){
  var yt=row.classList.contains("yt-res"),t,a;
  if(yt){t=(row.querySelector("b")||{}).textContent;a=(row.querySelector("small")||{}).textContent;}
  else{var c=row.classList.contains("card");t=(row.querySelector(c?".card-title":".row-title")||{}).textContent;a=(row.querySelector(c?".card-sub":".row-sub")||{}).textContent;}
  return{yt:yt,t:t||"",a:a||""};
}
function pump(){
  while(busy<4&&queue.length){(function(job){busy++;
    (job.y?P.iTunes(job.q).then(function(m){if(ok(m,job.q))return m;throw 0;}):race(job.q)).then(function(m){mem[job.k]=m;save();if(document.body.contains(job.row))paint(job.row,m,job.yt);},function(){mem[job.k]={none:1,ts:Date.now()};}).then(function(){busy--;pump();});})(queue.shift());}
}
function scan(){
  var rows=document.querySelectorAll('#search-results .yt-res, #search-results .row-item[data-action="play-song"], #view-home .row-item[data-action="play-song"], #view-home .card[data-action="play-song"]'),n=0;
  rows.forEach(function(row){
    if(row.dataset.bosMeta||++n>20)return;
    var i=info(row);if(!i.t)return;var y=i.yt||/^yt_/.test(row.dataset.id||""),q=guess(i.t,i.a,y),k=(y?"y|":"j|")+i.t+"|"+i.a,c=mem[k];
    if(c&&c.none){if(Date.now()-(c.ts||0)<864e5)return;}
    else if(c){paint(row,c,i.yt);return;}
    row.dataset.bosMeta="0";
    if(q.title&&!queue.some(function(j){return j.row===row;}))queue.push({row:row,q:q,k:k,yt:i.yt,y:y});
  });
  pump();
}
new MutationObserver(function(){if(tm)return;tm=setTimeout(function(){tm=0;scan();},400);}).observe(document.body,{childList:true,subtree:true});
})();
;
/* ===== bos-yt-itunes ===== */
/* BOOSTER + x iTunes: title, artist, artwork and song search for YouTube songs come from the iTunes Search API. */
(function(){"use strict";
var KEY="bos_it_v2",mem={},chain=Promise.resolve(),tried=new WeakSet(),dt=0;
try{mem=JSON.parse(localStorage.getItem(KEY)||"{}");}catch(e){}
function save(){try{var k=Object.keys(mem);if(k.length>500)k.slice(0,150).forEach(function(x){delete mem[x];});localStorage.setItem(KEY,JSON.stringify(mem));}catch(e){}}
function words(s){return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(Boolean);}
function sim(a,b){var A=words(a),B=new Set(words(b)),c=0;if(!A.length||!B.size)return 0;A.forEach(function(w){if(B.has(w))c++;});return c/Math.max(A.length,B.size);}
function cov(a,b){var A=words(a),B=new Set(words(b)),c=0;if(!A.length)return 0;A.forEach(function(w){if(B.has(w))c++;});return c/A.length;}
var NOISE=/official|video|audio|lyric|visuali[sz]er|\bhd\b|4k|full\s+song|\bmv\b|remaster|karaoke|from\s|feat|ft\./i;
function clean(s){return String(s||"").replace(/\s*[\(\[][^\)\]]*[\)\]]/g,function(m){return NOISE.test(m)?"":m;}).split(/\s*\|\s*/)[0].replace(/\s*-\s*topic$/i,"").replace(/\s+/g," ").trim();}
function guess(title,author){
  var t=clean(title),a=String(author||"").replace(/\s*-\s*Topic$/i,"").replace(/VEVO$/i,"").split(/,|&/)[0].trim(),m=t.split(/\s+[-\u2013\u2014:]\s+/);
  if(m.length>=2)return{title:m.slice(1).join(" - "),artist:m[0],alt:m[0]};
  return{title:t,artist:a,alt:""};
}
/* fetch first; if the browser blocks it (CORS on file:// or a local copy), fall back to JSONP, which iTunes supports and CORS never blocks */
function jsonp(url){
  return new Promise(function(res,rej){
    var cb="__bosIt"+Math.random().toString(36).slice(2),s=document.createElement("script"),t=setTimeout(function(){done(0);},4000);
    function done(ok,d){clearTimeout(t);try{delete window[cb];}catch(e){window[cb]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);ok?res(d):rej(0);}
    window[cb]=function(d){done(1,d);};s.onerror=function(){done(0);};
    s.src=url+(url.indexOf("?")<0?"?":"&")+"callback="+cb;document.head.appendChild(s);
  });
}
function getJ(url){
  var c=new AbortController(),t=setTimeout(function(){c.abort();},3500);
  return fetch(url,{signal:c.signal}).then(function(r){clearTimeout(t);if(!r.ok)throw 0;return r.json();}).catch(function(){clearTimeout(t);return jsonp(url);});
}
function itGet(term,limit){
  return getJ("https://itunes.apple.com/search?media=music&entity=song&country=IN&limit="+(limit||5)+"&term="+encodeURIComponent(term)).then(function(d){return(d.results||[]).filter(function(r){return r.trackName;});});
}
function norm(r){return{title:r.trackName,artist:r.artistName,album:r.collectionName||"",year:(r.releaseDate||"").slice(0,4),art:(r.artworkUrl100||"").replace(/\d+x\d+bb/,"300x300bb"),dur:Math.round((r.trackTimeMillis||0)/1000),src:"iTunes"};}
/* YouTube title + channel -> best iTunes match (cached) */
function pick(rs,q,dur,full){
  var best=null,bs=0;
  rs.forEach(function(r){
    var m=norm(r),ts=Math.max(sim(m.title,q.title),q.alt?sim(m.title,q.alt):0),
        am=sim(m.artist,q.artist)>0||(q.alt&&sim(m.artist,q.alt)>0)||cov(m.artist,full)>0,dm=dur&&m.dur&&Math.abs(m.dur-dur)<=12;
    if(ts<.6&&words(m.title).length>=2&&cov(m.title,full)>=1&&(am||dm))ts=.7;   /* iTunes title sits fully inside a long YouTube title */
    if(ts<.6||(words(q.title).length<=2&&!am))return;
    var s=ts+(am?.3:0)+(dm?.2:0);if(s>bs){bs=s;best=m;}
  });
  return best;
}
/* YouTube title + channel -> best iTunes match (cached). Tries "artist title" first, then the title alone (channel names like "YRF" are not artists). */
function resolve(title,author,dur){
  var k=title+"|"+author,c=mem[k];
  if(c&&(!c.none||Date.now()-(c.ts||0)<864e5))return Promise.resolve(c.none?null:c);
  var q=guess(title,author),full=title+" "+author;if(!q.title)return Promise.resolve(null);
  return itGet((q.artist+" "+q.title).trim(),8).then(function(rs){
    return pick(rs,q,dur,full)||itGet(q.title,10).then(function(r2){return pick(r2,q,dur,full);});
  }).then(function(best){mem[k]=best||{none:1,ts:Date.now()};save();return best;}).catch(function(){return null;});
}
/* iTunes song search for the BOOSTER + search page */
function search(q,n){
  return itGet(q,n||25).then(function(rs){var seen={};
    return rs.map(function(r){var m=norm(r);return{it:1,videoId:"",title:m.title,artist:m.artist,album:m.album,year:m.year,art:m.art,dur:m.dur,author:m.artist+(m.album?" \u00b7 "+m.album:"")};})
      .filter(function(x){var k=(x.title+"|"+x.artist).toLowerCase();if(seen[k])return false;seen[k]=1;return true;});
  }).catch(function(){return[];});
}
/* iTunes song -> the right YouTube video to play */
var BAD=/slowed|reverb|lofi|lo-fi|remix|sped up|8d|bass boosted|cover|nightcore|karaoke|reaction|\blive\b|mashup|status|ringtone|shorts?|jukebox|instrumental/i;
function ytFor0(it){
  var Y=window.BosYT;if(!Y)return Promise.resolve(null);
  return Y.search((it.artist+" "+it.title+" audio").trim(),"video").then(function(vs){
    var best=null,bs=-99;
    (vs||[]).forEach(function(v){if(!v||!v.videoId)return;
      var len=+v.lengthSeconds||0,d=Math.abs(len-it.dur),s=cov(it.title,v.title)*2+(it.dur&&len?(d<=8?1.5:d<=25?.5:0):0)+(/topic/i.test(v.author||"")?1:0)+(cov(it.artist,(v.author||"")+" "+v.title)>0?.7:0)-(BAD.test(v.title)&&!BAD.test(it.title)?3:0)-(len>600?2:0);
      if(s>bs){bs=s;best=v;}});
    return best;
  }).catch(function(){return null;});
}
var ytMemo={};
function ytFor(it){
  var k=(it.artist+"|"+it.title).toLowerCase(),h=ytMemo[k];
  if(h&&Date.now()-h.t<18e5)return h.p;
  var Y=window.BosYT;
  function loose(q){return Y.search(q,"video").then(function(vs){var best=null,bs=0;(vs||[]).forEach(function(v){if(!v||!v.videoId)return;var s=cov(it.title,v.title)+(cov(it.artist,(v.author||"")+" "+v.title)>0?.3:0)-(BAD.test(v.title)&&!BAD.test(it.title)?1:0)-((+v.lengthSeconds||0)>720?1:0);if(s>bs){bs=s;best=v;}});return bs>=.5?best:null;}).catch(function(){return null;});}
  /* parallel, staggered: best strategy starts now, fallbacks join after short delays; first non-null wins */
  function later2(ms,fn){return new Promise(function(ok){setTimeout(function(){fn().then(ok,function(){ok(null);});},ms);});}
  var p=new Promise(function(res){
    var pend=0,done=false;
    function add(pr){pend++;pr.then(function(v){pend--;if(done)return;if(v){done=true;res(v);}else if(!pend)res(null);},function(){pend--;if(!done&&!pend)res(null);});}
    add(ytFor0(it));
    add(later2(900,function(){return loose((it.title+" "+it.artist).trim());}));
    add(later2(1500,function(){return Y.musicSearch&&Date.now()>=(window.__pdUntil||0)?Y.musicSearch((it.artist+" "+it.title).trim()).then(function(vs){return(vs||[]).filter(function(x){return x&&x.videoId;})[0]||null;}):Promise.resolve(null);}));
  });
  ytMemo[k]={t:Date.now(),p:p};p.then(function(v){if(!v)delete ytMemo[k];},function(){delete ytMemo[k];});
  return p;
}
function app(){return window.BosApp||{};}
function apply(t,m){
  if(!t||t._it||!m)return;
  t.ytName=t.ytName||t.name;t.ytArtist=t.ytArtist||t.artistName;
  t.name=m.title;t.artistName=m.artist;t.albumName=m.album||t.albumName||"";if(m.art)t.image=m.art.replace("300x300bb","600x600bb");t._it=1;
}
function refresh(t){var A=app();try{A.renderMiniPlayer();A.renderFullPlayer();A.SystemMedia&&A.SystemMedia.update(t);A.updateAmbient&&A.updateAmbient(t);A.History&&A.History.add(t);A.Store&&A.Store.set("lastSong",t);}catch(e){}}
function later(){clearTimeout(dt);dt=setTimeout(function(){var A=app();try{A.Queue&&A.Queue.persist();A.renderQueuePanel&&A.renderQueuePanel();}catch(e){}},600);}
/* every YouTube song that becomes the current one (search, home, favorites, queue, autoplay) gets iTunes info; the next few queue songs are prepared in the background */
var fixN=new WeakMap();
function tick(){
  var A=app(),S=A.State;if(!S)return;var t=S.currentTrack;
  if(t&&t.source==="youtube"&&!t._it&&!tried.has(t)){tried.add(t);
    resolve(t.name,t.artistName,t.duration).then(function(m){if(!m)return;apply(t,m);if(S.currentTrack===t)refresh(t);later();});}
  /* guard: if anything repainted the old YouTube title/art, paint the iTunes info again */
  if(t&&t._it){var mt=document.getElementById("mini-title"),ft=document.getElementById("fp-title"),n=fixN.get(t)||0;
    if(n<6&&((mt&&mt.textContent!==t.name)||(ft&&ft.textContent!==t.name))){fixN.set(t,n+1);try{A.renderMiniPlayer();A.renderFullPlayer();}catch(e){}}}
  (S.queue||[]).slice(S.queueIndex+1,S.queueIndex+6).forEach(function(u){
    if(u&&u.source==="youtube"&&!u._it&&!tried.has(u)){tried.add(u);
      chain=chain.then(function(){return resolve(u.name,u.artistName,u.duration).then(function(m){if(m){apply(u,m);later();}});}).then(function(){return new Promise(function(r){setTimeout(r,350);});});}
  });
}
setInterval(tick,900);
/* tapping an iTunes search result: find the YouTube video, play it, keep the iTunes info */
var batchTok=0;
function queueRest(vids,i,tok){
  var rest=(vids||[]).slice(i+1).filter(function(x){return x&&x.it&&!x.videoId;});
  if(!rest.length)return;
  var A=app(),S=A.State,Q=A.Queue,last=S&&S.currentTrack;if(!last)return;
  (function step(n){
    if(tok!==batchTok||n>=rest.length)return;
    var cur=S.currentTrack;if(!cur||cur._batch!==tok)return;            /* user played something else: stop queueing */
    var v=rest[n];if(rest[n+1])ytFor(rest[n+1]);
    ytFor(v).then(function(vid){
      if(tok!==batchTok)return;
      if(vid){
        var t={id:"yt_"+vid.videoId,videoId:vid.videoId,name:v.title,artistName:v.artist,albumName:v.album||"",
          image:(v.art||"").replace("300x300bb","600x600bb")||"https://i.ytimg.com/vi/"+vid.videoId+"/hqdefault.jpg",
          duration:v.dur||+vid.lengthSeconds||0,source:"youtube",_it:1,_batch:tok,ytName:vid.title,ytArtist:vid.author};
        var at=S.queue.indexOf(last);if(at<0)return;
        S.queue.splice(at+1,0,t);last=t;                                /* always right after the previous album song, before any radio songs */
        try{if(S.shuffle&&Q.buildShuffleOrder)Q.buildShuffleOrder();Q.persist();}catch(e){}
        later();
      }
      setTimeout(function(){step(n+1);},100);
    });
  })(0);
}
function hook(){
  var Y=window.BosYT;if(!Y)return false;if(Y._it)return true;Y._it=1;var p0=Y.play;
  Y.play=function(vids,i){
    var v=vids&&vids[i||0];
    if(v&&v.it&&!v.videoId){
      var A=app();try{A.toast("Loading\u2026");}catch(e){}
      ytFor(v).then(function(vid){
        if(!vid){try{A.toast("Could not find this song","error");}catch(e){}return;}
        p0.call(Y,[vid],0);var t=A.State&&A.State.currentTrack;var tok=++batchTok;if(t&&t.videoId===vid.videoId)t._batch=tok;queueRest(vids,i||0,tok);
        if(t&&t.videoId===vid.videoId){apply(t,v);refresh(t);later();}
      });
      return true;
    }
    return p0.apply(this,arguments);
  };
  return true;
}
if(!hook())setTimeout(hook,1500);
function itTrack(r){var m=norm(r);return{it:1,videoId:"",title:m.title,artist:m.artist,album:m.album,year:m.year,art:m.art,dur:m.dur,author:m.artist+(m.album?" \u00b7 "+m.album:"")};}
var IT="https://itunes.apple.com/";
function itAlbums(q,n){return getJ(IT+"search?media=music&entity=album&country=IN&limit="+(n||24)+"&term="+encodeURIComponent(q)).then(function(d){var seen={};return(d.results||[]).filter(function(r){if(!r.collectionId||!r.collectionName||seen[r.collectionId])return false;seen[r.collectionId]=1;return true;}).map(function(r){return{id:String(r.collectionId),title:r.collectionName,artist:r.artistName||"",count:r.trackCount||0,img:(r.artworkUrl100||"").replace(/\d+x\d+bb/,"400x400bb")};});}).catch(function(){return[];});}
function itArtists(q,n){return getJ(IT+"search?media=music&entity=song&attribute=artistTerm&country=IN&limit=60&term="+encodeURIComponent(q)).then(function(d){var seen={},out=[];(d.results||[]).forEach(function(r){if(!r.artistId||!r.artistName||seen[r.artistId])return;seen[r.artistId]=1;out.push({id:String(r.artistId),title:r.artistName,img:(r.artworkUrl100||"").replace(/\d+x\d+bb/,"400x400bb")});});return out.slice(0,n||24);}).then(function(l){if(l.length)return l;return getJ(IT+"search?media=music&entity=musicArtist&country=IN&limit="+(n||24)+"&term="+encodeURIComponent(q)).then(function(d){return(d.results||[]).filter(function(r){return r.artistId&&r.artistName;}).map(function(r){return{id:String(r.artistId),title:r.artistName,img:""};});});}).catch(function(){return[];});}
function itAlbumTracks(id){return getJ(IT+"lookup?id="+encodeURIComponent(id)+"&entity=song&country=IN&limit=200").then(function(d){return(d.results||[]).filter(function(r){return r.wrapperType==="track"&&r.trackName;}).map(itTrack);}).catch(function(){return[];});}
function itArtistSongs(id){return getJ(IT+"lookup?id="+encodeURIComponent(id)+"&entity=song&country=IN&limit=50").then(function(d){return(d.results||[]).filter(function(r){return r.wrapperType==="track"&&r.trackName;}).map(itTrack);}).catch(function(){return[];});}
window.BosIT={ytFor:function(x){return ytFor(x);},search:search,resolve:resolve,get:getJ,albums:itAlbums,artists:itArtists,albumTracks:itAlbumTracks,artistSongs:itArtistSongs};
})();
;
/* ===== bos-queue-pro ===== */
/* QUEUE PRO: user queue first, then taste-ranked Autoplay. Uses the Music Personalization profile for ranking. */
(function(){"use strict";
var A=window.BosApp;if(!A||!A.Queue||!A.State){return;}
var S=A.State,Q=A.Queue,seen=new Set(),guard=false,lastH="",obs=null;
function norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9\u0900-\u097f\s]/g,"").trim();}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function taste(){try{return JSON.parse(localStorage.getItem("boosterTaste"))||{};}catch(e){return{};}}
function prefs(){try{return JSON.parse(localStorage.getItem("boosterPreferences")||"null")||{};}catch(e){return{};}}
function artistOf(t){return norm(String(t&&t.artistName||"").split(",")[0]);}
function parts(t){
  var T=taste(),P=prefs(),a=artistOf(t),l=norm(t&&t.language),d=T.disc==null?.35:T.disc,ae=(T.a||{})[a],aw=ae?Math.max(0,ae.w):0,
      lw=Math.max(0,(T.l||{})[l]||0),tr=(T.t||{})[t&&t.id]||{},pa=(P.artists||[]).some(function(x){return norm(x)===a;}),pl=(P.languages||[]).some(function(x){return norm(x)===l;});
  if(pa)aw+=10;if(pl)lw+=8;
  var known=aw>0,sc=Math.min(40,aw*2.2)+Math.min(20,lw*1.2)+(tr.l||0)*15+(tr.c||0)*6+(tr.p||0)*2-(tr.s||0)*14;
  var fin=sc*(1-d)+(known?0:18*d)+Math.random()*4;
  return{score:fin,top:aw>=10,lang:lw>=8,fresh:!known,liked:!!tr.l};
}
var NZ=/^(official|lyrical?|lyrics?|video|audio|full|song|songs|hd|4k|music|visuali[sz]er|mv)(\s|$)/i;
function disp(t){
  if(!t||t.source!=="youtube")return{n:t&&t.name,a:t&&t.artistName};
  try{var m=(JSON.parse(localStorage.getItem("bos_meta_v3")||"{}"))["y|"+t.name+"|"+(t.artistName||"")];if(m&&m.title)return{n:m.title,a:m.artist||t.artistName};}catch(e){}
  var s=String(t.name||"").replace(/\s*[\(\[][^\)\]]*[\)\]]/g,"").split(/\s*\|\s*/)[0].split(/\s+[-\u2013\u2014]\s+/).filter(function(x){return x&&!NZ.test(x.trim());}).slice(0,2).join(" \u2013 ").trim();
  return{n:s||t.name,a:String(t.artistName||"").replace(/\s*-\s*Topic$/i,"")};
}
function reason(t){var p=parts(t);return p.liked?"You liked this":p.top?"Your top artist":p.lang?"Matches your language":p.fresh?"Fresh for you":"Similar vibe";}
/* mark + rank the autoplay tail whenever Smart Radio adds songs */
var persist=Q.persist;
Q.persist=function(){
  try{
    var ids=S.queue.map(function(t){return t&&t.id;}),added=[];
    S.queue.forEach(function(t,i){if(t&&!seen.has(t.id)){seen.add(t.id);if(i>S.queueIndex&&(t._auto||S.smartQueueBusy)){t._auto=1;added.push(i);}}});
    if(S.settings&&S.settings.autoplayNext===false&&S.queue.some(function(t){return t&&t._auto&&true;})){
      var keep=S.queue.filter(function(t,i){return i<=S.queueIndex||!t._auto;});if(keep.length!==S.queue.length){S.queue=keep;S.shuffleOrder=[];}
    }else if(added.length&&!S.shuffle){
      var cut=S.queue.length;while(cut>S.queueIndex+1&&S.queue[cut-1]&&S.queue[cut-1]._auto)cut--;
      var tail=S.queue.slice(cut).map(function(t){return{t:t,s:parts(t).score};}).sort(function(x,y){return y.s-x.s;}),out=[],last="";
      while(tail.length){var k=tail.findIndex(function(x){return artistOf(x.t)!==last;});if(k<0)k=0;var x=tail.splice(k,1)[0];out.push(x.t);last=artistOf(x.t);}
      S.queue=S.queue.slice(0,cut).concat(out);
    }
  }catch(e){}
  return persist.apply(this,arguments);
};
/* "Add to queue" goes BEFORE the autoplay songs; "Play next" goes right after the current song */
function insertUser(track,next){
  var pos=S.queue.length;
  if(next)pos=S.queueIndex+1;else while(pos>S.queueIndex+1&&S.queue[pos-1]&&S.queue[pos-1]._auto)pos--;
  S.queue.splice(pos,0,track);Q.persist();
}
var add=Q.addToQueue;
Q.addToQueue=function(t){if(S.shuffle||!t||S.queueIndex<0)return add.apply(this,arguments);t=Object.assign({},t);delete t._auto;insertUser(t,false);try{A.toast("Added to queue");}catch(e){}};
Q.playNext=function(t){t=Object.assign({},t);delete t._auto;insertUser(t,true);try{A.toast("Playing next");}catch(e){}};
/* panel */
function row(t,i,on,tag){
  var d=disp(t);
  return '<div class="row-item'+(on?" playing":"")+'" data-action="play-queue-index" data-index="'+i+'"><div class="row-art"><img src="'+esc(t.image)+'" loading="lazy" alt=""></div><div class="row-meta"><div class="row-title">'+esc(d.n)+'</div><div class="row-sub">'+esc(d.a)+'</div>'+(tag?'<span class="q-tag">'+esc(tag)+'</span>':'')+'</div>'
   +(on?'<div class="eq-bars"><span></span><span></span><span></span></div>':'<button class="ctrl-btn" data-action="remove-queue-index" data-index="'+i+'" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>')+'</div>';
}
function render(){
  var box=document.getElementById("queue-list");if(!box||!S.queue.length||guard)return;
  var cur=S.queue[S.queueIndex],up=[],au=[];
  S.queue.forEach(function(t,i){if(i<=S.queueIndex||!t)return;(t._auto?au:up).push({t:t,i:i});});
  var on=!(S.settings&&S.settings.autoplayNext===false),h='';
  h+='<div class="q-top"><div><b>Autoplay</b><small>'+(on?"Keeps music going with songs you'll like":"Off · stops when the queue ends")+'</small></div><button class="q-b" data-q="radio" style="margin-left:auto">New radio</button><button class="q-sw'+(on?" on":"")+'" style="margin-left:10px" data-q="sw" aria-label="Autoplay"></button></div>';
  if(cur)h+='<div class="q-h"><span>Now playing</span></div><div class="row-list">'+row(cur,S.queueIndex,true)+'</div>';
  if(up.length)h+='<div class="q-h"><span>Next in queue</span><i>'+up.length+'</i><button class="q-b" data-q="clearup">Clear</button></div><div class="row-list">'+up.map(function(x){return row(x.t,x.i,false);}).join("")+'</div>';
  if(on&&au.length)h+='<div class="q-h"><span>Autoplay</span><i>'+au.length+' · based on '+esc(cur?cur.name:"")+'</i><button class="q-b" data-q="refresh">Refresh</button></div><div class="row-list">'+au.map(function(x){return row(x.t,x.i,false,reason(x.t));}).join("")+'</div>';
  else if(on)h+='<div class="q-note">Autoplay is finding songs for you…</div>';
  if(h===lastH)return;lastH=h;
  guard=true;box.innerHTML=h;guard=false;
  if(obs)obs.takeRecords();   /* drop our own mutation so it can never re-trigger render (was an endless loop) */
}
function save(){try{A.Store.set("settings",S.settings);}catch(e){}}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("#queue-list [data-q]");if(!b)return;e.stopPropagation();var k=b.dataset.q;
  if(k==="sw"){S.settings.autoplayNext=S.settings.autoplayNext===false;save();if(S.settings.autoplayNext&&A.SmartRadio)A.SmartRadio.refill(8);else Q.persist();render();}
  if(k==="clearup"){S.queue=S.queue.filter(function(t,i){return i<=S.queueIndex||t._auto;});S.shuffleOrder=[];Q.persist();render();}
  if(k==="radio"){if(!S.currentTrack)return;S.queue.splice(S.queueIndex+1);S.shuffleOrder=[];Q.persist();
    if(S.currentTrack.source==="youtube"&&window.BosYT&&window.BosYT.radio)window.BosYT.radio().then(render);
    else if(A.SmartRadio){S.smartRadioRefillToken++;S.smartQueueBusy=false;try{A.toast("Building radio…");}catch(x){}A.SmartRadio.refill(24).then(render);}render();}
  if(k==="refresh"){S.queue=S.queue.filter(function(t,i){return i<=S.queueIndex||!t._auto;});S.shuffleOrder=[];Q.persist();render();if(S.currentTrack&&S.currentTrack.source==="youtube"&&window.BosYT&&window.BosYT.radio){var kp=S.queue.slice();window.BosYT.radio().then(function(){S.queue=kp.filter(function(t,i){return i<=S.queueIndex||!t._auto;}).concat(S.queue.slice(S.queueIndex+1).filter(function(t){return t._auto;}));render();});}else if(A.SmartRadio)A.SmartRadio.refill(8);}
},true);
var box=document.getElementById("queue-list");
if(box){var pend=0;obs=new MutationObserver(function(){if(guard||pend)return;pend=setTimeout(function(){pend=0;render();},60);});obs.observe(box,{childList:true});}
S.queue.forEach(function(t){if(t)seen.add(t.id);});
var qp=document.getElementById('queue-panel');if(qp)new MutationObserver(function(){setTimeout(render,80);}).observe(qp,{attributes:true,attributeFilter:['class']});
})();
;
/* ===== bos-redesign-js ===== */
document.addEventListener('pointermove',function(e){var t=e.target.closest&&e.target.closest('.row-item,.card');if(!t)return;var r=(t.querySelector('.card-art')||t).getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px');if(t.classList.contains('card')){var a=t.querySelector('.card-art');a&&(a.style.setProperty('--mx',(e.clientX-r.left)+'px'),a.style.setProperty('--my',(e.clientY-r.top)+'px'));}},{passive:true});
;
/* ===== bos-ios27-edge-js ===== */
(function(){
  var main=document.getElementById('main'),tb=document.getElementById('topbar'),vs=document.getElementById('view-scroll');
  if(!main||!tb||!vs) return;
  function size(){ main.style.setProperty('--bos-tb-h',tb.offsetHeight+'px'); }
  size();
  if(window.ResizeObserver) new ResizeObserver(size).observe(tb);
  window.addEventListener('resize',size,{passive:true});
  window.addEventListener('load',size,{once:true});
  var raf=0;
  function upd(){ raf=0; var e=Math.max(0,Math.min(1,vs.scrollTop/64)); tb.style.setProperty('--bos-edge',e.toFixed(3)); }
  vs.addEventListener('scroll',function(){ if(!raf) raf=requestAnimationFrame(upd); },{passive:true});
  upd();
})();
;
/* ===== bos-optimize-js ===== */
(function(){var d=document,t=0,q=[];
function fixImg(i){if(!i.hasAttribute('decoding'))i.decoding='async';if(!i.hasAttribute('loading')&&i.id!=='fp-art')i.loading='lazy';if(!i.hasAttribute('alt'))i.alt='';}
function fixBtn(b){if(b.hasAttribute('aria-label')||b.textContent.trim())return;var l=b.getAttribute('title')||b.getAttribute('data-action')||b.id;if(l)b.setAttribute('aria-label',l.replace(/[-_]/g,' '));}
function fixIn(n){if(!n||n.nodeType!==1)return;
 if(n.tagName==='IMG')fixImg(n);else if(n.tagName==='BUTTON')fixBtn(n);
 if(n.querySelectorAll){n.querySelectorAll('img').forEach(fixImg);n.querySelectorAll('button:not([aria-label])').forEach(fixBtn);}}
function flush(){t=0;var l=q;q=[];for(var i=0;i<l.length;i++){if(l[i].isConnected)fixIn(l[i]);}}
fixIn(d.body);
if(window.MutationObserver)new MutationObserver(function(m){for(var i=0;i<m.length;i++){var a=m[i].addedNodes;for(var j=0;j<a.length;j++)q.push(a[j]);}if(!t)t=setTimeout(flush,300);}).observe(d.body,{childList:true,subtree:true});
d.addEventListener('visibilitychange',function(){d.body.classList.toggle('bos-hidden',d.hidden);});
})();
;
/* ===== bos-v31-premium-js ===== */
(function(){'use strict';
/* artwork fade-in: list/card images only, first load only, class added in a frame (no forced reflow) */
document.addEventListener('load',function(e){var t=e.target;
  if(!t||t.tagName!=='IMG'||t.dataset.bosShown||!t.closest||!t.closest('.card-art,.row-art,.detail-art'))return;
  t.dataset.bosShown='1';requestAnimationFrame(function(){t.classList.add('bos-art-in');});
},true);
})();
;
/* ===== bos-v32-yt-meta ===== */
(function(){'use strict';
var busy=false;
function wait(fn,ms,t0){t0=t0||Date.now();var r=fn();if(r)return Promise.resolve(r);if(Date.now()-t0>ms)return Promise.resolve(null);return new Promise(function(ok){setTimeout(function(){ok(wait(fn,ms,t0));},60);});}
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('[data-action="open-current-artist"],[data-action="open-current-album"]');if(!a)return;
  var A=window.BosApp,S=A&&A.State,t=S&&S.currentTrack;
  if(!t||t.source!=='youtube'||!window.BosIT||!window.__bosOpenYtColl)return;      /* normal songs keep the original behaviour */
  e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;
  var isAlb=a.getAttribute('data-action')==='open-current-album',name=isAlb?t.albumName:t.artistName;
  if(!name){busy=false;return;}
  var q=isAlb?(name+' '+(t.artistName||'')).trim():name;
  (isAlb?BosIT.albums(q,1):BosIT.artists(q,1)).then(function(l){
    var x=l&&l[0];if(!x){try{A.toast('Not found','error');}catch(_){}busy=false;return;}
    var fp=document.getElementById('full-player');if(fp&&fp.classList.contains('open')){var cb=document.getElementById('fp-close');if(cb)cb.click();}
    S.searchTab='youtube';S.searchQuery=name;S.ytTab=isAlb?'albums':'artists';
    var nb=document.querySelector('[data-nav="search"]');if(nb)nb.click();
    return wait(function(){return document.getElementById('search-results');},1500).then(function(){
      window.__bosOpenYtColl({kind:isAlb?'itAlbum':'itArtist',id:x.id,title:x.title,sub:isAlb?((x.artist||'Album')+(x.count?' \u2022 '+x.count+' songs':'')):'Artist',img:x.img});
    });
  }).catch(function(){}).then(function(){busy=false;});
},true);
})();
;
/* ===== bos-v33-fast-meta ===== */
(function(){'use strict';
var I=window.BosIT;if(!I)return;
['search','albums','artists','albumTracks','artistSongs'].forEach(function(name){
  var f=I[name],M=new Map();if(typeof f!=='function')return;
  I[name]=function(){
    var k=name+'|'+Array.prototype.join.call(arguments,'|'),h=M.get(k);
    if(h&&Date.now()-h.t<3e5)return h.p;
    var p=f.apply(this,arguments);M.set(k,{t:Date.now(),p:p});
    p.then(function(r){if(!r||!r.length)M.delete(k);else if(name==='albumTracks'||name==='artistSongs'){r.slice(0,2).forEach(function(t){try{I.ytFor(t);}catch(e){}});}},function(){M.delete(k);});
    return p;};
});
/* finger down on an album / artist card: start loading its songs before the click even fires */
var res=document.addEventListener('pointerdown',function(e){
  var c=e.target.closest&&e.target.closest('.yt-card');if(!c)return;
  var S=window.BosApp&&window.BosApp.State,x=S&&S._ytCards&&S._ytCards[c.dataset.ytkey];if(!x)return;
  try{if(x.kind==='itAlbum')I.albumTracks(x.id);else if(x.kind==='itArtist')I.artistSongs(x.id);}catch(_){}
},{passive:true,capture:true});
})();
;
/* ===== bos-art-carousel ===== */
/* ===== 1) Samsung-Music style artwork swipe  2) Apple-Music style lyrics screen ===== */
(function(){
'use strict';
var $id=function(i){return document.getElementById(i);};
var fp=$id('full-player'), lv=$id('lyrics-view');
if(!fp||!lv) return;
var wrap=fp.querySelector('.fp-art-wrap'), fpArt=$id('fp-art'), fpTitle=$id('fp-title'), fpArtist=$id('fp-artist'), fpHeart=$id('fp-heart');
var canWA=typeof Element.prototype.animate==='function'&&window.CSS&&CSS.supports&&CSS.supports('translate','1px');
var noAnim=function(){return false;};
var noLyAnim=function(){return false;}; /* lyrics morph/shift animations stay ON */
var EASE='cubic-bezier(.22,1,.36,1)', EASE2='cubic-bezier(.32,.72,0,1)';

/* ------------------------------------------------------------------ artwork carousel */
try{(function(){
  var meta=fp.querySelector('.fp-meta-text');
  if(!wrap||!fpArt) return;
  var g=null, busy=false;
  var urlOf=function(t){return (t&&t.image)||FALLBACK_ART;};
  function nextTrack(){
    var q=State.queue; if(!q||!q.length) return null;
    var ni;
    if(State.shuffle){ if(!State.shuffleOrder||!State.shuffleOrder.length) getQ().buildShuffleOrder(); ni=State.shuffleOrder[0]; }
    else ni=State.queueIndex+1;
    if(ni==null) return null;
    if(ni<0||ni>=q.length){ if(State.repeat==='all') ni=0; else return null; }
    return q[ni]||null;
  }
  function getQ(){ return (typeof Queue!=='undefined'&&Queue)||(window.BosApp&&window.BosApp.Queue)||{persist:function(){},buildShuffleOrder:function(){}}; }
  function nextIdx(){
    var q=State.queue; if(!q||!q.length) return null;
    var ni;
    if(State.shuffle){ if(!State.shuffleOrder||!State.shuffleOrder.length) getQ().buildShuffleOrder(); ni=State.shuffleOrder[0]; }
    else ni=State.queueIndex+1;
    if(ni==null) return null;
    if(ni<0||ni>=q.length){ if(State.repeat==='all') ni=0; else return null; }
    return q[ni]?ni:null;
  }
  function prevInfo(){
    var q=State.queue; if(!q||!q.length) return null;
    var pi=State.queueIndex-1;
    if(pi<0){ if(State.repeat==='all'&&q.length>1) pi=q.length-1; else return null; }
    return q[pi]?{t:q[pi],i:pi}:null;
  }
  function doPrev(pi){
    if(State.currentTrack&&State.currentTrack.source==='youtube'&&window.BosYT) return Player.prev();
    try{finalizeCrossfadeIfRunning();}catch(_){}
    State.queueIndex=pi; getQ().persist();
    return Player.play(State.queue[pi],null,null,{autoTransition:false});
  }
  function preload(){ try{ var n=nextTrack(), p=prevInfo(); [n,p&&p.t].forEach(function(t){ if(t&&t.image){ var im=new Image(); im.src=t.image; } }); }catch(_){} }
  try{ new MutationObserver(function(){ setTimeout(preload,200); }).observe(fpArt,{attributes:true,attributeFilter:['src']}); }catch(_){}

  function place(dx){
    if(dx<0&&!g.nx) dx*=.3; else if(dx>0&&!g.pv) dx*=.3;
    g.dx=dx;
    g.cur.style.transform='translate3d('+dx+'px,0,0)';
    if(g.nx) g.nx.style.transform='translate3d('+(g.step+dx)+'px,0,0)';
    if(g.pv) g.pv.style.transform='translate3d('+(-g.step+dx)+'px,0,0)';
    if(meta){ var p=Math.min(1,Math.abs(dx)/(g.step*.8)); meta.style.transform='translate3d('+(dx*.35)+'px,0,0)'; meta.style.opacity=String(1-p); }
  }
  function build(){
    var r=wrap.getBoundingClientRect(), fr=fp.getBoundingClientRect(), cs=getComputedStyle(wrap);
    g.step=r.width+Math.round(fr.width*.05);
    g.nI=nextIdx(); g.nT=g.nI==null?null:State.queue[g.nI]; g.pI=prevInfo();
    var ov=document.createElement('div'); ov.className='bos-car'; g.ov=ov;
    function tile(url){
      var i=new Image(); i.className='bos-car-t'; i.decoding='async'; i.src=url;
      i.style.left=(r.left-fr.left)+'px'; i.style.top=(r.top-fr.top)+'px'; i.style.width=r.width+'px'; i.style.height=r.height+'px';
      i.style.borderRadius=cs.borderTopLeftRadius; i.style.boxShadow=cs.boxShadow; ov.appendChild(i); return i;
    }
    g.cur=tile(fpArt.currentSrc||fpArt.src);
    g.nx=g.nT?tile(urlOf(g.nT)):null;
    g.pv=g.pI?tile(urlOf(g.pI.t)):null;
    fp.appendChild(ov); wrap.style.visibility='hidden';
    if(meta) meta.style.transition='none';
  }
  function cleanup(keepMeta){
    if(g&&g.ov&&g.ov.parentNode) g.ov.parentNode.removeChild(g.ov);
    wrap.style.visibility='';
    if(meta&&!keepMeta){ meta.style.transition=''; meta.style.transform=''; meta.style.opacity=''; }
    g=null; if(!keepMeta) busy=false;
  }
  function endSwap(){ clearTimeout(swapTimer); fp.classList.remove('bos-car-swap'); if(meta){ meta.style.transition=''; meta.style.transform=''; meta.style.opacity=''; } busy=false; }
  var swapTimer=0;
  function fadeMeta(dir){
    if(!meta){ endSwap(); return; }
    meta.style.transition='none'; meta.style.transform=''; meta.style.opacity='';
    if(canWA&&!noAnim()){
      var an=meta.animate([{opacity:0,transform:'translate3d('+(dir*34)+'px,0,0)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE,fill:'backwards'});
      an.onfinish=endSwap; an.oncancel=endSwap;
    } else endSwap();
  }
  /* switch the real track under the covering tiles; returns the new track or null if it could not switch */
  function commit(gg,dir){
    var q=State.queue, before=State.currentTrack, oldIdx=State.queueIndex, shifted=false, ni, t;
    try{
      ni=dir===1?gg.nI:gg.pI.i; t=q[ni]; if(!t) return null;
      if(dir===1&&State.shuffle&&State.shuffleOrder&&State.shuffleOrder[0]===ni){ State.shuffleOrder.shift(); shifted=true; }
      State.queueIndex=ni; getQ().persist();
      var p=Player.play(t,null,null,{autoTransition:false});
      if(p&&typeof p.catch==='function') p.catch(function(){});
      var cur=State.currentTrack;
      if(cur&&(cur!==before||cur.id===t.id)) return t;
    }catch(err){ console.warn('car commit',err); }
    if(shifted) State.shuffleOrder.unshift(ni);
    State.queueIndex=oldIdx; try{getQ().persist();}catch(_){}
    return null;
  }
  function finish(){
    if(!g||g.lock!==1){ g=null; return; }
    var gg=g, dt=Math.max(1,performance.now()-gg.t0), v=gg.rawDx/dt, W=gg.step, dir=0;
    if(gg.rawDx<0&&gg.nx&&(Math.abs(gg.rawDx)>W*.26||(v<-.4&&Math.abs(gg.rawDx)>26))) dir=1;
    else if(gg.rawDx>0&&gg.pv&&(Math.abs(gg.rawDx)>W*.26||(v>.4&&Math.abs(gg.rawDx)>26))) dir=-1;
    busy=true;
    var T='transform .34s '+EASE;
    [gg.cur,gg.nx,gg.pv].forEach(function(t){ if(t) t.style.transition=T; });
    function slideTo(tgt){
      gg.cur.style.transform='translate3d('+tgt+'px,0,0)';
      if(gg.nx) gg.nx.style.transform='translate3d('+(W+tgt)+'px,0,0)';
      if(gg.pv) gg.pv.style.transform='translate3d('+(-W+tgt)+'px,0,0)';
    }
    if(dir===0){
      if(meta){ meta.style.transition='transform .34s '+EASE+',opacity .3s ease'; meta.style.transform='translate3d(0,0,0)'; meta.style.opacity='1'; }
      slideTo(0);
      setTimeout(function(){ if(g===gg) cleanup(); },300);
      return;
    }
    /* committed swipe: old title fades out quickly (before the text changes), tiles glide, track switches under the tiles */
    if(meta){ meta.style.transition='transform .34s '+EASE+',opacity .12s linear'; meta.style.transform='translate3d('+(dir*-40)+'px,0,0)'; meta.style.opacity='0'; }
    slideTo(dir===1?-W:W);
    fp.classList.add('bos-car-swap');
    clearTimeout(swapTimer); swapTimer=setTimeout(function(){ if(g===gg) g=null; try{ if(gg.ov&&gg.ov.parentNode) gg.ov.parentNode.removeChild(gg.ov); }catch(_){} wrap.style.visibility=''; endSwap(); },2600);
    var oldSrc=fpArt.getAttribute('src');
    setTimeout(function(){
      if(g!==gg) return;
      var tgtT=dir===1?gg.nT:gg.pI.t, url=urlOf(tgtT);
      if(fpArt.getAttribute('src')!==url) fpArt.src=url;
      var exp=commit(gg,dir);
      if(!exp){
        if(oldSrc&&fpArt.getAttribute('src')!==oldSrc) fpArt.src=oldSrc;
        if(meta){ meta.style.transition='transform .3s '+EASE+',opacity .25s ease'; meta.style.transform='translate3d(0,0,0)'; meta.style.opacity='1'; }
        slideTo(0);
        setTimeout(function(){ if(g===gg){ clearTimeout(swapTimer); fp.classList.remove('bos-car-swap'); cleanup(); } },340);
        return;
      }
      var tc=performance.now(), expName=String(exp.name==null?'':exp.name);
      var go=function(){
        if(g!==gg) return;
        if(fpTitle&&fpTitle.textContent!==expName&&performance.now()-tc<900){ setTimeout(go,40); return; }
        cleanup(true); fadeMeta(dir);
      };
      var dec=fpArt.decode?fpArt.decode().catch(function(){}):Promise.resolve();
      var lim=new Promise(function(r){ setTimeout(r,420); });
      setTimeout(function(){ Promise.race([dec,lim]).then(go); },200);
    },150);
  }
  wrap.addEventListener('touchstart',function(e){
    if(busy||g||e.touches.length!==1) return;
    if(!fp.classList.contains('open')||fp.classList.contains('ly-on')||document.documentElement.classList.contains('bos-sheet-busy')) return;
    if(!State.currentTrack) return;
    var t=e.touches[0]; g={sx:t.clientX,sy:t.clientY,t0:performance.now(),lock:0,dx:0,rawDx:0};
  },{passive:true});
  wrap.addEventListener('touchmove',function(e){
    if(!g||!e.touches.length) return;
    var t=e.touches[0], dx=t.clientX-g.sx, dy=t.clientY-g.sy;
    if(g.lock===0){
      if(Math.abs(dx)>9&&Math.abs(dx)>Math.abs(dy)*1.15){ g.lock=1; build(); }
      else if(Math.abs(dy)>12){ g=null; return; }
      else return;
    }
    g.rawDx=dx; place(dx);
  },{passive:true});
  wrap.addEventListener('touchend',finish,{passive:true});
  wrap.addEventListener('touchcancel',function(){ if(g&&g.lock===1){ g.rawDx=0; finish(); } else g=null; },{passive:true});
})();}catch(e){ console.warn('art carousel',e); }

/* ------------------------------------------------------------------ Apple-style lyrics */
try{(function(){
  var hd=$id('ly-hd'), th=$id('ly-thumb'), lt=$id('ly-title'), la=$id('ly-artist'), lm=$id('ly-meta'), lh=$id('ly-heart'), lb=$id('ly-back');
  var prog=fp.querySelector('.fp-progress-wrap');
  if(!hd||!th||!prog||!wrap) return;
  function sync(){
    try{
      lt.textContent=fpTitle?fpTitle.textContent:''; la.textContent=fpArtist?fpArtist.textContent:'';
      var s=fpArt&&fpArt.getAttribute('src'); if(s&&th.getAttribute('src')!==s) th.src=s;
      if(fpHeart){ lh.innerHTML=fpHeart.innerHTML; lh.dataset.liked=fpHeart.classList.contains('active')?'1':'0'; }
    }catch(_){}
  }
  [fpTitle,fpArtist,fpHeart].forEach(function(n){ if(n) try{ new MutationObserver(sync).observe(n,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']}); }catch(_){} });
  if(fpArt) try{ new MutationObserver(sync).observe(fpArt,{attributes:true,attributeFilter:['src']}); }catch(_){}
  sync();
  var back=function(){ var c=$id('lyrics-close'); if(c) c.click(); };
  lb.addEventListener('click',back); th.addEventListener('click',back); lm.addEventListener('click',back);
  lh.addEventListener('click',function(){ if(fpHeart) fpHeart.click(); setTimeout(sync,40); });
  /* the lyrics button in the player toggles lyrics off while they are open */
  fp.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('#fp-lyrics-open');
    if(b&&lv.classList.contains('open')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); back(); }
  },true);

  function measure(){
    var fr=fp.getBoundingClientRect(), pr=prog.getBoundingClientRect();
    if(pr.height&&!fp.classList.contains('ly-hide')){ shownBot=Math.max(110,Math.round(fr.bottom-pr.top+4))+'px'; lv.style.setProperty('--ly-bot',shownBot); }
  }
  var shownBot='230px', hideT=0, strip=document.createElement('div'); strip.id='ly-reveal'; lv.appendChild(strip);
  function hideCtl(){ fp.classList.add('ly-hide'); lv.style.setProperty('--ly-bot','calc(var(--safe-b,0px) + 22px)'); }
  function showCtl(ms){ clearTimeout(hideT); fp.classList.remove('ly-hide'); lv.style.setProperty('--ly-bot',shownBot); if(ms) hideT=setTimeout(hideCtl,ms); }
  strip.addEventListener('click',function(){ showCtl(3500); });
  /* scrolling the lyrics by ~3 lines (either way) brings the controls back */
  var sbox=$id('lyrics-scroll'), gCnt=null, gEls=null, gDone=false, touching=false, lastTouch=0;
  function lineAt(top){ var c=0; for(var i=0;i<gEls.length;i++){ if(gEls[i].offsetTop<=top+4) c=i; else break; } return c; }
  if(sbox){
    sbox.addEventListener('touchstart',function(){
      touching=true; gDone=false; gEls=sbox.querySelectorAll('.lyric-line'); gCnt=gEls.length?lineAt(sbox.scrollTop):null;
      if(fp.classList.contains('ly-on')&&!fp.classList.contains('ly-hide')){ clearTimeout(hideT); hideT=setTimeout(hideCtl,3500); }
    },{passive:true});
    var tEnd=function(){ touching=false; lastTouch=performance.now(); };
    sbox.addEventListener('touchend',tEnd,{passive:true}); sbox.addEventListener('touchcancel',tEnd,{passive:true});
    sbox.addEventListener('scroll',function(){
      if(gDone||gCnt==null||!fp.classList.contains('ly-hide')) return;
      var now=performance.now();
      if(!touching&&now-lastTouch>900) return;
      if(now-(window.bosLyProg||0)<150) return;
      if(Math.abs(lineAt(sbox.scrollTop)-gCnt)>=3){ gDone=true; showCtl(3500); }
    },{passive:true});
  }
  fp.addEventListener('pointerdown',function(e){
    if(fp.classList.contains('ly-on')&&!fp.classList.contains('ly-hide')&&e.target.closest&&e.target.closest('.fp-progress-wrap,.fp-controls,.fp-side-actions')){ clearTimeout(hideT); hideT=setTimeout(hideCtl,3500); }
  },true);
  window.addEventListener('resize',function(){ if(lv.classList.contains('open')) measure(); },{passive:true});

  function flipOpen(){
    if(!canWA||noLyAnim()) return;
    var a=wrap.getBoundingClientRect(), t=th.getBoundingClientRect();
    if(!a.width||!t.width) return;
    var sx=a.width/t.width, sy=a.height/t.height;
    th.style.transformOrigin='0 0';
    th.animate([{transform:'translate('+(a.left-t.left)+'px,'+(a.top-t.top)+'px) scale('+sx+','+sy+')',borderRadius:(26/sx)+'px'},{transform:'none',borderRadius:'8px'}],{duration:480,easing:EASE2});
    if(fpTitle){
      var ft=fpTitle.getBoundingClientRect(), tt=lt.getBoundingClientRect();
      lm.animate([{transform:'translate('+(ft.left-tt.left)+'px,'+(ft.top-tt.top)+'px)',opacity:0},{transform:'none',opacity:1}],{duration:440,easing:EASE2});
    }
  }
  function flipClose(){
    if(!canWA||noLyAnim()||!fp.classList.contains('open')) return;
    var t=th.getBoundingClientRect(), a=wrap.getBoundingClientRect();
    if(!a.width||!t.width) return;
    var sc=parseFloat(getComputedStyle(wrap).scale); if(!(sc>0)) sc=1;
    var k=t.width/a.width;
    var dx=(t.left+t.width/2)-(a.left+a.width/2), dy=(t.top+t.height/2)-(a.top+a.height/2);
    wrap.animate([{transform:'translate('+(dx/sc)+'px,'+(dy/sc)+'px) scale('+k+')',borderRadius:(8/(k*sc))+'px'},{transform:'none',borderRadius:'26px'}],{duration:460,easing:EASE2});
  }
  var was=false, lingerRaf=0;
  /* whole player closing while lyrics are open: keep the lyrics look (art/controls hidden) until the sheet is gone, so nothing pops over the lyrics */
  function lingerDone(){ cancelAnimationFrame(lingerRaf); lingerRaf=0; fp.classList.remove('ly-on','ly-hide'); }
  function linger(){
    var t0=performance.now();
    (function poll(){
      lingerRaf=0;
      if(lv.classList.contains('open')) return;
      if(fp.classList.contains('open')||!fp.classList.contains('bos-vis')||performance.now()-t0>1600){ lingerDone(); return; }
      lingerRaf=requestAnimationFrame(poll);
    })();
  }
  try{ new MutationObserver(function(){
    var on=lv.classList.contains('open'); if(on===was) return; was=on;
    if(!on&&!fp.classList.contains('open')){ clearTimeout(hideT); linger(); return; }
    if(lingerRaf){ cancelAnimationFrame(lingerRaf); lingerRaf=0; }
    fp.classList.toggle('ly-on',on);
    if(on){ clearTimeout(hideT); fp.classList.remove('ly-hide'); sync(); measure(); flipOpen(); hideT=setTimeout(hideCtl,1000); } else { clearTimeout(hideT); fp.classList.remove('ly-hide'); flipClose(); }
  }).observe(lv,{attributes:true,attributeFilter:['class']}); }catch(_){}

  /* distance blur + staggered "each line springs up" scroll */
  var pLo=0,pHi=-1;
  window.bosLyApple=function(box,lines,idx,desired,force){
    var n=lines.length, lo=Math.max(0,idx-10), hi=Math.min(n-1,idx+10), a=Math.min(lo,pLo), b=Math.max(hi,pHi);
    for(var i=a;i<=b;i++){ var l=lines[i]; if(!l) continue; var d=Math.abs(i-idx); var bl=(i===idx)?0:Math.min(.7+(d-1)*.8,3.4); l.style.setProperty('--bl',bl.toFixed(2)+'px'); }
    pLo=lo; pHi=hi;
    if(desired<0) return;
    window.bosLyProg=performance.now();
    var old=box.scrollTop; box.scrollTop=desired;
    var delta=box.scrollTop-old;
    if(force||!canWA||noLyAnim()||Math.abs(delta)<2||Math.abs(delta)>box.clientHeight*1.1) return;
    var from=Math.max(0,idx-5), to=Math.min(n-1,idx+11);
    for(var j=from;j<=to;j++){
      var el=lines[j]; if(!el) continue;
      var order=delta>0?(j<idx?0:j-idx):(j>idx?0:idx-j);
      el.animate([{translate:'0 '+delta+'px'},{translate:'0 0'}],{duration:430,delay:30+Math.min(order,10)*11,easing:'cubic-bezier(.3,.72,.22,1)',fill:'backwards'});
    }
  };
})();}catch(e){ console.warn('apple lyrics',e); }
})();
;
/* ===== inline-36 ===== */
/* ==== Network-loss + app-resume recovery (browser, Capacitor, Android WebView) ==== */
(function(){
  try{
    var wasPlaying=false, offlineShown=false;
    function au(){ try{ return typeof primaryAudio==='function'?primaryAudio():null; }catch(e){ return null; } }
    function say(m,t){ try{ toast(m,t); }catch(e){} }
    function recover(){
      var el=au(); if(!el||!el.getAttribute('src')) return;
      var broken=el.error||el.networkState===3||(el.paused&&el.readyState<3&&wasPlaying);
      if(!broken&&!(wasPlaying&&el.paused)) return;
      var t=el.currentTime||0;
      try{
        el.load();
        var seek=function(){ try{ if(t>0&&isFinite(t)) el.currentTime=t; }catch(e){} el.removeEventListener('loadedmetadata',seek); };
        el.addEventListener('loadedmetadata',seek);
        var p=el.play(); if(p&&p.catch) p.catch(function(){});
      }catch(e){}
    }
    window.addEventListener('offline',function(){
      var el=au(); wasPlaying=!!(el&&!el.paused); offlineShown=true;
      say('You’re offline — playback will resume when you reconnect','error');
    });
    window.addEventListener('online',function(){
      if(offlineShown){ say('Back online'); offlineShown=false; }
      setTimeout(recover,600);
    });
    /* screen unlock / return to foreground */
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible'&&navigator.onLine!==false) setTimeout(recover,400);
    });
    /* Capacitor: resume when the native app returns to the foreground */
    var AP=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    if(AP&&AP.addListener) AP.addListener('appStateChange',function(s){ if(s&&s.isActive) setTimeout(recover,400); });
  }catch(e){ console.warn('net recovery',e); }
})();
;
/* ===== bos-fluid-lyrics-js ===== */
/* same scroll as the fluid player: active line centred (45%), native smooth scroll, no distance blur / stagger */
try{ delete window.bosLyApple; window.bosLyApple=undefined; }catch(e){}
(function(){ var ls=document.querySelectorAll('#lyrics-scroll .lyric-line'); for(var i=0;i<ls.length;i++) ls[i].style.removeProperty('--bl'); })();
;
/* ===== bos-livebg-js ===== */
/* All motion here uses the Web Animations API on purpose: the app keeps body.no-anim on, which forces
   "transition:none!important;animation:none!important" on every element, so CSS animations never play. WAAPI is not affected. */
(function(){
  var host=document.getElementById('ambient');if(!host)return;
  var R=document.documentElement,B0=document.body,rm=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
  var wrap=document.createElement('div'),A=document.createElement('i'),B=document.createElement('i');
  wrap.className='bos-lg-wrap';wrap.setAttribute('aria-hidden','true');A.className=B.className='bos-lg';
  wrap.appendChild(A);wrap.appendChild(B);host.insertBefore(wrap,host.firstChild);
  var layers=[A,B],cur=-1,last='',timer=0,z=1,drift=null,FADE=1500;
  function num(n,d){var v=parseFloat(R.style.getPropertyValue(n));return isNaN(v)?d:v;}
  function rgba(c,a){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
  function op(){return B0.getAttribute('data-theme')==='light'?.55:1;}
  function kill(el){try{el.getAnimations().forEach(function(a){a.cancel();});}catch(e){}}
  function paint(){
    var c1=[num('--accent-r',124),num('--accent-g',92),num('--accent-b',255)].map(Math.round),
        c2=[num('--amb2-r',90),num('--amb2-g',70),num('--amb2-b',200)].map(Math.round),
        c3=[(c1[1]+c2[0])>>1,(c1[2]+c2[1])>>1,(c1[0]+c2[2])>>1];
    var key=c1+'|'+c2;if(key===last)return;last=key;
    var bg='radial-gradient(62% 50% at 18% 20%,'+rgba(c1,.62)+',transparent 72%),'+
           'radial-gradient(56% 50% at 86% 30%,'+rgba(c2,.5)+',transparent 72%),'+
           'radial-gradient(78% 56% at 52% 96%,'+rgba(c3,.42)+',transparent 74%)';
    var nx=cur<0?0:1-cur,nl=layers[nx],ol=cur<0?null:layers[cur],o=op();
    kill(nl);nl.style.background=bg;nl.style.zIndex=String(++z);nl.style.opacity='0';
    if(!nl.animate||rm.matches){nl.style.opacity=String(o);if(ol){kill(ol);ol.style.opacity='0';}cur=nx;return;}
    var a=nl.animate([{opacity:0},{opacity:o}],{duration:FADE,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    a.onfinish=function(){nl.style.opacity=String(op());a.cancel();if(ol){kill(ol);ol.style.opacity='0';}};
    cur=nx;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(paint,90);}
  try{new MutationObserver(schedule).observe(R,{attributes:true,attributeFilter:['style']});}catch(e){}
  try{new MutationObserver(function(){if(cur>=0){var a=layers[cur].getAnimations();if(!a.length)layers[cur].style.opacity=String(op());}}).observe(B0,{attributes:true,attributeFilter:['data-theme']});}catch(e){}
  paint();
  /* slow drift = the "live" feel; one transform animation on one wrapper */
  function startDrift(){
    if(drift||!wrap.animate||rm.matches)return;
    drift=wrap.animate([{transform:'translate3d(0,0,0) scale(1)'},{transform:'translate3d(-3.5%,3%,0) scale(1.07)'}],
      {duration:28000,iterations:Infinity,direction:'alternate',easing:'ease-in-out'});
    pause();
  }
  function pause(){
    if(!drift)return;var fp=document.getElementById('full-player'),
      stop=document.hidden||R.classList.contains('bos-sheet-busy')||!!(fp&&fp.classList.contains('open'));
    try{stop?drift.pause():drift.play();}catch(e){}
  }
  startDrift();
  document.addEventListener('visibilitychange',pause);
  var fp=document.getElementById('full-player');if(fp)try{new MutationObserver(pause).observe(fp,{attributes:true,attributeFilter:['class']});}catch(e){}
  try{new MutationObserver(pause).observe(R,{attributes:true,attributeFilter:['class']});}catch(e){}

  /* smooth fade for all 11 pages: the page that becomes .active fades in (opacity only) */
  var views=document.querySelectorAll('#view-scroll .view');
  if(views.length&&views[0].animate){
    var vo=new MutationObserver(function(recs){
      if(rm.matches)return;
      recs.forEach(function(r){var el=r.target;
        if(!/(^|\s)active(\s|$)/.test(r.oldValue||'')&&el.classList.contains('active')){
          try{el.animate([{opacity:0},{opacity:1}],{duration:320,easing:'cubic-bezier(.4,0,.2,1)'});}catch(e){}
        }});
    });
    views.forEach(function(v){vo.observe(v,{attributes:true,attributeFilter:['class'],attributeOldValue:true});});
  }
})();
