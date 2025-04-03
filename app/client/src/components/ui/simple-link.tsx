import React from 'react';

interface SimpleLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export const SimpleLink: React.FC<SimpleLinkProps> = ({ to, children, className = '' }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = to;
  };
  
  return (
    <a href={to} onClick={handleClick} className={className} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  );
}; 