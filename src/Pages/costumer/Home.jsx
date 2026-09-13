import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/home/Header/Header';
import Footer from '../../components/home/Footer/Footer';
import FoodandItemsSection from '../../components/home/FoodandItem/FoodandItemsSection/FoodandItemsSection';
import OthersOrderForm from '../../components/home/OthersOrderForm/OthersOrderForm';
import PayBillsForm from '../../components/home/PayBillsForm/PayBillsForm';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import {
  temporaryFoodBrands,
  temporaryItemBrands,
  temporaryUtilityCompanies
} from '../../components/home/FoodandItem/data/temporaryData';


const Home = () => {
  const navigate = useNavigate();
  const { addToCart, placeOrder } = useCustomerActivity();

  // Currently selected service
  const [selectedService, setSelectedService] = useState('food');
  const [customOrderBrand, setCustomOrderBrand] = useState(null);
  const [paymentBrand, setPaymentBrand] = useState(null);


  // Get the brands for the selected service
  const getCurrentBrands = () => {

    switch (selectedService) {

      case 'food':
        return temporaryFoodBrands;

      case 'item':
        return temporaryItemBrands;

      case 'bills':
        return temporaryUtilityCompanies;

      default:
        return temporaryFoodBrands;
    }
  };


  // Change section title depending on service
  const getSectionTitle = () => {

    switch (selectedService) {

      case 'food':
        return 'Food Brands';

      case 'item':
        return 'Item Stores';

      case 'bills':
        return 'Utility Companies';

      default:
        return 'Food Brands';
    }
  };


  return (
    <div className="home-page" id="home">

      {/* Header */}
      <Header
        selectedService={selectedService}
        onServiceChange={setSelectedService}
      />

      {/* Brand Cards */}
      <FoodandItemsSection
        title={getSectionTitle()}
        brands={getCurrentBrands()}
        onBrandSelect={(brand) => {
          if (brand.type === 'food' && brand.name === "Manuela's") {
            navigate('/food/manuelas');
            return;
          }
          if (brand.type === 'food' && brand.name === 'Jollibee') {
            navigate('/food/jollibee');
            return;
          }

          if (brand.type === 'food' && brand.name === "McDonald's") {
            navigate('/food/mcdonalds');
            return;
          }

          if (brand.type === 'food' && brand.name === 'Mang Inasal') {
            navigate('/food/mang-inasal');
            return;
          }

          const foodBrandsWithoutCustomForm = ['Jollibee', "McDonald's", 'Mang Inasal'];
          const canOpenCustomForm = brand.type === 'item'
            || (brand.type === 'food' && !foodBrandsWithoutCustomForm.includes(brand.name));

          if (brand.type === 'bills') {
            setPaymentBrand(brand);
          } else if (canOpenCustomForm) {
            setCustomOrderBrand(brand);
          }
        }}
      />

      {customOrderBrand && (
        <OthersOrderForm
          serviceType={customOrderBrand.type}
          establishmentName={customOrderBrand.name === 'Others' ? '' : customOrderBrand.name}
          canEditEstablishment={customOrderBrand.name === 'Others'}
          allowPickup={customOrderBrand.type === 'item' && customOrderBrand.name === 'Others'}
          onCancel={() => setCustomOrderBrand(null)}
          onAddToCart={(order) => {
            addToCart({
              id: `custom-${Date.now()}`,
              source: customOrderBrand.name,
              name: `Custom order (${order.items.length} item${order.items.length === 1 ? '' : 's'})`,
              quantity: 1,
              details: order
            });
            setCustomOrderBrand(null);
          }}
          onSubmit={(order) => {
            placeOrder({
              source: customOrderBrand.name,
              label: `${customOrderBrand.name} custom order`,
              items: order.items,
              details: order,
              section: customOrderBrand.type
            });
            setCustomOrderBrand(null);
          }}
        />
      )}

      {paymentBrand && (
        <PayBillsForm
          establishmentName={paymentBrand.name === 'Others' ? '' : paymentBrand.name}
          canEditEstablishment={paymentBrand.name === 'Others'}
          onCancel={() => setPaymentBrand(null)}
          onSubmit={(payment) => {
            placeOrder({
              source: paymentBrand.name,
              label: `${paymentBrand.name} bill payment`,
              section: 'bills',
              details: {
                establishment: payment.establishment,
                billReceiptName: payment.billReceipt?.name,
                transferProofName: payment.transferProof?.name
              }
            });
            setPaymentBrand(null);
          }}
        />
      )}

      <Footer onServiceChange={setSelectedService} />
    </div>
  );
};

export default Home;
