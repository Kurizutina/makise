import React from 'react';
import { RestaurantMenu } from './McDonaldsMenu';

const MangInasalMenu = () => (
  <RestaurantMenu
    restaurantName="Mang Inasal"
    sourceKey="Mang Inasal"
    manifestUrl="/images/Mang%20Inasal/menu-manifest.json"
    pageClass="mang-inasal-page"
    headerClass="mang-inasal-page-header"
    eyebrowClass="mang-inasal-eyebrow"
  />
);

export default MangInasalMenu;
