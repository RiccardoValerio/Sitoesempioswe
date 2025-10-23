(async () => {
  const lists = [...document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]')];
  if (!lists.length) return;

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const now = Date.now();

  const BRANCH_FALLBACKS = ['main', 'gh-pages']; // tenta entrambe

  const ensureSlash = s => (s.endsWith('/') ? s : s + '/');
  function inferSiteBase(repo){
    const attr = document.documentElement.getAttribute('data-site-base');
    if (attr) return ensureSlash(attr);
    const { origin, hostname } = location;
    return hostname.endsWith('github.io') ? ensureSlash(`${origin}/${repo}/`) : ensureSlash(`${origin}/`);
  }

  const jobs = lists.map(ul => ({
    ul,
    owner: ul.dataset.repoOwner,
    repo: ul.dataset.repoName,
    branch: ul.dataset.branch || 'main',
    path: (ul.dataset.path || '').replace(/^\/+|\/+$/g, ''),
    exts: (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase()),
    sort: (ul.dataset.sort || 'name').toLowerCase(),
    order: (ul.dataset.order || 'asc').toLowerCase(),
    siteBase: ensureSlash(ul.dataset.siteBase || inferSiteBase(ul.dataset.repoName))
  }));

  // raggruppa per (owner/repo/path) per evitare fetch duplicate
  const groups = new Map();
  for (const j of jobs){
    const k = `${j.owner}/${j.repo}/${j.path}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(j);
  }

  await Promise.all([...groups.entries()].map(async ([key, group]) => {
    const sample = group[0];
    const branchesToTry = uniqueBranches(sample.branch, BRANCH_FALLBACKS);
    let entries = null, usedBranch = sample.branch;

    // 1) prova da cache (solo successi precedenti)
    const cacheKey = (b) => `ghls:${sample.owner}/${sample.repo}@${b}/${sample.path}`;
    try {
      const c = localStorage.getItem(cacheKey(sample.branch));
      if (c){
        const p = JSON.parse(c);
        if (p.t && (now - p.t) < CACHE_TTL_MS) {
          entries = p.entries; usedBranch = sample.branch;
        }
      }
    } catch {}

    // 2) fetch (con fallback branch)
    if (!entries){
      for (const b of branchesToTry){
        const url = `https://api.github.com/repos/${encodeURIComponent(sample.owner)}/${encodeURIComponent(sample.repo)}/contents/${encodeURIComponent(sample.path)}?ref=${encodeURIComponent(b)}`;
        try{
          const resp = await fetch(url, { headers: { 'Accept':'application/vnd.github+json', 'Cache-Control':'no-cache' } });
          if (resp.ok){
            const data = await resp.json();
            entries = Array.isArray(data) ? data : (data ? [data] : []);
            usedBranch = b;
            try { localStorage.setItem(cacheKey(b), JSON.stringify({ t: now, entries })); } catch {}
            break; // ok, smetti di provare altri branch
          } else if (resp.status === 404){
            // non cache-are il vuoto su 404
            console.debug('[auto-index] 404:', url);
          } else {
            console.debug('[auto-index] HTTP', resp.status, url);
          }
        } catch (e){
          console.debug('[auto-index] fetch error:', e);
        }
      }
      // se ancora null, metti lista vuota per rendere prevedibile sotto
      if (!entries) entries = [];
    }

    // 3) render per ogni UL del gruppo (costruendo URL di PAGES)
    for (const j of group){
      // usa lo stesso branch usato per leggere i file (per coerenza con Pages)
      const files = (entries || [])
        .filter(e => e.type === 'file')
        .filter(e => j.exts.some(ext => (e.name || '').toLowerCase().endsWith(ext)));

      const items = files
        .map(e => ({
          name: e.name,
          url: j.siteBase + e.path.replace(/^\/+/, ''), // URL del tuo sito
          time: e.sha
        }))
        .sort((a, b) => {
          const cmp = (j.sort === 'time')
            ? (a.time || '').localeCompare(b.time || '')
            : a.name.localeCompare(b.name);
          return j.order === 'desc' ? -cmp : cmp;
        });

      console.debug(`[auto-index] ${j.path} @ ${usedBranch} -> ${items.length} file`);

      if (!items.length) pruneUp(j.ul);
      else renderList(j.ul, items);
    }
  }));

  cleanupContainers();

  /* ---------- util ---------- */

  function uniqueBranches(primary, fallbacks){
    const arr = [primary, ...fallbacks];
    return [...new Set(arr.filter(Boolean))];
  }

  function renderList(ul, items){
    ul.innerHTML = '';
    for (const it of items){
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.className = 'file-link';
      a.href = it.url;                 // URL Pages
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.removeAttribute('download');
      a.textContent = it.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  function pruneUp(start){
    const ul = start.closest('.auto-list') || start;
    if (ul && ul.matches('.auto-list')) ul.remove();
    let node = ul.parentElement;
    while (node){
      if (node.matches('details, .uncat')){
        if (isEmpty(node)){ const next = node.parentElement; node.remove(); node = next; continue; }
        break;
      }
      if (node.matches('section')) break; // non rimuovere le section
      node = node.parentElement;
    }
  }

  function cleanupContainers(){
    let changed = true;
    while (changed){
      changed = false;
      document.querySelectorAll('details, .uncat').forEach(n => {
        if (isEmpty(n)){ n.remove(); changed = true; }
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
