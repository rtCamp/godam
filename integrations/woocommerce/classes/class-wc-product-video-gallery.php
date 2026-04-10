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
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
		add_action( 'woocommerce_single_product_summary', array( $this, 'add_video_slider_to_single_product' ), 70 );
		add_action( 'delete_attachment', array( $this, 'on_attachment_deleted' ) );
		add_action( 'before_delete_post', array( $this, 'on_product_deleted' ) );
		add_filter( 'get_user_option_meta-box-order_product', array( $this, 'place_below_wc_gallery' ) );

		// Initialize the Utility Helper class.
		$this->utility_instance = WC_Utility::get_instance();

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

			wp_localize_script(
				'rtgodam-wc-product-video-gallery',
				'RTGodamVideoGallery',
				array(
					'defaultThumbnail' => RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png',
					'DeleteIcon'       => RTGODAM_URL . 'assets/src/images/delete-video-bin.svg',
					'hasValidAPIKey'   => rtgodam_is_api_key_valid(),
				)
			);
		}
	}

	/**
	 * Enqueues frontend styles for the product video gallery carousel.
	 *
	 * Only loads on the single product pages.
	 *
	 * @since 1.0.0
	 */
	public function enqueue_frontend_assets() {
		if ( 'product' === get_post_type() && is_singular( 'product' ) ) {
			wp_enqueue_style(
				'rtgodam-product-reels',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-product-reels.css',
				array(),
				rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'css/godam-product-reels.css' )
			);

			wp_enqueue_script(
				'rtgodam-product-reels',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/js/product-reels-carousel.min.js',
				array(),
				rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/product-reels-carousel.min.js' ),
				true
			);
		}
	}

	/**
	 * Add a meta box to the product post type edit screen to house the video gallery.
	 *
	 * @since 1.0.0
	 */
	public function add_video_gallery_metabox() {
		$preview_image_url = RTGODAM_WC_MODULE_URL . 'assets/images/product-reels-preview.webp';

		$help_tip = sprintf(
			'<span class="godam-help-tip">' .
				'<span class="godam-help-tip__icon" role="button" tabindex="0" aria-expanded="false" aria-controls="godam-help-tip-popup--product-reels">?</span>' .
				'<span id="godam-help-tip-popup--product-reels" class="godam-help-tip__popup" role="tooltip" aria-hidden="true">' .
					'<img src="%1$s" alt="%2$s" class="godam-help-tip__preview" />' .
					'<span class="godam-help-tip__text">%3$s</span>' .
				'</span>' .
			'</span>',
			esc_url( $preview_image_url ),
			esc_attr__( 'Product Reels preview', 'godam' ),
			esc_html__( 'Add short video reels to your product pages. Reels appear as a scrollable carousel, helping customers see your products in action.', 'godam' )
		);

		$title = wp_kses_post( 
			apply_filters(
				'rtgodam_video_gallery_metabox_title',
				__( 'Product Reels', 'godam' ) .
				$help_tip .
				' <span class="godam-pro-badge">' . __( 'Pro', 'godam' ) . '</span>'
			) 
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
				</li>',
				esc_url( $dummy_thumb ),
				esc_attr__( 'Sample Video 1 thumbnail', 'godam' ),
				esc_html__( 'Sample Video 1', 'godam' )
			);

			printf(
				'<li class="godam-dummy-card">
					<div class="video-thumb-wrapper">
						<img src="%s" style="display:block; max-width:200px; margin-bottom:10px;" alt="%s" />
					</div>
					<div class="godam-product-video-title">%s</div>
				</li>',
				esc_url( $dummy_thumb ),
				esc_attr__( 'Sample Video 2 thumbnail', 'godam' ),
				esc_html__( 'Sample Video 2', 'godam' )
			);
		}

		foreach ( $video_urls as $index => $url ) {
			$id            = isset( $ids[ $index ] ) ? intval( $ids[ $index ] ) : '';
			$sanitised_url = esc_url( $url );

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

			printf(
				'<li>
					<input type="hidden" name="rtgodam_product_video_gallery_ids[]" value="%d" data-vid-id="%d" />
					<input type="hidden" name="rtgodam_product_video_gallery_urls[]" value="%s" />
					<div class="video-thumb-wrapper">
						<img src="%s" alt="%s" style="display:block; max-width: 200px; margin-bottom: 10px;" />
						<button type="button" class="godam-remove-video-button components-button godam-button is-compact is-secondary has-icon wc-godam-product-admin" aria-label="%s">
							%s
						</button>
					</div>
					<div class="godam-product-video-title" title="%s">%s</div>
				</li>',
				esc_attr( $id ),
				esc_attr( $id ),
				esc_attr( $sanitised_url ),
				esc_url( $video_thumbnail ),
				esc_attr__( 'Video thumbnail', 'godam' ),
				esc_attr__( 'Remove video from gallery', 'godam' ),
				wp_kses_post( $delete_bin_svg ),
				esc_attr( $video_title ),
				esc_html( $video_title )
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
	 * Renders product videos as a horizontal scrollable carousel on a single product page.
	 *
	 * Retrieves the video attachment IDs associated with the current product
	 * from the '_rtgodam_product_video_gallery_ids' meta key and renders each
	 * video using the [godam_video] shortcode with autoplay, muted and loop enabled.
	 * Videos are displayed in a 9:16 aspect ratio carousel layout.
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

		$videos_html  = '<div class="rtgodam-product-video-gallery">';
		$videos_html .= '<div class="rtgodam-product-video-gallery__container">';

		foreach ( $rtgodam_product_video_gallery_ids as $attachment_id ) {
			$videos_html .= '<div class="rtgodam-product-video-gallery__item">';
			$videos_html .= '<div class="godam-gallery-video-wrapper">';
			$videos_html .= do_shortcode( "[godam_video id='{$attachment_id}' autoplay=true muted=true loop=true controls=false aspect_ratio='9:16']" );
			$videos_html .= '</div>';
			$videos_html .= '</div>';
		}

		$videos_html .= '</div>';

		if ( count( $rtgodam_product_video_gallery_ids ) > 1 ) {
			$videos_html .= '<button type="button" class="rtgodam-product-video-gallery__nav rtgodam-product-video-gallery__nav--prev" aria-label="' . esc_attr__( 'Previous', 'godam' ) . '">';
			$videos_html .= '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
			$videos_html .= '</button>';
			$videos_html .= '<button type="button" class="rtgodam-product-video-gallery__nav rtgodam-product-video-gallery__nav--next" aria-label="' . esc_attr__( 'Next', 'godam' ) . '">';
			$videos_html .= '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
			$videos_html .= '</button>';
		}

		$videos_html .= '</div>';

		echo apply_filters( 'rtgodam_video_slider_html', $videos_html ); // phpcs:ignore
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
