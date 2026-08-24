// Icons are hosted, not bundled: always served from storage.unctad.org.
// (The un-init-project repo is private, so a raw-GitHub-content fallback
// for non-unctad.org environments 404s and cannot be used.)
const basePath = () => 'https://storage.unctad.org/shared-resources/icons/';

export const getIconUrl = filename => `${basePath()}${filename}`;

export default basePath;
