export const DELIVERY_LOCATIONS = [
  { id: 'clsu-main-campus', name: 'CLSU Main Campus', fee: 68, rangeLabel: '₱68–₱98' },
  { id: 'bagong-sikat', name: 'Bagong Sikat', fee: 68, rangeLabel: '₱68–₱98' },
  { id: 'villa-javier', name: 'Villa Javier', fee: 60 },
  { id: 'bukang-liwayway', name: 'Bukang Liwayway', fee: 65 },
  { id: 'tobias-ville', name: 'Tobias Ville', fee: 65 },
  { id: 'villa-isidra', name: 'Villa Isidra', fee: 68 },
  { id: 'pnr-main', name: 'PNR Main', fee: 68, rangeLabel: '₱68–₱98' }
];

export const CUSTOMER_TYPES = [
  { id: 'student', label: 'Student', cutoffMinutes: 20 * 60 },
  { id: 'non_student', label: 'Non-student', cutoffMinutes: (18 * 60) + 30 }
];

const normalise = (value = '') => value.trim().toLowerCase();

export const findDeliveryLocation = (selection, address = '') => {
  const selected = DELIVERY_LOCATIONS.find((location) => location.id === selection);
  if (selected) return selected;
  const addressText = normalise(address);
  return DELIVERY_LOCATIONS.find((location) => addressText.includes(normalise(location.name))) || null;
};

export const deliveryRateLabel = (location) => location?.rangeLabel || (location ? `₱${location.fee}` : 'Select location');

export const calculateDeliveryFee = (location, customerType = 'non_student', orderTime = new Date()) => {
  const type = CUSTOMER_TYPES.find((item) => item.id === customerType) || CUSTOMER_TYPES[1];
  const time = new Date(orderTime);
  const minutes = (time.getHours() * 60) + time.getMinutes();
  const baseFee = Number(location?.fee) || 0;
  const surchargeApplied = baseFee > 0 && minutes > type.cutoffMinutes;
  const surcharge = surchargeApplied ? baseFee * 0.5 : 0;
  return {
    customerType: type.id,
    baseFee,
    surcharge,
    serviceFee: baseFee + surcharge,
    surchargeApplied
  };
};
