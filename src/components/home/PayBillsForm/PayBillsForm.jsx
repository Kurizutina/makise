import React, { useEffect, useState } from 'react';
import './PayBillsForm.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const uploadDocument = async (file) => {
  const body = new FormData();
  body.append('document', file);
  const response = await fetch(`${API_BASE_URL}/api/uploads/bill-documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
    body
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to upload the payment document.');
  return { ...data, url: data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}` };
};
const embedDocument = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ url: reader.result, name: file.name });
  reader.onerror = () => reject(new Error('The selected image could not be read.'));
  reader.readAsDataURL(file);
});

const ImageUpload = ({ id, label, hint, file, onChange }) => (
  <label className={`payment-upload ${file ? 'has-file' : ''}`} htmlFor={id}>
    <input
      id={id}
      required
      type="file"
      accept="image/*,application/pdf"
      onChange={(event) => onChange(event.target.files[0] || null)}
    />
    <span className="payment-upload-icon" aria-hidden="true">
      <i className={`fa-solid ${file ? 'fa-circle-check' : 'fa-cloud-arrow-up'}`} />
    </span>
    <span className="payment-upload-copy">
      <strong>{label}</strong>
      <small>{file ? file.name : hint}</small>
    </span>
    <span className="payment-upload-action">{file ? 'Change' : 'Choose image'}</span>
  </label>
);

const PayBillsForm = ({
  establishmentName = '',
  canEditEstablishment = false,
  onCancel,
  onSubmit
}) => {
  const [establishment, setEstablishment] = useState(establishmentName);
  const [billReceipt, setBillReceipt] = useState(null);
  const [transferProof, setTransferProof] = useState(null);
  const [isQrExpanded, setIsQrExpanded] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (isQrExpanded) {
          setIsQrExpanded(false);
        } else {
          onCancel();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isQrExpanded, onCancel]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setUploadError('');
    try {
      const [uploadedBill, uploadedProof] = await Promise.all([
        uploadDocument(billReceipt).catch(() => embedDocument(billReceipt)),
        uploadDocument(transferProof).catch(() => embedDocument(transferProof))
      ]);
      onSubmit({
        establishment: establishment.trim(),
        billReceipt: { name: uploadedBill.name || billReceipt.name, type: billReceipt.type },
        transferProof: { name: uploadedProof.name || transferProof.name, type: transferProof.type },
        billReceiptUrl: uploadedBill.url,
        transferProofUrl: uploadedProof.url
      });
    } catch {
      setUploadError('The documents could not be read. Choose the images again and retry.');
    }
  };

  return (
    <div className="payment-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
        <div className="payment-modal-header">
          <div>
            <span>Pay Bills</span>
            <h2 id="payment-form-title">Submit bill payment</h2>
            <p>Scan the QR code, then upload the required payment documents.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close payment form">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="payment-form-grid">
            <div className="payment-qr-panel">
              <span className="payment-step">1</span>
              <h3>Scan to transfer</h3>
              <button
                className="payment-qr-frame"
                type="button"
                onClick={() => setIsQrExpanded(true)}
                aria-label="Enlarge Otu-Zan payment QR code"
              >
                <img src="/images/otuzan_qr_code.jpg" alt="Otu-Zan payment QR code" />
              </button>
              <p>Click the QR code to enlarge it.</p>
            </div>

            <div className="payment-details-panel">
              <label className="payment-field">
                <span>Establishment name</span>
                <input
                  autoFocus={canEditEstablishment}
                  required
                  readOnly={!canEditEstablishment}
                  type="text"
                  value={establishment}
                  onChange={(event) => setEstablishment(event.target.value)}
                  placeholder={canEditEstablishment ? 'Enter the biller or establishment' : ''}
                />
              </label>

              <div className="payment-upload-section">
                <div className="payment-upload-heading">
                  <span className="payment-step">2</span>
                  <div>
                    <h3>Upload documents</h3>
                    <p>Images must be clear and readable.</p>
                  </div>
                </div>

                <ImageUpload
                  id="bill-receipt"
                  label="Bill receipt"
                  hint="Upload the bill you want to pay"
                  file={billReceipt}
                  onChange={setBillReceipt}
                />
                <ImageUpload
                  id="transfer-proof"
                  label="Proof of transfer"
                  hint="Upload your completed transfer"
                  file={transferProof}
                  onChange={setTransferProof}
                />
              </div>
            </div>
          </div>

          <div className="payment-form-actions">
            {uploadError && <p className="payment-upload-error" role="alert">{uploadError}</p>}
            <button className="payment-cancel" type="button" onClick={onCancel}>Cancel</button>
            <button className="payment-place" type="submit">Place</button>
          </div>
        </form>
      </section>

      {isQrExpanded && (
          <div
            className="payment-qr-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged Otu-Zan payment QR code"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsQrExpanded(false);
            }}
          >
            <div className="payment-qr-viewer-content">
              <button type="button" onClick={() => setIsQrExpanded(false)} aria-label="Close enlarged QR code">×</button>
              <img src="/images/otuzan_qr_code.jpg" alt="Enlarged Otu-Zan payment QR code" />
              <p>Scan this QR code to complete your transfer.</p>
            </div>
          </div>
      )}
    </div>
  );
};

export default PayBillsForm;
