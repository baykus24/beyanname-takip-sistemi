import React from 'react';
import './DeclarationRowSkeleton.css';

const DeclarationRowSkeleton = () => {
  return (
    <tr className="skeleton-row">
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-select"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text-long"></div></td>
      <td><div className="skeleton-button"></div></td>
    </tr>
  );
};

export default DeclarationRowSkeleton;
