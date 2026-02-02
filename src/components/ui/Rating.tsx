import { Star } from 'lucide-react';
import { useState } from 'react';

interface RatingProps {
  value: number;
  onChange: (newValue: number) => void;
  max?: number;
  size?: 'small' | 'medium' | 'large';
  precision?: number;
  disabled?: boolean;
}

export default function Rating({ 
  value, 
  onChange, 
  max = 5,
  size = 'medium',
  precision: _precision = 1,
  disabled = false,
}: RatingProps) {
  const [hover, setHover] = useState<number | null>(null);

  const sizeMap = {
    small: 18,
    medium: 24,
    large: 28,
  };
  const starSize = sizeMap[size];

  const handleClick = (index: number) => {
    if (disabled) return;
    const newRating = index + 1;
    onChange(newRating === value ? 0 : newRating);
  };

  const getStarFill = (index: number) => {
    const displayValue = hover !== null ? hover : value;
    return displayValue >= index + 1;
  };

  return (
    <div 
      style={{ 
        display: 'inline-flex', 
        gap: '2px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseLeave={() => setHover(null)}
    >
      {[...Array(max)].map((_, index) => {
        const isFilled = getStarFill(index);
        
        return (
          <Star
            key={index}
            size={starSize}
            fill={isFilled ? '#facc15' : 'none'}
            stroke={isFilled ? '#facc15' : '#52525b'}
            strokeWidth={2}
            style={{ 
              transition: 'all 0.15s ease',
              transform: hover === index + 1 ? 'scale(1.1)' : 'scale(1)',
            }}
            onClick={() => handleClick(index)}
            onMouseEnter={() => setHover(index + 1)}
          />
        );
      })}
    </div>
  );
}