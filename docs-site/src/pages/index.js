import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, {translate} from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

// Textos inline = idioma padrão do site (pt-BR); a tradução em inglês fica em i18n/en/code.json.

// Botões de contorno em branco: o hero é preto nos dois temas (ver src/css/custom.css).
const contorno = {color: '#fff', borderColor: '#fff'};

function Cabecalho() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className={styles.heroDescription}>
          <Translate id="homepage.hero.description">
            Extensão MCP local para ferramentas de IA, como o Claude Desktop: guarda e indexa vídeos do YouTube,
            documentos e fontes públicas no computador do usuário e entrega à IA só os trechos consultados, com
            citação do vídeo e minuto ou da página.
          </Translate>
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/instalacao">
            <Translate id="homepage.hero.install">Instalar</Translate>
          </Link>
          <Link className="button button--outline button--lg" style={contorno} to="/intro">
            <Translate id="homepage.hero.docs">Documentação</Translate>
          </Link>
          <Link className="button button--outline button--lg" style={contorno} to="https://github.com/criaugu/tusab">
            <Translate id="homepage.hero.github">GitHub</Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Resumo() {
  return (
    <section className={clsx('container', styles.summary)}>
      <ul>
        <li>
          <Link to="/ferramentas-mcp">
            <Translate id="homepage.summary.tools">15 ferramentas MCP</Translate>
          </Link>{' '}
          <Translate id="homepage.summary.toolsText">
            para buscar, ler fontes e originais, adicionar conteúdo e guardar material de estudo.
          </Translate>
        </li>
        <li>
          <Link to="/tela">
            <Translate id="homepage.summary.screen">Tela local</Translate>
          </Link>{' '}
          <Translate id="homepage.summary.screenText">
            em 127.0.0.1, com chave por sessão, para extrair canais e organizar o repositório.
          </Translate>
        </li>
        <li>
          <Link to="/arquitetura/visao-geral">
            <Translate id="homepage.summary.architecture">Arquitetura</Translate>
          </Link>{' '}
          <Translate id="homepage.summary.architectureText">
            servidor Node.js por stdio, índice SQLite FTS5, dados em pastas locais.
          </Translate>
        </li>
      </ul>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={translate({
        id: 'homepage.meta.description',
        message:
          'Documentação técnica do Tusab, extensão MCP local que mantém a base de conhecimento no computador do usuário e entrega à IA só os trechos consultados, com citação.',
      })}>
      <Cabecalho />
      <main>
        <Resumo />
      </main>
    </Layout>
  );
}
