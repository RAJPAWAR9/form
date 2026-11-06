/* ==== BOOSTER SERVER: paste your Cloudflare Worker URL between the quotes (or run localStorage.setItem('bos_server','https://...') once) ==== */
window.BOOSTER_SERVER=(function(){var s='';try{s=localStorage.getItem('bos_server')||''}catch(e){}return(s||'https://boostersever.raj-pawar091206.workers.dev').replace(/\/$/,'')})();
window.__boosterDown=function(){return false;}; window.__boosterMarkDown=function(){};
(function(){
  var S=window.BOOSTER_SERVER; if(!/^https:\/\//.test(S)){ window.BOOSTER_SERVER=''; return; }
  /* B1: after one failure skip Booster for 150s and go straight to fallbacks */
  var __bd=0; window.__boosterDown=function(){return Date.now()<__bd;}; window.__boosterMarkDown=function(){__bd=Date.now()+150000;};
  var of=window.fetch.bind(window); window.__origFetch=of; (function(){var d='',l='';try{d=localStorage.getItem('bos_dl_server')||'';l=localStorage.getItem('bos_ly_server')||'';}catch(e){} window.BOOSTER_DL_SERVER=(d||window.BOOSTER_SERVER||'').replace(/\/$/,''); window.BOOSTER_LY_SERVER=(l||window.BOOSTER_SERVER||'').replace(/\/$/,'');})();
  /* every cross-site https request goes through YOUR server (except *.workers.dev = your own workers); if the server refuses a host or is unreachable, the request is sent directly */
  window.fetch=function(i,o){
    var u=null; try{ if(typeof i==='string'||i instanceof URL) u=new URL(String(i),location.href); }catch(e){}
    if(u&&u.protocol==='https:'&&u.origin!==location.origin&&!/\.workers\.dev$/.test(u.hostname)){
      if(window.__boosterDown()) return of(i,o);
      if(/^(itunes\.apple\.com|lrclib\.net)$/.test(u.hostname)){   /* B5: these allow CORS - no need to spend Worker quota unless direct fails */
        return of(i,o).catch(function(e){ if(o&&o.signal&&o.signal.aborted) throw e; return viaProxy(i,o,u); });
      }
      return viaProxy(i,o,u);
    }
    return of(i,o);
  };
  function viaProxy(i,o,u){
      return new Promise(function(res,rej){ var done=false, tm=setTimeout(function(){ if(done) return; done=true; window.__boosterMarkDown(); of(i,o).then(res,rej); },5000);
        of(S+'/p?u='+encodeURIComponent(u.href),o).then(function(r){ if(done) return; done=true; clearTimeout(tm); if(r.status===403&&r.headers.get('X-Booster-Deny')) return of(i,o).then(res,rej); res(r); },function(e){ if(done) return; done=true; clearTimeout(tm); if(o&&o.signal&&o.signal.aborted) return rej(e); window.__boosterMarkDown(); of(i,o).then(res,rej); }); });
  }
})();
