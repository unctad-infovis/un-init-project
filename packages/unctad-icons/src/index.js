// Icons are hosted, not bundled: storage.unctad.org in production, raw GitHub
// content everywhere else (dev, gh-pages) since this repo is public.
const basePath = () => {
  if (window.location.href.includes('unctad.org')) return 'https://storage.unctad.org/shared-resources/icons/';
  return 'https://raw.githubusercontent.com/unctad-infovis/un-init-project/main/packages/unctad-icons/src/';
};

export const getIconUrl = filename => `${basePath()}${filename}`;

export default basePath;
