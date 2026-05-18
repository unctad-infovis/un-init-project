import { useState } from 'react';

import './ButtonShare.css';

function ButtonShare({ url }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const popupSpecs = () => `top=${window.screen.height / 2 - 420 / 2},left=${window.screen.width / 2 - 550 / 2},width=550,height=420`;

  const openPopup = shareUrl => {
    window.open(shareUrl, '_blank', popupSpecs());
  };

  const toggle = () => {
    setOpen(prev => !prev);
  };

  const copyToClipboard = async event => {
    event.preventDefault();

    await navigator.clipboard.writeText(url);

    setCopied(true);

    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="share_wrapper">
      <div className="share_container">
        <div className="icon_container">
          <button type="button" onClick={() => toggle()}>
            <img src="https://storage.unctad.org/2025-wir_report/assets/img/icons/icon_share.png" alt="Share" />
          </button>
        </div>
        {open && (
          <div className="share_buttons">
            <button className="share_button" onClick={() => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${url}`)} type="button">
              <img src="https://storage.unctad.org/2025-wir_report/assets/img/icons/icon_facebook.png" alt="Facebook" />
            </button>
            <button className="share_button" onClick={() => openPopup(`https://twitter.com/share?url=${encodeURIComponent(url)}&hashtags=unctad`)} type="button">
              <img src="https://storage.unctad.org/2025-wir_report/assets/img/icons/icon_x.png" alt="X" />
            </button>
            <button className="share_button" onClick={() => openPopup(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}`)} type="button">
              <img src="https://storage.unctad.org/2025-wir_report/assets/img/icons/icon_linkedin.png" alt="LinkedIn" />
            </button>
            <button className="share_button" onClick={() => openPopup(`whatsapp://send?text=${encodeURIComponent(url)}`)} type="button">
              <img src="https://storage.unctad.org/2025-tir_report/assets/img/icons/icon_whatsapp.png" alt="Whatspp" />
            </button>
            <button className="share_button" onClick={copyToClipboard} type="button">
              <img src="https://storage.unctad.org/2025-wir_report/assets/img/icons/icon_link.png" alt="Copy link" />
              {copied && <div className="copied_message active">Copied to clipboard</div>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ButtonShare;
