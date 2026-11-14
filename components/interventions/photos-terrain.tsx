"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialogue } from "@/components/ui/dialogue";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import {
  ajouterSaisie,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
  retirerSaisie,
  type EntreeFile,
  type GestePhoto,
  type GesteSuppressionPhoto,
} from "@/lib/terrain/file-saisies";

/**
 * LES PHOTOS DE LA FICHE TERRAIN, VERSION ÉPURÉE (décision d'Alexis du
 * 13/11/2026, 9L04E-TERRAIN-PHOTOS-EPUREES — remplace B10 et 9L04C-TERRAIN-
 * PHOTOS) : « Prendre une photo » bien visible, envoi automatique, vignettes
 * trois par ligne, toucher une photo pour la légender ou la supprimer.
 *
 * **LA RÉDUCTION CÔTÉ TÉLÉPHONE RESTE INCHANGÉE** (9EWB-PHOTOS-EN-BASE, D96)
 * — `createImageBitmap` → `<canvas>` ≤ 1600 px → JPEG ~0,8, AVANT l'envoi.
 *
 * **TROIS GENRES DE VIGNETTE, UNE SEULE GRILLE** : une photo déjà confirmée
 * par le serveur (`photosExistantes`, lue par la page), une photo encore en
 * file hors réseau (`lib/terrain/file-saisies.ts`, persistée dans IndexedDB —
 * donc visible après un rechargement), et une tentative de CETTE session qui
 * n'a pas encore atteint l'une ou l'autre (en cours d'envoi, ou en échec
 * AVANT même d'avoir pu être gardée en file — réduction impossible, refus
 * explicite du serveur type/taille). Les trois partagent le même composant
 * `Vignette` : une légende, un état en 13 px, un toucher qui ouvre la même
 * feuille.
 *
 * **LA LÉGENDE NE SE SAISIT PLUS AU DÉPÔT** (constat d'Alexis du 13/11/2026 :
 * « toutes les photos s'appellent image.jpg ») — `deposerPhotoIntervention`
 * (`lib/documents/depot.ts`) garde son repli sur `nom_fichier` quand aucune
 * légende n'est fournie (la contrainte `document_libelle_non_vide` l'exige),
 * et c'est CE repli que `legendeAffichee` ci-dessous détecte pour afficher
 * « Sans légende » plutôt que le nom de fichier — aucune colonne
 * supplémentaire, aucune migration.
 *
 * **SUPPRESSION ET LÉGENDE : UNIQUEMENT SUR UNE PHOTO DÉJÀ ENVOYÉE** — une
 * photo encore en file (pas de `documentId` serveur) se retire par
 * `retirerSaisie`, sans aucun appel réseau (voir le docblock de
 * `GesteSuppressionPhoto`, `lib/terrain/file-saisies.ts`) ; une photo
 * confirmée se supprime par la route `.../photos/supprimer`, mise en FILE si
 * le réseau manque — même discipline que le dépôt lui-même.
 */

const COTE_MAX = 1600;
const QUALITE_JPEG = 0.8;

/** Une photo déjà confirmée par le serveur, telle que la page la lit. */
export type PhotoExistante = {
  readonly id: string;
  readonly libelle: string;
  readonly nomFichier: string;
  /** Lu dans `Document.depose_par` par la page (`auteursDesPhotos`, `lib/documents/depot.ts`) — jamais recalculé ici. */
  readonly deposeParMoi: boolean;
};

type PhotoReduite = { readonly blob: Blob; readonly nomFichier: string };

async function reduire(fichier: File): Promise<PhotoReduite> {
  const image = await createImageBitmap(fichier, {
    imageOrientation: "from-image",
  });
  const ratio = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const canevas = document.createElement("canvas");
  canevas.width = Math.max(1, Math.round(image.width * ratio));
  canevas.height = Math.max(1, Math.round(image.height * ratio));
  const contexte = canevas.getContext("2d");
  if (contexte === null) {
    throw new Error("contexte-2d-indisponible");
  }
  contexte.drawImage(image, 0, 0, canevas.width, canevas.height);
  const blob = await new Promise<Blob | null>((resoudre) => {
    canevas.toBlob(resoudre, "image/jpeg", QUALITE_JPEG);
  });
  if (blob === null) {
    throw new Error("reduction-impossible");
  }
  return { blob, nomFichier: fichier.name };
}

