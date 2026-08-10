import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className={clsx('container', styles.heroGrid)}>
        <div className={styles.heroText}>
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <p className={styles.heroDescription}>
            {/* Texto inline = idioma padrão do site (pt-BR, ver docusaurus.config.js
                i18n.defaultLocale) — a tradução EN vive em i18n/en/code.json, não aqui. */}
            <Translate id="homepage.hero.description">
              Extraia canais do YouTube, indexe PDFs e documentos, e converse com um
              assistente que responde citando a fonte exata — tudo rodando localmente,
              sem nuvem, sem assinatura.
            </Translate>
          </p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/intro">
              <Translate id="homepage.hero.readDocs">Ler a documentação</Translate>
            </Link>
            <Link
              className="button button--outline button--lg margin-left--md"
              style={{color: 'white', borderColor: 'white'}}
              to="https://github.com/ahaugusto/tusab/releases/latest">
              <Translate id="homepage.hero.download">Baixar o Tusab</Translate>
            </Link>
          </div>
        </div>
        <div className={styles.heroImageWrap}>
          <img
            src={require('@site/static/img/thoth-hero.jpg').default}
            alt={translate({
              id: 'homepage.hero.imageAlt',
              message: 'Thoth, deus egípcio da escrita e do conhecimento, numa sala de controle futurista',
            })}
            className={styles.heroImage}
          />
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={translate({
        id: 'homepage.meta.description',
        message: 'Sistema de gestão de conhecimento pessoal (PKM) com IA local. Extraia canais do YouTube, indexe documentos e converse com um assistente que cita a fonte exata de cada resposta.',
      })}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
