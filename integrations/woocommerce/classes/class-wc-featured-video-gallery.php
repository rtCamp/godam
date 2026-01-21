<?php
/**
 * WooCommerce Featured Video Gallery Integration
 *
 * Handles admin metabox customization, frontend scripts, AJAX handlers,
 * and support for attaching videos in WooCommerce product galleries.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Featured_Video_Gallery
 */
class WC_Featured_Video_Gallery {

	use Singleton;

	const FALLBACK_THUMBNAIL = RTGODAM_URL . 'assets/src/images/cropped-video-thumbnail-default.png';

	/**
	 * Constructor.
	 * Initialize class by hooking into WordPress and WooCommerce actions/filters.
	 */
	public function __construct() {

		// Enqueue Featured Video dedicated scripts.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_frontend_scripts' ) );

		// Hooks to replace the Woocommerce metabox with GoDAM related metabox and its functioning.
		add_action( 'wp_ajax_get_wc_gallery_thumbnail', array( $this, 'handle_get_gallery_thumbnail' ) );
		add_action( 'save_post_product', array( $this, 'save_product_gallery_with_videos' ), 99 );
		add_action( 'add_meta_boxes', array( $this, 'replace_product_gallery_metabox' ), 99 );

		// Hooks to handle AJAX Calls for handing videos in fronted.
		add_action( 'wp_ajax_send_empty_alts', array( $this, 'handle_send_empty_alts' ) );
		add_action( 'wp_ajax_nopriv_send_empty_alts', array( $this, 'handle_send_empty_alts' ) );

		// Enqueue GoDAM Player.
		add_action(
			'wp_enqueue_scripts',
			function () {
				if ( ! is_admin() && is_product() ) {
					wp_enqueue_script( 'godam-player-frontend-script' );
					wp_enqueue_script( 'godam-player-analytics-script' );
					wp_enqueue_style( 'godam-player-frontend-style' );
					wp_enqueue_style( 'godam-player-style' );
				}
			}
		);
	}

