import { memo } from "react";
import { I, fi, imgOpt } from "../../lib/utils";
import { avatarColors, DEAL_PCT } from "../../constants/catalogConstants";

const ProductCard = memo(function ProductCard({ p, qty, hasDeal, dealPrice, originalPrice, onAdd, onUpdate, isFav, onToggleFav, isLoggedIn }) {
  return (
    <div className="prod-card">
      {isLoggedIn && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(p.id); }} style={{ position: "absolute", top: 8, right: 8, zIndex: 5, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          {isFav ? "❤️" : "🤍"}
        </button>
      )}
      <div className="prod-info">
        <div className="prod-title">{p.name}</div>
        <div className="prod-desc">{p.description}</div>
        <div className="prod-bot">
          <div className="prod-price">
            {hasDeal ? (<>
              <span className="price-old">${fi(originalPrice)}</span>
              <span className="price-deal">${fi(dealPrice)}</span>
            </>) : `$${fi(originalPrice)}`}
          </div>
          {hasDeal && <span className="prod-deal-tag">-{DEAL_PCT}%</span>}
          {qty > 0 ? (
            <div className="qty-inline" onClick={e => e.stopPropagation()}>
              <button onClick={() => onUpdate(p.id, qty - 1)}>{qty <= 1 ? <span style={{fontSize:12}}>🗑</span> : I.minus({size:14})}</button>
              <span>{qty}</span>
              <button onClick={(e) => onAdd(p, e)}>{I.plus({size:14})}</button>
            </div>
          ) : (
            <button className="btn-add" onClick={(e) => onAdd(p, e)}>{I.plus({size:16})}</button>
          )}
        </div>
      </div>
      {p.image_url ? (
        <img className="prod-img" src={imgOpt(p.image_url, { width: 300, quality: 65 })} alt={p.name} loading="lazy" decoding="async" width={120} height={120}
          onError={e => { e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex'; }}
        />
      ) : null}
      {(!p.image_url || true) && (
        <div className="prod-img prod-avatar" style={{
          display: p.image_url ? 'none' : 'flex',
          background: avatarColors[p.name.charCodeAt(0) % avatarColors.length]
        }}>
          {p.name.charAt(0)}
        </div>
      )}
    </div>
  );
});

export default ProductCard;
