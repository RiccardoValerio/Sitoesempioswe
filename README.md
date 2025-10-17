# ATLAS · PD1 — GitHub Pages (scheletro)

Repository base per pubblicare il sito del gruppo **ATLAS** su **GitHub Pages**.

## Deploy
1. Crea una repo **pubblica** (es. `atlas.github.io` oppure `atlas-site`).
2. Carica i file nella **root** della repo.
3. **Settings → Pages → Build and deployment**:  
   - Source: Branch `main`  
   - Folder: `/ (root)`
4. Apri l’URL pubblicato da GitHub.

## Dove mettere i contenuti
- Metti i PDF in `docs/` e sostituisci i segnaposto in `index.html`.
- Il logo si trova in `assets/images/logo.svg`: sostituiscilo quando avete il logo ufficiale.

## Struttura
```
/
├─ index.html
├─ 404.html
├─ assets/
│  ├─ style.css
│  └─ images/
│     └─ logo.svg
└─ docs/
```
