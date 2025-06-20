import React from 'react';

const ConfirmModal = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: 28,
        minWidth: 320,
        boxShadow: '0 2px 16px rgba(0,0,0,0.15)'
      }}>
        <h3 style={{marginTop: 0}}>{title}</h3>
        <div style={{margin: '18px 0'}}>{message}</div>
        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12}}>
          <button onClick={onCancel} style={{background: '#aaa', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer'}}>İptal</button>
          <button onClick={onConfirm} style={{background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer'}}>Evet, Sil</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
