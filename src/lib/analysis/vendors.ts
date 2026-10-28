/**
 * Fingerprints of third-party tools that reveal how a business captures and
 * handles leads: booking systems, chat widgets, WhatsApp buttons, analytics,
 * ad pixels, CRM / marketing automation, review widgets and site builders.
 *
 * Patterns run against the raw HTML (scripts, iframes, links), so a match is
 * literal evidence that the tool is installed on the page. Keep patterns
 * specific (script hosts, global names) to avoid false positives.
 */

export type VendorGroup =
  | "booking"
  | "chat"
  | "whatsapp"
  | "analytics"
  | "ad_pixel"
  | "crm_marketing"
  | "consent"
  | "popup"
  | "review_widget"
  | "platform";

export interface VendorPattern {
  name: string;
  group: VendorGroup;
  patterns: RegExp[];
}

export const VENDORS: VendorPattern[] = [
  // ── Booking / appointments ──
  { name: "Doctoralia", group: "booking", patterns: [/widgets?\.doctoralia\.\w+/, /doctoralia\.\w+\/[\w-]+\/[\w-]+/] },
  { name: "Top Doctors", group: "booking", patterns: [/topdoctors\.\w+\/(?:cita|widget|doctor)/] },
  { name: "Calendly", group: "booking", patterns: [/calendly\.com\//, /assets\.calendly\.com/] },
  { name: "Cal.com", group: "booking", patterns: [/app\.cal\.com\/|cal\.com\/embed/] },
  { name: "Booksy", group: "booking", patterns: [/booksy\.com\//] },
  { name: "Treatwell", group: "booking", patterns: [/treatwell\.\w+\/(?:establecimiento|place|widget)|widget\.treatwell/] },
  { name: "Fresha", group: "booking", patterns: [/fresha\.com\//] },
  { name: "SimplyBook.me", group: "booking", patterns: [/simplybook\.(?:me|it|es)/] },
  { name: "Setmore", group: "booking", patterns: [/setmore\.com/] },
  { name: "Acuity Scheduling", group: "booking", patterns: [/acuityscheduling\.com|as\.me\//] },
  { name: "Timify", group: "booking", patterns: [/timify\.com/] },
  { name: "Reservio", group: "booking", patterns: [/reservio\.com/] },
  { name: "Bookitit", group: "booking", patterns: [/bookitit\.com/] },
  { name: "Koibox", group: "booking", patterns: [/koibox\.cloud|koibox\.es/] },
  { name: "AgendaPro", group: "booking", patterns: [/agendapro\.com/] },
  { name: "Flowww", group: "booking", patterns: [/flowww\.(?:net|es)/] },
  { name: "Clinic Cloud", group: "booking", patterns: [/cliniccloud\.com/] },
  { name: "Mindbody", group: "booking", patterns: [/mindbodyonline\.com|healcode\.com/] },
  { name: "Square Appointments", group: "booking", patterns: [/squareup\.com\/appointments|square\.site\/book/] },
  { name: "TheFork / ElTenedor", group: "booking", patterns: [/thefork\.\w+|eltenedor\.es|widget\.thefork/] },
  { name: "CoverManager", group: "booking", patterns: [/covermanager\.com/] },
  { name: "OpenTable", group: "booking", patterns: [/opentable\.\w+\/(?:widget|restref|r\/)/] },
  { name: "Resy", group: "booking", patterns: [/resy\.com\//] },
  { name: "Zenchef", group: "booking", patterns: [/zenchef\.com|bookings\.zenchef/] },
  { name: "Restoo", group: "booking", patterns: [/restoo\.me/] },
  { name: "Google Reserve", group: "booking", patterns: [/reserve(?:withgoogle)?\.google\.com|google\.com\/maps\/reserve/] },
  { name: "Booking engine (hotel)", group: "booking", patterns: [/(?:mirai|roiback|siteminder|cloudbeds|synxis|thebookingbutton)\.(?:com|net|es)/] },
  { name: "WooCommerce Bookings / Amelia", group: "booking", patterns: [/wp-content\/plugins\/(?:ameliabooking|woocommerce-bookings|bookly-responsive-appointment-booking-tool|booking-calendar|appointment-booking)/] },

  // ── Chat / assistants ──
  { name: "Tidio", group: "chat", patterns: [/code\.tidio\.co|tidiochat/] },
  { name: "Intercom", group: "chat", patterns: [/widget\.intercom\.io|intercomsettings/] },
  { name: "Crisp", group: "chat", patterns: [/client\.crisp\.chat/] },
  { name: "Drift", group: "chat", patterns: [/js\.driftt\.com|drift\.com\/include/] },
  { name: "Zendesk Chat", group: "chat", patterns: [/static\.zdassets\.com|zopim/] },
  { name: "LiveChat", group: "chat", patterns: [/cdn\.livechatinc\.com/] },
  { name: "Tawk.to", group: "chat", patterns: [/embed\.tawk\.to/] },
  { name: "HubSpot Chat", group: "chat", patterns: [/js\.usemessages\.com/] },
  { name: "Freshchat", group: "chat", patterns: [/wchat\.freshchat\.com|freshchat/] },
  { name: "Smartsupp", group: "chat", patterns: [/smartsuppchat\.com|smartsupp\.com\/loader/] },
  { name: "JivoChat", group: "chat", patterns: [/code\.jivosite\.com|jivo\.chat/] },
  { name: "Olark", group: "chat", patterns: [/static\.olark\.com/] },
  { name: "Chatra", group: "chat", patterns: [/call\.chatra\.io/] },
  { name: "Userlike", group: "chat", patterns: [/userlike-cdn-widgets|userlike\.com\/widget/] },
  { name: "Landbot", group: "chat", patterns: [/landbot\.io/] },
  { name: "ManyChat", group: "chat", patterns: [/widget\.manychat\.com/] },
  { name: "Botpress", group: "chat", patterns: [/cdn\.botpress\.cloud/] },
  { name: "Voiceflow", group: "chat", patterns: [/cdn\.voiceflow\.com/] },
  { name: "Chatbase", group: "chat", patterns: [/chatbase\.co\/embed/] },
  { name: "Gorgias", group: "chat", patterns: [/config\.gorgias\.chat/] },
  { name: "Facebook Messenger", group: "chat", patterns: [/connect\.facebook\.net\/[\w_]+\/sdk\/xfbml\.customerchat|fb-customerchat/] },

  // ── WhatsApp widgets (plain wa.me links are handled separately) ──
  { name: "Joinchat", group: "whatsapp", patterns: [/joinchat|creame-whatsapp-me/] },
  { name: "Click to Chat (HoliThemes)", group: "whatsapp", patterns: [/ht-ctc|click-to-chat/] },
  { name: "WhatsApp Chat (QuadLayers)", group: "whatsapp", patterns: [/wp-whatsapp-chat|qlwapp/] },
  { name: "WhatsApp widget (Elfsight)", group: "whatsapp", patterns: [/elfsight-app-[\w-]+.{0,40}whatsapp|whatsapp-chat-widget/] },
  { name: "GetButton / WhatsHelp", group: "whatsapp", patterns: [/static\.getbutton\.io|whatshelp\.io/] },

  // ── Analytics ──
  { name: "Google Analytics 4", group: "analytics", patterns: [/gtag\/js\?id=g-|gtag\(\s*['"]config['"]\s*,\s*['"]g-/] },
  { name: "Google Analytics (Universal)", group: "analytics", patterns: [/google-analytics\.com\/analytics\.js|['"]ua-\d{4,}-\d+['"]/] },
  { name: "Google Tag Manager", group: "analytics", patterns: [/googletagmanager\.com\/gtm\.js|['"]gtm-[a-z0-9]{5,8}['"]/] },
  { name: "Microsoft Clarity", group: "analytics", patterns: [/clarity\.ms\/tag/] },
  { name: "Hotjar", group: "analytics", patterns: [/static\.hotjar\.com|hotjar\.com\/c\/hotjar/] },
  { name: "Matomo", group: "analytics", patterns: [/matomo\.js|piwik\.js/] },
  { name: "Plausible", group: "analytics", patterns: [/plausible\.io\/js/] },

  // ── Advertising pixels (they pay for traffic) ──
  { name: "Meta Pixel", group: "ad_pixel", patterns: [/connect\.facebook\.net\/[\w_]+\/fbevents\.js|fbq\(\s*['"]init/] },
  { name: "Google Ads", group: "ad_pixel", patterns: [/gtag\/js\?id=aw-|['"]aw-\d{6,}['"]|googleadservices\.com\/pagead\/conversion/] },
  { name: "LinkedIn Insight", group: "ad_pixel", patterns: [/snap\.licdn\.com\/li\.lms-analytics/] },
  { name: "TikTok Pixel", group: "ad_pixel", patterns: [/analytics\.tiktok\.com\/i18n\/pixel/] },

  // ── CRM / marketing automation ──
  { name: "HubSpot", group: "crm_marketing", patterns: [/js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/] },
  { name: "Salesforce / Pardot", group: "crm_marketing", patterns: [/pi\.pardot\.com|go\.pardot\.com|webto(?:lead|case)\.salesforce\.com/] },
  { name: "Zoho CRM / SalesIQ", group: "crm_marketing", patterns: [/salesiq\.zoho|crm\.zoho\.\w+\/crm\/webform|zohopublic/] },
  { name: "Pipedrive", group: "crm_marketing", patterns: [/leadbooster-chat\.pipedrive\.com|webforms\.pipedrive\.com/] },
  { name: "ActiveCampaign", group: "crm_marketing", patterns: [/trackcmp\.net|activehosted\.com/] },
  { name: "Mailchimp", group: "crm_marketing", patterns: [/list-manage\.com|chimpstatic\.com|mc\.us\d+\.list-manage/] },
  { name: "Brevo (Sendinblue)", group: "crm_marketing", patterns: [/sibforms\.com|sendinblue\.com|brevo\.com\/js|sib-form/] },
  { name: "Klaviyo", group: "crm_marketing", patterns: [/static\.klaviyo\.com/] },
  { name: "MailerLite", group: "crm_marketing", patterns: [/assets\.mailerlite\.com|static\.mailerlite\.com/] },
  { name: "Clientify", group: "crm_marketing", patterns: [/clientify\.(?:net|com)\/(?:web-marketing|forms|js)/] },
  { name: "Acumbamail", group: "crm_marketing", patterns: [/acumbamail\.com\/(?:newform|signup)/] },
  { name: "GoHighLevel", group: "crm_marketing", patterns: [/msgsndr\.com|leadconnectorhq\.com/] },
  { name: "Typeform", group: "crm_marketing", patterns: [/embed\.typeform\.com/] },

  // ── Cookie consent ──
  { name: "Cookiebot", group: "consent", patterns: [/consent\.cookiebot\.com/] },
  { name: "OneTrust", group: "consent", patterns: [/cdn\.cookielaw\.org|onetrust/] },
  { name: "Complianz", group: "consent", patterns: [/complianz/] },
  { name: "CookieYes", group: "consent", patterns: [/cdn-cookieyes\.com|cookie-law-info/] },
  { name: "Iubenda", group: "consent", patterns: [/cdn\.iubenda\.com/] },
  { name: "Cookie banner (genérico)", group: "consent", patterns: [/cookie-notice|cookie-consent|moove_gdpr|cookieconsent/] },

  // ── Pop-ups / lead magnets ──
  { name: "OptinMonster", group: "popup", patterns: [/a\.omappapi\.com|optinmonster/] },
  { name: "Sumo", group: "popup", patterns: [/load\.sumo\.com/] },
  { name: "Popup Maker", group: "popup", patterns: [/popup-maker|pum-overlay/] },
  { name: "Elementor Popup", group: "popup", patterns: [/elementor-popup-modal|elementor\/popup/] },
  { name: "Privy", group: "popup", patterns: [/widget\.privy\.com/] },

  // ── Review widgets ──
  { name: "Trustindex (Google reviews)", group: "review_widget", patterns: [/cdn\.trustindex\.io|trustindex\.io\/loader/] },
  { name: "Elfsight reviews", group: "review_widget", patterns: [/elfsight.{0,60}review|apps\.elfsight\.com/] },
  { name: "EmbedSocial", group: "review_widget", patterns: [/embedsocial\.com/] },
  { name: "Trustpilot", group: "review_widget", patterns: [/widget\.trustpilot\.com/] },
  { name: "Google reviews (plugin WP)", group: "review_widget", patterns: [/wp-content\/plugins\/(?:widget-google-reviews|wp-google-places-review-slider|google-reviews-widget)/] },

  // ── Site builders / CMS ──
  { name: "WordPress", group: "platform", patterns: [/wp-content\/|wp-includes\//] },
  { name: "Wix", group: "platform", patterns: [/static\.wixstatic\.com|wix\.com website builder|x-wix-/] },
  { name: "Squarespace", group: "platform", patterns: [/static1\.squarespace\.com|squarespace-cdn/] },
  { name: "Shopify", group: "platform", patterns: [/cdn\.shopify\.com/] },
  { name: "Webflow", group: "platform", patterns: [/assets\.website-files\.com|data-wf-page/] },
  { name: "Joomla", group: "platform", patterns: [/\/media\/jui\/|content="joomla/] },
  { name: "Drupal", group: "platform", patterns: [/drupal-settings-json|\/sites\/default\/files\//] },
  { name: "PrestaShop", group: "platform", patterns: [/prestashop/] },
  { name: "Jimdo", group: "platform", patterns: [/jimdo(?:cdn|static)?\.com/] },
  { name: "GoDaddy Website Builder", group: "platform", patterns: [/img1\.wsimg\.com|godaddy website builder/] },
  { name: "Duda", group: "platform", patterns: [/dudaone|irp\.cdn-website\.com/] },
  { name: "Framer", group: "platform", patterns: [/framerusercontent\.com/] },
];

/** ~100 characters around a match, whitespace collapsed, for evidence. */
export function snippetAround(text: string, index: number, length: number, radius = 45): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const s = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${s}${end < text.length ? "…" : ""}`;
}

export interface VendorMatch {
  vendor: VendorPattern;
  evidence: string;
}

/** Every vendor whose fingerprint appears in `html` (case-insensitive). */
export function detectVendors(html: string): VendorMatch[] {
  const lower = html.toLowerCase();
  const out: VendorMatch[] = [];
  for (const vendor of VENDORS) {
    for (const re of vendor.patterns) {
      const m = re.exec(lower);
      if (m) {
        out.push({ vendor, evidence: snippetAround(html, m.index, m[0].length) });
        break;
      }
    }
  }
  return out;
}
