import Link from "next/link";
import { LienPrimaire } from "@/components/ui/action-primaire";
import { type LigneOccupation } from "@/lib/interventions/occupation";
import { tauxCompact } from "@/lib/interventions/statistiques";
import {
  CLASSES_LIEN,
  LARGEUR_COLONNE_TECHNICIEN_PX,
} from "@/lib/theme/apparence";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import {
  cleJour,
  instantDuJour,
  jourSuivant,
  maintenant,
  minutesDepuisMinuit,
  schemaFuseau,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import {
  enHeure,
  joursTravailles,
  lireParametrage,
} from "@/lib/calendar/parametrage";
import {
  joursDeLaSemaine,
  jourSemaineIso,
  lundiDeLaSemaine,
  semaineIso,
} from "@/lib/calendar/semaine";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { listerPlanning } from "@/lib/interventions/depot";
import { fileDAttente, lignesAffichees } from "@/lib/interventions/affichage";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
  type Journee,
  type MotifHorsGrille,
  type TechnicienDeJournee,
} from "@/lib/interventions/journee";
import { occupationsDuPlanning } from "@/lib/interventions/occupation";
import {
  nomSeul,
  personnesANommer,
  quiTravaille,
} from "@/lib/interventions/personnes";
import {
  CLASSES_BLOC,
  CLASSES_STATUT,
  LEGENDE_PLANNING,
} from "@/lib/theme/statuts";

import { BlocPosable, CasePosable, Posable } from "@/components/planning/pose";

import {
  enTeteDuBloc,
  objetDuBloc,
  referenceAffichee,
} from "../interventions/presentation";
import { Statistiques } from "./statistiques";

/**
 * LE PLANNING — deux vues sur la même donnée (lot 2, D84 ; D95 ; 11/09/2026).
 *
 * ## La vue SEMAINE : une ligne par PERSONNE
 *
 * *Elle avait une ligne par couple (technicien, agence), et une personne qui
 * sert Ducos et Koné en occupait deux.* La maille est désormais la personne ;
 * la règle d'ouverture et la raison pour laquelle elle ne contredit pas I7 sont
 * écrites dans `lib/interventions/grille.ts`. Chaque bloc NOMME son agence,
 * parce que c'est elle qui décide, et que la ligne ne le dit plus.
 *
 * ## La vue JOUR : les heures en lignes, les personnes en colonnes
 *
 * **Son objet est de montrer les TROUS**, et c'est le seul critère qui la juge.
 * L'axe porte l'union des heures des agences présentes, au pas le plus fin
 * qu'elles règlent — jamais un pas écrit ici (I7) —, et chaque colonne grise
 * les heures hors du calendrier de sa propre agence. Le compte des créneaux
 * libres est affiché : *« on voit bien les trous » est une impression, pas une
 * observation.*
 *
 * ## Ce qui est commun aux deux
 *
 * **Une seule lecture cloisonnée**, et les deux vues s'en servent. Les noms des
 * personnes viennent de `nomsDesPersonnes`, qui n'élargit rien : la politique
 * `utilisateur_lecture` porte cette branche depuis L1-02c — mesuré le
 * 11/09/2026, 4 identités pour un interne, 0 pour un compte portail.
 *
 * **Ce n'est toujours pas un calendrier agissant** : Schedule-X et le
 * glisser-déposer viennent au lot 3.
 */