/**
 * `envoyee` — LA PHOTO EST PARTIE, MAIS CETTE SESSION N'A JAMAIS SON
 * `documentId` RÉEL (la route rend seulement `{ok, motif}`, voir
 * `app/api/terrain/[id]/photos/route.ts`) : sous un point de checklist
 * (`afficherExistantes === false`, §9K28), rien d'autre ne rend jamais cette
 * photo visible — ni `router.refresh()` (la checklist ne reçoit aucune
 * liste de photos, ticket qui ne touche pas aux check-lists), ni une file
 * hors réseau (elle est déjà partie). La tentative reste donc affichée,
 * SANS LÉGENDE NI SUPPRESSION POSSIBLES (ce composant n'a jamais son
 * identifiant), jusqu'à la fin de la session ou un rechargement de page.
 * Sur la fiche générale (`afficherExistantes === true`), ce cas ne se
 * produit jamais : la tentative se retire aussitôt, `photosExistantes`
 * (rechargée par `router.refresh()`) prenant le relais sans ce détour.
 */
type EtatTentative = "envoi" | "envoyee" | "echec";

type TentativeEnvoi = {
  readonly id: string;
  readonly apercu: string;
  readonly fichier: File;
  readonly etat: EtatTentative;
  readonly motif: string | null;
};

/** « Sans légende » détectée par repli — voir le docblock de tête. */
function legendeAffichee(libelle: string, nomFichier: string): string {
  return libelle === nomFichier ? t("terrain.photos.sans_legende") : libelle;
}

/** Une photo « en attente » ou « envoyée » cette session n'a jamais encore de légende saisie. */
const LEGENDE_SANS_SAISIE = legendeAffichee("", "");

function texteDuMotif(motifCle: string | null, repli: string): string {
  if (motifCle === null) {
    return repli;
  }
  return estCleTraduction(motifCle) ? t(motifCle) : motifCle;
}

function estGestePhoto(
  entree: EntreeFile,
): entree is EntreeFile & { readonly geste: GestePhoto } {
  return entree.geste.type === "photo";
}

function estGesteSuppressionPhoto(
  entree: EntreeFile,
): entree is EntreeFile & { readonly geste: GesteSuppressionPhoto } {
  return entree.geste.type === "suppression_photo";
}

/**
 * UN BOUTON À DEUX TEMPS, SANS FORMULAIRE — même patron que `LigneRefus`
 * (`components/terrain/bouton-envoyer.tsx`), mais pour une action asynchrone
 * quelconque plutôt qu'un retrait de file précis : jamais de geste
 * silencieux sur une suppression.
 */
