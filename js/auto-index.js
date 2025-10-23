/**
 * Auto-index GitHub folders and render lists (public repos).
 * - Popola <ul class="auto-list"> in base al contenuto del repo.
 * - Se cartella mancante/vuota -> rimuove la <ul>, poi "potatura" up:
 *   rimuove <details>/<div.uncat> vuoti, e fino alla <section>.
 * - Dopo il rendering, esegue una cleanup globale per rimuovere anche
 *   gli accordion "Documenti"/"Verbali" rimasti vuoti e le sezioni senza contenuti.
 */

(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  // Sezioni che contengono almeno una auto-list prima del fetch
  const sectionsWithAuto = new Set(lists.map(ul => ul.closest('section')).filter(Boolean));

  const CACHE_TTL_MS = 60 * 1000; // 1 min
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

    // Fetch da GitHub se serve
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
        pruneUp(ul); // 404 o altro -> rimuovi e risali
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
          time: e.sha // proxy leggero
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

    // Se vuoto -> rimuovi e risali
    if (!items || !items.length) {
      pruneUp(ul);
      continue;
    }

    // Render lista
    renderList(ul, items);
  }

  // Cleanup globale: elimina accordion "Documenti"/"Verbali" vuoti e sezioni vuote (niente <h2> o altro)
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

  // Rimuove UL e risale: <details>/.uncat -> eventuale details padre -> <section>
  function pruneUp(startNode) {
    if (!startNode) return;
    const ul = startNode.closest('.auto-list') || startNode;
    if (ul && ul.matches('.auto-list')) ul.remove();

    let node = (ul && ul.parentElement) ? ul.parentElement : null;
    while (node) {
      // Se è contenitore intermedio
      if (node.matches('details, .uncat')) {
        if (isContainerEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else break; // ha ancora contenuti
      }
      // Se è sezione
      if (node.matches('section')) {
        if (isSectionEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else break;
      }
      node = node.parentElement;
    }
  }

  // Un contenitore (details/uncat) è vuoto se non ha auto-list, né file-list con link
  function isContainerEmpty(container) {
    if (!container) return true;
    if (container.querySelector('.auto-list')) return false;
    if (container.querySelector('.file-list a')) return false;
    // Se è un <details> "padre" (Documenti/Verbali) e non ha più <details> figli
    if (container.matches('details.accordion') && !container.querySelector('details')) {
      return true;
    }
    return true; // Se non ha niente di utile, è vuoto
  }

  // Una sezione è vuota se non ha contenitori utili né liste con link.
  // (Il semplice <h2> non la salva: viene rimossa insieme al titolo)
  function isSectionEmpty(section) {
    if (!section) return true;
    if (section.querySelector('.auto-list')) return false;
    if (section.querySelector('details, .uncat')) {
      // controlla se ci sono details/uncat NON vuoti
      const containers = section.querySelectorAll('details, .uncat');
      for (const c of containers) {
        if (!isContainerEmpty(c)) return false;
      }
    }
    if (section.querySelector('.list a, .file-list a')) return false;
    return true;
  }

  // Pulisce tutto: rimuove details/uncat vuoti e poi sezioni vuote
  function cleanupAll() {
    // 1) Rimuovi tutti i details/uncat vuoti (anche a catena)
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

    // 2) Rimuovi sezioni vuote (titolo compreso)
    document.querySelectorAll('section').forEach(section => {
      if (!document.body.contains(section)) return;
      if (isSectionEmpty(section)) section.remove();
    });
  }
})();
