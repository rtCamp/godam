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

	/**
	 * Holds the markup instance.
	 *
	 * @var WC_Product_Gallery_Video_Markup
	 */
	private $markup_instance;

	const FALLBACK_THUMBNAIL = RTGODAM_URL . 'assets/src/images/cropped-video-thumbnail-default.png';

	/**
	 * Constructor.
	 * Initialize class by hooking into WordPress and WooCommerce actions/filters.
	 */
	public function __construct() {

		// Initialize Video Markup class.
		$this->markup_instance = WC_Product_Gallery_Video_Markup::get_instance();

		// Enqueue Featured Video dedicated scripts.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_frontend_scripts' ) );

		// Hooks to replace the Woocommerce metabox with GoDAM related metabox and its functioning.
		add_action( 'wp_ajax_get_wc_gallery_thumbnail', array( $this, 'handle_get_gallery_thumbnail' ) );
		add_action( 'save_post_product', array( $this, 'save_product_gallery_with_videos' ), 99 );
		add_action( 'add_meta_boxes', array( $this, 'replace_product_gallery_metabox' ), 99 );

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

		// Add videos on frontend.
		add_filter( 'woocommerce_single_product_image_thumbnail_html', array( $this, 'filter_single_product_image_html' ), 10, 2 );
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
			rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/admin/wc-admin-featured-video-gallery.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-wc-admin-featured-video-gallery',
			'rtGodamSettings',
			array(
				'ajaxurl'        => admin_url( 'admin-ajax.php' ),
				'nonce'          => wp_create_nonce( 'godam_admin_featured_video_gallery_nonce' ),
				'hasValidAPIKey' => rtgodam_is_api_key_valid(),
				'adminUrl'       => admin_url(),
				'pricingUrl'     => RTGODAM_IO_API_BASE . '/pricing?utm_campaign=upgrade&utm_source=plugin&utm_medium=admin-notice&utm_content=godam_woo_featured_video_gallery',
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

		// Enqueue WooCommerce Reels specific skin.
		wp_enqueue_style( 'godam-player-reels-skin-css' );

		wp_enqueue_style(
			'godam-featured-video-style',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-featured-video.css',
			array(),
			rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'css/godam-featured-video.css' )
		);

		wp_register_script(
			'rtgodam-wc-featured-video-gallery',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-featured-video-gallery.min.js',
			array( 'jquery' ),
			rtgodam_wc_get_asset_version( RTGODAM_WC_MODULE_ASSETS_BUILD_PATH . 'js/wc-featured-video-gallery.min.js' ),
			true
		);

		wp_localize_script(
			'rtgodam-wc-featured-video-gallery',
			'myGalleryAjaxData',
			array(
				'ajax_url'       => admin_url( 'admin-ajax.php' ),
				'nonce'          => wp_create_nonce( 'godam_featured_video_gallery_nonce' ),
				'hasValidAPIKey' => rtgodam_is_api_key_valid(),
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

		$mime_type = (string) get_post_mime_type( $attachment_id );
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

		// Check the API key validity.
		$godam_has_valid_api_key = rtgodam_is_api_key_valid();
		?>
		<div id="product_images_container">
			<ul class="product_images">

				<?php
				foreach ( $gallery_ids as $attachment_id ) {
					$attachment_id = absint( $attachment_id );
					$mime_type     = get_post_mime_type( $attachment_id );
					$is_video      = strpos( $mime_type, 'video/' ) === 0;
					$video_attr    = $is_video ? ' data-is-video="1"' : '';

					echo '<li class="image" data-attachment_id="' . esc_attr( $attachment_id ) . '"' . esc_attr( $video_attr ) . '>';

					if ( $is_video ) {
						$thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
						$src       = $thumbnail ?: self::FALLBACK_THUMBNAIL;

						$is_locked = ! $godam_has_valid_api_key;

						echo '<div class="godam-video-thumb-wrapper' . ( $is_locked ? ' godam-locked' : '' ) . '">';
						
						echo '<img src="' . esc_url( $src ) . '" class="attachment-thumbnail size-thumbnail" width="150" height="150" alt="" loading="lazy" decoding="async" srcset="' . esc_url( $src ) . ' 150w, ' . esc_url( $src ) . ' 300w, ' . esc_url( $src ) . ' 100w"
                        sizes="auto, (max-width: 150px) 100vw, 150px" />';

						if ( $is_locked ) {
							echo '<span class="godam-lock-overlay">
									<svg width="26" height="26" viewBox="0 0 24 24" fill="#ab3a6c">
									<path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z"/>
									</svg>
								</span>';
						}

						echo '</div>';
					} else {
						echo wp_get_attachment_image( $attachment_id, 'thumbnail' );
					}

					echo '<ul class="actions">';
					if ( ! ( $is_video && ! $godam_has_valid_api_key ) ) {
						echo '<li><a href="#" class="delete tips" data-tip="' . esc_attr__( 'Delete image', 'godam' ) . '">' . esc_html__( 'Delete', 'godam' ) . '</a></li>';
					}
					echo '</ul>';
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
	 * Filters the WooCommerce single product gallery HTML to support video attachments.
	 *
	 * This function intercepts the default gallery item HTML and replaces it with a
	 * custom structure when the attachment is a video. It ensures that video items
	 * are rendered in a format compatible with WooCommerce's gallery (Flexslider),
	 * while embedding the GoDAM video player via shortcode.
	 *
	 * Key responsibilities:
	 * - Detects whether the given attachment is a video based on MIME type.
	 * - Generates a custom video embed URL for iframe/lightbox usage.
	 * - Retrieves and prepares a thumbnail (or fallback image) for gallery display.
	 * - Extracts `data-thumb-alt` from existing HTML when available, with fallbacks
	 *   to attachment alt text or title.
	 * - Prefixes alt text with `video|{attachment_id}|` to identify video thumbnails
	 *   in frontend scripts.
	 * - Mimics WooCommerce image attributes (`data-thumb`, `data-thumb-srcset`, etc.)
	 *   to maintain compatibility with gallery behavior.
	 * - Injects the `[godam_video]` shortcode for inline video playback.
	 * - Adds custom data attributes (`data-video-id`, `data-video-url`) for JS handling.
	 *
	 * @param string $html          Original HTML markup for the gallery item.
	 * @param int    $attachment_id Attachment ID of the media item.
	 *
	 * @return string Modified HTML for video attachments, or original HTML for images.
	 */
	public function filter_single_product_image_html( $html, $attachment_id ) {

		$mime_type = get_post_mime_type( $attachment_id );
		$is_video  = strpos( $mime_type, 'video/' ) === 0;

		if ( $is_video ) {

			// Url.
			$query_args   = array(
				'godam_page'    => 'video-embed',
				'id'            => $attachment_id,
				'godam_context' => 'godam-video-product-gallery',
				'bg'            => 'f2f2f2', // dark background of video player letter/pillar boxing for better visibility in lightbox, can be customized or made dynamic as needed.
			);
			$cpt_base_url = home_url( '/' );
			$video_url    = add_query_arg( $query_args, $cpt_base_url );

			// Thumbnail.
			$thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
			$thumb_src = $thumbnail ?: self::FALLBACK_THUMBNAIL;

			// Alt.
			// Try extracting from existing HTML.
			preg_match( '/data-thumb-alt="([^"]*)"/', $html, $matches );
			$thumb_alt = $matches[1] ?? '';

			// Fallback if missing.
			if ( empty( $thumb_alt ) ) {
				$thumb_alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
			}

			if ( empty( $thumb_alt ) ) {
				$thumb_alt = get_the_title( $attachment_id );
			}

			$thumb_alt = 'video|' . $attachment_id . '|' . $thumb_alt;

			// Srcset + sizes (fake but required for Woo slider).
			$srcset = sprintf( '%1$s 100w, %1$s 150w, %1$s 300w', esc_url( $thumb_src ) );
			$sizes  = '(max-width: 100px) 100vw, 100px';

			// Full image (Woo expects this even if fake).
			$full_src = esc_url( $thumb_src );

			// Shortcode.
			$shortcode_html = do_shortcode(
				"[godam_video id='{$attachment_id}' muted='true' loop='true' autoplay='true' controls='false' aspect_ratio='responsive' godam_context='godam-featured-video-gallery']"
			);

			return sprintf(
				'<div 
					data-thumb="%1$s"
					data-thumb-alt="%2$s"
					data-thumb-srcset="%3$s"
					data-thumb-sizes="%4$s"
					data-video-id="%7$s"
					data-video-url="%8$s"
					class="woocommerce-product-gallery__image godam-product-gallery-video">

					<a href="%5$s">

						<!-- actual video -->
						<div class="godam-featured-video-wrapper">
							%6$s
						</div>

					</a>

				</div>',
				esc_url( $thumb_src ),
				esc_attr( $thumb_alt ),
				esc_attr( $srcset ),
				esc_attr( $sizes ),
				esc_url( $full_src ),
				$shortcode_html,
				esc_attr( $attachment_id ),
				esc_attr( esc_url( $video_url ) )
			);
		}

		return $html;
	}
}