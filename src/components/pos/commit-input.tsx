import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
/** Inline persisted fields edit locally, then commit once on blur. */
export const CommitInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ value, onChange, onBlur, ...props }, ref) => {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return <Input {...props} ref={ref} value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (String(draft ?? "") !== String(value ?? "")) onChange?.(event);
        setDraft(value);
        onBlur?.(event);
      }} />;
  },
);
CommitInput.displayName = "CommitInput";

export function CommitTextarea({ value, onChange, onBlur, ...props }: ComponentProps<"textarea">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <Textarea {...props} value={draft}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={(event) => {
      if (String(draft ?? "") !== String(value ?? "")) onChange?.(event);
      setDraft(value);
      onBlur?.(event);
    }} />;
}
