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
				filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-product-video-gallery.min.js' ),
				true
			);

			wp_enqueue_script(
				'rtgodam-wc-add-to-product',
				RTGODAM_URL . 'assets/build/integrations/woocommerce/js/admin/wc-add-to-product.min.js',
				array( 'jquery', 'wp-api-fetch', 'wp-components', 'wp-element', 'godam-player-frontend-script' ),
				filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-add-to-product.min.js' ),
				true
			);

			wp_localize_script(
				'rtgodam-wc-add-to-product',
				'RTGodamVideoGallery',
				array(
					'apiRoot'          => esc_url_raw( rest_url() ),
					'namespace'        => 'godam/v1',
					'productsEP'       => '/wcproducts',
					'linkVideoEP'      => '/link-video',
					'unLinkVideoEP'    => '/unlink-video',
					'timestampEP'      => '/save-product-meta',
					'getTimestampEP'   => '/get-product-meta',
					'videoCountEP'     => '/video-product-count',
					'currentProductId' => get_the_ID(),
					'defaultThumbnail' => RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png',
					'Ptag'             => RTGODAM_WC_MODULE_URL . 'assets/images/product-tag.svg',
					'DeleteIcon'       => RTGODAM_URL . 'assets/src/images/delete-video-bin.svg',
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
			array( 'jquery', 'rtgodam-script', 'rtgodam-swiper-script', 'wp-data', 'wc-blocks-data-store' ),
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
		$title = apply_filters( 'rtgodam_video_gallery_metabox_title', __( 'Video Gallery', 'godam' ) );

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
		$video_urls = get_post_meta( $post->ID, '_rtgodam_product_video_gallery', true );
		$video_urls = is_array( $video_urls ) ? $video_urls : array();

		$tag_icon_svg = sprintf(
			'<img src="%s" alt="%s" width="14" height="14" style="vertical-align:middle; margin-right:4px;" />',
			esc_url( RTGODAM_URL . 'assets/src/images/product-tag.svg' ),
			esc_attr__( 'Tag Icon', 'godam' )
		);

		$ids = get_post_meta( $post->ID, '_rtgodam_product_video_gallery_ids', true ) ?: array();

		echo '<div id="rtgodam-product-video-gallery">';
		wp_nonce_field( 'rtgodam_save_video_gallery', 'rtgodam_video_gallery_nonce' );

		echo '<ul class="godam-product-video-gallery-list godam-margin-top godam-margin-bottom godam-product-video-gallery-list wc-godam-product-admin">';

		echo '<div class="godam-product-admin-video-spinner-overlay" style="display:none;">
				<div class="godam-product-admin-video-spinner">
					<div class="spinner"></div>
				</div>
			</div>';

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
					<button type="button" data-linked-products="%s" class="godam-add-product-button components-button godam-button is-compact is-tertiary wc-godam-product-admin" aria-label="%s">%s</button>
				</li>',
				esc_attr( $id ),
				esc_attr( $id ),
				esc_attr( $sanitised_url ),
				esc_url( $video_thumbnail ),
				esc_attr__( 'Video thumbnail', 'godam' ),
				esc_attr__( 'Remove video from gallery', 'godam' ),
				wp_kses_post( $delete_bin_svg ),
				esc_attr( $video_title ),
				esc_html( $video_title ),
				esc_attr( $linked_json ),
				esc_attr( $aria_label ),
				$label // phpcs:ignore
			);
		}

		echo '</ul><div id="button-container" class="godam-center-button godam-margin-top">';
		printf(
			'<button type="button" class="components-button ml-2 godam-button is-primary godam-margin-bottom-no-top wc-godam-add-video-button wc-godam-product-admin" aria-label="%s">',
			esc_attr__( 'Add video to gallery', 'godam' )
		);
		echo '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64" fill="none" style="margin-right: 6px; vertical-align: middle;">
				<path d="M25.5578 20.0911L8.05587 37.593L3.46397 33.0011C0.818521 30.3556 2.0821 25.8336 5.72228 24.9464L25.5632 20.0964L25.5578 20.0911Z" fill="white" />
				<path d="M47.3773 21.8867L45.5438 29.3875L22.6972 52.2341L11.2605 40.7974L34.1662 17.8916L41.5703 16.0796C45.0706 15.2247 48.2323 18.3863 47.372 21.8813L47.3773 21.8867Z" fill="white" />
				<path d="M43.5059 38.1036L38.6667 57.8907C37.7741 61.5255 33.2521 62.7891 30.6066 60.1436L26.0363 55.5732L43.5059 38.1036Z" fill="white" />
			</svg>';
		echo esc_html__( 'Add Product Videos', 'godam' );
		echo '</button></div></div>';
	}

	/**
	 * Saves the video gallery when a product is saved.
	 *
	 * It checks nonce and capability, then saves video urls and ids as meta in product.
	 * After that, it checks each video attachment and adds the current product ID to the
	 * '_video_parent_product_id' meta if it is not present yet. Then it removes the product
	 * ID from any attachment that is not present in the current gallery.
	 *
	 * @param int $post_id The ID of the post being saved.
	 */
	public function save_video_gallery( $post_id ) {

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

		$ids = isset( $_POST['rtgodam_product_video_gallery_ids'] )
			? array_filter( array_map( 'intval', $_POST['rtgodam_product_video_gallery_ids'] ) )
			: array();

		$urls = apply_filters( 'rtgodam_product_gallery_save_video_gallery_urls', $urls, $post_id );
		$ids  = apply_filters( 'rtgodam_product_gallery_save_video_gallery_ids', $ids, $post_id );

		// Save video urls and id as meta in product.
		update_post_meta( $post_id, '_rtgodam_product_video_gallery', $urls );
		update_post_meta( $post_id, '_rtgodam_product_video_gallery_ids', $ids );

		$parent_meta_key = '_video_parent_product_id';

		// Attach product‑ID meta on each attachment.
		foreach ( $ids as $attachment_id ) {
			$existing = get_post_meta( $attachment_id, $parent_meta_key, false );

			// If the value is not present, create a new meta‑row.
			if ( ! in_array( $post_id, array_map( 'intval', $existing ), true ) ) {
				add_post_meta( $attachment_id, $parent_meta_key, $post_id, false );
			}
		}

		// Remove this product‑ID from any attachment **no longer** in gallery.
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- 'suppress_filters' is set to false; safe per VIP docs
		$prev_ids = get_posts(
			array(
				'post_type'      => 'attachment',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => array( // phpcs:ignore
					array(
						'key'   => $parent_meta_key,
						'value' => $post_id,
					),
				),
			)
		);

		foreach ( $prev_ids as $prev_id ) {
			if ( ! in_array( $prev_id, $ids, true ) ) {
				delete_post_meta( $prev_id, $parent_meta_key, $post_id );
			}
		}

		/**
		 * Action hook for developers to save additional meta after video gallery save.
		 *
		 * @param int   $post_id Current product ID.
		 * @param array $urls    Saved video URLs.
		 * @param array $ids     Saved video attachment IDs.
		 */
		do_action( 'rtgodam_product_gallery_after_save_video_gallery', $post_id, $urls, $ids );
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

		// Get all attachments linked to this product.
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- 'suppress_filters' is set to false; safe per VIP docs
		$attachment_ids = get_posts(
			array(
				'post_type'      => 'attachment',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => array( // phpcs:ignore
					array(
						'key'   => $parent_meta_key,
						'value' => $post_id,
					),
				),
			)
		);

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
						<video autoplay loop muted width="%1$s" class="video-js" data-index-id="%2$s"><source src="%3$s"/></video>
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

		$single_product_modal_summary = apply_filters( 'rtgodam_single_product_modal_summary', $this->rtgodam_single_product_modal_summary() );
		$modal_carousel_html          = array_map(
			function ( $item ) use ( $srcsets, $single_product_modal_summary ) {
				$src_id        = $srcsets[ $item ]['id'];
				$is_transcoded = $srcsets[ $item ]['is_transcoded'] ? 'true' : 'false';

				return sprintf(
					'
					<div class="swiper-slide" data-is-transcoded="%3$s">
						<div class="rtgodam-product-video-gallery-slider-modal-content-left">
							%1$s
						</div>
						<div class="rtgodam-product-video-gallery-slider-modal-content-right">
							%2$s
						</div>
					</div>',
					do_shortcode( "[godam_video id='{$src_id}']" ),
					$single_product_modal_summary,
					esc_attr( $is_transcoded )
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

		$slider_html .= '<div class="rtgodam-product-video-gallery-slider-modal">';
		$slider_html .= '<div class="rtgodam-product-video-gallery-slider-modal-content">' . $modal_slider_html . '</div>';
		$slider_html .= '<a href="#" class="rtgodam-product-video-gallery-slider-modal-close">&times;</a>';
		$slider_html .= '</div>';

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
	 * Output the summary of a single product inside a modal.
	 *
	 * @return string The HTML markup of the summary.
	 */
	public function rtgodam_single_product_modal_summary() {
		ob_start();
		?>
		<div class="rtgodam-product-video-gallery-slider-modal-content--cart-basket">
			<?php
				$mini_cart_block = do_blocks( '<!-- wp:woocommerce/mini-cart /-->' );
				echo ! empty( $mini_cart_block ) ? $mini_cart_block : ''; // phpcs:ignore
			?>
		</div>
		<div class="rtgodam-product-video-gallery-slider-modal-content--images">
			<div class="rtgodam-product-video-gallery-slider-modal-content--images-desktop">
				<?php
				if ( function_exists( 'woocommerce_show_product_images' ) ) {
					woocommerce_show_product_images();
				}
				?>
			</div>
			<div class="rtgodam-product-video-gallery-slider-modal-content--images-mobile">
				<?php $this->display_main_product_image_only(); ?>
			</div>
		</div>
		<div class="rtgodam-mobile-content">
		<?php
		if ( function_exists( 'woocommerce_template_single_title' ) ) {
			woocommerce_template_single_title();
		}
		if ( function_exists( 'woocommerce_template_single_rating' ) ) {
			woocommerce_template_single_rating();
		}
		if ( function_exists( 'woocommerce_template_single_price' ) ) {
			woocommerce_template_single_price();
		}
		if ( function_exists( 'woocommerce_template_single_excerpt' ) ) {
			woocommerce_template_single_excerpt();
		}
		?>
		</div>
		<div class="rtgodam-product-video-gallery-slider-modal-content--cart">
			<div class="rtgodam-product-video-gallery-slider-modal-content--cart-form">
				<?php
				if ( function_exists( 'woocommerce_template_single_add_to_cart' ) ) {
					woocommerce_template_single_add_to_cart();
				}
				?>
			</div>
		</div>

		<?php
		return ob_get_clean();
	}

	/**
	 * Display only the main product image for mobile view.
	 *
	 * @return void
	 */
	public function display_main_product_image_only() {
		global $product;

		if ( ! $product ) {
			return;
		}

		$attachment_ids    = $product->get_gallery_image_ids();
		$post_thumbnail_id = $product->get_image_id();

		if ( $post_thumbnail_id ) {
			$image_url = wp_get_attachment_image_url( $post_thumbnail_id, 'woocommerce_single' );
			$image_alt = get_post_meta( $post_thumbnail_id, '_wp_attachment_image_alt', true );

			// Get image dimensions.
			$image_data   = wp_get_attachment_image_src( $post_thumbnail_id, 'woocommerce_single' );
			$image_width  = $image_data ? $image_data[1] : '';
			$image_height = $image_data ? $image_data[2] : '';

			// Fallback alt text to product title if alt is empty.
			if ( empty( $image_alt ) ) {
				$image_alt = $product->get_name();
			}

			if ( $image_url ) {
				?>
				<div class="rtgodam-product-video-gallery-slider-modal-content--main-image">
					<img src="<?php echo esc_url( $image_url ); ?>"
						alt="<?php echo esc_attr( $image_alt ); ?>"
						<?php if ( $image_width ) : ?>
							width="<?php echo esc_attr( $image_width ); ?>"
						<?php endif; ?>
						<?php if ( $image_height ) : ?>
							height="<?php echo esc_attr( $image_height ); ?>"
						<?php endif; ?>
						class="rtgodam-product-video-gallery-slider-modal-content--main-image-img" />
				</div>
				<?php
			}
		}
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
