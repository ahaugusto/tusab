import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Index — indexação multi-fonte',
    image: require('@site/static/img/thoth-index.jpg').default,
    description: (
      <>
        Canais inteiros do YouTube, PDFs, DOCX, áudio, imagens, WhatsApp e
        transcrições de reunião — tudo extraído e indexado localmente, sem
        servidor intermediário.
      </>
    ),
  },
  {
    title: 'Augment — RAG local',
    image: require('@site/static/img/thoth-augment.jpg').default,
    description: (
      <>
        BM25 + FTS5 + CrossEncoder (e busca vetorial opcional) recuperam os
        trechos mais relevantes da sua base e os entregam ao modelo como
        contexto — sem alucinar fora do que foi indexado.
      </>
    ),
  },
  {
    title: 'Chat — resposta com fonte',
    image: require('@site/static/img/thoth-chat.jpg').default,
    description: (
      <>
        Toda resposta cita título, data e link de origem. Roda offline com
        Ollama, ou com Groq, OpenAI, Anthropic e Gemini como provedores
        opcionais.
      </>
    ),
  },
];

function Feature({title, image, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className={clsx('text--center', styles.featureCard)}>
        <img src={image} alt="" className={styles.featureImage} />
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
