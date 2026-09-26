import type { Place } from "@/lib/types";

export function PlaceImage({
  place,
  className,
  alt = "",
}: {
  place: Pick<Place, "name" | "image">;
  className: string;
  alt?: string;
}) {
  if (place.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={place.image} alt={alt} className={className} />
    );
  }

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`grid place-items-center bg-soft text-red ${className}`}
    >
      <span aria-hidden="true" className="text-lg font-bold">
        {place.name.trim().charAt(0).toUpperCase() || "•"}
      </span>
    </span>
  );
}
