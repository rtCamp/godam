<?php
/**
 * WC_Product_Video_Gallery class.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo\Classes;

defined( 'ABSPATH' ) || exit;

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

		$this->utility_instance = WC_Utility::get_instance();

		add_filter( 'wp_kses_allowed_html', array( $this, 'allow_svg_on_wp_kses' ), 10, 2 );
	}

	/**
	 * Enqueue admin assets for the product video gallery.
	 */
	public function enqueue_admin_assets() {
		if ( get_post_type() === 'product' ) {
			wp_enqueue_media();

			wp_enqueue_script(
				'godam-woo-product-video-gallery',
				GODAM_WOO_URL . 'assets/build/js/admin/wc-product-video-gallery.min.js',
				array( 'jquery' ),
				godam_woo_get_asset_version( GODAM_WOO_ASSETS_BUILD_PATH . 'js/admin/wc-product-video-gallery.min.js' ),
				true
			);

			wp_localize_script(
				'godam-woo-product-video-gallery',
				'RTGodamVideoGallery',
				array(
					'defaultThumbnail' => RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png',
					'DeleteIcon'       => RTGODAM_URL . 'assets/src/images/delete-video-bin.svg',
					'hasValidAPIKey'   => rtgodam_is_api_key_valid(),
					'maxVideos'        => 5,
				)
			);
		}
	}

	/**
	 * Enqueue frontend assets.
	 */
	public function enqueue_frontend_assets() {
		if ( 'product' === get_post_type() && is_singular( 'product' ) ) {
			wp_enqueue_style(
				'godam-woo-product-reels',
				GODAM_WOO_URL . 'assets/build/css/godam-product-reels.css',
				array(),
				godam_woo_get_asset_version( GODAM_WOO_ASSETS_BUILD_PATH . 'css/godam-product-reels.css' )
			);

			wp_enqueue_script(
				'godam-woo-product-reels',
				GODAM_WOO_URL . 'assets/build/js/product-reels-carousel.min.js',
				array(),
				godam_woo_get_asset_version( GODAM_WOO_ASSETS_BUILD_PATH . 'js/product-reels-carousel.min.js' ),
				true
			);
		}
	}

	/**
	 * Add a meta box for the video gallery.
	 */
	public function add_video_gallery_metabox() {
		$preview_image_url = GODAM_WOO_URL . 'assets/images/product-reels-preview.webp';

		$help_tip = sprintf(
			'<span class="godam-help-tip">' .
				'<span class="godam-help-tip__icon" role="button" tabindex="0" aria-expanded="false" aria-controls="godam-help-tip-popup--product-reels">?</span>' .
				'<span id="godam-help-tip-popup--product-reels" class="godam-help-tip__popup" role="tooltip" aria-hidden="true">' .
					'<img src="%1$s" alt="%2$s" class="godam-help-tip__preview" />' .
					'<span class="godam-help-tip__text">%3$s</span>' .
				'</span>' .
			'</span>',
			esc_url( $preview_image_url ),
			esc_attr__( 'Product Reels preview', 'godam-woo' ),
			esc_html__( 'Add short video reels to your product pages. Reels appear as a scrollable carousel, helping customers see your products in action.', 'godam-woo' )
		);

		$title = wp_kses_post(
			apply_filters(
				'rtgodam_video_gallery_metabox_title',
				__( 'Product Reels', 'godam-woo' ) .
				$help_tip .
				' <span class="godam-pro-badge">' . __( 'Pro', 'godam-woo' ) . '</span>'
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
	 * Place below WC gallery.
	 *
	 * @param array $order Meta box order.
	 * @return array
	 */
	public function place_below_wc_gallery( $order ) {
		if ( empty( $order['side'] ) ) {
			return $order;
		}

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
	 * Render the video gallery metabox.
	 *
	 * @param \WP_Post $post Current post.
	 */
	public function render_video_gallery_metabox( $post ) {
		$godam_has_valid_api_key = rtgodam_is_api_key_valid();

		$video_urls = get_post_meta( $post->ID, '_rtgodam_product_video_gallery', true );
		$video_urls = is_array( $video_urls ) ? $video_urls : array();

		$ids = get_post_meta( $post->ID, '_rtgodam_product_video_gallery_ids', true ) ?: array();

		echo '<div id="rtgodam-product-video-gallery">';

		if ( ! $godam_has_valid_api_key ) {
			$video_editor_settings_url = admin_url( 'admin.php?page=rtgodam_settings#video-settings' );

			echo '<div class="notice notice-warning inline"><p>';
			echo '<strong>' . esc_html__( 'Product Reels is a Pro feature.', 'godam-woo' ) . '</strong> ';
			echo '<a href="' . esc_url( $video_editor_settings_url ) . '" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C] no-underline">';
			echo esc_html__( 'Activate your license', 'godam-woo' );
			echo '</a>';
			echo esc_html__( ' or ', 'godam-woo' );
			echo '<a href="' . esc_url( RTGODAM_IO_API_BASE . '/pricing?utm_campaign=upgrade&utm_source=plugin&utm_medium=admin-notice&utm_content=godam_woo_product_reels' ) . '" target="_blank" rel="noopener noreferrer" class="text-[#AB3A6C]">';
			echo esc_html__( 'get started for free↗', 'godam-woo' );
			echo '</a> ';
			echo esc_html__( 'to unlock all features.', 'godam-woo' );
			echo '</p></div>';
		}

		wp_nonce_field( 'rtgodam_save_video_gallery', 'rtgodam_video_gallery_nonce' );

		echo '<div class="' . ( ! $godam_has_valid_api_key ? 'godam-disabled-ui' : '' ) . '">';
		echo '<ul class="godam-product-video-gallery-list godam-product-video-gallery-list wc-godam-product-admin">';
		echo '<div class="godam-product-admin-video-spinner-overlay" style="display:none;">
				<div class="godam-product-admin-video-spinner">
					<div class="spinner"></div>
				</div>
			</div>';

		if ( ! $godam_has_valid_api_key && empty( $video_urls ) ) {
			$dummy_thumb = RTGODAM_URL . 'assets/src/images/dummy-reel-thumb.png';

			for ( $i = 1; $i <= 2; $i++ ) {
				printf(
					'<li class="godam-dummy-card">
						<div class="video-thumb-wrapper">
							<img src="%s" style="display:block; max-width:200px; margin-bottom:10px;" alt="%s" />
						</div>
						<div class="godam-product-video-title">%s</div>
					</li>',
					esc_url( $dummy_thumb ),
					/* translators: %d: sample video number */
					esc_attr( sprintf( __( 'Sample Video %d thumbnail', 'godam-woo' ), $i ) ),
					/* translators: %d: sample video number */
					esc_html( sprintf( __( 'Sample Video %d', 'godam-woo' ), $i ) )
				);
			}
		}

		foreach ( $video_urls as $index => $url ) {
			$id              = isset( $ids[ $index ] ) ? intval( $ids[ $index ] ) : '';
			$sanitised_url   = esc_url( $url );
			$video_title     = $id ? get_the_title( $id ) : '';
			$video_thumbnail = get_post_meta( $id, 'rtgodam_media_video_thumbnail', true );

			if ( empty( $video_thumbnail ) ) {
				$video_thumbnail = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
			}

			$delete_bin_svg = sprintf(
				'<img src="%s" alt="%s" width="14" height="14" style="vertical-align:middle;" />',
				esc_url( RTGODAM_URL . 'assets/src/images/delete-video-bin.svg' ),
				esc_attr__( 'Delete Bin Icon', 'godam-woo' )
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
				esc_attr__( 'Video thumbnail', 'godam-woo' ),
				esc_attr__( 'Remove video from gallery', 'godam-woo' ),
				wp_kses_post( $delete_bin_svg ),
				esc_attr( $video_title ),
				esc_html( $video_title )
			);
		}

		echo '</ul><div id="button-container" class="godam-center-button godam-margin-top">';
		printf(
			'<button type="button" %1$s class="components-button ml-2 godam-button is-primary godam-margin-bottom-no-top wc-godam-add-video-button wc-godam-product-admin" aria-label="%2$s">',
			disabled( ! $godam_has_valid_api_key, true, false ),
			esc_attr__( 'Add video to gallery', 'godam-woo' )
		);
		echo '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64" fill="none" style="margin-right: 6px; vertical-align: middle;">
				<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="white" />
				<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="white" />
				<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="white" />
			</svg>';
		echo esc_html__( 'Add Product Reels', 'godam-woo' );
		echo '</button></div></div></div>';
	}

	/**
	 * Save video gallery on product save.
	 *
	 * @param int $post_id Post ID.
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

		$urls = isset( $_POST['rtgodam_product_video_gallery_urls'] )
			? array_filter( array_map( 'esc_url_raw', wp_unslash( $_POST['rtgodam_product_video_gallery_urls'] ) ) )
			: array();

		$new_ids = isset( $_POST['rtgodam_product_video_gallery_ids'] )
			? array_filter( array_map( 'intval', $_POST['rtgodam_product_video_gallery_ids'] ) )
			: array();

		$urls    = apply_filters( 'rtgodam_product_gallery_save_video_gallery_urls', $urls, $post_id );
		$new_ids = apply_filters( 'rtgodam_product_gallery_save_video_gallery_ids', $new_ids, $post_id );

		$max_videos = 5;
		$urls       = array_slice( $urls, 0, $max_videos );
		$new_ids    = array_slice( $new_ids, 0, $max_videos );

		$old_ids = get_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', true );
		$old_ids = is_array( $old_ids ) ? array_map( 'intval', $old_ids ) : array();

		if ( empty( $urls ) && empty( $new_ids ) ) {
			delete_post_meta( $post_id, '_rtgodam_product_video_gallery' );
			delete_post_meta( $post_id, '_rtgodam_product_video_gallery_ids' );
		} else {
			update_post_meta( $post_id, '_rtgodam_product_video_gallery', $urls );
			update_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', $new_ids );
		}

		$parent_meta_key = '_video_parent_product_id';
		$added_ids       = array_diff( $new_ids, $old_ids );
		$removed_ids     = array_diff( $old_ids, $new_ids );

		foreach ( $added_ids as $attachment_id ) {
			$existing = get_post_meta( $attachment_id, $parent_meta_key, false );
			if ( ! in_array( $post_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $attachment_id, $parent_meta_key, $post_id, false );
			}
		}

		foreach ( $removed_ids as $attachment_id ) {
			delete_post_meta( $attachment_id, $parent_meta_key, $post_id );
		}

		do_action( 'rtgodam_product_gallery_after_save_video_gallery', $post_id, $urls, $new_ids );
	}

	/**
	 * Handle attachment deletion.
	 *
	 * @param int $attachment_id Attachment ID.
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

			$index = array_search( $attachment_id, $video_ids, true );

			if ( false !== $index ) {
				unset( $video_ids[ $index ] );
				unset( $video_urls[ $index ] );

				update_post_meta( $product_id, '_rtgodam_product_video_gallery', array_values( $video_urls ) );
				update_post_meta( $product_id, '_rtgodam_product_video_gallery_ids', array_values( $video_ids ) );

				do_action( 'rtgodam_product_gallery_after_video_meta_deleted', $product_id, $attachment_id );
			}
		}

		delete_post_meta( $attachment_id, $parent_meta_key );
	}

	/**
	 * Handle product deletion.
	 *
	 * @param int $post_id Post ID.
	 */
	public function on_product_deleted( $post_id ) {
		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}

		$parent_meta_key = '_video_parent_product_id';
		$attachment_ids  = get_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', true );
		$attachment_ids  = is_array( $attachment_ids ) ? array_map( 'intval', $attachment_ids ) : array();

		foreach ( $attachment_ids as $attachment_id ) {
			delete_post_meta( $attachment_id, $parent_meta_key, $post_id );
		}

		delete_post_meta( $post_id, '_rtgodam_product_video_gallery' );
		delete_post_meta( $post_id, '_rtgodam_product_video_gallery_ids' );

		do_action( 'rtgodam_product_gallery_product_deleted', $post_id );
	}

	/**
	 * Render product video slider on single product page.
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
		$rtgodam_product_video_gallery_ids = is_array( $rtgodam_product_video_gallery_ids )
			? array_filter( array_map( 'absint', $rtgodam_product_video_gallery_ids ) )
			: array();

		if ( empty( $rtgodam_product_video_gallery_ids ) ) {
			return '';
		}

		$videos_html  = '<div class="rtgodam-product-video-gallery">';
		$videos_html .= '<div class="rtgodam-product-video-gallery__container">';

		$is_first_video = true;

		foreach ( $rtgodam_product_video_gallery_ids as $attachment_id ) {
			$autoplay     = $is_first_video ? 'true' : 'false';
			$videos_html .= '<div class="rtgodam-product-video-gallery__item">';
			$videos_html .= '<div class="godam-gallery-video-wrapper">';
			$videos_html .= do_shortcode( "[godam_video id='{$attachment_id}' autoplay={$autoplay} muted=true loop=false controls=true aspect_ratio='9:16' godam_context='godam-woo-product-page-reels']" );
			$videos_html .= '</div></div>';

			$is_first_video = false;
		}

		$videos_html .= '</div>';

		if ( count( $rtgodam_product_video_gallery_ids ) > 1 ) {
			$videos_html .= '<button type="button" class="rtgodam-product-video-gallery__nav rtgodam-product-video-gallery__nav--prev" aria-label="' . esc_attr__( 'Previous', 'godam-woo' ) . '">';
			$videos_html .= '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
			$videos_html .= '</button>';
			$videos_html .= '<button type="button" class="rtgodam-product-video-gallery__nav rtgodam-product-video-gallery__nav--next" aria-label="' . esc_attr__( 'Next', 'godam-woo' ) . '">';
			$videos_html .= '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
			$videos_html .= '</button>';
		}

		$videos_html .= '</div>';

		echo apply_filters( 'rtgodam_video_slider_html', $videos_html ); // phpcs:ignore
	}

	/**
	 * Allow SVG tags in wp_kses.
	 *
	 * @param array  $allowed Allowed HTML.
	 * @param string $context Context.
	 * @return array
	 */
	public function allow_svg_on_wp_kses( $allowed, $context ) {
		if ( 'post' === $context ) {
			$svg_args = $this->utility_instance->svg_args_on_wp_kses();
			$allowed  = array_merge( $allowed, $svg_args );
		}

		return $allowed;
	}
}
