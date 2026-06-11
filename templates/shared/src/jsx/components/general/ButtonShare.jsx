import { useState } from 'react';
import './ButtonShare.css';

const NETWORKS = {
  facebook: {
    icon: (
      <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
    label: 'Share on Facebook',
    open: url => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', popupSpecs())
  },
  email: {
    icon: (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="20" x="2" y="4" />
        <path d="M2 7l10 7 10-7" />
      </svg>
    ),
    label: 'Share by email',
    open: url => {
      window.location.href = `mailto:?body=${encodeURIComponent(url)}`;
    }
  },
  link: {
    icon: (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    label: 'Copy link',
    open: null
  },
  linkedin: {
    icon: (
      <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    label: 'Share on LinkedIn',
    open: url => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}`, '_blank', popupSpecs())
  },
  whatsapp: {
    icon: (
      <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.26 4.8L2 22l5.44-1.43a9.9 9.9 0 0 0 4.6 1.14c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.16a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.39c0-4.54 3.69-8.23 8.22-8.23 2.2 0 4.26.86 5.81 2.41a8.17 8.17 0 0 1 2.4 5.82c0 4.54-3.69 8.25-8.21 8.25zm4.51-6.16c-.25-.12-1.47-.72-1.7-.8-.22-.09-.39-.12-.55.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.01-.38.1-.5.12-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42l-.47-.01c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.06 0 1.22.88 2.39 1 2.56.13.17 1.75 2.67 4.24 3.74.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
      </svg>
    ),
    label: 'Share on WhatsApp',
    open: url => window.open(`whatsapp://send?text=${encodeURIComponent(url)}`, '_blank')
  },
  x: {
    icon: (
      <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L2.25 2.25H8.08l4.261 5.635L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    ),
    label: 'Share on X',
    open: url => window.open(`https://twitter.com/share?url=${encodeURIComponent(url)}&hashtags=unctad`, '_blank', popupSpecs())
  }
};

function popupSpecs() {
  return `top=${window.screen.height / 2 - 210},left=${window.screen.width / 2 - 275},width=550,height=420`;
}

function ButtonShare({ url, defaultOpen = false, position = 'absolute', iconBg = 'rgba(0,0,0,0.45)', iconHoverBg = 'rgba(0,0,0,1)', iconColor = '#fff', iconHoverColor = null, borderRadius = '50%', size = 36, showLabel = true, networks = ['facebook', 'x', 'linkedin', 'whatsapp', 'email', 'link'] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredKey, setHoveredKey] = useState(null);

  const btnStyle = key => ({
    backgroundColor: hoveredKey === key && iconHoverBg != null ? iconHoverBg : iconBg,
    borderRadius,
    color: hoveredKey === key && iconHoverColor != null ? iconHoverColor : iconColor,
    height: size,
    width: size
  });

  const hoverOn = key => () => setHoveredKey(key);
  const hoverOff = () => setHoveredKey(null);

  const handleClick = (network, e) => {
    e.preventDefault();
    if (network === 'link') {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
      return;
    }
    NETWORKS[network].open(url);
  };

  const panelVisible = defaultOpen || open;

  return (
    <div className={`share_wrapper share_wrapper_${position}`}>
      {!defaultOpen && (
        <button aria-expanded={open} aria-label="Share" className="share_btn share_btn_toggle" onClick={() => setOpen(p => !p)} onMouseEnter={hoverOn('toggle')} onMouseLeave={hoverOff} style={btnStyle('toggle')} type="button">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
            <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </svg>
        </button>
      )}

      {panelVisible && (
        <div className="share_panel">
          {showLabel && <span className="share_label">SHARE</span>}
          {networks.map(network => (
            <button
              aria-label={NETWORKS[network].label}
              className={`share_btn share_btn_${network}`}
              key={network}
              onClick={e => handleClick(network, e)}
              onMouseEnter={hoverOn(network)}
              onMouseLeave={hoverOff}
              style={btnStyle(network)}
              title={network === 'link' && copied ? 'Copied!' : NETWORKS[network].label}
              type="button"
            >
              {NETWORKS[network].icon}
              {network === 'link' && copied && <span className="share_copied_msg">Copied!</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ButtonShare;
