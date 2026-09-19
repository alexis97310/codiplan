import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Kpi } from "@/components/ui/kpi";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { obtenirSession } from "@/lib/auth/session";
import { dateCivile, maintenant, schemaFuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { libelleEcheance } from "@/lib/vgp/libelles";
import { type EtatInformation } from "@/lib/vgp/information";
import {
  famillesADeterminer,
  listerLeRegistre,
  resumerLeRegistre,
  type LigneDeRegistre,
} from "@/lib/vgp/registre";
import { CLASSES_LIEN } from "@/lib/theme/apparence";

/**
 * LE REGISTRE DES VÉRIFICATIONS PÉRIODIQUES (L9-02, L9-03 ; D88, D125, D128).
 *
 * ## LA DISPOSITION VIENT DE vgp() (D125), LE CONTENU DE D88 — ET D128 TRANCHE
 *    LEUR ORDRE QUAND ILS SE CROISENT
 *
 * `codiplan-maquette-complete.html` dessine, pour cet écran, quatre KPI en
 * bandeau puis une table à six colonnes dont deux — « État » et « Action » —
 * n'existaient pas ici avant ce ticket. Cette disposition est reprise : D125
 * fait foi dessus.
 *
 * **Ce que D125 NE fait PAS foi : le contenu de la colonne « État ».** La
 * maquette y pose des badges « Conforme », « À planifier », « En retard » —
 * un verdict de conformité. C'est exactement ce que D88 (L9-02, D114)
 * interdit : *les VGP sont commandées par les clients, CODIPLAN n'apprend
 * leur résultat que si on nous le transmet, et ne rend jamais de verdict.*
 * D128 (18/09/2026) tranche l'ordre entre les deux : *« D125 fait foi sur la
 * disposition, jamais sur une règle de gestion déjà arbitrée. Quand les deux
 * s'opposent, la règle de gestion l'emporte. »* Le badge de cette colonne
 * code donc l'ÉTAT DE L'INFORMATION — Hors registre / Sans information /
 * Information reçue —, jamais une conformité. C'est un ÉCART VOLONTAIRE à la
 * maquette, nommé ici et dans la proposition du lot, pas un oubli.
 *
 * ## LE BOUTON « + PLANIFIER UN CONTRÔLE » DE L'EN-TÊTE — ÉCART NOMMÉ
 *
 * `head()` de `vgp()` pose ce bouton. Aucune route ne planifie un contrôle
 * aujourd'hui — enregistrer une vérification déjà FAITE (§ ci-dessous) n'est
 * pas la même chose que planifier une échéance future, qui reste à
 * construire. Un bouton qui ne mène nulle part se lit comme une panne
 * (R2-13) : il n'est donc pas rendu.
 *
 * ## LA COLONNE « ACTION » MÈNE À `enregistrerVerification` (SECOND TEMPS)
 *
 * `enregistrerVerification` (`lib/vgp/verification.ts`) existait sans aucun
 * appelant — un geste réglementaire qu'on ne pouvait pas faire est un écran
 * qui ment. Chaque ligne mène donc à `/vgp/enregistrer/[id]`, son écran et
 * son seul chemin d'écriture. La fiche machine reste atteignable par le lien
 * du numéro de série, dans la colonne « Machine » — le bouton d'action ne la
 * porte plus, pour ne pas dupliquer deux destinations sous un même bouton.
 *
 * ## LE DÉBORDEMENT MESURÉ À 1280 PX (AUDIT D128) ET SA CORRECTION
 *
 * La colonne « Dernière information » de l'ancien tableau portait, pour une
 * machine « sans information » sans date de mise en service connue, la
 * phrase entière `vgp.information.depuis_inconnu` (79 caractères, aucun point
 * de rupture avant la fin) — dans un tableau posé sous `overflow-x-auto`,
 * l'algorithme de disposition automatique d'un `<table>` préfère ÉLARGIR la
 * colonne plutôt que d'envelopper une phrase sans rupture, et la ligne
 * débordait du cadre visible. Deux corrections, ensemble : le badge d'état ne
 * porte plus qu'un MOT (jamais une phrase), et la date qui l'accompagne
 * (`vgp.etat_ligne.*`) est composée courte, avec `break-words` en secours sur
 * les sous-lignes qui peuvent rester longues (le régime).
 *
 * ## CE QUE CET ÉCRAN AFFICHE AUJOURD'HUI, ET IL LE DIT
 *
 * **Toutes les machines soumises sont « sans information »**, parce que rien
 * n'enregistre encore ce qu'un organisme a écrit : le rapport de VGP est un
 * document de classe `client` (D88 §9), et rien ne le distingue d'un autre
 * document. L'écran porte cette phrase en toutes lettres plutôt que de laisser
 * croire à un parc jamais vérifié. *Un écran qui se tait sur ce qu'il ne sait
 * pas est exactement le registre qui ment.*
 *
 * ## LA LISTE DES INDÉTERMINÉS EST À UN CLIC, ET SON COMPTE EST ICI
 *
 * C'est la seconde moitié de L9-03, et c'est elle qui fait tenir la première :
 * *une famille qui naît « à déterminer » et que personne ne voit jamais est
 * exactement la case décochée qu'on a refusée.* `vgp()` ne dessine ni ce
 * lien ni le paragraphe d'explication qui le suit : ils restent, écart nommé
 * dans l'autre sens — les retirer romprait L9-03.
 *
 * ## CET ÉCRAN N'EST PAS UNE ENTRÉE DE LA BARRE, ET C'EST DÉLIBÉRÉ
 *
 * La barre est une liste CLOSE confrontée à la maquette (D95/D118), et la
 * maquette n'y porte aucune entrée « VGP ». Le registre se rejoint donc par un
 * LIEN depuis le parc.
 */
const LIGNES_AFFICHEES = 200;

/** Le tiret cadratin d'une valeur absente — un SIGNE, jamais une phrase. */
const ABSENT = "—";

/**
 * L'échéance, ou le signe de son absence — composé HORS du JSX.
 *
 * *Le gardien de L0-11 a refusé `{… ?? ABSENT}` écrit dans le rendu* : il
 * résout la constante et y lit une chaîne visible en dur. Il a raison de ne pas
 * faire la différence — c'en est une —, et la forme que le dépôt emploie
 * ailleurs est celle-ci : une fonction qui rend le texte, jamais un littéral
 * dans le JSX.
 */
function echeanceAffichee(ligne: LigneDeRegistre): string {
  return libelleEcheance(ligne.information) ?? ABSENT;
}

/**
 * LE DERNIER CONTRÔLE CONNU — la date de VÉRIFICATION, jamais celle de la
 * saisie (même règle que `dernieresInformations`). Sans information reçue,
 * le signe d'absence : il n'y a rien à dater ici, la colonne « État » dit
 * pourquoi.
 */
function dernierControleAffiche(ligne: LigneDeRegistre): string {
  return ligne.information.etat === "information_recue"
    ? dateCivile(ligne.information.derniereInformation)
    : ABSENT;
}

/**
 * LE TON DU BADGE D'ÉTAT — dérivé des TROIS états de `information.ts`,
 * jamais d'un quatrième inventé. Aucun des trois ne dit ni conforme ni non
 * conforme (D88) : le ton n'est qu'un repère visuel sur ce qu'on SAIT, pas un
 * jugement sur ce que ça vaut.
 */
const TONS_ETAT: Record<EtatInformation["etat"], TonBadge> = {
  hors_registre: "gris",
  sans_information: "orange",
  information_recue: "vert",
};

/** Le libellé COURT du badge — une catégorie, jamais une phrase (D128). */
function libelleEtatCourt(etat: EtatInformation["etat"]): string {
  if (etat === "hors_registre") {
    return t("vgp.information.hors_registre");
  }
  if (etat === "sans_information") {
    return t("vgp.information.sans_information");
  }
  return t("vgp.information.recue");
}

/**
 * LA SOUS-LIGNE « DEPUIS QUAND » — uniquement pour « sans information » :
 * « hors registre » n'a pas de date (sa nature, D88) et « information reçue »
 * porte déjà sa date dans la colonne « Dernier contrôle ». Composée COURTE
 * (§ « LE DÉBORDEMENT… » ci-dessus), jamais la phrase longue du dictionnaire
 * de bibliothèque (`vgp.information.depuis_inconnu`, réservée à la fonction
 * pure et à son propre gardien).
 */
function departSousLigne(ligne: LigneDeRegistre): string | null {
  const info = ligne.information;
  if (info.etat !== "sans_information") {
    return null;
  }
  return info.depuis === null
    ? t("vgp.etat_ligne.depuis_inconnu")
    : `${t("vgp.etat_ligne.depuis_le")} ${dateCivile(info.depuis)}`;
}

export default async function PageRegistreVgp() {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) : la date courante ne
  // se lit pas sans lui, et c'est celui de la société — le registre couvre
  // toutes ses agences.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = maintenant(fuseau).instant;

  // DEUX LECTURES INDÉPENDANTES (lot PERF, mesuré sur 4fead41) : ni l'une ni
  // l'autre ne dépend du résultat de l'autre, toutes deux ne dépendent que du
  // contexte cloisonné.
  const [lignes, indetermines] = await Promise.all([
    listerLeRegistre(contexte, aujourdHui, LIGNES_AFFICHEES),
    famillesADeterminer(contexte),
  ]);
  // LE MÊME TABLEAU QUE CELUI RENDU, jamais une seconde lecture plafonnée
  // différemment (voir l'en-tête de `resumerLeRegistre`) : ce registre n'est
  // pas paginé, contrairement au parc.
  const resume = resumerLeRegistre(lignes);
  const machinesADeterminer = indetermines.reduce(
    (total, famille) => total + famille.machines,
    0,
  );

  const colonnes = [
    { cle: "machine", libelle: t("vgp.colonne_machine"), largeur: "160px" },
    { cle: "client", libelle: t("vgp.colonne_client"), largeur: "150px" },
    {
      cle: "dernier_controle",
      libelle: t("vgp.colonne_dernier_controle"),
      largeur: "110px",
    },
    {
      cle: "echeance",
      libelle: t("vgp.colonne_echeance"),
      largeur: "160px",
    },
    { cle: "etat", libelle: t("vgp.colonne_etat"), largeur: "220px" },
    { cle: "action", libelle: t("vgp.colonne_action"), largeur: "90px" },
  ];

  return (
    <Page
      chemin="/vgp"
      titre={t("vgp.titre")}
      sousTitre={t("vgp.sous_titre")}
      actions={
        <Link href="/parc" className="text-app-encre-faible text-[12.5px]">
          {t("vgp.retour")}
        </Link>
      }
    >
      {/*
        LES QUATRE KPI DE `vgp()` (D125) — le troisième est un ÉCART VOLONTAIRE
        de CONTENU : voir l'en-tête de ce fichier et tests/unit/ui/lot-a5-a7.
        test.ts, qui nomme cet écart.
      */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div data-bloc="kpi-sous-30-jours">
          <Kpi
            ton="orange"
            libelle={t("vgp.kpi_echeance_a_venir")}
            valeur={resume.echeanceAVenir}
            detail={t("vgp.kpi_echeance_a_venir_detail")}
          />
        </div>
        <div data-bloc="kpi-en-retard">
          <Kpi
            ton="rouge"
            libelle={t("vgp.kpi_en_retard")}
            valeur={resume.echeanceDepassee}
            detail={t("vgp.kpi_en_retard_detail")}
          />
        </div>
        <div data-bloc="kpi-informations-recues">
          <Kpi
            ton="vert"
            libelle={t("vgp.kpi_informations_recues")}
            valeur={resume.informationRecue}
            detail={t("vgp.kpi_informations_recues_detail")}
          />
        </div>
        <div data-bloc="kpi-a-determiner">
          <Kpi
            libelle={t("vgp.regime.a_determiner")}
            valeur={machinesADeterminer}
            detail={t("vgp.kpi_a_determiner_detail")}
          />
        </div>
      </div>

      {/*
        LE COMPTE DES INDÉTERMINÉS EST UN LIEN, jamais un simple chiffre : *sans
        la liste visible, la troisième valeur ne sert à rien* (D88 §3). Zéro
        famille indéterminée n'efface pas le lien — il dirait alors que la
        question ne se pose plus, ce qui est faux : une famille créée demain y
        revient.
      */}
      <Link
        href="/vgp/a-determiner"
        className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3.5 py-2.5 text-[12.5px] font-bold"
      >
        {indetermines.length}{" "}
        {t(
          indetermines.length === 1
            ? "vgp.indetermines.lien_une"
            : "vgp.indetermines.lien",
        )}
      </Link>

      <p className="text-app-encre-faible max-w-[80ch] text-[11.5px]">
        {t("vgp.information.ce_que_le_silence_dit")}
      </p>

      <section
        data-bloc="tableau-registre"
        className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
      >
        <div data-bloc="colonnes-registre" className="contents">
          <Tableau colonnes={colonnes} minimum="890px">
            {lignes.length === 0 ? (
              <LignePleine colonnes={colonnes.length}>
                {t("vgp.vide")}
              </LignePleine>
            ) : null}
            {lignes.map((ligne) => (
              <LigneRegistre key={ligne.id} ligne={ligne} />
            ))}
          </Tableau>
        </div>
      </section>

      <p className="text-app-encre-faible text-[11.5px]">{t("vgp.borne")}</p>
    </Page>
  );
}

function LigneRegistre({ ligne }: { readonly ligne: LigneDeRegistre }) {
  const depart = departSousLigne(ligne);
  return (
    <tr>
      <Cellule mono>
        <Link href={`/parc/${ligne.id}`} className={CLASSES_LIEN}>
          {ligne.numero_serie}
        </Link>
        <span className="text-app-encre-faible mt-[3px] block font-sans text-[11.5px] break-words">
          {ligne.famille}
        </span>
      </Cellule>
      <Cellule>
        {ligne.client}
        <span className="text-app-encre-faible mt-[3px] block text-[11.5px] break-words">
          {ligne.site}
        </span>
      </Cellule>
      <Cellule>{dernierControleAffiche(ligne)}</Cellule>
      <Cellule>{echeanceAffichee(ligne)}</Cellule>
      <Cellule>
        <Badge ton={TONS_ETAT[ligne.information.etat]}>
          {libelleEtatCourt(ligne.information.etat)}
        </Badge>
        {depart === null ? null : (
          <span className="text-app-encre-faible mt-[3px] block text-[11.5px] break-words">
            {depart}
          </span>
        )}
        <span className="text-app-encre-faible mt-[3px] block text-[11.5px] break-words">
          {regimeExplique(ligne)}
        </span>
      </Cellule>
      <Cellule>
        <Link
          href={`/vgp/enregistrer/${ligne.id}`}
          className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap"
        >
          {t("vgp.action_enregistrer")}
        </Link>
      </Cellule>
    </tr>
  );
}

/**
 * LE RYTHME, AVEC LE NIVEAU QUI L'A FIXÉ ET LE TEXTE QUI LE FONDE.
 *
 * *Sans le texte, la périodicité est un chiffre que personne ne peut défendre*
 * (D88 §4). Aucune durée n'est écrite ici : le nombre de mois vient de la
 * donnée saisie, et « aucun rythme déclaré » est un libellé, pas un zéro.
 */
function regimeExplique(ligne: LigneDeRegistre): string {
  // La chaîne est composée ICI et non dans le JSX : `react/jsx-no-literals`
  // refuse le moindre texte dans un composant, et il a raison — *aucune chaîne
  // en dur dans un composant* (§5 du CLAUDE.md). Le séparateur en est une.
  return `${t(`vgp.regime.${ligne.assujettissement}`)} · ${t(`vgp.origine.${ligne.origine}`)} · ${rythmeAffiche(ligne)}`;
}

function rythmeAffiche(ligne: LigneDeRegistre): string {
  if (ligne.periodiciteMois === null || ligne.originePeriodicite === null) {
    return t("vgp.periodicite.aucune");
  }
  const provenance = t(`vgp.periodicite.${ligne.originePeriodicite}`);
  const texte =
    ligne.referenceTexte === null ? "" : ` · ${ligne.referenceTexte}`;
  return `${ligne.periodiciteMois} mois — ${provenance}${texte}`;
}
