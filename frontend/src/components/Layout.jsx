import { useNavigate, Outlet } from 'react-router-dom';

import { Toolbar } from './Toolbar';
import './Layout.css';

export function Layout({ sounds, onSettingChange, gameNo }) {
  const navigate = useNavigate();

  const handleClick = (action) => {
    switch (action) {
      case 'logo':
        navigate('/');
        break;
      case 'about':
        navigate('/about');
        break;
      case 'sounds':
        onSettingChange();
        break;
      default:
        navigate('/');
    }
  };

  return (
    <div className='main'>
      <Toolbar gameNo={gameNo} sounds={sounds} onClick={handleClick} />

      <Outlet />
    </div>
  );
}
