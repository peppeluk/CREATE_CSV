const STATE_KEY = "csv_popup_state";
function autosave() {
  const state = {
    fornitore: document.getElementById("fornitore").value,
    codice: document.getElementById("codice").value,
    descrizione: document.getElementById("descrizione").value,
    barcode: document.getElementById("barcode").value,
    costo: document.getElementById("costo").value,
    quantita: document.getElementById("quantita").value,
    prezzo: document.getElementById("prezzo").value
  };
// salvataggio nello storage di Chrome
 // chrome.storage.local.set({ [STATE_KEY]: state });
 // salvataggio con modulo Storage
  Storage.set(STATE_KEY, state);
}
function restore() {
  Storage.get(STATE_KEY, (state) => {
    if (!state) return;

    document.getElementById("fornitore").value   = state.fornitore   || "";
    document.getElementById("codice").value      = state.codice      || "";
    document.getElementById("descrizione").value = state.descrizione || "";
    document.getElementById("barcode").value     = state.barcode     || "";
    document.getElementById("costo").value       = state.costo       || "";
    document.getElementById("quantita").value    = state.quantita    || "";
    document.getElementById("prezzo").value      = state.prezzo      || "";

    update();
  });
}

function resetAll() {
  ["fornitore", "codice", "descrizione", "barcode", "costo", "quantita", "prezzo"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  Storage.remove(STATE_KEY);
  update();
}

// Fusione con DOMContentLoaded precedente - aggiunge file upload
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", handleFileUpload);
}

const applyBtn = document.getElementById("applyMapping");
if (applyBtn) {
  applyBtn.addEventListener("click", applyMapping);
}


function splitDescrizione(text) {
  if (!text || !text.trim()) {
    return { error: "Descrizione vuota" };
  }

  // 1️⃣ normalizzazione caratteri
  let clean = text
    .replace(/[\-_/\t\r\n]/g, " ")   // - _ / tab newline → spazio 
    .replace(/[^\x20-\x7E]/g, " ") // caratteri non stampabili
    .replace(/\s+/g, " ")          // spazi multipli
    .trim();

  if (clean.length > 70) {
   clean = clean.slice(0, 70);
  }
    /*  return { error: "Descrizione oltre 70 caratteri" };
  } */

  // 2️⃣ split in due campi
  let d1 = clean.slice(0, 35);
  let rest = clean.slice(35);

  // 3️⃣ evita parola spezzata
  if (rest.length > 0 && d1[d1.length - 1] !== " ") {
    let lastSpace = d1.lastIndexOf(" ");
    if (lastSpace > -1) {
      rest = d1.slice(lastSpace + 1) + rest;
      d1 = d1.slice(0, lastSpace);
    }
  }

  let d2 = rest.trim().slice(0, 35);

  return {
    d1: d1.trim(),
    d2: d2
  };
}

function parseColumn(text) {
  return text
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(v => v !== "");
}

function parseColumnWithEmpty(text) {
  return text
    .split(/\r?\n/)
    .map(v => v.trim()); 
    // Rimosso .filter(v => v !== "") per mantenere le righe vuote
}

// ============ GESTIONE CARICAMENTO FILE CSV/XLS ============
let fileData = null; // dati caricati dal file
let lookupMap = null; // mappa per barcode da file esterno: codice -> barcode
const REQUIRED_FIELDS = ["codice", "descrizione", "barcode", "costo", "quantita", "prezzo"];

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", handleFileUpload);
  }
  
  const applyBtn = document.getElementById("applyMapping");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyMapping);
  }
});

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  console.log("handleFileUpload: file selected:", file.name);

  if (!file.name.toLowerCase().endsWith(".csv")) {
    alert("Solo file CSV sono supportati.\n\nSe hai un file Excel, convertilo in CSV:\n- In Excel: File → Esporta → CSV\n- Online: usa un convertitore gratuito");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = parseCSV(event.target.result);

      if (data.length === 0) {
        alert("Il file non contiene dati validi.");
        return;
      }

      fileData = data;
      console.log("handleFileUpload: parsed data rows:", data.length, "headers:", Object.keys(data[0] || {}));
      try {
        showMappingUI(data);
      } catch (err) {
        console.error("Errore in showMappingUI:", err);
        alert("Errore durante la creazione dell'interfaccia di mapping: " + err.message);
      }
    } catch (error) {
      console.error("Errore file:", error);
      alert("Errore durante la lettura del file:\n" + error.message);
    }
  };

  reader.onerror = () => {
    alert("Errore durante la lettura del file.");
  };

  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Rileva il delimitatore (comma, semicolon, tab, pipe)
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes("|")) delimiter = "|";

  const headers = firstLine.split(delimiter).map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    data.push(row);
  }

  return data;
}

