const STATE_KEY = "csv_popup_state";
function autosave() {
  const state = {
    fornitore: document.getElementById("fornitore").value,
    codice: document.getElementById("codice").value,
    descrizione: document.getElementById("descrizione").value,
    barcode: document.getElementById("barcode").value,
    costo: document.getElementById("costo").value,
    quantita: document.getElementById("quantita").value
  };
/* document.addEventListener("DOMContentLoaded", restore);
 */
  chrome.storage.local.set({ [STATE_KEY]: state });
}
function restore() {
  chrome.storage.local.get(STATE_KEY, (data) => {
    if (!data[STATE_KEY]) return;

    const s = data[STATE_KEY];

    document.getElementById("fornitore").value = s.fornitore || "";
    document.getElementById("codice").value = s.codice || "";
    document.getElementById("descrizione").value = s.descrizione || "";
    document.getElementById("barcode").value = s.barcode || "";
    document.getElementById("costo").value = s.costo || "";
    document.getElementById("quantita").value = s.quantita || "";  

    update();
  });
}

// blocco inizializzazione DOM
document.addEventListener("DOMContentLoaded", () => {

  // ripristino stato
  restore();

  // aggancio eventi input
  ["codice", "descrizione", "barcode", "costo", "fornitore","quantita"]
    .forEach(id => {
      document.getElementById(id).addEventListener("input", () => {
        autosave();
        update();
      });
    });

  // bottone genera
  document.getElementById("genera")
    .addEventListener("click", generaCSV);

  // bottone genera ordine fornitore
  document.getElementById("genera_ordine")
  .addEventListener("click", generaCSVOrdineFornitore);

  // bottone reset
  document.getElementById("reset")
    .addEventListener("click", () => {
      chrome.storage.local.remove(STATE_KEY);
      ["fornitore","codice","descrizione","barcode","costo", "quantita"]
        .forEach(id => document.getElementById(id).value = "");
      update();
    });

});


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

const fields = ["codice", "descrizione", "barcode", "costo", "quantita"];

fields.forEach(id => {
  document.getElementById(id).addEventListener("input", update);
});

function update() {
  // colonne per-riga
  const columns = {
    codice: parseColumn(document.getElementById("codice").value),
    descrizione: parseColumn(document.getElementById("descrizione").value),
    barcode: parseColumn(document.getElementById("barcode").value),
    costo: parseColumn(document.getElementById("costo").value),
    quantita: parseColumn(document.getElementById("quantita").value)  
  };

  // numero righe
  //defnisco colonne da controllare
  const colonnedaControllare = ["codice", "descrizione", "barcode"];
  //const counts = Object.values(columns).map(col => col.length);
  const counts = colonnedaControllare.map(key => columns[key].length);

  const max = Math.max(...counts);

  // info righe
  document.getElementById("righeInfo").textContent =
    "Righe rilevate: " + max;

  // verifica allineamento colonne
  const allEqual = counts.every(c => c === max);

  // validazione descrizioni
  let descrErrors = 0;
  columns.descrizione.forEach((line, idx) => {
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
}
function generaCSV() {

alert("GENERA CSV Importazione articoli");
  console.log("generaCSV avviata");  
    const today = new Date().toLocaleDateString("it-IT");

  // === CAMPI GLOBALI ===
  const fornitore = document.getElementById("fornitore").value.trim();

  // === COLONNE PER-RIGA ===
  const codice = parseColumn(document.getElementById("codice").value);
  const descrizioni = parseColumn(document.getElementById("descrizione").value);
  const barcode = parseColumn(document.getElementById("barcode").value);
  const costo = parseColumn(document.getElementById("costo").value);
  //const quantita = parseColumn(document.getElementById("quantita").value);

  // numero righe

  const rows = codice.length;

  let output = [];

  // === HEADER CSV ===
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

  // === RIGHE ===
  for (let i = 0; i < rows; i++) {

    const desc = splitDescrizione(descrizioni[i]);

    const line = [
      codice[i],                // CODICE ARTICOLO
      "",                        // COD. PROD.
      desc.d1,                   // DESCRIZIONE 1
      desc.d2,                   // DESCRIZIONE 2
      "999",                     // GRUPPO MERCEOLOGICO (fisso)
      "998",                     // SETTORE (fisso)
      ".", ".", ".", ".",        // FAMIGLIA, GENERE, MARCA, MODELLO
      "",                        // COD. CAPOFILA
      fornitore,                 // CODICE FORNITORE (globale)
      "",                        // ARTICOLO COLLEGATO
      "",                        // V
      "0",                       // COEFF
      today,                     // INIZ. VAL.
      "31/12/2050",              // FINE VAL.
      "",                        // ARTICOLI COMPATIBILI
      "F",                       // F
      fornitore,                 // COD. FORNITORE (ripetuto)
      "",                        // COD. ALTERNATIVO
      "",                        // stato
      barcode[i],                // CODICE A BARRE
      "",                        // CODICE IVA
      "1",                       // QTA X CONF
      "NR",                      // UNI MIS
      //costo[i].replace(",", "."),// Costo
     costo[i] || "",        // Costo senza conversione
      "",                        // NOTE
      "0",                       // QUANTITA MIN. ORDINABILE
      "F",                       // TIPO C/F
      "0",                       // CODICE CLI/FOR X DES.AGG.
      "1",                       // LINGUA
      "",                        // DESCRIZIONE AGG.
      "P",                       // TIPO ARTICOLO
      "KG",                      // UM PESO
      "0",                       // PESO NETTO
      "0",                       // PESO LORDO
      "NR",                      // UM ALT.
      "1",                       // FATTORE BASE/ACQ.
      "NR",                      // UM TECNICA
      "1",                       // FATTORE BASE/TECNICA
      "0",                       // LOTTO ACQ.
      "0",                       // QTA MIN VEND.
      "0",                       // LOTTO VEND.
      "S",                       // PUBBLICA
      "N"                        // LOTTI
    ];

    output.push(line.join("|"));
  }

  // === DOWNLOAD ===
  const blob = new Blob([output.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "articoli_generati.csv";
  link.click();
}
/////genera CSV ordine fornitore
function generaCSVOrdineFornitore() {
 /* if (quantita.length !== codice.length) {
  alert("Le quantità non sono allineate ai codici articolo");
  return;
}

if (quantita.some(q => q === "" || isNaN(q))) {
  alert("Quantità non valida");
  return;
} */

  alert("GENERA CSV Importazione ordine fornitore");
  console.log("generaCSV avviata");  
  
  // === CAMPI GLOBALI ===
  const fornitore = document.getElementById("fornitore").value.trim();

  // === COLONNE PER-RIGA ===
  const codice = parseColumn(document.getElementById("codice").value);
  const quantita = parseColumn(document.getElementById("quantita").value);

  // numero righe

  const rows = codice.length;

  let output = [];
  // HEADER CSV
  output.push([
    "RIGA",
    "CODICE ARTICOLO",
    "QUANTITA ORDINE",
    "CODICE FORNITORE"
  ].join("|"));
  // RIGHE
  for (let i = 0; i < rows; i++) {
    output.push([
      i + 1,                 // progressivo
      codice[i],        // codice articolo
      quantita[i],      // quantità
      fornitore         // fornitore globale
    ].join("|"));
  }
 const blob = new Blob([output.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ordini_fornitore.csv";
  link.click();
  //downloadCSV(output, "ordine_fornitore.csv");
}


//document.getElementById("genera").addEventListener("click", generaCSV);
