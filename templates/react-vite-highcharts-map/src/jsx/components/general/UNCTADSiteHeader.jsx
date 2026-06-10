import basePath from './../../helpers/BasePath';
import './UNCTADSiteHeader.css';

const NAV_ITEMS = ['About', 'Topics', 'Statistics and data', 'Publications', 'Meetings', 'Technical cooperation', 'Media'];

const IMG = 'assets/img/unctad_site_header/';

const BUTTONS = [
  { key: 'unctad16', label: 'UNCTAD16', icon: 'unctad_site_header_icon_unctad16.png' },
  { key: 'subscribe', label: 'Subscribe', icon: 'unctad_site_header_icon_subscribe.png' },
  { key: 'tariffs', label: 'Tariffs', icon: 'unctad_site_header_icon_tariffs.png' }
];

export default function UNCTADSiteHeader({ children }) {
  return (
    <>
      <div className="unctad_site_preview" aria-hidden="true">
        {/* ── Top utility bar ── */}
        <div className="usp_topbar">
          <div className="usp_container">
            <div className="usp_brand">
              <svg viewBox="0 0 576 512" aria-hidden="true">
                <path d="M575.8 255.5c0 18-15 32.1-32 32.1l-32 0 .7 160.2c0 2.7-.2 5.4-.5 8.1l0 16.2c0 22.1-17.9 40-40 40l-16 0c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1L416 512l-24 0c-22.1 0-40-17.9-40-40l0-24 0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32l0 64 0 24c0 22.1-17.9 40-40 40l-24 0-31.9 0c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2l-16 0c-22.1 0-40-17.9-40-40l0-112c0-.9 0-1.9 .1-2.8l0-69.7-32 0c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z" />
              </svg>
              <span className="usp_brand_full">Welcome to DEMO SITE</span>
              <span className="usp_brand_short">Welcome to DEMO SITE</span>
            </div>
            {/* Desktop: language list */}
            <ul className="usp_languages usp_desktop_only">
              <li className="usp_lang_active">English</li>
              <li>Français</li>
              <li>Español</li>
            </ul>
            {/* Mobile: language dropdown */}
            <div className="usp_lang_mobile usp_mobile_only">
              <svg viewBox="0 0 640 512" aria-hidden="true">
                <path d="M0 128C0 92.7 28.7 64 64 64l192 0 48 0 16 0 256 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64l-256 0-16 0-48 0L64 448c-35.3 0-64-28.7-64-64L0 128zm48 0l0 256c0 8.8 7.2 16 16 16l48 0 0-288-48 0c-8.8 0-16 7.2-16 16zm112 288l224 0 0-288-224 0 0 288zm272 0l48 0c8.8 0 16-7.2 16-16l0-256c0-8.8-7.2-16-16-16l-48 0 0 288z" />
              </svg>
              <strong>English</strong>
              <svg className="usp_dropdown_arrow" viewBox="0 0 320 512" aria-hidden="true">
                <path d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Logo + buttons ── */}
        <div className="usp_header">
          <div className="usp_container">
            <span className="usp_logo_link">
              <img alt="UN Trade and Development (UNCTAD)" className="usp_logo usp_logo_large" src={`${basePath()}assets/img/unctad_site_header/unctad_site_header_logo.png`} />
              <img alt="UN Trade and Development (UNCTAD)" className="usp_logo usp_logo_small" src={`${basePath()}assets/img/unctad_site_header/unctad_site_header_logo_small.png`} />
            </span>
            {/* Desktop: action button nav */}
            <ul className="usp_btn_list usp_desktop_only">
              {BUTTONS.map(({ key, label, icon }) => (
                <li key={key} className={`usp_btn_item usp_btn_${key}`}>
                  <span className="usp_btn_link">
                    <img className="usp_btn_bg" alt="" src={`${basePath()}assets/img/unctad_site_header/unctad_site_header_button_bg.png`} />
                    <span className="usp_btn_label">{label}</span>
                    <img className="usp_btn_icon" alt="" src={`${basePath()}${IMG}${icon}`} />
                  </span>
                </li>
              ))}
            </ul>
            {/* Mobile: search + hamburger circles */}
            <div className="usp_mobile_controls usp_mobile_only">
              <button className="usp_circle_btn usp_search_btn" type="button" aria-label="Search">
                <svg viewBox="0 0 512 512" aria-hidden="true">
                  <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
                </svg>
              </button>
              <button className="usp_circle_btn usp_menu_btn" type="button" aria-label="Menu">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path fillRule="evenodd" d="M2.5 11.5A.5.5 0 0 1 3 11h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4A.5.5 0 0 1 3 7h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4A.5.5 0 0 1 3 3h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
                </svg>
              </button>
            </div>
          </div>
          {/* Mobile: small-header-menu (no icons, background stretches full width) */}
          <div className="usp_small_menu usp_mobile_only">
            <div className="usp_container">
              <ul className="usp_small_menu_list">
                {BUTTONS.map(({ key, label }) => (
                  <li key={key} className={`usp_small_item usp_small_${key}`}>
                    <span className="usp_small_link">
                      <img className="usp_small_bg" alt="" src={`${basePath()}assets/img/unctad_site_header/unctad_site_header_button_bg.png`} />
                      <span className="usp_small_label">{label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Desktop navigation bar ── */}
        <nav className="usp_nav usp_desktop_only">
          <div className="usp_container">
            <ul className="usp_nav_list">
              {NAV_ITEMS.map(item => (
                <li key={item} className="usp_nav_item">
                  <div>
                    {item} <span className="usp_nav_arrow">»</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="usp_nav_account">
              <span className="usp_nav_icon_link">
                <svg viewBox="0 0 448 512" aria-hidden="true">
                  <title>Empty</title>
                  <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" />
                </svg>
              </span>
              <span className="usp_nav_icon_link usp_nav_search">
                <svg viewBox="0 0 512 512" aria-hidden="true">
                  <title>Empty</title>
                  <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
                </svg>
              </span>
            </div>
          </div>
        </nav>
      </div>
      {children}
    </>
  );
}
