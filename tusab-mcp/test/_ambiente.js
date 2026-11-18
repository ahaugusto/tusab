// Testes rodam em português, qualquer que seja o idioma do sistema (CI, macOS em inglês).
// Os processos do plugin abertos pelos testes herdam esta variável.
process.env.TUSAB_IDIOMA ||= 'pt';
