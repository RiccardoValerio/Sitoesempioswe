/**
 * Auto-index GitHub folders and render lists.
 * - Popola <ul class="auto-list"> dai contenuti del repo (public).
 * - Se la cartella non esiste o non contiene file attesi -> nasconde la <ul>.
 * - Propaga la "potatura" ai contenitori padre: <details>, .uncat e fino alla <section>.
 */

(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  // Tracciamo quali <section> contengono almeno un'auto-list (prima del fetch)
  const sectionsWithAuto = new Set(
    lists.map(ul => ul.closest('section')).filter(Boolean)
  );

  const CACHE_TTL_MS = 60 * 1000; // 1 min cache
  const now = Date.now();

  for (const ul of lists) {
    const owner  = ul.dataset.repoOwner;
    const repo   = ul.dataset.repoName;
    const branch = ul.dataset.branch || 'main';
    const path   = (ul.dataset.path || '').replace(/^\/+|\/+$/g, ''); // trim slashes
    const exts   = (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase());
    const sort   = (ul.dataset.sort || 'name').toLowerCase();
    const order  = (ul.dataset.order || 'asc').toLowerCase();

    const cacheKey = `ghls:${owner}/${repo}@${branch}/${path}`;
    let items;

    // 1) Cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.t && (now - parsed.t) < CACHE_TTL_MS) {
          items = parsed.items;
        }
      }
    } catch {}

    // 2) Fetch se non in cache
    if (!items) {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const headers = { 'Accept': 'application/vnd.github+json' };

      let resp;
      try {
        resp = await fetch(apiUrl, { headers });
      } catch {
        pruneUp(ul); // errore rete -> rimuovi e pota i padri
        continue;
      }

      if (!resp.ok) {
        // 404: cartella inesistente -> rimuovi e pota
        pruneUp(ul);
        continue;
      }

      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data ? [data] : []);

      items = arr
        .filter(entry => entry.type === 'file')
        .filter(entry => {
          const name = (entry.name || '').toLowerCase();
          return exts.some(ext => name.endsWith(ext));
        })
        .map(entry => ({
          name: entry.name,
          url: entry.download_url || entry.html_url,
          time: entry.sha // proxy leggero, evita una request extra
        }));

      // Ordinamento
      items.sort((a, b) => {
        let cmp = (sort === 'time')
          ? (a.time || '').localeCompare(b.time || '')
          : a.name.localeCompare(b.name);
        return order === 'desc' ? -cmp : cmp;
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ t: now, items }));
      } catch {}
    }

    // 3) Se vuoto -> rimuovi e pota i padri; altrimenti render
    if (!items || !items.length) {
      pruneUp(ul);
      continue;
    }
    renderList(ul, items);
  }

  // 4) Passo finale: se una <section> che prima aveva auto-list ora non contiene più nulla di utile, nascondila
  for (const section of sectionsWithAuto) {
    if (!section || !document.body.contains(section)) continue;
    if (isSectionEmpty(section)) {
      section.remove();
    }
  }

  /* ---------- funzioni di utilità ---------- */

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
   * Rimuove la <ul> vuota e pota ricorsivamente i contenitori padre:
   * - Se un <details> o .uncat non contiene più auto-list -> rimuovi quel contenitore.
   * - Continua a salire finché serve; se arrivi a <section> e risulta vuota -> rimuovi la sezione.
   */
  function pruneUp(startNode) {
    if (!startNode) return;

    // Rimuovi la UL
    const ul = startNode.closest('.auto-list') || startNode;
    if (ul && ul.matches('.auto-list')) ul.remove();

    // Sali ricorsivamente
    let node = (ul && ul.parentElement) ? ul.parentElement : null;

    while (node) {
      // Se è un contenitore di livello intermedio
      if (node.matches('details, .uncat')) {
        // Se non ha più auto-list discendenti, rimuovilo
        if (!node.querySelector('.auto-list')) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else {
          // Ha ancora contenuti, puoi fermarti
          break;
        }
      }

      // Se è la sezione
      if (node.matches('section')) {
        if (isSectionEmpty(node)) {
          const next = node.parentElement;
          node.remove();
          node = next;
          continue;
        } else {
          break;
        }
      }

      node = node.parentElement;
    }
  }

  /**
   * Una sezione è "vuota" se non contiene:
   * - alcun .auto-list,
   * - né contenitori di documenti utili (.accordion, .uncat),
   * - né liste manuali (.list, .file-list) con link.
   * Il titolo <h2> da solo non basta a tenerla.
   */
  function isSectionEmpty(section) {
    if (!section) return true;

    // Se ci sono ancora liste auto o contenitori di documenti, NON è vuota
    if (section.querySelector('.auto-list')) return false;
    if (section.querySelector('.accordion, .uncat')) return false;

    // Se ci sono liste manuali con link file, NON è vuota
    if (section.querySelector('.list a, .file-list a')) return false;

    // Altrimenti, considerala vuota
    return true;
  }
})();
