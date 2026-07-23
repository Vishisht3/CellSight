interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      className={className}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#d4d0c8',
      }}
    >
      {children}
    </main>
  );
}
