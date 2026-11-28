import {
  Document as PdfDocument,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { dateCivile } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  FOND_MENTION_PDF,
  TEXTE_ALERTE_PDF,
  TEXTE_ATTENUE_PDF,
  TEXTE_PDF,
} from "@/lib/theme/pdf";

/**
 * LA MISE EN PAGE DU BON DE PRÊT (9L62-PRET-3-BON-SIGNE) — LA PREMIÈRE
 * UTILISATION RÉELLE DE REACT-PDF DANS CE DÉPÔT.
 *
 * `CLAUDE.md` §2 impose déjà React-PDF pour le PDF : `@react-pdf/renderer`
 * n'avait simplement jamais eu d'appelant (`docs/backlog.md`, L3-15 — « une
 * bibliothèque de mise en page sans rien à mettre en page »). Ce bon EST ce
 * contenu : l'installer maintenant exerce une décision déjà prise, ce n'en
 * est pas une nouvelle (CLAUDE.md §2, justifiée dans le commit).
 *
 * **Figé une fois pour toutes** : ce composant REND des octets, une seule
 * fois, à la remise (`genererBonPretPDF`, appelé par
 * `creerBonPretDans`) — jamais relu ni régénéré ensuite. Le bon stocké ne
 * change plus, même si l'appareil, l'intervention ou la société changent
 * après coup (même doctrine que `intervention.valorisation_figee`, D272).
 *
 * AUCUN MONTANT (décision 2 du cadrage, D287) : aucune ligne de ce gabarit
 * ne porte de prix, et la mention du prêt gratuit est un texte fixe du
 * dictionnaire, jamais composé depuis une donnée tarifaire.
 */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: TEXTE_PDF },
  enTete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  logo: { width: 90, maxHeight: 48, objectFit: "contain" },
  titre: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  numero: { fontSize: 11, color: TEXTE_ATTENUE_PDF },
  section: { marginBottom: 12 },
  titreSection: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: TEXTE_ATTENUE_PDF,
    marginBottom: 4,
  },
  ligne: { flexDirection: "row", marginBottom: 2 },
  libelle: { width: 140, color: TEXTE_ATTENUE_PDF },
  valeur: { flex: 1, fontWeight: 500 },
  mention: {
    marginTop: 18,
    marginBottom: 18,
    padding: 8,
    backgroundColor: FOND_MENTION_PDF,
    borderRadius: 4,
  },
  signatureBloc: { marginTop: 18 },
  signatureImage: { width: 220, height: 90, objectFit: "contain" },
  signatureAbsente: { color: TEXTE_ALERTE_PDF },
});

export type DonneesBonPretPdf = {
  readonly numeroBon: string;
  readonly societe: {
    readonly raisonSociale: string;
    readonly logo: { readonly octets: Buffer; readonly type: string } | null;
  };
  readonly client: string;
  readonly site: string;
  readonly interventionReference: string;
  readonly appareil: {
    readonly designation: string;
    readonly marque: string | null;
    readonly modele: string | null;
    readonly numeroSerie: string | null;
  };
  readonly etatDepart: string;
  readonly dateSortie: Date;
  readonly dateRetourPrevue: Date;
  readonly signature:
    | {
        readonly imageDonnees: string;
        readonly nom: string;
        readonly qualite: string | null;
      }
    | { readonly motifAbsence: string };
};

/**
 * DÉCODE le `data:image/png;base64,...` du canevas EN OCTETS, plutôt que de
 * confier la chaîne telle quelle à `Image` — mesuré : la détection de data
 * URI de `@react-pdf/renderer` 4.9 se trompe sur un PNG minuscule (le PDF
 * produit `readFileSync` sur les octets décodés comme s'ils étaient un
 * CHEMIN). Le logo, lui, reçoit déjà `{ data, format }` directement — même
 * forme ici, jamais la chaîne brute.
 */
function octetsDuDataUrlPng(dataUrl: string): { data: Buffer; format: "png" } {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { data: Buffer.from(base64, "base64"), format: "png" };
}

