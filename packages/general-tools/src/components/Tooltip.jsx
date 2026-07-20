import { useId } from 'react';

import './Tooltip.css';

const handleTriggerKeyDown = event => {
  if (event.key === 'Escape') {
    event.currentTarget.blur();
  }
};

function Tooltip({ children, className = '', content, label = 'More information' }) {
  const bubbleId = useId();

  return (
    <span className={`un_tooltip ${className}`.trim()}>
      <button aria-describedby={bubbleId} aria-label={children ? undefined : label} className="un_tooltip_trigger" onKeyDown={handleTriggerKeyDown} type="button">
        {children ?? <span aria-hidden="true">i</span>}
      </button>
      <span className="un_tooltip_bubble" id={bubbleId} role="tooltip">
        {content}
      </span>
    </span>
  );
}

export default Tooltip;
