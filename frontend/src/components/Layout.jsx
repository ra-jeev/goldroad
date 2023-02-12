import { useNavigate, Outlet } from 'react-router-dom';

import { Toolbar } from './Toolbar';
import './Layout.css';

export const Layout = ({ sounds, onSettingChange }) => {
  const navigate = useNavigate();

  const handleClick = (action) => {
    switch (action) {
      case 'logo':
        navigate('/');
        break;
      case 'back':
        navigate(-1);
        break;
      case 'stats':
        navigate('/stats');
        break;
      case 'about':
        navigate('/about');
        break;
      case 'games':
        navigate('/games');
        break;
      case 'sign-in':
        navigate('/sign-in');
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
      <Toolbar sounds={sounds} onClick={handleClick} />

      <Outlet />
    </div>
  );
};
