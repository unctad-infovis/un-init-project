const basePath = () => {
  const { href } = window.location;
  if (href.includes('unctad.org')) return `https://storage.unctad.org/${__PROJECT_NAME__}/`;
  if (href.includes('localhost')) return './';
  return `https://unctad-infovis.github.io/${__PROJECT_NAME__}/`;
};

export default basePath;
