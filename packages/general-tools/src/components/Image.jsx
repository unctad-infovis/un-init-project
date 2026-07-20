import { resolveAsset } from '../helpers/BasePath.js';
import useIsVisible from '../helpers/UseIsVisible.js';

import './Image.css';

function Image({ alt, caption, image_url, parallax = false }) {
  const [ref, isVisible] = useIsVisible(0.4);
  const src = resolveAsset(image_url);

  return (
    <figure className="image">
      {parallax ? (
        <div className="parallax_container" style={{ opacity: isVisible ? '1' : '0', top: isVisible ? '0px' : '50px' }}>
          <img ref={ref} src={src} alt={alt} />
        </div>
      ) : (
        <img ref={ref} src={src} alt={alt} />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export default Image;
