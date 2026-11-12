import './Quote.css';

// `variant="bar"`: statement-style quote – bold upright text with a thin blue bar on its left
// instead of the big quote icon (first used by 2026-tdr_report). Default keeps the icon style.
const Quote = ({ name, text, title, variant }) => (
  <figure className={`quote${variant ? ` quote--${variant}` : ''}`}>
    <blockquote>
      <div className="quote">{text}</div>
      <div className="author">
        <span className="name">{name}</span>
        <span className="title">{title}</span>
      </div>
    </blockquote>
  </figure>
);

export default Quote;
