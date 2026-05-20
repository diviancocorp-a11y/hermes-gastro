import { memo } from "react";
import { Icon, formatInt } from "../../lib/utils";
import { avatarColors, DEAL_PCT } from "../../constants/catalogConstants";
import OptimizedImage from "../ui/OptimizedImage";

const ProductCard = memo(function ProductCard({ p, qty, hasDeal, dealPrice, originalPrice, onAdd, onUpdate, isFav, onToggleFav, isLoggedIn, priority = false }) {
  return (
    <div className="prod-card">
      {isLoggedIn && (
        <button aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"} onClick={(e) => { e.stopPropagation(); onToggleFav(p.id); }} style={{ position: "absolute", top: 8, right: 8, zIndex: 5, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          {isFav ? "❤️" : "🤍"}
        </button>
      )}
      <div className="prod-info">
        <div className="prod-title">{p.name}</div>
        <div className="prod-desc">{p.description}</div>
        <div className="prod-bot">
          <div className="prod-price">
            {hasDeal ? (<>
              <span className="price-old">${formatInt(originalPrice)}</span>
              <span className="price-deal">${formatInt(dealPrice)}</span>
            </>) : `$${formatInt(originalPrice)}`}
          </div>
          {hasDeal && <span className="prod-deal-tag">-{DEAL_PCT}%</span>}
          {qty > 0 ? (
            <div className="qty-inline" onClick={e => e.stopPropagation()}>
              <button aria-label={qty <= 1 ? "Quitar del carrito" : "Reducir cantidad"} onClick={() => onUpdate(p.id, qty - 1)}>{qty <= 1 ? <span style={{fontSize:12}}>🗑</span> : Icon.minus({size:14})}</button>
              <span aria-label={`Cantidad: ${qty}`}>{qty}</span>
              <button aria-label="Agregar uno más" onClick={(e) => onAdd(p, e)}>{Icon.plus({size:14})}</button>
            </div>
          ) : (
            <button className="btn-add" data-testid="cart-add" aria-label={`Agregar ${p.name} al carrito`} onClick={(e) => onAdd(p, e)}>{Icon.plus({size:16})}</button>
          )}
        </div>
      </div>
      {p.image_url ? (
        <OptimizedImage
          className="prod-img"
          src={p.image_url}
          alt={p.name}
          width={120}
          height={120}
          quality={65}
          priority={priority}
        />
      ) : null}
      {/* Avatar fallback: siempre renderiza, display lo controla con CSS según haya o no imagen */}
      <div className="prod-img prod-avatar" style={{
        display: p.image_url ? 'none' : 'flex',
        background: avatarColors[p.name.charCodeAt(0) % avatarColors.length]
      }}>
        {p.name.charAt(0)}
      </div>
    </div>
  );
});

export default ProductCard;
