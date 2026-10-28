/**
 * Signals → findings. Each finding states what was observed (literal
 * evidence) and why it matters commercially. Absence findings say how much
 * was checked, because "not found" is weaker evidence than "found".
 */
import type { FindingInput } from "../domain/types";
import type { Severity } from "../domain/constants";
import { normalizeText } from "../text";
import { FINDINGS, type FindingKey } from "./catalog";
import type { CompanyContext } from "./collect";
import { fmtPhone, fmtSeconds, listEs, quote, type Facts } from "./facts";
import type { AnalysisSignals } from "./signals";

const GENERIC_HEADLINES = /^(inicio|home|bienvenid[oa]s?|welcome|portada|p[aá]gina principal|hola)\b/i;
const FREE_EMAIL = /@(gmail|hotmail|outlook|yahoo|icloud|live|msn|aol|protonmail)\./i;
const CERT_ERROR = "certificado HTTPS no válido";

export function buildFindings(ctx: CompanyContext, s: AnalysisSignals, f: Facts, now = new Date()): FindingInput[] {
  const out: FindingInput[] = [];
  const add = (key: FindingKey, severity: Severity, evidence: string, interpretation: string, evidenceUrl?: string | null) => {
    const def = FINDINGS[key];
    out.push({
      key,
      label: def.label,
      category: def.category,
      kind: def.kind,
      severity: def.kind === "issue" ? severity : "info",
      evidence,
      interpretation,
      evidenceUrl: evidenceUrl && /^https?:\/\//.test(evidenceUrl) ? evidenceUrl : null,
    });
  };
  const checked = `en ${f.pagesChecked} página(s) revisada(s) (${f.pagesDescription})`;
  const b2c = f.profile.bookingExpected || f.profile.repeatBusiness;

  if (f.closed) {
    add(
      "business_closed",
      "high",
      `Estado en las fuentes: ${f.closed === "permanently" ? "cerrado permanentemente" : "cerrado temporalmente"}.`,
      f.closed === "permanently"
        ? "Si el cierre es real, no es un prospecto. Conviene confirmarlo antes de invertir tiempo."
        : "Un cierre temporal reduce la urgencia; conviene esperar a la reapertura.",
    );
  }

  // ── Website presence ──
  if (!f.hasOwnSite) {
    if (ctx.website) {
      add(
        "website_social_only",
        "high",
        `La web registrada es ${ctx.website}, un perfil en una plataforma de terceros.`,
        "Sin web propia el negocio depende de una plataforma ajena: no controla la información, no puede medir visitas ni captar contactos con formularios o reservas.",
        ctx.website,
      );
    } else {
      add(
        "no_website",
        "high",
        "Ninguna de las fuentes consultadas registra una página web para este negocio.",
        "Quien busca el servicio en Google y compara opciones no encuentra dónde informarse ni cómo contactar fuera de la ficha del mapa; esa demanda tiende a irse a competidores con web.",
      );
    }
  } else if (s.website.mismatch) {
    add(
      "website_mismatch",
      "medium",
      `${s.website.url}: ${s.website.mismatch}`,
      "Quien pulsa la web desde la ficha del mapa o el directorio llega a otro negocio y no encuentra a este. Puede ser un dato antiguo de la fuente: conviene confirmarlo antes de mencionarlo. El contenido de esa web no se ha usado en el análisis.",
      s.website.url,
    );
  } else if (s.content.parked) {
    add(
      "website_parked",
      "high",
      quote(s.content.parked),
      "El dominio no muestra una web del negocio sino una página de dominio aparcado o en venta: quien llega desde Google o el mapa no encuentra nada del negocio.",
      s.website.finalUrl,
    );
  } else if (!f.reachable) {
    if (f.blocked) {
      add(
        "website_blocked",
        "info",
        `${s.website.url} respondió HTTP ${s.website.httpStatus} a una visita automatizada.`,
        s.website.httpStatus === 429
          ? "La web limita las visitas automáticas («demasiadas peticiones»); suele ser temporal, así que conviene volver a analizarla más tarde. No es un problema para los clientes."
          : "La web existe pero rechaza visitas automáticas (protección anti-bots). No es necesariamente un problema para los clientes; su contenido no se ha podido revisar.",
        s.website.url,
      );
    } else if (s.website.httpStatus != null) {
      add(
        "website_http_error",
        "high",
        `${s.website.url} respondió con error ${s.website.error ?? `HTTP ${s.website.httpStatus}`}.`,
        s.website.httpStatus >= 500
          ? "Los clientes que llegan desde Google o la ficha del mapa encuentran una página de error y se van. Un error del servidor puede ser temporal: conviene comprobarlo de nuevo antes de contactar."
          : "Los clientes que llegan desde Google o la ficha del mapa encuentran una página de error y se van.",
        s.website.url,
      );
    } else if (s.website.error === CERT_ERROR) {
      add(
        "website_invalid_certificate",
        "high",
        `${s.website.url}: el certificado HTTPS no corresponde al dominio o no es válido.`,
        "El navegador muestra un aviso de seguridad a pantalla completa antes de abrir la web; la mayoría de visitantes no pasa de ahí y el negocio parece descuidado o inseguro.",
        s.website.url,
      );
    } else {
      add(
        "website_unreachable",
        "high",
        `${s.website.url}: ${s.website.error ?? "sin respuesta"} (se reintentó y se probó http/https).`,
        "Una web que no carga equivale a no tener web, y además transmite abandono. Puede ser un fallo temporal: conviene comprobarlo de nuevo antes de contactar.",
        s.website.url,
      );
    }
  }

  if (f.reachable && s.website.listedUrlError) {
    const { url, status } = s.website.listedUrlError;
    add(
      "listed_url_broken",
      "medium",
      `La web que figura en su ficha (${url}) responde con error HTTP ${status}; la página de inicio (${s.website.finalUrl}) sí funciona.`,
      "Quien pulsa «Sitio web» en la ficha del mapa o del directorio llega a una página de error; parte de esas visitas se pierde antes de encontrar la web buena.",
      url,
    );
  }

  if (f.reachable) {
    const home = s.website.finalUrl;
    if (s.content.underConstruction) {
      add(
        "website_under_construction",
        "high",
        quote(s.content.underConstruction),
        "La web se presenta como en construcción o mantenimiento: no informa ni capta clientes mientras tanto.",
        home,
      );
    }
    if (s.website.platform) {
      add("website_platform", "info", `${s.website.platform.name}: ${s.website.platform.evidence}`, `Web construida con ${s.website.platform.name}.`, home);
    }

    // ── HTTPS / technical ──
    if (s.website.https === false) {
      add(
        "no_https",
        "medium",
        `La web se sirve sin cifrar: ${home}`,
        "Chrome y Safari la marcan como «No segura», sobre todo al rellenar formularios; eso resta confianza y conversiones.",
        home,
      );
    } else if (s.website.https) {
      add("has_https", "info", `La web se sirve por HTTPS (${home}).`, "Conexión cifrada: el navegador no muestra avisos de seguridad.", home);
      if (s.website.redirectsToHttps === false) {
        add(
          "no_https_redirect",
          "low",
          `http://${new URL(home!).host}/ no redirige a la versión https.`,
          "Quien entra por enlaces antiguos ve la versión no segura de la web.",
        );
      }
    }
    if (s.technical.mixedContent.length > 0) {
      add(
        "mixed_content",
        "low",
        `Recursos cargados por http:// en una página https: ${s.technical.mixedContent.slice(0, 3).join(", ")}`,
        "El navegador bloquea o advierte de estos recursos: imágenes rotas o aviso de seguridad.",
        home,
      );
    }

    const psi = s.technical.pageSpeed;
    if (psi?.performance != null) {
      const metrics = [
        `rendimiento móvil ${psi.performance}/100`,
        psi.lcpMs != null ? `LCP ${fmtSeconds(psi.lcpMs)}` : null,
        psi.tbtMs != null ? `TBT ${Math.round(psi.tbtMs)} ms` : null,
      ]
        .filter(Boolean)
        .join(", ");
      if (psi.performance < 50) {
        add(
          "poor_mobile_performance",
          psi.performance < 30 ? "high" : "medium",
          `PageSpeed Insights (Google, móvil): ${metrics}.`,
          "La mayoría de visitas llegan desde el móvil; una web lenta pierde visitantes antes de que vean el teléfono o el botón de cita.",
          home,
        );
      } else if (psi.performance >= 80) {
        add("good_mobile_performance", "info", `PageSpeed Insights (Google, móvil): ${metrics}.`, "La web carga rápido en móvil.", home);
      }
    } else if (s.website.loadTimeMs != null && s.website.loadTimeMs > 3000) {
      add(
        "slow_response",
        s.website.loadTimeMs > 6000 ? "medium" : "low",
        `El HTML de la página de inicio tardó ${fmtSeconds(s.website.loadTimeMs)} en descargarse desde nuestro servidor.`,
        "Medición aproximada (sin navegador): si el servidor ya tarda tanto, la carga completa en un móvil será todavía más lenta.",
        home,
      );
    }
    if (s.website.pageBytes != null && s.website.pageBytes > 1_500_000) {
      add(
        "heavy_page",
        "low",
        `El HTML de la página de inicio pesa ${(s.website.pageBytes / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB (sin contar imágenes ni scripts).`,
        "Páginas tan pesadas cargan despacio con datos móviles.",
        home,
      );
    }
    if (s.technical.brokenPages.length > 0) {
      add(
        "broken_pages",
        "low",
        s.technical.brokenPages.map((p) => `${p.url} → HTTP ${p.status}`).join("; "),
        "Enlaces del menú que llevan a páginas de error: el visitante que quería contactar o reservar se queda sin camino.",
        s.technical.brokenPages[0]!.url,
      );
    }

    // ── Mobile ──
    if (!s.mobile.viewport) {
      add(
        "not_mobile_friendly",
        "high",
        "La página de inicio no declara la etiqueta meta viewport.",
        "Sin viewport el móvil muestra la versión de escritorio en miniatura: texto ilegible y botones difíciles de pulsar. Es una señal fuerte de web antigua o no adaptada.",
        home,
      );
    } else if (!s.mobile.responsive) {
      add(
        "not_mobile_friendly",
        "medium",
        `Viewport con ancho fijo: ${quote(s.mobile.viewport)}`,
        "La web no se adapta al ancho de la pantalla del móvil.",
        home,
      );
    } else {
      add("mobile_viewport", "info", `meta viewport: ${quote(s.mobile.viewport)}`, "La web declara diseño adaptable a móvil (no se ha verificado visualmente).", home);
    }

    // ── Content / value proposition ──
    const vp = s.content.valueProposition;
    const vpIsName = vp != null && normalizeText(vp) === normalizeText(ctx.name);
    if (!vp || GENERIC_HEADLINES.test(vp) || vpIsName) {
      add(
        "unclear_value_proposition",
        "medium",
        vp ? `Titular principal: ${quote(vp)}` : "La página de inicio no tiene titular (H1) ni texto destacado.",
        "En los primeros segundos el visitante no lee qué ofrece el negocio, para quién ni por qué elegirlo; es el punto donde más visitas se pierden.",
        home,
      );
    } else {
      add("clear_value_proposition", "info", `Titular principal: ${quote(vp)}`, "La web dice qué ofrece desde el primer vistazo.", home);
    }
    if (!s.content.metaDescription) {
      add(
        "missing_meta_description",
        "low",
        "La página de inicio no tiene meta descripción.",
        "Google improvisa el texto del resultado de búsqueda con fragmentos de la página, que suelen ser poco atractivos.",
        home,
      );
    }
    if (s.content.wordCount > 0 && s.content.wordCount < 120 && !s.content.parked) {
      add(
        "thin_content",
        "low",
        `La página de inicio tiene unas ${s.content.wordCount} palabras de texto visible.`,
        "Poco texto da poca información al cliente y pocas señales a Google. (Si la web carga el contenido con JavaScript, puede haber más de lo que se ve sin ejecutarlo.)",
        home,
      );
    }
    const year = s.content.copyrightYear;
    if (year != null && year <= now.getFullYear() - 3) {
      add(
        "outdated_site",
        "low",
        `Pie de página con © ${year}.`,
        "Un año de copyright antiguo suele indicar que nadie mantiene la web; los clientes lo perciben como dejadez.",
        home,
      );
    }
    if (s.content.testimonials) {
      add("has_testimonials", "info", quote(s.content.testimonials), "Usa prueba social en la propia web.", home);
    }

    // ── Legal ──
    const collectsData = s.forms.some((x) => ["contact", "booking", "newsletter"].includes(x.purpose));
    if (collectsData && !s.technical.legal.privacy) {
      add(
        "missing_legal_pages",
        "medium",
        `La web tiene formularios pero no se encontró enlace a la política de privacidad ${checked}.`,
        "Recoger datos personales sin política de privacidad incumple el RGPD; además resta confianza al enviar el formulario.",
        home,
      );
    } else if (!s.technical.legal.privacy && !s.technical.legal.legalNotice) {
      add(
        "missing_legal_pages",
        "low",
        `No se encontraron enlaces a aviso legal ni a política de privacidad ${checked}.`,
        "La LSSI obliga a las webs de empresa a identificar al titular (aviso legal).",
        home,
      );
    }

    // ── Lead capture ──
    if (f.strongCtas.length > 0) {
      add(
        "has_clear_cta",
        "info",
        `Llamadas a la acción en la página de inicio: ${f.strongCtas.slice(0, 4).map((c) => quote(c.text, 40)).join(", ")}.`,
        "El visitante tiene un siguiente paso claro.",
        home,
      );
    } else {
      add(
        "no_clear_cta",
        f.profile.bookingExpected ? "high" : "medium",
        f.homeCtas.length > 0
          ? `En la página de inicio solo hay enlaces genéricos (${f.homeCtas.slice(0, 3).map((c) => quote(c.text, 30)).join(", ")}), ningún botón para reservar, llamar o pedir información.`
          : "La página de inicio no tiene ningún botón ni enlace que invite a reservar, llamar, escribir o pedir presupuesto.",
        "Sin un siguiente paso evidente, el visitante interesado tiene que buscar cómo contactar; muchos no lo hacen.",
        home,
      );
    }
    if (f.leadForms.length > 0) {
      const form = f.leadForms[0]!;
      add(
        "has_contact_form",
        "info",
        `Formulario en ${form.page}: ${form.fields.slice(0, 8).join(", ")}${form.submitText ? ` (botón ${quote(form.submitText, 30)})` : ""}.`,
        "Hay una vía para dejar datos fuera de horario.",
        form.page,
      );
      const long = f.leadForms.find((x) => x.fieldCount >= 8);
      if (long) {
        add(
          "long_form",
          "low",
          `Formulario con ${long.fieldCount} campos (${long.requiredCount} obligatorios): ${long.fields.slice(0, 10).join(", ")}.`,
          "Cada campo extra reduce el número de personas que terminan de enviarlo.",
          long.page,
        );
      }
    } else {
      if (!f.capturesData) {
        add(
          "no_contact_form",
          "medium",
          `No hay formularios de contacto o cita ${checked}.`,
          "Quien visita la web fuera de horario o prefiere no llamar no tiene forma de dejar sus datos; ese contacto se pierde.",
          home,
        );
      }
    }

    if (s.tracking.crmMarketing.length > 0) {
      add(
        "has_crm_marketing",
        "info",
        s.tracking.crmMarketing.map((v) => `${v.name}: ${v.evidence}`).join(" · "),
        `Usa ${listEs(s.tracking.crmMarketing.map((v) => v.name))}: ya tiene cultura de captación y seguimiento.`,
        s.tracking.crmMarketing[0]!.page,
      );
    } else if (f.leadForms.length > 0) {
      add(
        "no_crm_signals",
        "low",
        `Ninguna herramienta de CRM o email marketing (HubSpot, Zoho, Pipedrive, Mailchimp, Brevo…) aparece ${checked}.`,
        "Los contactos del formulario probablemente llegan a un buzón de email y se gestionan a mano. Puede usar un CRM que no deja huella en la web: confirmar en la conversación.",
        home,
      );
    }
    if (s.leadCapture.leadMagnets.length > 0 || s.leadCapture.popups.length > 0) {
      add(
        "has_lead_magnet",
        "info",
        [...s.leadCapture.leadMagnets.map((x) => quote(x, 60)), ...s.leadCapture.popups.map((p) => p.name)].join(", "),
        "Ofrece un incentivo para captar datos.",
        home,
      );
    }
    if (!s.leadCapture.newsletter && s.leadCapture.popups.length === 0 && s.tracking.crmMarketing.length === 0 && f.profile.repeatBusiness) {
      add(
        "no_email_capture",
        "low",
        `Sin suscripción, newsletter ni herramienta de email marketing ${checked}.`,
        "No construye una base de contactos propia para volver a escribir a clientes y leads que no cerraron.",
        home,
      );
    }
    if (s.tracking.adPixels.length > 0) {
      add(
        "runs_paid_ads",
        "info",
        s.tracking.adPixels.map((v) => `${v.name}: ${v.evidence}`).join(" · "),
        `Tiene instalado ${listEs(s.tracking.adPixels.map((v) => v.name))}: señal de que invierte (o ha invertido) en publicidad para atraer visitas.`,
        s.tracking.adPixels[0]!.page,
      );
    }

    // ── Booking ──
    if (f.hasBooking) {
      add("has_online_booking", "info", f.bookingEvidence!, "Los clientes pueden pedir cita o reservar sin llamar.", s.booking.vendors[0]?.page ?? home);
    } else if (f.profile.bookingExpected) {
      add(
        "no_online_booking",
        "high",
        `Ningún sistema de reserva online (widget, enlace a Doctoralia, Calendly, Booksy, TheFork… ni formulario de cita) ${checked}.`,
        `En ${f.profile.inSector} el cliente espera reservar en el momento; si tiene que llamar y no le cogen, reserva en otro sitio.`,
        home,
      );
    }
    if (s.booking.phoneOnlyHints.length > 0 && !s.booking.vendors.length) {
      add(
        "phone_only_booking",
        "high",
        s.booking.phoneOnlyHints.map((h) => quote(h, 160)).join(" · "),
        "La web dirige las citas al teléfono: cada llamada no atendida (ocupado, fuera de horario, durante una consulta) es una cita perdida.",
        home,
      );
    }

    // ── Contact channels ──
    if (f.hasWhatsapp) {
      add(
        "has_whatsapp",
        "info",
        [...s.whatsapp.links.slice(0, 2), ...s.whatsapp.vendors.map((v) => `${v.name}: ${v.evidence}`)].join(" · "),
        "Ofrece WhatsApp, el canal preferido por muchos clientes para consultas rápidas.",
        s.whatsapp.vendors[0]?.page ?? home,
      );
    } else if (b2c) {
      add(
        "no_whatsapp",
        "medium",
        `Sin enlaces wa.me / api.whatsapp.com ni botón de WhatsApp ${checked}.${f.isMobilePhone && f.knownPhone ? ` El teléfono del negocio (${fmtPhone(f.knownPhone)}) es un móvil.` : ""}`,
        "Muchos clientes prefieren escribir a llamar, sobre todo para preguntas rápidas o fuera de horario; sin WhatsApp visible esas consultas no llegan.",
        home,
      );
    }
    if (f.hasChat) {
      add("has_chat", "info", s.chat.vendors.map((v) => `${v.name}: ${v.evidence}`).join(" · "), `Tiene chat en la web (${listEs(s.chat.vendors.map((v) => v.name))}).`, s.chat.vendors[0]!.page);
    }
    if (!f.hasInstantChannel) {
      const channels = [
        f.phoneOnSite ? "teléfono" : null,
        s.contact.emails.length ? "email" : null,
        f.leadForms.length ? "formulario" : null,
      ].filter((x): x is string => x != null);
      add(
        "no_instant_channel",
        "medium",
        `Sin chat ni WhatsApp ${checked}. Canales visibles: ${channels.length ? listEs(channels) : "ninguno"}.`,
        "Las consultas que llegan por email o formulario esperan respuesta horas o días; quien contacta varios negocios suele quedarse con el que responde primero.",
        home,
      );
    }

    if (!f.phoneOnSite && ctx.phone) {
      add(
        "phone_not_visible",
        "medium",
        `El teléfono ${fmtPhone(ctx.phone)} aparece en las fuentes pero no en la web ${checked}.`,
        "Quien quiere llamar desde la web tiene que buscar el número en otra parte.",
        home,
      );
    } else if (f.phoneOnSite && s.contact.telLinks === 0) {
      add(
        "no_click_to_call",
        "low",
        `El teléfono ${fmtPhone(f.phoneOnSite)} aparece como texto, sin enlace tel:.`,
        "En el móvil no se puede llamar con un toque; hay que copiar el número.",
        home,
      );
    } else if (s.contact.telLinks > 0) {
      add("has_click_to_call", "info", `Enlace tel: a ${fmtPhone(s.contact.phones[0] ?? null)}.`, "Se puede llamar con un toque desde el móvil.", home);
    }

    const technicalTracking = s.tracking.analytics.length + s.tracking.adPixels.length > 0;
    if (s.tracking.analytics.length > 0) {
      add(
        "has_analytics",
        "info",
        s.tracking.analytics.map((v) => v.name).join(", "),
        "Mide las visitas de la web.",
        s.tracking.analytics[0]!.page,
      );
    } else {
      add(
        "no_analytics",
        "low",
        `No se detecta Google Analytics, Tag Manager ni otra herramienta de analítica ${checked}.`,
        "Sin medición el negocio no sabe cuántas visitas recibe ni de dónde vienen sus clientes.",
        home,
      );
    }
    if (technicalTracking && s.tracking.consent.length === 0 && !s.technical.legal.cookies) {
      add(
        "tracking_without_consent",
        "low",
        `Usa ${listEs([...s.tracking.analytics, ...s.tracking.adPixels].map((v) => v.name))} pero no se detecta banner ni política de cookies.`,
        "Instalar analítica o píxeles sin consentimiento previo incumple la normativa de cookies (LSSI/RGPD).",
        home,
      );
    }
    if (s.technical.imageCount >= 5 && s.technical.imagesWithoutAlt / s.technical.imageCount > 0.5) {
      add(
        "images_without_alt",
        "low",
        `${s.technical.imagesWithoutAlt} de ${s.technical.imageCount} imágenes sin atributo alt.`,
        "Peor accesibilidad y menos visibilidad en búsquedas de imágenes.",
        home,
      );
    }
  }

  // ── Contact data independent of the website ──
  const emails = [...new Set([...(ctx.email ? [ctx.email] : []), ...s.contact.emails])];
  const freeEmail = emails.find((e) => FREE_EMAIL.test(e));
  if (freeEmail && f.hasOwnSite) {
    add(
      "free_email_domain",
      "low",
      `Email de contacto: ${freeEmail}`,
      "Un email genérico en lugar del dominio propio resta imagen profesional y suele indicar gestión poco estructurada del correo.",
    );
  }

  // ── Social ──
  if (f.socialPlatforms.length > 0) {
    const urls = [...s.socials.map((x) => x.url), ...ctx.socials.map((x) => x.url)];
    add("has_social_links", "info", `${listEs(f.socialPlatforms)}: ${[...new Set(urls)].slice(0, 3).join(", ")}`, "Tiene presencia en redes sociales.", urls[0]);
  } else if (f.reachable || !f.hasOwnSite) {
    add(
      "no_social_links",
      "low",
      f.reachable ? `La web no enlaza a ninguna red social ${checked}, ni las fuentes registran perfiles.` : "Las fuentes no registran perfiles en redes sociales.",
      "Muchos clientes miran redes antes de decidir; sin ellas el negocio pierde un escaparate y una vía de contacto.",
    );
  }

  // ── Reputation ──
  const rating = ctx.rating;
  const reviews = ctx.reviewCount;
  if (rating == null && reviews == null) {
    add(
      "no_review_data",
      "info",
      "Las fuentes consultadas no aportan valoración ni número de reseñas.",
      "No se puede evaluar la reputación online. Con GOOGLE_PLACES_API_KEY configurada se obtienen la nota y el número de reseñas de Google.",
    );
  } else {
    const ratingText = `${rating != null ? `${rating.toLocaleString("es-ES", { maximumFractionDigits: 1 })}/5` : "sin nota"} con ${reviews ?? "?"} reseñas en ${f.reviewSourceLabel}`;
    if (rating != null && rating < 4.0 && (reviews ?? 0) >= 5) {
      add(
        "low_rating",
        rating < 3.5 ? "high" : "medium",
        `Valoración ${ratingText}.`,
        "Por debajo de 4 estrellas muchos clientes descartan el negocio al comparar en el mapa, antes incluso de visitar la web.",
      );
    } else if (rating != null && rating >= 4.5 && (reviews ?? 0) >= 20) {
      add("good_rating", "info", `Valoración ${ratingText}.`, "Buena reputación: es un activo que se puede aprovechar más (pedir reseñas, mostrarlas en la web).");
    }
    if (reviews != null && reviews < 20) {
      add(
        "few_reviews",
        b2c ? "medium" : "low",
        `Solo ${reviews} reseña(s) en ${f.reviewSourceLabel}.`,
        "Con pocas reseñas el negocio aparece menos en el mapa y genera menos confianza frente a competidores con cientos.",
      );
    } else if (reviews != null && reviews >= 100) {
      add("many_reviews", "info", `${reviews} reseñas en ${f.reviewSourceLabel}.`, "Volumen alto de reseñas: indica un negocio con actividad y clientela.");
    }
  }
  if (s.reviews.widgets.length > 0) {
    add("has_review_widget", "info", s.reviews.widgets.map((w) => `${w.name}: ${w.evidence}`).join(" · "), "Muestra reseñas de clientes en la web.", s.reviews.widgets[0]!.page);
  }

  return out;
}
