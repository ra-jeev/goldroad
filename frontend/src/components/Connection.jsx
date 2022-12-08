import {
  FaLongArrowAltLeft,
  FaLongArrowAltRight,
  FaLongArrowAltDown,
  FaLongArrowAltUp,
} from 'react-icons/fa';

import './Connection.css';

export const Connection = ({ dir, pos }) => {
  return (
    <div className='connection' style={pos}>
      {dir === 'bottom' && <FaLongArrowAltDown />}
      {dir === 'top' && <FaLongArrowAltUp />}
      {dir === 'left' && <FaLongArrowAltLeft />}
      {dir === 'right' && <FaLongArrowAltRight />}
    </div>
  );
};
