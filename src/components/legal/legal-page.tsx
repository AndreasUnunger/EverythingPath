import { legalPage } from '~/lib/legal/legal-page-data';
import { LegalFooter } from './legal-footer';
import { LegalTopBar } from './legal-top-bar';
import { NoticeText } from './notice-text';
import { SectionFrame } from './section-frame';

// Public, signed out or in: the same top bar as the app (Keep icon, crumb),
// one readable text column, the shared footer. Headings and chrome keep the
// app's display face; the notices themselves are set in the plain text face.
export function LegalPage() {
  const { title, introduction, sections, copyright } = legalPage;
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <LegalTopBar title={title} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        <p className="text-muted-foreground font-text mt-3 max-w-prose text-base leading-7">
          {introduction}
        </p>
        <nav aria-label="Legal sections" className="mt-5">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="hover:text-foreground focus-visible:ring-ring/50 text-muted-foreground rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {sections.map((section) => (
          <SectionFrame key={section.id} id={section.id} title={section.title}>
            {section.notices.map((notice) => (
              <NoticeText
                key={notice.id}
                notice={notice}
                showTitle={notice.title !== section.title}
                link={section.links?.find(({ text }) =>
                  notice.text.includes(text),
                )}
              />
            ))}
          </SectionFrame>
        ))}
        <p className="text-muted-foreground font-text mt-10 text-base">
          {copyright}
        </p>
      </main>
      <LegalFooter />
    </div>
  );
}