function showMappingUI(data) {
  console.log("showMappingUI: called, data rows:", data.length);
  const mappingArea = document.getElementById("mappingArea");
  const mappingFields = document.getElementById("mappingFields");
  
  if (!mappingArea || !mappingFields) {
    console.error("showMappingUI: missing mappingArea or mappingFields", { mappingArea, mappingFields });
    alert("Errore: elementi UI per il mapping non trovati nella pagina.");
    return;
  }

  const columns = Object.keys(data[0]);
  mappingFields.innerHTML = "";

  REQUIRED_FIELDS.forEach(field => {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    
    const label = document.createElement("label");
    label.textContent = field + ": ";
    div.appendChild(label);

    // Per 'descrizione' permettiamo due colonne di mapping
    if (field === "descrizione") {
      const select1 = document.createElement("select");
      select1.id = "map_descrizione_1";
      select1.dataset.field = field;

      const opt0_1 = document.createElement("option");
      opt0_1.value = "";
      opt0_1.textContent = "-- Non mappare --";
      select1.appendChild(opt0_1);

      columns.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        if (col.toLowerCase().includes("descr")) opt.selected = true;
        select1.appendChild(opt);
      });

      const spacer = document.createElement("span");
      spacer.textContent = " descrizione 2: ";
      spacer.style.marginLeft = "8px";

      const select2 = document.createElement("select");
      select2.id = "map_descrizione_2";
      select2.dataset.field = field;

      const opt0_2 = document.createElement("option");
      opt0_2.value = "";
      opt0_2.textContent = "-- Non mappare --";
      select2.appendChild(opt0_2);

      columns.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        select2.appendChild(opt);
      });

      div.appendChild(select1);
      div.appendChild(spacer);
      div.appendChild(select2);
      
      // Aggiorna preview quando cambiano i mapping
      select1.addEventListener('change', () => fileData && showPreview(fileData, Object.keys(fileData[0])));
      select2.addEventListener('change', () => fileData && showPreview(fileData, Object.keys(fileData[0])));
      
      mappingFields.appendChild(div);
      return;
    }

    const select = document.createElement("select");
    select.id = "map_" + field;
    select.dataset.field = field;

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- Non mappare --";
    select.appendChild(opt0);

    columns.forEach(col => {
      const opt = document.createElement("option");
      opt.value = col;
      opt.textContent = col;
      // auto-select se il nome è simile
      if (col.toLowerCase().includes(field.toLowerCase())) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    // Se il campo è 'barcode' aggiungiamo anche la possibilità di caricare
    // un file lookup CSV che contiene mappa codice->barcode
    if (field === "barcode") {
      div.appendChild(select);

      const infoSpan = document.createElement("span");
      infoSpan.id = "barcodeLookupInfo";
      infoSpan.style.marginLeft = "8px";
      infoSpan.textContent = "";

      const fileLabel = document.createElement("label");
      fileLabel.textContent = " Carica file lookup: ";
      fileLabel.style.marginLeft = "8px";

      const fileInputLookup = document.createElement("input");
      fileInputLookup.type = "file";
      fileInputLookup.accept = ".csv";
      fileInputLookup.id = "barcodeLookupInput";
      fileInputLookup.style.display = "inline-block";
      fileInputLookup.style.marginLeft = "6px";
      fileInputLookup.style.marginRight = "6px";

      fileInputLookup.addEventListener("change", (evt) => {
        const f = evt.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = parseCSV(ev.target.result);
            if (!data || data.length === 0) {
              alert("Lookup file vuoto o non valido.");
              lookupMap = null;
              infoSpan.textContent = "";
              return;
            }

            // tentativo di identificare colonne: codice e barcode
            const headers = Object.keys(data[0]);
            let codeCol = headers.find(h => /cod/i.test(h) && !/bar|ean|barcode/i.test(h));
            let barcodeCol = headers.find(h => /bar|ean|barcode/i.test(h));
            if (!codeCol) codeCol = headers[0];
            if (!barcodeCol) barcodeCol = headers.length > 1 ? headers[1] : headers[0];

            // crea controlli per scegliere le colonne del lookup
            // rimuovi eventuali controlli precedenti
            const existing = div.querySelector('.lookup-controls');
            if (existing) existing.remove();

            const lookupControls = document.createElement('div');
            lookupControls.className = 'lookup-controls';
            lookupControls.style.display = 'inline-block';
            lookupControls.style.marginLeft = '8px';

            const labelCode = document.createElement('label');
            labelCode.textContent = 'Colonna codice: ';
            const codeSelect = document.createElement('select');
            codeSelect.id = 'lookup_code_col';
            headers.forEach(h => {
              const o = document.createElement('option');
              o.value = h; o.textContent = h;
              if (h === codeCol) o.selected = true;
              codeSelect.appendChild(o);
            });

            const labelBar = document.createElement('label');
            labelBar.textContent = ' Colonna barcode: ';
            labelBar.style.marginLeft = '8px';
            const barSelect = document.createElement('select');
            barSelect.id = 'lookup_barcode_col';
            headers.forEach(h => {
              const o = document.createElement('option');
              o.value = h; o.textContent = h;
              if (h === barcodeCol) o.selected = true;
              barSelect.appendChild(o);
            });

            lookupControls.appendChild(labelCode);
            lookupControls.appendChild(codeSelect);
            lookupControls.appendChild(labelBar);
            lookupControls.appendChild(barSelect);
            div.appendChild(lookupControls);

            // Aggiorna preview quando cambiano i mapping barcode lookup
            select.addEventListener('change', () => fileData && showPreview(fileData, Object.keys(fileData[0])));

            // Funzione per rigenerare la preview con i colori aggiornati
            function updateLookupPreview(selectedCodeCol, selectedBarcodeCol) {
              // Rimuovi preview precedente
              const existing_preview = div.querySelector('.lookup-preview');
              if (existing_preview) existing_preview.remove();

              const lookupPreview = document.createElement('div');
              lookupPreview.className = 'lookup-preview';
              lookupPreview.style.marginTop = '8px';
              lookupPreview.style.display = 'block';

              const previewTitle = document.createElement('strong');
              previewTitle.textContent = 'Anteprima lookup (prime 3 righe):';
              previewTitle.style.display = 'block';
              previewTitle.style.marginBottom = '4px';
              lookupPreview.appendChild(previewTitle);

              const table = document.createElement('table');
              table.style.borderCollapse = 'collapse';
              table.style.fontSize = '12px';

              // Header - mostra TUTTE le colonne
              const headerRow = document.createElement('tr');
              headers.forEach(colName => {
                const th = document.createElement('th');
                th.textContent = colName;
                th.style.border = '1px solid #ccc';
                th.style.padding = '3px 5px';
                th.style.backgroundColor = '#f0f0f0';
                // Evidenzia le colonne selezionate (con i nuovi valori)
                if (colName === selectedCodeCol || colName === selectedBarcodeCol) {
                  th.style.backgroundColor = '#ffffcc';
                  th.style.fontWeight = 'bold';
                }
                headerRow.appendChild(th);
              });
              table.appendChild(headerRow);

              // Prime 3 righe - mostra TUTTE le colonne
              for (let i = 0; i < Math.min(3, data.length); i++) {
                const row = document.createElement('tr');
                headers.forEach(colName => {
                  const td = document.createElement('td');
                  td.textContent = data[i][colName] || '';
                  td.style.border = '1px solid #ccc';
                  td.style.padding = '3px 5px';
                  // Evidenzia i valori delle colonne selezionate (con i nuovi valori)
                  if (colName === selectedCodeCol || colName === selectedBarcodeCol) {
                    td.style.backgroundColor = '#ffffcc';
                  }
                  row.appendChild(td);
                });
                table.appendChild(row);
              }

              lookupPreview.appendChild(table);
              div.appendChild(lookupPreview);
            }

            // funzione per (ri)costruire la mappa in base alle colonne selezionate
            function buildLookupMap(selectedCodeCol, selectedBarcodeCol) {
              const map = {};
              data.forEach(r => {
                const key = (r[selectedCodeCol] || '').toString().trim();
                const val = (r[selectedBarcodeCol] || '').toString().trim();
                if (key) map[key] = val;
              });
              lookupMap = map;
              infoSpan.textContent = `Lookup caricato: ${Object.keys(map).length} righe (code:${selectedCodeCol}, barcode:${selectedBarcodeCol})`;
              // Aggiorna preview con i nuovi colori
              updateLookupPreview(selectedCodeCol, selectedBarcodeCol);
            }

            // costruisci mappa iniziale
            buildLookupMap(codeCol, barcodeCol);

            // aggiorna mappa e preview se l'utente cambia selezione
            codeSelect.addEventListener('change', () => buildLookupMap(codeSelect.value, barSelect.value));
            barSelect.addEventListener('change', () => buildLookupMap(codeSelect.value, barSelect.value));
          } catch (err) {
            console.error(err);
            alert("Errore parsing lookup: " + err.message);
            lookupMap = null;
            infoSpan.textContent = "";
          }
        };
        reader.onerror = () => {
          alert("Errore nella lettura del file lookup.");
        };
        reader.readAsText(f);
      });

      div.appendChild(fileLabel);
      div.appendChild(fileInputLookup);
      infoSpan.style.display = "inline-block";
      infoSpan.style.marginLeft = "6px";
      div.appendChild(infoSpan);
      mappingFields.appendChild(div);
      return;
    }

    div.appendChild(select);
    mappingFields.appendChild(div);

    // Aggiorna preview quando cambia il mapping
    if (field !== "descrizione" && field !== "barcode") {
      select.addEventListener('change', () => fileData && showPreview(fileData, Object.keys(fileData[0])));
    }
  });

  // Stile per layout normale
  mappingArea.style.display = "block";
  
  // Mostra preview
  showPreview(data, columns);
}

