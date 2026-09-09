import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  EnTete,
  Etiquette,
  Mesure,
  Page,
  Panneau,
  Vide,
} from "@/components/charte/socle";
import { etatArrivee } from "@/lib/auth/arrivee";
import { obtenirSession } from "@/lib/auth/session";
import { type CleTraduction, t } from "@/lib/i18n/fr";
import {
  type FicheIntervention,
  type TempsAffiche,
  lireLaFiche,
} from "@/lib/interventions/depot";

/**
 * LA FICHE D'INTERVENTION (ticket L2-14).
 *
 * **Aucun montant n'est calculé ici.** Tout vient de
 * `lib/tarification/valorisation.ts` — RG-TAR-05, D11, D57, D74, D77 — et
 * arrive déjà formaté par `formatMoney` : la devise décide des décimales, et un
 * `toFixed(2)` écrit dans un composant rendrait « 12 500,00 F » pour du franc
 * Pacifique (I3).
 *
 * **L'arrondi est énoncé à l'endroit où il s'applique** : la phrase est posée
 * sous le temps facturé, pas dans une aide de bas de page. Une règle qui décide
 * d'un montant se lit à côté du montant qu'elle décide.
 */
export default async function PageFicheIntervention({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const entetes = await headers();
  const etat = await etatArrivee(entetes);
  if (etat.issue === "anonyme") {
    redirect("/connexion");
  }
  if (etat.issue === "enrolement_requis") {
    redirect("/enrolement");
  }
  if (etat.issue === "sans_societe") {
    redirect("/arrivee");
  }

  const session = await obtenirSession(entetes);
  if (session === null) {
    redirect("/connexion");
  }

  const fiche = await lireLaFiche(session.contexte, (await params).id);

  return (
    <Page>
      <EnTete
        titre={fiche?.libelle ?? t("intervention.titre")}
        accroche={t("intervention.accroche")}
      />

      {fiche === null ? (
        // Un identifiant inconnu et l'intervention d'une autre société rendent
        // LA MÊME chose : les distinguer ferait un oracle (D35, D50).
        <Vide
          titre={t("intervention.introuvable.titre")}
          invitation={t("intervention.introuvable.invitation")}
        />
      ) : (
        <Fiche fiche={fiche} />
      )}

      <p>
        <Link className="text-bleu underline" href="/interventions">
          {t("intervention.liste.titre")}
        </Link>
      </p>
    </Page>
  );
}

function heuresEtMinutes(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

function libelleType(type: TempsAffiche["type"]): string {
  const cles: Record<TempsAffiche["type"], CleTraduction> = {
    trajet: "intervention.type.trajet",
    intervention: "intervention.type.intervention",
    attente: "intervention.type.attente",
    pause: "intervention.type.pause",
  };
  return t(cles[type]);
}

function Fiche({ fiche }: { fiche: FicheIntervention }) {
  const valorisation = fiche.valorisation;
  const minutesFacturees = valorisation.mainDOeuvre.reduce(
    (somme, ligne) => somme + ligne.minutesFacturees,
    0,
  );

  return (
    <>
      <Panneau>
        <dl className="flex flex-col gap-2">
          <Mesure libelle={t("intervention.client")} valeur={fiche.client} />
          <Mesure libelle={t("intervention.site")} valeur={fiche.site} />
          <Mesure libelle={t("intervention.statut")} valeur={fiche.statut} />
          <Mesure
            libelle={t("intervention.mode")}
            valeur={fiche.modeValorisation}
          />
        </dl>
      </Panneau>

      <Panneau titre={t("intervention.temps.titre")}>
        {fiche.temps.length === 0 ? (
          <p className="text-gris text-sm">{t("intervention.temps.aucun")}</p>
        ) : (
          <ul className="mb-4 flex flex-col">
            {fiche.temps.map((ligne) => (
              <li
                key={ligne.id}
                className={
                  ligne.type === "trajet"
                    ? "border-trait text-gris flex flex-wrap items-baseline justify-between gap-x-4 border-b border-dashed py-2 text-sm last:border-b-0"
                    : "border-trait flex flex-wrap items-baseline justify-between gap-x-4 border-b py-2 text-sm last:border-b-0"
                }
              >
                <span>
                  <span className="font-bold">{libelleType(ligne.type)}</span>{" "}
                  <span>{ligne.technicien}</span>
                </span>
                <span className="flex items-center gap-3">
                  {ligne.type === "trajet" || !ligne.facturable ? (
                    <Etiquette
                      texte={t("intervention.non_facture")}
                      ton="neutre"
                    />
                  ) : null}
                  <span className="font-bold">
                    {heuresEtMinutes(ligne.dureeMinutes)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <dl className="flex flex-col gap-1.5">
          <Mesure
            libelle={t("intervention.temps.reel")}
            valeur={heuresEtMinutes(valorisation.minutesReellesTotales)}
          />
          <Mesure
            libelle={t("intervention.temps.trajet")}
            valeur={heuresEtMinutes(valorisation.minutesTrajet)}
            accent="gris"
          />
          <Mesure
            libelle={t("intervention.temps.non_facturable")}
            valeur={heuresEtMinutes(valorisation.minutesNonFacturables)}
            accent="gris"
          />
          <Mesure
            libelle={t("intervention.temps.facture")}
            valeur={heuresEtMinutes(minutesFacturees)}
            accent="bleu"
          />
        </dl>

        {/* LA RÈGLE, À L'ENDROIT OÙ ELLE S'APPLIQUE. */}
        <p className="text-gris mt-2 max-w-[65ch] text-xs">
          {t("intervention.arrondi")}
        </p>
      </Panneau>

      <Panneau titre={t("intervention.main_doeuvre")}>
        <dl className="flex flex-col gap-1.5">
          <Mesure
            libelle={t("intervention.taux")}
            valeur={fiche.montants.tauxHoraire ?? t("intervention.taux.absent")}
            accent={fiche.montants.tauxHoraire === null ? "gris" : undefined}
          />
          <Mesure
            libelle={t("intervention.main_doeuvre")}
            valeur={fiche.montants.mainDOeuvre}
          />
        </dl>
        <p className="text-gris mt-2 max-w-[65ch] text-xs">
          {t("intervention.taux.aide")}
        </p>
      </Panneau>

      <Panneau titre={t("intervention.forfaits")}>
        {valorisation.forfaits.length === 0 ? (
          <p className="text-gris text-sm">
            {t("intervention.forfaits.aucun")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {valorisation.forfaits.map((forfait) => (
              <li
                key={forfait.code}
                className="border-l-ambre bg-ambre-fond flex items-baseline justify-between gap-4 border-l-4 px-2 py-1 text-sm"
              >
                <span>{forfait.libelle}</span>
                <span className="font-bold">{fiche.montants.forfaits}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-gris mt-2 max-w-[65ch] text-xs">
          {t("intervention.forfaits.aide")}
        </p>
      </Panneau>

      <Panneau>
        <dl>
          <Mesure
            libelle={t("intervention.total_ht")}
            valeur={<span className="text-xl">{fiche.montants.totalHt}</span>}
            accent="bleu"
          />
        </dl>
        <p className="text-gris mt-2 max-w-[65ch] text-xs">
          {t("intervention.majoration.absente")}
        </p>
      </Panneau>
    </>
  );
}
