import useIsVisible from './../../helpers/UseIsVisible';

import './Image.css';

function Image({ alt, caption, image_url, parallax = false }) {
  const [ref, isVisible] = useIsVisible(0.4);

  return (
    <figure className="image">
      {parallax ? (
        <div className="parallax_container" style={{ opacity: isVisible ? '1' : '0', top: isVisible ? '0px' : '50px' }}>
          <img ref={ref} src={image_url} alt={alt} />
        </div>
      ) : (
        <img ref={ref} src={image_url} alt={alt} />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export default Image;
