import React from 'react';
import './App.css'; // Stil için App.css kullanacağız

function ConfirmationModal({ isOpen, onClose, onConfirm, message }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onConfirm} className="btn btn-danger">Sil</button>
          <button onClick={onClose} className="btn btn-secondary">İptal</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
