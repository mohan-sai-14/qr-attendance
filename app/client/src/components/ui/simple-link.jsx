import React from 'react';

export const SimpleLink = ({ to, children, className = '', ...props }) => {
  const handleClick = (e) => {
    e.preventDefault();
    
    // Hash-based navigation
    if (typeof window !== 'undefined') {
      // Set the hash directly
      window.location.hash = to;
    }
  };
  
  return (
    <a 
      href={`#${to}`} 
      onClick={handleClick} 
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

export default SimpleLink; 