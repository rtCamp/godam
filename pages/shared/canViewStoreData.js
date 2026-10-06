/**
 * Whether the current user may see store data: products, add-to-carts,
 * Video-to-Cart, orders, purchases and revenue.
 *
 * The flag is localized by PHP on the Dashboard and Analytics pages from
 * WooCommerce's own report permission (`view_woocommerce_reports`, held by shop
 * managers and administrators). Editors and authors see video data only. The
 * analytics routes refuse or strip the same data for everyone else, so this only
 * decides what the screen leaves out. It reads the flag on every call and fails
 * closed: a missing flag hides the store data.
 *
 * @return {boolean} True when store data should be shown.
 */
export const canViewStoreData = () => Boolean( window.videoData?.canViewStoreData );
