import * as FiIcons from 'react-icons/fi';
import './CategoryCard.css';

const CategoryCard = ({ category, isActive, onClick }) => {
  // Map icon string to actual icon component
  const getIcon = (iconName) => {
    const IconComponent = FiIcons[iconName];
    return IconComponent ? <IconComponent /> : iconName;
  };

  return (
    <button 
      className={`category-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="category-icon">{getIcon(category.icon)}</span>
      <div className="category-info">
        <h4>{category.name}</h4>
        <span className="category-count">
          {category.onlineCount || 0} online
        </span>
      </div>
    </button>
  );
};

export default CategoryCard;
