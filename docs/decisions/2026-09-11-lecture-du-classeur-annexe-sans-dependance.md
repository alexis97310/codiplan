# Annexe — la voie « sans dépendance », telle qu'elle a été MESURÉE

*Nuit du 11 septembre 2026. Ceci n'est pas du code du dépôt : c'est
**l'artefact exact d'une mesure**, conservé pour que la comparaison de
`2026-09-11-lecture-du-classeur-comparaison.md` soit vérifiable plutôt que
crue. Rien ne l'importe, rien ne l'exécute, il n'est pas sous `lib/`.*

*Ce qu'il a rendu, sur `cas-d31.xlsx` (écrit à la main en OOXML) **et** sur
`reel-openpyxl.xlsx` (écrit par openpyxl) : la même grille que
read-excel-file, exceljs et xlsx-populate, avec le **sérial** là où les deux
premières rendent un `Date`. Sur la bombe zip de 300 Mo : 48 Mo de mémoire,
la partie inutile n'étant jamais décompressée. Sur la bombe d'entités XML :
rien n'est expansé, aucun DTD n'étant traité.*

*Ce qu'il n'a PAS fait, et qui reste dû si cette voie est choisie : lire un
fichier produit par **Excel** — préfixes de namespace, `CDATA`, ZIP64, et un
garde-fou de décompression sur les parties réellement lues.*

```js
/**
 * TROISIÈME VOIE, MESURÉE PLUTÔT QU'ARGUMENTÉE : lire le classeur SANS
 * dépendance. Un .xlsx est un ZIP de trois parties XML. Node porte déjà
 * `zlib.inflateRawSync`. Combien de lignes, et jusqu'où ça va ?
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// ── 1. Le ZIP : répertoire central, puis chaque entrée ────────────────────
function ouvrirZip(tampon) {
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let fin = tampon.length - 22;
  while (fin >= 0 && tampon.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error("archive illisible : pas de répertoire central");
  const nb = tampon.readUInt16LE(fin + 10);
  let p = tampon.readUInt32LE(fin + 16);
  const parties = new Map();
  for (let i = 0; i < nb; i++) {
    if (tampon.readUInt32LE(p) !== 0x02014b50) throw new Error("entrée illisible");
    const methode = tampon.readUInt16LE(p + 10);
    const tailleCompressee = tampon.readUInt32LE(p + 20);
    const tailleReelle = tampon.readUInt32LE(p + 24);
    const lNom = tampon.readUInt16LE(p + 28);
    const lExtra = tampon.readUInt16LE(p + 30);
    const lComm = tampon.readUInt16LE(p + 32);
    const debutLocal = tampon.readUInt32LE(p + 42);
    const nom = tampon.toString("utf8", p + 46, p + 46 + lNom);
    // En-tête local : les longueurs y sont RÉPÉTÉES et peuvent différer.
    const lNomL = tampon.readUInt16LE(debutLocal + 26);
    const lExtraL = tampon.readUInt16LE(debutLocal + 28);
    const debut = debutLocal + 30 + lNomL + lExtraL;
    const brut = tampon.subarray(debut, debut + tailleCompressee);
    parties.set(nom, () => {
      const sorti = methode === 0 ? brut : inflateRawSync(brut);
      if (sorti.length !== tailleReelle) throw new Error(`${nom} : taille inattendue`);
      return sorti.toString("utf8");
    });
    p += 46 + lNom + lExtra + lComm;
  }
  return parties;
}

// ── 2. Le XML : on ne parse pas, on BALAYE les balises qui nous intéressent ─
const desEntites = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
   .replace(/&amp;/g, "&");

function chainesPartagees(xml) {
  if (xml === undefined) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => desEntites(t[1])).join(""),
  );
}

function stylesDeDate(xml) {
  // numFmtId natifs de date/heure, plus les formats personnalisés qui portent
  // un jeton de date. On rend l'ensemble des index de cellXfs qui sont des dates.
  const NATIFS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const perso = new Set();
  for (const m of (xml ?? "").matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    if (/[dmyhs]/i.test(desEntites(m[2]).replace(/\[[^\]]*\]|"[^"]*"/g, ""))) perso.add(+m[1]);
  }
  const bloc = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml ?? "");
  const dates = new Set();
  if (bloc) {
    [...bloc[1].matchAll(/<xf\b[^>]*>/g)].forEach((m, i) => {
      const id = /numFmtId="(\d+)"/.exec(m[0]);
      if (id && (NATIFS.has(+id[1]) || perso.has(+id[1]))) dates.add(i);
    });
  }
  return dates;
}

function grille(xml, sst, dates) {
  const lignes = [];
  for (const l of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\br="(\d+)"[^>]*\/>/g)) {
    const numero = +(l[1] ?? l[3]);
    const cellules = new Map();
    for (const c of (l[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (ref === undefined) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const style = +(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
      const dedans = c[2] ?? "";
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(dedans)?.[1];
      let cellule;
      if (type === "s") cellule = { texte: sst[+v] };
      else if (type === "inlineStr")
        cellule = { texte: [...dedans.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => desEntites(t[1])).join("") };
      else if (type === "str") cellule = { texte: desEntites(v ?? "") };
      else if (type === "b") cellule = { texte: v === "1" ? "VRAI" : "FAUX" };
      else if (v === undefined) continue; // cellule présente et vide
      else if (dates.has(style)) cellule = { serie: Number(v) };
      else cellule = { nombre: Number(v) };
      cellules.set(ref, cellule);
    }
    lignes.push({ numero, cellules });
  }
  return lignes;
}

// ── 3. L'assemblage ───────────────────────────────────────────────────────
const parties = ouvrirZip(readFileSync(process.argv[2] ?? "cas-d31.xlsx"));
const sst = chainesPartagees(parties.get("xl/sharedStrings.xml")?.());
const dates = stylesDeDate(parties.get("xl/styles.xml")?.());
const feuille = [...parties.keys()].filter((n) => n.startsWith("xl/worksheets/"))[0];
for (const l of grille(parties.get(feuille)(), sst, dates)) {
  const s = [...l.cellules].map(([r, c]) => `${r}=${JSON.stringify(c)}`).join(" ");
  console.log(`L${l.numero} : ${s}`);
}
```
