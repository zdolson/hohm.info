import { css } from "styled-system/css";
import { Text } from "@/components/ui";

export default function FilterSelect({
  label,
  options,
  ...props
}: {
  label: string;
  options: readonly { value: string; label: string }[];
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  return (
    <label className={css({ display: "flex", flexDir: "column", gap: "1" })}>
      <Text className={css({ fontSize: "xs", color: "fg.muted" })}>
        {label}
      </Text>
      <select
        {...props}
        className={css({
          px: "2",
          py: "1.5",
          rounded: "sm",
          borderWidth: "1px",
          borderColor: "gray.6",
          fontSize: "sm",
        })}
      >
        {options.map((o) => (
          <option key={o.value || "any"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
