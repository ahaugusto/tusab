import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Index — indexação multi-fonte',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
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
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        BM25 + CrossEncoder recuperam os trechos mais relevantes da sua base
        e os entregam ao modelo como contexto — sem alucinar fora do que foi
        indexado.
      </>
    ),
  },
  {
    title: 'Chat — resposta com fonte',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Toda resposta cita título, data e link de origem. Roda offline com
        Ollama, ou com Groq, OpenAI, Anthropic e Gemini como provedores
        opcionais.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
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
