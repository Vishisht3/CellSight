import { Clock } from 'lucide-react';

export default function ResponseTimeBadge() {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: '#d4edda',
      border: '1px solid #82c891',
      borderRadius: 3,
      padding: '4px 10px',
      fontSize: 12,
      color: '#155724',
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
    }}>
      <Clock size={13} />
      We respond to all enquiries within 1 business day
    </div>
  );
}