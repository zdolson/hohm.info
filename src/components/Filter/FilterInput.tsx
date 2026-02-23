import { css } from "styled-system/css";
import { Text } from "@/components/ui";

export default function FilterInput({
  label,
  w,
  ...props
}: {
  label: string;
  w?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <label className={css({ display: "flex", flexDir: "column", gap: "1" })}>
      <Text className={css({ fontSize: "xs", color: "fg.muted" })}>
        {label}
      </Text>
      <input
        {...props}
        className={css({
          px: "2",
          py: "1.5",
          rounded: "sm",
          borderWidth: "1px",
          borderColor: "gray.6",
          fontSize: "sm",
          w: w ?? "auto",
        })}
      />
    </label>
  );
}
