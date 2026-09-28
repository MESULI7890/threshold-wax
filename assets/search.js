---
---
/* Search for Digital Nexus.
   Uses the Wax search index (search/index.json, built by `rake wax:search main`)
   and elasticlunr, the search library that ships with Wax. */
(function(){
  var BASE = "{{ '' | relative_url }}";
  var INDEX_URL = "{{ '/search/index.json' | relative_url }}";
  var store = null, idx = null, ready = [];

  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function tokens(q){ return norm(q).split(/\s+/).map(function(t){return t.replace(/[^\w.-]/g,'');}).filter(Boolean); }
  function hl(text, toks){
    var out = esc(text); if(!toks.length) return out;
    var re = new RegExp('('+toks.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|')+')','gi');
    return out.replace(re,'<mark>$1</mark>');
  }
  var EXT='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var DL='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v7M3 5l3 3 3-3M2 11h8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  function itemUrl(d){ return BASE + '/catalogue/' + d.pid + '/'; }

  function load(cb){
    if(store){ cb(); return; }
    ready.push(cb);
    if(ready.length > 1) return;
    fetch(INDEX_URL).then(function(r){ return r.json(); }).then(function(docs){
      store = docs;
      idx = elasticlunr(function(){
        this.setRef('lunr_id');
        ['label','creator','contributor','subject','description','publisher','area','shelf_label','type','_date','coverage','rights'].forEach(function(f){ this.addField(f); }, this);
        this.saveDocument(false);
      });
      docs.forEach(function(d){ idx.addDoc(d); });
      ready.forEach(function(f){ f(); }); ready = [];
    }).catch(function(){
      ready.forEach(function(f){ f(new Error('index')); }); ready = [];
    });
  }

  /* opts: {q, shelf, area, sa, year} -> array of docs */
  function search(opts){
    var q = (opts.q||'').trim(), toks = tokens(q), list;
    if(toks.length){
      var scored = idx.search(q, {fields:{label:{boost:3},creator:{boost:2},subject:{boost:2},description:{boost:1},publisher:{boost:1},area:{boost:1},shelf_label:{boost:1},type:{boost:1},_date:{boost:1},coverage:{boost:1},rights:{boost:1}}, bool:'AND', expand:true});
      var seen = {}; list = [];
      scored.forEach(function(r){ var d = store[r.ref]; if(d){ seen[d.lunr_id]=1; list.push(d); } });
      /* plain-text fallback so partial words, hyphens and names always match */
      store.forEach(function(d){
        if(seen[d.lunr_id]) return;
        var hay = norm([d.label,d.creator,d.contributor,d.subject,d.description,d.publisher,d.area,d.shelf_label,d.type,d._date,d.coverage,d.rights].join(' '));
        if(toks.every(function(t){ return hay.indexOf(t) > -1; })) list.push(d);
      });
    } else {
      list = store.slice().sort(function(a,b){ return String(a.order).localeCompare(String(b.order)); });
    }
    return list.filter(function(d){
      if(opts.shelf && d.shelf !== opts.shelf) return false;
      if(opts.area && d.area !== opts.area) return false;
      if(opts.sa && d.sa !== 'yes') return false;
      var y = parseInt(d._date,10);
      if(opts.year === '0' && y >= 2010) return false;
      if(opts.year && opts.year !== '0' && y < parseInt(opts.year,10)) return false;
      return true;
    });
  }

  function dlButton(d){
    if(!d.download) return '<span class="btn off">Online only</span>';
    var size = (d.download_size && /MB/.test(d.download_size)) ? ' ('+esc(d.download_size)+')' : '';
    if(d.stored_here === 'yes'){
      var fname = d.download.split('/').pop();
      return '<a class="btn" href="'+esc(BASE + d.download)+'" download="'+esc(fname)+'">'+DL+' Download '+esc(d.download_type)+size+'</a>';
    }
    return '<a class="btn" href="'+esc(d.download)+'" target="_blank" rel="noopener">'+DL+' Download '+esc(d.download_type)+size+'</a>';
  }
  function card(d, toks){
    return '<article class="card shelf-'+esc(d.shelf)+'">'+
      '<span class="badge">'+esc(d.shelf_label)+'</span>'+(d.sa==='yes'?'<span class="badge sa">South Africa</span>':'')+
      '<h3><a href="'+itemUrl(d)+'">'+hl(d.label,toks)+'</a></h3>'+
      '<div class="meta-line">'+hl(d.creator,toks)+' · '+esc(d._date)+' · '+esc(d.type)+' · '+esc(d.rights)+'</div>'+
      '<p class="desc">'+hl(d.description,toks)+'</p>'+
      '<div class="actions"><a class="btn solid" href="'+esc(d.source||itemUrl(d))+'" target="_blank" rel="noopener">Read online '+EXT+'</a>'+dlButton(d)+
      '<a class="btn plain" href="'+itemUrl(d)+'">View metadata</a></div></article>';
  }
  function row(d, toks){
    return '<a class="row shelf-'+esc(d.shelf)+'" href="'+itemUrl(d)+'"><span class="badge">'+esc(d.shelf_label)+'</span>'+(d.sa==='yes'?'<span class="badge sa">South Africa</span>':'')+
      '<span class="t" style="display:block">'+hl(d.label,toks)+'</span><span class="m">'+hl(d.creator,toks)+' · '+esc(d._date)+'</span></a>';
  }
  window.TC = {load:load, search:search, card:card, row:row, tokens:tokens, esc:esc, get store(){ return store; }};
})();
