import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { obtenirSession } from "@/lib/auth/session";
import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
} from "@/lib/interventions/cycle-de-vie";
import {
  lireFicheIntervention,
  type ValorisationAffichee,
} from "@/lib/interventions/depot";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { formatMoney } from "@/lib/money";

import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { referenceAffichee } from "../presentation";

/**
 * LA FICHE D'INTERVENTION (lot 2, D84) — et les quatre actions.
 *
 * ## Le refus s'affiche À LA PLACE de l'action, avec sa raison
 *
 * C'est la consigne d'exploitation, et elle change la forme de cet écran : un
 * bouton refusé n'est pas grisé avec une infobulle, il est **remplacé** par le
 * motif du refus, en oxyde. *Il ne disparaît jamais en silence et ne se
 * contourne pas depuis l'écran.*
 *
 * Et il ne se contourne pas non plus par une requête : les mêmes refus sont
 * tenus par `intervention_cycle_de_vie` en base. Cet écran DIT ce que la base
 * ferait ; il ne le décide pas.
 */
export default async function PageIntervention({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const { id } = await params;
  const motif = (await searchParams).motif;
  const fiche = await lireFicheIntervention(session.contexte, id);
  if (fiche === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose : les distinguer
    // ferait un oracle (D35, D50).
    notFound();
  }

  const ligne = fiche.ligne;
  const statut = ligne.statut as StatutIntervention;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Link href="/planning" className="text-muted-foreground text-sm">
          {t("planning.retour_fleche")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("intervention.titre")} {referenceAffichee(ligne)}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSES_STATUT[statut]}`}
          >
            {t(`statut.${statut}`)}
          </span>
        </div>
        {ligne.numero === null ? (
          <p className="text-muted-foreground text-xs">
            {t("intervention.sans_numero")}
          </p>
        ) : null}
      </header>

      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-destructive text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {t(motif)}
        </p>
      ) : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Ligne
          libelle={t("intervention.type")}
          valeur={t(`type_intervention.${ligne.type}`)}
        />
        <Ligne
          libelle={t("intervention.priorite")}
          valeur={t(`priorite.${ligne.priorite}`)}
        />
        <Ligne
          libelle={t("intervention.client")}
          valeur={fiche.client ?? TIRET}
        />
        <Ligne libelle={mot("site")} valeur={fiche.lieu ?? TIRET} />
        <Ligne
          libelle={mot("agence")}
          valeur={fiche.rattachement ?? TIRET}
          note={t("intervention.deduit_du_lieu")}
        />
        <Ligne
          libelle={t("intervention.forfait_deplacement")}
          valeur={fiche.forfait ?? TIRET}
          note={t("intervention.deduit_du_lieu")}
        />
        <Ligne
          libelle={t("intervention.technicien")}
          valeur={ligne.technicien_id ?? t("intervention.aucun_technicien")}
        />
        <Ligne
          libelle={t("intervention.mode_valorisation")}
          valeur={t(`mode_valorisation.${ligne.mode_valorisation}`)}
        />
        {ligne.motif_annulation !== null ? (
          <Ligne
            libelle={t("intervention.annulation.motif")}
            valeur={ligne.motif_annulation}
          />
        ) : null}
      </dl>

      {fiche.valorisation !== null && fiche.devise !== null ? (
        <Valorisation valorisation={fiche.valorisation} devise={fiche.devise} />
      ) : null}

      <Action
        titre={t("intervention.action.affecter")}
        verdict={peutAffecter(statut)}
        action={`/api/interventions/${ligne.id}/affecter`}
      >
        <Saisie nom="technicien_id" libelle={t("intervention.technicien")} />
      </Action>

      {/*
        LA VOIE SANS GLISSÉ (R2-19) — même route, même décision.

        *Une fonction qui n'existe qu'à la souris exclut le tactile et le
        clavier.* Ce formulaire fait exactement ce que le glisser-déposer du
        planning fait, aux mêmes refus près : chaque bloc du planning est un
        lien vers cette fiche, atteignable à la tabulation.

        L'heure se saisit en HEURE LOCALE, comme sur le planning : l'instant
        demande le fuseau de l'établissement, et c'est le dépôt qui le résout.
      */}
      <Action
        titre={t("intervention.action.deplacer")}
        verdict={peutDeplacer(statut)}
        action={`/api/interventions/${ligne.id}/deplacer`}
        note={t("intervention.deplacement.explication")}
      >
        <Saisie
          nom="date_planifiee"
          type="date"
          libelle={t("intervention.date")}
        />
        <Saisie
          nom="heure_debut"
          type="time"
          libelle={t("intervention.deplacement.heure")}
        />
        <Saisie
          nom="duree_min"
          type="number"
          libelle={t("intervention.deplacement.duree")}
        />
        <Saisie nom="technicien_id" libelle={t("intervention.technicien")} />
      </Action>

      <Action
        titre={t("intervention.action.cloturer")}
        verdict={peutCloturer(statut, ligne.temps_reel_min ?? 1)}
        action={`/api/interventions/${ligne.id}/cloturer`}
        note={t("intervention.cloture.explication")}
      >
        <Saisie
          nom="temps_reel_min"
          type="number"
          libelle={t("intervention.cloture.temps_reel")}
        />
      </Action>

      <Action
        titre={t("intervention.action.annuler")}
        verdict={peutAnnuler(statut)}
        action={`/api/interventions/${ligne.id}/annuler`}
        note={t("intervention.annulation.obligatoire")}
      >
        <Saisie nom="motif" libelle={t("intervention.annulation.motif")} />
      </Action>
    </main>
  );
}

/** Ce qu'on affiche à la place d'une valeur qu'on n'a pas — jamais un vide. */
const TIRET = "—";

/**
 * LE CALCUL DE D83, SOUS LES YEUX.
 *
 * *Voir l'arrondi et le plancher s'appliquer* était la demande, et un total
 * seul ne la satisfait pas : il donne le résultat sans donner la raison, et
 * c'est exactement ce qui fait douter d'une facture. Les quatre lignes se
 * lisent dans l'ordre du calcul — réel, arrondi, plancher, facturé — et le
 * plancher n'est signalé que lorsqu'il a réellement mordu.
 *
 * Aucun de ces nombres n'est recalculé ici : ils viennent de la même fonction
 * que la clôture. Un écran qui referait le calcul serait une seconde lecture
 * d'un même critère.
 */
function Valorisation({
  valorisation,
  devise,
}: {
  valorisation: ValorisationAffichee;
  devise: { code: string; decimales: number; symbole: string | null };
}) {
  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border px-4 py-3">
      <h2 className="text-sm font-medium">
        {t("intervention.cloture.facture")}
      </h2>
      <p className="text-muted-foreground text-xs">
        {t("intervention.cloture.explication")}
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Ligne
          libelle={t("intervention.cloture.temps_reel")}
          valeur={minutes(valorisation.minutesReelles)}
        />
        <Ligne
          libelle={t("intervention.cloture.arrondi")}
          valeur={minutes(valorisation.minutesArrondies)}
        />
        {valorisation.plancherApplique ? (
          <Ligne
            libelle={t("intervention.cloture.plancher")}
            valeur={minutes(valorisation.minutesFacturees)}
          />
        ) : null}
        <Ligne
          libelle={t("intervention.cloture.taux")}
          valeur={formatMoney(valorisation.tauxHoraire, devise)}
        />
        <Ligne
          libelle={t("intervention.cloture.total")}
          valeur={formatMoney(valorisation.mainDoeuvre, devise)}
        />
      </dl>
    </section>
  );
}

/** Des minutes en heures et minutes — `75` se lit « 1 h 15 », jamais « 75 ». */
function minutes(total: number): string {
  const heures = Math.floor(total / 60);
  const reste = String(total % 60).padStart(2, "0");
  return heures === 0 ? `${reste} min` : `${heures} h ${reste}`;
}

function Ligne({
  libelle,
  valeur,
  note,
}: {
  libelle: string;
  valeur: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="font-medium break-all">{valeur}</dd>
      {note === undefined ? null : (
        <dd className="text-muted-foreground text-xs">{note}</dd>
      )}
    </div>
  );
}

function Saisie({
  nom,
  libelle,
  type = "text",
}: {
  nom: string;
  libelle: string;
  type?: "text" | "number" | "date" | "time";
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {libelle}
      <input
        name={nom}
        type={type}
        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
      />
    </label>
  );
}

/**
 * UNE ACTION, OU SON REFUS — jamais les deux, jamais un bouton grisé.
 *
 * *Le refus s'affiche à la place, en oxyde, avec sa raison écrite.* Un bouton
 * désactivé laisse croire qu'il suffirait d'insister ; un refus qui prend la
 * place de l'action dit ce qui bloque et pourquoi.
 */
function Action({
  titre,
  verdict,
  action,
  note,
  children,
}: {
  titre: string;
  verdict: { refuse: boolean; cle?: string };
  action: string;
  note?: string;
  children: React.ReactNode;
}) {
  if (verdict.refuse) {
    const cle = verdict.cle;
    return (
      <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-1 rounded-lg border px-4 py-3">
        <h2 className="text-sm font-medium">{titre}</h2>
        <p className="text-destructive text-sm">
          {cle !== undefined && estCleTraduction(cle) ? t(cle) : ""}
        </p>
      </section>
    );
  }
  return (
    <form
      action={action}
      method="post"
      className="border-border flex flex-col gap-3 rounded-lg border px-4 py-3"
    >
      <h2 className="text-sm font-medium">{titre}</h2>
      {note === undefined ? null : (
        <p className="text-muted-foreground text-xs">{note}</p>
      )}
      {children}
      <Button type="submit" variant="outline">
        {titre}
      </Button>
    </form>
  );
}
