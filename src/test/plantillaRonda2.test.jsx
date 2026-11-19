import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import conAcento from "../catalog-pro/plantillas/conAcento";
import PopAnuncios from "../catalog-pro/plantillas/PopAnuncios";
import PopHistoria from "../catalog-pro/plantillas/PopHistoria";
import PopFooter from "../catalog-pro/plantillas/PopFooter";
import WhatsAppFloat from "../catalog-pro/WhatsAppFloat";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("conAcento", () => {
  it("sin el interruptor devuelve el texto tal cual", () => {
    expect(conAcento("HOY SE COME BRUTAL.", false)).toBe("HOY SE COME BRUTAL.");
  });
  it("con el interruptor envuelve la ultima palabra; una sola palabra no se parte", () => {
    const { container } = render(<h1>{conAcento("HOY SE COME BRUTAL.", true)}</h1>);
    expect(container.querySelector("em.pop-acento").textContent).toBe("BRUTAL.");
    expect(conAcento("Menu", true)).toBe("Menu");
  });
});

describe("PopAnuncios", () => {
  it("repite las frases y solo la primera repeticion es legible", () => {
    const { container } = render(<PopAnuncios frases={["A", "B"]} acento />);
    expect(container.querySelector(".pop-anuncios--acento")).toBeTruthy();
    const tiras = container.querySelectorAll(".pop-anuncios__tira");
    expect(tiras).toHaveLength(2);
    expect(tiras[1].getAttribute("aria-hidden")).toBe("true");
    expect(tiras[0].querySelectorAll("li:not([aria-hidden])")).toHaveLength(2);
  });
  it("sin frases no pinta nada", () => {
    const { container } = render(<PopAnuncios frases={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("PopHistoria", () => {
  const textos = { historia_titulo: "NO ES SOLO COMER. ES COCHI.", historia_sello: "DESDE EL PRIMER BOCADO", historia_cta: "Vamos a elegir" };
  it("con isotipo arma el sello circular; con acento suma la cinta de contorno y el enlace al menu", () => {
    const { container } = render(<PopHistoria textos={textos} isotipo="https://x/i.png" cinta={["CON ACTITUD"]} acento />);
    expect(container.querySelector(".pop-historia__sello")).toBeTruthy();
    expect(container.querySelector(".pop-cinta--contorno")).toBeTruthy();
    expect(container.querySelector("em.pop-acento").textContent).toBe("COCHI.");
    expect(screen.getByRole("link", { name: /Vamos a elegir/ }).getAttribute("href")).toBe("#pop-menu");
  });
  it("sin isotipo y sin acento queda el sello suelto de siempre", () => {
    const { container } = render(<PopHistoria textos={textos} cinta={["X"]} />);
    expect(container.querySelector(".pop-historia__sello")).toBeNull();
    expect(container.querySelector(".pop-cinta--contorno")).toBeNull();
    expect(container.querySelector(".pop-sello--historia")).toBeTruthy();
  });
});

describe("PopFooter", () => {
  it("muestra lema, llamada a pedir que lleva al menu y pausar; sin lista de atajos", () => {
    const onAlternar = vi.fn();
    const { container } = render(<PopFooter nombre="Cochi" textos={{ footer_lema: "El antojo tiene nombre.", footer_titulo: "¿Listo?", footer_boton: "Arma tu pedido", footer_nav: "LA SIGUIENTE JUGADA" }}
      settings={{ biz_name: "Cochi", logo_letter: "C" }} onAlternar={onAlternar} />);
    expect(screen.getByText("El antojo tiene nombre.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Arma tu pedido/ }).getAttribute("href")).toBe("#pop-menu");
    expect(screen.queryByText("LA SIGUIENTE JUGADA")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver menú" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Pausar animaciones/ }));
    expect(onAlternar).toHaveBeenCalled();
    expect(screen.queryByText(/Instalar/)).toBeNull();
    // la promo de Dico es la banda de siempre (con su logo), no un enlace suelto
    const promo = screen.getByRole("link", { name: /Dico para tu local/ });
    expect(promo.textContent).toContain("Catálogo, pedidos, stock");
    expect(container.querySelectorAll("footer")).toHaveLength(1);
  });
});

describe("footer: libro de quejas y acento del titulo", () => {
  const props = { nombre: "Cochi", textos: { footer_titulo: "¿Listo para pedir algo brutal?" }, onAlternar: () => {} };
  it("el libro de quejas solo sale en Argentina o sin pais", () => {
    const { unmount } = render(<PopFooter {...props} settings={{ biz_name: "Cochi", country: "VE" }} />);
    expect(screen.queryByText("Libro de quejas")).toBeNull();
    unmount();
    render(<PopFooter {...props} settings={{ biz_name: "Cochi", country: "AR" }} />);
    expect(screen.getByText("Libro de quejas")).toBeTruthy();
    cleanup();
    render(<PopFooter {...props} settings={{ biz_name: "Cochi" }} />);
    expect(screen.getByText("Libro de quejas")).toBeTruthy();
  });
  it("con acento, la ultima palabra del titulo del cierre va marcada", () => {
    const { container } = render(<PopFooter {...props} acento settings={{ biz_name: "Cochi", country: "VE" }} />);
    expect(container.querySelector(".pop-footer__titulo em.pop-acento").textContent).toBe("brutal?");
  });
});

describe("WhatsAppFloat", () => {
  const tactil = (v) => vi.stubGlobal("matchMedia", (q) => ({ matches: v && q.includes("hover: none"), addEventListener() {}, removeEventListener() {} }));
  it("sin etiqueta no cambia: un enlace directo", () => {
    render(<WhatsAppFloat whatsapp="584141234567" bizName="Cochi" />);
    expect(screen.getByRole("link").textContent).toBe("");
  });
  it("en pantalla tactil el primer toque expande y no navega; el segundo deja pasar", () => {
    tactil(true);
    render(<WhatsAppFloat whatsapp="584141234567" bizName="Cochi" etiqueta="¿Dudas?" />);
    const a = screen.getByRole("link");
    const primero = fireEvent.click(a);
    expect(primero).toBe(false); // preventDefault: no abrio el chat
    expect(screen.getByText("¿Dudas?").style.opacity).toBe("1");
    expect(fireEvent.click(a)).toBe(true);
  });
  it("con cursor, el hover expande", () => {
    tactil(false);
    render(<WhatsAppFloat whatsapp="584141234567" etiqueta="¿Dudas?" />);
    fireEvent.mouseEnter(screen.getByRole("link"));
    expect(screen.getByText("¿Dudas?").style.opacity).toBe("1");
  });
});
