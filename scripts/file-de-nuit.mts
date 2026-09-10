/**
 * `pnpm file` — LE PREMIER TRAVAIL NON BLOQUÉ.
 *
 * La session nocturne LIT ce que cette commande imprime ; elle n'interprète pas
 * le backlog. Et la commande dit AUSSI pourquoi les tickets précédents sont
 * écartés : un verdict qu'on ne peut pas contrôler se croit sur parole.
 */

import {
  defautsDeLaFile,
  lireLaFile,
  premierTravailLibre,
} from "./lib/file-de-nuit.js";

/** Sortie via `process.stdout.write` : `console.log` est banni (CLAUDE.md §5). */
const dire = (texte = "") => process.stdout.write(`${texte}\n`);

const tickets = lireLaFile();

if (tickets.length === 0) {
  // TÉMOIN DE NON-VACUITÉ. Zéro ticket lu ressemble à s'y méprendre à une file
  // saine — et un décompte nul ressemble toujours à un sans-faute (§9, 30/08).
  console.error(
    "La file est VIDE : aucun titre de ticket lu dans docs/backlog.md.",
  );
  console.error(
    "Ce n'est pas « rien à faire », c'est « rien n'a été mesuré ».",
  );
  process.exit(1);
}

const ecarts = defautsDeLaFile(tickets);
if (ecarts.length > 0) {
  console.error(`La file est ILLISIBLE — ${ecarts.length} écart(s) :`);
  for (const { ticket, raison } of ecarts) {
    console.error(
      `  docs/backlog.md:${ticket.ligne}  ${ticket.identifiant} — ${raison}`,
    );
  }
  process.exit(1);
}

const parEtat = {
  LIBRE: tickets.filter((t) => t.etat === "LIBRE").length,
  LIVRÉ: tickets.filter((t) => t.etat === "LIVRÉ").length,
  BLOQUÉ: tickets.filter((t) => t.etat === "BLOQUÉ").length,
};

dire(
  `File lue dans docs/backlog.md — ${tickets.length} ticket(s) : ` +
    `${parEtat.LIBRE} libre(s), ${parEtat.LIVRÉ} livré(s), ${parEtat.BLOQUÉ} bloqué(s).`,
);

const bloques = tickets.filter((t) => t.etat === "BLOQUÉ");
if (bloques.length > 0) {
  dire("\nÉcartés parce que BLOQUÉS :");
  for (const t of bloques) dire(`  ${t.identifiant} — ${t.motif}`);
}

const premier = premierTravailLibre(tickets);

if (premier === null) {
  dire("\nAucun travail LIBRE : la file est épuisée.");
  dire("Ce n'est pas une erreur — c'est un état, et il se lit comme tel.");
  process.exit(0);
}

dire(`\nPREMIER TRAVAIL NON BLOQUÉ : ${premier.identifiant}`);
dire(`  ${premier.titre}`);
dire(`  docs/backlog.md:${premier.ligne}`);
