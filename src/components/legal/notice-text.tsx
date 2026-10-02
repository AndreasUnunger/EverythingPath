import type { LegalNotice } from '~/lib/catalog/legal-types';

// Notice text is rendered as text with its line breaks kept; nothing is
// trimmed, collapsed or linked. Long lines and URLs wrap inside the column.
export function NoticeText({
  notice,
  showTitle,
}: {
  notice: LegalNotice;
  showTitle: boolean;
}) {
  return (
    <div className="mt-5">
      {showTitle ? <h3 className="text-base">{notice.title}</h3> : null}
      <p className="font-text mt-2 max-w-prose text-base leading-7 wrap-anywhere whitespace-pre-wrap">
        {notice.text}
      </p>
    </div>
  );
}
