// Animación de confirmación: corazón terracota + check
export default function ConfirmationAnimation() {
  return (
    <div style={{ position:"fixed",inset:0,background:"#C45D3E",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",zIndex:250 }}>
      <style>{`
        @keyframes heartBounce {
          0% { transform: scale(0) rotate(-15deg); opacity:0; }
          60% { transform: scale(1.15) rotate(0deg); opacity:1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .confirm-heart-ck { animation: heartBounce 0.8s cubic-bezier(0.68,-0.55,0.265,1.55) forwards; }
      `}</style>
      <div className="confirm-heart-ck" style={{ marginBottom: 32 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <path d="M70,125 C30,95 5,72 5,48 C5,30 18,18 35,18 C48,18 58,25 70,38 C82,25 92,18 105,18 C122,18 135,30 135,48 C135,72 110,95 70,125Z" fill="#FFF8F0"/>
          <path d="M45,62 L62,78 L95,48" stroke="#C45D3E" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 style={{ fontFamily:"'DM Serif Display',serif",fontSize:26,margin:0,color:"#FFF8F0" }}>¡Pedido confirmado!</h2>
      <p style={{ fontSize:14,color:"rgba(255,248,240,0.8)",marginTop:8 }}>Gracias por elegir La Nona Pato</p>
    </div>
  );
}
