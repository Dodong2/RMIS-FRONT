import { SelectItem } from "@/components/ui/select";

export function EmptyOption({ message }: { message: string }) {
  return (
    <SelectItem value="__empty" disabled>
      {message}
    </SelectItem>
  );
}
