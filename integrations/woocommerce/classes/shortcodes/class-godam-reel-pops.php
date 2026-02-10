<?php
/**
 * GoDAM Reel Pops Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WooCommerce;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Reel_Pops.
 *
 * Handles [godam_video_reel_pops] shortcode functionality.
 */
class GoDAM_Reel_Pops {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_video_reel_pops', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );
	}

	/**
	 * Register scripts and styles for reel pops.
	 */
	public function register_scripts() {
		// Register frontend CSS (compiled from style.scss).
		if ( ! wp_style_is( 'godam-reel-pops-frontend-style', 'registered' ) ) {
			wp_register_style(
				'godam-reel-pops-frontend-style',
				RTGODAM_URL . 'integrations/woocommerce/blocks/godam-reel-pops/style.css',
				array(),
				RTGODAM_VERSION
			);
		}

		// Register view.js for frontend interactions.
		$view_asset_path = RTGODAM_PATH . 'assets/build/integrations/woocommerce/blocks/godam-reel-pops/view.asset.php';
		$view_asset      = file_exists( $view_asset_path )
			? include $view_asset_path
			: array(
				'dependencies' => array(),
				'version'      => RTGODAM_VERSION,
			);

		// Add godam-product-gallery-script as a dependency to ensure GODAMPlayer is available.
		$view_dependencies = array_merge(
			$view_asset['dependencies'],
			array( 'godam-product-gallery-script' )
		);

		wp_register_script(
			'godam-reel-pops-view-script',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/blocks/godam-reel-pops/view.js',
			$view_dependencies,
			$view_asset['version'],
			true
		);
	}

	/**
	 * Render the reel pops shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the reel pops.
	 */
	public function render( $atts ) {
		// Parse shortcode attributes.
		$attributes = shortcode_atts(
			array(
				'video_ids'         => '',
				'product_ids'       => '', // Comma-separated product IDs per video (use | to separate videos: "123,456|789|101,102").
				'aspect_ratio'      => '9-16',
				'position'          => 'bottom-right',
				'animation'         => 'slide-up',
				'animation_duration' => 500,
				'duration_seconds'  => 5,
				'initial_delay'     => 3,
				'close_persistence' => 'show_again',
				'enable_autoplay'   => true,
				'popup_width'       => 120,
				'bottom_spacing'    => 20,
				'side_spacing'      => 20,
				'block_id'          => '',
			),
			$atts,
			'godam_video_reel_pops'
		);

		// Handle boolean attributes.
		$attributes['enable_autoplay'] = filter_var( $attributes['enable_autoplay'], FILTER_VALIDATE_BOOLEAN );

		// Parse video IDs.
		if ( empty( $attributes['video_ids'] ) ) {
			return '';
		}

		$video_ids = array_filter( array_map( 'trim', explode( ',', $attributes['video_ids'] ) ) );
		if ( empty( $video_ids ) ) {
			return '';
		}

		// Parse product IDs (format: "123,456|789|101,102" means video1 has products 123,456, video2 has 789, etc).
		$product_ids_per_video = array();
		if ( ! empty( $attributes['product_ids'] ) ) {
			$product_ids_groups = explode( '|', $attributes['product_ids'] );
			foreach ( $product_ids_groups as $index => $group ) {
				$product_ids_per_video[ $index ] = trim( $group );
			}
		}

		// Enqueue modal assets.
		if ( class_exists( 'RTGODAM\Inc\Shortcodes\GoDAM_Product_Gallery' ) ) {
			$gallery_shortcode = \RTGODAM\Inc\Shortcodes\GoDAM_Product_Gallery::get_instance();
			if ( method_exists( $gallery_shortcode, 'register_scripts' ) ) {
				$gallery_shortcode->register_scripts();
			}
		}
		wp_enqueue_style( 'godam-product-gallery-style' );
		wp_enqueue_style( 'godam-player-reels-skin-css' );
		wp_enqueue_script( 'godam-product-gallery-script' );

		// Enqueue required assets.
		wp_enqueue_style( 'godam-reel-pops-frontend-style' );
		wp_enqueue_script( 'godam-reel-pops-view-script' );

		// Generate unique instance ID.
		$instance_id = ! empty( $attributes['block_id'] )
			? sanitize_html_class( $attributes['block_id'] )
			: 'godam-reel-pops-' . wp_unique_id();

		// Prepare videos array for rendering.
		$videos = array();
		foreach ( $video_ids as $index => $video_id ) {
			$video_id = absint( $video_id );
			if ( ! $video_id ) {
				continue;
			}

			// Get video HTML from shortcode (server-side rendering).
			$video_html = $this->get_video_html( $video_id, $attributes );
			if ( empty( $video_html ) ) {
				continue;
			}

			$product_ids = isset( $product_ids_per_video[ $index ] ) ? $product_ids_per_video[ $index ] : '';

			$videos[] = array(
				'videoId'    => $video_id,
				'productIds' => $product_ids,
				'html'       => $video_html,
			);
		}

		if ( empty( $videos ) ) {
			return '';
		}

		// Prepare config for frontend JS (without HTML to avoid JSON breaking).
		$videos_config = array();
		foreach ( $videos as $video ) {
			$videos_config[] = array(
				'videoId'    => $video['videoId'],
				'productIds' => $video['productIds'],
			);
		}

		$config_data = array(
			'blockId'           => $instance_id,
			'videos'            => $videos_config,
			'aspectRatio'       => sanitize_text_field( $attributes['aspect_ratio'] ),
			'position'          => sanitize_text_field( $attributes['position'] ),
			'animation'         => sanitize_text_field( $attributes['animation'] ),
			'animationDuration' => absint( $attributes['animation_duration'] ),
			'durationSeconds'   => max( 1, absint( $attributes['duration_seconds'] ) ),
			'initialDelay'      => max( 0, absint( $attributes['initial_delay'] ) ),
			'closePersistence'  => sanitize_text_field( $attributes['close_persistence'] ),
			'enableAutoplay'    => (bool) $attributes['enable_autoplay'],
			'popupWidth'        => absint( $attributes['popup_width'] ),
			'bottomSpacing'     => absint( $attributes['bottom_spacing'] ),
			'sideSpacing'       => absint( $attributes['side_spacing'] ),
		);

		// CSS custom properties for dynamic styling - no inline style tag needed.
		$aspect_class = 'aspect-' . sanitize_html_class( $attributes['aspect_ratio'] );

		// Build CSS variables inline style.
		$css_variables = sprintf(
			'--reel-pops-width: %dpx; --reel-pops-position: %dpx; --reel-pops-bottom: %dpx; --reel-pops-animation-duration: %dms;',
			absint( $attributes['popup_width'] ),
			absint( $attributes['side_spacing'] ),
			absint( $attributes['bottom_spacing'] ),
			absint( $attributes['animation_duration'] )
		);

		// Start output buffering.
		ob_start();
		?>
		<div
			id="<?php echo esc_attr( $instance_id ); ?>"
			class="godam-product-gallery godam-reel-pops-wrapper"
			data-gallery-id="<?php echo esc_attr( $instance_id ); ?>"
			data-reel-pops-config="<?php echo esc_attr( wp_json_encode( $config_data ) ); ?>"
			style="<?php echo esc_attr( $css_variables ); ?>"
		>
			<!-- Floating Reel Popup Container -->
			<div class="godam-reel-pops-container <?php echo esc_attr( $aspect_class ); ?> <?php echo esc_attr( 'position-' . $attributes['position'] ); ?> <?php echo esc_attr( 'animation-' . $attributes['animation'] ); ?>">
				<!-- Close Button -->
				<button class="godam-reel-pops-close" aria-label="<?php esc_attr_e( 'Close reel popup', 'godam' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>

				<!-- Video Slots (pre-rendered) -->
				<div class="godam-reel-pops-video-slots">
					<?php foreach ( $videos as $video ) : ?>
						<div class="godam-reel-pops-video-slot" data-video-id="<?php echo esc_attr( $video['videoId'] ); ?>">
							<div class="godam-reel-pops-video-wrapper">
								<?php echo $video['html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
								<?php
								// Create clickable overlay for modal trigger (without play button).
								if ( ! empty( $video['productIds'] ) ) :
									$modal_id = 'godam-video-modal-' . $instance_id . '-' . $video['videoId'];
									?>
									<div class="godam-reel-pops-click-overlay" data-modal-id="<?php echo esc_attr( $modal_id ); ?>"></div>
								<?php endif; ?>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			</div>

			<?php
			// Render modal markup for each video.
			if ( class_exists( 'RTGODAM\Inc\WooCommerce\WC_Product_Gallery_Video_Markup' ) ) {
				$modal_markup_generator = \RTGODAM\Inc\WooCommerce\WC_Product_Gallery_Video_Markup::get_instance();

				foreach ( $videos as $video ) {
					$video_id    = absint( $video['videoId'] );
					$product_ids = ! empty( $video['productIds'] ) ? sanitize_text_field( $video['productIds'] ) : '';

					if ( empty( $product_ids ) ) {
						continue;
					}

					$cta_enabled          = true;
					$cta_display_position = 'inside';

					if ( method_exists( $modal_markup_generator, 'generate_product_gallery_video_modal_markup' ) ) {
						$modal_markup_generator->generate_product_gallery_video_modal_markup(
							$cta_enabled,
							$cta_display_position,
							$video_id,
							$product_ids,
							$instance_id,
							false
						);
					}
				}
			}
			?>
		</div>
		<?php

		return ob_get_clean();
	}

	/**
	 * Get simple video HTML without metadata (optimized for floating popup).
	 *
	 * @param int   $video_id Video attachment ID.
	 * @param array $attributes Shortcode attributes.
	 * @return string Video HTML.
	 */
	private function get_video_html( $video_id, $attributes ) {
		// Get video attachment details.
		$attachment = get_post( $video_id );
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return '';
		}

		// Get video URLs.
		$transcoded_url     = strval( rtgodam_get_transcoded_url_from_attachment( $video_id ) );
		$hls_transcoded_url = strval( rtgodam_get_hls_transcoded_url_from_attachment( $video_id ) );
		$video_src          = strval( wp_get_attachment_url( $video_id ) );
		$video_src_type     = strval( get_post_mime_type( $video_id ) );
		$poster_url         = strval( get_the_post_thumbnail_url( $video_id, 'large' ) );

		// Generate unique video ID.
		$unique_id = 'godam-reel-video-' . $video_id . '-' . wp_unique_id();

		// Build simple Video.js player without metadata.
		ob_start();
		?>
		<div class="easydam-video-container">
			<video
				id="<?php echo esc_attr( $unique_id ); ?>"
				class="video-js vjs-big-play-centered vjs-fluid"
				preload="auto"
				<?php echo $attributes['enable_autoplay'] ? 'autoplay' : ''; ?>
				muted
				loop
				playsinline
				<?php if ( ! empty( $poster_url ) ) : ?>
					poster="<?php echo esc_url( $poster_url ); ?>"
				<?php endif; ?>
			>
				<?php if ( ! empty( $hls_transcoded_url ) ) : ?>
					<source src="<?php echo esc_url( $hls_transcoded_url ); ?>" type="application/x-mpegURL">
				<?php endif; ?>
				<?php if ( ! empty( $transcoded_url ) ) : ?>
					<source src="<?php echo esc_url( $transcoded_url ); ?>" type="application/dash+xml">
				<?php endif; ?>
				<source src="<?php echo esc_url( $video_src ); ?>" type="<?php echo esc_attr( 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type ); ?>">
			</video>
		</div>
		<script>
			(function() {
				if (typeof videojs !== 'undefined') {
					var player = videojs('<?php echo esc_js( $unique_id ); ?>', {
						controls: false,
						autoplay: <?php echo $attributes['enable_autoplay'] ? 'true' : 'false'; ?>,
						muted: true,
						loop: true,
						fluid: true,
						responsive: true,
						fill: true
					});
				}
			})();
			</script>
		<?php
		return ob_get_clean();
	}
}
