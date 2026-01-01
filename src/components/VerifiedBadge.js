import React from 'react';
import { BsPatchCheckFill } from 'react-icons/bs';
import './VerifiedBadge.css';

const VerifiedBadge = ({ size = 'medium', className = '' }) => {
  return (
    <BsPatchCheckFill 
      className={`verified-badge verified-badge-${size} ${className}`}
      title="Verified Expert"
    />
  );
};

export default VerifiedBadge;
