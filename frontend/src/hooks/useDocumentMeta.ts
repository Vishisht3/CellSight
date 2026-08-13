import { useEffect } from 'react';

interface DocumentMetaOptions {
  title: string;
  description?: string;
  ogImage?: string;
  schema?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

const SITE_NAME = 'CellSight';
const DEFAULT_DESCRIPTION =
  'CellSight — Battery intelligence for EV fleet operators and supply chain managers. Monitor pack health, trace materials, and manage supplier risk.';
const DEFAULT_OG_IMAGE = 'https://cell-sight.vercel.app/og-default.svg';
const BASE_URL = 'https://cell-sight.vercel.app';

function setMeta(property: string, content: string, type: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${type}="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(type, property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(property: string, type: 'name' | 'property' = 'name') {
  document.querySelector(`meta[${type}="${property}"]`)?.remove();
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta({ title, description, ogImage, schema, noindex }: DocumentMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} \u2014 ${SITE_NAME}`;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const image = ogImage ?? DEFAULT_OG_IMAGE;
    const canonical = `${BASE_URL}${window.location.pathname}`;

    document.title = fullTitle;
    setMeta('description', desc);

    if (noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      removeMeta('robots');
    }

    setLink('canonical', canonical);
    setMeta('og:title',       fullTitle,   'property');
    setMeta('og:description', desc,         'property');
    setMeta('og:image',       image,        'property');
    setMeta('og:type',        'website',    'property');
    setMeta('og:url',         canonical,    'property');
    setMeta('og:site_name',   SITE_NAME,    'property');
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:title',       fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image',       image);

    document.querySelectorAll('script[data-cellsight-schema]').forEach(s => s.remove());
    if (schema) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-cellsight-schema', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      document.title = `${SITE_NAME} \u2014 Battery Intelligence Platform`;
      document.querySelectorAll('script[data-cellsight-schema]').forEach(s => s.remove());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, ogImage, noindex]);
}