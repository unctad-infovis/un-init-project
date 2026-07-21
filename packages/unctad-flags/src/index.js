// Flags are hosted, not bundled: storage.unctad.org in production, raw GitHub
// content everywhere else (dev, gh-pages) since this repo is public.
const basePath = () => {
  if (window.location.href.includes('unctad.org')) return 'https://storage.unctad.org/shared-resources/flags/round/';
  return 'https://raw.githubusercontent.com/unctad-infovis/un-init-project/main/packages/unctad-flags/src/round/';
};

export const getFlagUrl = countryCode => `${basePath()}${countryCode.toLowerCase()}.svg`;

export default basePath;
