import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#d4d0c8' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