function BonPretDocument({ donnees }: { readonly donnees: DonneesBonPretPdf }) {
  const appareilLigne = [donnees.appareil.marque, donnees.appareil.modele]
    .filter((partie): partie is string => partie !== null && partie.length > 0)
    .join(" ");
  return (
    <PdfDocument>
      <Page size="A4" style={styles.page}>
        <View style={styles.enTete}>
          <View>
            <Text style={styles.titre}>{t("intervention.pret.bon.titre")}</Text>
            <Text style={styles.numero}>
              {t("intervention.pret.bon.numero")} {donnees.numeroBon}
            </Text>
          </View>
          {donnees.societe.logo === null ? (
            <Text>{donnees.societe.raisonSociale}</Text>
          ) : (
            // `Image` ici est le primitif de mise en page PDF de
            // `@react-pdf/renderer`, pas la balise HTML : il n'a pas de prop
            // `alt`, et la règle d'accès au DOM ne s'applique pas à un PDF
            // rendu côté serveur (même motif que la signature plus bas).
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image
              style={styles.logo}
              src={{
                data: donnees.societe.logo.octets,
                format:
                  donnees.societe.logo.type === "image/png" ? "png" : "jpg",
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.titreSection}>
            {t("intervention.pret.bon.section_client")}
          </Text>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.bon.client")}
            </Text>
            <Text style={styles.valeur}>{donnees.client}</Text>
          </View>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>{mot("site")}</Text>
            <Text style={styles.valeur}>{donnees.site}</Text>
          </View>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.bon.intervention")}
            </Text>
            <Text style={styles.valeur}>{donnees.interventionReference}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.titreSection}>
            {t("intervention.pret.bon.section_appareil")}
          </Text>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.bon.designation")}
            </Text>
            <Text style={styles.valeur}>{donnees.appareil.designation}</Text>
          </View>
          {appareilLigne.length === 0 ? null : (
            <View style={styles.ligne}>
              <Text style={styles.libelle}>
                {t("intervention.pret.bon.marque_modele")}
              </Text>
              <Text style={styles.valeur}>{appareilLigne}</Text>
            </View>
          )}
          {donnees.appareil.numeroSerie === null ? null : (
            <View style={styles.ligne}>
              <Text style={styles.libelle}>
                {t("intervention.pret.bon.numero_serie")}
              </Text>
              <Text style={styles.valeur}>{donnees.appareil.numeroSerie}</Text>
            </View>
          )}
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.champ_etat_depart")}
            </Text>
            <Text style={styles.valeur}>{donnees.etatDepart}</Text>
          </View>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.champ_date_sortie")}
            </Text>
            <Text style={styles.valeur}>{dateCivile(donnees.dateSortie)}</Text>
          </View>
          <View style={styles.ligne}>
            <Text style={styles.libelle}>
              {t("intervention.pret.champ_retour_prevu")}
            </Text>
            <Text style={styles.valeur}>
              {dateCivile(donnees.dateRetourPrevue)}
            </Text>
          </View>
        </View>

        <View style={styles.mention}>
          <Text>{t("intervention.pret.bon.mention_gratuit")}</Text>
          <Text>{t("intervention.pret.bon.engagement_restitution")}</Text>
        </View>

        <View style={styles.signatureBloc}>
          <Text style={styles.titreSection}>
            {t("intervention.pret.bon.section_signature")}
          </Text>
          {"motifAbsence" in donnees.signature ? (
            <Text style={styles.signatureAbsente}>
              {t("intervention.pret.bon.non_signe")}
              {t("ponctuation.deux_points")}
              {donnees.signature.motifAbsence}
            </Text>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- voir le commentaire du logo ci-dessus : le même primitif `@react-pdf/renderer`, sans prop `alt`. */}
              <Image
                style={styles.signatureImage}
                src={octetsDuDataUrlPng(donnees.signature.imageDonnees)}
              />
              <View style={styles.ligne}>
                <Text style={styles.libelle}>
                  {t("intervention.pret.champ_signataire_nom")}
                </Text>
                <Text style={styles.valeur}>{donnees.signature.nom}</Text>
              </View>
              {donnees.signature.qualite === null ? null : (
                <View style={styles.ligne}>
                  <Text style={styles.libelle}>
                    {t("intervention.pret.champ_signataire_qualite")}
                  </Text>
                  <Text style={styles.valeur}>{donnees.signature.qualite}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </Page>
    </PdfDocument>
  );
}

/** Rend le bon en octets PDF — appelé UNE SEULE FOIS, à la remise. */
export function genererBonPretPDF(donnees: DonneesBonPretPdf): Promise<Buffer> {
  return renderToBuffer(<BonPretDocument donnees={donnees} />);
}
