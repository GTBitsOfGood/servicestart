"use client";

import { useState, useCallback } from "react";
import AsyncCreatableSelect from "react-select/async-creatable";
import {
  components,
  MultiValue,
  GroupBase,
  ValueContainerProps,
} from "react-select";
import { TagIcon } from "@phosphor-icons/react";
import api from "@/lib/api";

interface TagOption {
  value: string;
  label: string;
}

export interface TagInputProps {
  tagIds: string[];
  setTagIds: (ids: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function ValueContainer(
  props: ValueContainerProps<TagOption, true, GroupBase<TagOption>>,
) {
  return (
    <components.ValueContainer {...props}>
      <TagIcon
        size={16}
        style={{ flexShrink: 0, color: "var(--color-grey-icon-weak)" }}
      />
      {props.children}
    </components.ValueContainer>
  );
}

export function TagInput({
  tagIds,
  setTagIds,
  placeholder = "Enter a tag",
  maxTags,
  disabled = false,
  className,
  id,
}: TagInputProps) {
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [cacheKey, setCacheKey] = useState(0);

  const refreshTags = useCallback(async (): Promise<TagOption[]> => {
    const res = await api.tags.$get();
    if (!res.ok) return [];
    const { data } = await res.json();
    const options = data.map((t) => ({ value: t.tagId, label: t.tag }));
    setAllTags(options);
    return options;
  }, []);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<TagOption[]> => {
      const options = await refreshTags();
      if (!inputValue) return options;
      return options.filter((o) =>
        o.label.toLowerCase().includes(inputValue.toLowerCase()),
      );
    },
    [refreshTags],
  );

  const handleCreate = useCallback(
    async (inputValue: string) => {
      if (maxTags && tagIds.length >= maxTags) return;
      const res = await api.tags.$post({ json: { tag: inputValue } });
      if (!res.ok) return;
      const { data } = await res.json();
      setTagIds([...tagIds, data.tagId]);
      await refreshTags();
      setCacheKey((k) => k + 1);
    },
    [tagIds, setTagIds, maxTags, refreshTags],
  );

  const handleChange = useCallback(
    (newValue: MultiValue<TagOption>) => {
      if (maxTags && newValue.length > maxTags) return;
      setTagIds(newValue.map((o) => o.value));
    },
    [setTagIds, maxTags],
  );

  const value = tagIds
    .map((id) => allTags.find((t) => t.value === id))
    .filter((t): t is TagOption => t !== undefined);

  return (
    <AsyncCreatableSelect
      id={id}
      isMulti
      cacheOptions={cacheKey}
      defaultOptions={allTags}
      value={value}
      loadOptions={loadOptions}
      onChange={handleChange}
      onCreateOption={handleCreate}
      onMenuOpen={() => refreshTags()}
      placeholder={placeholder}
      isDisabled={disabled}
      className={className}
      classNamePrefix="tag-input"
      formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
      isValidNewOption={(inputValue) => {
        if (!inputValue) return false;
        if (maxTags && tagIds.length >= maxTags) return false;
        return true;
      }}
      components={{
        ValueContainer,
        DropdownIndicator: null,
        IndicatorSeparator: null,
      }}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "44px",
          borderRadius: "4px",
          borderColor: state.isFocused
            ? "var(--color-media-border)"
            : "var(--color-media-divider)",
          backgroundColor: "var(--color-solid-bg-sunken)",
          boxShadow: "none",
          padding: "2px 8px",
          cursor: "text",
          "&:hover": {
            borderColor: "var(--color-media-border)",
          },
        }),
        valueContainer: (base) => ({
          ...base,
          padding: "6px 0",
          gap: "6px",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: "var(--color-notif-announcement-bg)",
          borderRadius: "8px",
          margin: "0",
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: "var(--color-notif-schedule-update)",
          fontFamily: "var(--font-paragraph)",
          fontSize: "var(--text-desktop-paragraph-2)",
          fontWeight: 400,
          lineHeight: "20px",
          padding: "4px 4px 4px 8px",
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: "var(--color-notif-schedule-update)",
          borderRadius: "0 8px 8px 0",
          paddingLeft: "2px",
          paddingRight: "6px",
          ":hover": {
            backgroundColor: "var(--color-notif-announcement-bg)",
            color: "var(--color-notif-announcement)",
          },
        }),
        placeholder: (base) => ({
          ...base,
          color: "var(--color-grey-icon-weak)",
          fontFamily: "var(--font-paragraph)",
          fontSize: "var(--text-desktop-paragraph-2)",
          fontWeight: 400,
          margin: "0",
        }),
        input: (base) => ({
          ...base,
          color: "var(--color-grey-text-strong)",
          fontFamily: "var(--font-paragraph)",
          fontSize: "var(--text-desktop-paragraph-2)",
          margin: "0",
          padding: "0",
        }),
        menu: (base) => ({
          ...base,
          borderRadius: "4px",
          border: "1px solid var(--color-media-divider)",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.08)",
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused
            ? "var(--color-notif-announcement-bg)"
            : "var(--color-solid-bg-base)",
          color: state.isFocused
            ? "var(--color-notif-schedule-update)"
            : "var(--color-grey-text-strong)",
          fontFamily: "var(--font-paragraph)",
          fontSize: "var(--text-desktop-paragraph-2)",
          cursor: "pointer",
        }),
      }}
    />
  );
}
