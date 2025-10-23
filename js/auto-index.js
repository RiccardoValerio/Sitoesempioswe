/**
 * Auto-index GitHub folders and render lists (public repos).
 * VERSIONE: mantiene SEMPRE visibili le <section> principali.
 * - Se una cartella è vuota/inesistente: rimuove la <ul.auto-list>.
 * - Se un contenitore (details .accordion o div.uncat) resta senza contenuti: lo rimuove.
 * - NON rimuove le <section> principali (Candidatura, RTB, PB, Presentazione).
 */

(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  // Config
  const CACHE_TTL_MS = 60 * 1000; // 1 min cache
  const REMOVE_EMPTY_SECTIONS = false; // <-- lasciala false per NON rimuovere mai le <section>

  const now = Date.now();

  for (const ul of lists) {
    const owner  = ul.dataset.repoOwner;
    const repo   = ul.dataset.repoName;
    const branch = ul.dataset.branch || 'main';
    const path   = (ul.dataset.path || '').replace(/^\/+|\/+$/g, '');
    const exts   = (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase());
    const sort   = (ul.dataset.sort || 'name').toLowerCase();
    const order  = (ul.dataset.order || 'asc').toLowerCase();

    const cacheKey = `ghls:${owner}/${repo}@${branch}/${path}`;
    let items;

    // Cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.t && (now - parsed.t) < CACHE_TTL_MS) items = parsed.items;
      }
    } catch {}

    // Fetch GitHub
    if (!items) {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const headers = { 'Accept': 'application/vnd.github+json' };

      let resp;
      try {
        resp = await fetch(apiUrl, { headers });
      } catch {
        pruneUp(ul);
        continue;
      }

      if (!resp.ok) {
        pruneUp(ul); // 404 o altro -> rimuovi lista e contenitori vuoti
        continue;
      }

      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data ? [data] : []);

      items = arr
        .filter(e => e.type === 'file')
        .filter(e => {
          const n = (e.name || '').toLowerCase();
          return exts.some(ext => n.endsWith(ext));
        })
        .map(e => ({
          name: e.name,
          url: e.download_url || e.html_url,
          time: e.sha
        }));

      items.sort((a, b) => {
        const cmp = (sort === 'time')
          ? (a.time || '').localeCompare(b.time || '')
          : a.name.localeCompare(b.name);
        return order === 'desc' ? -cmp : cmp;
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ t: now, items }));
      } catch {}
    }

    if (!items || !items.length) {
      pruneUp(ul); // lista vuota -> rimuovi lista e contenitori vuoti, NON la section
      continue;
    }

    renderList(ul, items);
  }

  // Cleanup finale: rimuovi contenitori vuoti (details/uncat); NON rimuovere le section se flag = false
  cleanupAll();

  /* ================== funzioni ================== */

  function renderList(ul, items) {
    ul.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.className = 'file-link';
      a.href = it.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = it.name;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  /**
   * Rimuove la UL e pota i PADRI finché sono vuoti:
   * - <details.accordion> (Documenti/Verbali) e <details.nested>
   * - <div.uncat>
   * NON rimuove mai la <section> se REMOVE_EMPTY_SECTIONS=false
   */
  function pruneUp(startNode) {
    if (!startNode) return;
    const ul = startNode.closest('.auto-list') || startNode;
    if (ul && ul.matches('.auto-list')) ul.remove();

    let node = (ul && ul.parentElement) ? ul.parentElement : null;

    while (node) {
      // Se contenitore intermedio
      if (node.matches('details, .uncat')) {
        if (isContainerEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else break; // ha ancora contenuti
      }

      // Sezione: rimuovi solo se esplicitamente abilitato
      if (node.matches('section')) {
        if (REMOVE_EMPTY_SECTIONS && isSectionEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else {
          break; // non toccare la section
        }
      }

      node = node.parentElement;
    }
  }

  // Un contenitore è vuoto se non ha .auto-list, né link utili, né figli details
  function isContainerEmpty(container) {
    if (!container) return true;
    if (container.querySelector('.auto-list')) return false;
    if (container.querySelector('.file-list a, .list a')) return false;
    // Se è un <details.accordion> (padre) senza <details> figli e senza contenuti linkati -> vuoto
    if (container.matches('details.accordion') && !container.querySelector('details')) return true;
    // Se è un <details.nested> senza <ul> con link -> vuoto
    if (container.matches('details.accordion.nested') && !container.querySelector('.file-list a')) return true;
    // Se è un .uncat senza link -> vuoto
    if (container.matches('.uncat') && !container.querySelector('.uncat-files a, .file-list a')) return true;

    // Se non troviamo nulla di utile, consideralo vuoto
    const hasAnyLink = container.querySelector('a[href]');
    return !hasAnyLink;
  }

  // Una sezione è vuota se non contiene dettagli/uncat NON vuoti né liste con link
  function isSectionEmpty(section) {
    if (!section) return true;
    // Se contiene ancora un details/.uncat con contenuti utili -> non vuota
    const containers = section.querySelectorAll('details, .uncat');
    for (const c of containers) {
      if (!isContainerEmpty(c)) return false;
    }
    // Se ha liste manuali con link -> non vuota
    if (section.querySelector('.list a, .file-list a')) return false;

    return true;
  }

  function cleanupAll() {
    // Rimuovi tutti i details/uncat vuoti (anche a catena)
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

    // Se richiesto, rimuovi anche le section vuote (di default NO)
    if (REMOVE_EMPTY_SECTIONS) {
      document.querySelectorAll('section').forEach(section => {
        if (!document.body.contains(section)) return;
        if (isSectionEmpty(section)) section.remove();
      });
    }
  }
})();
