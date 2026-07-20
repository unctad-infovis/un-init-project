const basePath = () => {
  const { hostname, href } = window.location;
  if (href.includes('unctad.org')) return `https://storage.unctad.org/${__PROJECT_NAME__}/`;
  if (hostname === 'localhost') return './';
  return `https://unctad-infovis.github.io/${__PROJECT_NAME__}/`;
};

export const resolveAsset = url => (url?.startsWith('http') ? url : `${basePath()}${url}`);

export default basePath;
