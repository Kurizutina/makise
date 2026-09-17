import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCatalog } from '../../utils/catalog';

const CatalogNameRedirect = ({ brandName }) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then(({ services }) => {
        const brand = services.flatMap((service) => service.brands)
          .find((item) => item.BrandName === brandName);
        if (brand) navigate(`/catalog/brands/${brand.BrandID}`, { replace: true });
        else setError('This brand is no longer available.');
      })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load the catalog.'); });
    return () => controller.abort();
  }, [brandName, navigate]);

  return <main className="jollibee-page" role="status">{error || 'Loading menu...'}</main>;
};

export default CatalogNameRedirect;
