import React from 'react';
import { RestaurantMenu } from './McDonaldsMenu';
import jollibeeMenu from './jollibeeMenuData';

const JollibeeMenu = () => (
  <RestaurantMenu
    restaurantName="Jollibee"
    sourceKey="Jollibee"
    menuItems={jollibeeMenu}
    showFoodIcons
    pageClass="jollibee-brand-page"
  />
);

export default JollibeeMenu;
