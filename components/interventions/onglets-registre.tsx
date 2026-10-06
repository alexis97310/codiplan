import { Onglets, type EtatOnglet } from "@/components/ui/onglets";
import { t } from "@/lib/i18n/fr";
import type { ComptesRegistre } from "@/lib/interventions/depot";
import type { VueRegistre } from "@/lib/interventions/saisie";

/**
 * LES ONGLETS DU REGISTRE — huit onglets à compteur, puis « Toutes »
 * (TP-UX3-1-REGISTRE-1, QE-8 ; §5.3 et §3.4 de la spécification du
 * 28/09/2026) : « À planifier · Aujourd'hui · En retard · En cours ·
 * Suspendues · À contrôler · À facturer · Toutes ».
 *
 * ## Pourquoi un composant à part de `page.tsx`
 *
 * **Partagé par DEUX routes** — `/interventions` et
 * `/interventions/a-facturer` — qui doivent montrer EXACTEMENT la même
 * rangée, dans le même ordre, avec les mêmes compteurs : deux écritures
 * diverGeraient en silence le jour où l'ordre ou un libellé change (§9,
 * 01/09).
 *
 * ## « À venir » et « Historique » n'y sont PLUS
 *
 * Ce lot les retire de la rangée (ils restent des adresses valides,
 * `?vue=a_venir`/`?vue=historique` — voir `VUES_REGISTRE`,
 * `lib/interventions/saisie.ts`) : la maquette du 28/09 dessine huit
 * onglets, jamais dix. Actives, ces deux vues se montrent en PUCE
 * (`app/(back-office)/interventions/page.tsx`), avec sa croix vers
 * « Toutes ».
 *
 * ## « Toutes » NE PORTE JAMAIS de compteur
 *
 * La maquette la dessine sans nombre (§3.4) — une somme de tout le
 * registre n'ajoute aucune information que les huit autres onglets ne
 * portent déjà.
 *
 * ## « À facturer » N'EST PAS UNE VUE DE `criteresVue`
 *
 * C'est un EMPLACEMENT — une route à part
 * (`app/(back-office)/interventions/a-facturer/page.tsx`) — jamais un
 * filtre sur `/interventions` : la liste, ses décomptes et son export
 * arrivent avec FACTURE-1. `peutFacturer` en décide la visibilité — un rôle
 * sans `preparer_facturation` ne la voit pas, comme la page elle-même la lui
 * refuse.
 *
 * ## Les deux alertes rouges
 *
 * « À planifier » s'allume si `comptes.a_planifier_p1` — une P1 attend.
 * « En retard » s'allume dès que `comptes.en_retard > 0`. « À contrôler »
 * N'EN PORTE AUCUNE (IN-20) : le seuil de 48 h du chapitre 16.1 suppose un
 * état « rapport validé » que ce dépôt ne connaît pas encore.
 */
const ONGLETS_PRINCIPAUX: readonly VueRegistre[] = [
  "a_planifier",
  "aujourdhui",
  "en_retard",
  "en_cours",
  "bloquees",
  "a_controler",
];

export function OngletsRegistre({
  vueActive,
  comptes,
  peutFacturer,
  hrefOnglet,
  hrefAFacturer,
}: Readonly<{
  /** `a_facturer` quand cette rangée est rendue sur `/interventions/a-facturer`. */
  vueActive: VueRegistre | "toutes" | "a_facturer";
  comptes: ComptesRegistre;
  peutFacturer: boolean;
  hrefOnglet: (vue: VueRegistre | null) => string;
  hrefAFacturer: string;
}>) {
  const elements: EtatOnglet[] = ONGLETS_PRINCIPAUX.map((vue) => ({
    libelle: t(`interventions.vue.${vue}`),
    href: hrefOnglet(vue),
    compte: comptes[vue],
    actif: vueActive === vue,
    alerte:
      (vue === "a_planifier" && comptes.a_planifier_p1) ||
      (vue === "en_retard" && comptes.en_retard > 0),
  }));
  if (peutFacturer) {
    elements.push({
      libelle: t("interventions.vue.a_facturer"),
      href: hrefAFacturer,
      actif: vueActive === "a_facturer",
    });
  }
  elements.push({
    libelle: t("interventions.vue.toutes"),
    href: hrefOnglet(null),
    actif: vueActive === "toutes",
  });

  return (
    <Onglets
      libelleAria={t("interventions.vue.aria")}
      elements={elements}
      dataNav="onglets-registre"
    />
  );
}
