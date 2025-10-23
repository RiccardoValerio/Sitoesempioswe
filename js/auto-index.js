(async () => {
  const lists = [...document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]')];
  if (!lists.length) return;

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const now = Date.now();

  function ensureSlash(s){return s.endsWith('/')?s:s+'/';}
  function inferSiteBase(repo){
    const attr = document.documentElement.getAttribute('data-site-base');
    if (attr) return ensureSlash(attr);
    const {origin,hostname}=location;
    return hostname.endsWith('github.io') ? ensureSlash(`${origin}/${repo}/`) : ensureSlash(`${origin}/`);
  }

  const jobs = lists.map(ul => ({
    ul,
    owner: ul.dataset.repoOwner,
    repo: ul.dataset.repoName,
    branch: ul.dataset.branch || 'main',
    path: (ul.dataset.path||'').replace(/^\/+|\/+$/g,''),
    exts: (ul.dataset.extensions||'.pdf').split(',').map(s=>s.trim().toLowerCase()),
    sort: (ul.dataset.sort||'name').toLowerCase(),
    order: (ul.dataset.order||'asc').toLowerCase(),
    siteBase: ensureSlash(ul.dataset.siteBase || inferSiteBase(ul.dataset.repoName))
  }));

  const groups = new Map();
  for (const j of jobs){
    const k = `${j.owner}/${j.repo}@${j.branch}/${j.path}`;
    (groups.get(k)||groups.set(k,[]).get(k)).push(j);
  }

  await Promise.all([...groups.entries()].map(async ([key, group])=>{
    const sample = group[0];
    const cacheKey = `ghls:${key}`;
    let entries;

    // cache (solo se presente e non scaduta)
    try{
      const c = localStorage.getItem(cacheKey);
      if (c){
        const p = JSON.parse(c);
        if (p.t && (now - p.t) < CACHE_TTL_MS) entries = p.entries;
      }
    }catch{}

    // fetch se serve
    if (!entries){
      const url = `https://api.github.com/repos/${encodeURIComponent(sample.owner)}/${encodeURIComponent(sample.repo)}/contents/${encodeURIComponent(sample.path)}?ref=${encodeURIComponent(sample.branch)}`;
      try{
        const resp = await fetch(url, { headers:{'Accept':'application/vnd.github+json','Cache-Control':'no-cache'} });
        if (resp.ok){
          const data = await resp.json();
          entries = Array.isArray(data)?data:(data?[data]:[]);
          // ❗ cache SOLO se ok
          try{ localStorage.setItem(cacheKey, JSON.stringify({t:now, entries})); }catch{}
        }else if (resp.status===404){
          // non cache-are il vuoto su 404: così appena crei la cartella, ricompare
          entries = [];
        }else{
          entries = [];
        }
      }catch{
        entries = [];
      }
    }

    for (const j of group){
      const items = (entries||[])
        .filter(e=>e.type==='file')
        .filter(e=>j.exts.some(ext => (e.name||'').toLowerCase().endsWith(ext)))
        .map(e=>({ name:e.name, url: j.siteBase + e.path.replace(/^\/+/,'') }))
        .sort((a,b)=>{
          const cmp = (j.sort==='time') ? 0 : a.name.localeCompare(b.name);
          return j.order==='desc' ? -cmp : cmp;
        });

      if (!items.length) pruneUp(j.ul); else renderList(j.ul, items);
    }
  }));

  cleanupContainers();

  function renderList(ul, items){
    ul.innerHTML='';
    for (const it of items){
      const li=document.createElement('li');
      const a=document.createElement('a');
      a.className='file-link';
      a.href=it.url; a.target='_blank'; a.rel='noopener noreferrer';
      a.removeAttribute('download');
      a.textContent=it.name;
      li.appendChild(a); ul.appendChild(li);
    }
  }

  function pruneUp(start){
    const ul = start.closest('.auto-list')||start;
    if (ul && ul.matches('.auto-list')) ul.remove();
    let node = ul.parentElement;
    while (node){
      if (node.matches('details, .uncat')){
        if (isEmpty(node)){ const next=node.parentElement; node.remove(); node=next; continue; }
        break;
      }
      if (node.matches('section')) break; // non rimuovere le section
      node = node.parentElement;
    }
  }

  function cleanupContainers(){
    let changed=true;
    while(changed){
      changed=false;
      document.querySelectorAll('details, .uncat').forEach(n=>{
        if (isEmpty(n)){ n.remove(); changed=true; }
      });
    }
  }

  function isEmpty(c){
    if (!c) return true;
    if (c.querySelector('.auto-list')) return false;
    if (c.querySelector('.file-list a, .uncat-files a, .list a')) return false;
    for (const d of c.querySelectorAll('details')){
      if (d.querySelector('.file-list a, .auto-list')) return false;
    }
    return true;
  }
})();
