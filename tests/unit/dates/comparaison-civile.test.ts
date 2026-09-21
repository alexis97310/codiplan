import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * DATES-1 — AUCUN INSTANT COMPARÉ À UNE DATE CIVILE.
 *
 * ## LE DÉFAUT, CONSTATÉ TROIS FOIS EN DEUX JOURS
 *
 * `compterAPrevoir` (`lib/vgp/registre.ts`) recevait l'INSTANT — l'heure qu'il
 * est — et le comparait à une échéance posée à MINUIT UTC (une colonne
 * `@db.Date`) : une machine due AUJOURD'HUI sortait du KPI dès que l'horloge
 * dépassait minuit UTC, c'est-à-dire dès 11 h du matin à Nouméa (UTC+11). D-13 a
 * rejoué la même faute sur le badge d'expiration d'une habilitation, et la
 * fenêtre de lecture des absences sur le même principe encore.
 *
 * **La cause commune n'est pas l'une de ces trois lectures : c'est
 * `maintenant(fuseau).instant`, employé nu.** `.instant` porte un instant réel,
 * avec son heure ; une colonne `@db.Date` porte un jour civil, posé à minuit
 * UTC. Les comparer directement revient à soustraire deux grandeurs qui ne
 * portent pas la même chose — et la faute ne se voit que onze heures par jour,
 * sous UTC+11, jamais en test si le scénario fixe l'heure à minuit.
 *
 * **Le corrige-la-au-cas-par-cas ne suffit pas — il en reste toujours une.**
 * `compterAPrevoir` a été réparé UNE fois, à son seul appel du tableau de bord
 * (`debutDuJour` y remplace `instant`) : `listerLeRegistre` et
 * `informationDeLaMachine`, qui DÉRIVENT DE LA MÊME FONCTION
 * (`etatDeLInformation`), sont restées cassées à `/vgp` et `/parc/[id]`. Ce
 * gardien tient la PORTE, pas la réparation ponctuelle : `.instant` nu est
 * refusé partout dans le périmètre, quel que soit l'appelant.
 *
 * ## CE QUI EST REFUSÉ, ET POURQUOI CE N'EST PAS « AUCUN INSTANT NULLE PART »
 *
 * Un instant réel a des usages légitimes — horodater une suspension, mesurer
 * une ancienneté en jours ENTIERS écoulés. Le gardien ne bannit donc pas
 * `maintenant(...)` : il bannit la lecture NUE de `.instant` — par accès
 * (`maintenant(fuseau).instant`) ou par déstructuration
 * (`const { instant } = maintenant(fuseau)`) — parce que c'est très exactement
 * la forme des trois fautes constatées, et la forme qu'un `grep` sait
 * reconnaître sans comprendre TypeScript.
 *
 * **Ce qu'il laisse passer, délibérément.** `versLocal(maintenant(fuseau)
 * .instant, fuseau)` relit le MÊME instant dans son fuseau — c'est l'exact
 * équivalent de `.local`, seulement plus verbeux (`app/(back-office)/
 * interventions/page.tsx`) : le motif ne mord pas sur cet idiome, parce que ce
 * n'est plus l'instant nu qui circule ensuite, c'est sa lecture civile.
 *
 * ## SA LIMITE, ANNONCÉE (même famille que L9-05, §9 du 21/08)
 *
 * Il lit du TEXTE, pas des types. Un instant qui échapperait par un détour —
 * une fonction tierce qui rend `.instant` sous un autre nom — lui échappe. Ce
 * qu'il arrête est la faute telle qu'elle s'est produite trois fois : la
 * lecture nue, écrite en clair.
 */

/**
 * LE PÉRIMÈTRE — les trois répertoires cités par le ticket, PLUS les écrans du
 * back-office qui les appellent.
 *
 * **Pas les trois seuls.** Les trois fautes constatées ne vivent pas dans
 * `lib/` : `etatDeLInformation` (lib/vgp/information.ts) et `lireLesAbsences`
 * (lib/absences/ecran.ts) REÇOIVENT un `Date` en paramètre, documenté « reçu,
 * jamais lu ici » — la faute est entièrement dans ce que l'ÉCRAN leur envoie.
 * Un gardien qui ne lirait que `lib/vgp`, `lib/interventions`, `lib/absences`
 * ne verrait donc AUCUNE des trois fautes réelles : elles s'écrivent toutes
 * dans `app/(back-office)/**`. `lib/equipe` n'existe pas dans ce dépôt — la
 * précaution D-13 vit dans `lib/habilitations/` et `app/(back-office)/
 * parametres/equipe/`, et cette dernière EST du périmètre ci-dessous.
 */
const REPERTOIRES = [
  "lib/vgp",
  "lib/interventions",
  "lib/absences",
  "app/(back-office)",
];

/**
 * LES DEUX EXEMPTIONS, ET CE QUI LES JUSTIFIE — fermée, et ADOSSÉE (§9, 31/08) :
 * chaque motif doit se retrouver mot pour mot dans le fichier qu'il exempte,
 * sous peine de survivre à ce qu'il protégeait.
 *
 * `lib/interventions/depot.ts` (`instantDeLAgence`) rend l'instant pour
 * HORODATER une suspension (`suspendue_le`, un `timestamptz`) — jamais pour le
 * comparer à une `@db.Date`. C'est un instant qui reste un instant jusqu'au
 * bout.
 *
 * `app/(back-office)/tableau-de-bord/page.tsx` a besoin des DEUX lectures du
 * même appel à `maintenant` : `local` pour `debutDuJour`/`finDuJour` (les
 * bornes civiles du jour), et `instant` pour `enAttenteDePiece`, dont
 * `ancienneteJours` mesure des jours ENTIERS RÉELLEMENT écoulés depuis une
 * suspension — un instant tronqué à minuit le sous-compterait jusqu'à un jour
 * entier. `enAttenteDePiece` reçoit SÉPARÉMENT `aujourdHui` (la civile) pour
 * son propre `horizonDepasse` : les deux besoins ne se confondent plus dans un
 * seul paramètre.
 */
