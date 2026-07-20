import './Quote.css';

const Quote = ({ name, text, title }) => (
  <figure className="quote">
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
