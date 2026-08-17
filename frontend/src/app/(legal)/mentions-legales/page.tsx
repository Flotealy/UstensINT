import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — UstensINT",
};

export default function MentionsLegalesPage() {
  return (
    <>
      <h1>Mentions légales</h1>

      <section>
        <h2>1. Éditeur du site</h2>
        <p>
          Le site <strong>UstensINT</strong> est édité par le bureau des associations (ou
          association étudiante compétente) de Télécom SudParis et Institut Mines-Télécom Business
          School.
        </p>
        <p>
          <strong>Adresse :</strong> 9 rue Charles Fourier, 91000 Évry-Courcouronnes, France.
          <br />
          <strong>Contact :</strong> associations@telecom-sudparis.eu
        </p>
      </section>

      <section>
        <h2>2. Hébergement</h2>
        <p>
          Le site est hébergé sur une machine virtuelle fournie et gérée par la DSI de Télécom
          SudParis.
        </p>
        <p>
          <strong>Hébergeur :</strong> Institut Mines-Télécom (IMT)
          <br />
          <strong>Adresse :</strong> 19 place Marguerite Perey, 91120 Palaiseau, France
        </p>
      </section>

      <section>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble de ce site relève de la législation française et internationale sur le
          droit d&apos;auteur et la propriété intellectuelle. Le code source est disponible sous
          licence MIT. Les marques et logos de Télécom SudParis et IMT-BS appartiennent à leurs
          propriétaires respectifs.
        </p>
      </section>

      <section>
        <h2>4. Responsabilité</h2>
        <p>
          L&apos;éditeur s&apos;efforce de fournir des informations exactes sur la disponibilité du
          matériel, mais ne saurait garantir l&apos;exactitude, la complétude ou l&apos;actualité des
          informations diffusées sur le site.
        </p>
      </section>
    </>
  );
}
