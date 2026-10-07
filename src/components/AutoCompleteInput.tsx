import React, { useState, useRef, useEffect, useMemo } from 'react';

interface AutoCompleteInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  icon,
  className = '',
  required,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on typed value (case-insensitive substring match)
  const filteredSuggestions = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      // If empty and focused, show up to 8 top recent suggestions
      return suggestions.slice(0, 8);
    }
    return suggestions
      .filter((s) => s.toLowerCase().includes(trimmed) && s.toLowerCase() !== trimmed)
      .slice(0, 8);
  }, [suggestions, value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelect(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
          {icon}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={`${icon ? 'pl-9' : 'px-3.5'} ${className}`}
        {...rest}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-[200] py-1 divide-y divide-slate-50">
          {filteredSuggestions.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              onMouseDown={(e) => {
                // Prevent input blur before click registers
                e.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3.5 py-2 text-xs font-bold uppercase cursor-pointer flex items-center justify-between transition-colors ${
                idx === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{item}</span>
              <span className="text-[9px] font-semibold text-slate-400 tracking-wider">Suggested</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

