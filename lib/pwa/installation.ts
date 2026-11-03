/**
 * DÉTECTION DE L'ÉTAT D'INSTALLATION DE L'APPLICATION (9I00) — fonction pure :
 * aucun accès au DOM ici, seulement des signaux déjà lus par l'appelant
 * (`components/pwa/magasin-installation.tsx`), pour rester éprouvable sans
 * navigateur.
 */
export type EtatInstallation =
  "deja_installee" | "android_chrome" | "ios_safari" | "autre";

export function detecterEtatInstallation(signaux: {
  /** `matchMedia("(display-mode: standalone)")`, ou `navigator.standalone` sur iOS. */
  modeAutonome: boolean;
  /** Un `beforeinstallprompt` a déjà été reçu et retenu. */
  invitationAndroidDisponible: boolean;
  userAgent: string;
}): EtatInstallation {
  if (signaux.modeAutonome) {
    return "deja_installee";
  }
  if (signaux.invitationAndroidDisponible) {
    return "android_chrome";
  }
  if (estSafariIos(signaux.userAgent)) {
    return "ios_safari";
  }
  return "autre";
}

/** Un iPhone/iPad/iPod, dans Safari — jamais Chrome ou Firefox sur iOS, qui n'offrent pas l'ajout à l'écran d'accueil par ce geste. */
export function estSafariIos(userAgent: string): boolean {
  const estAppareilIos = /iphone|ipad|ipod/i.test(userAgent);
  const estSafari =
    /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
  return estAppareilIos && estSafari;
}
