/**
 * Auto-index GitHub folders and render lists (public repos).
 * - Popola le <ul class="auto-list"> con i file nelle cartelle del repo.
 * - Se una cartella è vuota/inesistente: rimuove la UL e "pota" i contenitori genitori
 *   (<details> Documenti/Verbali e .uncat) se rimasti senza contenuti.
 * - NON rimuove mai le <section> principali.
 * - Apri SEMPRE nel viewer GitHub (html_url) in nuova scheda (no download).
 * - Richieste in parallelo, cache locale 5 minuti per path.
 */
(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti cache
  const now = Date.now();

  // Raggruppa per path per evitare fetch duplicati
  const jobs = lists.map(ul => ({
    ul,
    owner: ul.dataset.repoOwner,
    repo: ul.dataset.repoName,
    branch: ul.dataset.branch || 'main',
    path: (ul.dataset.path || '').replace(/^\/+|\/+$/g, ''),
    exts: (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase()),
    sort: (ul.dataset.sort || 'name').toLowerCase(),
    order: (ul.dataset.order || 'asc').toLowerCase()
  }));

  const byKey = new Map();
  for (const j of jobs) {
    const key = `${j.owner}/${j.repo}@${j.branch}/${j.path}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(j);
  }

  await Promise.all([...byKey.entries()].map(async ([key, group]) => {
    const sample = group[0];
    const cacheKey = `ghls:${key}`;
    let entries;

    // 1) cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.t && (now - parsed.t) < CACHE_TTL_MS) entries = parsed.entries;
      }
    } catch {}

    // 2) fetch se necessario
    if (!entries) {
      const url = `https://api.github.com/repos/${encodeURIComponent(sample.owner)}/${encodeURIComponent(sample.repo)}/contents/${encodeURIComponent(sample.path)}?ref=${encodeURIComponent(sample.branch)}`;
      const headers = {
        'Accept': 'application/vnd.github+json'
        // 'Authorization': `Bearer ${GITHUB_TOKEN}` // <-- solo se repo privato
      };
      try {
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          entries = Array.isArray(data) ? data : (data ? [data] : []);
        } else if (resp.status === 404) {
          entries = []; // cartella inesistente -> tratta come vuota
        } else {
          entries = [];
        }
      } catch {
        entries = [];
      }
      try { localStorage.setItem(cacheKey, JSON.stringify({ t: now, entries })); } catch {}
    }

    // 3) render per ogni UL del gruppo
    for (const j of group) {
      const items = (entries || [])
        .filter(e => e.type === 'file')
        .filter(e => {
          const n = (e.name || '').toLowerCase();
          return j.exts.some(ext => n.endsWith(ext));
        })
        .map(e => ({
          name: e.name,
          url: e.html_url,        // viewer GitHub -> apre in nuova scheda senza download
          time: e.sha
        }))
        .sort((a, b) => {
          const cmp = (j.sort === 'time')
            ? (a.time || '').localeCompare(b.time || '')
            : a.name.localeCompare(b.name);
          return j.order === 'desc' ? -cmp : cmp;
        });

      if (!items.length) pruneUp(j.ul);
      else renderList(j.ul, items);
    }
  }));

  // ripulisce residui: rimuovi accordion/uncat rimasti vuoti (ma NON le section)
  cleanupContainers();

  /* ============= funzioni ============= */

  function renderList(ul, items) {
    ul.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.className = 'file-link';
      a.href = it.url;                       // pagina viewer GitHub
      a.target = '_blank';                   // nuova scheda
      a.rel = 'noopener noreferrer';         // sicurezza
      a.removeAttribute('download');         // assicurati che non scarichi
      a.textContent = it.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  // Rimuove UL e pota contenitori padri finché vuoti: details(.accordion/.nested) e .uncat
  function pruneUp(startNode) {
    if (!startNode) return;
    const ul = startNode.closest('.auto-list') || startNode;
    if (ul && ul.matches('.auto-list')) ul.remove();

    let node = (ul && ul.parentElement) ? ul.parentElement : null;
    while (node) {
      if (node.matches('details, .uncat')) {
        if (isContainerEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else break;
      }
      // NON rimuovere mai <section>
      if (node.matches('section')) break;
      node = node.parentElement;
    }
  }

  // Rimozione finale di contenitori vuoti residui (senza toccare le section)
  function cleanupContainers() {
    let changed = true;
    while (changed) {
      changed = false;
      document.querySelectorAll('details, .uncat').forEach(node => {
        if (!document.body.contains(node)) return;
        if (isContainerEmpty(node)) {
          node.remove();
          changed = true;
        }
      });
    }
  }

  // Un contenitore è "utile" se contiene almeno un link file o una auto-list non vuota
  function isContainerEmpty(container) {
    if (!container) return true;
    if (container.querySelector('.auto-list')) return false;
    if (container.querySelector('.file-list a, .uncat-files a, .list a')) return false;
    const childDetails = container.querySelectorAll('details');
    for (const d of childDetails) {
      if (d.querySelector('.file-list a, .auto-list')) return false;
    }
    return true;
  }
})();
