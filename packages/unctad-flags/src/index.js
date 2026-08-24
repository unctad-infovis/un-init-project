// Flags are hosted, not bundled: always served from storage.unctad.org.
// (The un-init-project repo is private, so a raw-GitHub-content fallback
// for non-unctad.org environments 404s and cannot be used.)
const basePath = () => 'https://storage.unctad.org/shared-resources/flags/round/';

export const getFlagUrl = countryCode => `${basePath()}${countryCode.toLowerCase()}.svg`;

export default basePath;
