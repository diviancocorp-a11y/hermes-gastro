import { describe, it, expect } from "vitest";
import { reglaMarcaGlobal } from "../catalog-pro/plantillas/useMarcaGlobal";

describe("reglaMarcaGlobal", () => {
  it("sin plantilla o con la default no emite nada (los demas tenants no cambian)", () => {
    expect(reglaMarcaGlobal({ catalog_template: "default", catalog_template_config: { marca: { primario: "#eb140c" } } })).toBeNull();
    expect(reglaMarcaGlobal({})).toBeNull();
  });
  it("con plantilla pop emite los tokens de la marca sobre .cp-root", () => {
    const r = reglaMarcaGlobal({
      catalog_template: "pop", catalog_theme: "ambar",
      catalog_template_config: { marca: { primario: "#eb140c", fondo: "#f5f0dc", texto: "#211e1a", fuente_titulo: "Montserrat" } },
    });
    expect(r.css).toContain(".cp-root.cp-root{");
    expect(r.css).toContain("--ac:#eb140c");
    expect(r.css).toContain("Montserrat");
    expect(r.fuentes).toContain("Montserrat");
  });
});