const EXEMPTIONS: readonly { readonly fichier: string; readonly motif: string }[] =
  [
    {
      fichier: "lib/interventions/depot.ts",
      motif: "maintenant(fuseauDeLAgence(agence)).instant",
    },
    {
      fichier: "app/(back-office)/tableau-de-bord/page.tsx",
      motif: "const { instant, local } = maintenant(fuseau);",
    },
  ];

/** L'idiome sûr : relire l'instant DANS son fuseau, exactement `.local`. */
function estIdiomeSurLocal(ligne: string): boolean {
  return /versLocal\s*\(\s*maintenant\s*\(/.test(ligne);
}

/** `maintenant(...).instant` — un niveau de parenthèses imbriquées toléré. */
const MOTIF_PROPRIETE =
  /maintenant\s*\((?:[^()]|\([^()]*\))*\)\s*\.\s*instant\b/;

/** `const { instant, … } = maintenant(...)` — la même faute, déstructurée. */
const MOTIF_DESTRUCTURATION = /\{[^{}]*\binstant\b[^{}]*\}\s*=\s*maintenant\s*\(/;

function ligneSuspecte(ligne: string): boolean {
  if (estIdiomeSurLocal(ligne)) {
    return false;
  }
  return MOTIF_PROPRIETE.test(ligne) || MOTIF_DESTRUCTURATION.test(ligne);
}

describe("DATES-1 — aucune lecture nue de `.instant` dans le périmètre daté", () => {
  const fichiers = fichiersSource(REPERTOIRES).map((fichier) => ({
    chemin: fichier.chemin,
    contenu: sansCommentaires(fichier.contenu),
  }));

  it("la population n'est pas vide — sans quoi le gardien ne regarde rien", () => {
    // TÉMOIN (§9, 30/08) : un répertoire vidé ou renommé rendrait ce contrôle
    // vert sans avoir rien lu.
    expect(fichiers.length).toBeGreaterThan(30);
  });

  it("aucune ligne du périmètre ne lit `.instant` nu, hors exemption", () => {
    const fautes: string[] = [];
    for (const fichier of fichiers) {
      fichier.contenu.split("\n").forEach((ligne, index) => {
        if (!ligneSuspecte(ligne)) {
          return;
        }
        const exempte = EXEMPTIONS.some(
          (exemption) =>
            exemption.fichier === fichier.chemin &&
            ligne.includes(exemption.motif),
        );
        if (exempte) {
          return;
        }
        fautes.push(
          `${fichier.chemin}:${index + 1} — instant nu comparé (ou promis) à ` +
            `une date civile : « ${ligne.trim()} ». Passer par ` +
            "`instantDuJour(jourDe(maintenant(fuseau).local))` (DATES-1).",
        );
      });
    }
    expect(fautes).toEqual([]);
  });

  it("chaque exemption EXISTE, mot pour mot — l'exemption est adossée", () => {
    expect(EXEMPTIONS.length).toBeGreaterThan(0);
    for (const exemption of EXEMPTIONS) {
      const fichier = fichiers.find((f) => f.chemin === exemption.fichier);
      expect(
        fichier,
        `${exemption.fichier} n'existe plus dans le périmètre : retirer son ` +
          "exemption.",
      ).toBeDefined();
      expect(
        fichier?.contenu.includes(exemption.motif),
        `${exemption.fichier} n'a plus besoin de son exemption : la retirer.`,
      ).toBe(true);
    }
  });

  it("ÉPREUVE — les deux formes de la faute sont détectées", () => {
    const fautifs = [
      "const aujourdHui = maintenant(fuseau).instant;",
      "const { instant, local } = maintenant(fuseau);",
      "const instant = maintenant(fuseau).instant.getTime();",
      "listerLeRegistre(contexte, maintenant(fuseau).instant, LIMITE);",
    ];
    for (const ligne of fautifs) {
      expect(ligneSuspecte(ligne), `non détecté : ${ligne}`).toBe(true);
    }
  });

  it("ÉPREUVE — la forme réparée, et l'idiome `versLocal`, ne mordent pas", () => {
    const licites = [
      "const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));",
      "const aujourdHui = jourDe(versLocal(maintenant(fuseau).instant, fuseau));",
      "const { local } = maintenant(fuseau);",
      "const jour = jourDe(maintenant(fuseau).local);",
    ];
    for (const ligne of licites) {
      expect(ligneSuspecte(ligne), `faux positif : ${ligne}`).toBe(false);
    }
  });

  it("ÉPREUVE — la faute écrite dans un COMMENTAIRE ne compte pas", () => {
    // La même coupure que L9-05 et L0-08 (§9, 26/08) : un commentaire qui CITE
    // `maintenant(fuseau).instant` pour expliquer un correctif — exactement le
    // commentaire réel de `app/(back-office)/parametres/equipe/page.tsx` — n'
    // exécute rien.
    const documentation =
      "// D-13 : `maintenant(fuseau).instant` est un `Date` que le fuseau n'a " +
      "pas touché\nconst a = 0;";
    expect(ligneSuspecte(sansCommentaires(documentation))).toBe(false);
  });
});
