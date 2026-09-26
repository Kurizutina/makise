import React from 'react';

const ColoredDots = () => {
  const colors = [
    'var(--color-warning)',
    'var(--color-primary)',
    '#F15A29',
    '#FF5DD4',
    'var(--color-primary-dark)'
  ];

  return (
    <div className="color-dots">
      {colors.map((color, index) => (
        <div
          key={index}
          className="dot"
          style={{ background: color }}
        ></div>
      ))}
    </div>
  );
};

export default ColoredDots;