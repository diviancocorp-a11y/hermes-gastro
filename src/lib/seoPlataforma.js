// Identidad publica de Dico; solo se aplica al dominio de la plataforma.
export const SEO_PLATAFORMA = {
  titulo: 'Dico | Gestión para gastronomía, comercios y servicios',
  descripcion: 'Gestioná pedidos, stock, caja, equipo y resultados en Dico. Para gastronomía, comercios y servicios. Empezá con un diagnóstico breve, sin email.',
  url: 'https://divianco.app/',
  imagen: 'https://divianco.app/brand/og/dico.png?v=2',
  imagenAlt: 'Dico: tu tiempo vuelve a ser tuyo. Gestión para gastronomía, comercios y servicios.',
};

export const DATOS_ESTRUCTURADOS_PLATAFORMA = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': 'https://divianco.app/#organizacion', name: 'Grupo Divianco', url: SEO_PLATAFORMA.url, sameAs: ['https://www.instagram.com/grupodivianco/'], email: 'hola@divianco.app' },
    { '@type': 'WebSite', '@id': 'https://divianco.app/#sitio', name: 'Dico', url: SEO_PLATAFORMA.url, inLanguage: 'es-AR', publisher: { '@id': 'https://divianco.app/#organizacion' } },
    { '@type': 'SoftwareApplication', '@id': 'https://divianco.app/#dico', name: 'Dico', url: SEO_PLATAFORMA.url, description: SEO_PLATAFORMA.descripcion, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'es-AR', image: SEO_PLATAFORMA.imagen, publisher: { '@id': 'https://divianco.app/#organizacion' }, sameAs: ['https://www.instagram.com/dico.arg/'] },
  ],
};
