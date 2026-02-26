import React, { useState, useEffect, useRef } from "react";
import { DropdownMenu } from "radix-ui";
import styles from "./styles.module.css";
import BogIcon from "../BogIcon/BogIcon";
import BogCheckbox from "../BogCheckbox/BogCheckbox";
import BogRadioItem from "../BogRadioItem/BogRadioItem";
import BogRadioGroup from "../BogRadioGroup/BogRadioGroup";
import { CheckedState } from "@radix-ui/react-checkbox";

interface BogDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The type of dropdown. Values are "normal", "checkbox", "radio", or "search".
   * Normal dropdowns allow for single selection from a list of options.
   * Checkbox dropdowns allow for multiple selections from a list of options.
   * Radio dropdowns allow for single selection from a list of options, but only one item can be selected at a time.
   * Search dropdowns allow for filtering options based on user input.
   */
  type?: "normal" | "checkbox" | "radio" | "search";
  /** The options to choose from in the dropdown. */
  options: string[];
  /** The name of the data this dropdown represents for forms. */
  name: string;
  /** Label text to be placed beside the dropdown. */
  label?: string;
  /** The placeholder text to be displayed when the dropdown is empty. */
  placeholder?: string;
  /** Whether the dropdown is disabled or not. */
  disabled?: boolean;
  /** Function that is called when the selection is changed. */
  onSelectionChange?: (selection: string | string[]) => void;
  /** Additional class names to apply styles to the dropdown. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the dropdown. */
  style?: React.CSSProperties;
  /** The current value of the dropdown for controlled components. */
  value?: string | string[];
  /** The default value of the dropdown for uncontrolled components. */
  defaultValue?: string | string[];
}

export default function BogDropdown({
  type = "normal",
  options,
  name,
  label,
  placeholder = "Placeholder",
  disabled = false,
  onSelectionChange,
  style,
  className,
  value,
  defaultValue,
}: BogDropdownProps) {
  const isCheckbox = type === "checkbox";
  const isControlled = value !== undefined;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<string | string[]>(
    defaultValue !== undefined ? defaultValue : isCheckbox ? [] : "",
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isControlled) {
      setSelected(value as any);
    }
  }, [isControlled, value]);

  const openInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  };

  const handleSelect = (
    e: Event | React.FormEvent<HTMLButtonElement> | CheckedState | string,
    value: string,
  ) => {
    let newSelected = selected;
    if (type === "checkbox") {
      const checked = e as CheckedState;
      if (Array.isArray(selected)) {
        if (checked === true) {
          if (!selected.includes(value)) {
            newSelected = [...selected, value];
          }
          setSelected(newSelected);
        } else if (checked === false) {
          newSelected = selected.filter((item) => item !== value);
          setSelected(newSelected);
        }
      } else {
        newSelected = value;
        setSelected(newSelected);
      }
    } else {
      newSelected = value;
      setSelected(newSelected);
    }
    if (onSelectionChange) {
      onSelectionChange(newSelected);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === "checkbox") {
      setSelected([]);
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } else {
      setSelected("");
      if (onSelectionChange) {
        onSelectionChange("");
      }
    }
    if (type === "search") {
      setFilter("");
    }
  };

  const hasValues = () => {
    if (Array.isArray(selected)) {
      return selected.length > 0;
    }
    return selected != "";
  };

  const renderItems = (): React.ReactElement[] => {
    if (type === "search") {
      return options
        .filter((option) => option.includes(filter))
        .map((option) => (
          <DropdownMenu.Item
            onSelect={(e) => handleSelect(e, option)}
            className={styles.dropdownItem}
            key={option}
          >
            {option}
          </DropdownMenu.Item>
        ));
    } else if (type === "checkbox") {
      return options.map((option) => (
        <DropdownMenu.Item
          onSelect={(e) => {
            e.preventDefault();
            const isChecked = Array.isArray(selected)
              ? !selected.includes(option)
              : true;
            handleSelect(isChecked, option);
          }}
          className={styles.dropdownItem}
          key={option}
        >
          <BogCheckbox
            name={option}
            label={option}
            checked={Array.isArray(selected) && selected.includes(option)}
          />
        </DropdownMenu.Item>
      ));
    } else if (type === "radio") {
      return options.map((option) => (
        <DropdownMenu.Item
          onSelect={(e) => handleSelect(e, option)}
          className={styles.dropdownItem}
          key={option}
        >
          <BogRadioItem
            key={option}
            value={option}
            label={option}
            checked={selected === option}
          />
        </DropdownMenu.Item>
      ));
    } else {
      return options.map((option) => (
        <DropdownMenu.Item
          onSelect={(e) => handleSelect(e, option)}
          className={styles.dropdownItem}
          key={option}
        >
          {option}
        </DropdownMenu.Item>
      ));
    }
  };

  return (
    <div className={`${styles.dropdownContainer} ${className}`} style={style}>
      <label className={styles.label}>{label}</label>
      <DropdownMenu.Root modal={false} open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenu.Trigger
          ref={triggerRef}
          className={styles.trigger}
          data-disabled={disabled}
          disabled={disabled}
          onClick={() => openInput()}
        >
          {type === "search" ? (
            <>
              <input
                type="text"
                ref={inputRef}
                value={filter}
                name={name}
                placeholder={
                  selected.length > 0
                    ? Array.isArray(selected)
                      ? selected.join(", ")
                      : selected
                    : placeholder
                }
                className={styles.searchInput}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  setFilter(e.target.value);
                }}
              />
              <div className={styles.iconHolder}>
                {hasValues() && (
                  <span onClick={handleClear} role="button">
                    <BogIcon name="x" size={14} className={styles.clearIcon} />
                  </span>
                )}
                <BogIcon name="search" size={16} className={styles.icon} />
              </div>
            </>
          ) : (
            <>
              {selected.length > 0
                ? Array.isArray(selected)
                  ? selected.join(", ")
                  : selected
                : placeholder}
              <div className={styles.iconHolder}>
                {hasValues() && (
                  <span
                    onClick={handleClear}
                    role="button"
                    aria-label="Clear selection"
                  >
                    <BogIcon name="x" size={14} className={styles.clearIcon} />
                  </span>
                )}
                {isOpen ? (
                  <BogIcon
                    name="chevron-up"
                    size={16}
                    className={styles.icon}
                  />
                ) : (
                  <BogIcon
                    name="chevron-down"
                    size={16}
                    className={styles.icon}
                  />
                )}
              </div>
            </>
          )}
        </DropdownMenu.Trigger>

        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={styles.dropdownContent}
          style={{ width: triggerWidth || "auto" }}
        >
          {type === "radio" ? (
            <BogRadioGroup
              value={Array.isArray(selected) ? selected.join(", ") : selected}
              onValueChange={(e) => handleSelect(e, e)}
            >
              {renderItems()}
            </BogRadioGroup>
          ) : (
            <>{renderItems()}</>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
