import { useNavigate, Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';

import { useFirebase } from '../providers/Firebase';
import { Toolbar } from './Toolbar';
import './Layout.css';

export const Layout = ({ sounds, onSettingChange }) => {
  const navigate = useNavigate();
  const { notification, setNotification } = useFirebase();

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
      {notification && (
        <div className='notification'>
          {notification.title}
          <Link to='/' reloadDocument>
            Play now
          </Link>
          <FaTimes
            className='notification-close'
            onClick={() => setNotification(null)}
          />
        </div>
      )}
      <Toolbar sounds={sounds} onClick={handleClick} />

      <Outlet />
    </div>
  );
};
