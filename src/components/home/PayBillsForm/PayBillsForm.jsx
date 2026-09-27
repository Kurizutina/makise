import React, { useEffect, useState } from 'react';
import './PayBillsForm.css';
import { API_BASE_URL } from '../../../utils/catalog';
import { getSessionUser } from '../../../utils/session';
import { useCustomerActivity } from '../../../context/CustomerActivityContext';
import LocationPicker from '../Header/LocationPicker/LocationPicker';
import { calculateDeliveryFee, findDeliveryLocation } from '../../../utils/deliveryRates';

const MAX_IMAGE_DIMENSION = 1280;
const compressImage = (file) => new Promise((resolve) => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    resolve(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => resolve(file);
    img.src = reader.result;
  };
  reader.onerror = () => resolve(file);
  reader.readAsDataURL(file);
});

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
  // Keep the backend path relative. Persisting a device-specific localhost
  // origin makes the receipt unavailable to admin and rider devices.
  return data;
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
  const [locationTouched, setLocationTouched] = useState(false);
  const { deliveryLocation } = useCustomerActivity();
  const customerType = getSessionUser()?.userType || 'non_student';
  const selectedLocation = findDeliveryLocation(deliveryLocation);
  const deliveryFee = calculateDeliveryFee(selectedLocation, customerType);

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
    // Same rule as OthersOrderForm: LocationPicker is a custom control, not
    // a real form field, so the native `required` a <select> gave this for
    // free has to be replicated by hand.
    if (!deliveryLocation) {
      setLocationTouched(true);
      return;
    }
    setUploadError('');
    try {
      const [compressedBill, compressedProof] = await Promise.all([
        compressImage(billReceipt),
        compressImage(transferProof)
      ]);
      const [uploadedBill, uploadedProof] = await Promise.all([
        uploadDocument(compressedBill).catch(() => embedDocument(compressedBill)),
        uploadDocument(compressedProof).catch(() => embedDocument(compressedProof))
      ]);
      onSubmit({
        establishment: establishment.trim(),
        billReceipt: { name: uploadedBill.name || billReceipt.name, type: billReceipt.type },
        transferProof: { name: uploadedProof.name || transferProof.name, type: transferProof.type },
        billReceiptUrl: uploadedBill.url,
        transferProofUrl: uploadedProof.url,
        deliveryLocation,
        customerType
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

              <div className="payment-field">
                <span>Delivery location</span>
                <LocationPicker variant="inline" />
                {locationTouched && !deliveryLocation && (
                  <small className="order-field-error">Please select a delivery location.</small>
                )}
                {selectedLocation && (
                  <small className="order-field-service-fee">
                    Service fee{deliveryFee.surchargeApplied ? ' (includes night surcharge)' : ''}: ₱{deliveryFee.serviceFee}
                  </small>
                )}
              </div>

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
