import { FEATURE_LABELS, getProductFeatures } from '../lib/catalogFacets';
import './catalog-facets.css';

export default function ProductCharacteristics({ product }) {
  const features = getProductFeatures(product);
  if (!features.length) return null;
  return (
    <ul className="cp-root cp-characteristics" aria-label="Características del producto">
      {features.map(feature => <li key={feature}>{FEATURE_LABELS[feature]}</li>)}
    </ul>
  );
}