function showPreview(data, columns) {
  const previewArea = document.getElementById("filePreview");
  const previewHead = document.getElementById("previewHead");
  const previewBody = document.getElementById("previewBody");
  
  if (!previewArea) return;

  // Palette di colori per i campi mappati
  const colorMap = {
    codice: '#e3f2fd',      // blu chiaro
    descrizione: '#f3e5f5', // viola chiaro
    barcode: '#fce4ec',     // rosa chiaro
    costo: '#e8f5e9',       // verde chiaro
    quantita: '#fff3e0',    // arancione chiaro
    prezzo: '#fef5e7'       // giallo chiaro
  };

  // Leggi i mapping attuali
  const mapping = {};
  REQUIRED_FIELDS.forEach(field => {
    if (field === "descrizione") {
      const sel1 = document.getElementById("map_descrizione_1");
      const sel2 = document.getElementById("map_descrizione_2");
      if (sel1 || sel2) {
        mapping[field] = [sel1?.value || "", sel2?.value || ""];
      }
    } else {
      const select = document.getElementById("map_" + field);
      if (select && select.value) {
        mapping[field] = select.value;
      }
    }
  });

  // Header
  previewHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    th.style.border = "1px solid #ccc";
    th.style.padding = "5px";
    th.style.backgroundColor = "#f0f0f0";
    th.style.fontSize = "12px";

    // Evidenzia le colonne mappate con colore diverso per ogni campo
    Object.keys(mapping).forEach(field => {
      const fieldMapping = mapping[field];
      if (Array.isArray(fieldMapping)) {
        // Per descrizione (array)
        if (fieldMapping.includes(col)) {
          th.style.backgroundColor = colorMap[field];
          th.style.fontWeight = "bold";
        }
      } else {
        // Per altri campi (string)
        if (fieldMapping === col) {
          th.style.backgroundColor = colorMap[field];
          th.style.fontWeight = "bold";
        }
      }
    });

    headerRow.appendChild(th);
  });
  previewHead.appendChild(headerRow);

  // Prime 5 righe
  previewBody.innerHTML = "";
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = document.createElement("tr");
    columns.forEach(col => {
      const td = document.createElement("td");
      td.textContent = data[i][col] || "";
      td.style.border = "1px solid #ccc";
      td.style.padding = "5px";
      td.style.fontSize = "12px";

      // Evidenzia i valori delle colonne mappate
      Object.keys(mapping).forEach(field => {
        const fieldMapping = mapping[field];
        if (Array.isArray(fieldMapping)) {
          if (fieldMapping.includes(col)) {
            td.style.backgroundColor = colorMap[field];
          }
        } else {
          if (fieldMapping === col) {
            td.style.backgroundColor = colorMap[field];
          }
        }
      });

      row.appendChild(td);
    });
    previewBody.appendChild(row);
  }

  previewArea.style.display = "block";
}

