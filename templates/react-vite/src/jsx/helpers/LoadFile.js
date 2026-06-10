import basePath from './BasePath.js';

const loadFile = async file => {
  try {
    const response = await fetch(basePath() + file);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return response;
  } catch (error) {
    console.error(error);

    return null;
  }
};
export default loadFile;
