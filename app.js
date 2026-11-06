(function(){
"use strict";
/* ============================================================
   BOOSTER OS — APPLICATION LOGIC (v2 — full audit rebuild)
   ============================================================ */

const MUSIC_API = "https://" + String.fromCharCode(106,105,111,115,97,97,118,110) + "-api.raj-pawar091206.workers.dev/api";
const FALLBACK_ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23222230'/%3E%3Cpath d='M100 60a30 30 0 1 0 30 30h-10a20 20 0 1 1-20-20z' fill='%23555570'/%3E%3C/svg%3E";
const QUALITY_ORDER = ["12","48","96","160","320"];
const LS_PREFIX = "boosterOS_";

const $  = (s,el)=> (el||document).querySelector(s);
const $$ = (s,el)=> Array.from((el||document).querySelectorAll(s));
function jsq(v){return String(v).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/[\r\n]/g," ");}
function esc(str){
  if(str===null||str===undefined) return "";
  return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fmtTime(sec){
  if(!isFinite(sec)||sec<0) sec=0;
  const m=Math.floor(sec/60), s=Math.floor(sec%60);
  return m+":"+String(s).padStart(2,"0");
}
function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function uniqBy(arr,keyFn){const seen=new Set();return arr.filter(x=>{const k=keyFn(x);if(seen.has(k))return false;seen.add(k);return true;});}
function hashStr(str){let h=0;for(let i=0;i<str.length;i++){h=(h<<5)-h+str.charCodeAt(i);h|=0;}return Math.abs(h);}
function shuffleArray(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

const Store = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(LS_PREFIX+key);
      if(raw===null||raw===undefined) return fallback;
      return JSON.parse(raw);
    }catch(e){ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem(LS_PREFIX+key, JSON.stringify(value)); return true; }
    catch(e){ console.warn("Storage write failed", e); return false; }
  },
  remove(key){ try{ localStorage.removeItem(LS_PREFIX+key); }catch(e){} },
  usageKB(){
    try{
      let total=0;
      for(let k in localStorage){ if(k.startsWith(LS_PREFIX)) total += (localStorage[k].length + k.length); }
      return Math.round(total/1024*10)/10;
    }catch(e){ return 0; }
  }
};

function svgPlay(){return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';}
function svgPause(){return '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';}
function svgHeart(filled){return '<svg viewBox="0 0 24 24" fill="'+(filled?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';}
function svgMore(){return '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';}
function svgAddQueue(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13M3 12h13M3 18h5"/><path d="M17 15v6M14 18h6"/></svg>';}
function svgTrash(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z"/></svg>';}
function svgMusicEmpty(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';}
function svgAlert(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';}
function svgClock(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';}
function svgChevronR(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';}

/* ============================================================ API ============================================================ */
const cache = new Map();
async function apiFetch(url, cacheKey, ttlMs, signal){
  ttlMs=ttlMs||5*60*1000; const key=cacheKey||url; const hit=cache.get(key);
  if(hit&&(Date.now()-hit.t<ttlMs))return hit.data;
  let res;
  try{
    const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12000);
    const onAbort=()=>{try{ctl.abort();}catch(_){}};
    if(signal){if(signal.aborted)throw {name:"AbortError"};signal.addEventListener("abort",onAbort,{once:true});}
    try{res=await fetch(url,{method:"GET",signal:ctl.signal});if(res.status>=500&&!ctl.signal.aborted){await new Promise(r=>setTimeout(r,700));res=await fetch(url,{method:"GET",signal:ctl.signal});}}
    finally{clearTimeout(timeout);if(signal)signal.removeEventListener("abort",onAbort);}
  }catch(err){
    if(err&&(err.name==="AbortError"||(signal&&signal.aborted)))throw {type:"aborted",message:"Request cancelled.",raw:err};
    throw {type:"network",message:"Could not reach the music service. Check your connection.",raw:err};
  }
  if(!res.ok)throw {type:"http",message:"Music service returned an error (HTTP "+res.status+").",status:res.status};
  let json;try{json=await res.json();}catch(err){throw {type:"parse",message:"Received an invalid response from the music service.",raw:err};}
  if(json&&json.success===false)throw {type:"api",message:json.message||"The music service could not complete this request."};
  if(cache.size>80)cache.delete(cache.keys().next().value);cache.set(key,{t:Date.now(),data:json});return json;
}
const Api={
  searchAll(q,signal){return apiFetch(MUSIC_API+"/search?query="+encodeURIComponent(q),"search-all:"+q,120000,signal);},
  searchSongs(q,page,limit,signal){page=page||0;limit=limit||20;return apiFetch(MUSIC_API+"/search/songs?query="+encodeURIComponent(q)+"&page="+page+"&limit="+limit,"search-songs:"+q+":"+page+":"+limit,120000,signal);},
  searchAlbums(q,page,limit,signal){page=page||0;limit=limit||20;return apiFetch(MUSIC_API+"/search/albums?query="+encodeURIComponent(q)+"&page="+page+"&limit="+limit,"search-albums:"+q+":"+page+":"+limit,300000,signal);},
  searchArtists(q,page,limit,signal){page=page||0;limit=limit||20;return apiFetch(MUSIC_API+"/search/artists?query="+encodeURIComponent(q)+"&page="+page+"&limit="+limit,"search-artists:"+q+":"+page+":"+limit,300000,signal);},
  searchPlaylists(q,page,limit,signal){page=page||0;limit=limit||20;return apiFetch(MUSIC_API+"/search/playlists?query="+encodeURIComponent(q)+"&page="+page+"&limit="+limit,"search-playlists:"+q+":"+page+":"+limit,300000,signal);},
  getSong(id,signal){return apiFetch(MUSIC_API+"/songs/"+encodeURIComponent(id),"song:"+id,300000,signal);},
  getAlbum(id,signal){return apiFetch(MUSIC_API+"/albums?id="+encodeURIComponent(id),"album:"+id,300000,signal);},
  getArtist(id,signal){return apiFetch(MUSIC_API+"/artists/"+encodeURIComponent(id),"artist:"+id,300000,signal);},
  getArtistAlbums(id,page,signal){return apiFetch(MUSIC_API+"/artists/"+encodeURIComponent(id)+"/albums?page="+(page||0),"artist-albums:"+id+":"+(page||0),300000,signal);},
  getPlaylist(id,signal,page,limit){page=page||0;limit=limit||100;return apiFetch(MUSIC_API+"/playlists?id="+encodeURIComponent(id)+"&page="+page+"&limit="+limit,"playlist:"+id+":"+page+":"+limit,300000,signal);},
  getArtistSongs(id,page,signal){return apiFetch(MUSIC_API+"/artists/"+encodeURIComponent(id)+"/songs?page="+(page||0)+"&sortBy=popularity&sortOrder=desc","artist-songs:"+id+":"+(page||0),300000,signal);}
};

/* ---------------- NORMALIZERS ---------------- */
function bestImage(imgArr){
  if(!imgArr || !imgArr.length) return FALLBACK_ART;
  const best = imgArr[imgArr.length-1];
  return (best && best.url) ? best.url.replace(/^http:/,"https:") : FALLBACK_ART;
}
function joinArtists(artistsObj){
  if(!artistsObj) return "Unknown Artist";
  const list = artistsObj.primary && artistsObj.primary.length ? artistsObj.primary : (artistsObj.all||[]);
  if(!list.length) return "Unknown Artist";
  return list.slice(0,3).map(a=>a.name).join(", ");
}
function normalizeSong(raw){
  if(!raw) return null;
  /* The worker can return either full song objects or compact search objects.
     Normalize BOTH shapes so artist recommendations never become "Unknown Artist". */
  const dl = {};
  (raw.downloadUrl||[]).forEach(d=>{ const q=(d.quality||"").replace("kbps",""); if(d&&d.url)dl[q]=d.url; });
  const primaryArtist = raw.artists&&raw.artists.primary&&raw.artists.primary[0]
    ? raw.artists.primary[0] : null;
  const compactArtists = raw.singers || raw.primaryArtists || raw.artistName || raw.subtitle || "";
  const artistName = primaryArtist ? joinArtists(raw.artists) : String(compactArtists||"Unknown Artist");
  return {
    id: raw.id, name: (raw.name||raw.title||"Untitled").replace(/&quot;/g,'"').replace(/&amp;/g,"&"),
    duration: Number(raw.duration)||0, year: raw.year||"", language: raw.language||"",
    image: bestImage(raw.image), artistName, artistId: primaryArtist ? primaryArtist.id : (raw.artistId||null),
    albumName: raw.album ? raw.album.name : (raw.album||""), albumId: raw.album ? raw.album.id : (raw.albumId||null),
    downloadUrl: dl, hasLyrics: !!raw.hasLyrics, url: String(raw.url||"")
  };
}
function normalizeAlbum(raw){
  if(!raw) return null;
  return { id: raw.id, name: (raw.name||"Untitled Album").replace(/&quot;/g,'"').replace(/&amp;/g,"&"),
    image: bestImage(raw.image), year: raw.year||"", language: raw.language||"",
    artistName: joinArtists(raw.artists), songCount: raw.songCount || (raw.songs? raw.songs.length:0),
    songs: raw.songs ? raw.songs.map(normalizeSong) : null };
}
function normalizeArtist(raw){
  if(!raw) return null;
  return { id: raw.id, name: raw.name||"Unknown Artist", image: bestImage(raw.image),
    followerCount: raw.followerCount||0, bio: (raw.bio&&raw.bio[0]) ? raw.bio[0].text : "",
    topSongs: raw.topSongs ? raw.topSongs.map(normalizeSong) : [] };
}
function normalizePlaylist(raw){
  if(!raw) return null;
  return { id: raw.id, name: (raw.name||"Untitled Playlist").replace(/&quot;/g,'"').replace(/&amp;/g,"&"),
    image: bestImage(raw.image), songCount: raw.songCount||0, language: raw.language||"",
    songs: raw.songs ? raw.songs.map(normalizeSong) : null };
}
function normalizeSongFromCompact(raw){
  return { id: raw.id, name:(raw.title||"Untitled").replace(/&quot;/g,'"').replace(/&amp;/g,"&"), duration:0,
    image: bestImage(raw.image), artistName: raw.singers || raw.primaryArtists || raw.subtitle || "Unknown Artist",
    albumName: raw.album||"", albumId:null, artistId:null, downloadUrl:{}, hasLyrics:false, _needsFetch:true, language: raw.language||"" };
}
function normalizeAlbumFromCompact(raw){ return { id: raw.id, name:(raw.title||"Untitled").replace(/&quot;/g,'"').replace(/&amp;/g,"&"), image: bestImage(raw.image), artistName: raw.description||"", year:"" }; }
function normalizeArtistFromCompact(raw){ return { id: raw.id, name: raw.title||raw.name||"Unknown", image: bestImage(raw.image) }; }

/* ============================================================ STATE ============================================================ */
const _rps=((Store.get("settings",{})||{}).rememberPlayerState!==false);
const State = {
  view: "home", viewParams: {}, navStack: [],
  sidebarCollapsed: Store.get("sidebarCollapsed", false),
  queue: Store.get("queue", []), queueIndex: Store.get("queueIndex", -1),
  shuffleOrder: [], shuffle: _rps?Store.get("shuffle", false):false, repeat: _rps?Store.get("repeat", "off"):"off",
  favSongs: Store.get("favSongs", []), favAlbums: Store.get("favAlbums", []),
  favArtists: Store.get("favArtists", []), favPlaylists: Store.get("favPlaylists", []),
  history: Store.get("history", []), volume: _rps?Store.get("volume", 0.8):0.8,
  settings: Object.assign({
    theme:"dark",
    autoplayNext:true, rememberPosition:true, continuePlayback:true,
    crossfade:true, crossfadeDuration:15, audioQuality:"160", normalizeVolume:false,
    syncedLyrics:true, lyricsAutoScroll:true, highlightActiveLine:true, lyricsFontSize:"medium", lyricsAnimation:true,
    miniPlayerEnabled:true, dynamicPlayerBg:true, animatedArtwork:true, rememberPlayerState:true
  }, Store.get("settings", {})),
  currentTrack: null, isPlaying: false, lyricsData: null, lyricsOpen: false,
  searchQuery: "", searchTab: "all", libTab: "favorites", _lastSavedPos:0,
  smartQueueSeed: "", smartQueueBusy:false, smartSessionId: Date.now(),
  smartRadioActive:false, smartRadioRefillToken:0,
  _nextInFlight:false, _crossfadeTrackId:null, _crossfadeTriggered:false,
  _crossfadeGeneration:0, _autoTransitionInFlight:false,
  _navSeq:0,_homeLoadedAt:0,_homeLoading:false,_homeAbort:null,
  _searchSeq:0,_searchAbort:null,_detailSeq:0,_detailAbort:null,_homeSeenFamilies:null
};
if(typeof State.settings.crossfadeDuration!=="number"||isNaN(State.settings.crossfadeDuration)) State.settings.crossfadeDuration=15;
State.settings.crossfade = State.settings.crossfadeDuration>0;
["lowEndMode","dynamicBg","glassEffects","animations"].forEach(function(k){delete State.settings[k];});

/* ============================================================ THEME ============================================================ */
const ThemeManager = {
  apply(mode){
    let real = mode;
    if(mode==="system") real = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light";
    document.body.setAttribute("data-theme", real);
    State.settings.theme = mode; Store.set("settings", State.settings);
  },
  init(){
    this.apply(State.settings.theme||"dark");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{ if(State.settings.theme==="system") this.apply("system"); });
  },
  toggleQuick(){ const cur = document.body.getAttribute("data-theme"); this.apply(cur==="dark" ? "light" : "dark"); renderSettingsIfActive(); }
};
function applySettingsEffects(){
  const cl=document.body.classList;
  cl.toggle("no-player-bg", !State.settings.dynamicPlayerBg);
  cl.toggle("no-lyric-anim", !State.settings.lyricsAnimation);
  cl.toggle("playing-anim", !!(State.isPlaying && State.settings.animatedArtwork));
  const lv = $("#lyrics-view");
  if(lv) lv.className = "lyrics-fontsize-"+State.settings.lyricsFontSize + (State.lyricsOpen?" open":"");
  $("#mini-player").classList.toggle("hidden", !State.settings.miniPlayerEnabled);
}
function saveSettings(){Store.set("settings",State.settings);applySettingsEffects();}
let volumeSaveTimer=0;function persistVolumeDebounced(v){clearTimeout(volumeSaveTimer);volumeSaveTimer=setTimeout(()=>{if(State.settings.rememberPlayerState!==false)Store.set("volume",v);},180);}

/* ============================================================ TOASTS / MODAL ============================================================ */
function toast(msg, type){
  const c = $("#toast-container");
  const el = document.createElement("div");
  el.className = "toast glass-2" + (type?(" "+type):"");
  el.textContent = msg; c.appendChild(el);
  setTimeout(()=>{ el.classList.add("leaving"); setTimeout(()=>el.remove(),320); }, 3200);
}
let modalResolver = null;
function confirmModal(title, desc){
  return new Promise(resolve=>{
    modalResolver = resolve;
    $("#modal-title").textContent = title; $("#modal-desc").textContent = desc;
    $("#modal-backdrop").classList.add("open"); $("#modal-box").classList.add("open");
  });
}
function closeModal(result){
  $("#modal-backdrop").classList.remove("open"); $("#modal-box").classList.remove("open");
  if(modalResolver){ modalResolver(result); modalResolver=null; }
}

/* ============================================================ AMBIENT / COLOR ============================================================ */
/* Race-safe layered ambient engine: A/B(/C) crossfade, cached colour sampling, stale-load protection */
const AmbientFX=(function(){
  function Stack(host,cls,n,before){
    const els=[],order=[];
    for(let i=0;i<n;i++){const d=document.createElement("div");d.className=cls;d.setAttribute("aria-hidden","true");before?host.insertBefore(d,before):host.appendChild(d);els.push(d);order.push(i);}
    let timer=0,shown="";
    return{
      shown:function(){return shown;},
      show:function(bg,tiny,ms,key){
        const idx=order.pop(),el=els[idx];order.unshift(idx);
        el.style.transitionDuration="0ms";el.classList.remove("on");
        el.classList.toggle("tiny",!!tiny);el.style.backgroundImage=bg;
        for(let r=0;r<n;r++)els[order[r]].style.zIndex=String(n-r);
        shown=key;
        requestAnimationFrame(function(){requestAnimationFrame(function(){
          if(order[0]!==idx)return;
          el.style.transitionDuration=ms+"ms";el.classList.add("on");
        });});
        clearTimeout(timer);
        timer=setTimeout(function(){for(let r=1;r<n;r++){const o=els[order[r]];o.style.transitionDuration="0ms";o.classList.remove("on");}},ms+200);
      }
    };
  }
  const cache=new Map(),pending=new Map();
  let amb=null,fpl=null;
  function init(){
    if(amb)return;
    const host=document.getElementById("ambient"),fpb=document.getElementById("fp-bg");
    if(host){
      ["amb-a","amb-b"].forEach(function(id){const o=document.getElementById(id);if(o)o.remove();});
      const dim=document.createElement("div");dim.className="amb-dim";dim.setAttribute("aria-hidden","true");
      const tint=host.querySelector(".amb-tint");
      tint?host.insertBefore(dim,tint):host.appendChild(dim);
      amb=Stack(host,"amb-layer",3,dim);
    }
    if(fpb)fpl=Stack(fpb,"fpl",3,null);
  }
  function analyse(img){
    const S=40,c=document.createElement("canvas");c.width=c.height=S;
    const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,S,S);
    const d=x.getImageData(0,0,S,S).data,B=12;
    const w=new Float32Array(B),sr=new Float32Array(B),sg=new Float32Array(B),sb=new Float32Array(B);
    let ar=0,ag=0,ab=0,n=0;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];ar+=r;ag+=g;ab+=b;n++;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx/255;
      if(v<.12)continue;
      const s=mx?(mx-mn)/mx:0;if(s<.08)continue;
      let h=0;const df=mx-mn;
      if(mx===r)h=((g-b)/df)%6;else if(mx===g)h=(b-r)/df+2;else h=(r-g)/df+4;
      h=(h*60+360)%360;
      const bi=Math.floor(h/30)%B,wt=(s*s+.05)*(.35+v);
      w[bi]+=wt;sr[bi]+=r*wt;sg[bi]+=g*wt;sb[bi]+=b*wt;
    }
    let b1=-1,b2=-1;
    for(let i=0;i<B;i++){if(b1<0||w[i]>w[b1]){b2=b1;b1=i;}else if(b2<0||w[i]>w[b2])b2=i;}
    const avg=[ar/n,ag/n,ab/n];
    const pick=function(bi){return bi>=0&&w[bi]>0?[sr[bi]/w[bi],sg[bi]/w[bi],sb[bi]/w[bi]]:avg;};
    const fix=function(c){return[clamp(Math.round(c[0]*1.2),40,235),clamp(Math.round(c[1]*1.2),40,235),clamp(Math.round(c[2]*1.2),40,235)];};
    const c1=fix(pick(b1));
    const c2=(b2>=0&&w[b2]>w[b1]*.22)?fix(pick(b2)):fix([avg[2]*.8,avg[0]*.8,avg[1]*.8]);
    return{c1:c1,c2:c2,tiny:c.toDataURL("image/jpeg",.72)};
  }
  function load(url){
    if(cache.has(url))return Promise.resolve(cache.get(url));
    if(pending.has(url))return pending.get(url);
    const p=new Promise(function(resolve){
      let done=false;
      const finish=function(e){
        if(done)return;done=true;pending.delete(url);
        if(e.ok){cache.set(url,e);if(cache.size>48)cache.delete(cache.keys().next().value);}
        resolve(e);
      };
      const plain=function(){
        if(done)return;
        const b=new Image();b.decoding="async";
        b.onload=function(){finish({ok:true,bg:'url("'+url.replace(/"/g,"%22")+'")',tiny:false,c1:null,c2:null});};
        b.onerror=function(){finish({ok:false});};
        b.src=url;
      };
      const a=new Image();a.decoding="async";a.crossOrigin="anonymous";
      a.onload=function(){try{const r=analyse(a);finish({ok:true,bg:'url("'+r.tiny+'")',tiny:true,c1:r.c1,c2:r.c2});}catch(e){plain();}};
      a.onerror=plain;
      a.src=url;
    });
    pending.set(url,p);return p;
  }
  return{
    init:init,load:load,
    shown:function(){return amb?amb.shown():"";},
    commit:function(entry,ms,key){if(amb)amb.show(entry.bg,entry.tiny,ms,key);if(fpl)fpl.show(entry.bg,entry.tiny,ms,key);}
  };
})();
AmbientFX.init();
let ambTok=0;
function updateAmbient(track, transitionSec){
  if(!track) return;
  const image = String(track.image || track.artwork || track.imageUrl || "");
  const my = ++ambTok;
  let ms = clamp((Number(transitionSec)||1.1)*1000,450,8000);
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ms = Math.min(ms,250);
  const fb = function(){ return hashColor(String(track.id||"")+String(track.name||"")); };
  const dark = function(c){ return [clamp(Math.round(c[2]*.8),40,235),clamp(Math.round(c[0]*.8),40,235),clamp(Math.round(c[1]*.8),40,235)]; };
  if(!image){ const c=fb(); setAccent(c[0],c[1],c[2]); const d=dark(c); setAccent2(d[0],d[1],d[2]); return; }
  if(image===AmbientFX.shown()) return;
  AmbientFX.load(image).then(function(e){
    if(my!==ambTok) return;               /* a newer song took over: this result is stale */
    if(!e.ok){ const c=fb(); setAccent(c[0],c[1],c[2]); const d=dark(c); setAccent2(d[0],d[1],d[2]); return; }   /* keep previous valid background */
    AmbientFX.commit(e,ms,image);
    const c1=e.c1||fb(), c2=e.c2||dark(c1);
    setAccent(c1[0],c1[1],c1[2]); setAccent2(c2[0],c2[1],c2[2]);
  });
}
function hashColor(seed){
  const h = hashStr(seed);
  const r = 90 + (h % 120), g = 70 + ((h>>8) % 100), b = 170 + ((h>>16) % 80);
  return [clamp(r,40,235), clamp(g,40,235), clamp(b,40,235)];
}
function setAccent2(r,g,b){
  document.documentElement.style.setProperty("--amb2-r", r);
  document.documentElement.style.setProperty("--amb2-g", g);
  document.documentElement.style.setProperty("--amb2-b", b);
}
function setAccent(r,g,b){
  document.documentElement.style.setProperty("--accent-r", r);
  document.documentElement.style.setProperty("--accent-g", g);
  document.documentElement.style.setProperty("--accent-b", b);
}

/* ============================================================ FAVORITES / HISTORY / QUEUE ============================================================ */
const Favorites = {
  isSongFav(id){ return State.favSongs.some(s=>s.id===id); },
  toggleSong(track){ const i=State.favSongs.findIndex(s=>s.id===track.id); if(i>=0) State.favSongs.splice(i,1); else State.favSongs.unshift(track); Store.set("favSongs", State.favSongs); return i<0; },
  isAlbumFav(id){ return State.favAlbums.some(a=>a.id===id); },
  toggleAlbum(album){ const i=State.favAlbums.findIndex(a=>a.id===album.id); if(i>=0) State.favAlbums.splice(i,1); else State.favAlbums.unshift(album); Store.set("favAlbums", State.favAlbums); return i<0; },
  isArtistFav(id){ return State.favArtists.some(a=>a.id===id); },
  toggleArtist(artist){ const i=State.favArtists.findIndex(a=>a.id===artist.id); if(i>=0) State.favArtists.splice(i,1); else State.favArtists.unshift(artist); Store.set("favArtists", State.favArtists); return i<0; },
  isPlaylistFav(id){ return State.favPlaylists.some(a=>a.id===id); },
  togglePlaylist(pl){ const i=State.favPlaylists.findIndex(a=>a.id===pl.id); if(i>=0) State.favPlaylists.splice(i,1); else State.favPlaylists.unshift(pl); Store.set("favPlaylists", State.favPlaylists); return i<0; }
};
const History = {
  add(track){ State.history = State.history.filter(t=>t.id!==track.id); State.history.unshift(Object.assign({},track,{playedAt:Date.now()})); if(State.history.length>60) State.history.length=60; Store.set("history", State.history); },
  clear(){ State.history=[]; Store.set("history",[]); }
};
const Queue = {
  setQueue(tracks, startIndex){ State.queue = tracks.slice(); State.queueIndex = startIndex||0; if(State.shuffle) this.buildShuffleOrder(); this.persist(); },
  buildShuffleOrder(){ const idxs = State.queue.map((_,i)=>i).filter(i=>i!==State.queueIndex); State.shuffleOrder = shuffleArray(idxs); },
  addToQueue(track){ State.queue.push(track); if(State.shuffle) State.shuffleOrder.push(State.queue.length-1); this.persist(); toast("Added to queue"); },
  removeAt(i){ if(i===State.queueIndex){ toast("Can't remove currently playing track from here",'error'); return; } State.queue.splice(i,1); if(i<State.queueIndex) State.queueIndex--; State.shuffleOrder = State.shuffleOrder.filter(x=>x!==i).map(x=>x>i?x-1:x); this.persist(); },
  clear(){ const cur = State.queue[State.queueIndex]; State.queue = cur ? [cur] : []; State.queueIndex = cur ? 0 : -1; State.shuffleOrder = []; this.persist(); },
  persist(){ Store.set("queue", State.queue); Store.set("queueIndex", State.queueIndex); }
};

/* ============================================================
   SYSTEM MEDIA CONTROLS — LOCK SCREEN / NOTIFICATION / AOD
   Uses the browser Media Session API when supported. The OS decides
   whether controls appear on lock screen, notification shade, AOD or
   Dynamic Island; the page cannot force a Dynamic Island UI from HTML.
   ============================================================ */
const SystemMedia={
  supported:()=>('mediaSession' in navigator),
  artwork(track){
    const src=track&&(track.image||track.artwork||track.imageUrl); if(!src)return [];
    return [{src:String(src),sizes:'512x512',type:'image/jpeg'}];
  },
  update(track){
    if(!this.supported()||!track)return;
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:String(track.name||track.title||'Unknown'),
        artist:String(track.artistName||track.artist||'Booster OS'),
        album:String(track.albumName||track.album||'Booster OS'),
        artwork:this.artwork(track)
      });
    }catch(e){}
    try{ navigator.mediaSession.playbackState=State.isPlaying?'playing':'paused'; }catch(e){}
  },
  state(){
    if(!this.supported())return;
    try{navigator.mediaSession.playbackState=State.currentTrack?(State.isPlaying?'playing':'paused'):'none';}catch(e){}
  },
  /* defensive accessor: never throws, never returns a non-media value */
  el(){ try{ const el=primaryAudio(); return (el&&typeof el==='object')?el:null; }catch(e){ return null; } },
  position(){
    if(!this.supported()||!State.currentTrack)return;
    const el=this.el(); if(!el)return;
    const d=Number(el.duration),p=Number(el.currentTime);
    if(!Number.isFinite(d)||d<=0||!Number.isFinite(p))return;
    try{if('setPositionState' in navigator.mediaSession)navigator.mediaSession.setPositionState({duration:d,playbackRate:Number(el.playbackRate)>0?Number(el.playbackRate):1,position:clamp(p,0,d)});}catch(e){}
  },
  seekBy(delta){
    const el=this.el(); if(!el||!State.currentTrack)return;
    const cur=Number(el.currentTime); if(!Number.isFinite(cur))return;
    const d=Number(el.duration);
    Player.seekTo(clamp(cur+delta,0,(Number.isFinite(d)&&d>0)?d:Infinity));
  },
  init(){
    if(!this.supported())return;
    const self=this;
    /* every handler is wrapped: a missing track / element or a rejected promise can never surface as an uncaught error */
    const bind=(action,fn)=>{try{navigator.mediaSession.setActionHandler(action,function(d){try{const r=fn(d||{});if(r&&typeof r.catch==='function')r.catch(function(){});}catch(e){}});}catch(e){}};
    bind('play',()=>{if(State.currentTrack)Player.resume();});
    bind('pause',()=>{if(State.currentTrack)Player.pause();});
    bind('previoustrack',()=>{if(State.currentTrack)return Player.prev();});
    bind('nexttrack',()=>{if(State.currentTrack)return Player.next(false);});
    bind('seekbackward',d=>self.seekBy(-(Number(d.seekOffset)||10)));
    bind('seekforward',d=>self.seekBy(Number(d.seekOffset)||10));
    bind('seekto',d=>{if(!State.currentTrack||!Number.isFinite(Number(d.seekTime)))return;Player.seekTo(Number(d.seekTime));self.position();});
    bind('stop',()=>{if(State.currentTrack)Player.pause();});
  }
};

/* ============================================================
   AUDIO ENGINE — DUAL ELEMENT REAL CROSSFADE
   Automatic transitions only. Manual playback always hard-switches.
   ============================================================ */
const audioA = $("#audio-el");
const audioB = $("#audio-el-2");
const audios = [audioA, audioB];
let activeIdx = 0;
let crossfadeRAF = 0, crossfadeTimer = 0, crossfadeRunning = false, crossfadeGenId = 0, crossfadeTick = null;
/* v25: Worker-driven ticker. Page timers get throttled when the screen is off / app is in background;
   a dedicated worker keeps ticking, so the fade stays smooth and the next song is triggered on time. */
const BgTick=(function(){
  let w=null,subs=new Set(),tried=false;
  function start(){
    if(w||tried)return; tried=true;
    try{
      const url=URL.createObjectURL(new Blob(['var t=0;onmessage=function(e){if(e.data==="start"){if(!t)t=setInterval(function(){postMessage(1)},60);}else{clearInterval(t);t=0;}}'],{type:'text/javascript'}));
      w=new Worker(url); w.onmessage=function(){subs.forEach(function(f){try{f();}catch(e){}});};
      w.onerror=function(){w=null;};
    }catch(e){w=null;}
  }
  return{
    add(f){subs.add(f);start();if(w)try{w.postMessage("start");}catch(e){}return f;},
    remove(f){if(!f)return;subs.delete(f);if(!subs.size&&w)try{w.postMessage("stop");}catch(e){}}
  };
})();
let _cfLeadSec=2.5;
function cfLead(){return _cfLeadSec;}
function cfLeadUpdate(ms){_cfLeadSec=Math.max(1.5,Math.min(7,1.2+(ms/1000)*1.6));}
/* one trigger check, called from timeupdate AND from the background ticker */
function cfCheck(el){
  try{
    if(!el||el!==primaryAudio()||!State.currentTrack)return;
    if(!(State.settings.autoplayNext&&State.repeat!=="one"&&State.settings.crossfade&&State.settings.crossfadeDuration>0))return;
    if(!Number.isFinite(el.duration)||el.duration<=0||el.paused)return;
    const effective=effectiveCrossfadeDuration(State.currentTrack),remaining=el.duration-el.currentTime;
    if(State._crossfadeTrackId!==State.currentTrack.id){State._crossfadeTrackId=State.currentTrack.id;State._crossfadeTriggered=false;}
    if(!crossfadeRunning&&!State._crossfadeTriggered&&!State._autoTransitionInFlight&&effective>0&&remaining>0&&remaining<=effective+cfLead()){
      State._crossfadeTriggered=true;State._autoTransitionInFlight=true;
      Player.next(true).then(ok=>{if(!ok){State._autoTransitionInFlight=false;State._crossfadeTriggered=false;}}).catch(()=>{State._autoTransitionInFlight=false;State._crossfadeTriggered=false;});
    }
  }catch(e){}
}
BgTick.add(function(){cfCheck(primaryAudio());});
function primaryAudio(){ var y=window.__bosYT; return (y&&y.on&&y.fake)?y.fake:(audios[activeIdx]||audios[0]); }
function secondaryAudio(){ return audios[1-activeIdx]; }
audioA.volume = State.volume; audioB.volume = 0;
function bestAudioUrl(track){
  const pref=State.settings.audioQuality, order=QUALITY_ORDER;
  const startIdx=order.indexOf(pref)>=0?order.indexOf(pref):order.indexOf("160");
  for(let i=startIdx;i<order.length;i++) if(track.downloadUrl&&track.downloadUrl[order[i]]) return track.downloadUrl[order[i]];
  for(let i=startIdx;i>=0;i--) if(track.downloadUrl&&track.downloadUrl[order[i]]) return track.downloadUrl[order[i]];
  const vals=Object.values(track.downloadUrl||{}); return vals.length?vals[vals.length-1]:null;
}
function fadeStop(el){ if(!el)return; try{el.pause();}catch(e){} try{el.removeAttribute("src");el.load();}catch(e){} try{el.volume=0;}catch(e){} try{delete el.dataset.boosterTrackId;}catch(e){} }
const __warmed=new Set();
function warmOrigin(u){try{const o=new URL(u,location.href).origin;if(__warmed.has(o))return;__warmed.add(o);const l=document.createElement("link");l.rel="preconnect";l.href=o;l.crossOrigin="anonymous";document.head.appendChild(l);}catch(_){}}
async function loadAndPlay(el,track,startAt){
  const url=bestAudioUrl(track); if(!url)throw new Error("no-src");
  warmOrigin(url);
  try{el.pause();}catch(e){}
  el.dataset.boosterTrackId=String(track.id||"");
  el.src=url;
  try{el.load();}catch(e){}
  if(Number.isFinite(startAt)&&startAt>0){
    try{el.currentTime=startAt;}catch(e){}
  }
  await el.play();
}
function effectiveCrossfadeDuration(track){
  const configured=Math.max(0,Number(State.settings.crossfadeDuration)||0);
  if(!configured)return 0;
  const active=primaryAudio();
  const d=Number(active&&active.duration)||Number(track&&track.duration)||0;
  if(d>1)return Math.max(.35,Math.min(configured,d*.25));
  return Math.max(.35,configured);
}
function cancelCrossfade({restorePrimary=true}={}){
  crossfadeGenId++; if(crossfadeRAF){cancelAnimationFrame(crossfadeRAF);crossfadeRAF=0;} if(crossfadeTimer){clearInterval(crossfadeTimer);crossfadeTimer=0;} if(crossfadeTick){BgTick.remove(crossfadeTick);crossfadeTick=null;}
  const from=primaryAudio(),to=secondaryAudio();
  if(crossfadeRunning||to.src){try{to.pause();}catch(e){} try{to.removeAttribute("src");to.load();}catch(e){} try{to.volume=0;}catch(e){}}
  if(restorePrimary&&from)try{from.volume=State.volume;}catch(e){}
  crossfadeRunning=false; State._autoTransitionInFlight=false;
}
function finalizeCrossfadeIfRunning(){ cancelCrossfade({restorePrimary:true}); State._crossfadeTriggered=false; State._crossfadeTrackId=State.currentTrack?State.currentTrack.id:null; }
function runCrossfade(fromEl,toEl,durationSec,generation,completedTrackId){
  completedTrackId = completedTrackId || (fromEl && fromEl.dataset ? fromEl.dataset.boosterTrackId : null);
  const genId=generation||++crossfadeGenId; crossfadeGenId=genId; crossfadeRunning=true;
  if(completedTrackId){ Store.remove("pos_"+completedTrackId); State._lastSavedPos=0; }
  const start=performance.now();
  let dur=Math.max(.3,Number(durationSec)||0)*1000;
  /* never fade longer than what is left of the outgoing song (avoids a hard cut mid-fade) */
  try{ if(Number.isFinite(fromEl.duration)&&fromEl.duration>0){ const rem=(fromEl.duration-fromEl.currentTime-.15)*1000; dur=Math.max(300,Math.min(dur,rem)); } }catch(e){}
  function finish(){
    if(genId!==crossfadeGenId)return;
    if(crossfadeTimer){clearInterval(crossfadeTimer);crossfadeTimer=0;} if(crossfadeTick){BgTick.remove(crossfadeTick);crossfadeTick=null;}
    try{fromEl.pause();}catch(e){} try{fromEl.removeAttribute("src");fromEl.load();}catch(e){} try{fromEl.volume=0;}catch(e){} try{delete fromEl.dataset.boosterTrackId;}catch(e){}
    try{toEl.volume=State.volume;}catch(e){}
    crossfadeRunning=false; crossfadeRAF=0; State._autoTransitionInFlight=false;
  }
  function step(){
    if(genId!==crossfadeGenId||!crossfadeRunning)return;
    const t=clamp((performance.now()-start)/dur,0,1);
    /* equal-power curve: no loudness dip in the middle */
    try{fromEl.volume=clamp(State.volume*Math.cos(t*Math.PI/2),0,1);}catch(e){}
    try{toEl.volume=clamp(State.volume*Math.sin(t*Math.PI/2),0,1);}catch(e){}
    if(t>=1)finish();
  }
  step();
  crossfadeTick=BgTick.add(step);
  crossfadeTimer=setInterval(step,50); /* fallback if workers are unavailable */
  setTimeout(()=>{ if(genId===crossfadeGenId&&crossfadeRunning) finish(); },dur+1500);
}

/* ============================================================
   SMART RECOMMENDATION ENGINE — discovery radio
   Candidate-pool -> scoring -> greedy artist diversification.
   ============================================================ */
const SmartRadio=(()=>{
  const VERSION_WORDS=["official video","official audio","official","audio","video","lyrics","lyric","remix","remastered","reprise","cover","unplugged","lofi","lo-fi","slowed","reverb","slowed reverb","speed up","sped up","nightcore","acoustic","instrumental","karaoke","live","dj mix","extended","edit","version","mix","duet","female version","male version","mashup","8d","bass boosted"];
  const HOME_SEEDS=["Hindi Hits","Bollywood Hits","Indian Pop","Hindi Trending","Bollywood Party","Romantic Hindi","90s Bollywood","2000s Bollywood","Punjabi Hits","Indian Indie","New Hindi Songs","Top Hindi Songs","Evergreen Bollywood","Feel Good Hindi","Dance Hits","Chill Hindi","Indian Trending","Hindi Indie","Bollywood Classics","New Indian Songs","Indian Pop Hits","Hindi Chartbusters","Latest Indian Music"];
  const cleanText=v=>String(v||"").toLowerCase().replace(/&quot;|&#34;/g,'"').replace(/&amp;|&#38;/g,"&").replace(/[’']/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
  const primaryArtist=t=>cleanText(t&&t.artistName).split(",")[0].trim();
  const artistFamily=t=>primaryArtist(t)||cleanText(t&&t.artistName);
  function canonicalTitle(title){let s=cleanText(title).replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g," ");for(const w of VERSION_WORDS.slice().sort((a,b)=>b.length-a.length)){const re=new RegExp("(^|\\s)"+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?=\\s|$)","gi");s=s.replace(re," ");}return s.replace(/\s+/g," ").trim();}
  const familyKey=t=>t?canonicalTitle(t.name)+"||"+artistFamily(t):"";
  const songKey=t=>t?String(t.id||"")+"||"+familyKey(t):"";
  function recentArtistCounts(){const m=new Map();(State.history||[]).slice(0,32).forEach((t,i)=>{const a=artistFamily(t);if(a)m.set(a,(m.get(a)||0)+Math.max(1,32-i));});return m;}
  function sessionArtistCounts(){const m=new Map();(State.history||[]).forEach(t=>{const a=artistFamily(t);if(a)m.set(a,(m.get(a)||0)+1);});return m;}
  function recentFamilies(){return new Set((State.history||[]).slice(0,28).map(familyKey).filter(Boolean));}
  function queuedFamilies(excludeId){const m=new Set();(State.queue||[]).forEach(t=>{if(excludeId&&t&&t.id===excludeId)return;const k=familyKey(t);if(k)m.add(k);});return m;}
  function filterCandidates(list,opts={}){const cur=opts.current||State.currentTrack,recent=opts.allowRecent?new Set():recentFamilies(),queued=queuedFamilies(cur&&cur.id),ids=new Set(),fams=new Set(),out=[];for(const t of list||[]){if(!t||!t.id||ids.has(t.id))continue;ids.add(t.id);const fk=familyKey(t);if(!fk||fams.has(fk)||cur&&fk===familyKey(cur)||!opts.allowRecent&&recent.has(fk)||queued.has(fk))continue;fams.add(fk);out.push(t);}return out;}
  function score(t,current,meta,recentArtists,queueArtists,sessionCounts){let s=meta.base+Math.random()*7,a=artistFamily(t),ca=artistFamily(current);if(!a)s-=8;
 {const cl=cleanText(current&&current.language),tl=cleanText(t&&t.language);if(cl&&tl){if(cl===tl)s+=26;else s-=45;}
  const cy=Number(current&&current.year),ty=Number(t&&t.year);if(cy&&ty){const d=Math.abs(cy-ty);s+=d<=2?14:d<=5?7:d>=12?-10:0;}
  try{const bl=window.BoosterSmartLearning&&window.BoosterSmartLearning.model&&window.BoosterSmartLearning.model();
   if(bl){const nk=x=>String(x||'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
    const ak=nk(String(t.artistName||'').split(',')[0]),alk=nk(t.albumName);
    if((bl.blockedArtists&&bl.blockedArtists[ak])||(alk&&bl.blockedAlbums&&bl.blockedAlbums[alk])||(bl.blockedTracks&&Object.keys(bl.blockedTracks).some(k=>k.indexOf(String(t.id)+'||')===0)))s-=500;
    const am=bl.artists&&bl.artists[ak];if(am){s+=Math.min(20,(am.completes||0)*4);s-=Math.min(30,(am.skips||0)*8);}}}catch(_){}}
 if(a===ca)s-=22;else s+=22;if(!queueArtists.has(a))s+=15;else s-=28;s-=Math.min(34,(recentArtists.get(a)||0)/8);s-=Math.min(18,(sessionCounts.get(a)||0)*4);if(meta.source==="broad")s+=10;if(meta.source==="related")s+=12;if(meta.source==="title")s+=4;if(meta.source==="artist")s-=4;if(meta.source==="fresh")s+=10;if(meta.source==="trend")s+=8;if(t.year&&Number(t.year)>=new Date().getFullYear()-1)s+=6;if(t.duration>=150&&t.duration<=360)s+=2;return s;}
  async function searchSeed(seed,page=0,limit=24,signal){try{const r=await Api.searchSongs(seed,page,limit,signal);return(r.data&&Array.isArray(r.data.results)?r.data.results:[]).map(normalizeSong).filter(Boolean);}catch(e){return[];}}
  async function getCandidates(current,target=40){
    const seeds=[];
    if(current){const title=String(current.name||"").trim(),artist=String(current.artistName||"").split(",")[0].trim(),language=String(current.language||"").trim();if(title)seeds.push({q:title,source:"title",base:14});if(artist)seeds.push({q:artist+" similar artists",source:"related",base:18},{q:artist+" similar songs",source:"related",base:12},{q:artist+" songs",source:"artist",base:18});if(language)seeds.push({q:language+" trending songs",source:"trend",base:16});}
    (current&&current.language?[current.language+" hits",current.language+" romantic songs",current.language+" new songs"].concat(shuffleArray(HOME_SEEDS).slice(0,2)):shuffleArray(HOME_SEEDS).slice(0,10)).forEach(q=>seeds.push({q,source:/trend|top|chart/i.test(q)?"trend":/new|latest|fresh/i.test(q)?"fresh":"broad",base:/new|latest|fresh/i.test(q)?22:16}));
    if(!(current&&current.language))seeds.push({q:"Indian music discovery",source:"broad",base:20},{q:"Hindi new songs",source:"fresh",base:20},{q:"Indian trending music",source:"trend",base:20});
    const unique=[...new Map(seeds.map(x=>[cleanText(x.q),x])).values()];
    const batches=await Promise.all(unique.map((x,i)=>searchSeed(x.q,i%2,24).then(list=>({list,meta:x}))));
    const recent=recentFamilies(),queued=queuedFamilies(current&&current.id),recentArtists=recentArtistCounts(),sessionCounts=sessionArtistCounts();
    const queueArtists=new Set((State.queue||[]).slice(Math.max(0,State.queueIndex+1)).map(artistFamily).filter(Boolean));
    const ids=new Set(),fams=new Set(),scored=[];
    for(const batch of batches)for(const t of batch.list){if(!t||!t.id||ids.has(t.id))continue;ids.add(t.id);const fk=familyKey(t),a=artistFamily(t);if(!fk||fams.has(fk)||current&&fk===familyKey(current)||recent.has(fk)||queued.has(fk))continue;fams.add(fk);scored.push({t,score:score(t,current,batch.meta,recentArtists,queueArtists,sessionCounts)});}
    scored.sort((a,b)=>b.score-a.score);return scored;
  }
  function diversify(scored,current,target){
    const selected=[],families=new Set(),artists=new Map(),last=artistFamily(current),pool=scored.slice(),firstPhase=Math.min(target,8);
    while(selected.length<target&&pool.length){let bi=-1,best=-Infinity;for(let i=0;i<pool.length;i++){const {t}=pool[i],a=artistFamily(t),fk=familyKey(t),used=artists.get(a)||0;if(!fk||families.has(fk))continue;let d=0;if(a&&a!==last&&used===0)d+=85;if(a&&used===0)d+=35;if(a===last)d-=70;if(used>0)d-=26*used;if(selected.length<firstPhase&&used>0)d-=55;if(selected.length>=firstPhase&&used>0)d-=25;const v=pool[i].score+d;if(v>best){best=v;bi=i;}}if(bi<0)break;const {t}=pool.splice(bi,1)[0],a=artistFamily(t);selected.push(t);families.add(familyKey(t));if(a)artists.set(a,(artists.get(a)||0)+1);}return selected;
  }
  async function refill(minAhead=8){
    if(!State.currentTrack||State.currentTrack.source==="youtube"||State.smartQueueBusy)return false;const ahead=Math.max(0,State.queue.length-(State.queueIndex+1));if(ahead>=minAhead)return true;const token=++State.smartRadioRefillToken;State.smartQueueBusy=true;
    try{const needed=Math.max(12,24-ahead),scored=await getCandidates(State.currentTrack,Math.max(36,needed+12));if(token!==State.smartRadioRefillToken)return false;const selected=diversify(scored,State.currentTrack,needed),ids=new Set(State.queue.map(t=>t&&t.id)),fams=new Set(State.queue.map(familyKey)),fresh=selected.filter(t=>{const fk=familyKey(t);if(!t||!t.id||ids.has(t.id)||fams.has(fk))return false;ids.add(t.id);fams.add(fk);return true;});if(fresh.length){const start=State.queue.length;State.queue.push(...fresh);if(State.shuffle)for(let i=start;i<State.queue.length;i++)if(!State.shuffleOrder.includes(i))State.shuffleOrder.push(i);Queue.persist();renderQueuePanel();}return fresh.length>0;}catch(e){return false;}finally{if(token===State.smartRadioRefillToken)State.smartQueueBusy=false;}
  }
  function prepareInitialQueue(track,contextList){const source=(contextList||[]).filter(Boolean),cur=familyKey(track),recent=recentFamilies(),seen=new Set([cur]),clean=[track],artists=new Set([artistFamily(track)]);for(const t of shuffleArray(source)){const fk=familyKey(t),a=artistFamily(t);if(!t||!t.id||!fk||seen.has(fk)||recent.has(fk))continue;if(clean.length<9&&artists.has(a))continue;seen.add(fk);clean.push(t);if(a)artists.add(a);}return clean;}
  function onTrackStarted(track){State.smartQueueSeed=familyKey(track);setTimeout(()=>refill(8),0);}
  async function nextSmart(expectedToken){if(!State.currentTrack)return false;if(expectedToken!=null&&expectedToken!==Player._playToken)return false;const ahead=Math.max(0,State.queue.length-(State.queueIndex+1));if(ahead<1)await refill(1);let ni=State.queueIndex+1;if(State.shuffle){if(!State.shuffleOrder.length)Queue.buildShuffleOrder();ni=State.shuffleOrder.shift();if(ni===undefined){await refill(1);ni=State.shuffleOrder.shift();}}if(ni==null||ni<0||ni>=State.queue.length)return false;if(expectedToken!=null&&expectedToken!==Player._playToken)return false;State.queueIndex=ni;Queue.persist();const ok=await Player.play(State.queue[ni],null,null,{autoTransition:true});setTimeout(()=>refill(8),0);return ok;}
  async function homeSections(signal){const current=State.currentTrack,all=shuffleArray(HOME_SEEDS),groups=[all.slice(0,4),all.slice(4,8),all.slice(8,12)],results=await Promise.all(groups.map(g=>Promise.all(g.map(q=>searchSeed(q,Math.floor(Math.random()*2),12,signal))))),flatten=a=>a.flat(),avoid=new Set((State.history||[]).slice(0,24).map(familyKey)),cf=current?familyKey(current):"";const build=(raw,count)=>{const seen=new Set(),pool=[];for(const t of shuffleArray(raw)){const fk=familyKey(t);if(!t||!t.id||!fk||seen.has(fk)||cf&&fk===cf||avoid.has(fk))continue;seen.add(fk);pool.push(t);if(pool.length>=count)break;}if(pool.length<count)for(const t of shuffleArray(raw)){const fk=familyKey(t);if(!t||!t.id||!fk||seen.has(fk)||cf&&fk===cf)continue;seen.add(fk);pool.push(t);if(pool.length>=count)break;}return pool;};return{trending:build(flatten(results[0]),12),fresh:build(flatten(results[1]),12),madeForYou:build(flatten(results[2]),12)};}
  return{familyKey,canonicalTitle,filterCandidates,prepareInitialQueue,refill,onTrackStarted,nextSmart,homeSections};
})();

const Player={
  _playToken:0,_nextInFlight:false,
  async play(track,contextList,index,opts){
    opts=opts||{};if(!track)return false;if(track.source==="youtube"){if(window.BosYT&&window.BosYT.playTrack){State.smartRadioRefillToken++;this._playToken++;this._nextInFlight=false;return window.BosYT.playTrack(track,contextList,index,opts);}if(!opts.autoTransition)toast("BOOSTER + is still loading, try again.","error");return false;}if(contextList)contextList=contextList.filter(t=>t&&t.source!=="youtube");try{if(window.__bosYT&&window.__bosYT.on&&window.__bosYT.off)window.__bosYT.off();}catch(_){}const isAuto=opts.autoTransition===true;
    if(!isAuto){State.smartRadioRefillToken++;finalizeCrossfadeIfRunning();this._nextInFlight=false;}else if(!State.settings.autoplayNext||State.repeat==="one")return false;
    const myToken=++this._playToken;
    if(!bestAudioUrl(track)){if(!isAuto)toast("This track has no playable audio source.","error");return false;}
    const cur=primaryAudio(),hasActive=!!(cur&&cur.src&&State.currentTrack),same=!!(State.currentTrack&&State.currentTrack.id===track.id);
    const outgoingTrackId = hasActive && !same && State.currentTrack ? State.currentTrack.id : null;
    const canCF=isAuto&&hasActive&&!same&&State.settings.crossfade&&State.settings.crossfadeDuration>0&&!cur.paused&&!crossfadeRunning;
    State.currentTrack=track;State._crossfadeTrackId=track.id;State._crossfadeTriggered=false;State._autoTransitionInFlight=isAuto&&canCF;
    const currentEl=primaryAudio();
    const replayingFinishedTrack = same && (!currentEl || currentEl.ended || (Number.isFinite(currentEl.duration) && currentEl.duration > 0 && currentEl.currentTime >= currentEl.duration - 1));
    const saved=replayingFinishedTrack ? 0 : (opts.startAt!=null?opts.startAt:(State.settings.rememberPosition?Number(Store.get("pos_"+track.id,0)):0));
    if(replayingFinishedTrack) Store.remove("pos_"+track.id);
    const startAt=Number.isFinite(saved)&&saved>2&&saved<Math.max(0,(track.duration||0)-3)?saved:0;
    /* FAST START: kick the audio off BEFORE the heavy queue/UI work, so a tap starts sound immediately */
    const _fastP=canCF?null:this._hardSwitch(track,startAt,myToken);
    if(contextList){Queue.setQueue(SmartRadio.prepareInitialQueue(track,contextList),0);State.smartRadioActive=false;}else if(isAuto)State.smartRadioActive=true;
    History.add(track);renderMiniPlayer();renderFullPlayer();renderQueuePanel();Store.set("lastSong",track);SystemMedia.update(track);Lyrics.loadFor(track);SmartRadio.onTrackStarted(track);
    if(canCF){const from=cur,to=secondaryAudio(),duration=effectiveCrossfadeDuration(State.currentTrack),generation=++crossfadeGenId;updateAmbient(track,duration);try{to.volume=0;const _t0=performance.now();await loadAndPlay(to,track,startAt);cfLeadUpdate(performance.now()-_t0);}catch(err){if(myToken!==this._playToken){fadeStop(to);return false;}State._autoTransitionInFlight=false;updateAmbient(track);return this._hardSwitch(track,startAt,myToken);}if(myToken!==this._playToken||generation!==crossfadeGenId){fadeStop(to);return false;}activeIdx=1-activeIdx;State.isPlaying=true;updatePlayIcons();SystemMedia.state();document.body.classList.toggle("playing-anim",State.settings.animatedArtwork);runCrossfade(from,to,duration,generation,outgoingTrackId);return true;}
    updateAmbient(track);return _fastP||this._hardSwitch(track,startAt,myToken);
  },
  async _hardSwitch(track,startAt,myToken){const el=primaryAudio(),other=secondaryAudio();fadeStop(other);try{el.volume=State.volume;await loadAndPlay(el,track,startAt);if(myToken!==this._playToken)return false;State.isPlaying=true;State._autoTransitionInFlight=false;SystemMedia.state();}catch(err){if(myToken!==this._playToken)return false;State.isPlaying=false;State._autoTransitionInFlight=false;SystemMedia.state();toast("Playback couldn't start automatically. Tap play.","error");return false;}updatePlayIcons();document.body.classList.toggle("playing-anim",State.isPlaying&&State.settings.animatedArtwork);return true;},
  resume(){
    if(!State.currentTrack)return;
    if(State.currentTrack.source==="youtube"&&window.BosYT){window.BosYT.resume();return;}
    // If the user resumes during a transition, finish the transition deterministically.
    if(crossfadeRunning){ finalizeCrossfadeIfRunning(); }
    const el=primaryAudio();
    el.play().then(()=>{State.isPlaying=true;updatePlayIcons();SystemMedia.state();}).catch(()=>{});
  },
  pause(){
    if(State.currentTrack&&State.currentTrack.source==="youtube"&&window.BosYT){window.BosYT.pause();return;}
    // Never ignore a user pause during crossfade. Stop both elements and preserve the
    // currently audible track as the active source.
    if(crossfadeRunning){
      const from=primaryAudio(), to=secondaryAudio();
      const fromLevel=Number(from.volume)||0, toLevel=Number(to.volume)||0;
      if(toLevel>fromLevel){ activeIdx=1-activeIdx; try{from.pause();}catch(e){} }
      else { try{to.pause();}catch(e){} }
      cancelCrossfade({restorePrimary:true});
    }
    const el=primaryAudio();try{el.pause();}catch(e){}
    State.isPlaying=false;updatePlayIcons();SystemMedia.state();
  },
  toggle(){if(!State.currentTrack)return;if(State.currentTrack.source==="youtube"&&window.BosYT){window.BosYT.toggle();return;}const el=primaryAudio();if(crossfadeRunning||el.paused)this.resume();else this.pause();SystemMedia.position();document.body.classList.toggle("playing-anim",State.isPlaying&&State.settings.animatedArtwork);},
  seekTo(sec){const el=primaryAudio();if(!el)return;sec=Number(sec);if(!Number.isFinite(sec))return;const d=Number(el.duration);/* NaN duration used to clamp every seek to 0 */try{el.currentTime=clamp(sec,0,(Number.isFinite(d)&&d>0)?d:Infinity);}catch(e){return;}updateActiveLyric(el.currentTime,true);SystemMedia.position();},
  setVolume(v){v=clamp(Number(v)||0,0,1);const old=Math.max(.0001,State.volume||1);State.volume=v;persistVolumeDebounced(v);
    const yt=window.__bosYT,ytOn=!!(yt&&yt.on);
    if(crossfadeRunning){audios.forEach(a=>{try{a.volume=clamp((a.volume/old)*v,0,1);}catch(e){}});}
    else if(ytOn){/* YouTube is primary: keep the idle local deck at the shared level too, so YouTube -> local never jumps */try{audios[activeIdx].volume=v;audios[1-activeIdx].volume=0;}catch(e){}}
    else{primaryAudio().volume=v;secondaryAudio().volume=0;}
    /* State.volume is the single source of truth: push it to the YouTube engine as well (the fake-element setter never calls back into Player, so there is no update loop) */
    try{if(yt&&yt.fake)yt.fake.volume=v;}catch(e){}
  },
  setMuted(m){m=!!m;State.muted=m;audios.forEach(a=>{try{a.muted=m;}catch(e){}});try{const yt=window.__bosYT;if(yt&&yt.fake)yt.fake.muted=m;}catch(e){}this._paintMute();return m;},
  toggleMute(){return this.setMuted(!State.muted);},
  _paintMute(){try{const sl=document.getElementById("volume-slider"),ic=sl&&sl.previousElementSibling;if(!ic||String(ic.tagName).toLowerCase()!=="svg")return;ic.style.opacity=State.muted?".4":"";ic.setAttribute("aria-pressed",State.muted?"true":"false");let x=ic.querySelector(".bos-mute-x");if(State.muted&&!x){x=document.createElementNS("http://www.w3.org/2000/svg","path");x.setAttribute("class","bos-mute-x");x.setAttribute("d","M22 9l-6 6M16 9l6 6");ic.appendChild(x);}else if(!State.muted&&x)x.remove();}catch(e){}},
  async next(auto){
    auto=auto===true;
    if(State.currentTrack&&State.currentTrack.source==="youtube"&&window.BosYT)return window.BosYT.next(auto);
    if(this._nextInFlight)return false;
    if(auto&&this._autoTransitionInFlight&&crossfadeRunning)return false;
    const transitionToken=this._playToken;
    this._nextInFlight=true;
    try{
      if(!State.queue.length){
        if(auto&&State.settings.autoplayNext){
          const ok=await SmartRadio.nextSmart(transitionToken);
          return transitionToken===this._playToken&&ok;
        }
        return false;
      }
      let ni=-1;
      if(State.shuffle){if(!State.shuffleOrder.length)Queue.buildShuffleOrder();ni=State.shuffleOrder.shift();}
      else ni=State.queueIndex+1;
      if(ni<0||ni>=State.queue.length){
        if(State.repeat==="all"&&State.queue.length)ni=0;
        else if(auto&&State.settings.autoplayNext){
          const ok=await SmartRadio.nextSmart(transitionToken);
          return transitionToken===this._playToken&&ok;
        }else return false;
      }
      let t=State.queue[ni];
      // Auto-next diversity guard: prefer a different artist/family when the
      // immediate candidate is a repeat/variant and another queued candidate exists.
      if(auto&&t){
        const normAuto=v=>String(v||"").toLowerCase().replace(/\([^)]*\)|\[[^]]*\]|\{[^}]*\}/g," " ).replace(/\b(official|audio|video|lyrics?|remix|remastered|reprise|cover|unplugged|lofi|lo-fi|slowed|reverb|live|edit|mix|duet|version|acoustic|instrumental|karaoke|extended)\b/g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim();
        const artistAuto=x=>normAuto(x&&x.artistName).split(",")[0].trim();
        const familyAuto=x=>artistAuto(x)+"||"+normAuto(x&&x.name);
        const cur=State.currentTrack, curA=artistAuto(cur), curF=familyAuto(cur), candF=familyAuto(t);
        if((artistAuto(t)===curA||candF===curF)){
          for(let j=ni+1;j<State.queue.length;j++){
            const alt=State.queue[j];
            if(alt&&artistAuto(alt)!==curA&&familyAuto(alt)!==curF){ ni=j; t=alt; break; }
          }
        }
      }
      if(!t)return false;
      if(auto&&transitionToken!==this._playToken)return false;
      State.queueIndex=ni;Queue.persist();
      const ok=await this.play(t,null,null,{autoTransition:auto});
      if(ok)setTimeout(()=>SmartRadio.refill(8),0);
      return ok;
    }finally{this._nextInFlight=false;}
  },
  prev(){if(State.currentTrack&&State.currentTrack.source==="youtube"&&window.BosYT)return window.BosYT.prev();if(!State.queue.length)return;finalizeCrossfadeIfRunning();const el=primaryAudio();if(el.currentTime>4){el.currentTime=0;return;}let pi=State.queueIndex-1;if(pi<0){if(State.repeat==="all")pi=State.queue.length-1;else{el.currentTime=0;return;}}State.queueIndex=pi;Queue.persist();this.play(State.queue[pi],null,null,{autoTransition:false});},
  toggleShuffle(){State.shuffle=!State.shuffle;if(State.settings.rememberPlayerState!==false)Store.set("shuffle",State.shuffle);if(State.shuffle)Queue.buildShuffleOrder();renderShuffleRepeatIcons();},
  cycleRepeat(){State.repeat=State.repeat==="off"?"all":State.repeat==="all"?"one":"off";if(State.settings.rememberPlayerState!==false)Store.set("repeat",State.repeat);renderShuffleRepeatIcons();},
  setCrossfadeDuration(sec){sec=clamp(Math.round(sec),0,30);State.settings.crossfadeDuration=sec;State.settings.crossfade=sec>0;if(sec===0)finalizeCrossfadeIfRunning();saveSettings();}
};

function forceAutoNext(reason){
  if(!State.currentTrack||State.repeat==="one")return;
  if(Player._nextInFlight)return;
  State._autoTransitionInFlight=false;
  State._crossfadeTriggered=false;
  Player.next(true).catch(()=>{});
}

// Bounded playback-error recovery prevents a broken API URL from creating an endless
// auto-next loop. Failed track ids are remembered only for this page session.
const failedTrackIds = new Set();
let consecutivePlaybackErrors = 0;
function resetPlaybackErrorGuard(){ consecutivePlaybackErrors=0; }
const PG={m:null,s:null,h:null,t:null,p:-1,sec:-1};
function paintProgress(el){
  const pct=clamp(el.currentTime/el.duration*100,0,100);
  if(document.hidden||window.__bosSeekDragging) return;   /* don't fight the thumb while the seek bar is being dragged */
  if(!PG.m||!PG.m.isConnected){PG.m=$("#mini-progress-fill");PG.s=$("#seek-fill");PG.h=$("#seek-handle");PG.t=$("#time-current");PG.p=-1;PG.sec=-1;}
  if(Math.abs(pct-PG.p)>=0.05){PG.p=pct;const w=pct.toFixed(2)+"%";PG.m.style.width=w;PG.s.style.width=w;PG.h.style.left=w;}
  const sec=Math.floor(el.currentTime);
  if(sec!==PG.sec){PG.sec=sec;PG.t.textContent=fmtTime(el.currentTime);}
}
function bindAudioEvents(el){
  el.addEventListener("timeupdate",()=>{
    if(el!==primaryAudio()||!el.duration)return;paintProgress(el);
    cfCheck(el);
    updateActiveLyric(el.currentTime,false);SystemMedia.position();
    if(State.currentTrack&&State.settings.rememberPosition&&Math.abs(el.currentTime-(State._lastSavedPos||0))>=5){State._lastSavedPos=el.currentTime;Store.set("pos_"+State.currentTrack.id,el.currentTime);}
  });
  el.addEventListener("loadedmetadata",()=>{if(el===primaryAudio())$("#time-total").textContent=fmtTime(el.duration);});
  el.addEventListener("play",()=>{if(el!==primaryAudio())return;resetPlaybackErrorGuard();State.isPlaying=true;SystemMedia.state();updatePlayIcons();document.body.classList.toggle("playing-anim",State.settings.animatedArtwork);});
  el.addEventListener("pause",()=>{if(el!==primaryAudio())return;if(!crossfadeRunning)State.isPlaying=false;SystemMedia.state();updatePlayIcons();document.body.classList.toggle("playing-anim",State.isPlaying&&State.settings.animatedArtwork);});
  el.addEventListener("ended",()=>{if(el!==primaryAudio())return;
    if(State.currentTrack&&State.currentTrack.id){ Store.remove("pos_"+State.currentTrack.id); State._lastSavedPos=0; }
    if(State.repeat==="one"){State._crossfadeTriggered=false;State._autoTransitionInFlight=false;el.currentTime=0;el.play().catch(()=>{});return;}
    // `ended` is the final safety net. Clear stale crossfade locks before advancing.
    if(crossfadeRunning){cancelCrossfade({restorePrimary:false});}
    if(State.settings.autoplayNext){forceAutoNext("ended");}
  });
  el.addEventListener("error",()=>{
    if(el!==primaryAudio())return;
    if(!el.getAttribute("src")||(el.error&&el.error.code===1))return; // empty/aborted load is not a real failure
    const id=State.currentTrack&&State.currentTrack.id;
    if(el.dataset.boosterTrackId&&id&&String(el.dataset.boosterTrackId)!==String(id))return; // stale element
    if(id) failedTrackIds.add(String(id));
    consecutivePlaybackErrors++;
    if(consecutivePlaybackErrors>=5){
      State._autoTransitionInFlight=false; State._crossfadeTriggered=false; State.isPlaying=false;
      updatePlayIcons(); SystemMedia.state();
      toast("Several tracks failed to load. Please choose another song.","error");
      return;
    }
    toast("This track failed to play. Skipping to next.","error");
    setTimeout(()=>{
      if(State.currentTrack&&!Player._nextInFlight){
        if(crossfadeRunning) cancelCrossfade({restorePrimary:false});
        State._crossfadeTriggered=true;State._autoTransitionInFlight=true;
        Player.next(true).then(ok=>{if(!ok){State._autoTransitionInFlight=false;State._crossfadeTriggered=false;}})
          .catch(()=>{State._autoTransitionInFlight=false;State._crossfadeTriggered=false;});
      }
    },700);
  });
}
bindAudioEvents(audioA);bindAudioEvents(audioB);
SystemMedia.init();
// Save the exact latest position when the page/tab is hidden instead of relying only
// on the 5-second timeupdate checkpoint.
function savePlaybackPositionNow(){
  try{const el=primaryAudio(), t=State.currentTrack;if(!t||!State.settings.rememberPosition||!el)return;const p=Number(el.currentTime)||0;if(p>2&&(!Number.isFinite(el.duration)||p<(el.duration-2)))Store.set("pos_"+t.id,p);}catch(e){}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")savePlaybackPositionNow();});
window.addEventListener("pagehide",savePlaybackPositionNow);

function updatePlayIcons(){
  $("#mini-play-icon").outerHTML = State.isPlaying ? svgPauseTagged("mini-play-icon") : svgPlayTagged("mini-play-icon");
  $("#fp-play-icon").outerHTML = State.isPlaying ? svgPauseTagged("fp-play-icon") : svgPlayTagged("fp-play-icon");
}
function svgPlayTagged(id){return '<svg viewBox="0 0 24 24" fill="currentColor" id="'+id+'"><path d="M8 5v14l11-7z"/></svg>';}
function svgPauseTagged(id){return '<svg viewBox="0 0 24 24" fill="currentColor" id="'+id+'"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';}
function renderShuffleRepeatIcons(){
  $("#fp-shuffle").classList.toggle("on", State.shuffle);
  const rBtn = $("#fp-repeat");
  rBtn.classList.toggle("on", State.repeat!=="off");
  rBtn.innerHTML = State.repeat==="one"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="10.5" y="15" font-size="8" fill="currentColor" stroke="none">1</text></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
}

/* ============================================================ LYRICS ENGINE v4 — multi-source fetch, word-sync, smart cache ============================================================ */
const LYRICS_CACHE_PREFIX = "booster_lyrics_v4_";
const lyricsMemoryCache = new Map();
const lyricsAbort = { ctrl: null };
let lyricsIDB = null;
function lyricsCacheKey(track){
  const t = lyricsNorm(lyStrip(track.name || track.title || ""));
  const a = lyricsNorm(String(track.artistName || track.artist || "").split(",")[0]);
  return t + "||" + a + "||" + Math.round((Number(track.duration) || 0) / 5);
}
function lyricsLSGet(key){ try{ const raw = localStorage.getItem(LYRICS_CACHE_PREFIX+key); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function lyricsLSSet(key,val){ try{ localStorage.setItem(LYRICS_CACHE_PREFIX+key, JSON.stringify(val)); }catch(e){} }
function openLyricsIDB(){
  if(lyricsIDB) return Promise.resolve(lyricsIDB);
  return new Promise(res=>{
    try{
      if(!window.indexedDB) return res(null);
      const req = indexedDB.open("booster_lyrics_db_v4", 1);
      req.onupgradeneeded = ()=>{ req.result.createObjectStore("lyrics", {keyPath:"key"}); };
      req.onsuccess = ()=>{ lyricsIDB = req.result; res(lyricsIDB); };
      req.onerror = ()=>res(null);
    }catch(e){ res(null); }
  });
}
async function lyricsIDBGet(key){
  const db = await openLyricsIDB(); if(!db) return null;
  return new Promise(res=>{ try{ const q=db.transaction("lyrics","readonly").objectStore("lyrics").get(key); q.onsuccess=()=>res(q.result&&q.result.data||null); q.onerror=()=>res(null); }catch(e){ res(null); } });
}
async function lyricsIDBSet(key,data){ const db = await openLyricsIDB(); if(!db) return; try{ db.transaction("lyrics","readwrite").objectStore("lyrics").put({key,data,ts:Date.now()}); }catch(e){} }
async function getCachedLyrics(key){
  const c = lyricsMemoryCache.get(key) || lyricsLSGet(key) || await lyricsIDBGet(key) || null;
  if(!c) return null;
  if(c.empty && Date.now()-(c.ts||0) > 10800000) return null;   /* "not found" is remembered for 3h only */
  lyricsMemoryCache.set(key,c); return c;
}
function setCachedLyrics(key,data){ lyricsMemoryCache.set(key,data); lyricsLSSet(key,data); lyricsIDBSet(key,data); }

/* LRC parser — plain [mm:ss.xx] lines AND Enhanced-LRC word tags <mm:ss.xx> (word / syllable level) */
function parseLRC(lrc){
  const out=[];
  const T=(m,s,f)=>(+m)*60+(+s)+(f?Number("0."+f):0);
  const stampRe=/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const tagSplit=/(<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>)/;
  const tagOne=/^<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>$/;
  String(lrc||"").split(/\r?\n/).forEach(raw=>{
    const stamps=[];
    const body=raw.replace(stampRe,(f,m,s,fr)=>{ stamps.push(T(m,s,fr)); return ""; });
    if(!stamps.length) return;
    let words=null, text="";
    if(tagSplit.test(body)){
      const ws=[]; let t0=null, prevTrail=true;
      for(const sg of body.split(tagSplit)){
        const mt=sg.match(tagOne);
        if(mt){ t0=T(mt[1],mt[2],mt[3]); continue; }
        if(!sg.trim()){ if(ws.length) prevTrail=true; continue; }
        const lead=/^\s/.test(sg), trail=/\s$/.test(sg);
        sg.trim().split(/\s+/).forEach((p,i)=>{
          if(i===0 && ws.length && !lead && !prevTrail) ws[ws.length-1].text+=p;
          else ws.push({t:t0==null?stamps[0]:t0,text:p});
        });
        prevTrail=trail;
      }
      if(ws.length){ words=ws; text=ws.map(w=>w.text).join(" "); }
    }
    if(!words) text=body.replace(/<\d{1,3}:\d{2}[^>]*>/g,"").replace(/\s+/g," ").trim();
    if(!text) return;
    stamps.forEach(st=>{
      const L={time:st,text};
      if(words){ const dt=st-stamps[0]; L.words=words.map(w=>({t:w.t+dt,text:w.text})); L.real=true; }
      out.push(L);
    });
  });
  return out.sort((a,b)=>a.time-b.time);
}
/* Every line gets per-word start times: real ones when the source has them, otherwise length-weighted inside the line */
function lyricsPrepareWords(lines){
  for(let i=0;i<lines.length;i++){
    const L=lines[i]; if(L._wt) continue;
    if(L.words&&L.words.length){ L._wt=L.words.map(w=>w.t); L.real=true; continue; }
    const ws=String(L.text||"").split(/\s+/).filter(Boolean);
    if(!ws.length){ L._wt=[]; continue; }
    const nxt=lines[i+1]?lines[i+1].time:L.time+4;
    const span=Math.max(.5,Math.min(nxt-L.time-.12,Math.max(1.2,ws.length*.55)));
    const wt=ws.map(w=>Math.max(1.5,w.length)); const tot=wt.reduce((a,b)=>a+b,0);
    let acc=0; L._wt=wt.map(x=>{ const t=L.time+span*acc/tot; acc+=x; return t; });
  }
  return lines;
}
function escapeHTML(value){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function lyStrip(s){return String(s||"").replace(/\s*[\(\[]\s*(from|feat\.?|ft\.?|with)\b[^\)\]]*[\)\]]/gi,"").replace(/\s+-\s+(from|feat\.?|ft\.?)\b.*$/i,"").replace(/\s+/g," ").trim();}
function lyDurOK(h,track){const d=Number(track&&track.duration)||0,hd=Number(h&&h.duration)||0;if(!d||!hd)return true;return Math.abs(d-hd)<=5;}
/* ============================================================
   BOOSTER OS — ADDITIVE EXPANDED LYRICS FALLBACK ENGINE
   Keeps the original lyrics fetch/parser/renderer intact.
   Adds better matching, extra plain-lyrics fallback, and
   estimated line-by-line timing for unsynced lyrics.
   ============================================================ */
function lyricsNorm(s){
  return String(s||"").toLowerCase()
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/\b(feat\.?|ft\.?|featuring)\b[^\-–—|]*/gi,"")
    .replace(/\[(official|audio|video|lyrics?|remaster(ed)?|live|remix|version|edit|mix)[^\]]*\]/gi,"")
    .replace(/\((official|audio|video|lyrics?|remaster(ed)?|live|remix|version|edit|mix)[^\)]*\)/gi,"")
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .replace(/\s+/g," ").trim();
}
function lyricsWords(s){ return lyricsNorm(s).split(/\s+/).filter(Boolean); }
function lyricsSimilarity(a,b){
  const A=lyricsNorm(a), B=lyricsNorm(b); if(!A||!B) return 0;
  if(A===B) return 1;
  const aw=lyricsWords(A), bw=lyricsWords(B), bs=new Set(bw);
  let common=0; aw.forEach(w=>{if(bs.has(w)) common++;});
  return common/Math.max(aw.length,bw.length);
}
function lyricsCleanLines(text){
  return String(text||"").replace(/\r/g,"").split("\n")
    .map(x=>x.replace(/\uFEFF/g,"").trim())
    .filter(x=>x && !/^\s*[\[\(]?(instrumental|music|intro|outro)[\]\)]?\s*$/i.test(x));
}
function estimatePlainLyrics(lines, duration){
  lines = lyricsCleanLines(lines.join ? lines.join("\n") : lines);
  duration = Number(duration)||0;
  if(!lines.length) return [];
  if(duration < 8) duration = Math.max(8, lines.length*2.4);

  /*
     Subtitle-Tools-style model:
     - every lyric line gets its own explicit timestamp;
     - timing is monotonic and editable/seekable line-by-line;
     - short lines get less time, long lines get more;
     - sentence endings create breathing room;
     - the whole result is clamped to the real recording duration.

     IMPORTANT: plain lyrics contain no authoritative timestamps. This is an
     estimated alignment, never a claim of word-accurate vocal timing.
  */
  const intro = Math.min(8.5, Math.max(1.7, duration*0.075));
  const outro = Math.min(5.5, Math.max(0.7, duration*0.032));
  const usable = Math.max(3, duration-intro-outro);

  const weights = lines.map((text,i)=>{
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.replace(/\s+/g,"").length;
    const punct = (text.match(/[,!?;:]/g)||[]).length;
    const sentenceEnd = /[.!?…]$/.test(text) ? 1.16 : 1;
    const shortPenalty = words<=2 ? .58 : words<=4 ? .82 : words<=7 ? 1 : 1.12;
    const longPenalty = chars>70 ? .94 : 1;
    const pause = Math.min(.42, punct*.055);
    const lead = i===0 ? .92 : 1;
    return Math.max(.62, ((words*.80)+(chars*.020)+pause)*shortPenalty*sentenceEnd*longPenalty*lead);
  });

  const total=weights.reduce((a,b)=>a+b,0)||1;
  const starts=[];
  let cursor=intro;
  for(let i=0;i<lines.length;i++){
    starts.push({time:cursor,text:lines[i]});
    const share=usable*(weights[i]/total);
    const sentencePause=/[.!?…]$/.test(lines[i]) ? Math.min(.55, usable*.006) : 0;
    cursor += share + sentencePause;
  }

  const maxStart=Math.max(intro, duration-outro-.75);
  if(starts.length>1 && starts.at(-1).time>maxStart){
    const denom=starts.at(-1).time-intro;
    const scale=(maxStart-intro)/Math.max(.001,denom);
    starts.forEach(x=>{x.time=intro+(x.time-intro)*Math.max(.72,Math.min(1,scale));});
  }
  return starts.map(x=>({time:Number(x.time.toFixed(3)),text:x.text}));
}

/* Second-pass timing refinement inspired by a timed-lyrics editor.
   We use the browser audio clock and detected quiet sections to avoid making
   a plain-lyrics line jump during an instrumental break. This does not pretend
   to identify individual sung words; it only refines line boundaries. */
function refineEstimatedTimeline(lines, duration){
  if(!Array.isArray(lines)||lines.length<2) return lines||[];
  duration=Number(duration)||0;
  if(duration<8) return lines;
  const out=lines.map(x=>({time:Number(x.time)||0,text:String(x.text||'')}));
  const intro=Math.max(0,out[0].time);
  const end=Math.min(duration, Math.max(out.at(-1).time+0.5,duration-0.5));
  const span=Math.max(1,end-intro);
  /* Keep the explicit per-line timestamps but enforce a minimum readable gap.
     This prevents the renderer from flipping two lines almost simultaneously. */
  const minGap=Math.min(.72,Math.max(.42,span/(out.length*2.8)));
  for(let i=1;i<out.length;i++){
    if(out[i].time<out[i-1].time+minGap) out[i].time=out[i-1].time+minGap;
  }
  if(out.at(-1).time>end){
    const factor=(end-intro)/Math.max(.001,out.at(-1).time-intro);
    out.forEach((x,i)=>{x.time=intro+(x.time-intro)*Math.max(.78,Math.min(1,factor));});
  }
  return out.map(x=>({time:Number(x.time.toFixed(3)),text:x.text}));
}

function lyricsTrackDuration(track){
  const d=Number(track&&track.duration)||Number(primaryAudio()&&primaryAudio().duration)||0;
  return Number.isFinite(d)?d:0;
}
/* ============================================================ LYRICS PROVIDERS — add a new source = one function in LYRICS_PROVIDERS ============================================================ */
async function lyJSON(url,signal,ms,retry){
  for(let attempt=0; attempt<=(retry?1:0); attempt++){
    const c=new AbortController(), to=setTimeout(()=>c.abort(),ms||7000), on=()=>c.abort();
    if(signal){ if(signal.aborted){ clearTimeout(to); throw {name:"AbortError"}; } signal.addEventListener("abort",on,{once:true}); }
    let transient=false;
    try{ const r=await fetch(url,{signal:c.signal}); if(r.ok) return await r.json(); transient=r.status>=500||r.status===429; }
    catch(e){ if(signal&&signal.aborted) throw {name:"AbortError"}; transient=true; }
    finally{ clearTimeout(to); if(signal) signal.removeEventListener("abort",on); }
    if(!transient) return null;
    await new Promise(r=>setTimeout(r,350));
  }
  return null;
}
/* CORS-proxy race: for sources that block browsers (or ISPs that block lrclib.net) — first proxy that answers wins */
const LY_PROXIES=[u=>"https://corsproxy.io/?url="+encodeURIComponent(u),u=>"https://api.allorigins.win/raw?url="+encodeURIComponent(u),u=>"https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(u)];
function lyProxyJSON(url,signal,ms){
  return new Promise((resolve,reject)=>{
    let left=LY_PROXIES.length, done=false;
    LY_PROXIES.forEach(px=>{
      lyJSON(px(url),signal,ms||8000).then(j=>{ if(done) return; if(j){ done=true; resolve(j); } else if(--left<=0){ done=true; resolve(null); } },
        e=>{ if(done) return; done=true; reject(e); });
    });
  });
}
function lyInfo(track){
  const dec=s=>String(s||"").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#0?39;/g,"'").trim();
  const raw=dec(track.name||track.title), titles=[], seen=new Set();
  const add=t=>{ t=String(t||"").replace(/\s+/g," ").trim(); const k=lyricsNorm(t); if(t&&k&&!seen.has(k)){ seen.add(k); titles.push(t); } };
  add(lyStrip(raw)); add(raw);
  add(lyStrip(raw).replace(/\s*[\(\[][^\)\]]*[\)\]]/g,""));
  add(lyStrip(raw).split(/\s+[-|–]\s+/)[0]);
  const artists=dec(track.artistName||track.artist).split(/\s*(?:,|&|\bfeat\.?|\bft\.?)\s*/i).map(s=>s.trim()).filter(Boolean).slice(0,3);
  return {titles:titles.slice(0,4),artists,album:dec(track.albumName||track.album).replace(/\s*[\(\[][^\)\]]*[\)\]]/g,"").trim(),dur:Math.round(Number(track.duration)||0),track};
}
function lyScore(h,info){
  const tn=h.trackName||h.name||h.title||"", an=h.artistName||h.artist||"";
  const ts=Math.max(0,...info.titles.map(t=>lyricsSimilarity(t,tn)));
  const as=an&&info.artists.length?Math.max(...info.artists.map(a=>lyricsSimilarity(a,an))):.4;
  let s=ts*.62+as*.28; const hd=Number(h.duration)||0, df=hd&&info.dur?Math.abs(hd-info.dur):99;
  if(hd&&info.dur) s+= df<=2?.1:df<=5?.05:(info.track&&info.track.source==="youtube"?(df<=12?0:df<=25?-.12:-.3):(df<=5?0:df<=9?-.12:-.35));   /* YouTube videos are often longer than the studio song */
  return {s,ts,as,df};
}
function lyPlainLines(text){
  const out=[]; let blank=false;
  String(text||"").replace(/\r/g,"").split("\n").forEach(x=>{
    x=x.replace(/\uFEFF/g,"").trim();
    if(/^[\[\(]?(instrumental|music|intro|outro)[\]\)]?$/i.test(x)) return;
    if(!x){ if(out.length&&!blank){ out.push({time:0,text:""}); blank=true; } return; }
    blank=false; out.push({time:0,text:x});
  });
  while(out.length&&!out[out.length-1].text) out.pop();
  return out;
}
function lyBuild(h,info,source,sc){
  if(!h||h.instrumental) return null;
  { const hd=Number(h.duration)||0, yt0=!!(info.track&&info.track.source==="youtube");
    if(hd&&info.dur&&Math.abs(hd-info.dur)>(yt0?40:15)) return null;   /* different version / different song */
    if(info.dur&&h.syncedLyrics){ const _l=parseLRC(h.syncedLyrics); const lt=_l.length?_l[_l.length-1].time:0; if(lt&&(lt>info.dur+12||lt<info.dur*.4)) return null; }
  }
  if(h.syncedLyrics){
    const lines=parseLRC(h.syncedLyrics);
    if(lines.length>=2){ const ws=lines.some(l=>l.real); return {synced:true,estimated:false,wordSynced:ws,source,lines,s:sc,rank:sc+.5+(ws?.1:0)}; }
  }
  if(h.plainLyrics){
    const lines=lyPlainLines(h.plainLyrics);
    if(lines.length>=4) return {synced:false,estimated:false,wordSynced:false,source:source,lines,s:sc,rank:sc};
  }
  return null;
}
const LRCLIB_BASE="https://lrclib.net/api";

/* 0) Lyricsify automatic title+artist matcher.
   Lyricsify exposes a JSON search endpoint that returns HTML search results;
   the selected result page contains the synced LRC in its _details block.
   We only fetch the exact matched track at runtime — no catalog is embedded. */
async function lyText(url,signal,ms){
  const c=new AbortController(), to=setTimeout(()=>c.abort(),ms||7500), on=()=>c.abort();
  if(signal){ if(signal.aborted){ clearTimeout(to); throw {name:"AbortError"}; } signal.addEventListener("abort",on,{once:true}); }
  try{ const r=await fetch(url,{signal:c.signal,headers:{"Accept":"text/html,text/plain,*/*"}}); if(!r.ok) return null; return await r.text(); }
  catch(e){ if(signal&&signal.aborted) throw {name:"AbortError"}; return null; }
  finally{ clearTimeout(to); if(signal) signal.removeEventListener("abort",on); }
}
function lyHtmlDecode(s){
  const el=document.createElement("textarea"); el.innerHTML=String(s||""); return el.value;
}
function lyLyricsifySearchRows(payload){
  const html=lyHtmlDecode(payload&&typeof payload.html==="string"?payload.html:"");
  if(!html) return [];
  const rows=[];
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))){
    const url=String(m[1]||"").replace(/\\/g,"");
    const text=m[2].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    if(!/lyricsify\.com/i.test(url) || !text) continue;
    const clean=url.startsWith("http")?url:("https://www.lyricsify.com"+(url.startsWith("/")?url:"/"+url));
    const title=text.replace(/\s+-\s+[^-]+$/," ").trim();
    rows.push({url:clean,text,title});
    if(rows.length>=12) break;
  }
  return rows;
}
function lyLyricsifyLRCFromHtml(html){
  const src=String(html||"");
  let block=src.match(/_details[\s\S]*?<\/div>/i);
  let raw=block?block[0]:src;
  raw=raw.replace(/<br\s*\/?>(?:\r?\n)?/gi,"\n").replace(/<\/p\s*>/gi,"\n").replace(/<[^>]+>/g,"");
  raw=lyHtmlDecode(raw).replace(/\r/g,"");
  const lrc=raw.split("\n").map(x=>x.trim()).filter(Boolean).filter(x=>/^\s*\[[0-9]{1,3}:[0-9]{2}(?:[.:][0-9]{1,3})?\]/.test(x)).join("\n");
  return lrc;
}
async function lyLyricsify(info,sig){
  const title=info.titles[0], artist=info.artists[0]; if(!title||!artist) return [];
  const q=encodeURIComponent(artist+" "+title);
  const payload=await lyJSON("https://api.lyricsify.com/search?q="+q,sig,6500);
  if(!payload) return [];
  const rows=lyLyricsifySearchRows(payload);
  const ranked=rows.map(r=>{
    const text=r.text||"", ts=Math.max(0,...info.titles.map(t=>lyricsSimilarity(t,text))), as=Math.max(0,...info.artists.map(a=>lyricsSimilarity(a,text)));
    return {...r,score:ts*.72+as*.28};
  }).sort((a,b)=>b.score-a.score);
  for(const r of ranked.slice(0,4)){
    if(r.score<.55) continue;
    const page=await lyText(r.url,sig,7000);
    const lrc=lyLyricsifyLRCFromHtml(page);
    if(!lrc) continue;
    const lines=parseLRC(lrc);
    if(lines.length<2) continue;
    return [{synced:true,estimated:false,wordSynced:lines.some(l=>l.real),source:"LYRICSIFY",lines,s:r.score,rank:r.score+.72+(lines.some(l=>l.real)?.1:0)}];
  }
  return [];
}
/* 1) LRCLIB cached exact lookup — fastest automatic synced-lyrics path */
async function lyLRCCached(info,sig){
  const t=info.titles[0], a=info.artists[0]; if(!t||!a) return [];
  const base=LRCLIB_BASE+"/get-cached?track_name="+encodeURIComponent(t)+"&artist_name="+encodeURIComponent(a);
  const urls=[];
  if(info.album) urls.push(base+"&album_name="+encodeURIComponent(info.album)+(info.dur?"&duration="+info.dur:""));
  urls.push(base+(info.dur?"&duration="+info.dur:""));
  for(const u of urls){
    const h=await lyJSON(u,sig,6500);
    if(!h) continue;
    const sc=lyScore(h,info);
    const c=lyBuild(h,info,"LRCLIB-CACHED",sc.s);
    if(c&&c.synced&&sc.ts>=.72&&(sc.df<=8||!sc.df)) return [c];
  }
  return [];
}
/* 1) LRCLIB exact lookup (title + artist + album + duration) */
async function lyLRCGet(info,sig){
  const t=info.titles[0], a=info.artists[0]; if(!t||!a) return [];
  const b="track_name="+encodeURIComponent(t)+"&artist_name="+encodeURIComponent(a), urls=[];
  if(info.dur){ urls.push(LRCLIB_BASE+"/get?"+b+(info.album?"&album_name="+encodeURIComponent(info.album):"")+"&duration="+info.dur); urls.push(LRCLIB_BASE+"/get?"+b+"&duration="+info.dur); }
  urls.push(LRCLIB_BASE+"/get?"+b);
  const rs=await Promise.all(urls.map(u=>lyJSON(u,sig,7000,true)));
  return rs.filter(Boolean).map(h=>{ const sc=lyScore(h,info); return sc.ts>=.6?lyBuild(h,info,"LRCLIB",sc.s):null; });
}
/* 0) BOOSTER server lyrics (/lyrics): one request, the server asks LRCLIB for you */
async function lyBooster(info,sig){
  const S=window.BOOSTER_LY_SERVER; if(!S||window.__boosterDown()) return [];
  const t=info.titles[0], a=info.artists[0]||""; if(!t) return [];
  const u=S+"/lyrics?title="+encodeURIComponent(t)+"&artist="+encodeURIComponent(a)+(info.album?"&album="+encodeURIComponent(info.album):"")+(info.dur?"&dur="+info.dur:"");
  const arr=await lyJSON(u,sig,3500);
  if(!Array.isArray(arr)) window.__boosterMarkDown();
  const out=[], yt=!!(info.track&&info.track.source==="youtube");
  if(Array.isArray(arr)) for(const h of arr.slice(0,25)){
    const sc=lyScore(h,info);
    if(sc.ts>=.6&&(sc.s>=.8||(sc.ts>=.88&&(sc.df<=10||yt)))){ const c=lyBuild(h,info,"BOOSTER",sc.s); if(c) out.push(c); }
  }
  return out;
}
/* 2) LRCLIB fuzzy search — several title/artist variants in parallel, best scored hit wins */
async function lyLRCSearch(info,sig){
  const qs=[], a=info.artists[0]||"";
  info.titles.slice(0,3).forEach(tt=>{ if(a) qs.push("q="+encodeURIComponent(tt+" "+a)); qs.push("track_name="+encodeURIComponent(tt)+(a?"&artist_name="+encodeURIComponent(a):"")); });
  if(info.artists[1]) qs.push("q="+encodeURIComponent(info.titles[0]+" "+info.artists[1]));
  qs.push("q="+encodeURIComponent(info.titles[0]));
  qs.push("track_name="+encodeURIComponent(info.titles[0]));
  const list=[...new Set(qs)].slice(0,7);
  let rs=await Promise.all(list.map(q=>lyJSON(LRCLIB_BASE+"/search?"+q,sig,7000,true)));
  if(!rs.some(Array.isArray)) rs=await Promise.all(list.slice(0,3).map(q=>lyProxyJSON(LRCLIB_BASE+"/search?"+q,sig,8000)));   /* lrclib.net unreachable (ISP block / outage) -> go through proxies */
  const out=[], yt=!!(info.track&&info.track.source==="youtube");
  for(const arr of rs) if(Array.isArray(arr)) for(const h of arr.slice(0,20)){
    const sc=lyScore(h,info);
    if(sc.ts>=.6&&(sc.s>=.7||(sc.ts>=.88&&(sc.df<=10||yt)))){ const c=lyBuild(h,info,"LRCLIB",sc.s); if(c) out.push(c); }
  }
  return out;
}
/* 3) Karalyr (timed lyrics, word timing when the track has it) */
async function lyKaralyr(info,sig){
  const t=info.titles[0], a=info.artists[0]; if(!t||!a||info.dur<1) return [];
  const j=await lyJSON("https://www.karalyr.com/api/get?artist_name="+encodeURIComponent(a)+"&track_name="+encodeURIComponent(t)+"&duration="+info.dur+(info.album?"&album_name="+encodeURIComponent(info.album):""),sig);
  return j?[lyBuild(j,info,"KARALYR",.9)]:[];
}
/* 4) Textyl (timed lyrics, mostly English / Hinglish pop) */
async function lyTextyl(info,sig){
  const t=info.titles[0]; if(!t) return [];
  const j=await lyJSON("https://api.textyl.co/api/lyrics?q="+encodeURIComponent(((info.artists[0]||"")+" "+t).trim()),sig);
  if(!Array.isArray(j)||j.length<4) return [];
  const lines=j.map(x=>({time:Number(x.seconds)||0,text:String(x.lyrics||"").trim()})).filter(x=>x.text).sort((a,b)=>a.time-b.time);
  if(lines.length<4||(info.dur&&lines[lines.length-1].time>info.dur+8)) return [];
  return [{synced:true,estimated:false,wordSynced:false,source:"TEXTYL",lines,s:.66,rank:1.04}];
}
/* 5) NetEase Cloud Music (huge synced catalogue incl. Hindi / Punjabi / Marathi) — via CORS proxy */
async function lyNetEase(info,sig){
  const t=info.titles[0]; if(!t) return [];
  const q=((info.artists[0]||"")+" "+t).trim();
  const sj=await lyProxyJSON("https://music.163.com/api/search/get/web?csrf_token=&hlpretag=&hlposttag=&s="+encodeURIComponent(q)+"&type=1&offset=0&total=true&limit=8",sig,8000);
  const songs=sj&&sj.result&&sj.result.songs; if(!Array.isArray(songs)) return [];
  const yt=!!(info.track&&info.track.source==="youtube");
  const ranked=songs.map(x=>{
    const h={trackName:x.name,artistName:(x.artists||x.ar||[]).map(a=>a.name).join(", "),duration:(x.duration||x.dt||0)/1000};
    return {id:x.id,h,sc:lyScore(h,info)};
  }).filter(r=>r.sc.ts>=.6&&(r.sc.df<=6||!info.dur||!r.h.duration||yt)).sort((a,b)=>b.sc.s-a.sc.s);
  for(const r of ranked.slice(0,2)){
    const lj=await lyProxyJSON("https://music.163.com/api/song/lyric?id="+r.id+"&lv=1&kv=1&tv=-1",sig,8000);
    const raw=lj&&lj.lrc&&lj.lrc.lyric; if(!raw) continue;
    const lrc=String(raw).split(/\r?\n/).filter(l=>!/^\[\d+:\d+(?:[.:]\d+)?\]\s*(?:作词|作曲|编曲|制作人?|词|曲|混音|录音|母带|Lyrics|Composer|Producer)\s*[:：]/i.test(l)).join("\n");
    const lines=parseLRC(lrc);
    if(lines.length>=4) return [{synced:true,estimated:false,wordSynced:false,source:"NETEASE",lines,s:r.sc.s,rank:r.sc.s+.45}];
  }
  return [];
}
/* Last resort: plain lyrics, auto-timed to the song */
async function lyOVH(info,sig){
  const pairs=[]; info.titles.slice(0,2).forEach(t=>info.artists.slice(0,2).forEach(a=>pairs.push([a,t])));
  const rs=await Promise.all(pairs.map(p=>lyJSON("https://api.lyrics.ovh/v1/"+encodeURIComponent(p[0])+"/"+encodeURIComponent(p[1]),sig,9000)));
  for(const j of rs){
    if(!j||!j.lyrics) continue;
    const lines=lyPlainLines(j.lyrics);
    if(lines.length>=4) return {synced:false,estimated:false,wordSynced:false,source:"LYRICS.OVH",lines,s:.6,rank:.6};
  }
  return null;
}
/* ============================================================ YOUTUBE CAPTIONS (CC) ENGINE ============================================================
   1) song has plain lyrics  -> word timings from YouTube captions are aligned onto the plain lyrics
   2) song has no lyrics     -> the captions themselves become the lyrics (marked "auto-generated")
   Needs your own tiny server: deploy yt-captions-worker.js on Cloudflare Workers and paste its URL below. Empty = feature off. */
const YT_CC_ENDPOINT = window.BOOSTER_SERVER || "";   /* e.g. "https://yt-cc.yourname.workers.dev" */
const YT_LANG={hindi:"hi",punjabi:"pa",tamil:"ta",telugu:"te",marathi:"mr",gujarati:"gu",bengali:"bn",kannada:"kn",malayalam:"ml",english:"en",bhojpuri:"hi",haryanvi:"hi",rajasthani:"hi",urdu:"ur"};
async function lyYTFetch(info,sig){
  if(!YT_CC_ENDPOINT) return null;
  const lang=YT_LANG[String(info.track&&info.track.language||"").toLowerCase()]||"";
  const u=YT_CC_ENDPOINT.replace(/\/$/,"")+"/yt/lyrics?title="+encodeURIComponent(info.titles[0]||"")+"&artist="+encodeURIComponent(info.artists[0]||"")+"&dur="+info.dur+(lang?"&lang="+lang:"");
  const j=await lyJSON(u,sig,20000);
  return j&&Array.isArray(j.words)&&j.words.length>=8?j:null;
}
/* ---- token matching: same script = exact / 1-typo match; Roman vs Devanagari = consonant-skeleton match ---- */
const LY_DEV={"क":"k","ख":"k","ग":"g","घ":"g","ङ":"n","च":"c","छ":"c","ज":"j","झ":"j","ञ":"n","ट":"t","ठ":"t","ड":"d","ढ":"d","ण":"n","त":"t","थ":"t","द":"d","ध":"d","न":"n","प":"p","फ":"p","ब":"b","भ":"b","म":"m","र":"r","ल":"l","व":"v","श":"s","ष":"s","स":"s","ह":"h"};
function lyHasDev(s){ return /[\u0900-\u097F]/.test(s); }
function lyKeyN(w){ return String(w||"").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,""); }
function lyKeySkel(w){
  w=String(w||"").toLowerCase().normalize("NFC");
  if(lyHasDev(w)) w=Array.from(w).map(ch=>LY_DEV[ch]||(/[a-z]/.test(ch)?ch:"")).join("");
  else w=w.replace(/[^a-z]/g,"").replace(/chh?/g,"c").replace(/sh/g,"s").replace(/([kgjtdpbc])h/g,"$1").replace(/w/g,"v").replace(/z/g,"j").replace(/f/g,"p").replace(/q/g,"k");
  return w.replace(/[aeiouy]/g,"").replace(/(.)\1+/g,"$1");
}
function lyLev1(a,b){
  if(a.length===b.length){ let d=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]&&++d>1) return false; return true; }
  const s=a.length<b.length?a:b, l=a.length<b.length?b:a; let i=0,j=0,d=0;
  while(i<s.length&&j<l.length){ if(s[i]===l[j]){ i++; j++; } else { if(++d>1) return false; j++; } }
  return true;
}
/* Align plain lyric lines onto caption words (order-preserving LCS). Returns synced lines or null when the match is weak. */
function lyAlign(plain,cc){
  const toks=[];
  plain.forEach(L=>String(L.text||"").split(/\s+/).filter(Boolean).forEach(w=>toks.push({text:w})));
  const CW=cc.words, n=toks.length, m=CW.length;
  if(n<8||m<8||n*m>2.5e6) return null;
  const mixed=lyHasDev(toks.map(x=>x.text).join(" "))!==lyHasDev(CW.map(x=>x.text).join(" "));
  const kf=mixed?lyKeySkel:lyKeyN;
  const A=toks.map(x=>kf(x.text)), B=CW.map(x=>kf(x.text));
  const eq=(a,b)=>!!a&&!!b&&(a===b||(!mixed&&a.length>=4&&b.length>=4&&Math.abs(a.length-b.length)<=1&&lyLev1(a,b)));
  const W=m+1, dp=new Uint16Array((n+1)*W);
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++) dp[i*W+j]=eq(A[i-1],B[j-1])?dp[(i-1)*W+j-1]+1:Math.max(dp[(i-1)*W+j],dp[i*W+j-1]);
  const time=new Array(n).fill(null); let i=n,j=m,hit=0;
  while(i>0&&j>0){
    if(eq(A[i-1],B[j-1])&&dp[i*W+j]===dp[(i-1)*W+j-1]+1){ time[i-1]=CW[j-1].t; hit++; i--; j--; }
    else if(dp[(i-1)*W+j]>=dp[i*W+j-1]) i--; else j--;
  }
  const conf=hit/n; if(conf<(mixed?.3:.35)) return null;
  const anc=[]; time.forEach((t,k)=>{ if(t!=null) anc.push(k); });
  const full=time.slice(), a0=anc[0], a1=anc[anc.length-1];
  for(let k=a0-1;k>=0;k--) full[k]=Math.max(0,full[k+1]-.4);
  for(let k=a1+1;k<n;k++) full[k]=full[k-1]+.4;
  for(let q=0;q<anc.length-1;q++){ const s=anc[q], e=anc[q+1]; for(let k=s+1;k<e;k++) full[k]=time[s]+(time[e]-time[s])*(k-s)/(e-s); }
  for(let k=1;k<n;k++) if(full[k]<full[k-1]) full[k]=full[k-1];
  const lines=[]; let p=0;
  plain.forEach(L=>{
    const cnt=String(L.text||"").split(/\s+/).filter(Boolean).length; if(!cnt) return;
    const seg=[]; let real=0;
    for(let q=0;q<cnt;q++,p++){ seg.push({t:full[p],text:toks[p].text}); if(time[p]!=null) real++; }
    const line={time:seg[0].t,text:seg.map(w=>w.text).join(" ")};
    if(real/cnt>=.5){ line.words=seg; line.real=true; }
    lines.push(line);
  });
  return {lines,confidence:conf};
}
/* No lyrics at all: build lines straight from the caption words */
function lyCCToLines(cc){
  const out=[]; let cur=[];
  const flush=()=>{
    if(!cur.length) return;
    const L={time:cur[0].t,text:cur.map(w=>w.text).join(" ")};
    if(cc.wordTimed!==false){ L.words=cur.map(w=>({t:w.t,text:w.text})); L.real=true; }
    out.push(L); cur=[];
  };
  for(const w of cc.words){
    if(w.nl&&cur.length) flush();
    if(cur.length&&(w.t-cur[cur.length-1].t>1.1||cur.length>=9)) flush();
    cur.push(w);
  }
  flush(); return out;
}
/* WORKER lyrics (priority 3, after LRCLIB): YouTube captions via your Worker (/yt/lyrics) -> timed lines */
async function lyWorkerLyrics(info,sig){
  const cc=await lyYTFetch(info,sig); if(!cc) return null;
  const ls=lyCCToLines(cc); if(ls.length<4) return null;
  return {synced:true,estimated:false,wordSynced:ls.some(l=>l.real),generated:true,source:"WORKER",lines:ls,s:.9,rank:2};
}
const LYRICS_PROVIDERS=[lyLyricsify,lyLRCCached,lyLRCGet,lyLRCSearch,lyKaralyr,lyTextyl,lyNetEase];
const LYRICS_FALLBACKS=[lyOVH];
async function fetchLyricsExpanded(track,signal){
  const info=lyInfo(track); let best=null;
  const consider=c=>{ if(c&&c.lines&&c.lines.length&&(!best||c.rank>best.rank)) best=c; };
  /* PRIORITY: 1) LRCLIB first  2) if it gives no synced lyrics -> all the other providers together */
  const runGroup=(list,capMs)=>new Promise((resolve,reject)=>{
    let left=list.length, fin=false, timer=0, cap=0;
    const end=()=>{ if(!fin){ fin=true; clearTimeout(timer); clearTimeout(cap); resolve(); } };
    cap=setTimeout(end,capMs);   /* a slow / dead provider can never hold the lyrics hostage */
    list.forEach(p=>{
      Promise.resolve().then(()=>p(info,signal)).then(r=>{
        (Array.isArray(r)?r:[r]).forEach(consider);
        if(best&&best.synced&&!best.estimated&&best.s>=.78){ if(best.wordSynced) end(); else if(!timer) timer=setTimeout(end,1000); }
      }).catch(e=>{ if(e&&e.name==="AbortError"&&!fin){ fin=true; clearTimeout(timer); clearTimeout(cap); reject(e); } })
        .finally(()=>{ if(--left<=0) end(); });
    });
  });
  /* PRIORITY: LRCLIB (2.5) first, then Worker (3), then the rest; the Worker request starts in parallel so it is ready if LRCLIB has nothing */
  let wp=null;
  if(YT_CC_ENDPOINT){ wp=Promise.race([lyWorkerLyrics(info,signal),new Promise(r=>setTimeout(()=>r(null),8000))]); wp.catch(()=>{}); }
  await runGroup([lyBooster,lyLRCCached,lyLRCGet,lyLRCSearch],4500);
  if((!best||!best.synced||best.estimated)&&wp){
    let wr=null; try{ wr=await wp; }catch(e){ if(e&&e.name==="AbortError") throw e; }
    if(wr) best=wr;
  }
  if(!best||!best.synced||best.estimated) await runGroup([lyLyricsify,lyKaralyr,lyTextyl,lyNetEase],9000);
  if(!best){ for(const f of LYRICS_FALLBACKS){ consider(await f(info,signal)); if(best) break; } }
  /* YouTube captions: sync plain lyrics word-by-word, or generate lyrics when nothing was found */
  if((!best||best.synced===false)&&YT_CC_ENDPOINT){
    let cc=null; try{ cc=await lyYTFetch(info,signal); }catch(e){ if(e&&e.name==="AbortError") throw e; }
    if(cc){
      if(best){
        const al=lyAlign(best.lines,cc);
        if(al) best={synced:true,estimated:false,wordSynced:al.lines.some(l=>l.real),source:best.source+"+YT-CC",lines:al.lines,s:best.s,rank:best.rank+1};
      }else{
        const ls=lyCCToLines(cc);
        if(ls.length>=4) best={synced:true,estimated:false,wordSynced:ls.some(l=>l.real),generated:true,source:"YT-CC",lines:ls,s:.5,rank:.5};
      }
    }
  }
  return best;
}

let currentLyrics = null, activeLyricIndex = -1, lyricsRequestToken = 0;
let lyricsUserScrollUntil = 0, lyricsRAF = 0, lyricsLoopActive = false;
// Estimated/plain lyrics need to follow the vocal rather than the raw clock.
// During detected instrumental/silence gaps we temporarily freeze the lyric clock,
// then resume from the same lyric position when audio returns.
let estimatedLyricsSilenceMs = 0;
let estimatedLyricsLastAudioTime = null;
let estimatedLyricsTrackId = null;
let estimatedLyricsHeldIndex = -1;
let estimatedLyricsTimes = null;
let estimatedLyricsGapActive = false;
let estimatedLyricsGapStart = 0;

function resetEstimatedLyricsClock(){
  estimatedLyricsLastAudioTime=null;
  estimatedLyricsSilenceMs=0;
  estimatedLyricsTrackId=State.currentTrack&&State.currentTrack.id||null;
  estimatedLyricsHeldIndex=-1;
  estimatedLyricsTimes=null;
  estimatedLyricsGapActive=false;
  estimatedLyricsGapStart=0;
}
function estimatedLyricsEnsureTimes(){
  if(!currentLyrics || !currentLyrics.estimated) return null;
  const id=State.currentTrack&&State.currentTrack.id||null;
  if(!estimatedLyricsTimes || id!==estimatedLyricsTrackId){
    estimatedLyricsTrackId=id;
    estimatedLyricsTimes=currentLyrics.lines.map(x=>Number(x.time)||0);
  }
  return estimatedLyricsTimes;
}
function estimatedLyricsState(rawTime,candidateIndex){
  const t=Number(rawTime)||0;
  if(!currentLyrics || !currentLyrics.estimated) return {time:t,hold:false,times:null};
  const times=estimatedLyricsEnsureTimes();
  const audio=primaryAudio();
  const playing=!!(audio&&!audio.paused&&!audio.ended);
  let dt=0;
  if(Number.isFinite(estimatedLyricsLastAudioTime)) dt=Math.max(0,Math.min(0.25,t-estimatedLyricsLastAudioTime));
  estimatedLyricsLastAudioTime=t;
  let level=null;

  // Only treat a sustained near-silent section as a gap. We do not advance
  // lyrics during it, but we also don't subtract time from the master audio
  // clock, preventing cumulative drift.
  if(playing && level!=null){
    if(level<0.010) estimatedLyricsSilenceMs += dt*1000;
    else estimatedLyricsSilenceMs=Math.max(0,estimatedLyricsSilenceMs-dt*650);
  }else if(!playing){
    estimatedLyricsSilenceMs=0;
  }
  const silent=playing && estimatedLyricsSilenceMs>=500;
  if(silent && !estimatedLyricsGapActive){
    estimatedLyricsGapActive=true;
    estimatedLyricsGapStart=t;
  }
  if(!silent && estimatedLyricsGapActive){
    const gap=Math.max(0,t-estimatedLyricsGapStart);
    estimatedLyricsGapActive=false;
    estimatedLyricsSilenceMs=0;
    // Re-anchor the remaining estimated timeline after a real gap. This is
    // the important part: future lines move only as much as necessary, while
    // the remaining song duration is re-distributed so the ending stays sane.
    if(times && estimatedLyricsHeldIndex>=0 && gap>0.45){
      const anchor=Math.min(t+0.04,(audio&&Number.isFinite(audio.duration)?audio.duration:t)-0.15);
      const next=Math.min(times.length-1,Math.max(estimatedLyricsHeldIndex+1,0));
      if(next<times.length && times[next]<anchor){
        const oldNext=times[next];
        const end=(audio&&Number.isFinite(audio.duration)?audio.duration:times[times.length-1]+2);
        const oldEnd=Math.max(oldNext+0.5,times[times.length-1]);
        const scale=(end-anchor)/Math.max(0.5,oldEnd-oldNext);
        times[next]=anchor;
        for(let i=next+1;i<times.length;i++) times[i]=anchor+(times[i]-oldNext)*Math.max(0.35,Math.min(1.15,scale));
      }
    }
  }
  const hold=silent && estimatedLyricsHeldIndex>=0;
  if(!hold && candidateIndex>=0) estimatedLyricsHeldIndex=candidateIndex;
  return {time:t,hold,times};
}

function seekToLyric(t){ const el=primaryAudio(); if(el.duration && Number.isFinite(t)) el.currentTime = Math.max(0, Math.min(t, el.duration)); updateActiveLyric(el.currentTime, true); }

function renderLyricLine(line,index){
  const est=currentLyrics&&currentLyrics.estimated?' estimated-sync':'';
  if(line.real&&line.words&&line.words.length){
    return '<div class="lyric-line karaoke-on'+est+'" data-nw="1" data-i="'+index+'" data-t="'+line.time+'"><span class="lyric-fill">'+line.words.map((w,i)=>'<span class="lyric-word" style="--word-i:'+i+'">'+escapeHTML(w.text)+'</span>').join(' ')+'</span></div>';
  }
  return '<div class="lyric-line'+est+'" data-i="'+index+'" data-t="'+line.time+'"><span class="lyric-fill">'+escapeHTML(line.text)+'</span></div>';
}
function startLyricsLoop(){
  if(lyricsLoopActive) return;
  lyricsLoopActive = true;
  const tick = ()=>{
    if(!lyricsLoopActive) return;
    if(State.lyricsOpen && !document.hidden){ LY.inLoop=true; try{ updateActiveLyric(lySmoothTime(primaryAudio()), false); }finally{ LY.inLoop=false; } }
    lyricsRAF = requestAnimationFrame(tick);
  };
  lyricsRAF = requestAnimationFrame(tick);
}
function stopLyricsLoop(){ lyricsLoopActive=false; if(lyricsRAF){ cancelAnimationFrame(lyricsRAF); lyricsRAF=0; } }

/* V19: zero-allocation lyric engine. Cached DOM refs, cached offset, interpolated clock,
   GPU-cheap highlight (background-position, not a re-parsed gradient), no per-frame exceptions. */
const LY={box:null,lines:null,src:null,times:null,timesSrc:null,offT:0,offAt:0,offId:null,rawT:NaN,
  fillEl:null,fillNode:null,pct:-1,wordsEl:null,words:null,upto:-1,aT:-1,aS:0,out:0,inLoop:false};
function lyGetLines(box,force){
  let ls=LY.lines;
  if(force||!ls||LY.box!==box||LY.src!==currentLyrics||(ls.length&&!ls[0].isConnected)||!ls.length){
    LY.box=box;LY.src=currentLyrics;
    LY.lines=ls=Array.prototype.slice.call(box.querySelectorAll(".lyric-line"));
    LY.fillEl=null;LY.fillNode=null;LY.pct=-1;LY.wordsEl=null;LY.words=null;LY.upto=-1;
    try{ if(getComputedStyle(box).position==="static") box.style.position="relative"; }catch(_){}
  }
  return ls;
}
function lyOffset(force){
  const now=performance.now();
  const id=(State.currentTrack&&State.currentTrack.id)||"unknown";
  if(force||LY.offId!==id||now-LY.offAt>400){
    LY.offId=id;LY.offAt=now;
    let v=0; try{ v=Number(Store.get("lyrics_offset_"+id,0))||0; }catch(_){}
    LY.offT=Math.max(-5,Math.min(5,v));
  }
  return LY.offT;
}
function lyTimes(lns){
  if(LY.timesSrc!==lns){ LY.timesSrc=lns; LY.times=lns.map(x=>Number(x.time)||0); }
  return LY.times;
}
function lySmoothTime(a){
  const t=a.currentTime,now=performance.now();
  if(a.paused||a.seeking||a.ended){ LY.aT=t;LY.aS=now;LY.out=t;return t; }
  if(t!==LY.aT){ LY.aT=t;LY.aS=now; }
  let o=t+Math.min(.12,(now-LY.aS)/1000*(a.playbackRate||1));
  if(o<LY.out&&LY.out-o<.25) o=LY.out;   /* clock never steps backwards */
  LY.out=o; return o;
}
function updateActiveLyric(currentTime, force){
  if(!currentLyrics || !currentLyrics.synced) return;
  if(!State.settings.syncedLyrics || !State.settings.highlightActiveLine) return;
  /* while the rAF loop drives the lyrics, ignore the coarse timeupdate calls (they are slightly behind and cause jitter) */
  if(!force && lyricsLoopActive && State.lyricsOpen && !LY.inLoop) return;
  const box = document.getElementById("lyrics-scroll");
  if(!box) return;
  currentTime = (Number(currentTime)||0) - lyOffset(force);
  if(!force && currentTime===LY.rawT) return;      /* paused / nothing moved: do nothing */
  LY.rawT=currentTime;
  const lns = currentLyrics.lines;
  if(!lns||!lns.length) return;
  const est = !!currentLyrics.estimated;
  const lyricState = est ? estimatedLyricsState(currentTime,-1) : null;
  const times = (lyricState&&lyricState.times) || lyTimes(lns);
  const syncTime = currentTime - (est ? 0.10 : 0);
  let lo=0,hi=lns.length-1,idx=-1;
  if(est && times.length && syncTime < times[0]) idx=-1;
  while(lo<=hi){ const mid=(lo+hi)>>1; if(times[mid]<=syncTime){ idx=mid; lo=mid+1; } else hi=mid-1; }
  if(lyricState && lyricState.hold && estimatedLyricsHeldIndex>=0) idx=estimatedLyricsHeldIndex;
  else if(idx>=0 && est) estimatedLyricsHeldIndex=idx;

  const lines = lyGetLines(box,force);
  let el = idx>=0 ? lines[idx] : null;

  if(force || idx!==activeLyricIndex){
    const prevIdx = activeLyricIndex;
    activeLyricIndex = idx;
    const prevEl = prevIdx>=0 ? lines[prevIdx] : null;
    /* ---- reads first (no layout thrash) ---- */
    let desired=-1;
    if(el && State.settings.lyricsAutoScroll && Date.now()>lyricsUserScrollUntil){
      const sH=box.clientHeight, max=Math.max(0,box.scrollHeight-sH);
      desired=Math.max(0,Math.min(el.offsetTop-sH*0.14,max));
    }
    /* ---- then writes ---- */
    if(prevEl && prevEl!==el){
      prevEl.classList.remove("active");
      prevEl.style.removeProperty("--fill");
      if(prevEl.classList.contains("karaoke-on")){
        const ws=prevEl.querySelectorAll(".lyric-word.wdone");
        for(let i=0;i<ws.length;i++) ws[i].classList.remove("wdone");
      }
    }
    if(el){
      el.classList.add("active");
      LY.fillEl=el; LY.fillNode=el.firstElementChild; LY.pct=-1;
      LY.wordsEl=null; LY.words=null; LY.upto=-1;
    }
    if(window.bosLyApple) window.bosLyApple(box,lines,idx,desired,force);
    else if(desired>=0) box.scrollTo({top:desired, behavior: force?"auto":"smooth"});
  }

  if(el){
    const start = Number(times[idx]||0);
    let end = Number(times[idx+1] != null ? times[idx+1] : Math.min((primaryAudio().duration||start+4), start+4));
    if(bosGapSungEnd){ const ge=bosGapSungEnd(idx); if(ge!=null && ge>start+.25 && ge<end) end=ge; }
    const span = Math.max(.25, end-start);
    const fillTime = est ? Math.max(start, currentTime-0.10) : currentTime;
    const raw = clamp((fillTime-start)/(span*.9), 0, 1);
    if(el.classList.contains("karaoke-on")){
      if(LY.wordsEl!==el || !LY.words || !LY.words.length){ LY.words=el.querySelectorAll(".lyric-word"); LY.wordsEl=el; LY.upto=-1; }
      const w=LY.words;
      if(w.length){
        const wt=lns[idx]&&lns[idx]._wt; let upto;
        if(wt&&wt.length===w.length){ upto=0; const ct=currentTime+.05; while(upto<wt.length&&wt[upto]<=ct) upto++; }
        else{ const frac=clamp((currentTime-Number(times[idx]||0))/Math.max(.3,(end-start)*.88),0,1); upto=Math.min(w.length,Math.floor(frac*w.length+.999*(frac>=1?1:0))); }
        /* last word: once the line is essentially over, finish every word */
        if(currentTime>=end-.12 || (wt&&wt.length===w.length&&currentTime>=wt[wt.length-1]+.05)) upto=w.length;
        if(upto!==LY.upto){
          const from = LY.upto<0 ? 0 : Math.min(LY.upto,upto);
          const to = LY.upto<0 ? w.length : Math.max(LY.upto,upto);
          for(let i=from;i<to&&i<w.length;i++) w[i].classList.toggle("wdone",i<upto);
          LY.upto=upto;
        }
      }
    }else{
      const eased = raw*raw*(3-2*raw);
      if(LY.pct<0 || Math.abs(eased-LY.pct)>=0.001 || eased===0 || eased===1){
        if(eased!==LY.pct){
          LY.pct=eased;
          el.style.setProperty("--fill",(eased*114).toFixed(2)+"%"); /* >100 so soft edge fully covers last word */
        }
      }
    }
  }
}
function bindLyricsUserScroll(){
  const box = document.getElementById("lyrics-scroll"); if(!box) return;
  const pause = ()=>{ lyricsUserScrollUntil = Date.now()+2500; };
  box.addEventListener("touchstart", pause, {passive:true});
  box.addEventListener("wheel", pause, {passive:true});
  box.addEventListener("click", function(e){
    const line = e.target.closest(".lyric-line");
    if(!line) return;
    const t = parseFloat(line.dataset.t);
    if(Number.isFinite(t)) seekToLyric(t);
  });
}
/* YouTube titles look like "Artist - Song (Official Video) | Label". Build clean (title, artist) candidates for the lyrics providers. */
function ytLyricTracks(track){
  const dec=v=>String(v||"").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#0?39;/g,"'").trim();
  const NOISE=/official|video|audio|lyric|visuali[sz]er|\bhd\b|4k|1080p|full\s+(video\s+)?song|music|\bmv\b|m\/v|out now|\bnew\b|latest|\b(19|20)\d\d\b|remaster|explicit|karaoke|status|reel/i;
  let raw=dec(track.name||track.title);
  raw=raw.replace(/\s*[\(\[][^\)\]]*[\)\]]/g,m=>NOISE.test(m)?"":m);
  const head=raw.split(/\s*\|\s*/)[0]
    .replace(/\b(official\s+(music\s+)?(video|audio|lyric\s+video)|lyrical\s+video|lyric\s+video|full\s+(video\s+)?song|video\s+song|audio\s+song|music\s+video|lyrics?|HD|4K)\b/gi,"")
    .replace(/\s+/g," ").replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g,"").trim();
  const ch=dec(track.artistName||track.artist).replace(/\s*-\s*Topic$/i,"").replace(/\s*\b(VEVO|Official|Music|Records|Entertainment|TV)\b/gi,"").trim();
  const noFeat=t=>t.replace(/\s+(feat\.?|ft\.?)\s+.*$/i,"").trim();
  const out=[], seen=new Set();
  const add=(name,artist)=>{
    name=noFeat(String(name||"").trim()); artist=String(artist||"").trim();
    const k=lyricsNorm(name)+"|"+lyricsNorm(artist);
    if(name&&!seen.has(k)){ seen.add(k); out.push({id:track.id,name:name,artistName:artist,albumName:"",duration:Math.round(Number(track.duration)||0),source:"youtube"}); }
  };
  const m=head.split(/\s+[-–—:]\s+/);
  if(m.length>=2){
    const L=m[0], R=m.slice(1).join(" - ");
    if(lyricsSimilarity(ch,R)>lyricsSimilarity(ch,L)+.2){ add(L,R); add(R,L); }   // "Song - Artist"
    else { add(R,L); add(L,R); }                                                   // "Artist - Song"
    add(head,ch);
  }else{
    const pp=raw.split(/\s*\|\s*/), last=pp.length>1?pp[pp.length-1].trim():"";   // "Song | Movie | Singer"
    if(last) add(head,last);
    add(head,ch); add(head,"");
  }
  /* clean title / artist / album from MusicBrainz, TheAudioDB or iTunes (auto-meta) goes first */
  try{
    const mc=JSON.parse(localStorage.getItem("bos_meta_v3")||"{}"), nm=String(track.name||"");
    const m=mc["y|"+nm+"|"+(track.artistName||"")]||mc["y|"+nm+"|"+(track.artistName||"")+" - Topic"];
    if(m&&m.title&&m.artist&&!seen.has(lyricsNorm(m.title)+"|"+lyricsNorm(m.artist))) out.unshift({id:track.id,name:m.title,artistName:m.artist,albumName:m.album||"",duration:Math.round(Number(track.duration)||0),source:"youtube"});
  }catch(e){}
  return out.slice(0,4);
}
async function fetchLyricsSmart(track,signal){
  if(!track||track.source!=="youtube") return fetchLyricsExpanded(track,signal);
  const cands=ytLyricTracks(track);
  /* synced lyrics first; plain lyrics only when no variant has synced */
  const rs=await Promise.all(cands.slice(0,3).map(c=>fetchLyricsExpanded(c,signal).catch(e=>{ if(e&&e.name==="AbortError") throw e; return null; })));
  const ok=rs.filter(d=>d&&d.lines&&d.lines.length);
  return ok.find(d=>d.synced&&!d.estimated)||ok.find(d=>d.synced)||ok[0]||null;
}
/* BOOSTER + : find a MY_LYRICS entry for any track (YouTube titles are matched on every cleaned candidate, fuzzy) */
function bosFindMyLyrics(track, lt){
  const list = window.MY_LYRICS||[]; if(!list.length) return null;
  const cands = (track && track.source==="youtube") ? ytLyricTracks(track) : [];
  if(lt) cands.unshift(lt);
  if(track) cands.push(track);
  const rawTitle = lyricsNorm(lyStrip(String((track&&(track.name||track.title))||"")));
  const artOK = (e,c)=>{
    if(!e.artist) return true;
    const ea = lyricsNorm(e.artist);
    return [c.artistName,c.artist,track&&track.artistName,track&&track.artist].some(a=>lyricsNorm(String(a||"")).includes(ea)) || rawTitle.includes(ea);
  };
  /* pass 1: exact title match */
  for(const c of cands){
    const tn = lyricsNorm(lyStrip(c.name||c.title||"")); if(!tn) continue;
    const e = list.find(e=>lyricsNorm(lyStrip(e.title||""))===tn && artOK(e,c));
    if(e) return e;
  }
  /* pass 2: fuzzy (YouTube only): same words / title contained in the video title */
  if(track && track.source==="youtube"){
    let best=null, bs=0;
    for(const e of list){
      const et = lyricsNorm(lyStrip(e.title||"")); if(!et || et.length<3) continue;
      if(!artOK(e,cands[0]||{})) continue;
      let s = 0;
      for(const c of cands){ s = Math.max(s, lyricsSimilarity(lyStrip(c.name||""), e.title)); }
      if((" "+rawTitle+" ").includes(" "+et+" ")) s = Math.max(s, .9);
      if(s>bs){ bs=s; best=e; }
    }
    if(best && bs>=.8) return best;
  }
  return null;
}
/* ===== AUTO-SYNC: plain lyrics -> line-by-line timed (estimated) so every song scrolls & highlights ===== */
function lySyll(t){
  t=String(t||"");
  const dev=(t.match(/[\u0900-\u097F]/g)||[]).length;
  if(dev>t.length*.3){ const v=(t.match(/[\u0904-\u0914\u093E-\u094C]/g)||[]).length, c=(t.match(/[\u0915-\u0939]/g)||[]).length; return Math.max(1,v+Math.round(c*.45)); }
  const m=t.toLowerCase().match(/[aeiouy]+/g); return Math.max(1,m?m.length:Math.ceil(t.length/3));
}
function lyEstimateTimes(plain,dur){
  const rows=[];
  plain.forEach(L=>{ if(!L.text){ if(rows.length) rows[rows.length-1].gap=1; } else rows.push({text:L.text,gap:0}); });
  if(!rows.length) return [];
  let D=Number(dur)||0; if(D<30) D=Math.max(150,rows.length*5.2);
  const intro=Math.min(20,Math.max(4,D*.06)), outro=Math.min(14,Math.max(3,D*.045));
  const usable=Math.max(rows.length*1.2,D-intro-outro);
  const U=rows.map(r=>Math.max(3,lySyll(r.text))+.9+((r.text.match(/[,;:!?…]/g)||[]).length)*.35+(r.gap?3.2:0));   /* syllables + breath + stanza break (instrumental) */
  const tot=U.reduce((a,b)=>a+b,0)||1;
  let cur=intro; const out=[];
  rows.forEach((r,i)=>{ out.push({time:+cur.toFixed(2),text:r.text}); cur+=usable*U[i]/tot; });
  for(let i=1;i<out.length;i++) if(out[i].time<out[i-1].time+.6) out[i].time=+(out[i-1].time+.6).toFixed(2);
  return out;
}
function lyMakeAuto(data,track){
  const plain=data._plain||lyPlainLines(data.lines.map(l=>l.text||"").join("\n"));
  const dur=lyricsTrackDuration(track);
  const lines=lyEstimateTimes(plain,dur);
  if(lines.length<2) return data;
  return {synced:true,estimated:true,wordSynced:false,source:String(data.source||"").replace(/-ESTIMATED$/,""),lines,s:data.s,rank:data.rank,autoDur:dur>=30,_plain:plain};
}
/* duration of the song often arrives after the lyrics -> re-time the estimate once it is known */
function lyWatchDuration(token){
  let n=0; const iv=setInterval(()=>{
    if(token!==lyricsRequestToken||!currentLyrics||!currentLyrics.estimated||currentLyrics.autoDur||++n>40){ clearInterval(iv); return; }
    if(lyricsTrackDuration(State.currentTrack)>=30){
      clearInterval(iv);
      const d=lyMakeAuto({source:currentLyrics.source,lines:currentLyrics.lines,_plain:currentLyrics._plain,s:currentLyrics.s,rank:currentLyrics.rank},State.currentTrack);
      lyricsPrepareWords(d.lines); currentLyrics=d; resetEstimatedLyricsClock(); LY.timesSrc=null;
      renderLyricsPane(); updateActiveLyric(primaryAudio().currentTime||0,true);
    }
  },800);
}
async function loadLyricsFor(track){
  const lt = track.source==="youtube" ? (ytLyricTracks(track)[0]||track) : track;   // clean title/artist for YouTube songs
  const key = lyricsCacheKey(lt);
  if(lyricsAbort.ctrl) lyricsAbort.ctrl.abort();
  const ctrl = lyricsAbort.ctrl = new AbortController();
  const token = ++lyricsRequestToken;
  currentLyrics = null; activeLyricIndex = -1;
  const box = document.getElementById("lyrics-scroll"); if(!box) return;
  State.lyricsData = {status:"loading"}; renderLyricsPane();
  const apply = data=>{
    if(data.estimated || data.synced===false) data = lyMakeAuto(data, State.currentTrack||track);   /* plain lyrics -> auto line-by-line timing */
    data = bosRomanizeLyrics(data);
    try{ if(window.bosFixLyrics) data = window.bosFixLyrics(data); }catch(e){}
    if(data.synced) lyricsPrepareWords(data.lines);
    currentLyrics = data; resetEstimatedLyricsClock(); LY.timesSrc=null;
    if(data.estimated && !data.autoDur) lyWatchDuration(token);
    State.lyricsData = {status:"ok", synced:data.synced?data.lines:null, plain:data.synced?"":data.lines.map(l=>l.text).join("\n"), estimated:false, source:data.source||""};
    renderLyricsPane(); updateActiveLyric(primaryAudio().currentTime||0, true);
  };
  /* MY_LYRICS (lyrics.js): your own lyrics win over cache + every API. Works for BOOSTER and BOOSTER + (YouTube) songs */
  try{
    const mine = bosFindMyLyrics(track, lt);
    if(mine && mine.lrc){
      const ml = parseLRC(mine.lrc);
      const md = ml.length>=2 ? {synced:true,estimated:false,source:"MY LYRICS",lines:ml}
                              : {synced:false,estimated:false,source:"MY LYRICS",lines:lyPlainLines(mine.lrc)};
      if(md.lines.length){ apply(md); return; }
    }
  }catch(e){}
  const cached = await getCachedLyrics(key);
  if(token!==lyricsRequestToken) return;
  if(cached){
    if(cached.empty && (Date.now()-(cached.ts||0))<30*60*1000){ State.lyricsData={status:"empty"}; renderLyricsPane(); return; }   // "no lyrics" is trusted for 12 h, then fetched again
    if(cached.lines && cached.lines.length){
      apply(cached);
      if((!cached.synced||cached.estimated) && (!cached.upg || Date.now()-cached.upg>72e5)){
        fetchLyricsSmart(track, ctrl.signal).then(d=>{
          if(token!==lyricsRequestToken) return;
          if(d && d.synced && !d.estimated && d.lines.length){ setCachedLyrics(key,d); apply(d); }
          else { cached.upg=Date.now(); setCachedLyrics(key,cached); }
        }).catch(()=>{});
      }
      return;
    }
  }
  try{
    const data = await fetchLyricsSmart(track, ctrl.signal);
    if(token!==lyricsRequestToken) return;
    if(!data || !data.lines.length){
      if(navigator.onLine!==false) setCachedLyrics(key,{empty:true,ts:Date.now()});
      State.lyricsData={status:"empty"}; renderLyricsPane(); return;
    }
    setCachedLyrics(key, data); apply(data);
    setTimeout(lyricsPrefetchNext, 2500);
  }catch(e){
    if(e && e.name==="AbortError") return;
    State.lyricsData = {status:"error", message:"Couldn't load lyrics. Network issue with the lyrics service."};
    renderLyricsPane();
  }
}
/* warm the cache for the next queued song so its lyrics appear instantly */
async function lyricsPrefetchNext(){
  try{
    const n = State.queue && State.queue[State.queueIndex+1]; if(!n) return;
    const k = lyricsCacheKey(n); if(await getCachedLyrics(k)) return;
    const d = await fetchLyricsExpanded(n);
    if(d && d.lines.length) setCachedLyrics(k,d); else if(navigator.onLine!==false) setCachedLyrics(k,{empty:true,ts:Date.now()});
  }catch(e){}
}
/* manual lyrics (paste LRC or plain text) — saved on this device, wins over every provider */
function lyricsManualSave(track,text){
  let d; const lines = parseLRC(text);
  if(lines.length>=2) d = {synced:true,estimated:false,source:"MANUAL",lines};
  else{
    const pl = lyPlainLines(text);
    if(!pl.length) return false;
    d = {synced:false,estimated:false,source:"MANUAL",lines:pl};
  }
  setCachedLyrics(lyricsCacheKey(track), d); return true;
}
function lyricsOpenManual(){
  const tr = State.currentTrack; if(!tr || document.getElementById("ly-manual")) return;
  const w = document.createElement("div"); w.id = "ly-manual";
  w.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;";
  w.innerHTML = '<div style="width:min(560px,100%);background:#15151f;color:#fff;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="font-weight:700;font-size:17px">Add lyrics for this song</div><div style="font-size:13px;opacity:.7">Paste synced LRC (lines like [00:12.30] ...) or plain lyrics. Saved on this device.</div><textarea id="ly-manual-ta" style="height:44vh;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;padding:12px;font-size:14px;line-height:1.5;font-family:inherit;resize:none"></textarea><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" id="ly-manual-x">Cancel</button><button class="btn" id="ly-manual-ok">Save</button></div></div>';
  document.body.appendChild(w);
  const close = ()=>w.remove();
  w.addEventListener("click",e=>{ if(e.target===w) close(); });
  w.querySelector("#ly-manual-x").onclick = close;
  w.querySelector("#ly-manual-ok").onclick = ()=>{
    const ok = lyricsManualSave(tr, w.querySelector("#ly-manual-ta").value);
    if(!ok){ toast("Couldn't read those lyrics"); return; }
    close(); toast("Lyrics saved"); Lyrics.loadFor(tr);
  };
  setTimeout(()=>{ const ta=w.querySelector("#ly-manual-ta"); if(ta) ta.focus(); },50);
}
function lyricsSourcePill(){
  const c=currentLyrics; if(!c) return "";
  const tag=(c.source||"").replace("-ESTIMATED","")+(c.generated?" · auto-generated from captions":"")+(c.wordSynced?" · word-synced":c.estimated?" · auto-timed (approx)":c.synced===false?" · plain":" · line-synced");
  return '<div style="text-align:center;font-size:11px;opacity:.45;padding:28px 0 8px;letter-spacing:.04em">Lyrics: '+escapeHTML(tag)+' · <span style="text-decoration:underline;cursor:pointer" onclick="lyricsOpenManual()">wrong lyrics? add yours</span></div>';
}
function renderLyricsPane(){
  const el = document.getElementById("lyrics-scroll"); if(!el) return;
  const d = State.lyricsData;
  if(!d || d.status==="loading"){ el.innerHTML='<div class="empty-state"><div class="es-icon">'+svgClock()+'</div><div class="es-title">Loading lyrics…</div></div>'; return; }
  if(d.status==="error"){ el.innerHTML='<div class="error-state"><div class="es-icon">'+svgAlert()+'</div><div class="es-title">Lyrics unavailable</div><div class="es-desc">'+esc(d.message)+'</div></div>'; return; }
  if(d.status==="empty"){ el.innerHTML='<div class="empty-state"><div class="es-icon">'+svgMusicEmpty()+'</div><div class="es-title">No lyrics found</div><div class="es-desc">We couldn\'t find lyrics for this track.</div><button class="btn btn-ghost mt-2" onclick="lyricsOpenManual()">Add lyrics manually</button></div>'; return; }
  if(currentLyrics && currentLyrics.lines && currentLyrics.lines.length){
    if(currentLyrics.synced && State.settings.syncedLyrics){
      el.innerHTML = currentLyrics.lines.map((l,i)=>renderLyricLine(l,i)).join("") + lyricsSourcePill();
    } else {
      el.innerHTML = currentLyrics.lines.map(l=>'<div class="lyric-line" style="opacity:1;color:var(--text-1) !important;transform:none;cursor:default;">'+(esc(l.text)||"&nbsp;")+'</div>').join("") + lyricsSourcePill();
    }
    return;
  }
  el.innerHTML = '<div class="empty-state"><div class="es-icon">'+svgMusicEmpty()+'</div><div class="es-title">No lyrics found</div></div>';
}
const Lyrics = { async loadFor(track){ await loadLyricsFor(track); } };
bindLyricsUserScroll();

/* ============================================================ RENDER: MINI / FULL PLAYER ============================================================ */
function swapArt(el,url){
  /* V18: keep the old artwork on screen until the new one has loaded (no blank flash on track change) */
  if(!el||!url||el.getAttribute("src")===url) return;
  const im=new Image(); let done=false;
  const go=()=>{ if(done) return; done=true; el.src=url; };
  im.onload=go; im.onerror=go; im.src=url;
  setTimeout(go,2500);
}
function renderMiniPlayer(){
  const t = State.currentTrack;
  if(!t){ $("#mini-player").classList.remove("show"); return; }
  $("#mini-player").classList.add("show");
  swapArt($("#mini-art"),t.image); $("#mini-art").onerror = function(){ this.src = FALLBACK_ART; };
  $("#mini-title").textContent=t.name;const ma=$("#mini-artist");ma.textContent=t.artistName||"Unknown Artist";ma.dataset.artistId=t.artistId||"";const mal=$("#mini-album");mal.textContent=t.albumName||"";mal.dataset.albumId=t.albumId||"";mal.style.display=t.albumName?"block":"none";
  const heartBtn=$("#mini-heart");
  heartBtn.classList.toggle("active", Favorites.isSongFav(t.id));
  heartBtn.innerHTML = svgHeart(Favorites.isSongFav(t.id));
}
function renderFullPlayer(){
  const t = State.currentTrack; if(!t) return;
  swapArt($("#fp-art"),t.image); $("#fp-art").onerror=function(){this.src=FALLBACK_ART;};
  $("#fp-title").textContent=t.name;const fa=$("#fp-artist");fa.textContent=t.artistName||"Unknown Artist";fa.dataset.artistId=t.artistId||"";const fal=$("#fp-album");fal.textContent=t.albumName||"";fal.dataset.albumId=t.albumId||"";fal.style.display=t.albumName?"block":"none";
  const heart=$("#fp-heart");
  heart.classList.toggle("active", Favorites.isSongFav(t.id));
  heart.innerHTML = svgHeart(Favorites.isSongFav(t.id));
  renderShuffleRepeatIcons();
}

/* ============================================================ RENDER HELPERS ============================================================ */
function skeletonCards(n){ let h=""; for(let i=0;i<n;i++) h+='<div class="skel-card"><div class="skel skel-art"></div><div class="skel skel-line" style="width:80%"></div><div class="skel skel-line" style="width:50%"></div></div>'; return h; }
function skeletonRows(n){ let h=""; for(let i=0;i<n;i++) h+='<div class="skel-row"><div class="skel skel-art"></div><div class="skel skel-line" style="width:60%"></div></div>'; return h; }
function songCard(t){
  return '<div class="card" data-action="play-song" data-id="'+esc(t.id)+'">'
    +'<div class="card-art"><img src="'+esc(t.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt="">'
    +'<button class="card-play" data-action="play-song" data-id="'+esc(t.id)+'" aria-label="Play">'+svgPlay()+'</button></div>'
    +'<div class="card-title">'+esc(t.name)+'</div><div class="card-sub">'+esc(t.artistName)+'</div></div>';
}
function albumCard(a){ return '<div class="card" data-action="open-album" data-id="'+esc(a.id)+'"><div class="card-art"><img src="'+esc(a.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div><div class="card-title">'+esc(a.name)+'</div><div class="card-sub">'+esc(a.artistName||a.year||"Album")+'</div></div>'; }
function artistCard(a){ return '<div class="card" data-action="open-artist" data-id="'+esc(a.id)+'"><div class="card-art round"><img src="'+esc(a.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div><div class="card-title" style="text-align:center">'+esc(a.name)+'</div><div class="card-sub" style="text-align:center">Artist</div></div>'; }
function playlistCard(p){ return '<div class="card" data-action="open-playlist" data-id="'+esc(p.id)+'"><div class="card-art"><img src="'+esc(p.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div><div class="card-title">'+esc(p.name)+'</div><div class="card-sub">'+(p.songCount||0)+' songs</div></div>'; }
function songRow(t,i,opts){
  opts = opts||{};
  const playing = State.currentTrack && State.currentTrack.id===t.id;
  return '<div class="row-item'+(playing?" playing":"")+'" data-action="play-song" data-id="'+esc(t.id)+'" data-ctx="'+esc(opts.ctxKey||"")+'">'
    +'<div class="row-art"><img src="'+esc(t.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div>'
    +'<div class="row-meta"><div class="row-title">'+esc(t.name)+'</div><div class="row-sub">'+esc(t.artistName)+'</div></div>'
    +(playing && State.isPlaying ? '<div class="eq-bars"><span></span><span></span><span></span></div>' : '')
    +'<button class="ctrl-btn heart-btn'+(Favorites.isSongFav(t.id)?" active":"")+'" data-action="toggle-fav-song" data-id="'+esc(t.id)+'" aria-label="Favorite">'+svgHeart(Favorites.isSongFav(t.id))+'</button>'
    +'<button class="ctrl-btn song-more" data-bosmenu="jio" data-id="'+esc(t.id)+'" aria-label="More options">'+svgMore()+'</button>'
    +'<div class="row-dur">'+fmtTime(t.duration)+'</div></div>';
}
const ctxStore = new Map();
function storeCtx(key, tracks){ ctxStore.set(key, tracks); return key; }
function emptyStateHTML(iconSvg, title, desc){ return '<div class="empty-state"><div class="es-icon">'+iconSvg+'</div><div class="es-title">'+esc(title)+'</div><div class="es-desc">'+esc(desc)+'</div></div>'; }
function errorStateHTML(msg, retryFnStr){ return '<div class="error-state"><div class="es-icon">'+svgAlert()+'</div><div class="es-title">Something went wrong</div><div class="es-desc">'+esc(msg)+'</div><button class="btn btn-ghost mt-2" onclick="'+esc(retryFnStr)+'">Retry</button></div>'; }
function backIcon(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>'; }

/* ============================================================ NAVIGATION — SPA / HISTORY API ============================================================ */
const NAV_TITLES={home:"Home",search:"Search",library:"Library",favorites:"Favorites",recent:"Recently Played",album:"Album",artist:"Artist",playlist:"Playlist",settings:"Settings",charts:"Top Charts",toplists:"Top Playlists","lib-songs":"Songs","lib-albums":"Albums","lib-artists":"Artists","lib-playlists":"Playlists",queue:"Queue",player:"Now Playing",lyrics:"Lyrics"};
function navHash(view,params){params=params||{};if(view==="home")return "#home";if(view==="search")return "#search"+(State.searchQuery?"?q="+encodeURIComponent(State.searchQuery):"");if(["album","artist","playlist"].includes(view))return "#"+view+"/"+encodeURIComponent(params.id||"");return "#"+view;}
function navState(view,params,depth,scrollTop){return {boosterOS:true,view:view,params:params||{},depth:Math.max(0,Number(depth)||0),scrollTop:Number(scrollTop)||0};}
var __inVT=false;
function navigate(){var a=arguments,self=this,r,ran=false,H=document.documentElement;
  /* V22: the blurred snapshot cross-fade (View Transitions) stacked on top of the page-enter + card animations and caused the flicker. One light fade only. */
  if(true)return __navCore.apply(self,a);
  try{H.classList.add("bos-vt");
    var t=document.startViewTransition(function(){ran=true;__inVT=true;try{r=__navCore.apply(self,a);}finally{__inVT=false;}});
    t.ready.catch(function(){});t.updateCallbackDone.catch(function(e){console.warn("navigate:",e);});
    t.finished.then(function(){H.classList.remove("bos-vt");},function(){H.classList.remove("bos-vt");});
  }catch(e){H.classList.remove("bos-vt");if(!ran)r=__navCore.apply(self,a);}
  return r;}
function __navCore(view,params,opts){
  params=params||{};opts=opts||{};
  if(["lib-songs","lib-albums","lib-artists","lib-playlists"].includes(view)){State.libTab=view.replace("lib-","");view="library";}
  if(view==="queue"){openQueuePanel();return;}
  const same=State.view===view&&JSON.stringify(State.viewParams||{})===JSON.stringify(params);
  const scrollEl=$("#view-scroll");
  const scroll=scrollEl?scrollEl.scrollTop:0;
  const hs=history.state&&history.state.boosterOS?history.state:null;
  let depth=hs?Number(hs.depth)||0:0;
  if(!opts.fromBack&&!same){depth++;history.pushState(navState(view,params,depth,scroll),"",navHash(view,params));}
  else if(!opts.fromBack&&!hs)history.replaceState(navState(view,params,0,0),"",navHash(view,params));

  const apply=()=>{
    State.viewParams=params;
    $$(".view").forEach(v=>v.classList.remove("active"));
    const map={home:"view-home",search:"view-search",library:"view-library",favorites:"view-library",recent:"view-library",album:"view-album",artist:"view-artist",playlist:"view-playlist",settings:"view-settings",charts:"view-charts",toplists:"view-toplists"};
    const target=map[view]||"view-home";
    $("#"+target).classList.add("active");State.view=view;
    $("#page-title").textContent=NAV_TITLES[view]||"Booster OS";
    $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.nav===view));
    $$(".bn-item").forEach(n=>n.classList.toggle("active",n.dataset.nav===view));
    if(opts.restoreScroll==null && !same && scrollEl){
      scrollEl.classList.add("no-smooth-scroll"); scrollEl.scrollTop=0;
      requestAnimationFrame(()=>scrollEl.classList.remove("no-smooth-scroll"));
    }
    if(opts.restoreScroll!=null){
      scrollEl.classList.add("no-smooth-scroll");
      scrollEl.scrollTop=Math.max(0,Number(opts.restoreScroll)||0);
      requestAnimationFrame(()=>scrollEl.classList.remove("no-smooth-scroll"));
    }
    if(view==="home"){if(!$("#view-home").querySelector(".section")||Date.now()-State._homeLoadedAt>120000)renderHome();}
    else if(view==="search"){ if(!(same && $("#search-input"))) renderSearchView(); }
    else if(view==="library")renderLibrary();
    else if(view==="charts")renderCharts();
    else if(view==="toplists")renderToplists();
    else if(view==="favorites"){State.libTab="favorites";renderLibrary();$("#page-title").textContent="Favorites";}
    else if(view==="recent"){State.libTab="recent";renderLibrary();$("#page-title").textContent="Recently Played";}
    else if(view==="album")renderAlbumDetail(params.id);
    else if(view==="artist")renderArtistDetail(params.id);
    else if(view==="playlist")renderPlaylistDetail(params.id);
    else if(view==="settings")renderSettings();
    if(scrollEl){scrollEl.classList.remove("nav-leave");scrollEl.classList.remove("nav-enter");void scrollEl.offsetWidth;scrollEl.classList.add("nav-enter");}
  };

  /* V18: no artificial exit delay; the page switches instantly and only the short enter animation plays */
  apply();
}

function goBack(){const hs=history.state;if(hs&&hs.boosterOS&&Number(hs.depth)>0){history.back();return;}if(State.view!=="home")navigate("home",{}, {fromBack:true});}
window.addEventListener("popstate",e=>{
  const s=e.state;if(!s||!s.boosterOS)return;
  if(s.view==="lyrics"){openFullPlayer({fromHistory:true});openLyrics({fromHistory:true});return;}
  if(s.view==="player"){closeLyrics({fromHistory:true});openFullPlayer({fromHistory:true});return;}
  var __fpWasOpen=$("#full-player").classList.contains("open");
  closeLyrics({fromHistory:true});closeFullPlayer({fromHistory:true});
  /* closing the player: the page underneath is already on screen, re-rendering it blocked the main thread (animation stall) and made cards blink */
  if(__fpWasOpen&&State.view===s.view&&JSON.stringify(State.viewParams||{})===JSON.stringify(s.params||{}))return;
  navigate(s.view,s.params||{},{fromBack:true,restoreScroll:s.scrollTop||0});
});

/* ============================================================ RENDER: HOME ============================================================ */
async function renderHome(){
  if(State._homeLoading)return;
  if($("#view-home").querySelector(".section")&&Date.now()-State._homeLoadedAt<120000)return;
  if(State._homeAbort)try{State._homeAbort.abort();}catch(_){}
  const ctl=new AbortController();State._homeAbort=ctl;State._homeLoading=true;const seq=++State._navSeq;State._homeSeenFamilies=new Set();
  const el=$("#view-home");let html="";
  if(State.history.length)html+=sectionSkeleton("recently-played-home","Jump Back In","Pick up where you left off");
  if(State.favSongs.length)html+=sectionSkeleton("favs-home","Your Favorites","Songs you love");
  html+=sectionSkeleton("trending","🔥 Trending Now","Fresh picks")+sectionSkeleton("freshpicks","✨ Fresh Picks","Different songs on every refresh")+sectionSkeleton("madeforyou","🎧 Made For You","Smart picks based on what you play")+sectionSkeleton("newreleases","🆕 New Releases","Fresh drops")+sectionSkeleton("playlists-home","Featured Playlists","Curated for every mood")+sectionSkeleton("albums-home","Popular Albums","Full-length favorites")+sectionSkeleton("artists-home","Popular Artists","Discover new voices");
  el.innerHTML=html;
  if(State.history.length){const recent=State.history.slice(0,12);fillSection("recently-played-home",recent,songCard);storeCtx("home-recent",recent);}
  if(State.favSongs.length){const favs=State.favSongs.slice(0,12);fillSection("favs-home",favs,songCard);storeCtx("home-favs",favs);}
  SmartRadio.homeSections(ctl.signal).then(x=>{
    if(ctl.signal.aborted||seq!==State._navSeq||State.view!=="home")return;
    fillSection("trending",x.trending,songCard);fillSection("freshpicks",x.fresh,songCard);fillSection("madeforyou",x.madeForYou,songCard);
    storeCtx("home-trending",x.trending);storeCtx("home-fresh",x.fresh);storeCtx("home-made",x.madeForYou);
  }).catch(()=>{});
  const seeds=shuffleArray(["New Hindi Songs","Latest Bollywood","New Indian Songs","2026 Hindi Songs"]).slice(0,2);
  Promise.all(seeds.map(q=>Api.searchSongs(q,Math.floor(Math.random()*2),12,ctl.signal))).then(rs=>{
    if(ctl.signal.aborted||seq!==State._navSeq||State.view!=="home")return;
    const raw=rs.flatMap(r=>(r.data&&r.data.results)||[]).map(normalizeSong).filter(Boolean),list=SmartRadio.filterCandidates(shuffleArray(raw),{current:State.currentTrack,extra:[]}).slice(0,12);
    fillSection("newreleases",list,songCard);storeCtx("home-new",list);
  }).catch(()=>{});
  safeLoad(()=>Api.searchPlaylists(shuffleArray(["Top Hits","Bollywood Hits","Hindi Party","Indian Hits"])[0],0,10,ctl.signal),r=>{if(seq===State._navSeq&&State.view==="home")fillSection("playlists-home",(r.data.results||[]).map(normalizePlaylist),playlistCard);},()=>hideSection("playlists-home"));
  safeLoad(()=>Api.searchAlbums(shuffleArray(["Hits","Bollywood","Hindi Hits","Indian Pop"])[0],0,10,ctl.signal),r=>{if(seq===State._navSeq&&State.view==="home")fillSection("albums-home",(r.data.results||[]).map(normalizeAlbum),albumCard);},()=>hideSection("albums-home"));
  safeLoad(()=>Api.searchArtists(shuffleArray(["Singh","Khan","Kakkar","Arijit"])[0],0,10,ctl.signal),r=>{if(seq===State._navSeq&&State.view==="home")fillSection("artists-home",(r.data.results||[]).map(normalizeArtist),artistCard);},()=>hideSection("artists-home"));
  State._homeLoadedAt=Date.now();State._homeLoading=false;
}
function sectionSkeleton(id,title,sub){return '<div class="section" id="sec-'+id+'"><div class="section-head"><div><div class="section-title">'+esc(title)+'</div><div class="section-sub">'+esc(sub)+'</div></div></div><div class="hscroll" id="sec-'+id+'-body">'+skeletonCards(6)+'</div></div>';}
function fillSection(id,items,cardFn){
  const body=$("#sec-"+id+"-body");if(!body)return;let list=Array.isArray(items)?items.filter(Boolean):[];
  if(State._homeSeenFamilies&&/^(trending|freshpicks|madeforyou|newreleases)$/.test(id)){const seen=State._homeSeenFamilies;list=list.filter(t=>{const fk=SmartRadio.familyKey(t)||String(t&&t.id||"");if(!fk||seen.has(fk))return false;seen.add(fk);return true;});}
  if(!list.length){hideSection(id);return;}body.innerHTML=list.map(cardFn).join("");
}
function hideSection(id){const s=$("#sec-"+id);if(s)s.style.display="none";}
async function safeLoad(fetcher,onSuccess,onFail){try{const r=await fetcher();if(r&&r.type==="aborted")return;onSuccess(r);}catch(e){if(e&&e.type==="aborted")return;console.warn(e);if(onFail)onFail(e);}}
/* ============================================================ RENDER: SEARCH ============================================================ */
function renderSearchView(){
  const el = $("#view-search");
  el.innerHTML = '<div class="search-bar glass-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
    +'<input type="text" id="search-input" placeholder="Search songs, artists, albums, playlists…" value="'+esc(State.searchQuery)+'" autocomplete="off">'
    +'<button class="icon-btn" id="search-clear" style="'+(State.searchQuery?"":"display:none")+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>'
    +'<div class="search-tabs" id="search-src" style="margin-bottom:10px;">'+[["jio","BOOSTER"],["bm","BOOSTMUSIC"]].map(p=>'<button class="stab'+((State.searchTab==="youtube"?"yt":State.searchTab==="music"?"bm":"jio")===p[0]?" active":"")+'" data-src="'+p[0]+'">'+p[1]+'</button>').join("")+'</div>'
    +'<div class="search-tabs" id="search-tabs"'+(State.searchTab==="youtube"||State.searchTab==="music"?' style="display:none"':'')+'>'+["all","songs","albums","artists","playlists"].map(tb=>'<button class="stab'+(State.searchTab===tb?" active":"")+'" data-tab="'+tb+'">'+(tb==="all"?"All":tb[0].toUpperCase()+tb.slice(1))+'</button>').join("")+'</div>'
    +'<div class="search-tabs" id="search-ytabs"'+(State.searchTab==="youtube"||State.searchTab==="music"?'':' style="display:none"')+'>'+["all","songs","albums","artists","playlists","party"].map(tb=>'<button class="stab'+((State.ytTab||"all")===tb?" active":"")+'" data-ytab="'+tb+'">'+(tb==="all"?"All":tb[0].toUpperCase()+tb.slice(1))+'</button>').join("")+'</div>'
    +'<div id="search-results"></div>';
  const input = $("#search-input");
  /* V22: auto-open the keyboard only on desktop and only for an empty search; on phones the user taps the bar */
  if(!State.searchQuery && window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches){ try{ input.focus({preventScroll:true}); }catch(_){} }
  const deb = debounce(()=>{ State.searchQuery = input.value.trim(); $("#search-clear").style.display = State.searchQuery?"":"none"; runSearch(); }, 200);
  input.addEventListener("input", deb);
  input.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); State.searchQuery = input.value.trim(); $("#search-clear").style.display = State.searchQuery?"":"none"; runSearch(); input.blur(); } });
  $("#search-clear").addEventListener("click", ()=>{ input.value=""; State.searchQuery=""; $("#search-clear").style.display="none"; runSearch(); input.focus(); });
  /* tabs: update in place. No re-render, no focus, so the keyboard never pops up */
  const tabsEl=$("#search-tabs");
  tabsEl.addEventListener("pointerdown", e=>{ if(e.target.closest(".stab") && document.activeElement===input){ e.preventDefault(); } });
  tabsEl.addEventListener("click", e=>{
    const b=e.target.closest(".stab"); if(!b) return;
    if(document.activeElement===input) input.blur();
    if(State.searchTab===b.dataset.tab) return;
    State.searchTab=b.dataset.tab;
    tabsEl.querySelectorAll(".stab").forEach(x=>x.classList.toggle("active",x===b));
    if(State.searchQuery) runSearch(); else renderSearchEmpty();
  });
  /* source switch: JioSaavn results and YouTube results live on separate tabs */
  const srcEl=$("#search-src"), ytabsEl=$("#search-ytabs");
  srcEl.addEventListener("pointerdown", e=>{ if(e.target.closest(".stab") && document.activeElement===input){ e.preventDefault(); } });
  srcEl.addEventListener("click", e=>{
    const b=e.target.closest(".stab"); if(!b) return;
    if(document.activeElement===input) input.blur();
    const want=b.dataset.src, cur=State.searchTab==="youtube"?"yt":State.searchTab==="music"?"bm":"jio";
    if(want===cur) return;
    if(cur==="jio") State._jioTab=State.searchTab;
    State.searchTab=want==="yt"?"youtube":want==="bm"?"music":(State._jioTab||"all");
    srcEl.querySelectorAll(".stab").forEach(x=>x.classList.toggle("active",x===b));
    tabsEl.style.display=want==="jio"?"":"none"; ytabsEl.style.display=(want==="yt"||want==="bm")?"":"none";
    tabsEl.querySelectorAll(".stab").forEach(x=>x.classList.toggle("active",x.dataset.tab===State.searchTab));
    if(State.searchQuery) runSearch(); else renderSearchEmpty();
  });
  ytabsEl.addEventListener("pointerdown", e=>{ if(e.target.closest(".stab") && document.activeElement===input){ e.preventDefault(); } });
  ytabsEl.addEventListener("click", e=>{
    const b=e.target.closest(".stab"); if(!b) return;
    if(document.activeElement===input) input.blur();
    if((State.ytTab||"all")===b.dataset.ytab) return;
    State.ytTab=b.dataset.ytab;
    ytabsEl.querySelectorAll(".stab").forEach(x=>x.classList.toggle("active",x===b));
    if(State.searchQuery) runSearch(); else renderSearchEmpty();
  });
  /* YouTube results: tap a song to play, tap an album / playlist / artist to open it */
  $("#search-results").addEventListener("click", e=>{
    if(!window.BosYT) return;
    const res=$("#search-results");
    { const chip=e.target.closest(".pty-chip"); if(chip){ State._ptyCat=chip.dataset.cat; res.innerHTML=bosPartyRows(); return; } }
    if(e.target.closest("#yt-back")){ const bk=State._ytBack; if(bk){ res.innerHTML=bk.html; State._ytRes=bk.list; } return; }
    if(e.target.closest("#yt-playall")){ if(State._ytRes&&State._ytRes.length) window.BosYT.play(State._ytRes,0); return; }
    const card=e.target.closest(".yt-card"); if(card){ openYtCollection(State._ytCards&&State._ytCards[card.dataset.ytkey]); return; }
    const b=e.target.closest(".yt-res"); if(!b) return;
    if(document.activeElement===input) input.blur();
    { const _r=(State._ytRes||[])[+b.dataset.yi]; if(_r){ if(_r.it&&res.querySelector("#yt-back")) window.BosYT.play(State._ytRes,+b.dataset.yi); else window.BosYT.play([_r], 0); } }   /* only the tapped song; Autoplay adds the rest */
  });
  /* scrolling the results hides the keyboard */
  const vsEl=$("#view-scroll");
  if(vsEl && !vsEl._bosKb){ vsEl._bosKb=true; vsEl.addEventListener("touchmove",()=>{ const a=document.activeElement; if(a&&a.id==="search-input") a.blur(); },{passive:true}); }
  if(State.searchQuery) runSearch(); else renderSearchEmpty();
}
function renderSearchEmpty(){ $("#search-results").innerHTML = emptyStateHTML(svgMusicEmpty(),"Find your next favorite track","Search across millions of songs, albums, artists and playlists."); }
function bosYtFetch(q,type){ try{ if(window.BosYT) return window.BosYT.search(q,type||"video").catch(()=>[]); }catch(_){} return Promise.resolve([]); }
async function bosSongs(q){ try{ if(window.BosIT){ const r=await window.BosIT.search(q,25); if(r.length) return r; } }catch(_){} return bosYtFetch(q,"video"); }
function ytAbs(u,h){ u=String(u||""); if(!u) return ""; if(u.indexOf("//")===0) return "https:"+u; if(u.charAt(0)==="/") return (h||"")+u; return u; }
function ytArt(x){
  if(x.type==="channel"){ const t=x.authorThumbnails||[]; const p=t.find(a=>a.width>=150)||t[t.length-1]; return p?ytAbs(p.url,x._host):""; }
  if(x.type==="playlist"){ const v=x.videos&&x.videos[0]; if(v&&v.videoId) return "https://i.ytimg.com/vi/"+v.videoId+"/mqdefault.jpg"; return ytAbs(x.playlistThumbnail,x._host); }
  return "https://i.ytimg.com/vi/"+x.videoId+"/mqdefault.jpg";
}
function ytFmtNum(n){ n=+n||0; return n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,"")+"M":n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,"")+"K":String(n); }
function ytCardsHTML(list,kind){
  State._ytCards=State._ytCards||{};
  return list.map(x=>{
    const id=kind==="channel"?x.authorId:x.playlistId; if(!id) return "";
    const title=kind==="channel"?x.author:x.title, img=ytArt(x);
    const sub=kind==="channel"?(x.subCount?ytFmtNum(x.subCount)+" subscribers":"Artist"):((x.author||"")+(x.videoCount?" • "+x.videoCount+" songs":""));
    const key=kind+":"+id; State._ytCards[key]={kind:kind,id:id,title:title||"",sub:sub,img:img};
    return '<div class="card yt-card" data-ytkey="'+esc(key)+'"><div class="card-art'+(kind==="channel"?" round":"")+'"><img src="'+esc(img)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div><div class="card-title"'+(kind==="channel"?' style="text-align:center"':'')+'>'+esc(title||"")+'</div><div class="card-sub"'+(kind==="channel"?' style="text-align:center"':'')+'>'+esc(sub)+'</div></div>';
  }).join("");
}
function ytRowsHTML(list){
  return '<div class="row-list">'+list.map((v,i)=>'<button type="button" class="yt-res" '+(v.it?'data-bos-meta="1" ':'')+'data-yi="'+i+'" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:8px;margin:0 0 8px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:inherit;font:inherit;cursor:pointer"><img src="'+(v.it?esc(v.art):'https://i.ytimg.com/vi/'+esc(v.videoId)+'/mqdefault.jpg')+'" alt="" loading="lazy" onerror="this.src=\''+FALLBACK_ART+'\'" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none;background:#222"><div style="min-width:0"><b style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:600">'+esc(v.title)+'</b><small style="opacity:.6">'+esc(v.author||"")+'</small></div><span role="button" tabindex="0" class="ctrl-btn song-more" data-bosmenu="yt" data-yi="'+i+'" aria-label="More options" style="margin-left:auto;flex:none">'+svgMore()+'</span></button>').join("")+'</div>';
}
async function openYtCollection(c){
  if(!c||!window.BosYT) return;
  const res=$("#search-results"); if(!(State._ytBack&&res.querySelector("#yt-back"))) State._ytBack={html:res.innerHTML,list:State._ytRes};
  const seq=++State._searchSeq;
  const head='<button class="icon-btn" id="yt-back" style="margin-bottom:10px;">'+backIcon()+'</button><div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;flex-wrap:wrap"><div class="card-art'+(c.kind==="channel"?" round":"")+'" style="width:120px;flex:none"><img loading="lazy" decoding="async" src="'+esc(c.img)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt=""></div><div style="min-width:0;flex:1"><div class="section-title" style="margin:0 0 4px">'+esc(c.title)+'</div><div class="card-sub">'+esc(c.sub)+'</div>';
  res.innerHTML=head+'</div></div><div class="row-list">'+skeletonRows(6)+'</div>';
  let vids=[];
  try{
    if(c.kind==="itAlbum") vids=await window.BosIT.albumTracks(c.id);
    else if(c.kind==="itArtist") vids=await window.BosIT.artistSongs(c.id);
    else if(c.kind==="mplaylist"){ try{ vids=await bosPipedTry(()=>window.BosYT.musicPlaylistSongs(c.id),4000); }catch(_){} if(!vids||!vids.length) vids=await window.BosYT.collection("playlist",c.id); }
    else vids=await window.BosYT.collection(c.kind,c.id);
  }catch(_){}
  if(seq!==State._searchSeq) return;
  if(!vids.length){ res.innerHTML=head+'</div></div>'+emptyStateHTML(svgMusicEmpty(),"Could not load songs","Servers are busy. Go back and try again."); return; }
  State._ytRes=vids.slice(0,100);
  res.innerHTML=head+'<button class="btn btn-primary" id="yt-playall" style="margin-top:12px">'+svgPlay()+' Play All</button></div></div>'+ytRowsHTML(State._ytRes);
}
/* BOOSTMUSIC: YouTube Music songs only (official audio / topic uploads), no server needed */
function bosPipedDown(){ return Date.now()<(window.__pdUntil||0); }
function bosPipedTry(p,ms){ if(bosPipedDown()) return Promise.reject(0); return Promise.race([Promise.resolve().then(p),new Promise((_,j)=>setTimeout(()=>j(0),ms||3500))]).catch(e=>{ window.__pdUntil=Date.now()+6e5; throw e; }); }
async function bosMusicSongs(q){ try{ if(window.BosIT){ const r=await window.BosIT.search(q,25); if(r&&r.length) return r; } }catch(_){} let l=[]; try{ if(window.BosYT&&window.BosYT.musicSearch) l=(await bosPipedTry(()=>window.BosYT.musicSearch(q)))||[]; }catch(_){} if(l.length) return l; return bosSongs(q); }
async function bosItAlbums(q){ try{ return window.BosIT&&window.BosIT.albums?await window.BosIT.albums(q,24):[]; }catch(_){ return []; } }
async function bosItArtists(q){ try{ return window.BosIT&&window.BosIT.artists?await window.BosIT.artists(q,24):[]; }catch(_){ return []; } }
async function bosMusicPlaylists(q){ let l=[]; try{ if(window.BosYT&&window.BosYT.musicPlaylists) l=(await bosPipedTry(()=>window.BosYT.musicPlaylists(q)))||[]; }catch(_){} if(l.length) return {list:l,kind:"mplaylist"}; return {list:await bosYtFetch(q,"playlist"),kind:"playlist"}; }
function itCardsHTML(list,kind){
  State._ytCards=State._ytCards||{};
  return list.map(x=>{
    const key=kind+":"+x.id, art=kind==="itArtist";
    const sub=art?"Artist":((x.artist||"")+(x.count?" \u2022 "+x.count+" songs":""));
    State._ytCards[key]={kind:kind,id:x.id,title:x.title||"",sub:sub,img:x.img||""};
    return '<div class="card yt-card" data-ytkey="'+esc(key)+'"><div class="card-art'+(art?" round":"")+'"><img src="'+esc(x.img||FALLBACK_ART)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div><div class="card-title"'+(art?' style="text-align:center"':'')+'>'+esc(x.title||"")+'</div><div class="card-sub"'+(art?' style="text-align:center"':'')+'>'+esc(sub)+'</div></div>';
  }).join("");
}
async function runMusicSearch(q,ctl,seq,res){ return runYtSearch(q,ctl,seq,res,true); }
const BOS_PARTY_CATS=[["all","All"],["dj","DJ Remix"],["halgi","Halgi"],["sound","Soundcheck"],["road","Roadshow"]];
function bosPartyCat(t){ t=String(t||""); if(/halgi|haldi|dholki|tasha|banjo/i.test(t)) return "halgi"; if(/sound\s?check|bass\s?(test|boost)|vibration|competition/i.test(t)) return "sound"; if(/road\s?show|baraat|procession|visarjan|morcha/i.test(t)) return "road"; if(/remix|\bdj\b|\bmix\b|edm|club|bounce|mashup|dance/i.test(t)) return "dj"; return ""; }
function bosPartyRel(title,q){ const w=x=>String(x).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(a=>a.length>1&&!/^(dj|remix|mix|song|video|full|new|official|audio|hd|lyrical|halgi|soundcheck|roadshow)$/.test(a)); const qw=w(q); if(!qw.length) return true; const tw=new Set(w(title)); let c=0; qw.forEach(a=>{ if(tw.has(a)) c++; }); return c/qw.length>=.5; }
function bosPartyRows(){
  const all=State._ptyAll||[], cat=State._ptyCat||"all", list=all.filter(v=>cat==="all"||v.cat===cat); State._ytRes=list;
  const chips='<div class="pty-chips">'+BOS_PARTY_CATS.map(c=>'<button type="button" class="pty-chip'+(c[0]===cat?" active":"")+'" data-cat="'+c[0]+'">'+c[1]+(c[0]==="all"?"":" ("+all.filter(v=>v.cat===c[0]).length+")")+'</button>').join("")+'</div>';
  return chips+(list.length?ytRowsHTML(list):'<div class="card-sub" style="padding:18px 4px">Nothing in this category yet</div>');
}
async function bosPartySearch(q,ctl,seq,res){
  const ok=()=>!ctl.signal.aborted&&seq===State._searchSeq;
  State._ptyAll=[]; State._ptyCat="all"; const seen=new Set(); let done=0;
  const qs=[q+" dj remix",q+" dj halgi mix",q+" dj soundcheck",q+" roadshow dj",q+" dj competition mix"];
  qs.forEach(qq=>{ bosYtFetch(qq,"video").then(list=>{ if(!ok()) return; (list||[]).forEach(v=>{ if(!v||!v.videoId||seen.has(v.videoId)||(+v.lengthSeconds||0)>1500) return; const c=bosPartyCat(v.title); if(!c||!bosPartyRel(v.title,q)) return; seen.add(v.videoId); State._ptyAll.push({videoId:v.videoId,title:v.title,author:v.author||"",lengthSeconds:v.lengthSeconds||0,cat:c}); }); }).catch(()=>{}).then(()=>{ if(!ok()) return; done++; if(!State._ptyAll.length){ if(done===qs.length) renderNoResults(res); return; } res.innerHTML=bosPartyRows(); }); });
}
async function bosVideoSearch(q,ctl,seq,res){
  const ok=()=>!ctl.signal.aborted&&seq===State._searchSeq;
  const r=await Promise.all([bosYtFetch(q+" official video","video"),bosYtFetch(q+" video song","video")]); if(!ok()) return;
  const seen=new Set(), list=[]; [].concat(r[0]||[],r[1]||[]).forEach(v=>{ if(!v||!v.videoId||seen.has(v.videoId)||(+v.lengthSeconds||0)>1200) return; seen.add(v.videoId); list.push(v); });
  if(!list.length) return renderNoResults(res);
  State._ytRes=list.slice(0,30); res.innerHTML='<div class="card-sub" style="margin:2px 2px 10px">Tap a video: it opens in the full player with video on</div>'+ytRowsHTML(State._ytRes);
}
async function runYtSearch(q,ctl,seq,res,music){
  const tab=State.ytTab||"all", ok=()=>!ctl.signal.aborted&&seq===State._searchSeq;
  const getSongs=music?bosMusicSongs:bosSongs;
  const tagIt=l=>{ l=l||[]; l._it=1; return l; };
  const albumsF=music?(()=>bosItAlbums(q)):(async()=>{ const l=await bosItAlbums(q); return l.length?tagIt(l):bosYtFetch(q+" album","playlist"); }), artistsF=music?(()=>bosItArtists(q)):(async()=>{ const l=await bosItArtists(q); return l.length?tagIt(l):bosYtFetch(q,"channel"); });
  const albumKind=music?"itAlbum":"playlist", artistKind=music?"itArtist":"channel";
  const cards=(l,k)=>(music||l._it)?itCardsHTML(l,music?k:(k==="channel"?"itArtist":"itAlbum")):ytCardsHTML(l,k);
  if(tab==="party") return bosPartySearch(q,ctl,seq,res);
  if(tab==="video") return bosVideoSearch(q,ctl,seq,res);
  if(tab==="songs"){
    const yt=await getSongs(q); if(!ok()) return; if(!yt.length) return renderNoResults(res);
    State._ytRes=yt.slice(0,25); res.innerHTML=ytRowsHTML(State._ytRes);
  }else if(tab==="albums"){
    const l=await albumsF(); if(!ok()) return; if(!l.length) return renderNoResults(res);
    res.innerHTML='<div class="grid">'+cards(Object.assign(l.slice(0,24),{_it:l._it}),albumKind)+'</div>';
  }else if(tab==="playlists"){
    let l,k="playlist"; if(music){ const r=await bosMusicPlaylists(q); l=r.list; k=r.kind; } else l=await bosYtFetch(q,"playlist");
    if(!ok()) return; if(!l.length) return renderNoResults(res);
    res.innerHTML='<div class="grid">'+ytCardsHTML(l.slice(0,24),k)+'</div>';
  }else if(tab==="artists"){
    const l=await artistsF(); if(!ok()) return; if(!l.length) return renderNoResults(res);
    res.innerHTML='<div class="grid">'+cards(Object.assign(l.slice(0,24),{_it:l._it}),artistKind)+'</div>';
  }else{
    const [v,al,ar]=await Promise.all([getSongs(q),albumsF(),artistsF()]); if(!ok()) return;
    let html="";
    if(v.length){ State._ytRes=v.slice(0,8); html+='<div class="section-title" style="margin:6px 0 10px;">Songs</div>'+ytRowsHTML(State._ytRes); }
    if(al.length) html+='<div class="section-title" style="margin:20px 0 10px;">Albums</div><div class="hscroll">'+cards(Object.assign(al.slice(0,12),{_it:al._it}),albumKind)+'</div>';
    if(ar.length) html+='<div class="section-title" style="margin:20px 0 10px;">Artists</div><div class="hscroll">'+cards(Object.assign(ar.slice(0,12),{_it:ar._it}),artistKind)+'</div>';
    if(!html) return renderNoResults(res); res.innerHTML=html;
  }
}
window.__bosOpenYtColl=function(c){ return openYtCollection(c); };
async function runSearch(){
  const res=$("#search-results"),q=State.searchQuery;if(!q){renderSearchEmpty();return;}
  if(State._searchAbort)try{State._searchAbort.abort();}catch(_){}
  const ctl=new AbortController();State._searchAbort=ctl;const seq=++State._searchSeq;res.innerHTML='<div class="row-list">'+skeletonRows(6)+'</div>';
  try{
    if(State.searchTab==="all"){
      let r=null,jsErr=null;try{r=await Api.searchAll(q,ctl.signal);}catch(e){if(e&&e.type==="aborted")throw e;jsErr=e;}
      if(ctl.signal.aborted||seq!==State._searchSeq)return;
      const d=(r&&r.data)||{},songs=(d.songs&&d.songs.results||[]).map(normalizeSongFromCompact),albums=(d.albums&&d.albums.results||[]).map(normalizeAlbumFromCompact),artists=(d.artists&&d.artists.results||[]).map(normalizeArtistFromCompact);let html="";
      if(songs.length){storeCtx("search-all",songs);html+='<div class="section-title" style="margin:6px 0 10px;">Songs</div><div class="row-list">'+songs.map((s,i)=>songRow(s,i,{ctxKey:"search-all"})).join("")+'</div>';}
      if(albums.length)html+='<div class="section-title" style="margin:20px 0 10px;">Albums</div><div class="hscroll">'+albums.map(albumCard).join("")+'</div>';
      if(artists.length)html+='<div class="section-title" style="margin:20px 0 10px;">Artists</div><div class="hscroll">'+artists.map(artistCard).join("")+'</div>';
      if(!html){if(jsErr)throw jsErr;return renderNoResults(res);}
      res.innerHTML=html;
    }else if(State.searchTab==="songs"){const r=await Api.searchSongs(q,0,30,ctl.signal);if(ctl.signal.aborted||seq!==State._searchSeq)return;const list=(r.data.results||[]).map(normalizeSong);if(!list.length)return renderNoResults(res);storeCtx("search-songs",list);res.innerHTML='<div class="row-list">'+list.map((s,i)=>songRow(s,i,{ctxKey:"search-songs"})).join("")+'</div>';
    }else if(State.searchTab==="albums"){const r=await Api.searchAlbums(q,0,24,ctl.signal);if(ctl.signal.aborted||seq!==State._searchSeq)return;const list=(r.data.results||[]).map(normalizeAlbum);if(!list.length)return renderNoResults(res);res.innerHTML='<div class="grid">'+list.map(albumCard).join("")+'</div>';
    }else if(State.searchTab==="artists"){const r=await Api.searchArtists(q,0,24,ctl.signal);if(ctl.signal.aborted||seq!==State._searchSeq)return;const list=(r.data.results||[]).map(normalizeArtist);if(!list.length)return renderNoResults(res);res.innerHTML='<div class="grid">'+list.map(artistCard).join("")+'</div>';
    }else if(State.searchTab==="youtube"){await runYtSearch(q,ctl,seq,res);
    }else if(State.searchTab==="music"){await runMusicSearch(q,ctl,seq,res);
    }else if(State.searchTab==="playlists"){const r=await Api.searchPlaylists(q,0,24,ctl.signal);if(ctl.signal.aborted||seq!==State._searchSeq)return;const list=(r.data.results||[]).map(normalizePlaylist);if(!list.length)return renderNoResults(res);res.innerHTML='<div class="grid">'+list.map(playlistCard).join("")+'</div>';}
  }catch(err){if(err&&err.type==="aborted")return;if(seq===State._searchSeq)res.innerHTML=errorStateHTML(err.message||"Search failed. Please try again.","runSearch()");}
}
function renderNoResults(res){ res.innerHTML = emptyStateHTML(svgMusicEmpty(),"No results found","Try a different search term or check your spelling."); }

/* ============================================================ RENDER: LIBRARY ============================================================ */
function renderLibrary(){
  const el = $("#view-library");
  const tabs = ["favorites","songs","albums","artists","playlists","recent"];
  const labels = { favorites:"Favorites", songs:"Songs", albums:"Albums", artists:"Artists", playlists:"Playlists", recent:"Recently Played" };
  el.innerHTML = '<div class="search-tabs">'+tabs.map(tb=>'<button class="stab'+(State.libTab===tb?" active":"")+'" data-libtab="'+tb+'">'+labels[tb]+'</button>').join("")+'</div><div id="library-body"></div>';

  $$('[data-libtab]').forEach(b=>b.addEventListener("click", ()=>{ State.libTab=b.dataset.libtab; renderLibrary(); }));
  const body = $("#library-body");
  if(State.libTab==="favorites"){
    if(!State.favSongs.length){ body.innerHTML = emptyStateHTML(svgHeart(false),"No favorites yet","Tap the heart icon on any song to save it here."); return; }
    storeCtx("lib-favs", State.favSongs);
    body.innerHTML = '<div class="detail-actions" style="margin-bottom:16px;"><button class="btn btn-primary" data-action="play-all" data-ctx="lib-favs">'+svgPlay()+' Play All</button></div><div class="row-list">'+State.favSongs.map((s,i)=>songRow(s,i,{ctxKey:"lib-favs"})).join("")+'</div>';
  } else if(State.libTab==="songs"){
    if(!State.favSongs.length){ body.innerHTML = emptyStateHTML(svgMusicEmpty(),"No saved songs","Songs you like will appear here for quick access."); return; }
    storeCtx("lib-songs", State.favSongs);
    body.innerHTML = '<div class="row-list">'+State.favSongs.map((s,i)=>songRow(s,i,{ctxKey:"lib-songs"})).join("")+'</div>';
  } else if(State.libTab==="albums"){
    if(!State.favAlbums.length){ body.innerHTML = emptyStateHTML(svgMusicEmpty(),"No saved albums","Albums you favorite will show up here."); return; }
    body.innerHTML = '<div class="grid">'+State.favAlbums.map(albumCard).join("")+'</div>';
  } else if(State.libTab==="artists"){
    if(!State.favArtists.length){ body.innerHTML = emptyStateHTML(svgMusicEmpty(),"No followed artists","Follow artists to keep track of your favorites."); return; }
    body.innerHTML = '<div class="grid">'+State.favArtists.map(artistCard).join("")+'</div>';
  } else if(State.libTab==="playlists"){
    if(!State.favPlaylists.length){ body.innerHTML = emptyStateHTML(svgMusicEmpty(),"No saved playlists","Playlists you favorite will show up here."); return; }
    body.innerHTML = '<div class="grid">'+State.favPlaylists.map(playlistCard).join("")+'</div>';
  } else if(State.libTab==="recent"){
    if(!State.history.length){ body.innerHTML = emptyStateHTML(svgClock(),"No listening history yet","Tracks you play will show up here."); return; }
    storeCtx("lib-recent", State.history);
    body.innerHTML = '<div class="detail-actions" style="margin-bottom:16px;"><button class="btn btn-ghost btn-danger" data-action="clear-history">'+svgTrash()+' Clear History</button></div><div class="row-list">'+State.history.map((s,i)=>songRow(s,i,{ctxKey:"lib-recent"})).join("")+'</div>';
  }
}

/* ============================================================ RENDER: DETAIL VIEWS ============================================================ */
function detailSkeleton(round){
  return '<div class="detail-hero"><div class="skel detail-art'+(round?" round":"")+'" style="border-radius:'+(round?"999px":"22px")+'"></div>'
    +'<div style="flex:1;min-width:220px;"><div class="skel skel-line" style="width:80px;height:10px;"></div><div class="skel skel-line" style="width:60%;height:30px;margin-top:14px;"></div><div class="skel skel-line" style="width:40%;"></div></div></div>'
    +'<div class="row-list">'+skeletonRows(6)+'</div>';
}
async function renderAlbumDetail(id){
  const el=$("#view-album");el.innerHTML=detailSkeleton();if(State._detailAbort)try{State._detailAbort.abort();}catch(_){}
  const ctl=new AbortController();State._detailAbort=ctl;const seq=++State._detailSeq;
  try{const r=await Api.getAlbum(id,ctl.signal);if(ctl.signal.aborted||seq!==State._detailSeq||State.view!=="album"||String(State.viewParams.id)!==String(id))return;const album=normalizeAlbum(r.data);if(!album)throw {message:"Unable to load this album."};storeCtx("album-"+id,album.songs||[]);const fav=Favorites.isAlbumFav(album.id);
    el.innerHTML='<button class="icon-btn mobile-only" data-action="back" style="margin-bottom:10px;">'+backIcon()+'</button><div class="detail-hero"><div class="detail-art"><img loading="lazy" decoding="async" src="'+esc(album.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt=""></div><div><div class="detail-kicker">Album</div><div class="detail-title">'+esc(album.name)+'</div><button class="detail-sub detail-link" data-action="open-artist-by-name" data-name="'+esc(album.artistName)+'">'+esc(album.artistName)+' · '+esc(album.year)+' · '+(album.songs?album.songs.length:0)+' songs</button><div class="detail-actions"><button class="btn btn-primary" data-action="play-all" data-ctx="album-'+esc(id)+'">'+svgPlay()+' Play</button><button class="icon-btn glass-1 heart-btn'+(fav?" active":"")+'" data-action="toggle-fav-album" data-id="'+esc(album.id)+'" data-name="'+esc(album.name)+'" data-image="'+esc(album.image)+'" data-artist="'+esc(album.artistName)+'">'+svgHeart(fav)+'</button></div></div></div><div class="row-list">'+(album.songs||[]).map((s,i)=>songRow(s,i,{ctxKey:"album-"+id})).join("")+'</div>';
  }catch(err){if(err&&err.type==="aborted")return;if(seq===State._detailSeq&&State.view==="album")el.innerHTML=errorStateHTML(err.message||"Unable to load this album.","navigate('album',{id:'"+jsq(id)+"'});");}
}
async function renderArtistDetail(id){
  const el=$("#view-artist");el.innerHTML=detailSkeleton(true);if(State._detailAbort)try{State._detailAbort.abort();}catch(_){}
  const ctl=new AbortController();State._detailAbort=ctl;const seq=++State._detailSeq;
  try{const r=await Api.getArtist(id,ctl.signal);if(ctl.signal.aborted||seq!==State._detailSeq||State.view!=="artist"||String(State.viewParams.id)!==String(id))return;const artist=normalizeArtist(r.data);if(!artist)throw {message:"Unable to load this artist."};storeCtx("artist-"+id,artist.topSongs);const fav=Favorites.isArtistFav(artist.id);
    el.innerHTML='<button class="icon-btn mobile-only" data-action="back" style="margin-bottom:10px;">'+backIcon()+'</button><div class="detail-hero"><div class="detail-art round"><img loading="lazy" decoding="async" src="'+esc(artist.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt=""></div><div><div class="detail-kicker">Artist</div><div class="detail-title">'+esc(artist.name)+'</div><div class="detail-sub">'+(artist.followerCount?(artist.followerCount.toLocaleString()+" followers"):"")+'</div><div class="detail-actions"><button class="btn btn-primary" data-action="play-all" data-ctx="artist-'+esc(id)+'">'+svgPlay()+' Play</button><button class="icon-btn glass-1 heart-btn'+(fav?" active":"")+'" data-action="toggle-fav-artist" data-id="'+esc(artist.id)+'" data-name="'+esc(artist.name)+'" data-image="'+esc(artist.image)+'">'+svgHeart(fav)+'</button></div></div></div><div class="section-title" style="margin-bottom:12px;">Top Songs</div><div class="row-list">'+artist.topSongs.map((s,i)=>songRow(s,i,{ctxKey:"artist-"+id})).join("")+'</div><div class="section" style="margin-top:26px;"><div class="section-title" style="margin-bottom:12px;">Albums</div><div class="hscroll" id="artist-albums-body">'+skeletonCards(5)+'</div></div>'+(artist.bio?'<div class="section"><div class="section-title" style="margin-bottom:10px;">About</div><div class="es-desc" style="max-width:640px;text-align:left;">'+esc(artist.bio.slice(0,600))+(artist.bio.length>600?"…":"")+'</div></div>':"");
    const r2=await Api.getArtistAlbums(id,0,ctl.signal);if(ctl.signal.aborted||seq!==State._detailSeq||State.view!=="artist"||String(State.viewParams.id)!==String(id))return;const albums=(r2.data.albums||[]).map(normalizeAlbum),body=$("#artist-albums-body");if(body)body.innerHTML=albums.length?albums.map(albumCard).join(""):'<div class="es-desc">No albums found.</div>';
  }catch(err){if(err&&err.type==="aborted")return;if(seq===State._detailSeq&&State.view==="artist")el.innerHTML=errorStateHTML(err.message||"Unable to load this artist.","navigate('artist',{id:'"+jsq(id)+"'});");}
}
async function renderPlaylistDetail(id){
  const el=$("#view-playlist");el.innerHTML=detailSkeleton();if(State._detailAbort)try{State._detailAbort.abort();}catch(_){}
  const ctl=new AbortController();State._detailAbort=ctl;const seq=++State._detailSeq;
  try{const r=await Api.getPlaylist(id,ctl.signal);if(ctl.signal.aborted||seq!==State._detailSeq||State.view!=="playlist"||String(State.viewParams.id)!==String(id))return;const pl=normalizePlaylist(r.data);if(!pl)throw {message:"Unable to load this playlist."};storeCtx("playlist-"+id,pl.songs||[]);const fav=Favorites.isPlaylistFav(pl.id);
    el.innerHTML='<button class="icon-btn mobile-only" data-action="back" style="margin-bottom:10px;">'+backIcon()+'</button><div class="detail-hero"><div class="detail-art"><img loading="lazy" decoding="async" src="'+esc(pl.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt=""></div><div><div class="detail-kicker">Playlist</div><div class="detail-title">'+esc(pl.name)+'</div><div class="detail-sub">'+(pl.songs?pl.songs.length:0)+' songs</div><div class="detail-actions"><button class="btn btn-primary" data-action="play-all" data-ctx="playlist-'+esc(id)+'">'+svgPlay()+' Play</button><button class="icon-btn glass-1 heart-btn'+(fav?" active":"")+'" data-action="toggle-fav-playlist" data-id="'+esc(pl.id)+'" data-name="'+esc(pl.name)+'" data-image="'+esc(pl.image)+'" data-count="'+(pl.songCount||0)+'">'+svgHeart(fav)+'</button></div></div></div><div class="row-list">'+(pl.songs||[]).map((s,i)=>songRow(s,i,{ctxKey:"playlist-"+id})).join("")+'</div>';
  }catch(err){if(err&&err.type==="aborted")return;if(seq===State._detailSeq&&State.view==="playlist")el.innerHTML=errorStateHTML(err.message||"Unable to load this playlist.","navigate('playlist',{id:'"+jsq(id)+"'});");}
}
/* ============================================================ RENDER: SETTINGS ============================================================ */
function renderSettingsIfActive(){ if(State.view==="settings") renderSettings(); }
function renderSettings(){
  const s = State.settings;
  const el = $("#view-settings");
  el.innerHTML = '<button class="icon-btn mobile-only" data-action="back" style="margin-bottom:6px;">'+backIcon()+'</button>'
  + group("Appearance", [
      rowSegmented("Theme","Choose your visual style","theme",["dark","light","system"], s.theme)
    ])
  + group("Playback", [
      rowToggle("Autoplay next track","Continue playing automatically","autoplayNext", s.autoplayNext),
      rowStatic("Smart Radio","Unique-song infinite recommendations"),
      rowCrossfade(s),
      rowToggle("Remember playback position","Resume where you left off","rememberPosition", s.rememberPosition),
      rowToggle("Continue playback on launch","Restore your last session","continuePlayback", s.continuePlayback)
    ])
  + group("Audio", [
      rowSlider("Volume","Playback output level","volumeSlider", Math.round(State.volume*100)),
      rowSegmented("Preferred quality","Higher quality uses more data","audioQuality",["12","48","96","160","320"], s.audioQuality, q=>q+" kbps"),
      rowToggle("Normalize volume","Keep consistent loudness across tracks","normalizeVolume", s.normalizeVolume)
    ])
  + group("Lyrics", [
      rowToggle("Synced lyrics","Show time-synced lyrics when available","syncedLyrics", s.syncedLyrics),
      rowToggle("Auto-scroll","Follow the active lyric line","lyricsAutoScroll", s.lyricsAutoScroll),
      rowToggle("Highlight active line","Emphasize the current lyric","highlightActiveLine", s.highlightActiveLine),
      rowSegmented("Font size","Lyrics text size","lyricsFontSize",["small","medium","large"], s.lyricsFontSize),
      rowToggle("Lyrics animation","Smooth transitions between lines","lyricsAnimation", s.lyricsAnimation)
    ])
  + group("Player", [
      rowToggle("Mini player","Show floating player bar","miniPlayerEnabled", s.miniPlayerEnabled),
      rowToggle("Dynamic player background","Blurred artwork in full player","dynamicPlayerBg", s.dynamicPlayerBg),
      rowToggle("Animated artwork","Gentle motion while playing","animatedArtwork", s.animatedArtwork),
      rowToggle("Remember player state","Restore shuffle/repeat/volume","rememberPlayerState", s.rememberPlayerState)
    ])
  + group("Storage", [
      rowStatic("Local storage used", Store.usageKB()+" KB"),
      rowButton("Clear preferences","clear-preferences","danger"),
      rowButton("Clear all application data","clear-all-data","danger")
    ])
  + group("About", [
      rowStatic("Application","Booster OS"), rowStatic("Version","2.0 MAX"), rowStatic("Design by","Raj Pawar"),
      rowStatic("Music data","Booster music service"),
      rowStatic("Lyrics data","LRCLIB · Karalyr · Textyl · Lyrics.ovh (multi-source)")
    ]);
}
function group(title, rows){ return '<div class="settings-group"><div class="settings-group-title">'+esc(title)+'</div><div class="settings-card glass-1">'+rows.join("")+'</div></div>'; }
function rowToggle(title,desc,key,val){ return '<div class="setting-row"><div class="setting-row-text"><div class="setting-row-title">'+esc(title)+'</div><div class="setting-row-desc">'+esc(desc)+'</div></div><div class="setting-row-action"><div class="toggle'+(val?" on":"")+'" data-action="setting-toggle" data-key="'+key+'"></div></div></div>'; }
function rowSegmented(title,desc,key,opts,val,labelFn){ return '<div class="setting-row"><div class="setting-row-text"><div class="setting-row-title">'+esc(title)+'</div><div class="setting-row-desc">'+esc(desc)+'</div></div><div class="setting-row-action"><div class="segmented">'+opts.map(o=>'<div class="seg-opt'+(String(val)===String(o)?" active":"")+'" data-action="setting-seg" data-key="'+key+'" data-val="'+o+'">'+(labelFn?labelFn(o):o[0].toUpperCase()+o.slice(1))+'</div>').join("")+'</div></div></div>'; }
function rowSlider(title,desc,key,val){ return '<div class="setting-row"><div class="setting-row-text"><div class="setting-row-title">'+esc(title)+'</div><div class="setting-row-desc">'+esc(desc)+'</div></div><div class="setting-row-action slider-row"><input type="range" min="0" max="100" value="'+val+'" data-action="setting-slider" data-key="'+key+'"><span style="font-size:12px;color:var(--text-3);width:34px;text-align:right;">'+val+'%</span></div></div>'; }
function rowStatic(title,val){ return '<div class="setting-row"><div class="setting-row-text"><div class="setting-row-title">'+esc(title)+'</div></div><div class="setting-row-action"><span class="pill-badge">'+esc(val)+'</span></div></div>'; }
function rowButton(title,action,variant){ return '<div class="setting-row" data-action="'+action+'" style="cursor:pointer;"><div class="setting-row-text"><div class="setting-row-title" style="color:'+(variant==="danger"?"var(--danger)":"var(--text-1)")+'">'+esc(title)+'</div></div><div class="chevron-row">'+svgChevronR()+'</div></div>'; }
function rowCrossfade(s){
  const val = s.crossfadeDuration;
  return '<div class="setting-row crossfade-row">'
    +'<div class="crossfade-top"><div class="setting-row-text"><div class="setting-row-title">Crossfade</div><div class="setting-row-desc">Blend automatically into the next track (0–30s)</div></div>'
    +'<div class="crossfade-controls"><button class="crossfade-off-btn'+(val===0?' active':'')+'" data-action="crossfade-off">OFF</button><span class="pill-badge" id="crossfade-val-badge">'+(val===0?'Off':val+' sec')+'</span></div></div>'
    +'<input type="range" min="0" max="30" step="1" value="'+val+'" data-action="crossfade-slider" id="crossfade-slider-input">'
    +'<div class="crossfade-scale"><span>0s</span><span>15s</span><span>30s</span></div></div>';
}

/* ============================================================ QUEUE PANEL ============================================================ */
function openQueuePanel(){ $("#queue-overlay").classList.add("open"); $("#queue-panel").classList.add("open"); renderQueuePanel(); }
function closeQueuePanel(){ $("#queue-overlay").classList.remove("open"); $("#queue-panel").classList.remove("open"); }
function renderQueuePanel(){
  const list = $("#queue-list"); if(!list) return;
  if(!State.queue.length){ list.innerHTML = emptyStateHTML(svgMusicEmpty(),"Queue is empty","Play a song or add tracks to build your queue."); return; }
  let html = "";
  if(State.currentTrack) html += '<div class="queue-section-label">Now Playing</div><div class="row-list">'+queueRow(State.queue[State.queueIndex], State.queueIndex, true)+'</div>';
  const upcoming = State.queue.map((t,i)=>({t,i})).filter(x=>x.i!==State.queueIndex);
  if(upcoming.length) html += '<div class="queue-section-label">Up Next</div><div class="row-list">'+upcoming.map(x=>queueRow(x.t,x.i,false)).join("")+'</div>';
  list.innerHTML = html;
}
function queueRow(t,i,active){
  return '<div class="row-item'+(active?" playing":"")+'" data-action="play-queue-index" data-index="'+i+'">'
    +'<div class="row-art"><img src="'+esc(t.image)+'" onerror="this.src=\''+FALLBACK_ART+'\'" loading="lazy" alt=""></div>'
    +'<div class="row-meta"><div class="row-title">'+esc(t.name)+'</div><div class="row-sub">'+esc(t.artistName)+'</div></div>'
    +(active?'<div class="eq-bars"><span></span><span></span><span></span></div>':'<button class="ctrl-btn" data-action="remove-queue-index" data-index="'+i+'" aria-label="Remove">'+svgTrash()+'</button>')
    +'</div>';
}

/* ============================================================ FULL PLAYER / LYRICS TOGGLE ============================================================ */
function openFullPlayer(opts){if(!State.currentTrack)return;if((!opts||!opts.fromHistory)&&$("#full-player").classList.contains("open"))return;if(!opts||!opts.fromHistory){const hs=history.state&&history.state.boosterOS?history.state:null,depth=hs?Number(hs.depth)||0:0;history.pushState(navState("player",{sourceView:State.view,sourceParams:State.viewParams||{}},depth+1,0),"","#player");}$("#full-player").classList.add("open");}
function closeFullPlayer(opts){$("#full-player").classList.remove("open");closeLyrics({fromHistory:true});if(!opts||!opts.fromHistory){const hs=history.state&&history.state.boosterOS?history.state:null;if(hs&&hs.view==="player"&&Number(hs.depth)>0)history.back();}}
function openLyrics(opts){State.lyricsOpen=true;if(!opts||!opts.fromHistory){const hs=history.state&&history.state.boosterOS?history.state:null,depth=hs?Number(hs.depth)||0:0;history.pushState(navState("lyrics",{sourceView:State.view,sourceParams:State.viewParams||{},playerOpen:$("#full-player").classList.contains("open")},depth+1,0),"","#lyrics");}
  const view = $("#lyrics-view");
  view.classList.add("open");
  requestAnimationFrame(()=>{ if(!State.lyricsOpen)return; renderLyricsPane(); updateActiveLyric(primaryAudio().currentTime, true); startLyricsLoop(); });
}
function closeLyrics(opts){State.lyricsOpen=false;$("#lyrics-view").classList.remove("open");stopLyricsLoop();if(!opts||!opts.fromHistory){const hs=history.state&&history.state.boosterOS?history.state:null;if(hs&&hs.view==="lyrics"&&Number(hs.depth)>0)history.back();}}

/* ============================================================ DYNAMIC ARTIST / ALBUM RESOLUTION ============================================================ */
function revealEntityView(){if($("#full-player").classList.contains("open"))$("#full-player").classList.remove("open");if(State.lyricsOpen){State.lyricsOpen=false;$("#lyrics-view").classList.remove("open");stopLyricsLoop();}}
async function openArtistForTrack(track){if(!track)return;if(track.artistId){revealEntityView();navigate("artist",{id:String(track.artistId)});return;}const name=String(track.artistName||"").split(",")[0].trim();if(!name)return toast("Artist information is unavailable.","error");try{const r=await Api.searchArtists(name,0,8),arr=(r.data&&Array.isArray(r.data.results))?r.data.results:[],hit=arr.find(x=>String(x.name||"").trim().toLowerCase()===name.toLowerCase())||arr[0];if(hit&&hit.id){revealEntityView();navigate("artist",{id:String(hit.id)});}else toast("Unable to open this artist.","error");}catch(_){toast("Unable to open this artist.","error");}}
async function openAlbumForTrack(track){if(!track)return;if(track.albumId){revealEntityView();navigate("album",{id:String(track.albumId)});return;}const name=String(track.albumName||"").trim();if(!name)return toast("Album information is unavailable.","error");try{const artist=String(track.artistName||"").split(",")[0].trim(),r=await Api.searchAlbums([name,artist].filter(Boolean).join(" "),0,12),arr=(r.data&&Array.isArray(r.data.results))?r.data.results:[],hit=arr.find(x=>String(x.title||x.name||"").trim().toLowerCase()===name.toLowerCase())||arr[0];if(hit&&hit.id){revealEntityView();navigate("album",{id:String(hit.id)});}else toast("Unable to open this album.","error");}catch(_){toast("Unable to open this album.","error");}}
/* ============================================================ EVENT DELEGATION ============================================================ */
function findTrackById(id){
  for(const [,list] of ctxStore){ const f=list.find(t=>t.id===id); if(f) return f; }
  if(State.currentTrack && State.currentTrack.id===id) return State.currentTrack;
  const favs = State.favSongs.find(t=>t.id===id); if(favs) return favs;
  const hist = State.history.find(t=>t.id===id); if(hist) return hist;
  return null;
}
const __resolveCache=new Map();
async function resolvePlayableTrack(track,silent){
  if(track && track._needsFetch && !Object.keys(track.downloadUrl||{}).length){
    let p=__resolveCache.get(track.id);
    if(!p){ p=(async()=>{ const r=await Api.getSong(track.id); return normalizeSong(Array.isArray(r.data)?r.data[0]:r.data); })(); __resolveCache.set(track.id,p); }
    try{ const full=await p; if(!full) __resolveCache.delete(track.id); return full; }
    catch(e){ __resolveCache.delete(track.id); if(!silent)toast("Couldn't load this track's audio.", "error"); return null; }
  }
  return track;
}
/* prefetch: start resolving the audio URL the moment the finger touches a song, before the click fires */
document.addEventListener("pointerdown",function(e){
  const el=e.target&&e.target.closest?e.target.closest('[data-action="play-song"]'):null; if(!el)return;
  try{const tr=findTrackById(el.dataset.id); if(tr&&tr._needsFetch) resolvePlayableTrack(tr,true).catch(function(){});}catch(_){}
},{passive:true,capture:true});

/* ZERO-DELAY: (a) resolve audio URLs of visible songs ahead of time, (b) warm the next queued song, (c) pre-open connections */
(function(){
  try{warmOrigin(MUSIC_API);}catch(_){}
  const q=[],seen=new Set();let active=0;const MAX=3;
  function pump(){while(active<MAX&&q.length){const tr=q.shift();active++;resolvePlayableTrack(tr,true).then(function(f){try{if(f){const u=bestAudioUrl(f);if(u)warmOrigin(u);}}catch(_){}}).catch(function(){}).finally(function(){active--;pump();});}}
  const io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(en){
    if(!en.isIntersecting)return;io.unobserve(en.target);const id=en.target.dataset&&en.target.dataset.id;if(!id||seen.has(id))return;
    let tr=null;try{tr=findTrackById(id);}catch(_){}
    if(tr&&tr._needsFetch&&!Object.keys(tr.downloadUrl||{}).length){seen.add(id);q.push(tr);pump();}
  });},{rootMargin:"250px"}):null;
  function scan(n){if(!io||!n||n.nodeType!==1)return;if(n.matches&&n.matches('[data-action="play-song"]'))io.observe(n);if(n.querySelectorAll)n.querySelectorAll('[data-action="play-song"]').forEach(function(e){io.observe(e);});}
  function start(){const host=document.getElementById("view-scroll")||document.body;scan(host);
    new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(scan);});}).observe(host,{childList:true,subtree:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();

  /* warm the next song in the queue so skipping / auto-next starts instantly */
  let w=null,lastUrl="";
  function nextTrack(){try{const i=State.shuffle&&State.shuffleOrder&&State.shuffleOrder.length?State.shuffleOrder[0]:State.queueIndex+1;return State.queue[i]||null;}catch(_){return null;}}
  function warmNext(){try{const tr=nextTrack();if(!tr||tr.source==="youtube")return;const u=bestAudioUrl(tr);if(!u||u===lastUrl)return;lastUrl=u;warmOrigin(u);
    if(!w){w=new Audio();w.preload="auto";w.crossOrigin="anonymous";w.muted=true;}w.src=u;}catch(_){}}
  ["audio-el","audio-el-2"].forEach(function(id){const el=document.getElementById(id);if(el)el.addEventListener("playing",function(){setTimeout(warmNext,1500);},{passive:true});});
})();
function refreshRowStates(){ $$(".row-item").forEach(r=>{ const id=r.dataset.id; r.classList.toggle("playing", State.currentTrack && id===State.currentTrack.id); }); }

document.addEventListener("click", async function(e){
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const action = el.dataset.action;

  if(action==="play-song"){
    let t = findTrackById(el.dataset.id); if(!t) return;
    const _clk=(window.__playClk=(window.__playClk||0)+1);
    t = await resolvePlayableTrack(t); if(!t||_clk!==window.__playClk) return;
    const ctxKey = el.dataset.ctx;
    const ctxList = (ctxKey && !/^search/.test(ctxKey)) ? ctxStore.get(ctxKey) : null;   /* search result -> queue is just this song, then Autoplay fills it (no list of same-name versions) */
    const idx = ctxList ? ctxList.findIndex(x=>x.id===t.id) : 0;
    Player.play(t, ctxList && ctxList.length ? ctxList : [t], idx>=0?idx:0, {autoTransition:false});
    refreshRowStates();
  }
  else if(action==="play-all"){
    const key = el.dataset.ctx; const list = ctxStore.get(key);
    if(list && list.length){ const first = await resolvePlayableTrack(list[0]); if(first) Player.play(first, list, 0, {autoTransition:false}); }
  }
  else if(action==="play-queue-index"){ const i = parseInt(el.dataset.index); State.queueIndex=i; Queue.persist(); Player.play(State.queue[i], null, null, {autoTransition:false}); }
  else if(action==="remove-queue-index"){ Queue.removeAt(parseInt(el.dataset.index)); renderQueuePanel(); }
  else if(action==="toggle-fav-song"){
    const t = findTrackById(el.dataset.id);
    if(t){
      const added = Favorites.toggleSong(t);
      el.classList.toggle("active", added); el.classList.add("pulse"); el.innerHTML = svgHeart(added);
      setTimeout(()=>el.classList.remove("pulse"),600);
      renderMiniPlayer(); renderFullPlayer();
      toast(added?"Added to favorites":"Removed from favorites");
      if(State.view==="favorites"||State.view==="library") renderLibrary();
      if(State.view==="home") renderHome();
    }
  }
  else if(action==="toggle-fav-album"){ const album={id:el.dataset.id,name:el.dataset.name,image:el.dataset.image,artistName:el.dataset.artist}; const added=Favorites.toggleAlbum(album); el.classList.toggle("active",added); el.innerHTML=svgHeart(added); toast(added?"Album added to favorites":"Album removed from favorites"); }
  else if(action==="toggle-fav-artist"){ const artist={id:el.dataset.id,name:el.dataset.name,image:el.dataset.image}; const added=Favorites.toggleArtist(artist); el.classList.toggle("active",added); el.innerHTML=svgHeart(added); toast(added?"Artist followed":"Artist unfollowed"); }
  else if(action==="toggle-fav-playlist"){ const pl={id:el.dataset.id,name:el.dataset.name,image:el.dataset.image,songCount:parseInt(el.dataset.count||"0")}; const added=Favorites.togglePlaylist(pl); el.classList.toggle("active",added); el.innerHTML=svgHeart(added); toast(added?"Playlist saved":"Playlist removed"); }
  else if(action==="add-queue"){ const t=findTrackById(el.dataset.id); if(t) resolvePlayableTrack(t).then(full=>{ if(full) Queue.addToQueue(full); }); }
  else if(action==="open-current-artist"){e.preventDefault();e.stopPropagation();openArtistForTrack(State.currentTrack);}
  else if(action==="open-current-album"){e.preventDefault();e.stopPropagation();openAlbumForTrack(State.currentTrack);}
  else if(action==="open-artist-by-name"){e.preventDefault();e.stopPropagation();const n=el.dataset.name;if(n)Api.searchArtists(n.split(",")[0],0,8).then(r=>{const arr=(r.data&&Array.isArray(r.data.results))?r.data.results:[],hit=arr.find(x=>String(x.name||"").toLowerCase()===n.split(",")[0].toLowerCase())||arr[0];if(hit&&hit.id){revealEntityView();navigate("artist",{id:String(hit.id)});}}).catch(()=>{});}
  else if(action==="open-album"){navigate("album",{id:el.dataset.id});}
  else if(action==="open-artist"){ navigate("artist",{id:el.dataset.id}); }
  else if(action==="open-playlist"){ navigate("playlist",{id:el.dataset.id}); }
  else if(action==="back"){ goBack(); }
  else if(action==="clear-history"){ const ok = await confirmModal("Clear recently played?","This will remove all items from your recently played history."); if(ok){ History.clear(); renderLibrary(); toast("History cleared"); } }
  else if(action==="clear-history-settings"){ const ok = await confirmModal("Clear recently played?","This will remove all items from your recently played history."); if(ok){ History.clear(); toast("History cleared"); renderSettings(); } }
  else if(action==="clear-favorites-settings"){
    const ok = await confirmModal("Clear all favorites?","This will remove every song, album, artist and playlist you've favorited. This cannot be undone.");
    if(ok){ State.favSongs=[]; State.favAlbums=[]; State.favArtists=[]; State.favPlaylists=[];
      Store.set("favSongs",[]); Store.set("favAlbums",[]); Store.set("favArtists",[]); Store.set("favPlaylists",[]);
      toast("All favorites cleared"); renderSettings(); }
  }
  else if(action==="clear-preferences"){
    const ok = await confirmModal("Reset preferences?","This resets all app settings to their defaults. Your library and history will be kept.");
    if(ok){ Store.remove("settings"); Store.remove("shuffle"); Store.remove("repeat"); Store.remove("volume"); Store.remove("sidebarCollapsed"); toast("Preferences reset. Reloading…"); setTimeout(()=>location.reload(), 800); }
  }
  else if(action==="clear-all-data"){
    const ok = await confirmModal("Clear all application data?","This permanently deletes your favorites, history, queue and settings from this device. This cannot be undone.");
    if(ok){ Object.keys(localStorage).filter(k=>k.startsWith(LS_PREFIX)).forEach(k=>localStorage.removeItem(k)); toast("All application data cleared. Reloading…"); setTimeout(()=>location.reload(), 800); }
  }
  else if(action==="setting-toggle"){
    const key = el.dataset.key; State.settings[key] = !State.settings[key];
    el.classList.toggle("on", State.settings[key]); saveSettings();
    if(key==="normalizeVolume"){
      const fx=window.BoosterV9VoiceBass;
      if(!(fx&&fx.setNormalize&&fx.setNormalize(!!State.settings.normalizeVolume))){
        if(State.settings.normalizeVolume){ State.settings.normalizeVolume=false; el.classList.remove("on"); saveSettings(); toast("Volume normalization isn't supported on this browser","error"); }
      } else toast(State.settings.normalizeVolume?"Volume normalization on":"Volume normalization off");
    }
    if(key==="rememberPlayerState"&&State.settings.rememberPlayerState){ Store.set("shuffle",State.shuffle); Store.set("repeat",State.repeat); Store.set("volume",State.volume); }
  }
  else if(action==="setting-seg"){
    const key = el.dataset.key, val = el.dataset.val; State.settings[key] = val;

    $$('.seg-opt[data-key="'+key+'"]').forEach(o=>o.classList.toggle("active", o.dataset.val===val));
    saveSettings();
    if(key==="theme") ThemeManager.apply(val);
    if(key==="lyricsFontSize") applySettingsEffects();
  }
  else if(action==="crossfade-off"){
    Player.setCrossfadeDuration(0);
    const slider = $("#crossfade-slider-input"); if(slider) slider.value = 0;
    const badge = $("#crossfade-val-badge"); if(badge) badge.textContent = "Off";
    el.classList.add("active");
  }
});

document.addEventListener("input", function(e){
  const t = e.target;
  if(!t.dataset || !t.dataset.action) return;
  if(t.dataset.action==="setting-slider"){
    const key = t.dataset.key; const pct = parseInt(t.value)/100;
    if(key==="volumeSlider"){ if(State.muted&&pct>0)Player.setMuted(false); Player.setVolume(pct); $("#volume-slider").value = pct; if(t.nextElementSibling) t.nextElementSibling.textContent = t.value+"%"; }
  }
  else if(t.dataset.action==="crossfade-slider"){
    const v = parseInt(t.value,10);
    Player.setCrossfadeDuration(v);
    const badge = $("#crossfade-val-badge"); if(badge) badge.textContent = v===0 ? "Off" : v+" sec";
    const offBtn = document.querySelector('[data-action="crossfade-off"]'); if(offBtn) offBtn.classList.toggle("active", v===0);
  }
});

/* ============================================================ TOP-LEVEL WIRING ============================================================ */

$$('.nav-item[data-nav]').forEach(n=> n.addEventListener("click", ()=> navigate(n.dataset.nav)) );

$$('.bn-item[data-nav]').forEach(n=> n.addEventListener("click", ()=> navigate(n.dataset.nav)) );
$("#collapse-toggle").addEventListener("click", ()=>{ State.sidebarCollapsed = !State.sidebarCollapsed; $("#app").classList.toggle("collapsed", State.sidebarCollapsed); Store.set("sidebarCollapsed", State.sidebarCollapsed); });
$("#theme-quick-toggle").addEventListener("click", ()=> ThemeManager.toggleQuick());

$("#mini-info").addEventListener("click",e=>{if(e.target.closest("[data-action^="+"\"open-current-"+"\"]"))return;openFullPlayer();});
$("#mini-art-wrap").addEventListener("click", openFullPlayer);
$("#mini-play").addEventListener("click", ()=> Player.toggle());
$("#mini-prev").addEventListener("click", ()=> Player.prev());
$("#mini-next").addEventListener("click", ()=> Player.next(false));
$("#mini-queue").addEventListener("click", openQueuePanel);
$("#mini-heart").addEventListener("click", ()=>{
  if(!State.currentTrack) return;
  const added = Favorites.toggleSong(State.currentTrack);
  $("#mini-heart").classList.toggle("active", added); $("#mini-heart").classList.add("pulse"); $("#mini-heart").innerHTML = svgHeart(added);
  setTimeout(()=>$("#mini-heart").classList.remove("pulse"),600);
  renderFullPlayer(); toast(added?"Added to favorites":"Removed from favorites");
});
$("#fp-close").addEventListener("click", closeFullPlayer);
$("#fp-play").addEventListener("click", ()=> Player.toggle());
$("#fp-prev").addEventListener("click", ()=> Player.prev());
$("#fp-next").addEventListener("click", ()=> Player.next(false));
$("#fp-shuffle").addEventListener("click", ()=> Player.toggleShuffle());
$("#fp-repeat").addEventListener("click", ()=> Player.cycleRepeat());
$("#fp-heart").addEventListener("click", ()=>{
  if(!State.currentTrack) return;
  const added = Favorites.toggleSong(State.currentTrack);
  $("#fp-heart").classList.toggle("active", added); $("#fp-heart").classList.add("pulse"); $("#fp-heart").innerHTML = svgHeart(added);
  setTimeout(()=>$("#fp-heart").classList.remove("pulse"),600);
  renderMiniPlayer(); toast(added?"Added to favorites":"Removed from favorites");
});
$("#fp-queue-open").addEventListener("click", openQueuePanel);
$("#fp-queue-btn2").addEventListener("click", openQueuePanel);
$("#fp-lyrics-open").addEventListener("click", openLyrics);
$("#lyrics-close").addEventListener("click", closeLyrics);
$("#queue-close").addEventListener("click", closeQueuePanel);
$("#queue-overlay").addEventListener("click", closeQueuePanel);
$("#queue-clear").addEventListener("click", async ()=>{ const ok = await confirmModal("Clear queue?","This removes all upcoming tracks except the one currently playing."); if(ok){ Queue.clear(); renderQueuePanel(); toast("Queue cleared"); } });
$("#modal-cancel").addEventListener("click", ()=>closeModal(false));
$("#modal-backdrop").addEventListener("click", ()=>closeModal(false));
$("#modal-confirm").addEventListener("click", ()=>closeModal(true));
$("#volume-slider").addEventListener("input", e=>{ const v=parseFloat(e.target.value); if(State.muted&&v>0)Player.setMuted(false); Player.setVolume(v); });
(function(){ /* the existing speaker icon next to the slider doubles as the mute toggle (no markup/design change) */
  const sl=$("#volume-slider"), ic=sl&&sl.previousElementSibling;
  if(!ic||String(ic.tagName).toLowerCase()!=="svg"||ic.dataset.muteBound) return;
  ic.dataset.muteBound="1"; ic.setAttribute("role","button"); ic.setAttribute("aria-label","Mute");
  ic.style.cssText+=";cursor:pointer;box-sizing:content-box;padding:8px;margin:-8px;touch-action:manipulation;";
  ic.addEventListener("click",()=>Player.toggleMute());
})();
(function(){
  let scrollSave=0;
  const vs=$("#view-scroll");
  const flushScroll=()=>{scrollSave=0;const hs=history.state;if(hs&&hs.boosterOS){try{history.replaceState(Object.assign({},hs,{scrollTop:vs.scrollTop}),"",location.href);}catch(e){}}};
  if(vs){
    /* V24: was one history.replaceState() per frame while scrolling (very slow, throws in Safari). Now debounced. */
    vs.addEventListener("scroll",()=>{ if(scrollSave)clearTimeout(scrollSave); scrollSave=setTimeout(flushScroll,120); },{passive:true});
    document.addEventListener("click",()=>{ if(scrollSave){clearTimeout(scrollSave);flushScroll();} },true);
    window.addEventListener("pagehide",()=>{ if(scrollSave){clearTimeout(scrollSave);flushScroll();} });
  }
})();

(function(){
  /* Seek bar — one pointer-event path for mouse, touch and pen (previously mouse + touch listeners both fired
     on Android: the emulated mouse events after a tap caused a duplicate seek, and a cancelled touch left
     `dragging` stuck). touch-action:none on .seek-track keeps the page from scrolling while dragging. */
  const track = $("#seek-track"); if(!track) return;
  let dragging = false, activeId = null, lastCommit = 0, pendingPct = null, lastTouchAt = 0;
  const pctFromX = x => { const r = track.getBoundingClientRect(); return r.width > 0 ? clamp((x - r.left)/r.width, 0, 1) : 0; };
  function duration(){
    const el = primaryAudio(), d = Number(el && el.duration);
    if(Number.isFinite(d) && d > 0) return d;
    return Number(State.currentTrack && State.currentTrack.duration) || 0;
  }
  function paint(pct){
    $("#seek-fill").style.width = (pct*100)+"%"; $("#seek-handle").style.left = (pct*100)+"%";
    const d = duration(); const tc = $("#time-current"); if(tc && d) tc.textContent = fmtTime(pct*d);
  }
  function commit(pct){ const d = duration(); if(d > 0) Player.seekTo(pct*d); }
  function move(x, force){
    const pct = pctFromX(x); paint(pct);
    const now = performance.now();
    if(force || now - lastCommit >= 100){ lastCommit = now; pendingPct = null; commit(pct); } else pendingPct = pct;
  }
  function begin(x){ if(dragging) return false; dragging = true; window.__bosSeekDragging = true; move(x, true); return true; }
  function finish(){
    if(!dragging) return; dragging = false; activeId = null;
    if(pendingPct != null){ const p = pendingPct; pendingPct = null; commit(p); }
    window.__bosSeekDragging = false;
    try{ PG.p = -1; PG.sec = -1; }catch(e){}   /* force the next progress paint to resync the handle/time */
  }
  if(window.PointerEvent){
    track.addEventListener("pointerdown", e=>{
      if(e.pointerType === "mouse" && e.button !== 0) return;
      if(!begin(e.clientX)) return; activeId = e.pointerId;
      try{ track.setPointerCapture(e.pointerId); }catch(_){}
      if(e.cancelable) e.preventDefault();
    });
    track.addEventListener("pointermove", e=>{ if(dragging && e.pointerId === activeId) move(e.clientX, false); });
    const up = e=>{ if(dragging && e.pointerId === activeId){ try{ track.releasePointerCapture(e.pointerId); }catch(_){} finish(); } };
    track.addEventListener("pointerup", up); track.addEventListener("pointercancel", up);
    track.addEventListener("lostpointercapture", ()=>finish());
  } else {
    /* legacy fallback (no Pointer Events): mouse events that follow a touch are ignored to avoid a double seek */
    track.addEventListener("touchstart", e=>{ lastTouchAt = Date.now(); if(e.touches && e.touches.length) begin(e.touches[0].clientX); }, {passive:true});
    track.addEventListener("touchmove", e=>{ if(dragging && e.touches && e.touches.length){ if(e.cancelable) e.preventDefault(); move(e.touches[0].clientX, false); } }, {passive:false});
    track.addEventListener("touchend", ()=>{ lastTouchAt = Date.now(); finish(); });
    track.addEventListener("touchcancel", ()=>{ lastTouchAt = Date.now(); finish(); });
    track.addEventListener("mousedown", e=>{ if(Date.now() - lastTouchAt < 800 || e.button !== 0) return; begin(e.clientX); });
    window.addEventListener("mousemove", e=>{ if(dragging && Date.now() - lastTouchAt >= 800) move(e.clientX, false); });
    window.addEventListener("mouseup", ()=>{ if(Date.now() - lastTouchAt >= 800) finish(); });
  }
  window.addEventListener("blur", finish);
})();

/* ============================================================
   OPTIMIZED KEYBOARD + MOBILE NAVIGATION
   Tab is the intentional close key for active overlays. Escape is
   left to the browser/accessibility layer and does not hijack focus.
   ============================================================ */
(function OptimizedInputNavigation(){
  const isTyping = el => {
    const tag=(el&&el.tagName||'').toLowerCase();
    return tag==='input'||tag==='textarea'||tag==='select'||el?.isContentEditable;
  };
  const overlayOpen = () => !!(
    State.lyricsOpen ||
    $("#full-player")?.classList.contains("open") ||
    $("#queue-panel")?.classList.contains("open") ||
    $("#modal-backdrop")?.classList.contains("open") ||
    $("#bos-cmdk")?.classList.contains("open") ||
    $("#bos-pop")?.classList.contains("open") ||
    ["album","artist","playlist"].includes(State.view)
  );
  const closeTopOverlay = () => {
    /* Close the most transient layer first. */
    if($("#queue-panel")?.classList.contains("open")){ closeQueuePanel(); return true; }
    if(State.lyricsOpen){ closeLyrics(); return true; }
    if($("#full-player")?.classList.contains("open")){ closeFullPlayer(); return true; }
    if($("#modal-backdrop")?.classList.contains("open")){ closeModal(false); return true; }
    if($("#bos-cmdk")?.classList.contains("open")){ closeCmdk(); return true; }
    if($("#bos-pop")?.classList.contains("open")){ closePop(); return true; }
    /* Detail pages use the same Tab-as-close behavior as overlays. */
    if(["album","artist","playlist"].includes(State.view)){ goBack(); return true; }
    return false;
  };

  document.addEventListener("keydown", function(e){
    if(isTyping(e.target)) return;

    /* Tab closes the currently active player/lyrics/queue layer.
       Only intercept it when an overlay is actually open so normal
       desktop keyboard navigation remains accessible everywhere else. */
    if(e.key==="Tab" && overlayOpen()){
      e.preventDefault();
      closeTopOverlay();
      return;
    }

    if(e.code==="Space"){ e.preventDefault(); Player.toggle(); return; }
    if(e.code==="ArrowRight" && e.shiftKey){ e.preventDefault(); Player.next(false); return; }
    if(e.code==="ArrowLeft" && e.shiftKey){ e.preventDefault(); Player.prev(); return; }

    /* Browser-like page navigation inside Booster OS. */
    if((e.altKey && e.key==="ArrowLeft") || (e.metaKey && e.key==="[")){
      e.preventDefault(); goBack(); return;
    }
  }, {passive:false});

  /* Keep Android/browser Back aligned with Booster OS history. */
  window.addEventListener("pageshow",()=>{
    if(State.lyricsOpen && !$("#lyrics-view")?.classList.contains("open")) State.lyricsOpen=false;
  });
})();

/* ============================================================
   CENTRALIZED MOBILE GESTURE MANAGER
   - Full player: horizontal swipe = next/previous, downward = close
   - Lyrics: vertical movement stays scrolling; no accidental track change
   - View: edge-right swipe = Booster Back (not during horizontal controls)
   - Buttons/sliders/inputs are protected from gesture interception
   ============================================================ */
(function GestureManager(){
  const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  const small = window.matchMedia && window.matchMedia('(max-width:980px)').matches;
  if(!coarse && !small) return;

  const interactive = el => !!el?.closest('button,a,input,select,textarea,[role="button"],[draggable="true"],.seek-track,.mini-progress,.queue-list');
  const bind = (el, handlers) => {
    if(!el || el.dataset.gestureBound) return;
    el.dataset.gestureBound='1';
    let sx=0,sy=0,st=0,active=false,moved=false;
    el.addEventListener('touchstart',e=>{
      if(!e.touches?.length || interactive(e.target)) return;
      if(handlers.only && !e.target.closest?.(handlers.only)) return;   /* gesture must START on this area */
      const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=performance.now(); active=true; moved=false;
    },{passive:true});
    el.addEventListener('touchmove',e=>{
      if(!active || !e.touches?.length) return;
      const t=e.touches[0], dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dx)>10 || Math.abs(dy)>10) moved=true;
    },{passive:true});
    el.addEventListener('touchend',e=>{
      if(!active) return; active=false;
      const t=e.changedTouches?.[0]; if(!t) return;
      const dx=t.clientX-sx, dy=t.clientY-sy, dt=performance.now()-st;
      if(!moved || dt>700) return;
      const ax=Math.abs(dx), ay=Math.abs(dy);
      if(ax<55 && ay<55) return;
      if(handlers.axis==='horizontal' && ax>ay && ax>=70 && dt<650){
        if(dx<0) handlers.left?.(); else handlers.right?.();
      }else if(handlers.axis==='vertical' && ay>ax && ay>=70 && dt<650){
        if(dy<0) handlers.up?.(); else handlers.down?.();
      }
    },{passive:true});
  };

  /* next/previous swipe lives in the artwork carousel (bos-art-carousel script) */

  /* A downward swipe on the full player closes the player, while
     horizontal swipes remain dedicated to track navigation. */
  const fp=$("#full-player");
  if(fp && !fp.dataset.verticalCloseBound){
    fp.dataset.verticalCloseBound='1';
    let sx=0,sy=0,st=0;
    fp.addEventListener('touchstart',e=>{
      if(!e.touches?.length || interactive(e.target)) return;
      const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=performance.now();
    },{passive:true});
    fp.addEventListener('touchend',e=>{
      const t=e.changedTouches?.[0]; if(!t) return;
      const dx=t.clientX-sx,dy=t.clientY-sy,dt=performance.now()-st;
      if(dt<650 && dy>85 && Math.abs(dy)>Math.abs(dx)*1.25 && !document.documentElement.classList.contains('bos-motion')){ closeFullPlayer(); }
    },{passive:true});
  }

  bind($("#lyrics-scroll"),{
    axis:'vertical',
    /* Lyrics scrolling is native; gestures are intentionally no-op so
       a user's vertical scroll can never skip tracks. */
  });

  /* Mini player gestures: swipe up opens Full Player; horizontal swipes
     change tracks. Keep taps/clicks and control buttons untouched. */
  const mini=$("#mini-player");
  if(mini && !mini.dataset.miniGestureBound){
    mini.dataset.miniGestureBound='1';
    let sx=0,sy=0,st=0,drag=false;
    mini.addEventListener('touchstart',e=>{
      if(!e.touches?.length || interactive(e.target)) return;
      const t=e.touches[0];sx=t.clientX;sy=t.clientY;st=performance.now();drag=true;
    },{passive:true});
    mini.addEventListener('touchend',e=>{
      if(!drag)return;drag=false;const t=e.changedTouches?.[0];if(!t)return;
      const dx=t.clientX-sx,dy=t.clientY-sy,dt=performance.now()-st;
      if(dt>650)return;
      if(Math.abs(dy)>Math.abs(dx)*1.2){ if(dy<-65&&!document.documentElement.classList.contains('bos-motion'))openFullPlayer(); return; }
      if(Math.abs(dx)>Math.abs(dy)*1.2 && Math.abs(dx)>=70){if(dx<0)Player.next(false);else Player.prev();}
    },{passive:true});
  }

  /* Mobile equivalents of Tab-close: a deliberate downward swipe closes
     transient sheets, but only when the gesture starts away from controls. */
  const bindSheetClose = (el, closeFn, key) => {
    if(!el || el.dataset[key]) return;
    el.dataset[key]='1';
    let sx=0,sy=0,st=0,armed=false;
    el.addEventListener('touchstart',e=>{
      if(!e.touches?.length || interactive(e.target)) { armed=false; return; }
      const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=performance.now(); armed=true;
    },{passive:true});
    el.addEventListener('touchend',e=>{
      if(!armed) return; armed=false;
      const t=e.changedTouches?.[0]; if(!t) return;
      const dx=t.clientX-sx, dy=t.clientY-sy, dt=performance.now()-st;
      if(dt<650 && dy>80 && Math.abs(dy)>Math.abs(dx)*1.25) closeFn();
    },{passive:true});
  };
  /* lyrics: a downward swipe is just scrolling back to earlier lines, it must NOT close the lyrics */
  bindSheetClose($("#queue-overlay"), ()=>closeQueuePanel(), 'tabSwipeClose');

  const vs=$("#view-scroll");
  if(vs && !vs.dataset.edgeBackBound){
    vs.dataset.edgeBackBound='1';
    let sx=0,sy=0,st=0;
    vs.addEventListener('touchstart',e=>{
      if(!e.touches?.length || interactive(e.target)) return;
      const t=e.touches[0];
      if(t.clientX>28) return;
      sx=t.clientX; sy=t.clientY; st=performance.now();
    },{passive:true});
    vs.addEventListener('touchend',e=>{
      if(!st) return;
      const t=e.changedTouches?.[0]; if(!t) return;
      const dx=t.clientX-sx,dy=t.clientY-sy,dt=performance.now()-st; st=0;
      if(dt<600 && dx>85 && Math.abs(dx)>Math.abs(dy)*1.35){ goBack(); }
    },{passive:true});
  }
})();

/* ============================================================ INIT ============================================================ */
function init(){
  ThemeManager.init();
  applySettingsEffects();
  $("#app").classList.toggle("collapsed", State.sidebarCollapsed);
  Player.setVolume(State.volume);
  $("#volume-slider").value = State.volume;
  const savedPlaybackRate=Number(Store.get("playbackRate",1))||1;audioA.playbackRate=savedPlaybackRate;audioB.playbackRate=savedPlaybackRate;
  renderShuffleRepeatIcons();

  const last = Store.get("lastSong", null);
  if(last && State.settings.continuePlayback){
    State.currentTrack = last;
    $("#mini-art").src = last.image; $("#mini-title").textContent = last.name; $("#mini-artist").textContent = last.artistName;
    $("#mini-player").classList.add("show");
    updateAmbient(last); renderFullPlayer();
    if(State.queue.length && State.queueIndex>=0){ const url = bestAudioUrl(last); if(url) primaryAudio().src = url; }
  }
  if(!history.state||!history.state.boosterOS)history.replaceState(navState("home",{},0,0),"","#home");
  navigate("home",{}, {fromBack:true,restoreScroll:history.state&&history.state.scrollTop||0});
  window.addEventListener("error", function(e){ console.warn("Booster OS caught an unhandled error:", e.error||e.message); });
  window.addEventListener("unhandledrejection", function(e){ console.warn("Booster OS caught an unhandled rejection:", e.reason); });
}

/* ============================================================ BOOSTER OS V7 STABILITY PATCH
   - Single keyboard routing
   - Reliable resume after metadata is ready
   - Smart recommendation saturation / no-repeat guard
   - Failed-source quarantine
   ============================================================ */
(function BoosterV7Stability(){
  const failed = State._failedTrackIds || (State._failedTrackIds = new Set());
  const recent = () => Array.isArray(State.history) ? State.history.slice(-80) : [];
  function trackKey(t){ return String(t && t.id || ""); }
  function artistKey(t){ return norm(t && (t.artistName || t.artist || "")); }
  function albumKey(t){ return norm(t && (t.albumName || t.album || "")); }
  window.BoosterV7 = window.BoosterV7 || {};
  BoosterV7.isQuarantined = t => failed.has(trackKey(t));
  BoosterV7.quarantine = t => { const k=trackKey(t); if(k) failed.add(k); };
  BoosterV7.filterCandidates = function(list, opts){
    opts=opts||{}; const maxPerArtist=Number.isFinite(opts.maxPerArtist)?opts.maxPerArtist:2;
    const maxPerAlbum=Number.isFinite(opts.maxPerAlbum)?opts.maxPerAlbum:1;
    const blocked=new Set((opts.blockedIds||[]).map(String));
    const recentIds=new Set(recent().map(trackKey));
    const artists=new Map(), albums=new Map(), out=[];
    for(const t of (Array.isArray(list)?list:[])){
      const id=trackKey(t); if(!id || blocked.has(id) || failed.has(id)) continue;
      if(recentIds.has(id) && !opts.allowRecent) continue;
      const a=artistKey(t), al=albumKey(t);
      const ac=artists.get(a)||0, alc=albums.get(al)||0;
      if(a && ac>=maxPerArtist) continue;
      if(al && alc>=maxPerAlbum) continue;
      artists.set(a,ac+1); albums.set(al,alc+1); out.push(t);
    }
    return out;
  };

  // Fix resume seeking: wait for metadata before assigning currentTime.
  const oldLoadAndPlayV7 = window.loadAndPlay;
  if(typeof oldLoadAndPlayV7 === 'function'){
    window.loadAndPlay = async function(el, track, startAt){
      const ok = await oldLoadAndPlayV7.apply(this, arguments);
      if(ok && Number.isFinite(startAt) && startAt>0){
        try{
          if(el.readyState < 1){
            await new Promise(resolve=>{
              const done=()=>{el.removeEventListener('loadedmetadata',done);resolve();};
              el.addEventListener('loadedmetadata',done,{once:true});
              setTimeout(done,2500);
            });
          }
          if(Number.isFinite(el.duration) && startAt < el.duration-1) el.currentTime=startAt;
        }catch(_){ }
      }
      return ok;
    };
  }

  // Expose a safe candidate filter for Smart Radio without replacing its engine.
  const oldNextSmartV7 = SmartRadio && SmartRadio.nextSmart;
  if(typeof oldNextSmartV7 === 'function' && !SmartRadio._v7Wrapped){
    SmartRadio._v7Wrapped=true;
    SmartRadio.nextSmart = async function(expectedToken){
      const before=State.queue.length;
      const result=await oldNextSmartV7.apply(this,arguments);
      try{
        // Keep the current queue unique by track id and prevent obvious artist/album spam.
        const seen=new Set(), cleaned=[];
        for(const t of State.queue){
          const id=trackKey(t); if(!id || seen.has(id) || failed.has(id)) continue;
          seen.add(id); cleaned.push(t);
        }
        const cur=State.currentTrack;
        const tail=cleaned.filter(t=>!cur || trackKey(t)!==trackKey(cur));
        const filtered=BoosterV7.filterCandidates(tail,{allowRecent:true,maxPerArtist:3,maxPerAlbum:1});
        State.queue=cur ? [cur,...filtered] : filtered;
        if(State.queueIndex<0 && State.queue.length) State.queueIndex=0;
        if(typeof Queue?.persist==='function') Queue.persist();
      }catch(_){ }
      return result;
    };
  }
})();

/* ============================================================ BOOSTER OS ADVANCED AUDIO + LYRICS UPGRADE
   Safe additive layer: preserves the existing dual-audio engine.
   ============================================================ */
(function BoosterAdvancedLayer(){
  const PRELOAD = new Audio();
  PRELOAD.preload = "auto";
  PRELOAD.playsInline = true;
  let preloadId = "";
  let retryTimer = 0;
  const retryCount = new Map();
  const offsetKey = id => "lyrics_offset_" + String(id || "unknown");
  const clampOffset = v => Math.max(-5, Math.min(5, Number(v) || 0));

  // Per-song lyric timing calibration: Shift+Left/Right = -/+250ms, Shift+R = reset.
  function getLyricOffset(){ return State.currentTrack ? clampOffset(Store.get(offsetKey(State.currentTrack.id),0)) : 0; }
  function setLyricOffset(v){
    if(!State.currentTrack) return;
    const value = Math.round(clampOffset(v)*4)/4;
    Store.set(offsetKey(State.currentTrack.id), value);
    State._lyricsOffset = value;
    updateActiveLyric(primaryAudio().currentTime || 0, true);
    toast("Lyrics offset: " + (value>0?"+":"") + value.toFixed(2) + "s");
  }
  window.addEventListener("keydown", e=>{
    if(!State.lyricsOpen || !State.currentTrack || !e.shiftKey) return;
    if(e.key==="ArrowLeft"){ e.preventDefault(); setLyricOffset(getLyricOffset()-.25); }
    else if(e.key==="ArrowRight"){ e.preventDefault(); setLyricOffset(getLyricOffset()+.25); }
    else if(e.key.toLowerCase()==="r"){ e.preventDefault(); setLyricOffset(0); }
  });

  // Pre-buffer the next queued source without touching the live secondary deck.
  function prebufferNext(){
    try{
      if(!State.currentTrack || !State.queue.length) return;
      let ni = State.queueIndex + 1;
      if(State.shuffle && State.shuffleOrder.length) ni = State.shuffleOrder[0];
      const next = State.queue[ni];
      if(!next || next.id === State.currentTrack.id) return;
      const url = bestAudioUrl(next);
      if(!url || preloadId === String(next.id)) return;
      preloadId = String(next.id);
      PRELOAD.src = url;
      PRELOAD.load();
    }catch(_){ }
  }
  const originalOnTrackStarted = SmartRadio.onTrackStarted;
  SmartRadio.onTrackStarted = function(track){
    try{ originalOnTrackStarted(track); }catch(_){ }
    setTimeout(prebufferNext, 120);
  };

  // Robust source recovery: try alternate quality URLs before declaring a track dead.
  const originalLoadAndPlay = loadAndPlay;
  loadAndPlay = async function(el, track, startAt){
    const urls=[];
    const preferred=bestAudioUrl(track);
    if(preferred) urls.push(preferred);
    Object.values(track && track.downloadUrl || {}).forEach(u=>{ if(u && !urls.includes(u)) urls.push(u); });
    const tk=Player._playToken, g=(el._lg=(el._lg||0)+1);
    const stale=()=>g!==el._lg||tk!==Player._playToken;
    try{el.pause();}catch(_){}
    try{el.dataset.boosterTrackId=String(track&&track.id||"");}catch(_){}
    let lastErr=null;
    for(const url of urls.slice(0,4)){
      if(stale()) throw lastErr||new DOMException("superseded","AbortError");
      try{
        el.src=url; try{el.load();}catch(_){}
        if(Number.isFinite(startAt)&&startAt>0){ try{el.currentTime=startAt;}catch(_){} }
        await el.play();
        return true;
      }catch(err){ lastErr=err; if(stale()) throw err; }
    }
    throw lastErr || new Error("no-src");
  };

  // Adaptive crossfade: never let the blend consume most of a short incoming track.
  const originalEffective = effectiveCrossfadeDuration;
  effectiveCrossfadeDuration = function(track){
    const base=originalEffective(track);
    const d=Number(track && track.duration)||0;
    if(!base) return 0;
    if(d>0 && d<90) return Math.max(.3, Math.min(base, d*.28));
    if(d>0 && d<180) return Math.max(.3, Math.min(base, d*.36));
    return base;
  };

  // Error recovery is handled by the original engine's skip logic; this layer avoids
  // auto-resuming a deliberate user pause.
  // Keep the pre-buffer warm whenever playback advances.
  [audioA,audioB].forEach(el=>el.addEventListener("timeupdate",()=>{
    if(el===primaryAudio() && el.duration && el.currentTime/el.duration>.55) prebufferNext();
  }, {passive:true}));

  // Restore the per-song lyric offset as soon as a new track is rendered.
  const oldRenderLyricsPane = renderLyricsPane;
  renderLyricsPane = function(){
    State._lyricsOffset = getLyricOffset();
    return oldRenderLyricsPane.apply(this, arguments);
  };
})();

/* ============================================================
   BOOSTER OS 2.0 MAX — ADDITIVE FEATURE LAYER
   Floating quick actions • smart mixes • backup/restore •
   command palette • karaoke • premium audio
   ============================================================ */
const BoosterMax=(function(){
  "use strict";
  const q=function(id){return document.getElementById(id);};


  /* ---------------- PHASE 3/4: Smart mix seeds (fresh every time) ---------------- */
  const MARATHI_RAP_SEEDS=["marathi rap","marathi hip hop","marathi rap song","new marathi rap","marathi trap","marathi drill","marathi rap cypher","marathi underground rap","sambhaji rap marathi","marathi rap trending"];
  const MARATHI_HINDI_SEEDS=["marathi trending songs","marathi viral song","hindi viral songs","marathi new songs","marathi romantic hits","marathi dance hits","hindi trending songs","marathi party songs","marathi hindi mix","zhakaas marathi"];
  /* Mood discovery is intentionally strict: broad searches such as "latest hindi hits"
     can return devotional/God songs. We keep devotional music out of normal moods
     and give it its own dedicated God Songs mix. */
  const DEVOTIONAL_WORDS=[
    "bhajan","bhakti","devotional","aarti","arti","mantra","stotra","stotram",
    "chalisa","kirtan","keertan","puja","pooja","prarthana","shlok","shloka",
    "om namah","mahadev","shiva","shiv","bholenath","har har mahadev","krishna",
    "radha","ram","rama","raghu","hanuman","bajrang","ganpati","ganesh","gajanan",
    "durga","devi","mata","maa kali","lakshmi","saraswati","vitthal","vithoba",
    "swami","datta","dattatreya","ayyappa","murugan","kartikeya","jagannath",
    "sai baba","sairam","gurudev","guru mantra","sukhkarta","morya","morya re"
  ];
  const GOD_SEEDS=[
    "hindi bhajan devotional songs",
    "latest bhakti songs india",
    "hindi god songs",
    "marathi bhakti songs",
    "marathi devotional songs",
    "ganpati bhajan songs",
    "krishna bhajan songs",
    "mahadev shiva bhajan songs",
    "ram bhajan songs",
    "hanuman bhajan songs",
    "devi mata bhajan songs",
    "vitthal abhang songs"
  ];
  /* Smart Moods 2.0 — each button has its own search vocabulary, positive
     signals and conflict filters. The API search is treated as discovery, then
     results are classified so one mood cannot fill another mood with unrelated
     songs. God Songs is a dedicated devotional bucket. */
  const MOOD_PROFILES={
    happy:{
      seeds:["happy hindi songs","feel good bollywood songs","happy marathi songs","fun hindi songs","feel good indian hits","positive vibe songs india"],
      good:["happy","happiness","khushi","khush","smile","smiling","fun","masti","mast","joy","celebrate","celebration","zindagi","life","good vibes","feel good","party","dance"],
      bad:["sad","sadness","heartbreak","breakup","cry","crying","rona","ro raha","dard","bewafa","bewafai","alone","lonely","aansu","aansoo","pain","dukh","bhajan","aarti","arti","mantra","chalisa"]
    },
    sad:{
      seeds:["sad hindi songs","heartbreak bollywood songs","emotional hindi songs","sad marathi songs","breakup songs india","dard bhare songs"],
      good:["sad","sadness","heartbreak","breakup","emotional","emotion","dard","pain","alone","lonely","cry","crying","aansu","aansoo","bewafa","bewafai","judai","yaad","memories","broken","miss you"],
      bad:["happy","fun","masti","party","celebrate","dance","workout","gym","bhajan","bhakti","devotional","aarti","arti","ganpati","krishna","mahadev","ram","hanuman"]
    },
    romantic:{
      seeds:["romantic hindi songs","love songs bollywood","romantic marathi songs","soft love songs india","new romantic songs","couple love songs"],
      good:["love","romantic","romance","ishq","mohabbat","pyaar","pyar","jaan","janu","sanam","sajni","sajna","dil","teri","mera","meri","couple","kiss","lover","lovely","rain love"],
      bad:["bhajan","bhakti","devotional","aarti","arti","mantra","chalisa","ganpati","krishna","mahadev","ram","hanuman","rap battle","diss track"]
    },
    energy:{
      seeds:["high energy hindi songs","energetic bollywood songs","workout songs india","power songs hindi","energetic punjabi hits","high energy marathi songs"],
      good:["energy","energetic","power","powerful","workout","gym","pump","hype","high energy","beast","fire","dance","beat","bass","champion","josh","junoon","motivation"],
      bad:["sad","sleep","sleeping","calm","meditation","lullaby","bhajan","aarti","arti","devotional","mantra","chalisa","romantic","love song"]
    },
    party:{
      seeds:["party songs hindi","bollywood dance party hits","punjabi party songs","marathi party songs","dance hits india","celebration songs india"],
      good:["party","dance","dj","club","celebrate","celebration","wedding","shaadi","baraat","nach","naach","dhol","bhangra","disco","remix","beat","bass","masti","fun"],
      bad:["sad","heartbreak","breakup","sleep","meditation","focus","study","bhajan","aarti","arti","devotional","mantra","chalisa"]
    },
    chill:{
      seeds:["chill hindi songs","lofi indian songs","acoustic bollywood songs","soft indie india","relaxing marathi songs","calm songs india"],
      good:["chill","lofi","lo-fi","acoustic","soft","calm","relax","relaxing","peace","peaceful","slow","unplugged","ambient","soothing","mellow","coffee","easy","lofi mix"],
      bad:["party","dj","club","workout","gym","hype","diss","hardcore rap","bhajan","aarti","arti","mantra","chalisa"]
    },
    latenight:{
      seeds:["late night hindi songs","midnight chill songs india","night drive indian songs","late night romantic songs","after dark hindi songs","midnight lofi india"],
      good:["night","midnight","late night","after dark","raat","raaton","night drive","midnight drive","moon","moonlight","2am","3am","4am","5am","sleepy","lofi","chill","midnight"],
      bad:["morning","wake up","party","wedding","workout","gym","bhajan","aarti","arti","devotional","mantra","chalisa"]
    },
    roadtrip:{
      seeds:["road trip hindi songs","travel songs bollywood","highway songs india","driving songs hindi","road trip marathi songs","long drive songs india"],
      good:["road trip","roadtrip","travel","travelling","highway","drive","driving","long drive","safar","musafir","raahi","journey","rasta","road","trip","wander","wanderlust","car","bike","journey songs"],
      bad:["bhajan","aarti","arti","devotional","mantra","chalisa","meditation","study","focus","sleep"]
    },
    rap:{
      seeds:["indian hip hop songs","hindi rap songs","marathi rap songs","desi hip hop hits","indian rap trending","hindi hip hop"],
      good:["rap","rapper","hip hop","hip-hop","hustle","bars","flow","cypher","diss","drill","trap","mc","mic","verse","freestyle","desi hip hop"],
      bad:["bhajan","aarti","arti","devotional","mantra","chalisa","lullaby","meditation"]
    },
    motivation:{
      seeds:["motivational hindi songs","hustle songs india","inspirational bollywood songs","confidence songs hindi","success songs india","motivation songs marathi"],
      good:["motivation","motivational","hustle","success","winner","winning","champion","believe","dream","dreams","goal","goals","power","rise","never give up","fighter","warrior","confidence","josh","junoon","mehnat","jeet","victory"],
      bad:["sad","heartbreak","breakup","sleep","lullaby","meditation","bhajan","aarti","arti","devotional","mantra","chalisa"]
    },
    rainy:{
      seeds:["rain songs hindi","monsoon bollywood songs","baarish songs india","rainy day songs hindi","marathi rain songs","barsaat songs india"],
      good:["rain","rainy","baarish","barish","barsaat","monsoon","rimjhim","boondein","boond","paani","pani","cloud","clouds","saawan","sawan","wet","rain drops","rainy day"],
      bad:["party","workout","gym","diss","bhajan","aarti","arti","devotional","mantra","chalisa"]
    },
    focus:{
      seeds:["focus music india","study lofi hindi","coding music instrumental","deep focus beats","calm instrumental india","study music hindi"],
      good:["focus","study","coding","instrumental","instrumentals","lofi","lo-fi","ambient","concentration","deep work","work","calm","piano","nature sounds","beats to study","reading"],
      bad:["party","club","dj","diss","hardcore","workout","gym","bhajan","aarti","arti","devotional","mantra","chalisa"]
    },
    god:{
      seeds:["hindi bhajan songs","hindi bhakti songs","aarti songs india","ganpati songs","ganesh aarti","krishna bhajan","mahadev shiva bhajan","ram bhajan","hanuman bhajan","devi mata bhajan","vitthal abhang","marathi devotional songs","marathi bhajan","spiritual mantra songs"],
      good:DEVOTIONAL_WORDS,
      bad:[]
    }
  };
  const MOODS=Object.keys(MOOD_PROFILES).reduce(function(acc,key){acc[key]=MOOD_PROFILES[key].seeds;return acc;},{});
  MOOD_PROFILES.god.good=DEVOTIONAL_WORDS;


  function songSearchText(t){
    return [t&&t.name,t&&t.artistName,t&&t.albumName,t&&t.label,t&&t.primaryArtists]
      .filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  }
  function isDevotionalSong(t){
    const x=songSearchText(t);
    return DEVOTIONAL_WORDS.some(function(w){ return x.indexOf(w)>=0; });
  }
  function isGodSong(t){
    const x=songSearchText(t);
    return isDevotionalSong(t) || /\b(abhang|aarti|arti|bhajan|bhakti|mantra|stotra|chalisa|kirtan|pooja|puja|prarthana|shlok|shloka)\b/i.test(x);
  }

  async function searchSongsSafe(query,page,limit){
    try{
      const r=await Api.searchSongs(query,page||0,limit||24);
      return ((r.data&&r.data.results)||[]).map(function(raw,idx){
        const song=normalizeSong(raw);
        if(song){
          // Search-result order is used as a popularity signal because the API
          // does not expose a reliable India-wide play-count field here.
          song._mixRank=(Number(page)||0)*30+idx;
        }
        return song;
      }).filter(Boolean);
    }catch(e){ return []; }
  }

  // Broad, high-demand discovery terms. These deliberately supplement the
  // mood-specific searches so each mix has familiar Indian hits instead of
  // becoming a collection of obscure keyword matches.
  const POPULAR_MIX_SEEDS={
    happy:["top hindi songs india","hindi viral hits","bollywood hits","top marathi songs","punjabi hits india"],
    sad:["top sad hindi songs","popular heartbreak songs","bollywood emotional hits","sad marathi hits"],
    romantic:["top romantic hindi songs","bollywood love hits","popular love songs india","romantic marathi hits"],
    energy:["top energetic hindi songs","viral workout songs india","bollywood power hits","punjabi energetic hits"],
    party:["top party songs india","bollywood party hits","viral dance songs india","punjabi party hits","marathi party hits"],
    chill:["top chill hindi songs","popular lofi india","soft bollywood hits","chill indian hits"],
    latenight:["top night drive hindi songs","late night hits india","midnight lofi india","night drive bollywood"],
    roadtrip:["top road trip hindi songs","popular travel songs india","highway bollywood hits","long drive songs india"],
    rap:["top indian hip hop","popular hindi rap","top marathi rap","desi hip hop hits"],
    motivation:["top motivational hindi songs","popular hustle songs india","bollywood motivational hits","success songs india"],
    rainy:["top rain songs hindi","popular monsoon songs india","bollywood baarish hits","rainy marathi songs"],
    focus:["top focus music india","popular study lofi","instrumental indian hits","deep focus music"],
    god:["most popular bhajan india","top hindi bhakti songs","popular ganpati songs","top mahadev songs","popular krishna bhajan","top vitthal abhang"],
    surprise:["top hindi songs india","viral indian hits","top bollywood songs","top marathi songs","punjabi hits india","indian trending songs"]
  };
  function moodKeyForSeeds(seeds){
    for(const k of Object.keys(MOODS)) if(MOODS[k]===seeds) return k;
    return null;
  }
  function textHasAny(text,words){
    const x=String(text||'').toLowerCase();
    return words.some(function(w){return x.indexOf(String(w).toLowerCase())>=0;});
  }
  function moodScore(song,key,sourceSeed){
    const profile=MOOD_PROFILES[key];
    if(!profile) return 1;
    const text=songSearchText(song);
    let score=2; // every result already passed through a mood-specific API query
    if(textHasAny(text,profile.good)) score+=4;
    if(sourceSeed){
      const seedWords=String(sourceSeed).toLowerCase().split(/[^a-z0-9]+/).filter(function(w){return w.length>2;});
      for(const w of seedWords) if(text.indexOf(w)>=0) score+=1;
    }
    if(textHasAny(text,profile.bad)) score-=7;
    if(key!=='god' && isDevotionalSong(song)) score-=12;
    if(key==='god' && isGodSong(song)) score+=8;
    return score;
  }
  function isMoodCompatible(song,key,sourceSeed){
    const profile=MOOD_PROFILES[key];
    if(!profile) return true;
    if(key==='god') return isGodSong(song);
    if(isDevotionalSong(song)) return false;
    const text=songSearchText(song);
    if(textHasAny(text,profile.bad)) return false;
    return moodScore(song,key,sourceSeed)>=2;
  }
  async function buildMix(seeds,count){
    const key=moodKeyForSeeds(seeds) || 'happy';
    const profile=MOOD_PROFILES[key] || MOOD_PROFILES.happy;
    const isGodMix=key==='god';

    // Every play gets a fresh combination of mood + popular discovery queries.
    // We use several first-page searches rather than one fixed playlist, then
    // rank familiar search results before applying diversity/family filtering.
    const moodSeeds=shuffleArray(profile.seeds).slice(0,Math.min(profile.seeds.length,isGodMix?8:6));
    const popularSeeds=shuffleArray(POPULAR_MIX_SEEDS[key]||POPULAR_MIX_SEEDS.happy).slice(0,isGodMix?4:4);
    const picks=shuffleArray(moodSeeds.concat(popularSeeds)).slice(0,isGodMix?10:10);
    const batches=await Promise.all(picks.map(function(seed,i){
      // First page is generally the strongest relevance/popularity surface.
      // Occasionally use page 1 so repeated clicks still discover new tracks.
      const page=(Math.random()<0.22 && !isGodMix)?1:0;
      return searchSongsSafe(seed,page,30).then(function(rows){
        return rows.map(function(song){return {song:song,seed:seed,rank:Number(song._mixRank)||i*30};});
      });
    }));
    let pool=batches.reduce(function(a,b){return a.concat(b);},[]);

    pool=pool.filter(function(item){return isMoodCompatible(item.song,key,item.seed);});

    const bestById=new Map();
    for(const item of pool){
      const t=item.song;
      if(!t||!t.id) continue;
      const id=String(t.id);
      const mood=moodScore(t,key,item.seed);
      // Earlier search positions get a strong boost; mood relevance still wins.
      const rank=Math.max(0,Number(item.rank)||0);
      const popularity=Math.max(0,14-Math.min(14,rank/2.5));
      const score=mood*10+popularity+Math.random()*2.5;
      const prev=bestById.get(id);
      if(!prev || score>prev.score) bestById.set(id,{song:t,score,seed:item.seed,rank:rank});
    }

    const unique=Array.from(bestById.values()).sort(function(a,b){return b.score-a.score;});

    // Keep the mix recognisable but varied: no duplicate/alternate family and
    // no artist or album dominating the first part of the queue.
    const seenFamily=new Set(),artistCount=new Map(),albumCount=new Map(),out=[];
    function familyKey(t){
      const title=String(t.name||'').toLowerCase()
        .replace(/\b(official|video|audio|lyrics?|remix|remastered|version|edit|mix|slowed|reverb|lofi|live|cover|duet|full)\b/g,'')
        .replace(/[^a-z0-9]+/g,' ').trim();
      const artist=String(t.artistName||'unknown').toLowerCase().trim();
      return title+'|'+artist;
    }
    for(const item of unique){
      const t=item.song, family=familyKey(t);
      const artist=String(t.artistName||'unknown').toLowerCase().trim();
      const album=String(t.albumName||'single').toLowerCase().trim();
      if(seenFamily.has(family)) continue;
      const ac=artistCount.get(artist)||0, alc=albumCount.get(album)||0;
      if(ac>=2 || (album!=='single' && alc>=1)) continue;
      seenFamily.add(family); artistCount.set(artist,ac+1); albumCount.set(album,alc+1);
      out.push(t);
      if(out.length>=count) break;
    }

    // If a niche mood has a smaller pool, relax only artist/album caps.
    // Never relax the mood classifier or duplicate-family protection.
    if(out.length<count){
      for(const item of unique){
        const t=item.song, family=familyKey(t);
        if(out.includes(t)||seenFamily.has(family)) continue;
        const artist=String(t.artistName||'unknown').toLowerCase().trim();
        const ac=artistCount.get(artist)||0;
        if(ac>=3) continue;
        seenFamily.add(family); artistCount.set(artist,ac+1); out.push(t);
        if(out.length>=count) break;
      }
    }

    // Final shuffle is intentionally performed after popularity filtering so
    // the queue starts with familiar tracks but never feels like a fixed chart.
    return shuffleArray(out);
  }

  /* ---------------- Language discovery mix ----------------
     Multiple languages can be selected. Each play builds a fresh pool from
     viral/trending/popular search surfaces, then applies the same family and
     artist diversity protection used by Smart Moods. */
  const MUSIC_LANGUAGES=[
    ["Hindi","hindi"],["Marathi","marathi"],["Punjabi","punjabi"],["Tamil","tamil"],
    ["Telugu","telugu"],["Kannada","kannada"],["Malayalam","malayalam"],["Bengali","bengali"],
    ["Gujarati","gujarati"],["Bhojpuri","bhojpuri"],["Haryanvi","haryanvi"],["Odia","odia"],
    ["Assamese","assamese"],["Rajasthani","rajasthani"],["Urdu","urdu"],["Konkani","konkani"],
    ["Sindhi","sindhi"],["Kashmiri","kashmiri"],["Nepali","nepali"],["English","english"]
  ];
  const LANGUAGE_QUERY_TERMS={
    Hindi:["hindi viral songs","hindi trending songs","hindi top hits","hindi popular songs"],
    Marathi:["marathi viral songs","marathi trending songs","marathi top hits","marathi popular songs"],
    Punjabi:["punjabi viral songs","punjabi trending songs","punjabi top hits","punjabi popular songs"],
    Tamil:["tamil viral songs","tamil trending songs","tamil top hits","tamil popular songs"],
    Telugu:["telugu viral songs","telugu trending songs","telugu top hits","telugu popular songs"],
    Kannada:["kannada viral songs","kannada trending songs","kannada top hits","kannada popular songs"],
    Malayalam:["malayalam viral songs","malayalam trending songs","malayalam top hits","malayalam popular songs"],
    Bengali:["bengali viral songs","bengali trending songs","bengali top hits","bengali popular songs"],
    Gujarati:["gujarati viral songs","gujarati trending songs","gujarati top hits","gujarati popular songs"],
    Bhojpuri:["bhojpuri viral songs","bhojpuri trending songs","bhojpuri top hits","bhojpuri popular songs"],
    Haryanvi:["haryanvi viral songs","haryanvi trending songs","haryanvi top hits","haryanvi popular songs"],
    Odia:["odia viral songs","odia trending songs","odia top hits","odia popular songs"],
    Assamese:["assamese viral songs","assamese trending songs","assamese top hits","assamese popular songs"],
    Rajasthani:["rajasthani viral songs","rajasthani trending songs","rajasthani top hits","rajasthani popular songs"],
    Urdu:["urdu viral songs","urdu trending songs","urdu top hits","urdu popular songs"],
    Konkani:["konkani viral songs","konkani trending songs","konkani top hits","konkani popular songs"],
    Sindhi:["sindhi viral songs","sindhi trending songs","sindhi top hits","sindhi popular songs"],
    Kashmiri:["kashmiri viral songs","kashmiri trending songs","kashmiri top hits","kashmiri popular songs"],
    Nepali:["nepali viral songs","nepali trending songs","nepali top hits","nepali popular songs"],
    English:["english viral songs india","english trending songs","english top hits","english popular songs"]
  };
  function normMixText(v){return String(v||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();}
  function languageMatchesSong(song,lang){
    const wanted=normMixText(lang);
    const actual=normMixText(song&&song.language);
    if(actual && (actual===wanted || actual.includes(wanted) || wanted.includes(actual))) return true;
    // Search terms are already language-specific; keep a few scripts/text hints
    // when the API omits its language field rather than throwing away good hits.
    const text=normMixText([song&&song.name,song&&song.artistName,song&&song.albumName].join(" "));
    const hints={Hindi:["hindi","bollywood"],Marathi:["marathi"],Punjabi:["punjabi"],Tamil:["tamil"],Telugu:["telugu"],Kannada:["kannada"],Malayalam:["malayalam"],Bengali:["bengali"],Gujarati:["gujarati"],Bhojpuri:["bhojpuri"],Haryanvi:["haryanvi"],Odia:["odia","oriya"],Assamese:["assamese"],Rajasthani:["rajasthani"],Urdu:["urdu"],Konkani:["konkani"],Sindhi:["sindhi"],Kashmiri:["kashmiri"],Nepali:["nepali"],English:["english"]};
    return (hints[lang]||[wanted]).some(h=>text.includes(h));
  }
  async function buildLanguageMix(languages,count){
    const langs=Array.from(new Set(languages||[])).filter(Boolean);
    if(!langs.length) return [];
    const selected=langs.filter(l=>LANGUAGE_QUERY_TERMS[l]);
    const queries=[];
    selected.forEach(lang=>{
      const terms=shuffleArray(LANGUAGE_QUERY_TERMS[lang]).slice(0,3);
      terms.forEach(q=>queries.push({lang,q}));
    });
    // Keep requests bounded on low-end/mobile while still creating a large pool.
    const chosen=shuffleArray(queries).slice(0,Math.min(24,queries.length));
    const batches=await Promise.all(chosen.map(async item=>{
      const page=Math.random()<0.18?1:0;
      const rows=await searchSongsSafe(item.q,page,30);
      return rows.map((song,idx)=>({song,lang:item.lang,rank:(page*30)+idx}));
    }));
    const pool=batches.flat().filter(x=>languageMatchesSong(x.song,x.lang) && !isDevotionalSong(x.song));
    const best=new Map();
    for(const item of pool){
      const t=item.song;if(!t||!t.id)continue;
      const key=String(t.id);
      const rank=Math.max(0,Number(item.rank)||0);
      const score=(18-Math.min(18,rank/2.2))*3 + Math.random()*7;
      const prev=best.get(key);if(!prev||score>prev.score)best.set(key,{...item,score});
    }
    const unique=Array.from(best.values()).sort((a,b)=>b.score-a.score);
    const seenFamily=new Set(),artistCount=new Map(),out=[];
    function fam(t){return normMixText(String(t.name||"")).replace(/\b(official|video|audio|lyrics?|remix|remastered|version|edit|mix|slowed|reverb|lofi|live|cover|duet|full)\b/g,"").trim()+"|"+normMixText(t.artistName||"");}
    for(const item of unique){
      const t=item.song,f=fam(t),a=normMixText(t.artistName||"unknown");
      if(seenFamily.has(f))continue;
      if((artistCount.get(a)||0)>=2)continue;
      seenFamily.add(f);artistCount.set(a,(artistCount.get(a)||0)+1);out.push(t);
      if(out.length>=count)break;
    }
    if(out.length<count){
      for(const item of unique){const t=item.song,f=fam(t),a=normMixText(t.artistName||"unknown");if(seenFamily.has(f)||(artistCount.get(a)||0)>=3)continue;seenFamily.add(f);artistCount.set(a,(artistCount.get(a)||0)+1);out.push(t);if(out.length>=count)break;}
    }
    return shuffleArray(out);
  }
  let languageMixBusy=false;
  async function playLanguageMix(languages){
    const selected=Array.from(new Set(languages||[]));
    if(!selected.length){toast("Select at least 1 language.","error");return;}
    if(languageMixBusy)return;languageMixBusy=true;
    const label=selected.length===1?selected[0]+" Viral Mix":selected.join(" + ")+" Viral Mix";
    toast(label+" — loading fresh trending songs…");
    try{
      const list=await buildLanguageMix(selected,28);
      if(!list.length){toast("No matching trending songs found right now.","error");return;}
      closePop();
      Player.play(list[0],list,0,{autoTransition:false});
      toast("🌐 "+label+" — "+list.length+" fresh songs queued");
    }finally{languageMixBusy=false;}
  }

  let mixBusy=false;
  async function playMix(seeds,label){
    if(mixBusy) return; mixBusy=true;
    toast(label+" — loading fresh trending songs…");
    try{
      const list=await buildMix(seeds,22);
      if(!list.length){ toast("Couldn't load "+label+" right now. Check your connection.","error"); return; }
      closePop();
      Player.play(list[0], list, 0, {autoTransition:false});
      toast("🎶 "+label+" — "+list.length+" fresh songs queued");
    }finally{ mixBusy=false; }
  }

  /* ---------------- Library backup / restore ---------------- */
  function exportBackup(){
    const data={app:"BOOSTER OS",format:"booster-backup-v1",exportedAt:new Date().toISOString(),
      favSongs:State.favSongs,favAlbums:State.favAlbums,favArtists:State.favArtists,favPlaylists:State.favPlaylists,
      history:State.history,queue:State.queue,queueIndex:State.queueIndex,
      shuffle:State.shuffle,repeat:State.repeat,volume:State.volume,settings:State.settings,
      lastSong:Store.get("lastSong",null)};
    try{
      const blob=new Blob([JSON.stringify(data,null,1)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url;
      a.download="booster-os-backup-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},4000);
      toast("⬇ Library backup exported");
    }catch(e){ toast("Export failed on this device.","error"); }
  }
  function importBackup(file){
    const rd=new FileReader();
    rd.onload=function(){
      try{
        const d=JSON.parse(rd.result);
        if(!d||typeof d!=="object") throw new Error("bad");
        if(Array.isArray(d.favSongs)){ State.favSongs=d.favSongs; Store.set("favSongs",d.favSongs); }
        if(Array.isArray(d.favAlbums)){ State.favAlbums=d.favAlbums; Store.set("favAlbums",d.favAlbums); }
        if(Array.isArray(d.favArtists)){ State.favArtists=d.favArtists; Store.set("favArtists",d.favArtists); }
        if(Array.isArray(d.favPlaylists)){ State.favPlaylists=d.favPlaylists; Store.set("favPlaylists",d.favPlaylists); }
        if(Array.isArray(d.history)){ State.history=d.history.slice(0,60); Store.set("history",State.history); }
        if(Array.isArray(d.queue)){ State.queue=d.queue; State.queueIndex=d.queue.length?Math.min(Math.max(0,d.queueIndex||0),d.queue.length-1):-1; if(State.shuffle)Queue.buildShuffleOrder(); Queue.persist(); renderQueuePanel(); }
        if(d.settings&&typeof d.settings==="object"){ Object.assign(State.settings,d.settings); saveSettings(); ThemeManager.apply(State.settings.theme||"dark"); }
        if(typeof d.volume==="number") Player.setVolume(d.volume);
        if(State.view==="library"||State.view==="favorites"||State.view==="recent") renderLibrary();
        if(State.view==="settings") renderSettings();
        if(State.view==="home") renderHome();
        toast("⬆ Library backup imported");
      }catch(e){ toast("Invalid backup file.","error"); }
    };
    rd.readAsText(file);
  }
  function resumeLast(){
    const last=Store.get("lastSong",null);
    if(!last||!last.id){ toast("No last song saved yet.","error"); return; }
    const pos=State.settings.rememberPosition?Number(Store.get("pos_"+last.id,0)):0;
    const ctx=State.queue&&State.queue.length?State.queue:[last];
    const idx=ctx.findIndex(function(t){return t&&t.id===last.id;});
    closePop();
    Player.play(last, ctx, idx>=0?idx:0, {autoTransition:false,startAt:pos>0?pos:undefined});
    toast("▶ Resuming "+last.name);
  }
  function saveQueueNow(){
    Queue.persist();
    Store.set("savedQueue",{queue:State.queue,queueIndex:State.queueIndex,savedAt:Date.now()});
    toast("💾 Queue saved ("+State.queue.length+" tracks)");
  }

  /* ---------------- Quick controls ---------------- */
  /* Fullscreen: standard + vendor-prefixed APIs, user-visible failure messages, and ONE fullscreenchange
     listener that returns to the Mini Player when fullscreen ends (Esc, browser UI or the menu item). */
  let fsOpenedPlayer=false, fsFailAt=0;
  const fsElement=()=>document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement||null;
  const fsRequestFn=el=>el.requestFullscreen||el.webkitRequestFullscreen||el.webkitRequestFullScreen||el.mozRequestFullScreen||el.msRequestFullscreen||null;
  const fsExitFn=doc=>doc.exitFullscreen||doc.webkitExitFullscreen||doc.webkitCancelFullScreen||doc.mozCancelFullScreen||doc.msExitFullscreen||null;
  function fsFail(msg){
    if(Date.now()-fsFailAt<600) return;            /* promise rejection + fullscreenerror event both fire: show one toast */
    fsFailAt=Date.now(); fsOpenedPlayer=false;
    toast(msg||"Fullscreen couldn't be activated. The full player still works normally.","error");
  }
  function onFsChange(){
    if(fsElement()) return;                        /* entered fullscreen */
    if(!fsOpenedPlayer) return;                    /* the user opened the Full Player themselves: leave it */
    fsOpenedPlayer=false;
    const fp=document.getElementById("full-player");
    if(fp&&fp.classList.contains("open")) closeFullPlayer();   /* proper close: history entry, lyrics pane and motion layer all unwind */
  }
  ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"].forEach(ev=>document.addEventListener(ev,onFsChange));
  ["fullscreenerror","webkitfullscreenerror","mozfullscreenerror","MSFullscreenError"].forEach(ev=>document.addEventListener(ev,()=>fsFail()));
  (function(){ /* if the user closes the Full Player while still fullscreen, exiting fullscreen must not close a player they reopened later */
    const fp=document.getElementById("full-player"); if(!fp||fp.dataset.fsWatch) return; fp.dataset.fsWatch="1";
    new MutationObserver(()=>{ if(!fp.classList.contains("open")) fsOpenedPlayer=false; }).observe(fp,{attributes:true,attributeFilter:["class"]});
  })();
  function toggleFullscreen(){
    const doc=document;
    closePop();
    if(fsElement()){
      const ex=fsExitFn(doc);
      try{
        const p=ex?ex.call(doc):null;
        if(p&&typeof p.catch==="function") p.catch(function(){ fsFail("Couldn't leave fullscreen. Press Esc or use the browser controls."); });
      }catch(_){ fsFail("Couldn't leave fullscreen. Press Esc or use the browser controls."); }
      return;                                      /* onFsChange() restores the Mini Player */
    }
    const el=doc.documentElement, rq=fsRequestFn(el);
    const fp=doc.getElementById("full-player");
    if(State.currentTrack && !(fp&&fp.classList.contains("open"))){ fsOpenedPlayer=true; openFullPlayer(); }
    if(!rq){ fsFail("Fullscreen isn't supported on this browser or device. The full player is open instead."); return; }
    try{
      const p=rq.call(el);
      if(p&&typeof p.catch==="function") p.catch(function(){ fsFail("Fullscreen was blocked by the browser. The full player is open instead."); });
    }catch(_){ fsFail("Fullscreen isn't available right now. The full player is open instead."); }
  }
  function shuffleQueueNow(){
    if(!State.queue||State.queue.length<2){ toast("Queue is too short to shuffle.","error"); return; }
    const cur=(State.queueIndex>=0&&State.queueIndex<State.queue.length)?State.queue[State.queueIndex]:State.currentTrack;
    let rest=State.queue.filter(function(_,i){return i!==State.queueIndex;});
    rest=shuffleArray(rest);
    State.queue=cur?[cur].concat(rest):rest;
    State.queueIndex=cur?0:-1;
    if(State.shuffle) Queue.buildShuffleOrder();
    Queue.persist(); renderQueuePanel();
    toast("🔀 Queue shuffled");
  }
  async function clearQueueNow(){
    const ok=await confirmModal("Clear queue?","This removes all upcoming tracks except the one currently playing.");
    if(ok){ Queue.clear(); renderQueuePanel(); toast("🧹 Queue cleared"); }
  }

  /* ---------------- Command palette (Ctrl/⌘+K) ---------------- */
  const CMDS=[
    {label:"▶ Play / Pause",fn:function(){Player.toggle();}},
    {label:"⏭ Next track",fn:function(){Player.next(false);}},
    {label:"⏮ Previous track",fn:function(){Player.prev();}},
    {label:"🔀 Toggle shuffle",fn:function(){Player.toggleShuffle();}},
    {label:"🔀 Shuffle queue",fn:shuffleQueueNow},
    {label:"🔁 Cycle repeat mode",fn:function(){Player.cycleRepeat();}},
    {label:"🧹 Clear queue",fn:clearQueueNow},
    {label:"💾 Save queue now",fn:saveQueueNow},
    {label:"▶ Resume last song",fn:resumeLast},
    {label:"⬇ Export library backup",fn:exportBackup},
    {label:"🎤 Marathi Rap Mix",fn:function(){playMix(MARATHI_RAP_SEEDS,"Marathi Rap Mix");}},
    {label:"🔥 Marathi + Hindi Viral Mix",fn:function(){playMix(MARATHI_HINDI_SEEDS,"Marathi + Hindi Viral Mix");}},
    {label:"🎭 Mood: Happy",fn:function(){playMix(MOODS.happy,"Happy Mix");}},
    {label:"🎭 Mood: Chill",fn:function(){playMix(MOODS.chill,"Chill Mix");}},
    {label:"🎭 Mood: Romantic",fn:function(){playMix(MOODS.romantic,"Romantic Mix");}},
    {label:"🎭 Mood: Workout",fn:function(){playMix(MOODS.energy,"Energy Mix");}},
    {label:"🎭 Mood: Sad",fn:function(){playMix(MOODS.sad,"Sad Mix");}},
    {label:"🎭 Mood: Focus",fn:function(){playMix(MOODS.focus,"Focus Mix");}},
    {label:"🎙 Toggle karaoke mode",fn:toggleKaraoke},
    {label:"⛶ Fullscreen player",fn:toggleFullscreen},
    {label:"🏠 Go Home",fn:function(){navigate("home");}},
    {label:"🔍 Go Search",fn:function(){navigate("search");}},
    {label:"❤ Go Favorites",fn:function(){navigate("favorites");}},
    {label:"⚙ Go Settings",fn:function(){navigate("settings");}},
    {label:"🌗 Toggle theme",fn:function(){ThemeManager.toggleQuick();}}
  ];
  let cmdkSel=0,cmdkFiltered=[];
  function openCmdk(filter){
    const w=q("bos-cmdk"); if(!w)return;
    w.classList.add("open");
    const inp=q("bos-cmdk-input");
    inp.value=filter||"";
    renderCmdk(inp.value);
    setTimeout(function(){inp.focus(); inp.select();},40);
  }
  function closeCmdk(){ const w=q("bos-cmdk"); if(w)w.classList.remove("open"); }
  function renderCmdk(filter){
    const f=String(filter||"").toLowerCase();
    cmdkFiltered=CMDS.filter(function(c){return c.label.toLowerCase().indexOf(f)>=0;});
    cmdkSel=0;
    const list=q("bos-cmdk-list");
    list.innerHTML=cmdkFiltered.length
      ? cmdkFiltered.map(function(c,i){return '<div class="bos-cmdk-item'+(i===0?" sel":"")+'" data-i="'+i+'">'+c.label+'</div>';}).join("")
      : '<div class="bos-cmdk-item">No matching commands</div>';
  }
  function cmdkRun(i){ const c=cmdkFiltered[i]; closeCmdk(); if(c&&c.fn)c.fn(); }

  /* ---------------- Karaoke (word-by-word) ---------------- */
  let karaokeOn=Store.get("karaoke",false);
  function toggleKaraoke(){
    karaokeOn=!karaokeOn; Store.set("karaoke",karaokeOn);
    if(State.lyricsOpen){ renderLyricsPane(); setTimeout(wrapKaraokeWords,30); updateActiveLyric(primaryAudio().currentTime||0,true); }
    toast(karaokeOn?"🎙 Karaoke mode ON — word-by-word highlight":"Karaoke mode OFF");
  }
  function wrapKaraokeWords(){
    const box=q("lyrics-scroll"); if(!box||!currentLyrics||!currentLyrics.synced)return;
    Array.prototype.forEach.call(box.querySelectorAll(".lyric-line"),function(line){
      const fill=line.querySelector(".lyric-fill"); if(!fill||line.dataset.nw)return;
      if(karaokeOn){
        if(line.dataset.kw)return;
        line.dataset.kw="1";
        line.classList.add("karaoke-on");
        const words=fill.textContent.split(/\s+/).filter(Boolean);
        fill.innerHTML=words.map(function(w,i){return '<span class="lyric-word" style="--word-i:'+i+'">'+escapeHTML(w)+'</span>';}).join(" ");
      }else if(line.dataset.kw){
        delete line.dataset.kw;
        line.classList.remove("karaoke-on");
        fill.textContent=fill.textContent;
      }
    });
  }
  function karaokeTick(t){
    const box=q("lyrics-scroll"); if(!box||!currentLyrics||!currentLyrics.synced||activeLyricIndex<0)return;
    const line=box.querySelector('.lyric-line[data-i="'+activeLyricIndex+'"]');
    if(!line)return;
    const words=line.querySelectorAll(".lyric-word"); if(!words.length)return;
    const start=Number(line.dataset.t)||0;
    const next=box.querySelector('.lyric-line[data-i="'+(activeLyricIndex+1)+'"]');
    const end=next?Number(next.dataset.t)||start+4:Math.min((primaryAudio().duration||start+4),start+4);
    const frac=clamp((t-start)/Math.max(.3,(end-start)*.88),0,1);
    const upto=(frac>=1||t>=end-.12)?words.length:Math.floor(frac*words.length);
    for(let i=0;i<words.length;i++) words[i].classList.toggle("wdone",i<upto);
  }
  /* ---------------- Floating quick-action button (drag anywhere, stays put) ---------------- */
  function closePop(){ const p=q("bos-pop"); if(p)p.classList.remove("open"); }
  function togglePop(){ const p=q("bos-pop"); if(p)p.classList.toggle("open"); }
  function makeFabDraggable(el){
    let dragging=false,moved=false,sx=0,sy=0,sl=0,st=0,pid=null;
    function clampPos(x,y){
      const r=el.getBoundingClientRect();
      return {x:Math.max(6,Math.min(x,window.innerWidth-r.width-6)), y:Math.max(6,Math.min(y,window.innerHeight-r.height-6))};
    }
    function applyPos(x,y,save){
      const p=clampPos(x,y);
      el.style.left=p.x+"px"; el.style.top=p.y+"px"; el.style.right="auto"; el.style.bottom="auto";
      if(save)Store.set("bosFabPos",p);
    }
    const saved=Store.get("bosFabPos",null);
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)) applyPos(saved.x,saved.y,false);
    el.addEventListener("pointerdown",function(e){
      if(e.button!==undefined&&e.button!==0&&e.pointerType==="mouse")return;
      pid=e.pointerId; dragging=true; moved=false; sx=e.clientX; sy=e.clientY;
      const r=el.getBoundingClientRect(); sl=r.left; st=r.top;
      el.classList.add("bos-dragging");
      try{el.setPointerCapture(pid);}catch(_){}
    });
    el.addEventListener("pointermove",function(e){
      if(!dragging||e.pointerId!==pid)return;
      const dx=e.clientX-sx,dy=e.clientY-sy;
      if(Math.abs(dx)>7||Math.abs(dy)>7)moved=true;
      if(moved){e.preventDefault(); applyPos(sl+dx,st+dy,false);}
    },{passive:false});
    const end=function(e){
      if(!dragging||e.pointerId!==pid)return;
      dragging=false; el.classList.remove("bos-dragging");
      if(moved){ const r=el.getBoundingClientRect(); applyPos(r.left,r.top,true); }
      try{el.releasePointerCapture(pid);}catch(_){}
      pid=null;
    };
    el.addEventListener("pointerup",end);
    el.addEventListener("pointercancel",end);
    el.addEventListener("click",function(e){
      if(moved){e.preventDefault(); e.stopImmediatePropagation(); moved=false; return;}
      togglePop();
    },true);
    window.addEventListener("resize",function(){ const r=el.getBoundingClientRect(); applyPos(r.left,r.top,false); });
  }

  /* ---------------- Languages picker ---------------- */
  let languagePicker=new Set();
  function renderLanguagePicker(){
    const g=q("bos-language-grid");if(!g)return;
    g.innerHTML=MUSIC_LANGUAGES.map(function(item){const name=item[0];return '<button class="bos-language-chip'+(languagePicker.has(name)?" selected":"")+'" data-bos-language="'+escapeHTML(name)+'"><span>'+languageFlag(name)+'</span><strong>'+escapeHTML(name)+'</strong><i>✓</i></button>';}).join("");
    updateLanguagePickerFooter();
  }
  function languageFlag(name){
    const f={Hindi:"🇮🇳",Marathi:"🇮🇳",Punjabi:"🇮🇳",Tamil:"🇮🇳",Telugu:"🇮🇳",Kannada:"🇮🇳",Malayalam:"🇮🇳",Bengali:"🇮🇳",Gujarati:"🇮🇳",Bhojpuri:"🇮🇳",Haryanvi:"🇮🇳",Odia:"🇮🇳",Assamese:"🇮🇳",Rajasthani:"🇮🇳",Urdu:"🇮🇳",Konkani:"🇮🇳",Sindhi:"🇮🇳",Kashmiri:"🇮🇳",Nepali:"🇳🇵",English:"🌍"};return f[name]||"🌐";
  }
  function updateLanguagePickerFooter(){
    const n=languagePicker.size,c=q("bos-language-count"),b=q("bos-language-play");
    if(c)c.textContent=n?(n+" language"+(n>1?"s":"")+" selected"):"Select languages";
    if(b)b.disabled=n<1;
  }

  /* ---------------- Wiring ---------------- */
  function on(id,fn){ const el=q(id); if(el)el.addEventListener("click",function(e){e.stopPropagation(); fn(e);}); }
  function init(){
    const fab=q("bos-fab"); if(fab)makeFabDraggable(fab);
    on("bos-marathi-rap",function(){playMix(MARATHI_RAP_SEEDS,"Marathi Rap Mix");});
    on("bos-marathi-hindi",function(){playMix(MARATHI_HINDI_SEEDS,"Marathi + Hindi Viral Mix");});
    on("bos-smart-open",function(){
      const box=q("bos-smart-v2");
      if(box){box.scrollIntoView({behavior:"auto",block:"nearest"}); if(window.BoosterSmartLearning&&BoosterSmartLearning.refresh) BoosterSmartLearning.refresh(box.dataset.discovery==="1"?"discovery":"personalized");}
      else toast("Smart Suggestions is loading…");
    });
    on("bos-mood",function(){ closePop(); const m=q("bos-mood-modal"); if(m){m.classList.add("open"); m.setAttribute("aria-hidden","false");} });
    on("bos-languages",function(){ closePop(); const m=q("bos-language-modal"); if(m){renderLanguagePicker();m.classList.add("open");m.setAttribute("aria-hidden","false");} });
    on("bos-karaoke",toggleKaraoke);
    on("bos-fullscreen",toggleFullscreen);
    on("bos-export",exportBackup);
    on("bos-import",function(){ const f=q("bos-import-file"); if(f)f.click(); });
    on("bos-resume",resumeLast);
    on("bos-savequeue",saveQueueNow);
    on("bos-cmdk-open",function(){closePop(); openCmdk("");});
    on("bos-shuffle",shuffleQueueNow);
    on("bos-clearqueue",clearQueueNow);
    const languageModal=q("bos-language-modal");
    if(languageModal)languageModal.addEventListener("click",function(e){
      if(e.target===languageModal || e.target.closest(".bos-language-close")){languageModal.classList.remove("open");languageModal.setAttribute("aria-hidden","true");return;}
      const btn=e.target.closest("[data-bos-language]");if(!btn)return;
      const lang=btn.dataset.bosLanguage;
      if(languagePicker.has(lang))languagePicker.delete(lang);else languagePicker.add(lang);
      btn.classList.toggle("selected",languagePicker.has(lang));
      updateLanguagePickerFooter();
    });
    on("bos-language-play",function(){const m=q("bos-language-modal");playLanguageMix(Array.from(languagePicker));if(m){m.classList.remove("open");m.setAttribute("aria-hidden","true");}});
    const moodModal=q("bos-mood-modal");
    if(moodModal)moodModal.addEventListener("click",function(e){
      if(e.target===moodModal || e.target.closest(".bos-mood-close")){ moodModal.classList.remove("open"); moodModal.setAttribute("aria-hidden","true"); return; }
      const btn=e.target.closest("[data-bos-mood]"); if(!btn)return;
      const key=btn.dataset.bosMood;
      const seeds=key==="surprise" ? shuffleArray(Object.keys(MOODS).filter(function(k){return k!=="god";}).map(function(k){return MOODS[k];}).flat()).slice(0,8) : MOODS[key];
      if(seeds) playMix(seeds,key==="surprise"?"Surprise Mix":(key==="god"?"God Songs Mix":(btn.dataset.label||"Mood Mix")));
      moodModal.classList.remove("open"); moodModal.setAttribute("aria-hidden","true");
    });
    const imp=q("bos-import-file");
    if(imp)imp.addEventListener("change",function(){ if(imp.files&&imp.files[0])importBackup(imp.files[0]); imp.value=""; });
    document.addEventListener("click",function(e){
      const pop=q("bos-pop");
      if(pop&&pop.classList.contains("open")&&!e.target.closest("#bos-pop")&&!e.target.closest("#bos-fab")) closePop();
      if(e.target.id==="bos-cmdk") closeCmdk();
    });
    const cinp=q("bos-cmdk-input");
    if(cinp){
      cinp.addEventListener("input",function(){renderCmdk(cinp.value);});
      cinp.addEventListener("keydown",function(e){
        if(e.key==="ArrowDown"){e.preventDefault(); cmdkSel=Math.min(cmdkFiltered.length-1,cmdkSel+1);}
        else if(e.key==="ArrowUp"){e.preventDefault(); cmdkSel=Math.max(0,cmdkSel-1);}
        else if(e.key==="Enter"){e.preventDefault(); cmdkRun(cmdkSel); return;}
        else if(e.key==="Escape"){closeCmdk(); return;}
        else return;
        const list=q("bos-cmdk-list");
        Array.prototype.forEach.call(list.children,function(c,i){c.classList.toggle("sel",i===cmdkSel);});
      });
    }
    const clist=q("bos-cmdk-list");
    if(clist)clist.addEventListener("click",function(e){
      const item=e.target.closest(".bos-cmdk-item"); if(!item)return;
      const i=parseInt(item.dataset.i,10); if(Number.isFinite(i))cmdkRun(i);
    });
    document.addEventListener("keydown",function(e){
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault(); openCmdk("");}
      else if(e.key==="Tab" && !e.target.closest?.("input,textarea,select,[contenteditable=\"true\"]")){
        if(q("bos-cmdk")?.classList.contains("open")){ e.preventDefault(); closeCmdk(); }
        if(q("bos-pop")?.classList.contains("open")){ e.preventDefault(); closePop(); }
      }
    });
    // Refresh Home only when stale; never create a request storm on focus.
    document.addEventListener("visibilitychange",function(){
      if(!document.hidden&&State.view==="home"&&!State._homeLoading&&Date.now()-State._homeLoadedAt>300000)renderHome();
    });
    // PHASE 6: karaoke hooks (additive wrappers, originals intact)
    const prevRender=renderLyricsPane;
    renderLyricsPane=function(){ const r=prevRender.apply(this,arguments); if(karaokeOn)setTimeout(wrapKaraokeWords,0); return r; };
    const prevUpdate=updateActiveLyric;
    updateActiveLyric=function(currentTime,force){
      prevUpdate(currentTime,force);
    };
  }

  return {init:init, openCmdk:openCmdk};
})();
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){BoosterMax.init();});
else BoosterMax.init();


/* [relocated into app scope: v6-feature-patch] */
(function(){
'use strict';
/* Better stream selection: honor preference, but prefer the highest actually available stream when 320 is selected. */
const _oldBestAudioUrl=bestAudioUrl;
bestAudioUrl=function(track){
  if(!track||!track.downloadUrl)return null;
  const dl=track.downloadUrl;
  const pref=String(State.settings.audioQuality||'320');
  const order=(typeof QUALITY_ORDER!=='undefined'&&QUALITY_ORDER.length?QUALITY_ORDER:['12','48','96','160','320']).map(String);
  let idx=order.indexOf(pref); if(idx<0)idx=order.length-1;
  for(let i=idx;i<order.length;i++)if(dl[order[i]])return dl[order[i]];
  for(let i=idx-1;i>=0;i--)if(dl[order[i]])return dl[order[i]];
  return _oldBestAudioUrl(track);
};

/* Merge fallback search results so album/artist pages don't look artificially incomplete when API detail payload is sparse. */
function v6uniq(list){const seen=new Set();return list.filter(x=>x&&x.id&&!seen.has(String(x.id))&&(seen.add(String(x.id)),true));}
async function v6SongSearches(query,pages,limit,signal){
  const jobs=[];for(let p=0;p<pages;p++)jobs.push(Api.searchSongs(query,p,limit,signal).then(r=>((r.data&&r.data.results)||[]).map(normalizeSong)).catch(()=>[]));
  return v6uniq((await Promise.all(jobs)).flat());
}
const _renderAlbumDetail=renderAlbumDetail;
renderAlbumDetail=async function(id){
  await _renderAlbumDetail(id);
  if(State.view!=='album'||String(State.viewParams.id)!==String(id))return;
  try{
    const r=await Api.getAlbum(id);const album=normalizeAlbum(r.data);if(!album)return;
    let songs=v6uniq(album.songs||[]);
    if(songs.length<12){
      const extra=await v6SongSearches((album.name+' '+album.artistName).trim(),2,30);
      songs=v6uniq(songs.concat(extra.filter(t=>String(t.albumName||'').toLowerCase()===String(album.name||'').toLowerCase()||songs.length<20)));
    }
    if(songs.length){storeCtx('album-'+id,songs);const list=document.querySelector('#view-album .row-list');if(list)list.innerHTML=songs.map((x,i)=>songRow(x,i,{ctxKey:'album-'+id})).join('');}
  }catch(_){}
};
const _renderArtistDetail=renderArtistDetail;
renderArtistDetail=async function(id){
  await _renderArtistDetail(id);
  if(State.view!=='artist'||String(State.viewParams.id)!==String(id))return;
  try{
    const r=await Api.getArtist(id);const artist=normalizeArtist(r.data);if(!artist)return;
    let songs=v6uniq(artist.topSongs||[]);
    if(songs.length<25){const extra=await v6SongSearches(artist.name,2,30);songs=v6uniq(songs.concat(extra)).slice(0,60);}
    if(songs.length){storeCtx('artist-'+id,songs);const rows=document.querySelectorAll('#view-artist .row-list');if(rows[0])rows[0].innerHTML=songs.map((x,i)=>songRow(x,i,{ctxKey:'artist-'+id})).join('');}
  }catch(_){}
};

/* Queue reliability: close any conflicting overlay, force reflow before opening, and clamp stale indexes. */
function v6NormalizeQueue(){
  State.queue=v6uniq((State.queue||[]));
  if(!State.queue.length){State.queueIndex=-1;return;}
  if(State.queueIndex<0||State.queueIndex>=State.queue.length){const i=State.currentTrack?State.queue.findIndex(x=>x.id===State.currentTrack.id):0;State.queueIndex=i>=0?i:0;}
}
openQueuePanel=function(){
  v6NormalizeQueue();
  const o=$('#queue-overlay'),p=$('#queue-panel'); if(!o||!p)return;
  o.classList.add('open');p.classList.add('open');
  requestAnimationFrame(()=>{ if(p.classList.contains('open')) renderQueuePanel(); });
};
closeQueuePanel=function(){const o=$('#queue-overlay'),p=$('#queue-panel');if(p)p.classList.remove('open');if(o)o.classList.remove('open');};
const _renderQueuePanel=renderQueuePanel;
renderQueuePanel=function(){v6NormalizeQueue();return _renderQueuePanel();};


})();

/* [relocated into app scope: v6-catalog-completeness-patch] */
(function(){
'use strict';
const _catNorm=x=>String(x||'').toLowerCase().replace(/[\s\-_.'’"()]/g,'');
const _catUniq=list=>{const seen=new Set();return (list||[]).filter(x=>x&&x.id&&!seen.has(String(x.id))&&(seen.add(String(x.id)),true));};
const _catSleep=ms=>new Promise(r=>setTimeout(r,ms));

async function _catSearchAllSongs(query, maxPages, limit, signal){
  let out=[];
  for(let page=0;page<maxPages;page++){
    if(signal&&signal.aborted) break;
    try{
      const r=await Api.searchSongs(query,page,limit,signal);
      const rows=((r&&r.data&&r.data.results)||[]).map(normalizeSong).filter(Boolean);
      if(!rows.length) break;
      out=out.concat(rows);
      if(rows.length<limit) break;
      await _catSleep(70);
    }catch(e){ if(signal&&signal.aborted) break; }
  }
  return _catUniq(out);
}
async function _catArtistAlbumsAll(id, signal){
  let out=[];
  for(let page=0;page<8;page++){
    if(signal&&signal.aborted) break;
    try{
      const r=await Api.getArtistAlbums(id,page,signal);
      const rows=((r&&r.data&&r.data.albums)||[]).map(normalizeAlbum).filter(Boolean);
      if(!rows.length) break;
      out=out.concat(rows);
      if(rows.length<10) break;
      await _catSleep(80);
    }catch(e){break;}
  }
  return _catUniq(out);
}
function _catArtistMatch(song, artist){
  const target=_catNorm(artist.name);
  const names=[song.artistName,song.primaryArtists,song.singers].filter(Boolean).map(_catNorm);
  return names.some(n=>n===target || n.includes(target) || target.includes(n));
}
function _catAlbumMatch(song, album){
  const target=_catNorm(album.name), artist=_catNorm(album.artistName);
  const sn=_catNorm(song.albumName||song.album||'');
  const an=_catNorm(song.artistName||'');
  return sn===target || (sn.includes(target)&&target.length>3) ||
         (_catNorm(song.name).includes(target)&&(!artist||an.includes(artist)));
}

/* Replace previous fallback overrides with catalog-aware versions. */
const _baseAlbumRender=renderAlbumDetail;
renderAlbumDetail=async function(id){
  await _baseAlbumRender(id);
  if(State.view!=='album'||String(State.viewParams.id)!==String(id))return;
  const ctl=State._detailAbort, seq=State._detailSeq;
  try{
    const r=await Api.getAlbum(id,ctl&&ctl.signal);
    const album=normalizeAlbum(r&&r.data); if(!album)return;
    let songs=_catUniq(album.songs||[]);
    /* Detail endpoint remains authoritative. Search only fills gaps and only exact matches. */
    if(songs.length<50){
      const queries=[album.name,album.name+' '+album.artistName];
      for(const q of queries){
        const extra=await _catSearchAllSongs(q,4,50,ctl&&ctl.signal);
        songs=_catUniq(songs.concat(extra.filter(x=>_catAlbumMatch(x,album))));
        if(songs.length>=50 || (ctl&&ctl.signal.aborted))break;
      }
    }
    if(ctl&&ctl.signal.aborted||seq!==State._detailSeq||State.view!=='album')return;
    album.songs=songs;
    storeCtx('album-'+id,songs);
    const list=document.querySelector('#view-album .row-list');
    if(list) list.innerHTML=songs.length?songs.map((x,i)=>songRow(x,i,{ctxKey:'album-'+id})).join(''):'<div class="es-desc">No tracks available from the current catalog.</div>';
    const sub=document.querySelector('#view-album .detail-sub');
    if(sub) sub.textContent=(album.artistName||'Unknown Artist')+' · '+(album.year||'')+' · '+songs.length+' songs';
  }catch(e){}
};

const _baseArtistRender=renderArtistDetail;
renderArtistDetail=async function(id){
  await _baseArtistRender(id);
  if(State.view!=='artist'||String(State.viewParams.id)!==String(id))return;
  const ctl=State._detailAbort, seq=State._detailSeq;
  try{
    const r=await Api.getArtist(id,ctl&&ctl.signal);
    const artist=normalizeArtist(r&&r.data); if(!artist)return;

    /* Keep API top songs, then collect more pages but reject unrelated search hits. */
    let songs=_catUniq(artist.topSongs||[]);
    const extra=await _catSearchAllSongs(artist.name,8,50,ctl&&ctl.signal);
    songs=_catUniq(songs.concat(extra.filter(x=>_catArtistMatch(x,artist))));

    /* Fetch every available album page for this artist. */
    const albums=await _catArtistAlbumsAll(id,ctl&&ctl.signal);
    if(ctl&&ctl.signal.aborted||seq!==State._detailSeq||State.view!=='artist')return;

    storeCtx('artist-'+id,songs);
    const rows=document.querySelectorAll('#view-artist .row-list');
    if(rows[0]) rows[0].innerHTML=songs.length?songs.map((x,i)=>songRow(x,i,{ctxKey:'artist-'+id})).join(''):'<div class="es-desc">No songs available from the current catalog.</div>';
    const title=[...document.querySelectorAll('#view-artist .section-title')].find(x=>x.textContent.trim()==='Top Songs');
    if(title) title.textContent='Songs ('+songs.length+')';

    const body=document.querySelector('#artist-albums-body');
    if(body) body.innerHTML=albums.length?albums.map(albumCard).join(''):'<div class="es-desc">No albums found.</div>';

    /* Repair missing artist artwork from album/song artwork only when API has no image. */
    const img=document.querySelector('#view-artist .detail-art img');
    if(img && (!artist.image || artist.image===FALLBACK_ART)){
      const fallback=(albums[0]&&albums[0].image)||(songs[0]&&songs[0].image)||FALLBACK_ART;
      img.src=fallback;
    }
  }catch(e){}
};

/* Never show a broken-image icon; use fallback artwork consistently. */
document.addEventListener('error',function(e){
  const img=e.target;
  if(img&&img.tagName==='IMG'&&img.dataset.catalogFallback!=='1'){
    img.dataset.catalogFallback='1';
    img.src=FALLBACK_ART;
  }
},true);
})();

/* [relocated into app scope: v6-max-catalog-engine] */
(function(){
'use strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const uniq=list=>{const m=new Map();for(const x of list||[]){if(!x||!x.id)continue;const k=String(x.id);if(!m.has(k))m.set(k,x);}return [...m.values()];};
function belongs(song,artist){
 const a=norm(artist.name); if(!a)return false;
 const fields=[song.artistName,song.primaryArtists,song.singers].filter(Boolean).map(norm);
 return fields.some(x=>x===a||x.includes(a)||a.includes(x));
}
function aliases(name){
 const n=String(name||'').trim(), a=[n];
 const parts=n.split(/\s+/).filter(Boolean);
 if(parts.length>1){a.push(parts.slice(-2).join(' '),parts.slice(-1).join(' '));}
 const replacements={
  'yo yo honey singh':['Honey Singh','YoYo Honey Singh'],
  'sambata':['Sambata Rapper','Sambata Marathi Rap'],
  'arijit singh':['Arijit'], 'shreya ghoshal':['Shreya Ghoshal songs'],
  'pritam':['Pritam Chakraborty'], 'a r rahman':['A R Rahman','AR Rahman']
 };
 const key=n.toLowerCase(); if(replacements[key])a.push(...replacements[key]);
 return [...new Set(a.filter(Boolean))];
}
async function searchArtistCatalog(artist,signal,progress){
 let all=[]; const qs=aliases(artist.name);
 // Exact artist searches first; many pages because API pages are capped.
 for(let qi=0;qi<qs.length;qi++){
   let empty=0;
   for(let p=0;p<15;p++){
     if(signal&&signal.aborted)return uniq(all);
     try{
       const r=await Api.searchSongs(qs[qi],p,50,signal);
       const rows=((r&&r.data&&r.data.results)||[]).map(normalizeSong).filter(Boolean);
       const matched=rows.filter(x=>belongs(x,artist));
       all.push(...matched);
       progress&&progress(uniq(all).length);
       if(!rows.length||rows.length<50)break;
       if(!matched.length){empty++;if(empty>=2)break;}else empty=0;
       await sleep(55);
     }catch(e){break;}
   }
 }
 return uniq(all);
}
async function allAlbums(id,signal){
 let all=[];
 for(let p=0;p<30;p++){
   if(signal&&signal.aborted)break;
   try{
     const r=await Api.getArtistAlbums(id,p,signal);
     const rows=((r&&r.data&&r.data.albums)||[]).map(normalizeAlbum).filter(Boolean);
     if(!rows.length)break; all.push(...rows);
     if(rows.length<10)break; await sleep(60);
   }catch(e){break;}
 }
 return uniq(all);
}
async function albumTracks(albums,signal,onBatch){
 let all=[];
 // Controlled concurrency prevents low-end devices/network from getting overloaded.
 for(let i=0;i<albums.length;i+=3){
   if(signal&&signal.aborted)break;
   const batch=await Promise.all(albums.slice(i,i+3).map(async a=>{
     try{const r=await Api.getAlbum(a.id,signal);const x=normalizeAlbum(r&&r.data);return (x&&x.songs)||[];}catch(e){return []}
   }));
   all.push(...batch.flat()); onBatch&&onBatch(i+batch.length,albums.length,uniq(all).length,all);
   await sleep(80);
 }
 return uniq(all);
}
function updateArtistRows(id,songs,countText){
 if(State.view!=='artist'||String(State.viewParams.id)!==String(id))return;
 storeCtx('artist-'+id,songs);
 const rows=document.querySelectorAll('#view-artist .row-list');
 if(rows[0])rows[0].innerHTML=songs.map((x,i)=>songRow(x,i,{ctxKey:'artist-'+id})).join('');
 const titles=[...document.querySelectorAll('#view-artist .section-title')];
 const t=titles.find(x=>/^Songs|^Top Songs/.test(x.textContent.trim())); if(t)t.textContent='Songs ('+songs.length+')'+(countText?' · '+countText:'');
}
const previous=renderArtistDetail;
async function artistSongsPaged(id,signal,onPage){
 let all=[];
 for(let p=0;p<40;p++){
   if(signal&&signal.aborted)break;
   try{
     const r=await Api.getArtistSongs(id,p,signal), d=r&&r.data;
     const rows=((d&&(d.songs||d.results))||[]).map(normalizeSong).filter(Boolean);
     const before=uniq(all).length; all=uniq(all.concat(rows));
     if(!rows.length||all.length===before)break;
     onPage&&onPage(all); await sleep(50);
   }catch(e){break;}
 }
 return uniq(all);
}
renderArtistDetail=async function(id){
 await previous(id);
 if(State.view!=='artist'||String(State.viewParams.id)!==String(id))return;
 const signal=State._detailAbort&&State._detailAbort.signal, seq=State._detailSeq;
 const alive=()=>!(signal&&signal.aborted)&&seq===State._detailSeq&&State.view==='artist'&&String(State.viewParams.id)===String(id);
 try{
   const rr=await Api.getArtist(id,signal); const artist=normalizeArtist(rr&&rr.data); if(!artist)return;
   let base=uniq(artist.topSongs||[]), pagedS=[], searchS=[], albumS=[];
   const merge=()=>uniq(base.concat(pagedS,albumS,searchS));
   const paint=t=>{ if(alive()) updateArtistRows(id,merge(),t); };
   paint('loading all songs…');
   const pagedP=artistSongsPaged(id,signal,a=>{pagedS=a;paint('loading…');});
   const searchP=searchArtistCatalog(artist,signal,()=>{});
   const albums=await allAlbums(id,signal);
   albumS=await albumTracks(albums,signal,(d,t,f,all)=>{albumS=all;paint('albums '+d+'/'+t);});
   pagedS=await pagedP; searchS=await searchP;
   if(!alive())return;
   updateArtistRows(id,merge(),'complete');
 }catch(e){/* keep what is already shown */}
};
})();

/* [v25: full playlist loader - all pages, not just first 10] */
(function(){
'use strict';
const uniq=l=>{const s=new Set();return (l||[]).filter(x=>x&&x.id&&!s.has(String(x.id))&&(s.add(String(x.id)),true));};
const prev=renderPlaylistDetail;
renderPlaylistDetail=async function(id){
 await prev(id);
 if(State.view!=='playlist'||String(State.viewParams.id)!==String(id))return;
 const signal=State._detailAbort&&State._detailAbort.signal, seq=State._detailSeq;
 const alive=()=>!(signal&&signal.aborted)&&seq===State._detailSeq&&State.view==='playlist'&&String(State.viewParams.id)===String(id);
 try{
   let all=[], total=0;
   for(let p=0;p<40;p++){
     if(!alive())return;
     const r=await Api.getPlaylist(id,signal,p,100);
     const pl=normalizePlaylist(r&&r.data); if(!pl)break;
     total=pl.songCount||total;
     const rows=(pl.songs||[]).filter(Boolean);
     const before=all.length; all=uniq(all.concat(rows));
     if(!rows.length||all.length===before)break;
     if(!alive())return;
     storeCtx('playlist-'+id,all);
     const list=document.querySelector('#view-playlist .row-list');
     if(list)list.innerHTML=all.map((x,i)=>songRow(x,i,{ctxKey:'playlist-'+id})).join('');
     const sub=document.querySelector('#view-playlist .detail-sub'); if(sub)sub.textContent=all.length+' songs';
     if(total&&all.length>=total)break;
   }
 }catch(e){/* keep first page */}
};
})();

init();


/* ===== BoosterOS: instrumental gap dots (inside app scope) ===== */
var bosGapSungEnd=null;
/* BoosterOS: instrumental gap dots. Additive wrapper — lyric lines/animation are not modified. */
(function(){
  var H_ROW=46, MIN_GAP=5.0, EXIT=0.55;
  var gapCache=new WeakMap();
  var rows=[], cur=-1, lastT=NaN, lastLyrics=null, lastP=[-1,-1,-1], boxRef=null;

  function computeGaps(L){
    if(gapCache.has(L)) return gapCache.get(L);
    var out=[], ls=L.lines||[], n=ls.length;
    /* typical spacing between sung lines in THIS song: a long pause is only "instrumental" if it is clearly longer than normal */
    var sp=[]; for(var q=0;q<n-1;q++){ var dq=(Number(ls[q+1].time)||0)-(Number(ls[q].time)||0); if(dq>0&&dq<20) sp.push(dq); }
    sp.sort(function(a,b){return a-b;}); var med=sp.length?sp[sp.length>>1]:4;
    for(var i=-1;i<n-1;i++){
      var start,end,before;
      if(i<0){ start=0.4; end=Number(ls[0].time)||0; before=0; }
      else{
        var ln=ls[i], t0=Number(ln.time)||0, nx=Number(ls[i+1].time)||0, dur;
        if(ln.real && ln._wt && ln._wt.length) dur=(ln._wt[ln._wt.length-1]-t0)+1.2;   /* last word can be held */
        else dur=1.6+String(ln.text||'').length*0.11;                                   /* slow/held vocals: assume the line is still being sung */
        dur=Math.min(dur,nx-t0);
        start=t0+dur; end=nx; before=i+1;
      }
      if(end-start>=MIN_GAP && (i<0 || (end-(Number(ls[i].time)||0))>=Math.max(6.5,med*1.8))) out.push({start:start+(i<0?0:0.3),end:end,before:before,row:null});
    }
    gapCache.set(L,out); return out;
  }
  function validLyrics(){
    return typeof currentLyrics!=='undefined' && currentLyrics && currentLyrics.synced && currentLyrics.lines && currentLyrics.lines.length
      && State && State.settings && State.settings.syncedLyrics && State.settings.highlightActiveLine;
  }
  function insertRows(){
    cur=-1; rows=[]; lastT=NaN; lastP=[-1,-1,-1];
    var box=document.getElementById('lyrics-scroll'); boxRef=box; if(!box) return;
    box.classList.remove('bos-in-gap');
    var old=box.querySelectorAll('.bos-gap'); for(var k=0;k<old.length;k++) old[k].remove();
    if(!validLyrics()){ lastLyrics=null; return; }
    var L=currentLyrics; lastLyrics=L;
    var gaps=computeGaps(L); if(!gaps.length) return;
    var lines=box.querySelectorAll('.lyric-line');
    gaps.forEach(function(g){
      var anchor=lines[g.before]; if(!anchor) return;
      var r=document.createElement('div'); r.className='bos-gap'; r.setAttribute('aria-hidden','true');
      r.innerHTML='<div class="bos-gap-in"><div class="bos-gap-dots"><i></i><i></i><i></i></div></div>';
      anchor.parentNode.insertBefore(r,anchor);
      g.row=r; g.dots=r.querySelectorAll('i');
    });
    rows=gaps.filter(function(g){return g.row;});
  }
  function autoScrollOK(){
    try{ return State.settings.lyricsAutoScroll && Date.now()>(typeof lyricsUserScrollUntil!=='undefined'?lyricsUserScrollUntil:0); }catch(e){ return false; }
  }
  function expand(g){
    var box=boxRef, r=g.row; if(!r||!box) return;
    r.classList.remove('out'); r.classList.add('on');
    box.classList.add('bos-in-gap');
    if(autoScrollOK()){
      var sH=box.clientHeight;
      box.scrollTo({top:Math.max(0,Math.min(r.offsetTop-sH*0.14,Math.max(0,box.scrollHeight-sH))),behavior:'smooth'});
    }
  }
  function collapse(g){
    var box=boxRef, r=g.row; if(!r||!box) return;
    var h=r.offsetHeight, above=false, el=null;
    try{
      var idx=(typeof activeLyricIndex!=='undefined')?activeLyricIndex:-1;
      el=idx>=0?box.querySelectorAll('.lyric-line')[idx]:null;
      above=!!(el && r.offsetTop<el.offsetTop);
    }catch(e){}
    r.classList.add('out'); r.classList.remove('on');
    box.classList.remove('bos-in-gap');
    setTimeout(function(){ if(!r.classList.contains('on')) r.classList.remove('out'); },700);
    /* the row shrinks, so re-aim the scroll at the (now higher) active line */
    if(above && el && autoScrollOK()){
      var sH=box.clientHeight, max=Math.max(0,box.scrollHeight-h-sH);
      box.scrollTo({top:Math.max(0,Math.min(el.offsetTop-h-sH*0.14,max)),behavior:'smooth'});
    }
  }
  function setDots(g,p){
    var v=[0,0,0];
    for(var k=0;k<3;k++){ var f=Math.max(0,Math.min(1,p*3-k)); v[k]=Math.round((0.26+0.64*f)*100)/100; }
    for(var j=0;j<3;j++){ if(v[j]!==lastP[j]){ lastP[j]=v[j]; g.dots[j].style.setProperty('--a',v[j]); } }
  }
  function tick(){
    if(!validLyrics()){ if(cur>=0||rows.length){ insertRows(); } return; }
    if(currentLyrics!==lastLyrics || !boxRef || !boxRef.isConnected || (rows.length && !rows[0].row.isConnected)) insertRows();
    if(!rows.length) return;
    var t=LY.rawT; if(typeof t!=='number' || !isFinite(t)) return;
    var a=null; try{ a=primaryAudio(); }catch(e){}
    var paused=!!(a&&a.paused);
    for(var q=0;q<rows.length;q++) rows[q].row.classList.toggle('paused',paused);
    if(t===lastT) return; lastT=t;
    var hit=-1;
    for(var i=0;i<rows.length;i++){ if(t>=rows[i].start && t<rows[i].end){ hit=i; break; } }
    if(hit!==cur){
      if(cur>=0) collapse(rows[cur]);
      cur=hit; lastP=[-1,-1,-1];
      if(cur>=0) expand(rows[cur]);
    }
    if(cur>=0){
      var g=rows[cur];
      setDots(g,(t-g.start)/(g.end-g.start));
      g.row.classList.toggle('out',t>=g.end-EXIT);
    }
  }

  bosGapSungEnd=function(i){
    try{
      if(!validLyrics()) return null;
      var gs=computeGaps(currentLyrics);
      for(var k=0;k<gs.length;k++){ if(gs[k].before===i+1) return gs[k].start; }
    }catch(e){}
    return null;
  };
  var prevUpdate=updateActiveLyric;
  updateActiveLyric=function(){
    var r=prevUpdate.apply(this,arguments);
    try{ tick(); }catch(e){}
    return r;
  };
  var prevRender=renderLyricsPane;
  renderLyricsPane=function(){
    var r=prevRender.apply(this,arguments);
    try{ insertRows(); }catch(e){}
    return r;
  };
})();


/* ===== BoosterOS: Roman lyrics (Indic script -> Roman letters). English / Roman text is left untouched. ===== */
var BOS_ROMAN_LYRICS=false;
var bosRomanTables=(function(){
  var C={0x15:'k',0x16:'kh',0x17:'g',0x18:'gh',0x19:'ng',0x1A:'ch',0x1B:'chh',0x1C:'j',0x1D:'jh',0x1E:'ny',
    0x1F:'t',0x20:'th',0x21:'d',0x22:'dh',0x23:'n',0x24:'t',0x25:'th',0x26:'d',0x27:'dh',0x28:'n',0x29:'n',
    0x2A:'p',0x2B:'ph',0x2C:'b',0x2D:'bh',0x2E:'m',0x2F:'y',0x30:'r',0x31:'r',0x32:'l',0x33:'l',0x34:'zh',
    0x35:'v',0x36:'sh',0x37:'sh',0x38:'s',0x39:'h'};
  var NUKTA={0x15:'q',0x16:'kh',0x17:'gh',0x1C:'z',0x21:'d',0x22:'rh',0x2B:'f',0x2F:'y'};
  var IV={0x05:'a',0x06:'aa',0x07:'i',0x08:'ee',0x09:'u',0x0A:'oo',0x0B:'ri',0x0C:'li',0x0D:'e',0x0E:'e',0x0F:'e',0x10:'ai',0x11:'o',0x12:'o',0x13:'o',0x14:'au'};
  var MV={0x3E:'aa',0x3F:'i',0x40:'i',0x41:'u',0x42:'oo',0x43:'ri',0x44:'ri',0x45:'e',0x46:'e',0x47:'e',0x48:'ai',0x49:'o',0x4A:'o',0x4B:'o',0x4C:'au'};
  return {C:C,NUKTA:NUKTA,IV:IV,MV:MV};
})();
var bosRomanBases=[0x0900,0x0980,0x0A00,0x0A80,0x0B00,0x0B80,0x0C00,0x0C80,0x0D00];
var bosRomanChillu={0x0D7A:'n',0x0D7B:'n',0x0D7C:'r',0x0D7D:'l',0x0D7E:'l',0x0D7F:'k'};
function bosRomanWord(word,mr){
  var T=bosRomanTables, i, cp, dev=[];
  /* 1) map every Brahmic block onto Devanagari code points (offsets match across blocks) */
  for(i=0;i<word.length;i++){
    cp=word.charCodeAt(i);
    if(bosRomanChillu[cp]){ dev.push({lit:bosRomanChillu[cp]}); continue; }
    if(cp===0x0A71){ dev.push({addak:1}); continue; }
    if(cp===0x0A70){ dev.push(0x0902); continue; }
    if(cp===0x200C||cp===0x200D){ continue; }
    var base=cp&~0x7F, mapped=cp;
    if(bosRomanBases.indexOf(base)>=0) mapped=(cp-base)+0x0900;
    dev.push(mapped);
  }
  /* 2) build syllable units: consonant cluster + vowel */
  var units=[], cur=null, pendDouble=false, nas=null;
  function push(u){ units.push(u); return u; }
  for(i=0;i<dev.length;i++){
    var d=dev[i];
    if(typeof d==='object'){
      if(d.lit){ push({c:d.lit,v:'',inh:false}); cur=null; }
      else if(d.addak){ pendDouble=true; }
      continue;
    }
    var o=d-0x0900;
    if(T.C[o]!==undefined){
      var r=T.C[o];
      if(dev[i+1]===0x093C && T.NUKTA[o]!==undefined){ r=T.NUKTA[o]; i++; }
      else if(dev[i+1]===0x093C) i++;
      /* kshа / gya conjuncts */
      if(o===0x1C && dev[i+1]===0x094D && dev[i+2]===0x091E){ r='gy'; i+=2; }
      if(pendDouble){ r=r.charAt(0)+r; pendDouble=false; }
      if(cur && cur.open){ cur.c+=r; cur.inh=true; }
      else{ cur=push({c:r,v:null,inh:true,open:false}); }
      if(dev[i+1]===0x094D){ cur.open=true; cur.inh=false; i++; }
      else{ cur.open=false; }
      continue;
    }
    if(T.MV[o]!==undefined){
      if(cur){ cur.v=T.MV[o]; cur.inh=false; cur.open=false; }
      else push({c:'',v:T.MV[o],inh:false});
      continue;
    }
    if(T.IV[o]!==undefined){ cur=push({c:'',v:T.IV[o],inh:false,open:false}); cur=null; continue; }
    if(o===0x02||o===0x01){ if(units.length) units[units.length-1].nas=(o===0x02?'n':'n'); continue; }
    if(o===0x03){ if(units.length) units[units.length-1].vis='h'; continue; }
    if(o===0x4D){ if(cur) {cur.open=true;cur.inh=false;} continue; }
    if(o===0x50){ push({c:'om',v:'',inh:false}); continue; }
    if(o>=0x66&&o<=0x6F){ push({c:String(o-0x66),v:'',inh:false,digit:true}); continue; }
    /* danda, avagraha, others: dropped */
  }
  /* 3) schwa deletion (right to left) */
  var n=units.length, has=[], k;
  for(k=0;k<n;k++) has[k]=!!(units[k].v||units[k].inh);
  if(n>1){
    for(k=n-1;k>=0;k--){
      var u=units[k]; if(!u.inh||!u.c) continue;
      if(k===n-1){ has[k]=false; u.del=true; continue; }
      if(u.nas) continue;                       /* nasalised syllable keeps its 'a' (jhaalaya) */
      if(k>0 && has[k-1] && has[k+1] && !units[k-1].digit && u.c.length<=3){
        if(mr && !(units[k+1].inh && !units[k+1].v)) continue;  /* Marathi: keep schwa unless next is a short 'a' too */
        has[k]=false; u.del=true;
      }
    }
  }
  /* 4) emit */
  var out='', STOP=/^(k|kh|g|gh|ng|ch|chh|j|jh|ny|t|th|d|dh|n|p|ph|b|bh|m|q)/;
  for(k=0;k<n;k++){
    var q=units[k];
    out+=q.c;
    if(q.v) out+=q.v; else if(q.inh && !q.del) out+='a';
    if(q.nas){
      var nx=units[k+1];
      if(!nx) out+='n';
      else if(nx.c) out+=(/^(p|ph|b|bh|m)/.test(nx.c)?'m':'n');
    }
    if(q.vis) out+='h';
  }
  return bosRomanPost(out);
}
var BOS_ROMAN_POST={men:'mein',kyaa:'kya',too:'tu',ham:'hum',kaa:'ka',kee:'ki',hae:'hai',tho:'toh'};
function bosRomanPost(w){
  if(BOS_ROMAN_POST.hasOwnProperty(w)) return BOS_ROMAN_POST[w];
  if(w.length>=4 && /[^aeiou]aa$/.test(w)) return w.slice(0,-1);
  return w;
}
function bosRomanText(str,cap,mr){
  if(!str) return str;
  var re=/[\u0900-\u0D7F\u200c\u200d]+/g;
  if(!re.test(str)) return str;
  re.lastIndex=0;
  var out=String(str).replace(re,function(m){ return bosRomanWord(m,mr); });
  out=out.replace(/\s+/g,' ').trim();
  if(cap && out) out=out.charAt(0).toUpperCase()+out.slice(1);
  return out;
}
function bosRomanizeLyrics(data){
  try{
    if(!BOS_ROMAN_LYRICS || !data || !data.lines) return data;
    var any=false, re=/[\u0900-\u0D7F]/;
    for(var i=0;i<data.lines.length;i++){ if(re.test(data.lines[i].text||'')){ any=true; break; } }
    if(!any) return data;
    var mr=false;
    try{ mr=/marathi/i.test(String((State.currentTrack&&State.currentTrack.language)||'')); }catch(e){}
    if(!mr){ for(var j=0;j<data.lines.length;j++){ if(/\u0933/.test(data.lines[j].text||'')){ mr=true; break; } } }
    var copy=Object.assign({},data);
    copy.lines=data.lines.map(function(l){
      if(!re.test(l.text||'')) return l;
      var c=Object.assign({},l);
      c.text=bosRomanText(l.text,true,mr);
      if(l.words && l.words.length){
        c.words=l.words.map(function(w,wi){
          var t=bosRomanText(w.text,false,mr);
          if(wi===0 && t) t=t.charAt(0).toUpperCase()+t.slice(1);
          return Object.assign({},w,{text:t});
        });
      }
      delete c._wt;
      if(l.words && l.words.length) c._wt=l.words.map(function(w){return w.t;});
      return c;
    });
    return copy;
  }catch(e){ return data; }
}


/* ---- Top Charts + Top Playlists (inside app scope) ---- */
(function(){
var CH={list:null,at:0,busy:false,busyAt:0},TL={html:null,at:0,busy:false,busyAt:0};
var QS=["Top 50 India","Top Hindi Songs","Trending Bollywood","Top Punjabi Songs","Arijit Singh hits","Latest Hindi Songs"];
var POOL=["Top 50 India","Top Hindi Songs","Trending Bollywood","Top Punjabi Songs","Arijit Singh hits","Latest Hindi Songs","Bollywood romantic hits","Hindi party songs","Badshah hits","Neha Kakkar hits","Diljit Dosanjh hits","Atif Aslam hits","Shreya Ghoshal hits","Jubin Nautiyal hits","AP Dhillon hits","Karan Aujla hits","Sonu Nigam hits","Hindi sad songs","Bollywood dance hits","Indian pop hits","90s Bollywood hits","2025 Hindi songs","2026 Hindi songs","Anirudh Hindi hits"];
var PLQ=[["🔥 Top India","Top 50 India"],["📈 Trending Now","Trending India"],["🎬 Bollywood Hits","Bollywood Hits"],["🥁 Punjabi Beats","Punjabi Hits"],["💞 Romantic","Romantic Hindi"],["🎉 Party","Hindi Party"],["🌙 Chill & Lofi","Hindi Lofi"],["📻 Retro Classics","Old Hindi Songs"],["💪 Workout","Workout Hindi"]];
function key(t){try{return (SmartRadio.familyKey(t)||"")||String(t.id)}catch(e){return String(t.id)}}
function clearCache(re){try{Array.from(cache.keys()).forEach(function(k){if(re.test(k))cache.delete(k)})}catch(e){}}
async function fetchTop150(rand){
  var qs=rand?shuffleArray(POOL).slice(0,7):QS,pg=rand?shuffleArray([0,1,2,3]).slice(0,2):[0,1];
  var jobs=[];qs.forEach(function(q){pg.forEach(function(p){jobs.push(Api.searchSongs(q,p,40).then(function(r){return (r.data&&r.data.results)||[]}).catch(function(){return[]}))})});
  var packs=await Promise.all(jobs),seen=new Set(),out=[],i=0,more=true;
  while(out.length<150&&more){more=false;packs.forEach(function(pk){var t=pk[i];if(t){more=true;t=normalizeSong(t);if(!t)return;var k=key(t);if(seen.has(k)||seen.has(String(t.id)))return;seen.add(k);seen.add(String(t.id));if(out.length<150)out.push(t)}});i++}
  return out;
}
function plSection(title,pls){
  return '<div class="section"><div class="section-head"><div><div class="section-title">'+esc(title)+'</div></div></div><div class="hscroll">'+
    pls.map(function(p){return '<div class="ch-pl">'+playlistCard(p)+'<button class="btn btn-primary ch-pp" data-cact="play-pl" data-id="'+esc(p.id)+'">'+svgPlay()+' Play All</button></div>'}).join('')+'</div></div>';
}
function tm(t){return new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
window.renderCharts=async function(force){
  var el=document.getElementById('view-charts');
  if(force===true){CH.busy=false;CH.list=null;clearCache(/^search-songs:/);try{toast('Charts refresh ho rahe hain…')}catch(e){}}
  if(CH.busy&&Date.now()-CH.busyAt<30000)return;
  if(CH.list&&Date.now()-CH.at<300000&&el.querySelector('.ch-hero'))return;
  CH.busy=true;CH.busyAt=Date.now();
  el.innerHTML='<div class="ch-hero glass-2"><div><h2>Top 150 India</h2><p>Loading latest songs…</p></div></div>';
  try{
    var list=await fetchTop150(force===true);CH.list=list;CH.at=Date.now();storeCtx('charts-top150',list);
    var hero='<div class="ch-hero glass-2"><div><h2>Top 150 India</h2><p>'+list.length+' songs • Updated '+tm(CH.at)+'</p><div class="ch-acts"><button class="btn btn-primary" data-action="play-all" data-ctx="charts-top150">'+svgPlay()+' Play All</button><button class="btn btn-ghost" data-cact="shuffle">Shuffle</button><button class="btn btn-ghost" data-cact="refresh">Refresh</button><button class="btn btn-ghost" data-cact="go-pl">Top Playlists</button></div></div></div>';
    var body=list.length?'<div class="row-list">'+list.map(function(t,i){return songRow(t,i,{ctxKey:'charts-top150'})}).join('')+'</div>':'<div class="ch-msg">Songs load nahi hue. Internet check karo aur Refresh dabao.</div>';
    el.innerHTML=hero+body;
  }catch(e){console.warn(e);el.innerHTML='<div class="ch-msg">Charts load nahi hue. Dobara try karo.</div>';CH.list=null}
  CH.busy=false;
  if(force===true){try{toast('Charts update ho gaye')}catch(e){}}
};
window.renderToplists=async function(force){
  var el=document.getElementById('view-toplists');
  if(force===true){TL.busy=false;TL.html=null;clearCache(/^search-playlists:/);try{toast('Playlists refresh ho rahi hain…')}catch(e){}}
  if(TL.busy&&Date.now()-TL.busyAt<30000)return;
  if(TL.html&&Date.now()-TL.at<300000&&el.querySelector('.ch-hero'))return;
  TL.busy=true;TL.busyAt=Date.now();
  el.innerHTML='<div class="ch-hero glass-2"><div><h2>Top Playlists</h2><p>Loading playlists…</p></div></div>';
  try{
    var res=await Promise.all(PLQ.map(function(x){return Api.searchPlaylists(x[1],force===true?Math.floor(Math.random()*2):0,8).then(function(r){return (r.data.results||[]).map(normalizePlaylist).filter(Boolean)}).catch(function(){return[]})}));
    var html='';res.forEach(function(r,i){if(r.length)html+=plSection(PLQ[i][0],r)});
    TL.at=Date.now();TL.html=html||'x';
    var hero='<div class="ch-hero glass-2"><div><h2>Playlists for every mood</h2><p>Top charts ki playlists • Updated '+tm(TL.at)+'</p><div class="ch-acts"><button class="btn btn-ghost" data-cact="refresh-pl">Refresh</button><button class="btn btn-ghost" data-cact="go-ch">Top Charts</button></div></div></div>';
    el.innerHTML=hero+(html||'<div class="ch-msg">Playlists nahi mili. Refresh dabao.</div>');
  }catch(e){console.warn(e);el.innerHTML='<div class="ch-msg">Playlists load nahi hui. Dobara try karo.</div>';TL.html=null}
  TL.busy=false;
  if(force===true){try{toast('Playlists update ho gayi')}catch(e){}}
};
async function onClick(e){
  var b=e.target.closest('[data-cact]');if(!b)return;e.stopPropagation();
  var a=b.dataset.cact;
  if(a==='refresh'){window.renderCharts(true);return}
  if(a==='refresh-pl'){window.renderToplists(true);return}
  if(a==='go-pl'){navigate('toplists');return}
  if(a==='go-ch'){navigate('charts');return}
  if(a==='shuffle'&&CH.list&&CH.list.length){var l=shuffleArray(CH.list.slice());storeCtx('charts-shuffle',l);var f=await resolvePlayableTrack(l[0]);if(f)Player.play(f,l,0,{autoTransition:false});return}
  if(a==='play-pl'){
    try{b.disabled=true;var r=await Api.getPlaylist(b.dataset.id,null,0,100);var pl=normalizePlaylist(r.data),songs=(pl&&pl.songs)||[];
      if(!songs.length){toast('Playlist khali hai');return}
      storeCtx('charts-pl-'+b.dataset.id,songs);var f2=await resolvePlayableTrack(songs[0]);if(f2)Player.play(f2,songs,0,{autoTransition:false});
    }catch(err){toast('Playlist play nahi hui')}finally{b.disabled=false}
  }
}
document.getElementById('view-charts').addEventListener('click',onClick);
document.getElementById('view-toplists').addEventListener('click',onClick);
setInterval(function(){if(State.view==='charts'&&CH.list&&!CH.busy&&Date.now()-CH.at>300000)window.renderCharts(true);if(State.view==='toplists'&&TL.html&&!TL.busy&&Date.now()-TL.at>300000)window.renderToplists(true)},60000);
})();
window.BOS_PLAY=function(list,i){return Player.play(list[i],list,i,{autoTransition:false});};window.BOS_TOAST=function(m,t){try{toast(m,t);}catch(e){}};
try{window.State=State;window.Player=Player;if(typeof window.debounce!=='function')window.debounce=debounce;window.Store=(typeof Store!=="undefined"?Store:undefined);window.Api=(typeof Api!=="undefined"?Api:undefined);}catch(e){console.warn('global export',e);}
try{window.BosApp={SmartRadio:(typeof SmartRadio!=="undefined"?SmartRadio:null),State:State,renderMiniPlayer:renderMiniPlayer,renderFullPlayer:renderFullPlayer,renderQueuePanel:renderQueuePanel,SystemMedia:SystemMedia,updateAmbient:updateAmbient,loadLyricsFor:loadLyricsFor,updatePlayIcons:updatePlayIcons,paintProgress:paintProgress,fmtTime:fmtTime,Queue:Queue,History:History,Store:Store,toast:toast,Player:Player,haltJio:function(){try{finalizeCrossfadeIfRunning();}catch(_){}try{State._autoTransitionInFlight=false;State._crossfadeTriggered=false;Player._nextInFlight=false;Player._playToken++;}catch(_){}}};}catch(e){console.warn('BosApp export',e);}
/* ===== SONG MENU: dots button on every BOOSTER / BOOSTMUSIC song, long-press anywhere ===== */
(function(){
if(window.__bosSongMenu) return; window.__bosSongMenu=true;
var cur=null, repList=[], busy=false;
function $i(i){return document.getElementById(i);}
function e2(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function tst(m,t){try{toast(m,t);}catch(e){}}
function fmt(s){s=Math.round(+s||0);if(!s)return'';return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);}
function S(){return window.BosApp&&window.BosApp.State||State;}
var P='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
var IC={
 fav:function(f){return '<svg viewBox="0 0 24 24" fill="'+(f?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';},
 pl:P+'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
 search:P+'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
 sync:P+'<path d="M21 12a9 9 0 0 0-15.5-6.2L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.2L21 16"/><path d="M16 16h5v5"/></svg>',
 dl:P+'<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>',
 share:P+'<path d="M14 4l7 6-7 6v-4c-6 0-9 2-11 6 1-7 5-11 11-11z"/></svg>',
 ext:P+'<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
 copy:P+'<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
 info:P+'<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".6" fill="currentColor"/></svg>',
 x:P+'<path d="M5 5l14 14M19 5L5 19"/></svg>',
 chev:P+'<path d="M9 6l6 6-6 6"/></svg>',
 back:P+'<path d="M15 6l-6 6 6 6"/></svg>',
 next:P+'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l4 3-4 3z" fill="currentColor"/></svg>',
 queue:P+'<path d="M3 6h12M3 11h8M3 16h6"/><path d="M19 15V6l3 1"/><circle cx="17" cy="16" r="2.4"/></svg>'
};
/* ---------- track helpers ---------- */
function ytTrackFrom(v){
  var vid=v.videoId||'', it=!!v.it;
  return {id:vid?'yt_'+vid:'',videoId:vid,name:v.title||'Untitled',
    artistName:it?(v.artist||''):String(v.author||'').replace(/\s*-\s*Topic$/i,'').replace(/VEVO$/i,'').trim(),
    albumName:v.album||'',image:it?(v.art||''):(vid?'https://i.ytimg.com/vi/'+vid+'/hqdefault.jpg':''),
    duration:it?(+v.dur||0):(+v.lengthSeconds||0),source:'youtube'};
}
async function getTrack(ctx){
  if(ctx.kind==='yt'){
    var t=ctx.track;
    if(!t.videoId){
      var v=ctx.v, r=null;
      try{ if(window.BosIT&&BosIT.ytFor) r=await BosIT.ytFor(v); }catch(e){}
      if(!r||!r.videoId){ tst('Could not find this song on YouTube','error'); return null; }
      t.videoId=r.videoId; t.id='yt_'+r.videoId; if(!t.image) t.image='https://i.ytimg.com/vi/'+r.videoId+'/hqdefault.jpg';
      if(!t.duration) t.duration=+r.lengthSeconds||0; ctx.v.videoId=r.videoId;
    }
    return t;
  }
  try{ var f=await resolvePlayableTrack(ctx.track); if(f){ ctx.track=f; return f; } }catch(e){}
  tst('Could not load this song','error'); return null;
}
function ctxFromEl(el){
  var b=el.closest&&el.closest('[data-bosmenu]'); 
  if(b){
    if(b.dataset.bosmenu==='yt'){ var v=(S()._ytRes||[])[+b.dataset.yi]; if(v) return {kind:'yt',v:v,track:ytTrackFrom(v)}; return null; }
    var t=findTrackById(b.dataset.id); return t?{kind:'jio',track:t}:null;
  }
  var y=el.closest&&el.closest('.yt-res'); if(y){ var v2=(S()._ytRes||[])[+y.dataset.yi]; return v2?{kind:'yt',v:v2,track:ytTrackFrom(v2)}:null; }
  var j=el.closest&&el.closest('[data-action="play-song"][data-id]'); if(j){ var t2=findTrackById(j.dataset.id); return t2?{kind:'jio',track:t2}:null; }
  return null;
}
/* ---------- sheet ---------- */
function ensureSheet(){
  if($i('bos-sm')) return;
  var d=document.createElement('div'); d.id='bos-sm';
  d.innerHTML='<div class="bos-sm-box" id="bos-sm-box" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(d);
  d.addEventListener('click',function(e){ if(e.target===d) closeMenu(); });
  var box=$i('bos-sm-box'), y0=0, dy=0, drag=false;
  box.addEventListener('touchstart',function(e){ if(box.scrollTop>2||!e.target.closest('.bos-sm-grab,.bos-sm-head')){drag=false;return;} drag=true;y0=e.touches[0].clientY;dy=0;box.style.transition='none'; },{passive:true});
  box.addEventListener('touchmove',function(e){ if(!drag)return; dy=Math.max(0,e.touches[0].clientY-y0); box.style.transform='translateY('+dy+'px)'; },{passive:true});
  box.addEventListener('touchend',function(){ if(!drag)return; drag=false; box.style.transition=''; if(dy>110){ box.style.transform=''; closeMenu(); } else box.style.transform=''; });
}
function openSheet(){ ensureSheet(); var d=$i('bos-sm'); d.classList.add('open'); requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.add('show');});}); }
function closeMenu(){ var d=$i('bos-sm'); if(!d) return; d.classList.remove('show'); setTimeout(function(){ if(!d.classList.contains('show')) d.classList.remove('open'); },300); cur=null; }
function item(act,icon,label,sub,cls){
  return '<button type="button" class="bos-sm-it'+(cls?' '+cls:'')+'" data-bsm="'+act+'"><span class="bos-sm-ic">'+icon+'</span><span class="bos-sm-lb">'+label+(sub?'<small>'+sub+'</small>':'')+'</span><span class="bos-sm-ch">'+IC.chev+'</span></button>';
}
function render(){
  var c=cur; if(!c) return; var t=c.track, fav=false;
  try{ fav=!!t.id&&Favorites.isSongFav(t.id); }catch(e){}
  var src=c.kind==='yt'?'YouTube':'BOOSTER';
  var h='<div class="bos-sm-grab"><i></i></div>'
   +'<div class="bos-sm-head"><img class="bos-sm-art" src="'+e2(t.image||FALLBACK_ART)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt="">'
   +'<div class="bos-sm-meta"><b>'+e2(t.name)+'</b><span>'+e2(t.artistName||'')+'</span></div>'
   +'<button type="button" class="bos-sm-sq" data-bsm="copy" aria-label="Copy name">'+IC.copy+'</button>'
   +'<button type="button" class="bos-sm-sq" data-bsm="info" aria-label="Info">'+IC.info+'</button>'
   +'<button type="button" class="bos-sm-x" data-bsm="close" aria-label="Close">'+IC.x+'</button></div>'
   +'<div class="bos-sm-info" id="bos-sm-info" hidden><div><i>Source</i><b>'+src+'</b></div>'
   +(t.albumName?'<div><i>Album</i><b>'+e2(t.albumName)+'</b></div>':'')
   +(t.year?'<div><i>Year</i><b>'+e2(t.year)+'</b></div>':'')
   +(t.duration?'<div><i>Duration</i><b>'+fmt(t.duration)+'</b></div>':'')
   +(t.language?'<div><i>Language</i><b>'+e2(t.language)+'</b></div>':'')+'</div>'
   +'<div class="bos-sm-pills"><button type="button" class="bos-sm-pill" data-bsm="next"><span style="color:#4aa3ff">'+IC.next+'</span>Play Next</button>'
   +'<button type="button" class="bos-sm-pill" data-bsm="queue"><span style="color:#ff5c8a">'+IC.queue+'</span>Add to Queue</button></div>'
   +'<div class="bos-sm-list">'
   +item('fav',IC.fav(fav),fav?'Remove from Favorites':'Add to Favorites')
   +item('playlist',IC.pl,'Add to Playlist')
   +item('replace',IC.search,'Smart Replace')
   +item('meta',IC.sync,'Get latest metadata')
   +'<div class="bos-sm-gap"></div>'
   +item('dl',IC.dl,'Download')
   +item('share',IC.share,'Share')
   +item('open',IC.ext,'Open original link')
   +'</div>';
  $i('bos-sm-box').innerHTML=h; $i('bos-sm-box').scrollTop=0;
}
function openMenu(ctx){ if(!ctx) return; cur=ctx; ensureSheet(); render(); openSheet(); }
/* ---------- actions ---------- */
function updateHearts(id,on){
  document.querySelectorAll('.heart-btn[data-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]').forEach(function(b){ b.classList.toggle('active',on); b.innerHTML=svgHeart(on); });
}
async function act(a){
  var c=cur; if(!c) return;
  if(a==='close'){ closeMenu(); return; }
  if(a==='info'){ var i=$i('bos-sm-info'); if(i) i.hidden=!i.hidden; return; }
  if(a==='copy'){ var tx=(c.track.name||'')+(c.track.artistName?' - '+c.track.artistName:''); try{ await navigator.clipboard.writeText(tx); tst('Copied'); }catch(e){ try{ var ta=document.createElement('textarea'); ta.value=tx; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); tst('Copied'); }catch(_){ tst('Copy failed','error'); } } return; }
  if(a==='replace'){ smartReplace(c); return; }
  if(a==='meta'){ closeMenu(); metadata(c); return; }
  if(a==='dl'){ closeMenu(); download(c); return; }
  if(busy) return; busy=true;
  try{
    if(a==='next'||a==='queue'){
      var t=await getTrack(c); if(!t) return; closeMenu();
      var st=S();
      if(!st.currentTrack){ Player.play(t,[t],0,{autoTransition:false}); return; }
      if(a==='next'){ if(typeof Queue.playNext==='function') Queue.playNext(t); else { st.queue.splice(Math.max(0,st.queueIndex+1),0,t); Queue.persist(); tst('Playing next'); } }
      else Queue.addToQueue(t);
    }
    else if(a==='fav'){
      var t2=await getTrack(c); if(!t2) return;
      var added=Favorites.toggleSong(t2); closeMenu(); updateHearts(t2.id,added);
      tst(added?'Added to favorites':'Removed from favorites');
      try{ renderMiniPlayer(); renderFullPlayer(); }catch(e){}
      try{ if(S().view==='favorites'||S().view==='library') renderLibrary(); }catch(e){}
    }
    else if(a==='playlist'){
      var t3=await getTrack(c); if(!t3) return; closeMenu();
      if(window.BoosterPlaylists&&BoosterPlaylists.openPicker) BoosterPlaylists.openPicker(t3); else tst('Playlists are still loading, try again','error');
    }
    else if(a==='share'){
      var t4=await getTrack(c); if(!t4) return; var u=linkOf(c); closeMenu();
      var text=t4.name+(t4.artistName?' - '+t4.artistName:'');
      if(navigator.share){ try{ await navigator.share({title:t4.name,text:text,url:u}); }catch(e){} }
      else { try{ await navigator.clipboard.writeText(text+'\n'+u); tst('Link copied'); }catch(e){ tst('Sharing is not supported here','error'); } }
    }
    else if(a==='open'){
      var t5=await getTrack(c); if(!t5) return; var u2=linkOf(c); closeMenu();
      window.open(u2,'_blank','noopener');
    }
  } finally { busy=false; }
}
function linkOf(c){
  var t=c.track;
  if(c.kind==='yt') return 'https://www.youtube.com/watch?v='+encodeURIComponent(t.videoId||'');
  return t.url||('https://www.jiosaavn.com/search/'+encodeURIComponent((t.name||'')+' '+(t.artistName||'')));
}
/* ---------- replace the track everywhere (queue, favorites, history, playlists, lists on screen) ---------- */
function replaceEverywhere(oldT,nt,opts){
  opts=opts||{}; var st=S(), oid=oldT.id, found=false;
  function rp(arr){ if(!Array.isArray(arr)) return false; var ch=false; for(var i=0;i<arr.length;i++){ var o=arr[i]; if(o&&o.id===oid){ var n=Object.assign({},nt); if(o._auto) n._auto=true; if(o.playedAt) n.playedAt=o.playedAt; arr[i]=n; ch=true; } } return ch; }
  if(rp(st.queue)){ found=true; try{Queue.persist();}catch(e){} }
  if(rp(st.favSongs)){ found=true; try{Store.set('favSongs',st.favSongs);}catch(e){} }
  if(rp(st.history)){ found=true; try{Store.set('history',st.history);}catch(e){} }
  try{ ctxStore.forEach(function(l){ rp(l); }); }catch(e){}
  try{ if(window.BoosterPlaylists&&BoosterPlaylists.replaceTrack&&BoosterPlaylists.replaceTrack(oid,nt)) found=true; }catch(e){}
  var wasCur=st.currentTrack&&st.currentTrack.id===oid;
  if(wasCur){
    if(opts.inPlace){ Object.assign(st.currentTrack,nt); try{ renderMiniPlayer(); renderFullPlayer(); }catch(e){} }
    else { var ix=st.queue.findIndex(function(x){return x&&x.id===nt.id;}); if(ix>=0){ st.queueIndex=ix; try{Queue.persist();}catch(e){} } Player.play(nt,null,null,{autoTransition:false}); }
  }
  try{ if(st.view==='favorites'||st.view==='library') renderLibrary(); }catch(e){}
  return found||wasCur;
}
/* ---------- latest metadata ---------- */
async function metadata(c){
  tst('Fetching latest metadata…'); var t=c.track, nt=null;
  if(c.kind==='yt'){
    var tt=await getTrack(c); if(!tt) return;
    var m=null; try{ m=await BosIT.resolve(tt.name,tt.artistName,tt.duration); }catch(e){}
    if(m&&m.title){ nt=Object.assign({},tt,{name:m.title,artistName:m.artist||tt.artistName,albumName:m.album||tt.albumName,image:m.art||tt.image}); if(m.year) nt.year=m.year; }
  } else {
    try{
      var r=await apiFetch(MUSIC_API+'/songs/'+encodeURIComponent(t.id),'song:'+t.id+':fresh'+Date.now(),1000);
      var f=normalizeSong(Array.isArray(r.data)?r.data[0]:r.data);
      if(f&&f.id){ nt=Object.assign({},t,f); if(!Object.keys(f.downloadUrl||{}).length) nt.downloadUrl=t.downloadUrl; if(!f.image||/^data:/.test(f.image)) nt.image=t.image; delete nt._needsFetch; }
    }catch(e){}
  }
  if(!nt){ tst('No newer metadata found','error'); return; }
  c.track=nt; replaceEverywhere(t,nt,{inPlace:true});
  tst('Updated: '+nt.name+(nt.artistName?' - '+nt.artistName:''));
}
/* ---------- download ---------- */
function jioUrls(t){
  var d=t.downloadUrl||{}, ks=Object.keys(d).sort(function(a,b){return (parseInt(b)||0)-(parseInt(a)||0);});
  return ks.map(function(k){var u=d[k];return function(){return Promise.resolve(u);};});
}
function extOf(b,u){ var s=(b.type||'')+' '+(u||''); if(/mpeg|mp3/i.test(s)) return 'mp3'; if(/webm/i.test(s)) return 'webm'; if(/ogg|opus/i.test(s)) return 'ogg'; return 'm4a'; }
async function download(c){
  var t=await getTrack(c); if(!t) return;
  var cands=[], yt=(c.kind==='yt');
  if(yt){ try{ cands=(window.BosYT&&BosYT.audioSources)?BosYT.audioSources(t.videoId):[]; }catch(e){} }
  else cands=jioUrls(t);
  if(!cands.length){ tst('No audio source found for this song','error'); return; }
  tst('Downloading…');
  var raw=window.__origFetch||window.fetch;
  var name=((t.artistName?t.artistName+' - ':'')+t.name).replace(/[\\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').trim().slice(0,120)||'song';
  function save(b,url){
    var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name+'.'+extOf(b,url); document.body.appendChild(a); a.click();
    setTimeout(function(){ try{URL.revokeObjectURL(a.href);}catch(e){} a.remove(); },5000);
    tst('Downloaded: '+t.name);
  }
  function getBlob(url,sig){
    var fs=yt?[fetch,raw]:[fetch], k=0;
    function nxt(){
      if(k>=fs.length||sig.aborted) return Promise.reject(0);
      var f=fs[k++], ac=new AbortController(), tm=setTimeout(function(){ try{ac.abort();}catch(e){} },yt?9000:60000);
      var onAb=function(){ try{ac.abort();}catch(e){} }; sig.addEventListener('abort',onAb);
      return f(url,{signal:ac.signal}).then(function(r){ clearTimeout(tm); if(!r.ok) throw 0; return r.blob(); })
        .then(function(b){ sig.removeEventListener('abort',onAb); if(b.size<30000||/text|json|html/i.test(b.type)) throw 0; return {b:b,url:url}; })
        .catch(function(){ clearTimeout(tm); sig.removeEventListener('abort',onAb); return nxt(); });
    }
    return nxt();
  }
  if(!yt){   /* JioSaavn: unchanged, one by one (first URL almost always works) */
    var ac0=new AbortController();
    for(var i=0;i<cands.length;i++){
      try{ var u=await cands[i](); if(!u) continue; var r0=await getBlob(u,ac0.signal); save(r0.b,r0.url); return; }catch(e){}
    }
    try{ var u0=await cands[0](); if(u0){ window.open(u0,'_blank','noopener'); tst('Opened the direct file - save it from the browser'); return; } }catch(e){}
    tst('Download failed. Try again in a moment','error'); return;
  }
  /* 0) same song on the BOOSTER (JioSaavn) server: fast, free, no key. strict=true -> only a close match (same length / same title) */
  async function jioTry(strict){
    try{
      tst('Finding this song on the BOOSTER server…');
      var lt=null; try{ lt=ytLyricTracks(t)[0]; }catch(e){} lt=lt||t;
      var q=((lt.name||'')+' '+String(lt.artistName||'').split(',')[0]).trim();
      var rr=await Api.searchSongs(q,0,8), arr=((rr.data&&rr.data.results)||[]).map(normalizeSong).filter(Boolean);
      var d0=+t.duration||0, nz=function(x){ return String(x||'').toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g,''); };
      var pick=arr.find(function(x){ return d0&&x.duration&&Math.abs(x.duration-d0)<=20; });
      if(!pick&&!strict) pick=arr[0];
      if(!pick&&strict&&!d0){ var tn=nz(lt.name); pick=arr.find(function(x){ var n=nz(x.name); return tn&&n&&(tn.indexOf(n)>=0||n.indexOf(tn)>=0); }); }
      if(!pick) return false;
      var jc=jioUrls(pick), acj=new AbortController();
      for(var q2=0;q2<jc.length;q2++){
        try{ var ju=await jc[q2](); if(!ju) continue; var jr=await getBlob(ju,acj.signal); save(jr.b,jr.url); return true; }catch(e){}
      }
    }catch(e){}
    return false;
  }
  if(await jioTry(true)) return;
  /* 1) BOOSTER server (/dl): the server fetches the audio and hands it to us */
  var DS=window.BOOSTER_DL_SERVER;
  if(DS&&t.videoId&&!window.__boosterDown()){
    try{
      tst('Downloading from BOOSTER server…');
      var ac1=new AbortController(), tm1=setTimeout(function(){ try{ac1.abort();}catch(e){} },8000);
      var r1=await fetch(DS+'/dl?id='+encodeURIComponent(t.videoId)+'&name='+encodeURIComponent(name),{signal:ac1.signal});
      clearTimeout(tm1);
      if(r1.ok){ var b1=await r1.blob(); if(b1.size>=30000&&!/text|json|html/i.test(b1.type)){ save(b1,''); return; } }
    }catch(e){ window.__boosterMarkDown(); }
  }
  /* 2) fallback: YouTube: RACE all sources in parallel. The source that won last time starts first; the rest follow 0.5s apart. First good file wins, the rest are cancelled. */
  var winKey=''; try{ winKey=localStorage.getItem('bos_dl_win')||''; }catch(e){}
  var ac=new AbortController(), firstUrl=null, left=cands.length, done=false;
  var won=await new Promise(function(ok){
    var overall=setTimeout(function(){ if(!done){ done=true; try{ac.abort();}catch(e){} ok(null); } },45000);
    function fail(){ if(--left<=0&&!done){ done=true; clearTimeout(overall); ok(null); } }
    cands.forEach(function(mk,idx){
      (async function(){
        try{
          var url=await mk(); if(!url||done) throw 0; if(!firstUrl) firstUrl=url;
          var fav=winKey&&url.indexOf(winKey)===0;
          var wait=fav?0:(winKey?1200:0)+idx*500;
          if(wait) await new Promise(function(r){ setTimeout(r,wait); });
          if(done) throw 0;
          var r=await getBlob(url,ac.signal);
          if(!done){ done=true; clearTimeout(overall); try{ac.abort();}catch(e){} ok(r); }
        }catch(e){ fail(); }
      })();
    });
  });
  if(won){ try{ localStorage.setItem('bos_dl_win',new URL(won.url).origin); }catch(e){} }
  if(won){ save(won.b,won.url); return; }
  if(await jioTry(false)) return;   /* last chance: loose match on JioSaavn */
  if(firstUrl){ window.open(firstUrl,'_blank','noopener'); tst('Opened the direct file - save it from the browser'); return; }
  tst('Download failed. Try again in a moment','error');
}
/* ---------- smart replace ---------- */
async function smartReplace(c){
  var box=$i('bos-sm-box'), t=c.track;
  box.innerHTML='<div class="bos-sm-grab"><i></i></div><div class="bos-sm-head"><button type="button" class="bos-sm-sq" data-bsm="back" aria-label="Back">'+IC.back+'</button><div class="bos-sm-meta"><b>Smart Replace</b><span>Pick the right version of this song</span></div><button type="button" class="bos-sm-x" data-bsm="close" aria-label="Close">'+IC.x+'</button></div><div class="bos-sm-empty" id="bos-sm-res">Searching…</div>';
  var q;
  if(c.kind==='yt'){ var lt=null; try{ lt=ytLyricTracks(t)[0]; }catch(e){} lt=lt||t; q=((lt.artistName||'')+' '+(lt.name||'')).trim(); }
  else q=((t.name||'')+' '+String(t.artistName||'').split(',')[0]).trim();
  var jp=Api.searchSongs(q,0,8).then(function(r){ var a=(r.data&&r.data.results)||[]; return a.map(normalizeSong).filter(Boolean).map(function(x){x._src='BOOSTER';return x;}); }).catch(function(){return[];});
  var yp=(window.BosYT?BosYT.search(q+' audio','video'):Promise.resolve([])).then(function(v){ return (v||[]).filter(function(x){return x&&x.videoId;}).slice(0,8).map(function(x){var y=ytTrackFrom(x);y._src='YouTube';return y;}); }).catch(function(){return[];});
  var rs=await Promise.all([jp,yp]); if(cur!==c) return;
  repList=rs[0].concat(rs[1]).filter(function(x){return x.id!==t.id;});
  var res=$i('bos-sm-res'); if(!res) return;
  if(!repList.length){ res.textContent='No other versions found'; return; }
  res.className='bos-sm-list';
  res.innerHTML=repList.map(function(x,i){ return '<button type="button" class="bos-sm-it bos-sm-rep" data-brep="'+i+'"><img class="bos-sm-rimg" src="'+e2(x.image||FALLBACK_ART)+'" onerror="this.src=\''+FALLBACK_ART+'\'" alt=""><span class="bos-sm-lb">'+e2(x.name)+'<small>'+e2(x.artistName||'')+(x.duration?' · '+fmt(x.duration):'')+'</small></span><span class="bos-sm-badge">'+x._src+'</span></button>'; }).join('');
}
async function pickReplace(i){
  var c=cur, nt=repList[i]; if(!c||!nt||busy) return; busy=true;
  try{
    var old=c.track; closeMenu();
    if(!nt.videoId){ var f=await resolvePlayableTrack(nt); if(!f){ tst('Could not load that version','error'); return; } nt=f; }
    delete nt._src;
    var found=replaceEverywhere(old,nt,{});
    if(found) tst('Replaced with: '+nt.name); else { Player.play(nt,[nt],0,{autoTransition:false}); tst('Playing the other version'); }
  } finally { busy=false; }
}
/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var sm=e.target.closest&&e.target.closest('#bos-sm');
  if(sm){
    var b=e.target.closest('[data-bsm]'); if(b){ e.stopPropagation(); var a=b.dataset.bsm; if(a==='back'){ if(cur) render(); } else act(a); return; }
    var r=e.target.closest('[data-brep]'); if(r){ e.stopPropagation(); pickReplace(+r.dataset.brep); return; }
    return;
  }
  var m=e.target.closest&&e.target.closest('[data-bosmenu]');
  if(m){ e.preventDefault(); e.stopPropagation(); openMenu(ctxFromEl(m)); }
},true);
/* long-press (or right click) on any song row / card opens the same menu */
var lp={t:0,x:0,y:0,el:null,fired:false};
function lpClear(){ clearTimeout(lp.t); lp.t=0; }
document.addEventListener('pointerdown',function(e){
  lp.fired=false;
  if(e.pointerType==='mouse'&&e.button!==0) return;
  if(e.target.closest('#bos-sm,button.ctrl-btn,.heart-btn')) return;
  var el=e.target.closest('.yt-res,[data-action="play-song"][data-id]'); if(!el) return;
  lp.x=e.clientX; lp.y=e.clientY; lp.el=el; lp.fired=false; lpClear();
  lp.t=setTimeout(function(){ var c=ctxFromEl(el); if(c){ lp.fired=true; if(navigator.vibrate) try{navigator.vibrate(12);}catch(_){} openMenu(c); } },520);
},true);
document.addEventListener('pointermove',function(e){ if(lp.t&&(Math.abs(e.clientX-lp.x)>9||Math.abs(e.clientY-lp.y)>9)) lpClear(); },true);
['pointerup','pointercancel','scroll'].forEach(function(n){ document.addEventListener(n,lpClear,true); });
document.addEventListener('click',function(e){ if(lp.fired){ lp.fired=false; e.preventDefault(); e.stopPropagation(); } },true);
document.addEventListener('contextmenu',function(e){ var el=e.target.closest&&e.target.closest('.yt-res,[data-action="play-song"][data-id]'); if(el&&!e.target.closest('#bos-sm')){ var c=ctxFromEl(el); if(c){ e.preventDefault(); openMenu(c); } } },true);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&cur) closeMenu(); });
window.BosSongMenu={open:function(track){ if(track) openMenu({kind:track.source==='youtube'?'yt':'jio',track:track,v:track.source==='youtube'?{videoId:track.videoId||String(track.id||'').replace(/^yt_/,'')}:null}); }};
})();

})();
