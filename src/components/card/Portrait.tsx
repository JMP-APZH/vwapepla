import Image from "next/image";
import { CONTACT_EMAIL } from "@/lib/core/config";
import { mediaUrl, type Media } from "@/lib/core/data";

/**
 * Official portrait (credited, removable on request) or the same neutral initials avatar for everyone.
 * `removalSubject` names the card in the photo-removal email (e.g. the commune).
 */
export function Portrait({ name, photo, removalSubject }: { name: string; photo?: Media; removalSubject: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <figure className="shrink-0">
      {photo ? (
        <Image src={mediaUrl(photo)} alt={`Portrait officiel : ${name}`} width={88} height={88}
               className="h-22 w-22 rounded-full object-cover object-[50%_15%] ring-2 ring-slate-700" />
      ) : (
        <div aria-hidden className="flex h-22 w-22 items-center justify-center rounded-full bg-slate-700 text-2xl font-semibold text-slate-200">
          {initials}
        </div>
      )}
      {!photo && <figcaption className="mt-1 max-w-22 text-center text-[10px] leading-tight text-slate-400">photo non disponible</figcaption>}
      {photo && (
        <figcaption className="mt-1 max-w-22 text-[10px] leading-tight text-slate-400">
          <a href={photo.source_page_url} className="underline" target="_blank" rel="noopener noreferrer">{photo.credit}</a>
          {" · "}
          <a className="underline"
             href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Retrait de photo — ${removalSubject}`)}`}>
            retrait
          </a>
        </figcaption>
      )}
    </figure>
  );
}
