import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        padding: '4px 12px',
        background: 'linear-gradient(to bottom, #e8f0fb, #d8e8f8)',
        borderBottom: '1px solid #b0c8e0',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
        gap: 2,
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {idx > 0 && (
              <span style={{ color: '#7090a8', margin: '0 2px' }} aria-hidden="true">›</span>
            )}
            {isLast || !item.href ? (
              <span
                aria-current={isLast ? 'page' : undefined}
                style={{ color: isLast ? '#0a246a' : '#4a6a9a', fontWeight: isLast ? 600 : 400 }}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                style={{ color: '#316ac5', textDecoration: 'none' }}
                onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}