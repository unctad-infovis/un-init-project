const getHost = () => {
  const { href } = window.location;
  if (href.includes('unctad.org')) return 'https://storage.unctad.org/2026-__PROJECT_NAME__/';
  if (href.includes('localhost')) return './';
  return 'https://unctad-infovis.github.io/2026-__PROJECT_NAME__/';
};

const loadFile = async file => {
  try {
    const response = await fetch(getHost() + file);
    if (!response.ok) throw new Error(response.statusText);
    const body = await response.text();
    return JSON.parse(body);
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default loadFile;