import { MediaService } from "@/lib/services/MediaService";

type MediaItem = Awaited<
  ReturnType<typeof MediaService.listByOrganization>
>[number];

type MediaCardProps = {
  item: MediaItem;
};

export default function MediaCard({ item }: MediaCardProps) {
  const previewUrl = item.type === "image" ? `/images/${item.id}` : null;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-media-border bg-media-surface p-3 shadow-sm">
      <div className="min-h-[13.3rem] overflow-hidden rounded-xl bg-media-surface-soft">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={item.altText}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <p
        data-testid="media-card-title"
        className="mt-2 text-paragraph-2 font-semibold text-grey-text-strong"
      >
        {item.title}
      </p>
    </article>
  );
}
