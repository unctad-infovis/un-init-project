import { useEffect, useId, useMemo, useRef, useState } from 'react';

import useClickOutside from '../helpers/UseClickOutside.js';

import './Select.css';

function Select({ ariaLabel, className = '', clearable = false, disabled = false, id, label, multiple = false, name, onChange, options, placeholder = 'Select…', searchable = true, value }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOptions = useMemo(() => (multiple ? (value ?? []) : []), [multiple, value]);

  const [query, setQuery] = useState(multiple ? '' : (value?.label ?? ''));
  const [open, setOpen] = useState(false);
  const [hasTypedSinceOpen, setHasTypedSinceOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    if (!multiple) setQuery(value?.label ?? '');
  }, [multiple, value]);

  const isGrouped = options.length > 0 && options[0]?.options !== undefined;

  const flatOptions = useMemo(() => {
    if (!isGrouped) return options;
    return options.flatMap(group => group.options.map(option => ({ ...option, group: group.label })));
  }, [isGrouped, options]);

  const selectableOptions = useMemo(() => (multiple ? flatOptions.filter(option => !selectedOptions.some(selected => selected.value === option.value)) : flatOptions), [flatOptions, multiple, selectedOptions]);

  const filteredOptions = useMemo(() => {
    if (!hasTypedSinceOpen || !query) return selectableOptions;
    const lowerQuery = query.toLowerCase();
    return selectableOptions.filter(option => option.label.toLowerCase().includes(lowerQuery));
  }, [hasTypedSinceOpen, query, selectableOptions]);

  const groupedFilteredOptions = useMemo(() => {
    if (!isGrouped) return [{ label: undefined, options: filteredOptions }];
    const groups = [];
    filteredOptions.forEach(option => {
      let group = groups.find(candidate => candidate.label === option.group);
      if (!group) {
        group = { label: option.group, options: [] };
        groups.push(group);
      }
      group.options.push(option);
    });
    return groups;
  }, [filteredOptions, isGrouped]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const optionEl = document.getElementById(`${listboxId}-option-${highlightedIndex}`);
    optionEl?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex, listboxId]);

  const closePopup = () => {
    setOpen(false);
    setHasTypedSinceOpen(false);
    if (!multiple) setQuery(value?.label ?? '');
  };

  useClickOutside(wrapperRef, closePopup, open);

  const openPopup = () => {
    if (disabled) return;
    setOpen(true);
    setHasTypedSinceOpen(false);
    const currentIndex = !multiple && value ? flatOptions.findIndex(option => option.value === value.value) : -1;
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  };

  const selectOption = option => {
    if (multiple) {
      onChange([...selectedOptions, option]);
      setQuery('');
      setHasTypedSinceOpen(false);
      setHighlightedIndex(0);
      inputRef.current?.focus();
    } else {
      onChange(option);
      setQuery(option.label);
      setOpen(false);
      setHasTypedSinceOpen(false);
    }
  };

  const removeOption = optionValue => {
    onChange(selectedOptions.filter(option => option.value !== optionValue));
    inputRef.current?.focus();
  };

  const handleInputChange = event => {
    setQuery(event.target.value);
    setHasTypedSinceOpen(true);
    setOpen(true);
    setHighlightedIndex(0);
  };

  const handleClear = () => {
    onChange(multiple ? [] : null);
    setQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openPopup();
        return;
      }
      setHighlightedIndex(current => Math.min(current + 1, filteredOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openPopup();
        return;
      }
      setHighlightedIndex(current => Math.max(current - 1, 0));
    } else if (event.key === 'Home') {
      if (open) {
        event.preventDefault();
        setHighlightedIndex(0);
      }
    } else if (event.key === 'End') {
      if (open) {
        event.preventDefault();
        setHighlightedIndex(filteredOptions.length - 1);
      }
    } else if (event.key === 'Enter') {
      if (open && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        event.preventDefault();
        selectOption(filteredOptions[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        closePopup();
      }
    } else if (event.key === 'Backspace') {
      if (multiple && query === '' && selectedOptions.length > 0) {
        removeOption(selectedOptions.at(-1).value);
      }
    }
  };

  const activeOptionId = open && highlightedIndex >= 0 && filteredOptions[highlightedIndex] ? `${listboxId}-option-${highlightedIndex}` : undefined;

  let flatIndex = -1;

  return (
    <div className={`un_select ${className}`.trim()} ref={wrapperRef}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="un_select_control">
        {multiple && selectedOptions.length > 0 && (
          <ul className="un_select_tags">
            {selectedOptions.map(option => (
              <li className="un_select_tag" key={option.value}>
                {option.label}
                <button aria-label={`Remove ${option.label}`} className="un_select_tag_remove" disabled={disabled} onClick={() => removeOption(option.value)} type="button">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={label ? undefined : ariaLabel}
          autoComplete="off"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          data-lpignore="true"
          disabled={disabled}
          id={inputId}
          onChange={searchable ? handleInputChange : undefined}
          onClick={openPopup}
          onFocus={openPopup}
          onKeyDown={handleKeyDown}
          placeholder={selectedOptions.length > 0 ? '' : placeholder}
          readOnly={!searchable}
          ref={inputRef}
          role="combobox"
          type="text"
          value={query}
        />
        {clearable && (multiple ? selectedOptions.length > 0 : value) && (
          <button aria-label="Clear selection" className="un_select_clear" disabled={disabled} onClick={handleClear} type="button">
            ×
          </button>
        )}
        <span aria-hidden="true" className="un_select_chevron" />
      </div>
      {name && !multiple && <input name={name} type="hidden" value={value?.value ?? ''} />}
      {name && multiple && selectedOptions.map(option => <input key={option.value} name={name} type="hidden" value={option.value} />)}
      {open && (
        <ul className="un_select_listbox" id={listboxId} role="listbox" aria-multiselectable={multiple || undefined}>
          {groupedFilteredOptions.map(group => (
            <li className="un_select_group" key={group.label ?? 'ungrouped'} role="presentation">
              {group.label && <div className="un_select_group_label">{group.label}</div>}
              <ul role="group">
                {group.options.map(option => {
                  flatIndex += 1;
                  const index = flatIndex;
                  return (
                    <li
                      aria-selected={!multiple && option.value === value?.value}
                      className={`un_select_option${index === highlightedIndex ? ' highlighted' : ''}`}
                      id={`${listboxId}-option-${index}`}
                      key={option.value}
                      onMouseDown={event => {
                        event.preventDefault();
                        selectOption(option);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      role="option"
                    >
                      {option.label}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {filteredOptions.length === 0 && (
            <li aria-disabled="true" className="un_select_empty">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default Select;
