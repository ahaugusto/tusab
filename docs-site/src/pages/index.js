import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroDescription}>
          Extraia canais do YouTube, indexe PDFs e documentos, e converse com um
          assistente que responde citando a fonte exata — tudo rodando localmente,
          sem nuvem, sem assinatura.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/intro">
            Ler a documentação
          </Link>
          <Link
            className="button button--outline button--lg margin-left--md"
            style={{color: 'white', borderColor: 'white'}}
            to="https://github.com/ahaugusto/tusab/releases/latest">
            Baixar o Tusab
          </Link>
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
      description="Sistema de gestão de conhecimento pessoal (PKM) com IA local. Extraia canais do YouTube, indexe documentos e converse com um assistente que cita a fonte exata de cada resposta.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
