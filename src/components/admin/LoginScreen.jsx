import { useState } from "react";
import { login } from "../../lib/adminService";
import business from "@business";

function LoginScreen({onLogin}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const handle=async(e)=>{
    e.preventDefault();setLoading(true);setErr("");
    const res=await login(email,pass);
    setLoading(false);
    if(res.ok){onLogin();}else{setErr(res.msg);}
  };
  return(
    <div className="login-page"><form className="login-form" onSubmit={handle}>
      <div className="login-logo">{business.logoLetter}</div>
      <h2 className="login-title">Panel de Gestión</h2>
      <p className="login-sub">{business.name}</p>
      {err&&<div className="login-err">{err}</div>}
      <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="login-input" required/>
      <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} className="login-input" required/>
      <button type="submit" className="login-btn" disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
    </form></div>
  );
}

export default LoginScreen;
