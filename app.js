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

// blocco inizializzazione DOM
document.addEventListener("DOMContentLoaded", () => {

  // ripristino stato
  restore();

  // aggancio eventi input
  ["codice", "descrizione", "barcode", "costo", "fornitore","quantita", "prezzo"]
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

  // bottone genera listino di vendita
  document.getElementById("genera_listino")
  .addEventListener("click", generaCSVlistino);

  // bottone reset
  document.getElementById("reset")
    .addEventListener("click", resetAll);

  /*document.getElementById("reset")
    .addEventListener("click", () => {
      chrome.storage.local.remove(STATE_KEY);
      ["fornitore","codice","descrizione","barcode","costo", "quantita", "prezzo"]
        .forEach(id => document.getElementById(id).value = "");
      update();
    });*/

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

function parseColumnWithEmpty(text) {
  return text
    .split(/\r?\n/)
    .map(v => v.trim()); 
    // Rimosso .filter(v => v !== "") per mantenere le righe vuote
}
const fields = ["codice", "descrizione", "barcode", "costo", "quantita","prezzo"];

fields.forEach(id => {
  document.getElementById(id).addEventListener("input", update);
});

function update() {
  // colonne per-riga
  const columns = {
    codice: parseColumn(document.getElementById("codice").value),
    descrizione: parseColumn(document.getElementById("descrizione").value),
    barcode: parseColumnWithEmpty(document.getElementById("barcode").value),
    costo: parseColumnWithEmpty(document.getElementById("costo").value),
    quantita: parseColumn(document.getElementById("quantita").value),
    prezzo: parseColumn(document.getElementById("prezzo").value)
  };

  // numero righe
  //defnisco colonne da controllare
  const colonnedaControllare = ["codice", "descrizione", /*"barcode"*/];
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

    // abilita/disabilita genera CSV listino di vendita
  document.getElementById("genera_listino").disabled =
    !allEqual ||
    max === 0 ||
    descrErrors > 0 ||
    //prezzoErrors > 0 ||
    !fornitoreOk;
}

function generaCSV() {
const conferma =  confirm("Vuoi scaricare CSV importazione articoli?");
if (!conferma) {
  console.log("Download CSV annullato dall'utente");
  return; // l'utente ha annullato l'operazione
} 
const today = new Date().toLocaleDateString("it-IT");
const hour = String(new Date().getHours()).padStart(2, '0');
const minute = String(new Date().getMinutes()).padStart(2, '0');
const second = String(new Date().getSeconds()).padStart(2, '0');
const Time = ` ${hour}:${minute}:${second}`; // formato "dd/mm/yyyy HH:MM:SS"
  // === CAMPI GLOBALI ===
  const fornitore = document.getElementById("fornitore").value.trim();

  // === COLONNE PER-RIGA ===
  const codice = parseColumn(document.getElementById("codice").value);
  const descrizioni = parseColumn(document.getElementById("descrizione").value);
  const barcode = parseColumnWithEmpty(document.getElementById("barcode").value);
  const costo = parseColumnWithEmpty(document.getElementById("costo").value);
  //const quantita = parseColumn(document.getElementById("quantita").value);

  // numero righe

  const rows = codice.length;
/*s
  //inserimento per individuare articoli senza barcode e lasciarli vuoti
for (let i = 0; i < rows; i++) {
    if (!barcode[i] || barcode[i].trim() === "") {
      articoliSenzaBarcode.push(`Riga ${i + 1}: ${codice[i]}`);
    }
  }

  // Prepara il messaggio di conferma
  let messaggio = "Vuoi scaricare CSV importazione articoli?";
  if (articoliSenzaBarcode.length > 0) {
    messaggio = `ATTENZIONE: ${articoliSenzaBarcode.length} articoli non hanno il barcode:\n\n` + 
                articoliSenzaBarcode.slice(0, 10).join("\n") + 
                (articoliSenzaBarcode.length > 10 ? "\n..." : "") + 
                "\n\nVuoi procedere comunque con il download?";
  }

    const confermabarcode = confirm(messaggio);
  if (!confermabarcodes) return; // l'utente ha annullato l'operazione */

  // === COSTRUZIONE CSV ===
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
      barcode[i] || "",    // CODICE A BARRE lascia riga vuota se non presente
      "",                        // CODICE IVA
      "1",                       // QTA X CONF
      "NR",                      // UNI MIS
      //costo[i].replace(",", "."),// Costo
     costo[i] || "",        // Costo senza conversione e lascia vuoto se non presente
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
  const blob = new Blob([output.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "articoli_" + Time + ".csv";
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
const hour = String(new Date().getHours()).padStart(2, '0');
const minute = String(new Date().getMinutes()).padStart(2, '0');
const second = String(new Date().getSeconds()).padStart(2, '0');
const Time = ` ${hour}:${minute}:${second}`; // formato "dd/mm/yyyy HH:MM:SS"

 /* alert("GENERA CSV Importazione ordine fornitore");
  console.log("generaCSV avviata");*/  

  const conferma = confirm("Vuoi scaricare  file importazione ordine fornitore?");
  if (!conferma) {
    console.log("Download CSV annullato dall'utente");
    return; // l'utente ha annullato l'operazione
  }

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
  link.download = "ordine_" + Time + ".csv";
  link.click();
  //downloadCSV(output, "ordine_fornitore.csv");
}

  //genera CSV listino di vendita
function generaCSVlistino() {
const today = new Date().toLocaleDateString("it-IT");
const hour = String(new Date().getHours()).padStart(2, '0');
const minute = String(new Date().getMinutes()).padStart(2, '0');
const second = String(new Date().getSeconds()).padStart(2, '0');
const Time = ` ${hour}:${minute}:${second}`; // formato "dd/mm/yyyy HH:MM:SS"

  const conferma =  confirm("Vuoi scaricare file importazione listino di vendita?");
if (!conferma) {
  console.log("Download CSV annullato dall'utente");
  return; // l'utente ha annullato l'operazione
} 

  // === COLONNE PER-RIGA ===
  const codice = parseColumn(document.getElementById("codice").value);
  const prezzo = parseColumn(document.getElementById("prezzo").value);

  // numero righe

  const rows = codice.length;

  let output = [];
  // HEADER CSV
  output.push([
    "CODICE ART",
    "DESCR",
    "PREZZO",
    "COD.BAR",
    "NETTO",
    "SC1",
    "SC2",
    "SC3",
    "SCS",
    "TIPO CLIFOR",
    "COD CLIFOR",
    "MARCA",
    "MODELLO",
    "GENERE",
    "FAMIGLIA",
    "SETTORE",
    "LISTINO ID",
    "SETT.GEST",
    "CODCLI",
    "DATA INIZIO VAL", 
    "QTA", 
    "FLAG NETTI",
  ].join("|"));

  // RIGHE
  for (let i = 0; i < rows; i++) {
    output.push([
      //i + 1,                 // progressivo
      codice[i],        // codice articolo
      "",               // descrizione vuota
      prezzo[i],       // prezzo
      "",               // codice a barre vuoto   
      "0",              // netto 
      "0",              // SC1
      "0",              // SC2
      "0",              // SC3
      "",              // SCS
      "C",              // TIPO CLIFOR
      "0",              // COD CLIFOR
      ".",              // MARCA
      ".",              // MODELLO
      ".",              // GENERE
      ".",            // FAMIGLIA
      "0",            // SETTORE
      "1",            // LISTINO ID
      "0",            // SETT.GEST
      "0",            // CODCLI
      today,         // DATA INIZIO VAL
      "0",            // QTA
      "N",            // FLAG NETTI
      //
    ].join("|"));
  }
 const blob = new Blob([output.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "listino_" + Time + ".csv";
  link.click();


  //downloadCSV(output, "ordine_fornitore.csv");
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
