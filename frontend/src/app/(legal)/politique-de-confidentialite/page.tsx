import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de confidentialité — UstensINT",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>

      <section>
        <h2>1. Collecte des données personnelles</h2>
        <p>
          Nous collectons uniquement les données strictement nécessaires au fonctionnement du service
          de réservation :
        </p>
        <ul>
          <li>
            <strong>Adresse email :</strong> pour vous identifier et vous contacter.
          </li>
          <li>
            <strong>Nom et prénom :</strong> déduits automatiquement de votre adresse email
            institutionnelle.
          </li>
          <li>
            <strong>Numéro de téléphone :</strong> (optionnel) pour vous joindre en cas d&apos;urgence
            concernant votre réservation.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Finalité du traitement</h2>
        <p>Vos données sont utilisées exclusivement pour :</p>
        <ul>
          <li>Gérer l&apos;authentification et l&apos;accès au service.</li>
          <li>Enregistrer, valider et suivre vos réservations de matériel.</li>
          <li>Vous contacter concernant vos réservations en cours.</li>
        </ul>
      </section>

      <section>
        <h2>3. Cookies et traceurs</h2>
        <p>
          Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong> à son
          fonctionnement :
        </p>
        <ul>
          <li>
            <code>token</code> : maintient votre session connectée (durée : 7 jours).
          </li>
          <li>
            <code>NEXT_LOCALE</code> : sauvegarde votre préférence de langue (durée : 1 an).
          </li>
          <li>
            <code>cookie_consent</code> : enregistre le fait que vous ayez masqué le bandeau
            d&apos;information.
          </li>
        </ul>
        <p>
          <strong>Aucun cookie publicitaire ou d&apos;analyse d&apos;audience n&apos;est utilisé sur
          ce site.</strong>{" "}
          Conformément aux recommandations de la CNIL, les cookies strictement nécessaires sont
          exemptés de recueil de consentement explicite.
        </p>
      </section>

      <section>
        <h2>4. Conservation des données</h2>
        <p>
          Vos données sont conservées pour la durée de votre scolarité ou de votre implication
          associative. L&apos;historique des réservations est conservé à des fins d&apos;audit et de
          suivi de l&apos;état du matériel.
        </p>
      </section>

      <section>
        <h2>5. Vos droits (RGPD)</h2>
        <p>
          Conformément au Règlement général sur la protection des données, vous disposez des droits
          suivants :
        </p>
        <ul>
          <li>Droit d&apos;accès et d&apos;exportation de vos données.</li>
          <li>Droit de rectification de vos informations.</li>
          <li>
            Droit à l&apos;effacement de votre compte et de vos données personnelles (droit à
            l&apos;oubli).
          </li>
        </ul>
        <p>
          L&apos;export et la suppression sont disponibles directement depuis la page{" "}
          <Link href="/mon-compte">Mon compte</Link>. Pour toute autre demande, contactez
          associations@telecom-sudparis.eu.
        </p>
      </section>
    </>
  );
}
