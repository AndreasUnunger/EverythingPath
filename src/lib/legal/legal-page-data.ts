import notices from './legal-notices.json';

export type LegalNotice = (typeof notices)['ogl'];
/** A notice's own text, part of which links to `href`. */
export type NoticeLink = { text: string; href: string };
export type LegalSection = {
  id: string;
  title: string;
  notices: LegalNotice[];
  link?: NoticeLink;
};

// The static legal page. Every text comes from `legal-notices.json`: the OGL
// and Section 8 as the feature branch's reviewed resources, Section 15 for
// the militia rules the app shows (Lands of Conflict, as printed), the
// current Paizo Community Use notice, the contact and the copyright line.
export const legalPage = {
  title: 'Legal notices',
  introduction:
    'Copyright notices and license terms for content used by Keepnet.',
  sections: [
    { id: 'ogl', title: 'Open Game License 1.0a', notices: [notices.ogl] },
    {
      id: 'section15',
      title: 'Section 15 — Copyright notices',
      notices: notices.section15,
    },
    {
      id: 'section8',
      title: 'Section 8 — Open Game Content',
      notices: [notices.section8],
    },
    {
      id: 'paizo',
      title: 'Paizo Community Use',
      notices: [notices.paizo],
      link: {
        text: 'paizo.com/licenses/communityuse',
        href: 'https://paizo.com/licenses/communityuse',
      },
    },
    {
      id: 'contact',
      title: 'Contact',
      notices: [notices.contact],
      link: { text: notices.contact.text, href: notices.contact.text },
    },
  ] satisfies LegalSection[],
  copyright: notices.copyright.text,
};
