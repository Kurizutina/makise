import { calculateDeliveryFee, findDeliveryLocation } from './deliveryRates';

const villaJavier = findDeliveryLocation('villa-javier');

test('students receive regular rates through 8:00 PM and a 50% surcharge after', () => {
  expect(calculateDeliveryFee(villaJavier, 'student', new Date(2026, 8, 17, 20, 0))).toMatchObject({
    baseFee: 60, surcharge: 0, serviceFee: 60, surchargeApplied: false
  });
  expect(calculateDeliveryFee(villaJavier, 'student', new Date(2026, 8, 17, 20, 1))).toMatchObject({
    baseFee: 60, surcharge: 30, serviceFee: 90, surchargeApplied: true
  });
});

test('non-students receive regular rates through 6:30 PM and a 50% surcharge after', () => {
  expect(calculateDeliveryFee(villaJavier, 'non_student', new Date(2026, 8, 17, 18, 30))).toMatchObject({
    serviceFee: 60, surchargeApplied: false
  });
  expect(calculateDeliveryFee(villaJavier, 'non_student', new Date(2026, 8, 17, 18, 31))).toMatchObject({
    baseFee: 60, surcharge: 30, serviceFee: 90, surchargeApplied: true
  });
});
