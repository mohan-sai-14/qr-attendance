import React from 'react';
import { useLocation } from 'wouter';

export const SimpleLink = ({ to, children, className = '', ...props }) => {
  const [location, setLocation] = useLocation();
  
  const handleClick = (e) => {
    e.preventDefault();
    
    // Using the wouter setLocation for client-side navigation
    setLocation(to);
    
    // If we're using window.location fallback, add a small delay to allow for state updates
    if (typeof window !== 'undefined' && (to.startsWith('http') || props.forceReload)) {
      setTimeout(() => {
        window.location.href = to;
      }, 10);
    }
  };
  
  return (
    <a 
      href={to} 
      onClick={handleClick} 
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

export default SimpleLink; 