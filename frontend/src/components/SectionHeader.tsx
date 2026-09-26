export function SectionHeader({
  title,
  as = "h2",
}: {
  title: string;
  as?: "h1" | "h2";
}) {
  const Tag = as;
  return (
    <Tag className="text-[18px] font-semibold tracking-tight text-ink">{title}</Tag>
  );
}
