// src/lib/textosLegales.js
// Terminos y condiciones, politica de privacidad y cookies de la PLATAFORMA
// (divianco.app). Los lee src/pages/Legales.jsx. Cada seccion se pinta en el
// orden intro -> lista -> parrafos.
//
// Redactado el 6/nov/2026 a partir de lo que el sistema hace de verdad:
// proveedores (Supabase, Vercel, Resend, Sentry, Mercado Pago, Cloudflare,
// Telegram, Google), la prueba de 14 dias de Dante (0122), Vercel Web
// Analytics sin cookies y el almacenamiento local del navegador. Si cambia un
// proveedor, una condicion comercial o un dato que se guarda, se cambia aca y
// se mueve VIGENCIA.
//
// No es asesoramiento legal: Ricky lo revisa con un abogado. Falta sumar
// razon social, CUIT y domicilio del responsable cuando esten definidos.

export const VIGENCIA = '6 de noviembre de 2026';
export const EMAIL_LEGAL = 'hola@divianco.app';

export const TERMINOS = {
  ruta: '/terminos',
  titulo: 'Términos y condiciones',
  descripcion: 'Las condiciones para usar Dico, el sistema de gestión de Grupo Divianco: planes, prueba, pagos, baja y tus datos.',
  secciones: [
    {
      id: 'quienes',
      titulo: 'Quiénes somos',
      parrafos: [
        'Dico es un sistema de gestión para negocios de gastronomía, comercio y servicios, desarrollado y operado por Grupo Divianco (en adelante, “Divianco”). Estos términos regulan el uso de divianco.app, de los subdominios de cada negocio (por ejemplo, tunegocio.divianco.app) y del panel de administración.',
        'Al crear una cuenta o usar Dico aceptás estos términos. Si no estás de acuerdo, no uses el servicio.',
      ],
    },
    {
      id: 'servicio',
      titulo: 'Qué es el servicio',
      parrafos: [
        'Dico te da un catálogo online para tu negocio y herramientas para operarlo: pedidos, caja, stock, recetas, personal, agenda y reportes, según el plan y el rubro. Las funciones de cada plan están publicadas en la sección de planes de divianco.app.',
        'Algunas herramientas figuran como “en desarrollo”: no forman parte de lo que contratás hasta que estén disponibles.',
      ],
    },
    {
      id: 'cuenta',
      titulo: 'Tu cuenta',
      parrafos: [
        'Para usar el panel tenés que crear una cuenta con datos verdaderos. Sos responsable de tu contraseña y de lo que hagan las personas a las que les des acceso a tu negocio.',
        'Tenés que ser mayor de 18 años y tener capacidad para contratar en nombre del negocio que registrás.',
      ],
    },
    {
      id: 'planes',
      titulo: 'Planes, precios y prueba',
      parrafos: [
        'Los planes son Paris, Dante y Magnus. Los precios están en pesos argentinos, son por local y no incluyen IVA. No hay cargo por usuario ni por pedido.',
        'Toda cuenta nueva arranca con 14 días de Dante completo, sin cobro. Crear la cuenta no contrata una suscripción ni autoriza débitos. Al terminar la prueba, el negocio pasa a Paris: para seguir usándolo tenés que elegir un plan y un medio de pago. Si no lo hacés, la cuenta se suspende hasta que lo hagas, sin perder tus datos.',
        'El plan Magnus se contrata hablando con nosotros, porque se configura según la cantidad de locales.',
        'Podemos cambiar los precios. Te avisamos por email con al menos 30 días de anticipación, y el cambio corre desde el período siguiente.',
      ],
    },
    {
      id: 'pagos',
      titulo: 'Pagos',
      parrafos: [
        'Los planes se pagan por adelantado, por mes o por año, según lo que elijas. Los cobros se procesan a través de Mercado Pago o por transferencia bancaria: Divianco no guarda los datos de tu tarjeta.',
        'Si un pago no se acredita, Dante y Magnus pasan a funcionar como Paris, y Paris sin pago se suspende hasta regularizarlo. Tus datos no se borran por una suspensión.',
      ],
    },
    {
      id: 'baja',
      titulo: 'Baja y arrepentimiento',
      parrafos: [
        `Podés dar de baja tu plan cuando quieras escribiendo a ${EMAIL_LEGAL}. La baja corre desde el período siguiente y no se cobran cargos por cancelar.`,
        'Si sos consumidor, tenés 10 días corridos desde la contratación para arrepentirte sin dar motivos, según la Ley 24.240 de Defensa del Consumidor. Lo pedís por el mismo email y te devolvemos lo cobrado.',
      ],
    },
    {
      id: 'datos-del-negocio',
      titulo: 'Los datos de tu negocio',
      parrafos: [
        'Los datos que cargás en Dico (productos, precios, ventas, stock, clientes, personal) son tuyos. Divianco los usa solo para prestarte el servicio, nunca los vende ni los comparte con otros negocios.',
        `Mientras tu cuenta esté activa, y hasta 90 días después de la baja, podés pedirnos una copia completa en planillas (CSV o Excel) escribiendo a ${EMAIL_LEGAL}. Te la enviamos dentro de los 15 días.`,
        'Pasados 90 días de la baja, borramos los datos del negocio, salvo lo que la ley nos obligue a conservar.',
        'Sobre los datos de tus clientes, vos sos el responsable y Divianco los trata por tu cuenta. El detalle está en la política de privacidad.',
      ],
    },
    {
      id: 'uso',
      titulo: 'Uso aceptable',
      parrafos: [
        'No podés usar Dico para vender productos o servicios ilegales, para enviar mensajes no deseados, para intentar acceder a datos de otros negocios ni para afectar el funcionamiento del sistema. Si pasa, podemos suspender la cuenta.',
        'Sos responsable de que tu catálogo cumpla las normas que te aplican: precios, información al consumidor, venta de alcohol a mayores de 18 años, habilitaciones y facturación.',
      ],
    },
    {
      id: 'disponibilidad',
      titulo: 'Disponibilidad y soporte',
      parrafos: [
        'Trabajamos para que Dico esté disponible siempre, pero puede haber interrupciones por mantenimiento o por fallas de proveedores. Dico necesita conexión a internet: hoy no tiene modo sin conexión.',
        'Paris incluye soporte por email. Dante suma soporte por chat, y Magnus soporte por teléfono. El horario de atención está publicado en divianco.app.',
      ],
    },
    {
      id: 'responsabilidad',
      titulo: 'Responsabilidad',
      parrafos: [
        'Dico es una herramienta: las decisiones de tu negocio, los precios que cargás y la información que das a tus clientes son tuyos. Los reportes dependen de los datos que cargues; si un costo no está cargado, el resultado no lo refleja.',
        'En lo que la ley permita, la responsabilidad de Divianco frente a vos se limita al monto que pagaste por el servicio en los últimos 3 meses. Nada de esto limita los derechos que te da la Ley 24.240 si sos consumidor.',
      ],
    },
    {
      id: 'cambios',
      titulo: 'Cambios a estos términos',
      parrafos: [
        'Si cambiamos estos términos, publicamos la versión nueva acá con su fecha y, si el cambio es importante, te avisamos por email con al menos 30 días de anticipación. Si seguís usando Dico después de esa fecha, aceptás la versión nueva.',
      ],
    },
    {
      id: 'ley',
      titulo: 'Ley aplicable',
      parrafos: [
        'Estos términos se rigen por las leyes de la República Argentina. Para cualquier conflicto son competentes los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, salvo que seas consumidor y elijas los de tu domicilio.',
        `Para consultas o reclamos, escribinos a ${EMAIL_LEGAL}.`,
      ],
    },
  ],
};

