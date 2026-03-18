<?php
/**
 * WC_Product_Video_Gallery class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WooCommerce;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Product_Video_Gallery
 */
class WC_Product_Video_Gallery {

	use Singleton;

	/**
	 * Holds the utility instance.
	 *
	 * @var WC_Utility
	 */
	private $utility_instance;

	/**
	 * Holds the markup instance.
	 *
	 * @var WC_Product_Gallery_Video_Markup
	 */
	private $markup_instance;

	/**
	 * Constructor method.
	 *
	 * Registers hooks for adding a meta box, saving video gallery data, enqueuing
	 * media scripts, handling attachment deletion, and placing the meta box below
	 * the built-in WC gallery. Also allows inline SVG in WP-Admin.
	 */
	public function __construct() {
		add_action( 'add_meta_boxes', array( $this, 'add_video_gallery_metabox' ) );
		add_action( 'save_post_product', array( $this, 'save_video_gallery' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		// Enqueue early so WooCommerce can localize its scripts (wc-settings / Blocks data stores)
		// before scripts are printed.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ), 5 );
		add_action( 'woocommerce_single_product_summary', array( $this, 'add_video_slider_to_single_product' ), 70 );
		add_action( 'delete_attachment', array( $this, 'on_attachment_deleted' ) );
		add_action( 'before_delete_post', array( $this, 'on_product_deleted' ) );
		add_filter( 'get_user_option_meta-box-order_product', array( $this, 'place_below_wc_gallery' ) );

		// Initialize the Utility Helper class.
		$this->utility_instance = WC_Utility::get_instance();

		// Initialize Video Markup class.
		$this->markup_instance = WC_Product_Gallery_Video_Markup::get_instance();

		add_filter( 'wp_kses_allowed_html', array( $this, 'allow_svg_on_wp_kses' ), 10, 2 );
	}

	/**
	 * Enqueue the media scripts and styles required for managing the video gallery for products.
	 *
	 * Only loads on the 'product' post type.
	 *
	 * @since 1.0.0
	 */
	public function enqueue_admin_assets() {
		if ( get_post_type() === 'product' ) {

			wp_enqueue_media();

			wp_enqueue_script(
				'rtgodam-wc-product-video-gallery',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/js/admin/wc-product-video-gallery.min.js',
				array( 'jquery' ),
				rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-product-video-gallery.min.js' ),
				true
			);

			wp_enqueue_script(
				'rtgodam-wc-add-to-product',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/js/admin/wc-add-to-product.min.js',
				array( 'jquery', 'wp-api-fetch', 'wp-components', 'wp-element', 'godam-player-frontend-script' ),
				rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-add-to-product.min.js' ),
				true
			);

			// Build product type and variation attributes for the admin picker.
			$current_product_id = get_the_ID();
			$product_type_name  = 'simple';
			$product_attributes = array();

			if ( $current_product_id ) {
				$current_product = wc_get_product( $current_product_id );
				if ( $current_product instanceof \WC_Product ) {
					$product_type_name = $current_product->get_type();
					if ( $current_product->is_type( 'variable' ) ) {
						foreach ( $current_product->get_variation_attributes() as $attribute_slug => $attribute_values ) {
							$options = array();
							foreach ( $attribute_values as $value ) {
								$term      = get_term_by( 'slug', $value, $attribute_slug );
								$options[] = array(
									'value' => $value,
									'label' => $term ? $term->name : ucfirst( str_replace( '-', ' ', $value ) ),
								);
							}
							$product_attributes[] = array(
								'slug'    => $attribute_slug,
								'label'   => wc_attribute_label( $attribute_slug ),
								'options' => $options,
							);
						}
					}
				}
			}

			wp_localize_script(
				'rtgodam-wc-add-to-product',
				'RTGodamVideoGallery',
				array(
					'apiRoot'           => esc_url_raw( rest_url() ),
					'namespace'         => 'godam/v1',
					'productsEP'        => '/wcproducts',
					'linkVideoEP'       => '/link-video',
					'unLinkVideoEP'     => '/unlink-video',
					'timestampEP'       => '/save-product-meta',
					'getTimestampEP'    => '/get-product-meta',
					'videoCountEP'      => '/video-product-count',
					'currentProductId'  => get_the_ID(),
					'defaultThumbnail'  => RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png',
					'Ptag'              => RTGODAM_WC_MODULE_URL . 'assets/images/product-tag.svg',
					'DeleteIcon'        => RTGODAM_URL . 'assets/src/images/delete-video-bin.svg',
					'hasValidAPIKey'    => rtgodam_is_api_key_valid(),
					'productType'       => $product_type_name,
					'productAttributes' => $product_attributes,
				)
			);
		}
	}

	/**
	 * Registers and enqueues frontend assets for the video carousel on the product page.
	 *
	 * Registers the Swiper library and a custom script for initializing the carousel.
	 * Enqueues the styles and scripts if the current post type is 'product'.
	 *
	 * @since 1.0.0
	 */
	public function enqueue_frontend_assets() {
		wp_register_script(
			'rtgodam-swiper-script',
			RTGODAM_URL . 'assets/src/libs/swiper/swiper-bundle.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/src/libs/swiper/swiper-bundle.min.js' ),
			true
		);

		wp_register_style(
			'rtgodam-swiper-style',
			RTGODAM_URL . 'assets/src/libs/swiper/swiper-bundle.min.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/src/libs/swiper/swiper-bundle.min.css' )
		);

		wp_register_script(
			'rtgodam-wc-video-carousel',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-video-carousel.min.js',
			array( 'jquery', 'rtgodam-script', 'rtgodam-swiper-script', 'wp-data', 'wc-settings', 'wc-blocks-data-store' ),
			filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/wc-video-carousel.min.js' ),
			true
		);

		wp_register_style(
			'rtgodam-wc-video-carousel-style',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-video-carousel.css',
			array(),
			filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'css/godam-video-carousel.css' )
		);

