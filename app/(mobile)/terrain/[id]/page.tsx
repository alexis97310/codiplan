import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { BandeauCompteurEnCours } from "@/components/terrain/bandeau-compteur";
import {
  contactAffiche,
  creneauDeLaFiche,
  heureLocale,
} from "@/components/terrain/presentation";
import { SignatureTerrain } from "@/components/interventions/signature-terrain";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { Button } from "@/components/ui/button";
import { Priorite } from "@/components/ui/priorite";
import { type ContexteActif } from "@/lib/auth/contexte";
import { obtenirSession } from "@/lib/auth/session";
import { enDuree } from "@/lib/calendar/duree";
import { photosDeLIntervention } from "@/lib/documents/depot";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  peutDemarrerLeCompteur,
  peutTerminer,
} from "@/lib/interventions/cycle-de-vie";
import {
  lireFicheIntervention,
  marquerVuParTechnicien,
} from "@/lib/interventions/depot";
import {
  compteurEnCours,
  mesureDeLIntervention,
} from "@/lib/interventions/depot-compteur";
import {
  derniereSignature,
  lireRapportTexte,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";
import { perimetreDuPlanning } from "@/lib/interventions/perimetre-technicien";
import { donneesMaterielDesMachines } from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { listerLesPrestations } from "@/lib/prestations/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT, type StatutAffiche } from "@/lib/theme/statuts";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";

/**
 * LE TITRE D'ONGLET EST LE CLIENT (TR-24, audit du 28/09/2026) — jamais
 * « Ma journée », qui est le titre de la LISTE, pas celui d'une fiche.
 * `generateMetadata` plutôt qu'un export statique : le titre dépend de la
 * fiche, lue sous le même périmètre que la page elle-même — un technicien
 * hors périmètre reçoit le même titre neutre que l'introuvable qu'il verra.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await obtenirSession(await headers());
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null
  ) {
    return { title: t("terrain.titre") };
  }
  const contexte: ContexteActif = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };
  const { id } = await params;
  const fiche = await lireFicheIntervention(contexte, id);
  return { title: fiche?.client ?? t("terrain.titre") };
}

/**
 * UNE INTERVENTION, VUE DU TERRAIN — et son compteur (R5-01, R5-02, D119).
 *
 * ## CE QU'ELLE MONTRE, ET CE QU'ELLE NE MONTRE PAS
 *
 * De quoi savoir où l'on va et ce qu'on y fait : le client, le lieu, le type,
 * le créneau, le statut. **Aucun montant** — la matrice du §5.2 ne donne au
 * technicien aucun `voir_montants_vente`, et un gardien statique le tient. Pas
 * de prix calculé, pas de taux horaire, pas de forfait.
 *
 * ## LE COMPTEUR, ET LES DEUX FAÇONS DONT IL PEUT REFUSER
 *
 * Le bouton proposé n'est pas choisi d'après CETTE intervention mais d'après le
 * **compteur de la personne** : si un compteur tourne ailleurs, l'écran le dit
 * et nomme l'autre intervention plutôt que de proposer un départ que la base
 * refuserait. *Proposer une action qui sera refusée est une promesse qu'on ne
 * tient pas* — et ici la promesse coûte un aller-retour sur un réseau de
 * brousse.
 *
 * ## DÉMARRER LE COMPTEUR, C'EST DÉMARRER L'INTERVENTION (D120)
 *
 * *« Il pourra démarrer son intervention, et qu'à ce moment le compteur
 * commence. »* Un seul geste, un seul bouton : l'intervention passe **en
 * cours** et le compteur part. **Aucune machine n'est exigée** — une
 * intervention peut porter sur autre chose qu'un équipement.
 *
 * Le bouton s'appelle donc « Démarrer l'intervention », et non « démarrer le
 * compteur » : *un libellé qui ne nomme que la moitié de ce qu'un bouton fait
 * est un libellé qui surprend.*
 *
 * **Et il n'y a toujours qu'UN bouton d'arrêt**, nommé « pause ». Sur les
 * segments, mettre en pause et arrêter sont le même geste — *en offrir deux qui
 * font la même chose serait mentir sur l'un des deux.* Ce qui les
 * distinguerait est de TERMINER l'intervention, et ce geste-là n'existe encore
 * nulle part.
 *
 * ## LE TEMPS AFFICHÉ EST CELUI DES SEGMENTS FERMÉS
 *
 * Un compteur qui tourne n'est pas ajouté au total : il est annoncé à part,
 * avec son heure de départ. *Un total qui change tout seul entre deux
 * rafraîchissements ne se relit pas*, et c'est le motif de D85 appliqué à un
 * nombre.
 */
export default async function PageInterventionTerrain({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ motif?: string }>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null || session.contexte.role === null) {
    redirect("/arrivee");
  }
  const contexte: ContexteActif = {
    ...session.contexte,
    societeId: session.contexte.societeId,
    role: session.contexte.role,
  };

  const perimetre = perimetreDuPlanning(contexte);
  if (perimetre.acces === "complet") {
    redirect("/planning");
  }
  if (perimetre.acces === "aucun") {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;

  // La fiche est lue SOUS la restriction par personne : l'intervention d'un
  // autre technicien est « introuvable », et rien de plus (D35, D50).
  const fiche = await lireFicheIntervention(contexte, id);
  if (fiche === null) {
    notFound();
  }

  // LE TERRAIN NE VOIT QUE LE TRANSMIS (9DD-PG-G14C-TERRAIN-TRANSMISES, D141
  // 14C) — une PLANIFIEE est encore préparée par le bureau et n'a jamais été
  // transmise à ce technicien. Même rendu que l'introuvable, et AVANT que
  // `marquerVuParTechnicien` ne pose l'instant : une fiche qui n'a pas le
  // droit d'être vue ne doit pas non plus être marquée vue.
  if (fiche.ligne.statut === "planifiee") {
    notFound();
  }

  // LE BADGE « NOUVEAU » S'EFFACE ICI (AVERTISSEMENTS-1) — cette page n'est
  // atteignable, par construction (`perimetre.acces === "restreint"`
  // ci-dessus), que par le technicien dont c'est le périmètre : la fiche
  // vient d'ailleurs d'être lue SOUS `restrictionParPersonne`, donc c'est
  // FORCÉMENT le technicien affecté qui la regarde. `marquerVuParTechnicien`
  // re-vérifie quand même l'identité dans son propre `where` (défense en
  // profondeur), et ne pose l'instant qu'une seule fois — `vue_technicien_le`
  // reste celui de la PREMIÈRE ouverture.
  await marquerVuParTechnicien(contexte, id);

  const mesure = await mesureDeLIntervention(contexte, id);
  const enCours = await compteurEnCours(contexte);
  const ailleurs =
    enCours !== null && enCours.interventionId !== id ? enCours : null;
  const ici = enCours !== null && enCours.interventionId === id;

  const ligne = fiche.ligne;
  const statut = ligne.statut as StatutAffiche;

  // ── LE RAPPORT DE TERRAIN (ticket 17-BON-2) ──────────────────────────────
  //
  // Cinq lectures indépendantes, comme `lireBonIntervention` : chacune tient
  // sa propre politique de cloisonnement, et les mêler en une seule
  // dupliquerait le critère de visibilité que chacune vérifie déjà.
  const [
    rapportTexte,
    prestationsCatalogue,
    prestationsFaites,
    photos,
    signature,
  ] = await Promise.all([
    lireRapportTexte(contexte, id),
    listerLesPrestations(contexte),
    prestationsRealisees(contexte, id),
    photosDeLIntervention(contexte, id),
    derniereSignature(contexte, id),
  ]);
  const prestationsActives = prestationsCatalogue.filter((p) => p.actif);
  const idsRealises = new Set(
    (prestationsFaites ?? []).map((p) => p.prestation_id),
  );

  // TERMINER (9DE-TP-CY1) — jugé ici, à l'écran, exactement comme le fait
  // `peutDemarrerLeCompteur` plus haut : le refus s'affiche À LA PLACE du
  // bouton, avec sa raison, jamais un bouton grisé qu'il suffirait d'insister.
  const verdictTerminer = peutTerminer(
    statut,
    mesure.minutes,
    signature?.issue ?? null,
  );

  // DÉMARRER NE PART QUE DE CE QUE D8 PERMET (QT-4, D160,
  // 9DF-TP-CY2-MATRICE-D8) — une « À planifier » déplanifiée (technicien
  // conservé, SAV-05) reste visible ici (seule « Planifiée » est écartée plus
  // haut) mais n'a plus de créneau à démarrer : le refus prend la place du
  // bouton, jamais un bouton qu'une requête forgée ferait échouer en silence.
  const verdictDemarrer = peutDemarrerLeCompteur(statut);

  // LES MACHINES DE L'INTERVENTION, TOUTES (9DI-TP-TER1-JOURNEE-FICHE) —
  // même composition que la fiche du bureau (`donneesMaterielDesMachines` +
  // `libelleMaterielComplet`, `app/(back-office)/interventions/[id]/
  // page.tsx`), jamais une seconde forme du même libellé (§9, 01/09).
  const donneesMateriel = await donneesMaterielDesMachines(
    contexte,
    ligne.machines.map((m) => m.machine_id),
  );
  const libellesMachines = ligne.machines
    .map((m) => donneesMateriel.get(m.machine_id))
    .filter(
      (donnees): donnees is NonNullable<typeof donnees> =>
        donnees !== null && donnees !== undefined,
    )
    .map(libelleMaterielComplet);

  const contact = contactAffiche(
    fiche.contact === null
      ? null
      : {
          nom: fiche.contact,
          telephone: fiche.contactTelephone,
          mobile: fiche.contactMobile,
        },
  );

  // INTERVENTION EN COURS, COMPTEUR EN PAUSE (TR-16) — aucun segment ouvert
  // ICI ni ailleurs, mais le statut dit qu'elle a déjà démarré : la MÊME
  // route, la MÊME règle, un libellé différent (D120, et voir le docblock
  // ci-dessus).
  const enPause = !ici && ailleurs === null && ligne.statut === "en_cours";

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link href="/terrain" className={`text-16 font-bold ${CLASSES_LIEN}`}>
          {t("terrain.retour")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Priorite valeur={ligne.priorite} />
          <h1 className="text-18 font-extrabold tracking-tight">
            {fiche.client ?? t("terrain.client_inconnu")}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-12 font-bold ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </div>
      </header>

      {ailleurs === null ? null : (
        // LE FUSEAU DE `ailleurs`, PAS CELUI DE LA FICHE CONSULTÉE (corrigé à
        // la relecture de 9DI, T7, publiée a058705c) : `ailleurs` est une
        // AUTRE intervention, potentiellement d'une autre agence (D5).
        <BandeauCompteurEnCours
          interventionId={ailleurs.interventionId}
          client={ailleurs.client}
          depuis={ailleurs.segment.debut}
          fuseau={ailleurs.fuseau}
        />
      )}

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
        <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-2.5 text-16 font-bold">
          <Ligne
            libelle={t("intervention.reference")}
            valeur={referenceAffichee(ligne)}
          />
          <Ligne
            libelle={t("intervention.reference_client")}
            valeur={ligne.reference_client}
          />
          <Ligne libelle={mot("site")} valeur={fiche.lieu} />
          <Ligne
            libelle={t("intervention.type")}
            valeur={libelleDuType(ligne.type)}
          />
          <Ligne
            libelle={t("terrain.creneau")}
            valeur={creneauDeLaFiche(ligne, fiche.fuseau)}
          />
        </dl>
      </section>

      {ligne.description === null ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.panne_signalee")}
          </h2>
          <p className="text-16 font-bold">{ligne.description}</p>
        </section>
      )}

      {libellesMachines.length === 0 ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.machine")}
          </h2>
          <ul className="flex flex-col gap-1.5 text-16 font-bold">
            {libellesMachines.map((libelle) => (
              <li key={libelle}>{libelle}</li>
            ))}
          </ul>
        </section>
      )}

      {contact === null ? null : (
        <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("intervention.contact_sur_place")}
          </h2>
          <p className="text-16 font-bold">{contact.nom}</p>
          {contact.numeros.length === 0 ? (
            <p className="text-app-encre-faible text-16 font-bold">
              {t("terrain.contact_sans_numero")}
            </p>
          ) : (
            <p className="flex flex-wrap gap-3">
              {contact.numeros.map((numero) => (
                <a
                  key={numero}
                  href={`tel:${numero}`}
                  className={`text-16 font-bold ${CLASSES_LIEN}`}
                >
                  {numero}
                </a>
              ))}
            </p>
          )}
        </section>
      )}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.compteur")}
        </h2>

        {/*
          `2 h 15` — et `0 min` quand rien n'a été mesuré, jamais un tiret
          (D88 appliqué à une durée) : un tiret dirait « on ne sait pas », ici
          on sait, et la réponse est zéro.
        */}
        <p className="text-[28px] font-extrabold tabular-nums">
          {enDuree(mesure.minutes)}
        </p>
        <p className="text-app-encre-faible text-16 font-bold">
          {t("terrain.compteur.ferme")}
        </p>

        {ici && enCours !== null ? (
          <p className="text-app-rouge-encre bg-app-rouge-fond rounded-md px-3 py-2 text-16 font-bold">
            {t("terrain.compteur.tourne_depuis")}{" "}
            {heureLocale(enCours.segment.debut, fiche.fuseau)}
          </p>
        ) : null}

        {ailleurs !== null ? (
          // LE REFUS PREND LA PLACE DE L'ACTION, avec sa raison — jamais un
          // bouton grisé, qui laisse croire qu'il suffirait d'insister.
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {t("terrain.compteur.ailleurs")}{" "}
            <Link
              href={`/terrain/${ailleurs.interventionId}`}
              className={CLASSES_LIEN}
            >
              {t("terrain.compteur.aller")}
            </Link>
          </p>
        ) : !ici && verdictDemarrer.refuse ? (
          // MÊME RÉGIME : le refus de DÉMARRER (D8, D160) prend lui aussi la
          // place du bouton — une À planifier déplanifiée n'a rien à démarrer.
          // Ne concerne jamais `ici` : un compteur déjà ouvert ICI s'arrête
          // toujours, quel que soit le statut.
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {estCleTraduction(verdictDemarrer.cle)
              ? t(verdictDemarrer.cle)
              : verdictDemarrer.cle}
          </p>
        ) : (
          <form action={`/api/terrain/${id}/compteur`} method="post">
            <input
              type="hidden"
              name="geste"
              value={ici ? "arreter" : "demarrer"}
            />
            <Button type="submit" size="lg" className="w-full text-16">
              {ici
                ? t("terrain.compteur.pause")
                : enPause
                  ? t("terrain.compteur.reprendre")
                  : t("terrain.compteur.demarrer")}
            </Button>
          </form>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.rapport.titre")}
        </h2>
        <form
          action={`/api/terrain/${id}/rapport`}
          method="post"
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.rapport.commentaire_libelle")}
            </span>
            <textarea
              name="commentaire_technicien"
              rows={3}
              defaultValue={rapportTexte?.commentaire_technicien ?? ""}
              placeholder={t("terrain.rapport.commentaire_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.rapport.suite_libelle")}
            </span>
            <textarea
              name="suite_a_donner"
              rows={2}
              defaultValue={rapportTexte?.suite_a_donner ?? ""}
              placeholder={t("terrain.rapport.suite_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
          <Button type="submit" size="lg" className="self-start text-16">
            {t("terrain.rapport.enregistrer")}
          </Button>
        </form>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.prestations.titre")}
        </h2>
        {prestationsActives.length === 0 ? (
          <p className="text-app-encre-faible text-16 font-bold">
            {t("terrain.prestations.aucune")}
          </p>
        ) : (
          <form
            action={`/api/terrain/${id}/prestations`}
            method="post"
            className="flex flex-col gap-2"
          >
            {prestationsActives.map((prestation) => (
              <label
                key={prestation.id}
                className="flex items-center gap-2 text-16 font-bold"
              >
                <input
                  type="checkbox"
                  name="prestation_id"
                  value={prestation.id}
                  defaultChecked={idsRealises.has(prestation.id)}
                />
                {prestation.libelle}
              </label>
            ))}
            <Button type="submit" size="lg" className="self-start text-16">
              {t("terrain.prestations.enregistrer")}
            </Button>
          </form>
        )}
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.photos.titre")}
        </h2>
        {(photos ?? []).length === 0 ? (
          <p className="text-app-encre-faible text-16 font-bold">
            {t("terrain.photos.aucune")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {(photos ?? []).map((photo) => (
              <li key={photo.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative */}
                <img
                  src={`/api/documents/${photo.id}/octets`}
                  alt={photo.libelle}
                  className="border-app-bord aspect-square rounded border object-cover"
                />
                <span className="text-app-encre-faible truncate text-16 font-bold">
                  {photo.libelle}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form
          action={`/api/terrain/${id}/photos`}
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-2"
        >
          <input
            type="file"
            name="fichier"
            accept="image/*"
            capture="environment"
            required
            className="text-16 font-bold"
          />
          <input
            type="text"
            name="libelle"
            placeholder={t("terrain.photos.libelle_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
          />
          <Button type="submit" size="lg" className="self-start text-16">
            {t("terrain.photos.ajouter")}
          </Button>
        </form>
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.signature.titre")}
        </h2>
        <SignatureTerrain
          action={`/api/terrain/${id}/signature`}
          dejaSignee={signature !== null}
        />
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.terminer.titre")}
        </h2>
        {verdictTerminer.refuse ? (
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {estCleTraduction(verdictTerminer.cle)
              ? t(verdictTerminer.cle)
              : verdictTerminer.cle}
          </p>
        ) : (
          <form action={`/api/terrain/${id}/terminer`} method="post">
            <Button type="submit" size="lg" className="w-full text-16">
              {t("terrain.terminer.bouton")}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

/** Le libellé du type, ou son code si le dictionnaire l'ignore. */
function libelleDuType(type: string): string {
  const cle = `type_intervention.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}

function Ligne({
  libelle,
  valeur,
}: {
  readonly libelle: string;
  readonly valeur: string | null;
}) {
  return (
    <>
      <dt className="text-app-encre-faible">{libelle}</dt>
      <dd className="font-medium">{valeur ?? t("terrain.inconnu")}</dd>
    </>
  );
}