function applyMapping() {
  if (!fileData || fileData.length === 0) {
    alert("Nessun file caricato.");
    return;
  }

  const mapping = {};
  let hasMappings = false;

  REQUIRED_FIELDS.forEach(field => {
    if (field === "descrizione") {
      const sel1 = document.getElementById("map_descrizione_1");
      const sel2 = document.getElementById("map_descrizione_2");
      const s1 = sel1 ? sel1.value : "";
      const s2 = sel2 ? sel2.value : "";
      if (s1 || s2) {
        mapping[field] = [s1, s2];
        hasMappings = true;
      }
    } else {
      const select = document.getElementById("map_" + field);
      const sourceCol = select ? select.value : "";
      if (sourceCol) {
        mapping[field] = sourceCol;
        hasMappings = true;
      }
    }
  });

  if (!hasMappings) {
    alert("Seleziona almeno una colonna.");
    return;
  }

  // Popola i textarea
  const result = {};
  Object.keys(mapping).forEach(field => {
    if (field === "descrizione") {
      const [col1, col2] = mapping[field];
      result[field] = fileData.map(row => {
        const v1 = col1 ? (row[col1] || "") : "";
        const v2 = col2 ? (row[col2] || "") : "";
        const combined = [v1.trim(), v2.trim()].filter(v => v !== "").join(" ");
        return combined;
      }).join("\n");
    } else {
      result[field] = fileData.map(row => row[mapping[field]] || "").join("\n");
    }
  });

  // Se non è stata mappata la colonna 'barcode' ma è stato caricato un lookup,
  // proviamo a popolare il campo barcode usando la mappa e il valore codice.
  if (!result.barcode && lookupMap) {
    const codiceMap = mapping['codice'] || null;
    result['barcode'] = fileData.map(row => {
      const codeVal = codiceMap ? (row[codiceMap] || "") : (row['codice'] || "");
      return lookupMap[codeVal] || "";
    }).join("\n");
  }

  // Scrivi negli input
  Object.keys(result).forEach(field => {
    const el = document.getElementById(field);
    if (el) {
      el.value = result[field];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  alert("Mappatura applicata! Controlla i dati e genera il CSV.");
  
  // Nascondi l'area di mapping
  document.getElementById("mappingArea").style.display = "none";
  document.getElementById("filePreview").style.display = "none";
  document.getElementById("fileInput").value = "";
}

const fields = ["codice", "descrizione", "barcode", "costo", "quantita","prezzo"];

fields.forEach(id => {
  document.getElementById(id).addEventListener("input", update);
});

function update() {
  // colonne per-riga
  const columns = {
    codice: parseColumnWithEmpty(document.getElementById("codice").value),
    descrizione: parseColumnWithEmpty(document.getElementById("descrizione").value),
    barcode: parseColumnWithEmpty(document.getElementById("barcode").value),
    costo: parseColumnWithEmpty(document.getElementById("costo").value),
    quantita: parseColumnWithEmpty(document.getElementById("quantita").value),
    prezzo: parseColumnWithEmpty(document.getElementById("prezzo").value)
  };

  // numero righe
  //defnisco colonne da controllare (conta solo valori non vuoti)
  const colonnedaControllareNonVuote = {
    codice: columns.codice.filter(v => v !== ""),
    descrizione: columns.descrizione.filter(v => v !== "")
  };
  const counts = Object.values(colonnedaControllareNonVuote).map(col => col.length);
  const max = counts.length > 0 ? Math.max(...counts) : 0;

  // info righe
  document.getElementById("righeInfo").textContent =
    "Righe rilevate: " + max;

  // verifica allineamento colonne
  const allEqual = counts.every(c => c === max);

  // validazione descrizioni (solo righe non vuote)
  let descrErrors = 0;
  columns.descrizione.filter(v => v !== "").forEach((line, idx) => {
    const res = splitDescrizione(line);
    if (res.error) {
      descrErrors++;
      console.warn(`Descrizione riga ${idx + 1}: ${res.error}`);
    }
  });

  /* // validazione costo (base)
  let costErrors = 0;
  columns.costo.forEach((v, idx) => {
    if (v !== "" && isNaN(v.replace(",", "."))) {
  costErrors++;
}

   /*  if (v === "" || isNaN(v.replace(",", "."))) {
      costErrors++; */
     // console.warn(`Costo riga ${idx + 1}: valore non numerico`);
//  }); */
   

  // campo globale
  const fornitoreOk =
    document.getElementById("fornitore").value.trim() !== "";

  // abilita/disabilita genera CSV
  document.getElementById("genera").disabled =
    !allEqual ||
    max === 0 ||
    descrErrors > 0 ||
    //costErrors > 0 ||
    !fornitoreOk;

    // abilita/disabilita genera CSV ordine fornitore
  document.getElementById("genera_ordine").disabled =
    !allEqual ||
    max === 0 ||
    descrErrors > 0 ||
    //quantitaErrors > 0 ||
    //costErrors > 0 ||
    !fornitoreOk;

    // abilita/disabilita genera CSV listino di vendita
  document.getElementById("genera_listino").disabled =
    !allEqual ||
    max === 0 ||
    descrErrors > 0 ||
    //prezzoErrors > 0 ||
    !fornitoreOk;
}

// blocco inizializzazione DOM
document.addEventListener("DOMContentLoaded", () => {

  // ripristino stato
  restore();

  // aggancio eventi input
  ["codice", "descrizione", "barcode", "costo", "fornitore","quantita", "prezzo"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          autosave();
          update();
        });
      }
    });

  // bottone genera
  document.getElementById("genera")
    .addEventListener("click", generaCSV);

  // bottone genera ordine fornitore
  document.getElementById("genera_ordine")
  .addEventListener("click", generaCSVOrdineFornitore);

  // bottone genera listino di vendita
  document.getElementById("genera_listino")
  .addEventListener("click", generaCSVlistino);

  // bottone reset
  document.getElementById("reset")
    .addEventListener("click", resetAll);
});

