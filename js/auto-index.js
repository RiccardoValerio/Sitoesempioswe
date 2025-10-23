/**
 * Auto-index GitHub folders and render lists.
 * Mostra automaticamente i PDF presenti nel repository GitHub
 * e nasconde completamente le sezioni vuote o mancanti.
 *
 * Funziona con repository pubblici (senza token).
 */

(async () => {
  const lists = Array.from(document.querySelectorAll('.auto-list[data-repo-owner][data-repo-name][data-path]'));
  if (!lists.length) return;

  const CACHE_TTL_MS = 60 * 1000; // 1 min cache
  const now = Date.now();

  for (const ul of lists) {
    const owner = ul.dataset.repoOwner;
    const repo = ul.dataset.repoName;
    const branch = ul.dataset.branch || 'main';
    const path = ul.dataset.path.replace(/^\/+|\/+$/g, ''); // trim slashes
    const exts = (ul.dataset.extensions || '.pdf').split(',').map(s => s.trim().toLowerCase());
    const sort = (ul.dataset.sort || 'name').toLowerCase();
    const order = (ul.dataset.order || 'asc').toLowerCase();

    const cacheKey = `ghls:${owner}/${repo}@${branch}/${path}`;
    let items;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.t && (now - parsed.t) < CACHE_TTL_MS) {
          items = parsed.items;
        }
      }
    } catch {}

    if (!items) {
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const headers = { 'Accept': 'application/vnd.github+json' };

      let resp;
      try {
        resp = await fetch(apiUrl, { headers });
      } catch (e) {
        hideList(ul);
        continue;
      }

      if (!resp.ok) {
        // 404 → la cartella non esiste: rimuoviamo tutto
        if (resp.status === 404) {
          hideList(ul);
          continue;
        }
        hideList(ul);
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
          time: entry.sha
        }));

      // Ordinamento
      items.sort((a, b) => {
        let cmp = sort === 'time'
          ? (a.time || '').localeCompare(b.time || '')
          : a.name.localeCompare(b.name);
        return order === 'desc' ? -cmp : cmp;
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ t: now, items }));
      } catch {}
    }

    // Se la lista è vuota o nulla → rimuovi
    if (!items || !items.length) {
      hideList(ul);
      continue;
    }

    renderList(ul, items);
  }

  /**
   * Crea i <li> dei file
   */
  function renderList(ul, items) {
    ul.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const a = document.createElement('a');
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
   * Nasconde il blocco UL e i genitori vuoti
   */
  function hideList(ul) {
    if (!ul) return;
    const parent = ul.closest('details, .uncat');
    ul.remove();

    // Se il details o uncat non contiene più liste, lo nascondo
    if (parent) {
      const stillHasLists = parent.querySelector('.auto-list');
      if (!stillHasLists) {
        parent.remove();
      }
    }
  }
})();
