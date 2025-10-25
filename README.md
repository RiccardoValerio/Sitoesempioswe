🌐 Sito del Gruppo Atlas – Progetto SWE 2025/2026

Questo repository contiene il sito statico del gruppo Atlas per il progetto di Ingegneria del Software dell’Università di Padova.

Il sito è costruito con Jekyll + GitHub Pages e si aggiorna automaticamente ogni volta che vengono caricate nuove versioni o modifiche.

⚙️ Come funziona

Il sito mostra in modo automatico tutti i documenti contenuti nelle cartelle della directory docs/.

Non serve modificare manualmente l’HTML: ogni sezione viene generata leggendo la configurazione del file _data/sections.yml.

Quando vengono aggiunti nuovi file o cambiano le cartelle, il sito si rigenera automaticamente dopo il salvataggio e il caricamento su GitHub.

✏️ Come aggiornare o modificare il sito
🔹 1. Aggiungere nuovi documenti

Inserisci i file PDF, ZIP o di altro formato nelle cartelle corrette all’interno della directory docs/.
Ad esempio:

I documenti del Product Baseline vanno in docs/pb/documenti/...

I verbali della RTB vanno in docs/rtb/verbali/...

Dopo averli caricati nella repository, il sito si aggiorna automaticamente e li mostrerà nelle sezioni corrispondenti.

Se una cartella è vuota, non viene mostrata nel sito (le sezioni vuote si nascondono automaticamente).

🔹 2. Rinominare o spostare cartelle

Se cambi il nome di una cartella (per esempio da documenti a doc), aggiorna anche il percorso corrispondente nel file _data/sections.yml.

Ogni sezione ha un campo dir: che indica il percorso della cartella da leggere.

Assicurati che il nuovo nome del percorso coincida esattamente con il nome della cartella all’interno di docs/.

Dopo aver salvato la modifica e aggiornato i file su GitHub, il sito verrà ricostruito automaticamente.

🔹 3. Aggiungere o rimuovere tipi di file

Ogni sezione può essere configurata per mostrare solo determinati tipi di file (ad esempio .pdf, .md, .zip).

Nel file _data/sections.yml, nel campo exts: puoi aggiungere o rimuovere i tipi di file che vuoi visualizzare.
Esempio:

exts: "pdf,zip"


Dopo aver salvato la modifica, il sito mostrerà automaticamente anche i nuovi tipi di file.

🔹 4. Aggiungere o rimuovere sezioni

Tutte le sezioni (PB, RTB, Candidatura, Presentazione, ecc.) sono definite nel file _data/sections.yml.

Se vuoi aggiungere una nuova sezione:

Crea una nuova cartella dentro docs/ con la struttura desiderata.

Aggiungi un nuovo blocco nel file _data/sections.yml con il nome (id:), il titolo (title:) e le cartelle da leggere (dir:).

Se vuoi eliminare una sezione o una sottosezione, basta rimuovere il blocco corrispondente dal file YAML.

Quando aggiorni il file e carichi le modifiche, il sito viene rigenerato con la nuova struttura.

🔹 5. Cambiare l’ordine delle sezioni

Le sezioni vengono visualizzate nell’ordine in cui sono elencate nel file _data/sections.yml.

Per cambiare l’ordine, sposta il blocco della sezione (ad esempio PB, RTB, Candidatura, ecc.) più in alto o più in basso nel file.

🎨 Personalizzazione grafica

Lo stile del sito si trova nel file css/style.css.

Puoi modificare i colori, i font e l’aspetto delle sezioni in base alle preferenze del gruppo.

🧠 Suggerimenti di manutenzione
Operazione	Dove intervenire	Cosa succede
Aggiungere documenti	Cartelle in docs/	Il sito mostra i nuovi file
Rinominare cartella	Cartella + _data/sections.yml	Aggiorna il percorso
Aggiungere tipo file	_data/sections.yml	Mostra nuovi formati
Aggiungere o togliere sezione	_data/sections.yml	Cambia la struttura
Cambiare ordine sezioni	_data/sections.yml	Riorganizza le sezioni
Modificare grafica	css/style.css	Cambia lo stile del sito

🔄 Aggiornamento del sito su GitHub Pages

Il sito è pubblicato automaticamente da GitHub Pages.

Dopo ogni aggiornamento (nuovi file, modifiche al YAML o al CSS), GitHub ricostruisce il sito in pochi minuti.

Non serve alcuna azione manuale per la pubblicazione.

🧾 Licenza e crediti

© 2025–2026 Gruppo Atlas — Tutti i diritti riservati.
Configurazione e struttura adattate per il corso di Ingegneria del Software – Università di Padova (A.A. 2025/2026).