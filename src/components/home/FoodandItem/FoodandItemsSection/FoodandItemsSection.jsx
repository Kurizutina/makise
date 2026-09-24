import React from 'react';
import BrandCard from '../../BrandCard/BrandCard';
import './FoodandItemsSection.css';

const FoodandItemsSection = ({
  id,
  title,
  brands,
  onBrandSelect
}) => {
  return (
    <section className="food-items-section" id={id}>

      <div className="food-items-header">
        <h2>{title}</h2>

      </div>

      <div className="brand-list">

        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            onSelect={onBrandSelect}
          />
        ))}

      </div>

    </section>
  );
};

export default FoodandItemsSection;
