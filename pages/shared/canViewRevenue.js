/**
 * Whether the current user may see figures that come from orders: revenue,
 * order counts, purchases, Video-to-Purchase and the funnels' Purchase step.
 *
 * The flag is localized by PHP on the Dashboard and Analytics pages from
 * WooCommerce's own report permission (`view_woocommerce_reports`, held by shop
 * managers and administrators). The analytics routes strip the same fields from
 * their responses for everyone else, so this only decides what the screen leaves
 * out. It reads the flag on every call and fails closed: a missing flag hides the
 * order figures.
 *
 * @return {boolean} True when order-derived figures should be shown.
 */
export const canViewRevenue = () => Boolean( window.videoData?.canViewRevenue );