export default async function PagePlanning({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;
  const parametres = await searchParams;
  const vue = parametres.vue === "jour" ? "jour" : "semaine";

  const cadre = await avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    });
    const agences = await tx.agence.findMany({
      select: {
        id: true,
        libelle: true,
        calendrier_id: true,
        fuseau_horaire: true,
      },
      orderBy: { libelle: "asc" },
    });
    const detaillees = await Promise.all(
      agences.map(async (agence) => {
        const parametrage =
          agence.calendrier_id === null
            ? null
            : await lireParametrage(tx, agence.calendrier_id);
        return { agence, parametrage };
      }),
    );
    // ── LE RÉFÉRENTIEL DES PERSONNES — c'est lui qui donne ses colonnes à la
    // vue jour, et non plus les interventions (12/09/2026).
    //
    // *Un technicien dont la journée est entièrement libre n'avait aucune
    // colonne* — c'est-à-dire, sur un écran dont l'objet déclaré est de MONTRER
    // LES TROUS, la personne qu'il fallait montrer en premier.
    //
    // `actif` filtre, et c'est une décision : *un technicien qui a quitté
    // l'entreprise ne se supprime pas, il cesse d'être proposé* (schéma,
    // `Technicien.actif`). Lui garder une colonne vide ferait proposer une
    // journée entière chez quelqu'un qui n'est plus là. Ses interventions
    // passées, elles, lui rendent sa colonne — la vue jour n'en perd aucune.
    const techniciens = await tx.technicien.findMany({
      where: { actif: true },
      select: { utilisateur_id: true, agence_id: true },
    });
    return {
      fuseau: societe?.fuseau_horaire ?? "UTC",
      detaillees,
      techniciens,
    };
  });

  const pourGrille: AgenceDeGrille[] = cadre.detaillees.map(
    ({ agence, parametrage }) => ({
      id: agence.id,
      libelle: agence.libelle,
      joursOuverts: parametrage === null ? [] : joursTravailles(parametrage),
      calendrierConnu: parametrage !== null,
    }),
  );
  const pourJournee: AgenceDeJournee[] = cadre.detaillees.map(
    ({ agence, parametrage }) => ({
      id: agence.id,
      libelle: agence.libelle,
      plages: parametrage?.plages ?? [],
      pasCreneauMinutes: parametrage?.pasCreneauMinutes ?? 0,
      calendrierConnu: parametrage !== null,
    }),
  );

  const pourTechniciens: TechnicienDeJournee[] = cadre.techniciens.map((t) => ({
    id: t.utilisateur_id,
    agenceIds: [t.agence_id],
  }));

  const jours = joursDeLaSemaine(
    jourDemande(parametres.semaine, cadre.fuseau, true),
  ).slice(0, 6);
  const jourAffiche = jourDemande(parametres.jour, cadre.fuseau, false);

  // ── LA FENÊTRE EST EN JOURS, ET SA BORNE HAUTE EST EXCLUSIVE ─────────────
  //
  // `date_planifiee` est un `@db.Date` : la borner à minuit UTC est JUSTE pour
  // l'appartenance au jour, et c'est pour cela que `instantDuJour` existe.
  // *Ce qui était faux était d'employer LES MÊMES BORNES comme des INSTANTS
  // pour le dénominateur du panneau de charge* — sous UTC+11, « vendredi 00:00
  // UTC » est « vendredi 11 h à Nouméa ». La conversion en instants descend
  // désormais dans `occupationsDuPlanning`, où le fuseau de chaque calendrier
  // est connu ; ici, on ne manipule plus que des JOURS.
  const fenetreEnJours =
    vue === "jour"
      ? { du: jourAffiche, au: jourSuivant(jourAffiche) }
      : { du: jours[0], au: jourSuivant(jours[jours.length - 1]) };
  const fenetre = {
    du: instantDuJour(fenetreEnJours.du),
    au: instantDuJour(fenetreEnJours.au),
  };

  const lignes = await listerPlanning(contexte, fenetre.du, fenetre.au);
  // ── LA POPULATION À NOMMER EST CELLE DES COLONNES, PAS CELLE DES LIGNES ──
  //
  // Elle ne venait que des interventions, et la vue jour tire ses colonnes du
  // RÉFÉRENTIEL depuis le 12/09 : *un technicien sans intervention dans la
  // fenêtre n'était jamais soumis à la résolution*, et sa colonne — celle-là
  // même que le 12/09 lui avait rendue — portait un fragment d'identifiant.
  // `personnesANommer` fait l'UNION, une fois, pour les deux vues.
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(tx, personnesANommer(lignes, pourTechniciens)),
  );

  // ── LE PANNEAU DE CHARGE ET LA VUE LISENT LE MÊME JEU ───────────────────
  //
  // Ils ne le lisaient pas. Le panneau recevait la liste BRUTE, la grille une
  // liste filtrée — si bien qu'il comptait la FILE D'ATTENTE (`date_planifiee`
  // nulle, que `listerPlanning` ramène exprès), et, en vue jour, les six jours
  // de la semaine. *Deux chiffres côte à côte, calculés sur deux populations,
  // et rien ne disait lequel croire* (§9, 01/09).
  //
  // **LA RÈGLE A QUITTÉ CE FICHIER le 12/09/2026** — `lib/interventions/
  // affichage.ts`. Filtrer une fois dans l'écran était juste et ne tenait
  // rien : la règle vivait dans une variable locale d'un composant de neuf
  // cents lignes, et le prochain consommateur pouvait recevoir autre chose
  // sans qu'aucun test ne rougisse. `tests/unit/interventions/
  // planning-un-seul-jeu.test.ts` refuse désormais qu'un consommateur reçoive
  // autre chose qu'`affichees`.
  const attente = fileDAttente(lignes);
  const affichees = lignesAffichees(lignes, vue, jourAffiche);
  const charges = await occupationsDuPlanning(
    contexte,
    affichees,
    vue === "jour"
      ? { du: jourAffiche, au: jourSuivant(jourAffiche) }
      : fenetreEnJours,
  );

  // LA COLONNE ET LE PANNEAU LISENT LA MÊME MESURE (D111). `charges` vient
  // d'`affichees`, le jeu unique de `lib/interventions/affichage.ts` : la
  // colonne n'en diffère que par la BRIÈVETÉ du rendu, jamais par sa source.
  // *Deux chiffres côte à côte, calculés sur deux populations, et rien ne dit
  // lequel croire* (§9, 01/09) — c'est la faute que ce planning a déjà commise.
  //
  // ── ET LA MAILLE EST BIEN (technicien, agence), MESURÉE PLUTÔT QUE SUPPOSÉE
  //
  // D111 s'appuie sur le fait qu'*un technicien n'a qu'UNE agence de
  // rattachement*, donc jamais deux taux. C'est vrai de `technicien.agence_id`
  // — et `occupationsDuPlanning` ne rend PAS une ligne par personne : il rend
  // une ligne par **(technicien, agence de l'INTERVENTION)**. Or D112, rendu le
  // même soir, autorise expressément qu'un technicien de Ducos soit posé sur
  // une intervention de Koné.
  //
  // **Les deux décisions se contredisent le premier jour d'un renfort**, et
  // c'est un défaut à signaler, jamais une préséance à appliquer (§1). La voie
  // qui reste ouverte est de MESURER la condition de D111 au lieu de la
  // supposer : une seule ligne, le taux seul ; plusieurs, chacun NOMME son
  // agence — ce que D111 lui-même prescrit pour ce jour-là.
  const chargeParTechnicien = new Map<string, LigneOccupation[]>();
  for (const charge of charges) {
    if (charge.technicienId === null) {
      continue;
    }
    const deja = chargeParTechnicien.get(charge.technicienId) ?? [];
    deja.push(charge);
    chargeParTechnicien.set(charge.technicienId, deja);
  }

  // LE FUSEAU EST CELUI DE L'AGENCE, et la société n'est que le repli — c'est
  // `fuseauDeLAgence` qui décide à l'ÉCRITURE (`lib/interventions/depot.ts`),
  // et deux lectures d'un même critère divergent en silence. Une agence sans
  // fuseau propre retombe sur celui de la société, exactement comme là-bas.
  const fuseauDe = new Map(
    cadre.detaillees.map(({ agence }) => [
      agence.id,
      agence.fuseau_horaire ?? cadre.fuseau,
    ]),
  );
  const minutesDe = (instant: Date, agenceId: string) =>
    minutesDepuisMinuit(
      versLocal(instant, fuseauDe.get(agenceId) ?? cadre.fuseau),
    );

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            {t("planning.titre")}
          </h1>
          <p className="text-app-encre-faible text-[13px]">
            {vue === "jour" ? libelleJour(jourAffiche) : libelleSemaine(jours)}
          </p>
          {/*
            ~~LES DEUX VUES NE MONTRENT PAS LA MÊME POPULATION, ET ELLES LE
            DISENT (14/09/2026)~~ — RETIRÉ LE 17/09/2026 (N-06). C'était
            présenté comme deux choix délibérés ; c'était en réalité le défaut
            le plus grave mesuré sur ce planning, parce qu'il fait DISPARAÎTRE
            un technicien : celui qu'on cherche précisément en ouvrant un
            planning est celui qui n'a rien, et la vue semaine ne lui donnait
            aucune ligne là où la vue jour lui donnait sa colonne. Les deux vues
            tirent désormais leurs lignes et leurs colonnes du MÊME référentiel
            (`pourTechniciens`), et la mention qui expliquait l'écart n'a plus
            d'écart à expliquer.
          */}
          {/*
            LA PORTE DES ABSENCES (R3-14).

            La barre reste close à onze entrées, confrontées à la maquette
            (D95) : *un écran se rejoint par un LIEN*, comme /sites et comme
            /clients. Et c'est ICI qu'il se rejoint plutôt que dans les
            réglages — un blocage d'agenda n'est pas un paramètre de société, c'est un
            fait de planning : elle rend des interventions à la file et elle
            retranche des heures au dénominateur du taux affiché plus bas.
          */}
          <p className="text-[11.5px]">
            <Link href="/absences" className={CLASSES_LIEN}>
              {t("absences.titre")}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Onglets vue={vue} jour={jourAffiche} semaine={jours[0]} />
          <Deplacement vue={vue} jour={jourAffiche} semaine={jours[0]} />
          <LienPrimaire href="/interventions/nouvelle">
            {t("planning.creer")}
          </LienPrimaire>
        </div>
      </header>

      <Posable>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_290px]">
          {vue === "jour" ? (
            <VueJour
              journee={construireJournee(
                affichees,
                jourAffiche,
                pourJournee,
                minutesDe,
                pourTechniciens,
              )}
              annuaire={annuaire}
              jourAffiche={jourAffiche}
            />
          ) : (
            <VueSemaine
              jours={jours}
              grille={construireGrille(
                affichees,
                jours,
                pourGrille,
                (id) => nomSeul(id, annuaire),
                pourTechniciens,
              )}
              annuaire={annuaire}
              chargeDe={chargeParTechnicien}
              fuseauPour={(agenceId) =>
                schemaFuseau.parse(fuseauDe.get(agenceId) ?? cadre.fuseau)
              }
            />
          )}

          <aside className="flex flex-col gap-4">
            <section className="bg-app-surface border-app-bord rounded-[10px] border">
              <h2 className="border-app-bord flex items-center justify-between border-b px-4 py-3.5 text-[14px] font-bold">
                {t("planning.file_attente")}
                <span className="text-app-marque text-[11px] font-semibold">
                  {attente.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2 p-4">
                {attente.length === 0 ? (
                  <p className="text-app-encre-faible text-[12px]">
                    {t("planning.file_vide")}
                  </p>
                ) : null}
                {attente.map((ligne) => (
                  // GLISSER DEPUIS LA FILE VAUT AFFECTATION — c'est l'usage
                  // principal : le dépôt donne à la fois un jour et une personne.
                  <BlocPosable
                    key={ligne.id}
                    interventionId={ligne.id}
                    dureeMin={dureeDe(ligne)}
                  >
                    <Link
                      href={`/interventions/${ligne.id}`}
                      className="border-app-bord block rounded-lg border px-3 py-2.5"
                    >
                      <span className="flex items-center justify-between gap-2 text-[12.5px] font-bold">
                        {referenceAffichee(ligne)}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[ligne.statut]}`}
                        >
                          {t(`priorite.${ligne.priorite}`)}
                        </span>
                      </span>
                      <span className="text-app-encre-faible block text-[12px]">
                        {lieuDeLaLigne(ligne)}
                      </span>
                    </Link>
                  </BlocPosable>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {/*
          LE DÉTAIL DE CHARGE SE POSE SOUS LE PLANNING (N-02, 17/09/2026).

          Il vivait dans le panneau latéral de 290 px, à côté de la file
          d'attente — un écart avec la maquette que rien n'écrivait : elle ne
          pose dans cette colonne QUE la file et les contrôles à la pose, et
          n'y montre aucun panneau de charge. Ce panneau-ci est une donnée que
          la maquette ne prévoit pas, mais l'endroit où on le pose y est
          arbitré : jamais dans la colonne étroite qui vole sa largeur à la
          grille — c'est très exactement elle que le planificateur consulte le
          plus, jours et personnes confondus.
        */}
        <Statistiques lignes={charges} annuaire={annuaire} />
      </Posable>
    </main>
  );
}

type Ligne = Awaited<ReturnType<typeof listerPlanning>>[number];

/* ───────────────────────────── LA VUE SEMAINE ──────────────────────────── */

function VueSemaine({
  jours,
  grille,
  annuaire,
  chargeDe,
  fuseauPour,
}: {
  readonly jours: readonly JourLocal[];
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  readonly annuaire: Annuaire;
  /**
   * LA CHARGE DE CHAQUE PERSONNE, par identifiant (D111).
   *
   * **Elle vient du MÊME jeu que le panneau de charge** — `affichees`, et rien
   * d'autre : *deux chiffres côte à côte, calculés sur deux populations, et
   * rien ne dit lequel croire* (§9, 01/09). La colonne et le panneau lisent
   * donc la même mesure, et n'en diffèrent que par la BRIÈVETÉ du rendu.
   */
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  /**
   * LE FUSEAU DE L'AGENCE DE LA LIGNE — une fonction, jamais une valeur.
   *
   * Une intervention de Koné et une de Ducos peuvent tomber dans la même
   * semaine, et *l'heure affichée est celle de l'agence, jamais celle de
   * l'appareil* (L0-08). Passer un fuseau unique ferait lire les deux sous le
   * même, ce qui est juste aujourd'hui et faux le jour d'une agence
   * métropolitaine.
   */
  readonly fuseauPour: (agenceId: string) => Fuseau;
}) {
  return (
    <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
      {/*
        LA GRILLE NE SE COMPRIME PAS SOUS `lg` (N-02, 17/09/2026).

        Elle défilait horizontalement sur petite largeur — six colonnes
        resserrées dans une fenêtre de téléphone —, ce qui n'est pas une liste
        et n'est plus une grille lisible non plus : *cinq colonnes sur un
        téléphone n'est pas une grille.* La maquette ne dit rien du téléphone,
        elle n'a été pensée que pour un poste de travail ; en dessous de `lg`,
        c'est donc `ListeSemaine`, une liste par personne, qui prend le relais.
      */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-[13px]">
          <colgroup>
            {/* La largeur vient de `lib/theme/apparence.ts` : une largeur
                écrite dans un écran est une largeur par écran (D95). */}
            <col style={{ width: `${LARGEUR_COLONNE_TECHNICIEN_PX}px` }} />
            {jours.map((jour) => (
              <col key={cleJour(jour)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase">
                {t("planning.colonne_technicien")}
              </th>
              {jours.map((jour) => (
                <th
                  key={cleJour(jour)}
                  className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase"
                >
                  {enTeteDeJour(jour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grille.length === 0 ? (
              <tr>
                <td
                  colSpan={jours.length + 1}
                  className="text-app-encre-faible px-3.5 py-6"
                >
                  {t("planning.semaine_vide")}
                </td>
              </tr>
            ) : null}
            {grille.map((ligne) => (
              <tr key={ligne.technicienId ?? "-"}>
                <td className="bg-app-surface-creuse border-app-bord border-r border-b px-3.5 py-2.5 align-top text-[12.5px] font-bold">
                  {quiTravaille(ligne.technicienId, annuaire)}
                  <span className="text-app-encre-faible block text-[10.5px] font-normal">
                    {ouTravaille(ligne.agences.map((a) => a.libelle))}
                  </span>
                  {/*
                    LE TAUX COMPACT (D111) : le pourcentage SEUL, sans le nom de
                    l'agence. *Un technicien n'a qu'une agence de rattachement,
                    donc jamais deux taux* — le chiffre ne peut pas être lu de
                    travers, et la colonne est trop étroite pour porter la
                    formule. Le panneau de charge, lui, la porte toujours.
                  */}
                  <TauxCompactAffiche
                    lignes={chargeDe.get(ligne.technicienId ?? "") ?? []}
                  />
                </td>
                {ligne.cases.map((cellule) => (
                  <CasePosable
                    key={cleJour(cellule.jour)}
                    cible={{
                      jour: cleJour(cellule.jour),
                      technicienId: ligne.technicienId,
                      minutes: null,
                      // La vue SEMAINE n'a pas d'heure, donc pas de pas : elle
                      // déplace des jours, jamais des durées.
                      pasMinutes: 0,
                    }}
                    className={`border-app-bord border-r border-b p-1.5 align-top ${
                      cellule.ouverte === false ? "trame-fermee" : ""
                    }`}
                    style={{ height: "78px" }}
                  >
                    {cellule.lignes.map((intervention) => (
                      <BlocPosable
                        key={intervention.id}
                        interventionId={intervention.id}
                        dureeMin={dureeDe(intervention)}
                      >
                        <Link
                          href={`/interventions/${intervention.id}`}
                          className={`mb-1 block rounded-[5px] border-l-[3px] px-1.5 py-1 text-[11px] leading-snug ${CLASSES_BLOC[intervention.statut]}`}
                        >
                          {/*
                            LA MAQUETTE FAIT FOI SUR LA DISPOSITION (D95) :
                            « 08:00 Garage Boulari » puis « Préventif — pont
                            2 col. ». Le bloc rendait une référence interne, le
                            client ET le site — trois écarts, et `creneau_debut`
                            était lu depuis toujours sans jamais être affiché.
                          */}
                          <span className="block font-bold">
                            {enTeteDuBloc(
                              intervention,
                              fuseauPour(intervention.agence_id),
                            )}
                          </span>
                          {objetDuBloc(intervention)}
                        </Link>
                      </BlocPosable>
                    ))}
                  </CasePosable>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListeSemaine
        grille={grille}
        annuaire={annuaire}
        chargeDe={chargeDe}
        fuseauPour={fuseauPour}
      />
      <Legende />
    </section>
  );
}

/**
 * LA LISTE — la même donnée que la grille, sous `lg` (N-02, 17/09/2026).
 *
 * Une personne, une carte : son nom, ses agences, son taux, puis SES SEULS
 * jours qui portent quelque chose cette semaine. **Un jour vide n'a pas de
 * ligne** — le jour fermé compris : une trame veut dire quelque chose sur une
 * grille où chaque case existe déjà ; dans une liste qui ne montre que ce qui
 * est rempli, l'absence d'un jour dit déjà qu'il n'y a rien à y montrer, et
 * gonfler la liste avec six jours hachurés par personne serait revenir à la
 * densité qu'une liste existe pour éviter.
 *
 * **Une personne dont la semaine est VIDE n'est pas retirée de la liste** —
 * c'est très exactement N-06 : *le technicien qu'on cherche en ouvrant un
 * planning est celui qui n'a rien.* Sa carte le dit, avec le seul mot que la
 * réserve absolue autorise : `t("planning.technicien_sans_intervention")` —
 * jamais « disponible », qui affirmerait un état sur les absences et les
 * trajets que cet écran n'a pas lus.
 */
function ListeSemaine({
  grille,
  annuaire,
  chargeDe,
  fuseauPour,
}: {
  readonly grille: ReturnType<typeof construireGrille<Ligne>>;
  readonly annuaire: Annuaire;
  readonly chargeDe: ReadonlyMap<string, readonly LigneOccupation[]>;
  readonly fuseauPour: (agenceId: string) => Fuseau;
}) {
  if (grille.length === 0) {
    return (
      <p className="text-app-encre-faible border-app-bord border-t px-4 py-6 text-[13px] lg:hidden">
        {t("planning.semaine_vide")}
      </p>
    );
  }
  return (
    <ul className="divide-app-bord border-app-bord divide-y border-t lg:hidden">
      {grille.map((ligne) => (
        <li key={ligne.technicienId ?? "-"} className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-bold">
                {quiTravaille(ligne.technicienId, annuaire)}
              </p>
              <p className="text-app-encre-faible text-[10.5px]">
                {ouTravaille(ligne.agences.map((a) => a.libelle))}
              </p>
            </div>
            <TauxCompactAffiche
              lignes={chargeDe.get(ligne.technicienId ?? "") ?? []}
            />
          </div>
          {ligne.total === 0 ? (
            <p className="text-app-encre-faible mt-2 text-[12px] italic">
              {t("planning.technicien_sans_intervention")}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {ligne.cases
                .filter((cellule) => cellule.lignes.length > 0)
                .map((cellule) => (
                  <li key={cleJour(cellule.jour)}>
                    <p className="text-app-encre-faible text-[10.5px] font-bold tracking-wide uppercase">
                      {enTeteDeJour(cellule.jour)}
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {cellule.lignes.map((intervention) => (
                        <BlocPosable
                          key={intervention.id}
                          interventionId={intervention.id}
                          dureeMin={dureeDe(intervention)}
                        >
                          <Link
                            href={`/interventions/${intervention.id}`}
                            className={`block rounded-[5px] border-l-[3px] px-2 py-1.5 text-[11.5px] leading-snug ${CLASSES_BLOC[intervention.statut]}`}
                          >
                            <span className="block font-bold">
                              {enTeteDuBloc(
                                intervention,
                                fuseauPour(intervention.agence_id),
                              )}
                            </span>
                            {objetDuBloc(intervention)}
                          </Link>
                        </BlocPosable>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────────── LA VUE JOUR ────────────────────────────── */

function VueJour({
  journee,
  annuaire,
  jourAffiche,
}: {
  readonly journee: ReturnType<typeof construireJournee<Ligne>>;
  readonly annuaire: Annuaire;
  readonly jourAffiche: JourLocal;
}) {
  // L'ÉTAT VIDE N'AVALE PLUS CE QUI N'EST PAS DESSINABLE. Sans axe — aucune
  // agence n'a de calendrier — il n'y a pas de grille à montrer ; il peut
  // pourtant y avoir des interventions ce jour-là, et « aucune intervention
  // posée » serait alors un mensonge de plus.
  if (journee.axe.length === 0 || journee.colonnes.length === 0) {
    return (
      <section className="bg-app-surface border-app-bord rounded-[10px] border">
        <p className="text-app-encre-faible px-4 py-6 text-[13px]">
          {t("planning.jour_vide")}
        </p>
        <HorsGrille journee={journee} annuaire={annuaire} />
      </section>
    );
  }
  return (
    <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
      <p className="border-app-bord text-app-encre-faible border-b px-4 py-3 text-[12.5px]">
        {resumeDesTrous(journee.creneauxLibres, journee.pasMinutes)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[12px]">
          <colgroup>
            <col style={{ width: "78px" }} />
            {journee.colonnes.map((colonne) => (
              <col key={colonne.technicienId ?? "-"} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-b px-2 py-2.5 text-left text-[10.5px] font-bold tracking-wider uppercase">
                {t("planning.colonne_heure")}
              </th>
              {journee.colonnes.map((colonne) => (
                <th
                  key={colonne.technicienId ?? "-"}
                  className="bg-app-surface-creuse border-app-bord border-b px-2.5 py-2.5 text-left text-[12px] font-bold"
                >
                  {quiTravaille(colonne.technicienId, annuaire)}
                  <span className="text-app-encre-faible block text-[10.5px] font-normal">
                    {ouTravaille(colonne.agences.map((a) => a.libelle))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journee.axe.map((debut, rang) => (
              <tr key={debut}>
                <th className="bg-app-surface-creuse border-app-bord text-app-encre-faible border-r border-b px-2 py-1 text-left align-top text-[11px] font-semibold">
                  {enHeure(debut)}
                </th>
                {journee.colonnes.map((colonne) => {
                  const cellule = colonne.cellules[rang];
                  return (
                    <CasePosable
                      key={colonne.technicienId ?? "-"}
                      cible={{
                        jour: cleJour(jourAffiche),
                        technicienId: colonne.technicienId,
                        minutes: debut,
                        // Le pas vient de la VUE, réglé au plus fin des agences
                        // présentes — jamais d'une constante écrite ici.
                        pasMinutes: journee.pasMinutes,
                      }}
                      className={`border-app-bord border-r border-b p-0 align-top ${classeDeCellule(cellule.etat)}`}
                      style={{ height: "26px" }}
                    >
                      {/*
                        TOUTES les occupations, côte à côte — jamais la
                        première seule. Un chevauchement se VOIT : deux blocs
                        étroits dans la même case. *Le masquer faisait poser une
                        troisième personne sur un créneau déjà doublé.*
                      */}
                      {cellule.occupations.length === 0 ? null : (
                        <div className="flex h-full gap-px">
                          {cellule.occupations.map(
                            ({ ligne: occupation, debutDeBloc }) => {
                              const lien = (
                                <Link
                                  href={`/interventions/${occupation.id}`}
                                  className={`block h-full border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight ${CLASSES_BLOC[occupation.statut]}`}
                                >
                                  {debutDeBloc ? (
                                    <>
                                      <span className="block font-bold">
                                        {referenceAffichee(occupation)}
                                      </span>
                                      {occupation.client.raison_sociale}
                                    </>
                                  ) : null}
                                </Link>
                              );
                              return (
                                <div
                                  key={occupation.id}
                                  className="min-w-0 flex-1"
                                >
                                  {debutDeBloc ? (
                                    <BlocPosable
                                      interventionId={occupation.id}
                                      dureeMin={dureeDe(occupation)}
                                      // Le début est celui de la CASE où le bloc
                                      // commence : la poignée n'apparaît que là,
                                      // et `debutDeBloc` le garantit.
                                      // Redimensionner depuis le milieu d'un bloc
                                      // demanderait de savoir où il a commencé, et
                                      // cette case ne le sait pas.
                                      debutMinutes={debut}
                                      className="h-full"
                                    >
                                      {lien}
                                    </BlocPosable>
                                  ) : (
                                    // La SUITE d'un bloc n'est pas prenable :
                                    // prendre une intervention par son milieu
                                    // déplacerait son début sans que rien ne le
                                    // dise.
                                    lien
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </CasePosable>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-app-encre-faible flex flex-wrap items-center gap-4 px-4 py-3 text-[11.5px]">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-bleu-fond border-app-bleu-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_occupe")}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-surface border-app-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_libre")}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-app-gris-fond border-app-bord inline-block h-3 w-3 rounded-[3px] border"
          />
          {t("planning.jour_hors_ouverture")}
        </li>
      </ul>
      <HorsGrille journee={journee} annuaire={annuaire} />
    </section>
  );
}

/**
 * L'aplat d'une cellule. **Le créneau LIBRE est la surface la plus claire** —
 * c'est lui qu'on cherche, et un trou doit sauter aux yeux sans qu'on le
 * cherche. « Hors ouverture » est creux mais uni : *une trame veut dire une
 * seule chose*, et la hachure appartient au jour non ouvert de la vue semaine.
 *
 * **La cellule OCCUPÉE ne porte pas d'aplat ici**, et ce n'est pas un oubli :
 * elle est entièrement recouverte par le bloc, qui porte la couleur du STATUT.
 * *Mesuré à la première capture : seule la première ligne d'une intervention
 * était peinte, et les suivantes — blanches — se lisaient comme des créneaux
 * libres. Une intervention de deux heures paraissait en durer trente minutes,
 * sur l'écran même dont l'objet est de montrer ce qui est pris.*
 */
function classeDeCellule(etat: "occupe" | "libre" | "hors_ouverture"): string {
  if (etat === "hors_ouverture") return "bg-app-gris-fond";
  return "bg-app-surface";
}

function Legende() {
  return (
    <ul className="text-app-encre-faible flex flex-wrap items-center gap-4 px-4 py-3 text-[11.5px]">
      {LEGENDE_PLANNING.map((entree) => (
        <li key={entree.cle} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-[3px] border ${entree.classes}`}
          />
          {estCleTraduction(entree.cle) ? t(entree.cle) : entree.cle}
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────── LA BASCULE ────────────────────────────── */

function Onglets({
  vue,
  jour,
  semaine,
}: {
  readonly vue: "semaine" | "jour";
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
}) {
  const classes = "rounded-md px-3 py-2 text-[12.5px] font-bold";
  return (
    <div className="border-app-bord flex gap-0.5 rounded-md border p-0.5">
      <Link
        href={`/planning?vue=semaine&semaine=${cleJour(semaine)}`}
        aria-current={vue === "semaine" ? "page" : undefined}
        className={
          vue === "semaine"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_semaine")}
      </Link>
      <Link
        href={`/planning?vue=jour&jour=${cleJour(jour)}`}
        aria-current={vue === "jour" ? "page" : undefined}
        className={
          vue === "jour"
            ? `${classes} bg-app-marque text-app-marque-encre`
            : `${classes} text-app-encre-faible`
        }
      >
        {t("planning.vue_jour")}
      </Link>
    </div>
  );
}

function Deplacement({
  vue,
  jour,
  semaine,
}: {
  readonly vue: "semaine" | "jour";
  readonly jour: JourLocal;
  readonly semaine: JourLocal;
}) {
  const pas = vue === "jour" ? 1 : 7;
  const depart = vue === "jour" ? jour : semaine;
  const lien = (decalage: number) => {
    const cible = decale(depart, decalage);
    return vue === "jour"
      ? `/planning?vue=jour&jour=${cleJour(cible)}`
      : `/planning?vue=semaine&semaine=${cleJour(cible)}`;
  };
  const classes =
    "border-app-bord text-app-encre-faible rounded-md border px-2.5 py-2 text-[12.5px] font-semibold";
  return (
    <div className="flex items-center gap-2">
      <Link href={lien(-pas)} className={classes}>
        {t(vue === "jour" ? "planning.jour_avant" : "planning.semaine_avant")}
      </Link>
      <Link href={lien(pas)} className={classes}>
        {t(vue === "jour" ? "planning.jour_apres" : "planning.semaine_apres")}
      </Link>
    </div>
  );
}

/* ──────────────────────────── LES COMPOSITIONS ─────────────────────────── */

/**
 * Le jour demandé, ou celui d'aujourd'hui.
 *
 * Une valeur illisible ne fait pas échouer l'écran — elle retombe sur le jour
 * courant. *Un paramètre d'URL vient de l'extérieur* (L1-02f) : le traiter
 * comme une erreur donnerait à n'importe qui le moyen de casser la page en
 * forgeant un lien.
 */
function jourDemande(
  demande: string | string[] | undefined,
  fuseau: string,
  versLundi: boolean,
): JourLocal {
  const defaut = maintenant(fuseau).local;
  const lu =
    typeof demande === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(demande)
      : null;
  const jour =
    lu === null
      ? defaut
      : {
          annee: Number(lu[1]),
          mois: Number(lu[2]),
          jour: Number(lu[3]),
        };
  const valide =
    jour.mois >= 1 && jour.mois <= 12 && jour.jour >= 1 && jour.jour <= 31
      ? jour
      : defaut;
  return versLundi ? lundiDeLaSemaine(valide) : valide;
}

function decale(jour: JourLocal, jours: number): JourLocal {
  const date = new Date(0);
  date.setUTCFullYear(jour.annee, jour.mois - 1, jour.jour + jours);
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/**
 * Les compositions sortent du JSX : un littéral n'y est pas admis (L0-11), et
 * ce qui se lit à l'écran vient du dictionnaire, jamais de la balise.
 */
function libelleSemaine(jours: readonly JourLocal[]): string {
  const { semaine } = semaineIso(jours[0]);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  return `${t("planning.semaine")} ${semaine} — ${t("planning.du")} ${premier.jour} ${t("planning.au")} ${dernier.jour}/${String(dernier.mois).padStart(2, "0")}/${dernier.annee}`;
}

function libelleJour(jour: JourLocal): string {
  const cle = `jour.${jourSemaineIso(jour)}`;
  const nom = estCleTraduction(cle) ? t(cle) : "";
  return `${nom} ${jour.jour}/${String(jour.mois).padStart(2, "0")}/${jour.annee}`.trim();
}

/**
 * « Lun 17 » — l'en-tête d'une colonne.
 *
 * Le jour de la semaine vient de `jourSemaineIso`, qui passe par une date UTC
 * et jamais par `getDay()` : cet accesseur lirait le fuseau de l'appareil.
 */
function enTeteDeJour(jour: JourLocal): string {
  const cle = `jour.court.${jourSemaineIso(jour)}`;
  return `${estCleTraduction(cle) ? t(cle) : ""} ${jour.jour}`.trim();
}

/**
 * LE COMPTE DES TROUS, écrit à côté de la grille.
 *
 * *« Un créneau libre doit se distinguer au premier coup d'œil, sinon l'écran
 * ne sert à rien. »* Le chiffre est là pour que l'utilité de l'écran se mesure
 * au lieu de s'apprécier — et pour qu'une régression qui remplirait les trous
 * se voie tout de suite.
 */
/**
 * CE QUE LA GRILLE NE PEUT PAS DESSINER, ET QU'ELLE DIT (12/09/2026).
 *
 * Trois disparitions silencieuses vivaient dans cette vue : la seconde d'un
 * chevauchement (réparée dans la cellule), l'intervention datée SANS HEURE, et
 * celle dont le créneau tombe hors de l'axe. *Les deux dernières ne peuvent pas
 * être placées sans inventer une heure que personne n'a saisie ; elles sont
 * donc NOMMÉES, jamais effacées.*
 *
 * Le bloc n'apparaît pas quand il n'y a rien à dire : *un « 0 » à cet endroit
 * se lirait comme une mesure*, et il n'y en a pas à faire.
 */
function HorsGrille({
  journee,
  annuaire,
}: {
  readonly journee: Journee<Ligne>;
  readonly annuaire: Annuaire;
}) {
  if (journee.horsGrille === 0) return null;
  return (
    <section className="border-app-bord bg-app-surface-creuse border-t px-4 py-3">
      <h3 className="text-[12px] font-bold">
        {t("planning.jour_hors_grille")}
        <span className="text-app-marque ml-2 text-[11px] font-semibold">
          {journee.horsGrille}
        </span>
      </h3>
      <p className="text-app-encre-faible text-[11.5px]">
        {t("planning.jour_hors_grille_aide")}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {journee.colonnes.flatMap((colonne) =>
          colonne.horsGrille.map(({ ligne, motif }) => (
            <li key={ligne.id} className="text-[12px]">
              <Link
                href={`/interventions/${ligne.id}`}
                className={`font-bold ${CLASSES_LIEN}`}
              >
                {referenceAffichee(ligne)}
              </Link>
              <span className="text-app-encre-faible">
                {ligneHorsGrille(colonne.technicienId, motif, annuaire)}
              </span>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

/**
 * La ligne entière — composée HORS du JSX, où un littéral n'est pas admis
 * (L0-11), et le séparateur en est un.
 */
function ligneHorsGrille(
  technicienId: string | null,
  motif: MotifHorsGrille,
  annuaire: Annuaire,
): string {
  return ` — ${quiTravaille(technicienId, annuaire)} — ${motifHorsGrille(motif)}`;
}

/** Le libellé d'un motif — au dictionnaire, jamais dans la balise (L0-11). */
function motifHorsGrille(motif: MotifHorsGrille): string {
  return motif === "sans_creneau"
    ? t("planning.jour_hors_grille_sans_creneau")
    : t("planning.jour_hors_grille_hors_axe");
}

function resumeDesTrous(libres: number, pasMinutes: number): string {
  return `${libres} ${t("planning.creneaux_libres")} · ${t("planning.pas")} ${pasMinutes} min`;
}

/**
 * LE TAUX COMPACT — trois états, trois libellés, et aucun ne se confond (D111).
 *
 * **Une personne sans ligne de charge ne rend RIEN** — pas « 0 % ». C'est le cas
 * d'un technicien dont aucune intervention n'est affichée cette semaine : *il
 * n'a pas un taux de zéro, il n'a pas de taux*, et la colonne se tait plutôt que
 * d'affirmer.
 */
function TauxCompactAffiche({
  lignes,
}: {
  readonly lignes: readonly LigneOccupation[];
}) {
  if (lignes.length === 0) {
    return null;
  }
  // UNE SEULE AGENCE : le taux SEUL, c'est D111 dans sa condition de validité.
  // PLUSIEURS : chacun nomme la sienne — *cet affichage devient ambigu et devra
  // nommer l'agence*, écrit D111 lui-même. Le voici, sans attendre le jour.
  const nommer = lignes.length > 1;
  return (
    <>
      {lignes.map((ligne) => (
        <TauxDUneAgence
          key={ligne.agenceId}
          ligne={ligne}
          nommerLAgence={nommer}
        />
      ))}
    </>
  );
}

function TauxDUneAgence({
  ligne,
  nommerLAgence,
}: {
  readonly ligne: LigneOccupation;
  readonly nommerLAgence: boolean;
}) {
  const compact = tauxCompact(ligne.occupation);
  const ou = nommerLAgence ? `${ligne.agenceLibelle} ` : "";
  if (compact.etat === "sans_calendrier") {
    return (
      <span
        title={t("statistiques.taux_compact_sans_calendrier.aide")}
        className="text-app-encre-faible block text-[10.5px] font-normal italic"
      >
        {ou}
        {t("statistiques.taux_compact_sans_calendrier")}
      </span>
    );
  }
  return (
    <span className="text-app-encre-faible block text-[11px] font-bold">
      {ou}
      {compact.etat === "infime"
        ? t("statistiques.taux_infime")
        : `${compact.pourcent}${t("statistiques.pourcent")}`}
    </span>
  );
}

function lieuDeLaLigne(ligne: Ligne): string {
  return `${ligne.client.raison_sociale} · ${mot("site")} ${ligne.site.libelle}`;
}

/**
 * OÙ — et la ligne en porte désormais PLUSIEURS, puisque la maille est la
 * personne. Aucune n'est choisie : elles sont toutes nommées, séparées par une
 * virgule. *Choisir la principale ferait basculer le libellé d'une semaine à
 * l'autre, exactement ce que `occupation.ts` refuse pour le dénominateur.*
 *
 * ## LES SPÉCIALITÉS N'Y SONT PAS, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * La maquette écrit **« agence · spécialités »** sous le nom du technicien.
 * **Aucune table ne porte de spécialité** : `grep -n "competence\|specialite"`
 * sur `prisma/schema.prisma` et sur `lib/` rend **zéro ligne** (mesuré le
 * 12/09/2026). Le cahier des charges les distingue d'ailleurs des
 * **habilitations**, qui existent, elles — `technicien_habilitation` (L1-04) —
 * et qui ne sont pas la même notion : *une habilitation est un droit daté qui
 * expire, une spécialité est un savoir-faire.* Afficher les unes à la place des
 * autres montrerait un droit périmé comme une compétence.
 *
 * *Une sous-ligne qui porterait un séparateur suivi de rien dirait que la
 * donnée manque* là où il n'y a rien à afficher — le motif de blocage de R2-13,
 * appliqué avant de commettre la faute.
 */
function ouTravaille(libelles: readonly string[]): string {
  if (libelles.length === 0) return "";
  return `${mot("agence")} ${libelles.join(", ")}`;
}

/**
 * LA DURÉE D'UNE INTERVENTION, pour la conserver au déplacement.
 *
 * Le créneau posé d'abord — c'est la durée RÉELLEMENT réservée —, l'estimation
 * ensuite, et jamais un chiffre écrit ici : *une valeur par défaut qui répond à
 * une question qu'on n'a pas posée est une décision prise par personne* (§9,
 * 24/08). Une intervention sans l'un ni l'autre ne se déplace pas à l'heure :
 * elle se déplace au jour, et la vue semaine est faite pour cela.
 */
function dureeDe(ligne: Ligne): number {
  if (ligne.creneau_debut !== null && ligne.creneau_fin !== null) {
    return Math.round(
      (ligne.creneau_fin.getTime() - ligne.creneau_debut.getTime()) / 60_000,
    );
  }
  return ligne.duree_estimee_min ?? 0;
}
