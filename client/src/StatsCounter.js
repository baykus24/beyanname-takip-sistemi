import React from 'react';

const StatsCounter = ({ completed, pending, totalDeclarations, totalCustomers }) => {
  return (
    <div className="stats-container">
      <div className="stat-item">
        <span className="stat-label">Toplam Müşteri:</span>
        <span className="stat-value">{totalCustomers}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Toplam Beyanname (Filtrelenmiş):</span>
        <span className="stat-value">{totalDeclarations}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Tamamlandı:</span>
        <span className="stat-value completed">{completed}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Bekliyor:</span>
        <span className="stat-value pending">{pending}</span>
      </div>
    </div>
  );
};

export default StatsCounter;