	/**
	 * Enqueue admin scripts and localize data on product edit screen.
	 *
	 * Loads a custom JS file to extend the media uploader for handling videos.
	 */
	public function enqueue_admin_scripts() {

		if ( get_post_type() !== 'product' ) {
			return;
		}

		wp_enqueue_script(
			'rtgodam-wc-admin-featured-video-gallery',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/admin/wc-admin-featured-video-gallery.min.js',
			array( 'jquery', 'media-editor', 'media-views', 'wp-i18n' ),
			filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-admin-featured-video-gallery.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-wc-admin-featured-video-gallery',
			'rtGodamSettings',
			array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'godam_admin_featured_video_gallery_nonce' ),
			)
		);

		do_action( 'rtgodam_featured_gallery_after_enqueue_admin_scripts' );
	}

	/**
	 * Register and enqueue necessary frontend styles and scripts.
	 *
	 * Includes player styles, analytics tracking, and gallery functionality.
	 */
	public function register_frontend_scripts() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		wp_enqueue_style(
			'godam-featured-video-style',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-featured-video.css',
			array(),
			filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'css/godam-featured-video.css' )
		);

		wp_register_script(
			'rtgodam-wc-featured-video-gallery',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-featured-video-gallery.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/wc-featured-video-gallery.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-wc-featured-video-gallery',
			'myGalleryAjaxData',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'nonce'    => wp_create_nonce( 'godam_featured_video_gallery_nonce' ),
			)
		);

		wp_enqueue_script( 'rtgodam-wc-featured-video-gallery' );

		do_action( 'rtgodam_featured_gallery_after_register_frontend_scripts' );
	}

	/**
	 * AJAX handler to generate HTML for a single gallery thumbnail.
	 *
	 * Determines whether the attachment is an image or a video and
	 * returns appropriate markup (with thumbnail).
	 *
	 * @return void Outputs JSON success or error response.
	 */
	public function handle_get_gallery_thumbnail() {

		check_ajax_referer( 'godam_admin_featured_video_gallery_nonce', 'nonce' );

		$attachment_id = isset( $_POST['attachment_id'] ) ? absint( $_POST['attachment_id'] ) : 0;

		if ( ! $attachment_id || ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( __( 'Invalid attachment.', 'godam' ) );
		}

		$mime_type = get_post_mime_type( $attachment_id );
		$is_video  = strpos( $mime_type, 'video/' ) === 0;

		$html = apply_filters(
			'rtgodam_featured_gallery_thumbnail_html',
			$this->get_thumbnail_html( $attachment_id, $is_video ),
			$attachment_id,
			$is_video
		);

		wp_send_json_success( $html );
	}

	/**
	 * Generates the HTML for a product gallery thumbnail (image or video).
	 *
	 * This function creates a `<li>` element containing the thumbnail image
	 * for a WooCommerce product gallery. If the attachment is a video,
	 * it retrieves a custom video thumbnail (or a fallback image if not set).
	 * For non-video attachments, it uses the default WordPress attachment image.
	 *
	 * @param int  $attachment_id The ID of the media attachment.
	 * @param bool $is_video      Whether the attachment is a video.
	 *                                - true  → Uses a custom video thumbnail or fallback image.
	 *                                - false → Uses the standard WordPress image thumbnail.
	 *
	 * @return string The generated HTML string for the thumbnail list item.
	 */
	private function get_thumbnail_html( $attachment_id, $is_video ) {

		$html = '<li class="image" data-attachment_id="' . esc_attr( $attachment_id ) . '">';

		if ( $is_video ) {
			$thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
			$src       = esc_url( $thumbnail ?: self::FALLBACK_THUMBNAIL );

			$html .= sprintf(
				'<img src="%1$s" class="attachment-thumbnail size-thumbnail" width="150" height="150" alt="" loading="lazy" decoding="async" srcset="%1$s 150w, %1$s 300w, %1$s 100w" sizes="auto, (max-width: 150px) 100vw, 150px" />',
				$src
			);
		} else {
			$html .= wp_get_attachment_image( $attachment_id, 'thumbnail' );
		}

		$html .= '<ul class="actions"><li><a href="#" class="delete tips" data-tip="' . esc_attr__( 'Delete image', 'godam' ) . '">' . esc_html__( 'Delete', 'godam' ) . '</a></li></ul>';
		$html .= '</li>';

		return $html;
	}

	/**
	 * Saves the product image gallery when the product is saved.
	 *
	 * Handles video IDs alongside image IDs using the existing
	 * `_product_image_gallery` meta key.
	 *
	 * @param int $post_id The current product ID.
	 */
	public function save_product_gallery_with_videos( $post_id ) {

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		$nonce = isset( $_POST['woocommerce_meta_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['woocommerce_meta_nonce'] ) ) : '';

		if ( ! wp_verify_nonce( $nonce, 'woocommerce_save_data' ) ) {
			return;
		}

		if ( isset( $_POST['product_image_gallery'] ) ) {
			$raw_gallery = isset( $_POST['product_image_gallery'] ) ? sanitize_text_field( wp_unslash( $_POST['product_image_gallery'] ) ) : '';
			$gallery_ids = array_filter( array_map( 'absint', explode( ',', $raw_gallery ) ) );
			update_post_meta( $post_id, '_product_image_gallery', implode( ',', $gallery_ids ) );

			do_action( 'rtgodam_featured_gallery_after_save_gallery_ids', $gallery_ids, $post_id );
		}
	}

	/**
	 * Replaces the default WooCommerce gallery metabox with a custom one.
	 *
	 * Adds support for displaying both images and video thumbnails
	 * inside the same interface.
	 */
	public function replace_product_gallery_metabox() {

		remove_meta_box( 'woocommerce-product-images', 'product', 'side' );

		add_meta_box(
			'woocommerce-product-images',
			__( 'Product gallery', 'godam' ),
			array( $this, 'output_product_gallery_metabox' ),
			'product',
			'side',
			'low'
		);
	}

	/**
	 * Outputs the custom gallery metabox content.
	 *
	 * Iterates over saved gallery IDs and renders appropriate
	 * image or video thumbnails.
	 *
	 * @param \WP_Post $post The current product post object.
	 */
	public function output_product_gallery_metabox( $post ) {

		wp_nonce_field( 'woocommerce_save_data', 'woocommerce_meta_nonce' );
		$gallery_ids = get_post_meta( $post->ID, '_product_image_gallery', true );
		$gallery_ids = ! empty( $gallery_ids ) ? explode( ',', $gallery_ids ) : array();

		?>
		<div id="product_images_container">
			<ul class="product_images">

				<?php
				foreach ( $gallery_ids as $attachment_id ) {
					$attachment_id = absint( $attachment_id );
					$mime_type     = get_post_mime_type( $attachment_id );
					$is_video      = strpos( $mime_type, 'video/' ) === 0;

					echo '<li class="image" data-attachment_id="' . esc_attr( $attachment_id ) . '">';

					if ( $is_video ) {
						$thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
						$src       = $thumbnail ?: self::FALLBACK_THUMBNAIL;
						echo '<img src="' . esc_url( $src ) . '" class="attachment-thumbnail size-thumbnail" width="150" height="150" alt="" loading="lazy" decoding="async" srcset="' . esc_url( $src ) . ' 150w, ' . esc_url( $src ) . ' 300w, ' . esc_url( $src ) . ' 100w"
                        sizes="auto, (max-width: 150px) 100vw, 150px" />';
					} else {
						echo wp_get_attachment_image( $attachment_id, 'thumbnail' );
					}

					echo '<ul class="actions">
						<li><a href="#" class="delete tips" data-tip="' . esc_attr__( 'Delete image', 'godam' ) . '">' . esc_html__( 'Delete', 'godam' ) . '</a></li>
					</ul>';
					echo '</li>';
				}
				?>

			</ul>
			<input type="hidden" id="product_image_gallery" name="product_image_gallery" value="<?php echo esc_attr( implode( ',', $gallery_ids ) ); ?>" />
		</div>
		<p class="add_product_images hide-if-no-js" id="godam-featured-gallery">
			<a href="#" data-choose="<?php esc_attr_e( 'Add images and videos to product gallery', 'godam' ); ?>"
				data-update="<?php esc_attr_e( 'Add to gallery', 'godam' ); ?>"
				data-delete="<?php esc_attr_e( 'Delete', 'godam' ); ?>"
				data-text="<?php esc_attr_e( 'Delete', 'godam' ); ?>">
				<?php esc_html_e( 'Add product gallery images and videos', 'godam' ); ?>
			</a>
		</p>
		<?php
	}

	/**
	 * AJAX handler to return missing alt data and video IDs.
	 *
	 * Used to analyze gallery entries that may have incomplete metadata.
	 * Accepts a list of alt-tag hints and attempts to resolve
	 * them to video IDs and their corresponding data.
	 *
	 * @return void Outputs JSON with video IDs, thumbnails, and URLs.
	 */
	public function handle_send_empty_alts() {

		check_ajax_referer( 'godam_featured_video_gallery_nonce', 'nonce' );

		$alts = isset( $_POST['alts'] ) && is_array( $_POST['alts'] )
		? array_map( 'sanitize_text_field', wp_unslash( $_POST['alts'] ) )
		: array();

		// Get current product ID.
		if ( ! isset( $_POST['product_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Product ID missing.', 'godam' ) ) );
		}

		$product_id = absint( $_POST['product_id'] );

		$video_ids        = array();
		$video_thumbnails = array();

		// Get gallery images for current product.
		$gallery     = get_post_meta( $product_id, '_product_image_gallery', true );
		$gallery_ids = $gallery ? explode( ',', $gallery ) : array();

		/**
		 * Parse each alt label to extract its trailing numeric index, convert it to the
		 * zero-based gallery position (index - 2), then:
		 * - Append the corresponding gallery attachment ID to $video_ids (when it exists).
		 * - Append the resolved video thumbnail URL to $video_thumbnails, falling back to
		 *   self::FALLBACK_THUMBNAIL when no custom thumbnail is set.
		 * Sanitizes values via absint() and esc_url().
		 */
		foreach ( $alts as $alt ) {
			// Extract numeric index from alt.
			if ( preg_match( '/\d+$/', $alt, $matches ) ) {
				$index = intval( $matches[0] );

				// Subtract 2 to match array index.
				$zero_indexed = $index - 2;

				if ( isset( $gallery_ids[ $zero_indexed ] ) ) {
					$video_id    = absint( $gallery_ids[ $zero_indexed ] );
					$video_ids[] = $video_id;
				}

				$video_thumbnails[] = esc_url( get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true ) ?: self::FALLBACK_THUMBNAIL );
			}
		}


		wp_send_json_success(
			array(
				'message'     => 'Fetched video IDs successfully',
				'videoIds'    => $video_ids,
				'videoThumbs' => $video_thumbnails,
			)
		);
	}
}