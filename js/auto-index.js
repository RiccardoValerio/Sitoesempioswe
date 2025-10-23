/**
 * Auto-index GitHub folders and render lists (public repos).
 * - Link direttamente agli URL del SITO (es. https://user.github.io/repo/docs/.../file.pdf)
 * - Se cartella vuota/inesistente: rimuove la UL e pota i contenitori (details/.uncat).
 * - NON rimuove mai le <section>.
 * - Richieste in parallelo + cache locale 5 min.
 */
(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const now = Date.now();

  // Base URL del sito: può essere definita su <html data-site-base="https://.../repo/">
  // oppure inferita automaticamente per GitHub Pages.
  function inferSiteBase(repo) {
    const attr = document.documentElement.getAttribute('data-site-base');
    if (attr) return ensureTrailingSlash(attr);

    const { origin, hostname } = window.location;
    if (hostname.endsWith('github.io')) {
      // project pages: https://user.github.io/<repo>/
      return ensureTrailingSlash(`${origin}/${repo}/`);
    }
    // custom domain / hosting diverso: servito alla radice
    return ensureTrailingSlash(`${origin}/`);
  }
  function ensureTrailingSlash(s) { return s.endsWith('/') ? s : s + '/'; }

  const jobs = lists.map(ul => ({
    ul,
    owner: ul.dataset.repoOwner,
    repo: ul.dataset.repoName,
    branch: ul.dataset.branch || 'main',
    path: (ul.dataset.path || '').replace(/^\/+|\/+$/g, ''),
    exts: (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase()),
    sort: (ul.dataset.sort || 'name').toLowerCase(),
    order: (ul.dataset.order || 'asc').toLowerCase(),
    siteBase: ensureTrailingSlash(ul.dataset.siteBase || inferSiteBase(ul.dataset.repoName))
  }));

  // Raggruppa per path per evitare fetch duplicati
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

    // cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.t && (now - parsed.t) < CACHE_TTL_MS) entries = parsed.entries;
      }
    } catch {}

    // fetch se necessario
    if (!entries) {
      const url = `https://api.github.com/repos/${encodeURIComponent(sample.owner)}/${encodeURIComponent(sample.repo)}/contents/${encodeURIComponent(sample.path)}?ref=${encodeURIComponent(sample.branch)}`;
      const headers = { 'Accept': 'application/vnd.github+json' };
      try {
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          entries = Array.isArray(data) ? data : (data ? [data] : []);
        } else if (resp.status === 404) {
          entries = [];
        } else {
          entries = [];
        }
      } catch {
        entries = [];
      }
      try { localStorage.setItem(cacheKey, JSON.stringify({ t: now, entries })); } catch {}
    }

    // render per ogni UL del gruppo
    for (const j of group) {
      const items = (entries || [])
        .filter(e => e.type === 'file')
        .filter(e => j.exts.some(ext => (e.name || '').toLowerCase().endsWith(ext)))
        .map(e => {
          // Costruisci URL del sito: SITE_BASE + path relativo del file
          // Es.: https://user.github.io/repo/ + docs/.../file.pdf
          const siteUrl = j.siteBase + e.path.replace(/^\/+/, '');
          return {
            name: e.name,
            url: siteUrl,
            time: e.sha
          };
        })
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

  // pulizia contenitori vuoti (non tocca le section)
  cleanupContainers();

  /* ===== funzioni ===== */

  function renderList(ul, items) {
    ul.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.className = 'file-link';
      a.href = it.url;                     // URL del PDF sul TUO sito
      a.target = '_blank';                 // nuova scheda
      a.rel = 'noopener noreferrer';
      a.removeAttribute('download');       // non forzare download
      a.textContent = it.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

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
      if (node.matches('section')) break; // non rimuovere le section
      node = node.parentElement;
    }
  }

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
