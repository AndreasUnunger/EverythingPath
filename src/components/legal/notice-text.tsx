import type { LegalNotice, NoticeLink } from '~/lib/legal/legal-page-data';

// Notice text is rendered as text with its line breaks kept; nothing is
// trimmed or collapsed. Only a section's named link becomes an anchor, over
// the same characters. Long lines and URLs wrap inside the column.
export function NoticeText({
  notice,
  showTitle,
  link,
}: {
  notice: LegalNotice;
  showTitle: boolean;
  link?: NoticeLink;
}) {
  return (
    <div className="mt-5">
      {showTitle ? <h3 className="text-base">{notice.title}</h3> : null}
      <p className="font-text mt-2 max-w-prose text-base leading-7 wrap-anywhere whitespace-pre-wrap">
        {link ? <LinkedText text={notice.text} link={link} /> : notice.text}
      </p>
    </div>
  );
}

function LinkedText({ text, link }: { text: string; link: NoticeLink }) {
  const at = text.indexOf(link.text);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        className="hover:text-primary focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
      >
        {link.text}
      </a>
      {text.slice(at + link.text.length)}
    </>
  );
}
