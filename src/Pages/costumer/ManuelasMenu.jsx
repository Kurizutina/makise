import React from 'react';
import { RestaurantMenu } from './McDonaldsMenu';
import { manuelasMenuData } from '../../components/home/ManuelasMenu/manuelasMenuData';

const ManuelasMenu = () => (
  <RestaurantMenu
    restaurantName="Manuela's"
    sourceKey="Manuela's"
    menuItems={manuelasMenuData}
    showFoodIcons
  />
);

export default ManuelasMenu;
