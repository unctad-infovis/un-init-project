import './Footer.css';

const defaultLanguageLinks = [
  { label: 'Français', url: '#' },
  { label: 'Español', url: '#' },
  { label: 'العربية', url: '#' },
  { label: '简体中文', url: '#' },
  { label: 'Русский', url: '#' },
  { label: 'Português', url: '#' }
];

const defaultMediaLinks = [
  { label: 'Photos', url: '#' },
  { label: 'Digital assets', url: '#' }
];

function Footer({
  videoUrl = 'https://player.vimeo.com/video/000000000',
  videoTitle = 'UNCTAD publication video',
  launchEventUrl = 'https://player.vimeo.com/video/000000001',
  launchEventTitle = 'Launch event',
  languageLinks = defaultLanguageLinks,
  mediaLinks = defaultMediaLinks,
  reportUrl = '#'
}) {
  return (
    <div className="footer_container">
      <h2>What do you want to do next?</h2>
      <div className="footer_download">
        <a href={reportUrl} target="_blank" rel="noreferrer">Download the full report</a>
      </div>
      <div className="footer_elements">
        <div className="footer_element">
          <div className="footer_content">
            <h3>Watch the video</h3>
            <div className="iframe_container iframe_16_9">
              <iframe
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                frameBorder="0"
                src={videoUrl}
                title={videoTitle}
              />
            </div>
            {languageLinks.length > 0 && (
              <ul className="language_links">
                <li>
                  {languageLinks.map((link, i) => (
                    <span key={link.label}>
                      {i > 0 && ', '}
                      <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                    </span>
                  ))}
                </li>
              </ul>
            )}
            <h4>Watch the launch event</h4>
            <div className="iframe_container iframe_16_9">
              <iframe
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                frameBorder="0"
                src={launchEventUrl}
                title={launchEventTitle}
              />
            </div>
            <p>{launchEventTitle}</p>
            {mediaLinks.length > 0 && (
              <div>
                <h4>Media assets</h4>
                <ul>
                  {mediaLinks.map(link => (
                    <li key={link.label}>
                      <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Footer;
