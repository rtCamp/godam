<?php
/**
 * Narrow product, permalink and attachment-image stubs for the Top Products
 * lookup-context tests (AnalyticsTopProductsLookupContextTest).
 *
 * They model a multisite network where a media-centralizing plugin (e.g. wp-dam)
 * switches to a separate media site while the rtgodam_before_attachment_lookup /
 * rtgodam_after_attachment_lookup pair is open. `$GLOBALS['rtgodam_stub']['site']`
 * names the site in context ('shop' unless a test's hook listener switched it),
 * and each stub answers only on the site that really holds the data: products,
 * their permalinks and the configured WooCommerce placeholder on the shop site,
 * image attachments on `$GLOBALS['rtgodam_stub']['attachment_site']` ('media' by
 * default). Every call is logged with the site it ran on, in
 * `$GLOBALS['rtgodam_stub']['lookups']`. All guarded so a real WordPress /
 * WooCommerce bootstrap wins.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'rtgodam_stub_record_lookup' ) ) {

	/**
	 * Log a lookup with the site it ran on.
	 *
	 * @param string $name What was looked up, e.g. 'wc_get_product'.
	 * @return string The site in context: 'shop' or 'media'.
	 */
	function rtgodam_stub_record_lookup( $name ) {
		$site = $GLOBALS['rtgodam_stub']['site'] ?? 'shop';

		$GLOBALS['rtgodam_stub']['lookups'][] = array(
			'name' => $name,
			'site' => $site,
		);

		return $site;
	}
}

if ( ! function_exists( 'wc_get_product' ) ) {

	/**
	 * A product from `$GLOBALS['rtgodam_stub']['products']`, found only on the
	 * shop site: WooCommerce products don't exist on the media site.
	 *
	 * @param int $product_id Product ID.
	 * @return object|false A minimal WC_Product stand-in, or false when not found.
	 */
	function wc_get_product( $product_id ) {
		$site = rtgodam_stub_record_lookup( 'wc_get_product' );
		$data = $GLOBALS['rtgodam_stub']['products'][ (int) $product_id ] ?? null;

		if ( 'shop' !== $site || ! is_array( $data ) ) {
			return false;
		}

		return new class( $data ) {

			/**
			 * Product fields: name, type, image_id.
			 *
			 * @var array
			 */
			private $data;

			/**
			 * @param array $data Product fields.
			 */
			public function __construct( array $data ) {
				$this->data = $data;
			}

			/**
			 * @return string
			 */
			public function get_name() {
				rtgodam_stub_record_lookup( 'get_name' );
				return (string) $this->data['name'];
			}

			/**
			 * @return string
			 */
			public function get_type() {
				rtgodam_stub_record_lookup( 'get_type' );
				return (string) $this->data['type'];
			}

			/**
			 * @return int
			 */
			public function get_image_id() {
				rtgodam_stub_record_lookup( 'get_image_id' );
				return (int) $this->data['image_id'];
			}
		};
	}
}

if ( ! function_exists( 'get_permalink' ) ) {

	/**
	 * The product's URL on the shop site. On the media site the post doesn't
	 * exist, so false, as WordPress returns for a missing post.
	 *
	 * @param int $post Post ID.
	 * @return string|false
	 */
	function get_permalink( $post = 0 ) {
		$site = rtgodam_stub_record_lookup( 'get_permalink' );
		return 'shop' === $site ? 'https://shop.test/?p=' . (int) $post : false;
	}
}

if ( ! function_exists( 'wc_placeholder_img_src' ) ) {

	/**
	 * The store's configured placeholder image on the shop site; anywhere else
	 * WooCommerce's option is missing and it falls back to its bundled default.
	 *
	 * @param string $size Image size. Ignored.
	 * @return string
	 */
	function wc_placeholder_img_src( $size = 'woocommerce_thumbnail' ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the WooCommerce function; $size is ignored.
		$site = rtgodam_stub_record_lookup( 'wc_placeholder_img_src' );
		return 'shop' === $site
			? 'https://shop.test/wp-content/uploads/woocommerce-placeholder-150x150.png'
			: 'https://shop.test/wp-content/plugins/woocommerce/assets/images/placeholder.png';
	}
}

if ( ! function_exists( 'wp_get_attachment_image_url' ) ) {

	/**
	 * An image URL from `$GLOBALS['rtgodam_stub']['attachments']`, found only on
	 * the site that holds the media library (`attachment_site`, 'media' by default).
	 *
	 * @param int          $attachment_id Attachment ID.
	 * @param string|int[] $size          Image size. Ignored.
	 * @param bool         $icon          Ignored.
	 * @return string|false
	 */
	function wp_get_attachment_image_url( $attachment_id, $size = 'thumbnail', $icon = false ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- signature mirrors the WP function; $size and $icon are ignored.
		$site = rtgodam_stub_record_lookup( 'wp_get_attachment_image_url' );
		$url  = $GLOBALS['rtgodam_stub']['attachments'][ (int) $attachment_id ] ?? false;
		return ( $GLOBALS['rtgodam_stub']['attachment_site'] ?? 'media' ) === $site ? $url : false;
	}
}