function BoutonAvecConfirmationSimple({
  libelle,
  texteConfirmation,
  libelleConfirmer,
  variant,
  onConfirmer,
}: {
  readonly libelle: string;
  readonly texteConfirmation: string;
  readonly libelleConfirmer: string;
  readonly variant: "outline" | "destructive";
  readonly onConfirmer: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (ouvert) {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="text-app-encre-faible text-16 font-bold">
          {texteConfirmation}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1 text-16"
            onClick={() => setOuvert(false)}
          >
            {t("terrain.file.retirer_revenir")}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="lg"
            className="flex-1 text-16"
            onClick={() => {
              setOuvert(false);
              onConfirmer();
            }}
          >
            {libelleConfirmer}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      className="text-16"
      onClick={() => setOuvert(true)}
    >
      {libelle}
    </Button>
  );
}

const ETIQUETTES_RAPIDES = [
  "terrain.photos.etiquette_avant",
  "terrain.photos.etiquette_apres",
  "terrain.photos.etiquette_plaque",
  "terrain.photos.etiquette_defaut",
] as const;

type DonneesVignette =
  | {
      readonly genre: "existante";
      readonly id: string;
      readonly libelle: string;
      readonly nomFichier: string;
      readonly deposeParMoi: boolean;
    }
  | {
      readonly genre: "en_attente";
      readonly entreeId: string;
      readonly apercu: string;
    }
  | {
      readonly genre: EtatTentative;
      readonly localId: string;
      readonly apercu: string;
      readonly motif: string | null;
    };

function Vignette({
  donnees,
  interventionOuverte,
  onSupprimerExistante,
  onEnregistrerLegende,
  onRetirerEnAttente,
  onReessayer,
  onRetirerEchec,
}: {
  readonly donnees: DonneesVignette;
  readonly interventionOuverte: boolean;
  readonly onSupprimerExistante: (documentId: string) => void;
  readonly onEnregistrerLegende: (
    documentId: string,
    libelle: string,
  ) => Promise<{ readonly ok: boolean; readonly motif: string | null }>;
  readonly onRetirerEnAttente: (entreeId: string) => void;
  readonly onReessayer: (localId: string) => void;
  readonly onRetirerEchec: (localId: string) => void;
}) {
  const idChamp = useId();
  const [champLegende, setChampLegende] = useState(() =>
    donnees.genre === "existante" && donnees.libelle !== donnees.nomFichier
      ? donnees.libelle
      : "",
  );
  const [etatLegende, setEtatLegende] = useState<
    "repos" | "envoi" | "enregistree" | "echec"
  >("repos");

  const src =
    donnees.genre === "existante"
      ? `/api/documents/${donnees.id}/octets`
      : donnees.apercu;

  const [texteEtat, classeEtat] =
    donnees.genre === "existante" || donnees.genre === "envoyee"
      ? [t("terrain.photos.etat_envoyee"), "text-app-encre-faible"]
      : donnees.genre === "en_attente"
        ? [t("terrain.photos.etat_en_attente"), "text-app-orange-encre"]
        : donnees.genre === "envoi"
          ? [t("terrain.photos.envoi"), "text-app-encre-faible"]
          : [t("terrain.photos.etat_echec"), "text-app-rouge-encre"];

  const legende =
    donnees.genre === "existante"
      ? legendeAffichee(donnees.libelle, donnees.nomFichier)
      : donnees.genre === "en_attente" || donnees.genre === "envoyee"
        ? LEGENDE_SANS_SAISIE
        : null;

  return (
    <Dialogue
      declencheur={(ouvrir) => (
        <button
          type="button"
          onClick={ouvrir}
          aria-label={t("terrain.photos.voir")}
          className="flex flex-col gap-1 text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- octets servis par une route applicative, ou aperçu local (URL.createObjectURL) */}
          <img
            src={src}
            alt=""
            className="bg-app-surface-creuse aspect-square w-full rounded-xl object-cover"
          />
          <span className="text-app-encre min-h-[1em] truncate text-16 font-bold">
            {legende}
          </span>
          {/* PASTILLE (point 8, `tests/unit/ui/retouches-2a.test.ts`) — seul
          état admis à 13 px dans ce fichier : `rounded-full` la reconnaît
          comme telle, même sans fond ni bordure propres. */}
          <span className={`rounded-full text-13 font-bold ${classeEtat}`}>
            {texteEtat}
          </span>
        </button>
      )}
      titre={t("terrain.photos.titre")}
      enfants={() => (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- même source que la vignette */}
          <img
            src={src}
            alt=""
            className="bg-app-surface-creuse max-h-[50vh] w-full rounded-xl object-contain"
          />
          {donnees.genre === "existante" ? (
            !interventionOuverte ? (
              <p className="text-app-encre-faible text-16 font-bold">
                {t("terrain.photos.refus_intervention_fermee")}
              </p>
            ) : !donnees.deposeParMoi ? (
              <p className="text-app-encre-faible text-16 font-bold">
                {t("terrain.photos.refus_pas_lauteur")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={idChamp}
                  className="text-app-encre-faible text-16 font-bold"
                >
                  {t("terrain.photos.libelle")}
                </label>
                <input
                  id={idChamp}
                  type="text"
                  value={champLegende}
                  onChange={(evenement) =>
                    setChampLegende(evenement.currentTarget.value)
                  }
                  placeholder={t("terrain.photos.libelle_placeholder")}
                  className="bg-app-surface-creuse text-app-encre rounded-xl border-none px-3 py-2 text-16"
                />
                <div className="flex flex-wrap gap-2">
                  {ETIQUETTES_RAPIDES.map((cle) => (
                    <Button
                      key={cle}
                      type="button"
                      variant="outline"
                      size="lg"
                      className="text-16"
                      onClick={() => setChampLegende(t(cle))}
                    >
                      {t(cle)}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="self-start text-16"
                  disabled={etatLegende === "envoi"}
                  onClick={async () => {
                    setEtatLegende("envoi");
                    const resultat = await onEnregistrerLegende(
                      donnees.id,
                      champLegende,
                    );
                    setEtatLegende(resultat.ok ? "enregistree" : "echec");
                  }}
                >
                  {t("terrain.photos.enregistrer_legende")}
                </Button>
                {etatLegende === "enregistree" ? (
                  <p
                    role="status"
                    className="text-app-vert-encre text-16 font-bold"
                  >
                    {t("terrain.photos.legende_enregistree")}
                  </p>
                ) : null}
                {etatLegende === "echec" ? (
                  <p
                    role="status"
                    className="text-app-rouge-encre text-16 font-bold"
                  >
                    {t("terrain.photos.legende_echec")}
                  </p>
                ) : null}
              </div>
            )
          ) : donnees.genre === "en_attente" ? (
            <p className="text-app-encre-faible text-16 font-bold">
              {t("terrain.photos.pas_encore_envoyee")}
            </p>
          ) : donnees.genre === "echec" ? (
            <p role="status" className="text-app-rouge-encre text-16 font-bold">
              {texteDuMotif(donnees.motif, t("terrain.photos.refus"))}
            </p>
          ) : donnees.genre === "envoyee" ? (
            <p className="text-app-vert-encre text-16 font-bold">
              {t("terrain.photos.enregistree")}
            </p>
          ) : (
            <p className="text-app-encre-faible text-16 font-bold">
              {t("terrain.photos.envoi")}
            </p>
          )}
        </div>
      )}
      pied={(fermer) => (
        <>
          {donnees.genre === "existante" &&
          interventionOuverte &&
          donnees.deposeParMoi ? (
            <BoutonAvecConfirmationSimple
              libelle={t("terrain.photos.supprimer")}
              texteConfirmation={t("terrain.photos.supprimer_confirmation")}
              libelleConfirmer={t("terrain.photos.supprimer_confirmer")}
              variant="destructive"
              onConfirmer={() => {
                fermer();
                onSupprimerExistante(donnees.id);
              }}
            />
          ) : null}
          {donnees.genre === "en_attente" ? (
            <BoutonAvecConfirmationSimple
              libelle={t("terrain.photos.retirer_de_la_file")}
              texteConfirmation={t(
                "terrain.photos.retirer_de_la_file_confirmation",
              )}
              libelleConfirmer={t("terrain.photos.supprimer_confirmer")}
              variant="destructive"
              onConfirmer={() => {
                fermer();
                onRetirerEnAttente(donnees.entreeId);
              }}
            />
          ) : null}
          {donnees.genre === "echec" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="text-16"
                onClick={() => {
                  fermer();
                  onRetirerEchec(donnees.localId);
                }}
              >
                {t("terrain.file.retirer_bouton")}
              </Button>
              <Button
                type="button"
                size="lg"
                className="text-16"
                onClick={() => {
                  fermer();
                  onReessayer(donnees.localId);
                }}
              >
                {t("etat.reessayer")}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="text-16"
            onClick={fermer}
          >
            {t("ui.dialogue.fermer")}
          </Button>
        </>
      )}
    />
  );
}

export function PhotosTerrain({
  action,
  interventionId,
  utilisateurId,
  societeId,
  sansSession = false,
  checklistPointId,
  photosExistantes = [],
  afficherExistantes = true,
  interventionOuverte = true,
}: {
  readonly action: string;
  /** Pour ranger la photo dans la file hors réseau (9F4H3, point 1) si l'envoi échoue. */
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  /** LA COQUILLE `/terrain-hors-reseau` (9F4H4D, point 2) — voir le docblock
   * du même nom dans `compteur-terrain.tsx` : aucune session n'y existe
   * jamais, et un refus `"auth.refus"` (D-12, `lib/auth/porte.ts`) y est
   * donc traité comme une coupure réseau, jamais affiché. */
  readonly sansSession?: boolean;
  /**
   * LE POINT DE CHECKLIST QUE CETTE PHOTO RÉPOND, FACULTATIF (9K28-
   * CHECKLIST-REPONSE-PHOTO) — MÊME COMPOSANT, MÊME ROUTE qu'une photo
   * d'intervention ordinaire.
   */
  readonly checklistPointId?: string;
  /** Les photos déjà confirmées par le serveur — absent (checklist) vaut `[]`. */
  readonly photosExistantes?: readonly PhotoExistante[];
  /**
   * `false` SOUS UN POINT DE CHECKLIST (9K28) — la checklist n'est PAS
   * touchée par ce lot : elle garde son propre compteur de photos
   * (`checklist-terrain.tsx`), jamais une grille des photos déjà répondues,
   * qui exigerait de lire `checklist_reponse_photo`. Ce drapeau masque
   * seulement le bloc des photos EXISTANTES et le message « Aucune photo » ;
   * l'ajout et le suivi des photos DE CETTE SESSION restent affichés.
   */
  readonly afficherExistantes?: boolean;
  /** `false` une fois l'intervention terminée/clôturée/annulée (décision d'Alexis du 13/11/2026) — masque Supprimer et la légende sur les photos déjà envoyées. */
  readonly interventionOuverte?: boolean;
}) {
  const router = useRouter();
  const idCamera = useId();
  const idBibliotheque = useId();
  const [tentatives, setTentatives] = useState<readonly TentativeEnvoi[]>([]);
  const [enFile, setEnFile] = useState<readonly EntreeFile[]>([]);
  const urlsRef = useRef(new Map<string, string>());

  const identite = useMemo(
    () => ({ utilisateurId, societeId }),
    [utilisateurId, societeId],
  );

  useEffect(() => {
    let actif = true;
    async function recharger(): Promise<void> {
      const toutes = await listerFilePourIntervention(interventionId, identite);
      if (actif) {
        setEnFile(
          toutes.filter(
            (e) =>
              e.geste.type === "photo" || e.geste.type === "suppression_photo",
          ),
        );
      }
    }
    void recharger();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, recharger);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_FILE_MODIFIEE, recharger);
    };
  }, [interventionId, identite]);

  const photosEnFile = useMemo(() => enFile.filter(estGestePhoto), [enFile]);
  const suppressionsEnFile = useMemo(
    () =>
      new Set(
        enFile.filter(estGesteSuppressionPhoto).map((e) => e.geste.documentId),
      ),
    [enFile],
  );

  useEffect(() => {
    const idsActuels = new Set(photosEnFile.map((e) => e.id));
    for (const [id, url] of urlsRef.current) {
      if (!idsActuels.has(id)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(id);
      }
    }
  }, [photosEnFile]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function urlPour(
    entree: EntreeFile & { readonly geste: GestePhoto },
  ): string {
    let url = urlsRef.current.get(entree.id);
    if (url === undefined) {
      url = URL.createObjectURL(entree.geste.blob);
      urlsRef.current.set(entree.id, url);
    }
    return url;
  }

  function majTentative(id: string, maj: Partial<TentativeEnvoi>): void {
    setTentatives((precedentes) =>
      precedentes.map((tentative) =>
        tentative.id === id ? { ...tentative, ...maj } : tentative,
      ),
    );
  }

  function retirerTentative(id: string): void {
    setTentatives((precedentes) => {
      const trouvee = precedentes.find((tentative) => tentative.id === id);
      if (trouvee !== undefined) {
        URL.revokeObjectURL(trouvee.apercu);
      }
      return precedentes.filter((tentative) => tentative.id !== id);
    });
  }

  async function envoyer(tentativeId: string, fichier: File): Promise<void> {
    majTentative(tentativeId, { etat: "envoi", motif: null });
    let reduite: PhotoReduite;
    try {
      reduite = await reduire(fichier);
    } catch {
      majTentative(tentativeId, {
        etat: "echec",
        motif: "terrain.photos.reduction_impossible",
      });
      return;
    }
    const garderEnFile = async (): Promise<void> => {
      // PAS DE RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1) — la photo
      // réduite est gardée dans la file plutôt que perdue dans l'état
      // mémoire de ce composant ; elle part avec « Envoyer ».
      const resultat = await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: {
          type: "photo",
          blob: reduite.blob,
          nomFichier: reduite.nomFichier,
          libelle: "",
          checklistPointId,
        },
      });
      if (resultat.gardee) {
        retirerTentative(tentativeId);
      } else {
        // JAMAIS « GARDÉE » SANS PREUVE (point 2, 9F4H3A).
        majTentative(tentativeId, {
          etat: "echec",
          motif: "terrain.file.echec_gardee",
        });
      }
    };
    try {
      const donnees = new FormData();
      donnees.set("fichier", reduite.blob, reduite.nomFichier);
      if (checklistPointId !== undefined) {
        donnees.set("checklist_point_id", checklistPointId);
      }
      const reponseServeur = await fetch(action, {
        method: "POST",
        body: donnees,
        headers: { Accept: "application/json" },
      });
      const resultat = (await reponseServeur.json()) as {
        readonly ok: boolean;
        readonly motif: string | null;
      };
      if (resultat.ok) {
        if (afficherExistantes) {
          retirerTentative(tentativeId);
        } else {
          // Voir le docblock de `EtatTentative` — rien d'autre ne rend
          // jamais cette photo visible sous un point de checklist.
          majTentative(tentativeId, { etat: "envoyee", motif: null });
        }
        router.refresh();
        return;
      }
      // DANS LA COQUILLE SEULEMENT (point 2, 9F4H4D).
      if (sansSession && resultat.motif === "auth.refus") {
        await garderEnFile();
        return;
      }
      majTentative(tentativeId, { etat: "echec", motif: resultat.motif });
    } catch {
      await garderEnFile();
    }
  }

  function selectionner(evenement: React.ChangeEvent<HTMLInputElement>): void {
    const fichiers = evenement.currentTarget.files;
    if (fichiers === null) {
      return;
    }
    // ENVOI AUTOMATIQUE, UN PAR FICHIER (point 2 du ticket) — une photo en
    // échec n'empêche jamais les autres : chaque fichier porte sa propre
    // tentative, indépendante des autres. `Array.from` COPIE la liste AVANT
    // de vider le champ : `fichiers` reste une vue LIVE sur `input.files`
    // dans ce moteur (mesuré) — remettre `value = ""` avant cette copie
    // viderait la boucle elle-même, et aucune photo ne serait jamais
    // envoyée.
    const copie = Array.from(fichiers);
    evenement.currentTarget.value = "";
    for (const fichier of copie) {
      const id = crypto.randomUUID();
      const apercu = URL.createObjectURL(fichier);
      setTentatives((precedentes) => [
        ...precedentes,
        { id, apercu, fichier, etat: "envoi", motif: null },
      ]);
      void envoyer(id, fichier);
    }
  }

  function supprimerExistante(documentId: string): void {
    void (async () => {
      try {
        const donnees = new FormData();
        donnees.set("document_id", documentId);
        const reponseServeur = await fetch(`${action}/supprimer`, {
          method: "POST",
          body: donnees,
          headers: { Accept: "application/json" },
        });
        const resultat = (await reponseServeur.json()) as {
          readonly ok: boolean;
        };
        if (resultat.ok) {
          router.refresh();
        }
      } catch {
        // HORS RÉSEAU : LA SUPPRESSION PART AVEC LA FILE, COMME L'AJOUT
        // (décision d'Alexis du 13/11/2026).
        await ajouterSaisie({
          interventionId,
          utilisateurId,
          societeId,
          geste: { type: "suppression_photo", documentId },
        });
      }
    })();
  }

  async function enregistrerLegende(
    documentId: string,
    libelle: string,
  ): Promise<{ readonly ok: boolean; readonly motif: string | null }> {
    try {
      const donnees = new FormData();
      donnees.set("document_id", documentId);
      donnees.set("libelle", libelle);
      const reponseServeur = await fetch(`${action}/legende`, {
        method: "POST",
        body: donnees,
        headers: { Accept: "application/json" },
      });
      const resultat = (await reponseServeur.json()) as {
        readonly ok: boolean;
        readonly motif: string | null;
      };
      if (resultat.ok) {
        router.refresh();
      }
      return resultat;
    } catch {
      return { ok: false, motif: null };
    }
  }

  const existantesVisibles = photosExistantes.filter(
    (photo) => !suppressionsEnFile.has(photo.id),
  );

  const grille: readonly DonneesVignette[] = [
    ...existantesVisibles.map((photo): DonneesVignette => ({
      genre: "existante",
      ...photo,
    })),
    ...photosEnFile.map((entree): DonneesVignette => ({
      genre: "en_attente",
      entreeId: entree.id,
      apercu: urlPour(entree),
    })),
    ...tentatives.map((tentative): DonneesVignette => ({
      genre: tentative.etat,
      localId: tentative.id,
      apercu: tentative.apercu,
      motif: tentative.motif,
    })),
  ];

  return (
    <div
      className="flex flex-col gap-3"
      // DISTINGUE LES DEUX INSTANCES DE LA PAGE (9K28-CHECKLIST-REPONSE-
      // PHOTO) — la section « Photos » générale ET celle d'un point de
      // checklist partagent ce même composant ; une épreuve e2e qui doit
      // viser SPÉCIFIQUEMENT celle d'un point s'appuie sur cet attribut
      // plutôt que sur un `<form>` disparu avec ce lot (9L04E-TERRAIN-
      // PHOTOS-EPUREES, qui envoie par `fetch` plutôt que par soumission
      // native).
      data-checklist-point-id={checklistPointId}
    >
      {afficherExistantes && grille.length === 0 ? (
        <p className="text-app-encre-faible text-16 font-bold">
          {t("terrain.photos.aucune")}
        </p>
      ) : null}
      {grille.length === 0 ? null : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {grille.map((donnees) => (
              <Vignette
                key={
                  donnees.genre === "existante"
                    ? `e-${donnees.id}`
                    : donnees.genre === "en_attente"
                      ? `f-${donnees.entreeId}`
                      : `t-${donnees.localId}`
                }
                donnees={donnees}
                interventionOuverte={interventionOuverte}
                onSupprimerExistante={supprimerExistante}
                onEnregistrerLegende={enregistrerLegende}
                onRetirerEnAttente={(entreeId) => void retirerSaisie(entreeId)}
                onReessayer={(localId) => {
                  const tentative = tentatives.find(
                    (candidate) => candidate.id === localId,
                  );
                  if (tentative !== undefined) {
                    void envoyer(localId, tentative.fichier);
                  }
                }}
                onRetirerEchec={retirerTentative}
              />
            ))}
          </div>
          <p className="text-app-encre-faible text-16 font-bold">
            {t("terrain.photos.aide_toucher")}
          </p>
        </>
      )}
      <label
        htmlFor={idCamera}
        className="bg-app-marque text-app-marque-encre flex h-14 w-full items-center justify-center rounded-[14px] text-16 font-semibold"
      >
        {t("terrain.photos.prendre")}
      </label>
      <input
        id={idCamera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={selectionner}
      />
      <label
        htmlFor={idBibliotheque}
        className="text-app-marque flex h-12 w-full items-center justify-center text-16 font-semibold"
      >
        {t("terrain.photos.bibliotheque")}
      </label>
      <input
        id={idBibliotheque}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={selectionner}
      />
    </div>
  );
}