export const PRIVACIDAD = {
  ruta: '/privacidad',
  titulo: 'Política de privacidad',
  descripcion: 'Qué datos guarda Dico, para qué, con quién se comparten y cómo pedís verlos, corregirlos o borrarlos.',
  secciones: [
    {
      id: 'responsable',
      titulo: 'Quién es el responsable',
      parrafos: [
        `Grupo Divianco (“Divianco”) es responsable de los datos de las personas que crean una cuenta en Dico, completan el diagnóstico o nos contactan. Para cualquier consulta sobre tus datos, escribinos a ${EMAIL_LEGAL}.`,
        'Cuando un negocio usa Dico para vender, el negocio es el responsable de los datos de sus clientes y Divianco los trata por su cuenta, solo para prestarle el servicio.',
      ],
    },
    {
      id: 'que-datos',
      titulo: 'Qué datos guardamos',
      lista: [
        'De tu cuenta: nombre, email, contraseña (guardada con hash: nadie la puede leer, ni Divianco) o el acceso con Google, y el negocio que registrás (nombre, rubro, país, enlace y plan).',
        'Del diagnóstico: tus respuestas, el nombre del negocio, tu nombre y tu WhatsApp, solo si nos autorizás a contactarte.',
        'Del uso del panel: lo que cargás para operar tu negocio (productos, ventas, stock, personal, clientes).',
        'De los clientes de cada negocio, al hacer un pedido o reservar un turno: nombre, teléfono, dirección de entrega si hace falta y el detalle del pedido. No hace falta crear una cuenta.',
        'Técnicos: errores de la aplicación y visitas a las páginas de Dico, sin identificarte (ver “Cookies y almacenamiento”).',
      ],
    },
    {
      id: 'para-que',
      titulo: 'Para qué los usamos',
      lista: [
        'Prestarte el servicio: crear tu cuenta, mostrar tu catálogo, registrar pedidos y avisarte de los nuevos.',
        'Cobrar el plan que elijas.',
        'Darte soporte y, si lo autorizaste en el diagnóstico, contactarte por WhatsApp para ayudarte a configurar Dico.',
        'Encontrar y corregir errores, y medir qué páginas se visitan para mejorar el producto.',
      ],
      parrafos: [
        'No vendemos tus datos ni los usamos para publicidad de terceros.',
      ],
    },
    {
      id: 'proveedores',
      titulo: 'Con quién los compartimos',
      intro: 'Usamos proveedores que guardan o procesan datos por cuenta nuestra, con sus propias medidas de seguridad. Algunos están fuera de la Argentina, por lo que los datos pueden transferirse a otros países:',
      lista: [
        'Supabase: base de datos, acceso a la cuenta y archivos.',
        'Vercel: alojamiento de la aplicación y medición de visitas.',
        'Cloudflare: dominios y red.',
        'Resend: envío de emails.',
        'Sentry: registro de errores de la aplicación.',
        'Mercado Pago: cobros. Divianco no recibe los datos de tu tarjeta.',
        'Google: acceso con tu cuenta de Google, solo si lo elegís.',
        'Telegram: avisos de pedidos nuevos al negocio, solo si los activa.',
      ],
    },
    {
      id: 'cuanto-tiempo',
      titulo: 'Cuánto tiempo los guardamos',
      parrafos: [
        'Mientras tu cuenta esté activa. Después de la baja, conservamos los datos del negocio 90 días para que puedas pedir una copia, y luego los borramos, salvo lo que la ley nos obligue a conservar (por ejemplo, la información de facturación).',
        'Los datos del diagnóstico de quien no crea una cuenta se borran a los 12 meses o antes, si lo pedís.',
      ],
    },
    {
      id: 'derechos',
      titulo: 'Tus derechos',
      parrafos: [
        `Podés pedir ver, corregir, actualizar o borrar tus datos, y retirar la autorización para que te contactemos, escribiendo a ${EMAIL_LEGAL}. Respondemos dentro de los plazos de la Ley 25.326 de Protección de Datos Personales: 10 días corridos para el acceso y 5 días hábiles para la corrección o el borrado. El acceso es gratuito cada 6 meses, salvo que acredites un interés legítimo para pedirlo antes.`,
        'Si sos cliente de un negocio que usa Dico, podés pedirle al negocio directamente, o escribirnos y se lo trasladamos.',
        'La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
      ],
    },
    {
      id: 'seguridad',
      titulo: 'Seguridad',
      parrafos: [
        'Cada negocio ve solo sus propios datos: el aislamiento entre negocios se controla en la base de datos y se verifica todos los días. Las conexiones van cifradas y las contraseñas se guardan con hash, así que nadie las puede leer. Si hubiera un incidente que afecte tus datos, te avisamos.',
      ],
    },
    {
      id: 'cookies',
      titulo: 'Cookies y almacenamiento',
      parrafos: [
        'Dico no usa cookies de publicidad ni de seguimiento. La medición de visitas de divianco.app se hace con Vercel Web Analytics, que no usa cookies ni identifica a la persona. En los catálogos de cada negocio no se mide.',
        'Para que el sistema funcione, guardamos en tu navegador (almacenamiento local) datos como la sesión iniciada, el tema elegido, el último pedido y las preferencias del catálogo. No se comparten con terceros y podés borrarlos desde la configuración de tu navegador; si lo hacés, se cierra tu sesión.',
        'Como no hay cookies opcionales, no hace falta que elijas preferencias. Si sumamos alguna, te vamos a pedir permiso antes.',
      ],
    },
    {
      id: 'menores',
      titulo: 'Menores',
      parrafos: [
        'Las cuentas de Dico son para mayores de 18 años. No recolectamos a sabiendas datos de menores para crear cuentas.',
      ],
    },
    {
      id: 'cambios',
      titulo: 'Cambios a esta política',
      parrafos: [
        'Si cambiamos esta política, publicamos la versión nueva acá con su fecha y, si el cambio es importante, te avisamos por email.',
      ],
    },
  ],
};

export const LEGALES = [TERMINOS, PRIVACIDAD];