function showFinalPreview(csvType) {
  // Leggi i dati dai textarea
  const fornitore = document.getElementById("fornitore").value.trim();
  const codice = parseColumnWithEmpty(document.getElementById("codice").value);
  const descrizioni = parseColumnWithEmpty(document.getElementById("descrizione").value);
  const barcode = parseColumnWithEmpty(document.getElementById("barcode").value);
  const costo = parseColumnWithEmpty(document.getElementById("costo").value);
  const quantita = parseColumnWithEmpty(document.getElementById("quantita").value);
  const prezzo = parseColumnWithEmpty(document.getElementById("prezzo").value);

  const rows = codice.length;
  const today = new Date().toLocaleDateString("it-IT");

  // Crea overlay per preview
  const overlay = document.createElement('div');
  overlay.id = 'previewOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';

  // Container modale
  const modal = document.createElement('div');
  modal.style.backgroundColor = 'white';
  modal.style.borderRadius = '8px';
  modal.style.padding = '20px';
  modal.style.maxWidth = '90%';
  modal.style.maxHeight = '80vh';
  modal.style.overflowY = 'auto';
  modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.2)';

  // Titolo
  const title = document.createElement('h3');
  title.textContent = `Anteprima CSV - ${csvType}`;
  title.style.marginTop = '0';
  title.style.marginBottom = '15px';
  modal.appendChild(title);

  // Tabella
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '13px';
  table.style.marginBottom = '15px';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.style.backgroundColor = '#f0f0f0';

  let headerCells = [];
  if (csvType === 'Importazione Articoli') {
    headerCells = ['CODICE', 'DESC 1', 'DESC 2', 'BARCODE', 'COSTO'];
  } else if (csvType === 'Ordine Fornitore') {
    headerCells = ['RIGA', 'CODICE', 'QUANTITA', 'FORNITORE'];
  } else if (csvType === 'Listino Vendita') {
    headerCells = ['CODICE', 'PREZZO'];
  }

  headerCells.forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell;
    th.style.border = '1px solid #ddd';
    th.style.padding = '8px';
    th.style.textAlign = 'left';
    th.style.fontWeight = 'bold';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('tr');
    if (i % 2 === 0) row.style.backgroundColor = '#f9f9f9';

    if (csvType === 'Importazione Articoli') {
      const desc = splitDescrizione(descrizioni[i]);
      const costValue = (costo[i] && costo[i].trim() !== "") ? String(costo[i]).replace(/\./g, ",") : "0";

      [codice[i], desc.d1, desc.d2, barcode[i] || '', costValue].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px';
        row.appendChild(td);
      });
    } else if (csvType === 'Ordine Fornitore') {
      const quantValue = (quantita[i] && quantita[i].trim() !== "") ? String(quantita[i]).replace(/\./g, ",") : "0";

      [i + 1, codice[i], quantValue, fornitore].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px';
        row.appendChild(td);
      });
    } else if (csvType === 'Listino Vendita') {
      const priceValue = (prezzo[i] && prezzo[i].trim() !== "") ? String(prezzo[i]).replace(/\./g, ",") : "0";

      [codice[i], priceValue].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.border = '1px solid #ddd';
        td.style.padding = '8px';
        row.appendChild(td);
      });
    }

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  modal.appendChild(table);

  // Info riga
  const info = document.createElement('p');
  info.textContent = `Totale righe: ${rows}`;
  info.style.fontSize = '13px';
  info.style.color = '#666';
  info.style.margin = '10px 0';
  modal.appendChild(info);

  // Pulsanti
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.justifyContent = 'flex-end';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annulla';
  cancelBtn.style.padding = '8px 16px';
  cancelBtn.style.backgroundColor = '#f0f0f0';
  cancelBtn.style.border = '1px solid #ccc';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Scarica CSV';
  downloadBtn.style.padding = '8px 16px';
  downloadBtn.style.backgroundColor = '#4CAF50';
  downloadBtn.style.color = 'white';
  downloadBtn.style.border = 'none';
  downloadBtn.style.borderRadius = '4px';
  downloadBtn.style.cursor = 'pointer';
  downloadBtn.style.fontWeight = 'bold';
  downloadBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    // Procedi con la generazione del CSV
    if (csvType === 'Importazione Articoli') {
      generateCSVFile('articoli');
    } else if (csvType === 'Ordine Fornitore') {
      generateCSVFile('ordine');
    } else if (csvType === 'Listino Vendita') {
      generateCSVFile('listino');
    }
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(downloadBtn);
  modal.appendChild(buttonContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function generateCSVFile(type) {
  const today = new Date().toLocaleDateString("it-IT");
  const hour = String(new Date().getHours()).padStart(2, '0');
  const minute = String(new Date().getMinutes()).padStart(2, '0');
  const second = String(new Date().getSeconds()).padStart(2, '0');
  const Time = ` ${hour}:${minute}:${second}`;

  const fornitore = document.getElementById("fornitore").value.trim();
  const codice = parseColumnWithEmpty(document.getElementById("codice").value);
  const descrizioni = parseColumnWithEmpty(document.getElementById("descrizione").value);
  const barcode = parseColumnWithEmpty(document.getElementById("barcode").value);
  const costo = parseColumnWithEmpty(document.getElementById("costo").value);
  const quantita = parseColumnWithEmpty(document.getElementById("quantita").value);
  const prezzo = parseColumnWithEmpty(document.getElementById("prezzo").value);

  const rows = codice.length;
  let output = [];

  if (type === 'articoli') {
    output.push([
      "CODICE ARTICOLO","COD. PROD.","DESCRIZIONE 1","DESCRIZIONE 2",
      "GRUPPO MERCEOLOGICO","SETTORE","FAMIGLIA","GENERE","MARCA","MODELLO",
      "COD. CAPOFILA (LASCIARE VUOTO)","CODICE FORNITORE","ARTICOLO COLLEGATO",
      "V (tipo val)","COEFF.","INIZ. VAL.","FINE VAL.","ARTICOLI COMPATIBILI",
      "F","COD. FORNITORE","COD. ALTERNATIVO","stato","CODICE A BARRE",
      "CODICE IVA","QTA X CONF","UNI MIS","Costo","NOTE",
      "QUANTITA MIN. ORDINABILE IN ACQ.","TIPO C/F (artds_cftp)",
      "CODICE CLI/FOR X DES.AGG.","LINGUA DES.AGG.(lingua)",
      "DESCRIZIONE AGG.","TIPO ARTICOLO",
      "UNITA DI MISURA DEL PESO","PESO NETTO","PESO LORDO",
      "UNITA DI MISURA ALT. DI ACQ.","FATTORE DI CONVERS. BASE/ACQ.",
      "UNITA DI MISURA TECNICA","FATTORE DI CONVERS. BASE/TECNICA",
      "LOTTO MULTIPLO DI ACQUISTO","QUANTITA MINIMA DI VENDITA",
      "LOTTO MULTIPLO DI VENDITA","PUBBLICA (S/N)","LOTTI (S/N)"
    ].join("|"));

    for (let i = 0; i < rows; i++) {
      const desc = splitDescrizione(descrizioni[i]);
      const costValue = (costo[i] && costo[i].trim() !== "") ? String(costo[i]).replace(/\./g, ",") : 0;

      const line = [
        codice[i], "", desc.d1, desc.d2, "999", "998", ".", ".", ".", ".",
        "", fornitore, "", "", "0", today, "31/12/2050", "", "F", fornitore,
        "", "", barcode[i] || "", "", "1", "NR", costValue, "", "0", "F",
        "0", "1", "", "P", "KG", "0", "0", "NR", "1", "NR", "1",
        "0", "0", "0", "S", "N"
      ];
      output.push(line.join("|"));
    }

    const blob = new Blob([output.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "articoli_" + Time + ".csv";
    link.click();

  } else if (type === 'ordine') {
    output.push(["RIGA", "CODICE ARTICOLO", "QUANTITA ORDINE", "CODICE FORNITORE"].join("|"));

    for (let i = 0; i < rows; i++) {
      const quantValue = (quantita[i] && quantita[i].trim() !== "") ? String(quantita[i]).replace(/\./g, ",") : 0;
      output.push([i + 1, codice[i], quantValue, fornitore].join("|"));
    }

    const blob = new Blob([output.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ordine_" + Time + ".csv";
    link.click();

  } else if (type === 'listino') {
    output.push([
      "CODICE ART", "DESCR", "PREZZO", "COD.BAR", "NETTO", "SC1", "SC2", "SC3", "SCS",
      "TIPO CLIFOR", "COD CLIFOR", "MARCA", "MODELLO", "GENERE", "FAMIGLIA", "SETTORE",
      "LISTINO ID", "SETT.GEST", "CODCLI", "DATA INIZIO VAL", "QTA", "FLAG NETTI"
    ].join("|"));

    for (let i = 0; i < rows; i++) {
      const priceValue = (prezzo[i] && prezzo[i].trim() !== "") ? String(prezzo[i]).replace(/\./g, ",") : 0;
      const line = [
        codice[i], "", priceValue, "", "0", "0", "0", "0", "", "C", "0",
        ".", ".", ".", ".", "0", "1", "0", "0", today, "0", "N"
      ];
      output.push(line.join("|"));
    }

    const blob = new Blob([output.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "listino_" + Time + ".csv";
    link.click();
  }
}

function generaCSV() {
  const conferma = confirm("Vuoi scaricare CSV importazione articoli?");
  if (!conferma) {
    console.log("Download CSV annullato dall'utente");
    return;
  }
  showFinalPreview('Importazione Articoli');
}
/////genera CSV ordine fornitore
function generaCSVOrdineFornitore() {
  const conferma = confirm("Vuoi scaricare file importazione ordine fornitore?");
  if (!conferma) {
    console.log("Download CSV annullato dall'utente");
    return;
  }
  showFinalPreview('Ordine Fornitore');
}

  //genera CSV listino di vendita
function generaCSVlistino() {
  const conferma = confirm("Vuoi scaricare file importazione listino di vendita?");
  if (!conferma) {
    console.log("Download CSV annullato dall'utente");
    return;
  }
  showFinalPreview('Listino Vendita');
}
/*document.addEventListener("DOMContentLoaded", () => {
  Storage.get("formData", data => {
    if (!data) return;

    fornitore.value   = data.fornitore   ?? "";
    codice.value      = data.codice      ?? "";
    descrizione.value = data.descrizione ?? "";
    barcode.value     = data.barcode     ?? "";
    costo.value       = data.costo       ?? "";
    quantita.value    = data.quantita    ?? "";
    prezzo.value      = data.prezzo      ?? "";

    update();
  });
});
*/