		if ( 'product' === get_post_type() ) {
			wp_enqueue_script( 'rtgodam-swiper-script' );
			wp_enqueue_style( 'rtgodam-swiper-style' );
			wp_enqueue_script( 'rtgodam-wc-video-carousel' );
			wp_enqueue_style( 'rtgodam-wc-video-carousel-style' );
		}
	}

	/**
	 * Add a meta box to the product post type edit screen to house the video gallery.
	 *
	 * @since 1.0.0
	 */
	public function add_video_gallery_metabox() {
		$title = apply_filters(
			'rtgodam_video_gallery_metabox_title',
			__( 'Product Reels', 'godam' ) .
			' <span class="godam-pro-badge">' . __( 'Pro', 'godam' ) . '</span>'
		);

		add_meta_box(
			'rtgodam_product_video_gallery',
			$title,
			array( $this, 'render_video_gallery_metabox' ),
			'product',
			'side',
			'default'
		);
	}

	/**
	 * Modifies the meta box order on the product edit screen to place the RTGoDAM
	 * video gallery below the built-in WC product gallery.
	 *
	 * @since 1.0.0
	 *
	 * @param array $order The meta box order.
	 *
	 * @return array
	 */
	public function place_below_wc_gallery( $order ) {

		if ( empty( $order['side'] ) ) {
			return $order;
		}

		// If we’ve already been inserted, bail.
		if ( str_contains( $order['side'], 'rtgodam_product_video_gallery' ) ) {
			return $order;
		}

		$boxes = explode( ',', $order['side'] );
		$new   = array();

		foreach ( $boxes as $id ) {
			$new[] = $id;
			if ( 'woocommerce-product-images' === $id ) {
				$new[] = 'rtgodam_product_video_gallery';
			}
		}

		$order['side'] = implode( ',', $new );
		return $order;
	}

	/**
	 * Render the video gallery metabox on the product edit screen.
	 *
	 * @since 1.0.0
	 *
	 * @param \WP_Post $post The current post object.
	 */
	public function render_video_gallery_metabox( $post ) {

		// Check the API key validity.
		$godam_has_valid_api_key = rtgodam_is_api_key_valid();

		$video_urls = get_post_meta( $post->ID, '_rtgodam_product_video_gallery', true );
		$video_urls = is_array( $video_urls ) ? $video_urls : array();

		$tag_icon_svg = sprintf(
			'<img src="%s" alt="%s" width="14" height="14" style="vertical-align:middle; margin-right:4px;" />',
			esc_url( RTGODAM_URL . 'assets/src/images/product-tag.svg' ),
			esc_attr__( 'Tag Icon', 'godam' )
		);

		$ids = get_post_meta( $post->ID, '_rtgodam_product_video_gallery_ids', true ) ?: array();

		echo '<div id="rtgodam-product-video-gallery">';

		if ( ! $godam_has_valid_api_key ) {
			$video_editor_settings_url = admin_url( 'admin.php?page=rtgodam_settings#video-settings' );

			echo '<div class="notice notice-warning inline"><p>';

			echo '<strong>' . esc_html__( 'Product Reels is a Pro feature.', 'godam' ) . '</strong> ';

			echo '<a href="' . esc_url( $video_editor_settings_url ) . '" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C] no-underline">';
			echo esc_html__( 'Activate your license', 'godam' );
			echo '</a>';

			echo esc_html__( ' or ', 'godam' );

			echo '<a href="' . esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=upgrade&utm_source=plugin&utm_medium=admin-notice&utm_content=godam_woo_product_reels' ) . '" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C]">';
			echo esc_html__( 'get started for free↗', 'godam' );
			echo '</a> ';

			echo esc_html__( 'to unlock all features.', 'godam' );

			echo '</p></div>';
		}

		wp_nonce_field( 'rtgodam_save_video_gallery', 'rtgodam_video_gallery_nonce' );

		echo '<div class="' . ( ! $godam_has_valid_api_key ? 'godam-disabled-ui' : '' ) . '">';

		echo '<ul class="godam-product-video-gallery-list godam-margin-top godam-margin-bottom godam-product-video-gallery-list wc-godam-product-admin">';

		echo '<div class="godam-product-admin-video-spinner-overlay" style="display:none;">
				<div class="godam-product-admin-video-spinner">
					<div class="spinner"></div>
				</div>
			</div>';

		if ( ! $godam_has_valid_api_key && empty( $video_urls ) ) {

			$dummy_thumb = RTGODAM_URL . 'assets/src/images/dummy-reel-thumb.png';

			printf(
				'<li class="godam-dummy-card">
					<div class="video-thumb-wrapper">
						<img src="%s" style="display:block; max-width:200px; margin-bottom:10px;" alt="%s" />
					</div>
					<div class="godam-product-video-title">%s</div>
					<div class="godam-dummy-products">%s</div>
				</li>',
				esc_url( $dummy_thumb ),
				esc_attr__( 'Sample Video 1 thumbnail', 'godam' ),
				esc_html__( 'Sample Video 1', 'godam' ),
				'<span class="godam-dummy-pill">' . esc_html__( '+ Add products', 'godam' ) . '</span>'
			);

			printf(
				'<li class="godam-dummy-card">
					<div class="video-thumb-wrapper">
						<img src="%s" style="display:block; max-width:200px; margin-bottom:10px;" alt="%s" />
					</div>
					<div class="godam-product-video-title">%s</div>
					<div class="godam-dummy-products">%s</div>
				</li>',
				esc_url( $dummy_thumb ),
				esc_attr__( 'Sample Video 2 thumbnail', 'godam' ),
				esc_html__( 'Sample Video 2', 'godam' ),
				'<span class="godam-dummy-pill">' . esc_html__( '+ Add products', 'godam' ) . '</span>'
			);
		}

		// Load saved per-video variation selections.
		$saved_variations = get_post_meta( $post->ID, '_rtgodam_product_video_variations', true );
		$saved_variations = is_array( $saved_variations ) ? $saved_variations : array();

		// Check whether this is a variable product so we can show the variation picker button.
		$product_for_type = wc_get_product( $post->ID );
		$is_variable      = $product_for_type && $product_for_type->is_type( 'variable' );

		foreach ( $video_urls as $index => $url ) {
			$id            = isset( $ids[ $index ] ) ? intval( $ids[ $index ] ) : '';
			$sanitised_url = esc_url( $url );

			$linked_products     = $id ? get_post_meta( $id, '_video_parent_product_id', false ) : array();
			$linked_products_obj = array_map(
				function ( $pid ) {
					$thumb_id  = get_post_thumbnail_id( $pid );
					$thumb_url = $thumb_id
						? wp_get_attachment_image_url( $thumb_id, 'woocommerce_thumbnail' )
						: wc_placeholder_img_src();

					return array(
						'id'    => (int) $pid,
						'name'  => get_the_title( $pid ),
						'image' => $thumb_url,
					);
				},
				$linked_products
			);
			$linked_json         = wp_json_encode( $linked_products_obj );

			$count = is_array( $linked_products ) ? count( $linked_products ) - 1 : 0;

			if ( $count > 0 ) {
				$raw_label  = sprintf(
					'&nbsp;%s%d&nbsp;%s',
					$tag_icon_svg,
					$count,
					_n( 'product', 'products', $count, 'godam' )
				);
				$aria_label = sprintf(
					/* translators: %1$d: product count, %2$s: plural suffix */
					__( '%1$d product%2$s attached to this video', 'godam' ),
					$count,
					$count > 1 ? 's' : ''
				);
			} else {
				$raw_label  = esc_html__( '+ Add products', 'godam' );
				$aria_label = __( 'Associate products with this video', 'godam' );
			}

			$label = $raw_label;

			$video_title = $id ? get_the_title( $id ) : '';

			$video_thumbnail = get_post_meta( $id, 'rtgodam_media_video_thumbnail', true );

			if ( empty( $video_thumbnail ) ) {
				$video_thumbnail = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
			}

			$delete_bin_svg = sprintf(
				'<img src="%s" alt="%s" width="14" height="14" style="vertical-align:middle;" />',
				esc_url( RTGODAM_URL . 'assets/src/images/delete-video-bin.svg' ),
				esc_attr__( 'Delete Bin Icon', 'godam' )
			);

			// Build variation-picker elements for this video.
			$saved_variation_json = ! empty( $saved_variations[ $id ] )
				? esc_attr( wp_json_encode( $saved_variations[ $id ] ) )
				: '';

			// Build initial variation chips from any already-saved selection.
			$variation_chips_html = '';
			if ( $is_variable && ! empty( $saved_variations[ $id ] ) ) {
				$chips = array();
				foreach ( $saved_variations[ $id ] as $attr_slug => $attr_value ) {
					$attr_label  = wc_attribute_label( $attr_slug );
					$term        = get_term_by( 'slug', $attr_value, $attr_slug );
					$value_label = $term ? $term->name : ucfirst( str_replace( '-', ' ', $attr_value ) );
					$chips[]     = sprintf(
						'<span class="godam-variation-chip">%s: %s</span>',
						esc_html( $attr_label ),
						esc_html( $value_label )
					);
				}
				$variation_chips_html = implode( '', $chips );
			}

			printf(
				'<li>
					<input type="hidden" name="rtgodam_product_video_gallery_ids[]" value="%1$d" data-vid-id="%1$d" />
					<input type="hidden" name="rtgodam_product_video_gallery_urls[]" value="%2$s" />
					<input type="hidden" name="rtgodam_product_video_variations[%1$d]" value="%3$s" class="godam-variation-data" />
					<div class="video-thumb-wrapper">
						<img src="%4$s" alt="%5$s" style="display:block; max-width: 200px; margin-bottom: 10px;" />
						<button type="button" class="godam-remove-video-button components-button godam-button is-compact is-secondary has-icon wc-godam-product-admin" aria-label="%6$s">
							%7$s
						</button>
					</div>
					<div class="godam-product-video-title" title="%8$s">%9$s</div>
					<div class="godam-video-actions-row">
						<button type="button" data-linked-products="%10$s" class="godam-add-product-button components-button godam-button is-compact is-tertiary wc-godam-product-admin" aria-label="%11$s">%12$s</button>
						%13$s
					</div>
					<div class="godam-variation-chips">%14$s</div>
				</li>',
				esc_attr( $id ),                                        // %1$d (used multiple times)
				esc_attr( $sanitised_url ),                             // %2$s
				$saved_variation_json, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped above // %3$s (already esc_attr'd)
				esc_url( $video_thumbnail ),                            // %4$s
				esc_attr__( 'Video thumbnail', 'godam' ),               // %5$s
				esc_attr__( 'Remove video from gallery', 'godam' ),     // %6$s
				wp_kses_post( $delete_bin_svg ),                        // %7$s
				esc_attr( $video_title ),                               // %8$s
				esc_html( $video_title ),                               // %9$s
				esc_attr( $linked_json ),                               // %10$s
				esc_attr( $aria_label ),                                // %11$s
				$label, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped above
				$is_variable ? sprintf(                                 // %13$s — variation picker icon button
					'<button type="button" class="godam-select-variation-button components-button godam-button is-compact is-tertiary has-icon wc-godam-product-admin" aria-label="%1$s" title="%1$s">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
					</button>',
					esc_attr__( 'Select variation', 'godam' )
				) : '',
				$variation_chips_html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_html above
			);
		}

		echo '</ul><div id="button-container" class="godam-center-button godam-margin-top">';
		printf(
			'<button type="button" %1$s class="components-button ml-2 godam-button is-primary godam-margin-bottom-no-top wc-godam-add-video-button wc-godam-product-admin" aria-label="%2$s">',
			disabled( ! $godam_has_valid_api_key, true, false ),
			esc_attr__( 'Add video to gallery', 'godam' )
		);
		echo '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64" fill="none" style="margin-right: 6px; vertical-align: middle;">
				<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="white" />
				<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="white" />
				<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="white" />
			</svg>';
		echo esc_html__( 'Add Product Reels', 'godam' );
		echo '</button></div></div></div>';
	}

	/**
	 * Saves the video gallery when a product is saved.
	 *
	 * Saving approach:
	 * 1. Retrieves and sanitizes video URLs and attachment IDs from POST data
	 * 2. Saves them to product meta
	 * 3. Compares old vs new attachment IDs to determine what changed
	 * 4. Adds product ID meta only to newly added attachments
	 * 5. Removes product ID meta only from removed attachments
	 *
	 * @param int $post_id The ID of the post being saved.
	 */
	public function save_video_gallery( $post_id ) {

		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		if ( ! isset( $_POST['rtgodam_video_gallery_nonce'] ) ) {
			return;
		}
		$nonce = sanitize_text_field( wp_unslash( $_POST['rtgodam_video_gallery_nonce'] ) );
		if ( ! wp_verify_nonce( $nonce, 'rtgodam_save_video_gallery' ) ) {
			return;
		}

		// Step 1: Get and sanitize POST data.
		$urls = isset( $_POST['rtgodam_product_video_gallery_urls'] )
			? array_filter( array_map( 'esc_url_raw', wp_unslash( $_POST['rtgodam_product_video_gallery_urls'] ) ) )
			: array();

		$new_ids = isset( $_POST['rtgodam_product_video_gallery_ids'] )
			? array_filter( array_map( 'intval', $_POST['rtgodam_product_video_gallery_ids'] ) )
			: array();

		$urls    = apply_filters( 'rtgodam_product_gallery_save_video_gallery_urls', $urls, $post_id );
		$new_ids = apply_filters( 'rtgodam_product_gallery_save_video_gallery_ids', $new_ids, $post_id );

		// Step 2: Get OLD attachment IDs before updating (for comparison).
		$old_ids = get_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', true );
		$old_ids = is_array( $old_ids ) ? array_map( 'intval', $old_ids ) : array();

		// Step 3: Save or delete video meta based on whether videos exist.
		if ( empty( $urls ) && empty( $new_ids ) ) {
			// No videos set — clean up meta keys entirely.
			delete_post_meta( $post_id, '_rtgodam_product_video_gallery' );
			delete_post_meta( $post_id, '_rtgodam_product_video_gallery_ids' );
		} else {
			// Videos exist — save/update meta.
			update_post_meta( $post_id, '_rtgodam_product_video_gallery', $urls );
			update_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', $new_ids );
		}

		$parent_meta_key = '_video_parent_product_id';

		// Step 4: Determine which attachments are NEW (added) and which are REMOVED.
		$added_ids   = array_diff( $new_ids, $old_ids );
		$removed_ids = array_diff( $old_ids, $new_ids );

		// Step 5: Add product ID meta to newly added attachments only.
		foreach ( $added_ids as $attachment_id ) {
			$existing = get_post_meta( $attachment_id, $parent_meta_key, false );

			// Avoid duplicate meta entries.
			if ( ! in_array( $post_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $attachment_id, $parent_meta_key, $post_id, false );
			}
		}

		// Step 6: Remove product ID meta from removed attachments only.
		foreach ( $removed_ids as $attachment_id ) {
			delete_post_meta( $attachment_id, $parent_meta_key, $post_id );
		}

		/**
		 * Action hook for developers to save additional meta after video gallery save.
		 *
		 * @param int   $post_id Current product ID.
		 * @param array $urls    Saved video URLs.
		 * @param array $ids     Saved video attachment IDs.
		 */
		do_action( 'rtgodam_product_gallery_after_save_video_gallery', $post_id, $urls, $new_ids );

		// Save per-video preselected variation attributes.
		$raw_variations   = isset( $_POST['rtgodam_product_video_variations'] ) // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce already verified above
			? array_map( 'sanitize_text_field', wp_unslash( $_POST['rtgodam_product_video_variations'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
			: array();
		$clean_variations = array();

		if ( is_array( $raw_variations ) ) {
			foreach ( $raw_variations as $video_id => $json_string ) {
				$video_id_int = absint( $video_id );
				if ( ! $video_id_int ) {
					continue;
				}
				$decoded = json_decode( sanitize_text_field( $json_string ), true );
				if ( ! is_array( $decoded ) || empty( $decoded ) ) {
					continue;
				}
				$sanitized = array();
				foreach ( $decoded as $attr_slug => $attr_value ) {
					$sanitized[ sanitize_key( $attr_slug ) ] = sanitize_text_field( $attr_value );
				}
				if ( ! empty( $sanitized ) ) {
					$clean_variations[ $video_id_int ] = $sanitized;
				}
			}
		}

		if ( ! empty( $clean_variations ) ) {
			update_post_meta( $post_id, '_rtgodam_product_video_variations', $clean_variations );
		} else {
			delete_post_meta( $post_id, '_rtgodam_product_video_variations' );
		}
	}

	/**
	 * Handles the deletion of an attachment and updates related product metadata.
	 *
	 * This function removes the association of a deleted video attachment from all
	 * WooCommerce products that had it in their video gallery. It updates the product
	 * meta to remove the video URLs and IDs, ensuring the integrity of the product's
	 * video gallery. Additionally, it cleans up the parent product reference from the
	 * attachment metadata.
	 *
	 * @param int $attachment_id The ID of the attachment being deleted.
	 */
	public function on_attachment_deleted( $attachment_id ) {
		$parent_meta_key = '_video_parent_product_id';
		$product_ids     = get_post_meta( $attachment_id, $parent_meta_key, false );

		if ( empty( $product_ids ) ) {
			return;
		}

		foreach ( $product_ids as $product_id ) {
			$video_urls = get_post_meta( $product_id, '_rtgodam_product_video_gallery', true ) ?: array();
			$video_ids  = get_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', true ) ?: array();

			// Find index of the deleted attachment.
			$index = array_search( $attachment_id, $video_ids, true );

			if ( false !== $index ) {
				unset( $video_ids[ $index ] );
				unset( $video_urls[ $index ] );

				// Reindex arrays to keep them aligned.
				$video_ids  = array_values( $video_ids );
				$video_urls = array_values( $video_urls );

				// Save updated meta.
				update_post_meta( $product_id, '_rtgodam_product_video_gallery', $video_urls );
				update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', $video_ids );

				/**
				 * Action hook for developers to delete additional meta
				 * when a video attachment is removed from a product.
				 *
				 * @param int $product_id     The product ID.
				 * @param int $attachment_id  The attachment being deleted.
				 */
				do_action( 'rtgodam_product_gallery_after_video_meta_deleted', $product_id, $attachment_id );
			}
		}

		// Clean up parent reference from attachment.
		delete_post_meta( $attachment_id, $parent_meta_key );
	}

	/**
	 * Handle cleanup when a product is deleted.
	 *
	 * Removes the product ID from all attachment meta,
	 * and cleans up video gallery meta.
	 *
	 * @param int $post_id The ID of the post being deleted.
	 */
	public function on_product_deleted( $post_id ) {

		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}

		$parent_meta_key = '_video_parent_product_id';

		// Get attachment IDs directly from product meta (much faster than querying all attachments).
		$attachment_ids = get_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', true );
		$attachment_ids = is_array( $attachment_ids ) ? array_map( 'intval', $attachment_ids ) : array();

		// Remove the product ID from each attachment's parent list.
		foreach ( $attachment_ids as $attachment_id ) {
			// Remove the product ID from the attachment's parent list.
			delete_post_meta( $attachment_id, $parent_meta_key, $post_id );
		}

		// Clean up the product’s own video gallery meta.
		delete_post_meta( $post_id, '_rtgodam_product_video_gallery' );
		delete_post_meta( $post_id, '_rtgodam_product_video_gallery_ids' );

		/**
		 * Hook: rtgodam_product_gallery_product_deleted
		 *
		 * Allows additional cleanup when a product is deleted.
		 *
		 * @param int $post_id Deleted product ID.
		 */
		do_action( 'rtgodam_product_gallery_product_deleted', $post_id );
	}

	/**
	 * Renders a video slider in a single product page.
	 *
	 * The method retrieves the video attachment IDs associated with the current product
	 * from the '_rtgodam_product_video_gallery_ids' meta key. If the array is not empty,
	 * it outputs a Swiper slider with pagination and navigation controls. The slider items
	 * are generated using the [godam_video] shortcode.
	 */
	public function add_video_slider_to_single_product() {

		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		global $post;

		if ( ! apply_filters( 'rtgodam_display_video_slider_to_single_product', true ) ) {
			return '';
		}

		$rtgodam_product_video_gallery_ids = get_post_meta( $post->ID, '_rtgodam_product_video_gallery_ids', true );

		if ( empty( $rtgodam_product_video_gallery_ids ) ) {
			return '';
		}

		$srcsets = array_map(
			function ( $attachment_id ) {
				$transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );

				return array(
					'id'            => $attachment_id,
					'src'           => wp_get_attachment_url( $attachment_id ),
					'is_transcoded' => ! empty( $transcoded_url ),
				);
			},
			$rtgodam_product_video_gallery_ids
		);

		$srcsets_keys = array_keys( $srcsets );

		$carousel_html = array_map(
			function ( $item ) use ( $srcsets ) {
				return sprintf(
					'<div class="swiper-slide">
						<video autoplay loop muted preload="none" playsinline width="%1$s" class="video-js" data-index-id="%2$s"><source src="%3$s" type="video/mp4"/></video>
					</div>',
					esc_attr( '100%' ),
					esc_attr( $item ),
					esc_url( $srcsets[ $item ]['src'] ),
				);
			},
			$srcsets_keys
		);

		$slider_html = $this->generate_video_carousel_mark_up(
			array(
				'carousel_html' => $carousel_html,
			)
		);

		if ( empty( $slider_html ) ) {
			return '';
		}

		// Enqueue WooCommerce Reels specific skin.
		wp_enqueue_style( 'godam-player-reels-skin-css' );

		// Load preselected per-video variation selections for the frontend.
		$video_variations = get_post_meta( $post->ID, '_rtgodam_product_video_variations', true );
		$video_variations = is_array( $video_variations ) ? $video_variations : array();

		$modal_carousel_html = array_map(
			function ( $item ) use ( $srcsets, $post, $video_variations ) {

				$src_id  = $srcsets[ $item ]['id'];
				$product = wc_get_product( $post->ID );

				if ( ! $product instanceof \WC_Product ) {
					return;
				}

				$product_name  = $product->get_name();
				$product_price = $product->get_price_html();
				$product_image = get_the_post_thumbnail(
					$post->ID,
					'woocommerce_thumbnail',
					array( 'class' => 'rtgodam-modal-product-image' )
				);

				$product_type = $product->get_type();
				$in_stock     = $product->is_in_stock() ? 'true' : 'false';

				$grouped_ids      = '';
				$external_url     = '';
				$variations_json  = '';
				$attributes_json  = '';
				$preselected_json = '';

				if ( 'variable' === $product_type ) {

					$available_variations = $product->get_available_variations();

					// Build a compact variations map: [ { id, attributes: { pa_color: 'red', ... } }, ... ].
					$var_map = array();
					foreach ( $available_variations as $variation ) {
						$var_map[] = array(
							'id'         => $variation['variation_id'],
							'attributes' => $variation['attributes'],
							'in_stock'   => $variation['is_in_stock'],
							'price_html' => $variation['price_html'],
						);
					}
					$variations_json = wp_json_encode( $var_map );

					// Build attributes for selector.
					$attr_data = array();
					foreach ( $product->get_variation_attributes() as $attribute_slug => $attribute_values ) {
						$options = array();
						foreach ( $attribute_values as $value ) {
							$term      = get_term_by( 'slug', $value, $attribute_slug );
							$options[] = array(
								'value' => $value,
								'label' => $term ? $term->name : ucfirst( str_replace( '-', ' ', $value ) ),
							);
						}
						$attr_data[] = array(
							'slug'    => $attribute_slug,
							'label'   => wc_attribute_label( $attribute_slug ),
							'options' => $options,
						);
					}
					$attributes_json = wp_json_encode( $attr_data );

					// Pass store-owner preselected attributes (if any) so the frontend can pre-fill.
					$preselected_attrs = isset( $video_variations[ $src_id ] ) ? $video_variations[ $src_id ] : array();
					if ( ! empty( $preselected_attrs ) ) {
						$preselected_json = wp_json_encode( $preselected_attrs );
					}
				} elseif ( 'grouped' === $product_type ) {

					$children = $product->get_children();

					if ( ! empty( $children ) ) {
						$grouped_ids = implode( ',', $children );
					}               
				} elseif ( 'external' === $product_type ) {

					$external_url = $product->get_product_url();
				}

				return sprintf(
					'
					<div class="swiper-slide" data-video-id="%6$s" data-product-id="%7$s" data-video-attached-product-ids="%7$s">
						<div class="rtgodam-modal-video">
							%1$s
						</div>

						<div class="rtgodam-variation-selector-wrapper"></div>

						<div class="rtgodam-modal-product-card"
							data-variations="%14$s"
							data-variation-attributes="%15$s"
							data-preselected-attrs="%16$s"
						>
							<div class="rtgodam-modal-product-left">
								%2$s
								<div class="rtgodam-modal-product-meta">
									<h3>%3$s</h3>
									<span class="price">%4$s</span>
								</div>
							</div>

							<button 
								class="rtgodam-modal-add-to-cart %13$s"
								data-product-id="%5$s"
								data-product-type="%9$s"
								data-grouped-ids="%10$s"
								data-external-url="%11$s"
								data-in-stock="%12$s"
							>
								+
							</button>
						</div>

						%8$s
					</div>
                ',
					do_shortcode( "[godam_video id='{$src_id}' godam_context='godam-woo-product-page-reels' autoplay=true]" ),
					$product_image,
					esc_html( $product_name ),
					$product_price,
					esc_attr( $post->ID ),
					$src_id,
					$post->ID,
					$this->markup_instance->generate_product_page_reel_video_modal_markup( $src_id, $post->ID ),
					esc_attr( $product_type ),
					esc_attr( $grouped_ids ),
					esc_url( $external_url ),
					esc_attr( $in_stock ),
					( ! $product->is_in_stock() ? 'is-out-of-stock' : '' ),
					esc_attr( $variations_json ),
					esc_attr( $attributes_json ),
					esc_attr( $preselected_json )
				);
			},
			$srcsets_keys
		);

		$modal_slider_html = $this->generate_video_carousel_mark_up(
			array(
				'wrapper_class'        => 'rtgodam-product-video-gallery-slider-modal-content-items',
				'wrapper_class_loader' => '',
				'carousel_html'        => $modal_carousel_html,
			)
		);

		$mini_cart_block = do_blocks( '<!-- wp:woocommerce/mini-cart /-->' );

		$slider_html     .= '<div class="rtgodam-product-video-gallery-slider-modal">';
			$slider_html .= '<div class="rtgodam-product-video-gallery-slider-modal-content">' . $modal_slider_html . '</div>';
			// Close button.
			$slider_html .= '<a href="#" class="rtgodam-product-video-gallery-slider-modal-close">&times;</a>';
			// Mini Cart Button.
			$slider_html .= '<div class="rtgodam-product-video-gallery-slider-modal-content--cart-basket">' 
				. ( ! empty( $mini_cart_block ) ? $mini_cart_block : '' ) 
				. '</div>';
			// Fullscreen button.
			$slider_html .= '
				<button type="button" 
					class="rtgodam-product-video-gallery-slider-modal-fullscreen" 
					aria-label="Toggle fullscreen">

					<svg xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round">

						<!-- Top left -->
						<path d="M8 3 H4 Q3 3 3 4 V8" />

						<!-- Top right -->
						<path d="M16 3 H20 Q21 3 21 4 V8" />

						<!-- Bottom left -->
						<path d="M3 16 V20 Q3 21 4 21 H8" />

						<!-- Bottom right -->
						<path d="M21 16 V20 Q21 21 20 21 H16" />

					</svg>
				</button>
			';
		$slider_html     .= '</div>';

		echo apply_filters( 'rtgodam_video_slider_html', $slider_html ); // phpcs:ignore
	}

	/**
	 * Generates the HTML markup for the video carousel slider.
	 *
	 * @param array $args {
	 *     Args for the video carousel slider.
	 *
	 *     @type string $wrapper_class        The class name for the wrapper container. Default is 'rtgodam-product-video-gallery-slider'.
	 *     @type string $wrapper_class_loader The class name for the wrapper container when loading. Default is 'rtgodam-product-video-gallery-slider-loading'.
	 *     @type array  $carousel_html        An array of HTML markup for the carousel items. Default is an empty array.
	 * }
	 *
	 * @return string The HTML markup for the video carousel slider.
	 */
	public function generate_video_carousel_mark_up( $args ) {
		$args = wp_parse_args(
			$args,
			array(
				'wrapper_class'        => 'rtgodam-product-video-gallery-slider',
				'wrapper_class_loader' => 'rtgodam-product-video-gallery-slider-loading',
				'carousel_html'        => array(),
			)
		);

		if ( empty( $args['carousel_html'] ) || ! is_array( $args['carousel_html'] ) ) {
			return '';
		}

		$carousel_html = implode( '', $args['carousel_html'] );

		return sprintf(
			'
			<div class="%1$s %2$s swiper">
				<div class="swiper-wrapper">
					%3$s
				</div>
				<div class="swiper-pagination"></div>
				<div class="swiper-button-next"></div>
				<div class="swiper-button-prev"></div>
			</div>',
			esc_attr( $args['wrapper_class'] ),
			esc_attr( $args['wrapper_class_loader'] ),
			$carousel_html
		);
	}

	/**
	 * Allows SVG tags and attributes in WordPress KSES sanitization for post content.
	 *
	 * This function extends the default set of allowed HTML elements when WordPress
	 * sanitizes content using `wp_kses()` in the `post` context. It merges additional
	 * SVG-specific tags and attributes (provided by `svg_args_on_wp_kses()`) into the
	 * existing allowed elements array, enabling safe usage of inline SVGs in posts.
	 *
	 * @param array  $allowed The current array of allowed HTML tags and attributes.
	 * @param string $context The context in which KSES is applied (e.g., 'post', 'data', 'user').
	 *
	 * @return array The modified array of allowed tags and attributes including SVG support.
	 */
	public function allow_svg_on_wp_kses( $allowed, $context ) {

		if ( 'post' === $context ) {
			$svg_args = $this->utility_instance->svg_args_on_wp_kses();
			$allowed  = array_merge( $allowed, $svg_args );
		}

		return $allowed;
	}
}
