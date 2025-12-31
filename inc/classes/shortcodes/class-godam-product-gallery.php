<?php
/**
 * GoDAM Product Gallery Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\WooCommerce\WC_Product_Gallery_Video_Markup;
use RTGODAM\Inc\WooCommerce\WC_Utility;

/**
 * Class GoDAM_Product_Gallery.
 *
 * Handles [godam_product_gallery] shortcode.
 */
class GoDAM_Product_Gallery {

	use Singleton;

	/**
	 * Holds the markup instance.
	 *
	 * @var WC_Product_Gallery_Video_Markup
	 */
	private $markup_instance;

	/**
	 * Holds the utility instance.
	 *
	 * @var WC_Utility
	 */
	private $utility_instance;

	/**
	 * Constructor.
	 */
	final protected function __construct() {

		// Initialize Video Markup class.
		$this->markup_instance = WC_Product_Gallery_Video_Markup::get_instance();

		// Initialize the Utility Helper class.
		$this->utility_instance = WC_Utility::get_instance();

		// Add shortcode.
		add_shortcode( 'godam_product_gallery', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );

		add_action( 'wp_ajax_godam_get_product_html', array( $this, 'godam_get_product_html_callback' ) );
		add_action( 'wp_ajax_nopriv_godam_get_product_html', array( $this, 'godam_get_product_html_callback' ) );
	}

	/**
	 * Register gallery-specific scripts and styles.
	 */
	public function register_scripts() {
		wp_register_style(
			'godam-product-gallery-style',
			RTGODAM_URL . 'assets/build/css/godam-product-gallery.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-product-gallery.css' )
		);

		$godam_product_gallery_script_assets = include RTGODAM_PATH . 'assets/build/js/godam-product-gallery.min.asset.php';

		wp_register_script(
			'godam-product-gallery-script',
			RTGODAM_URL . 'assets/build/js/godam-product-gallery.min.js',
			$godam_product_gallery_script_assets['dependencies'],
			$godam_product_gallery_script_assets['version'],
			true
		);
		
		wp_localize_script(
			'godam-product-gallery-script',
			'godamVars',
			array(
				'namespaceRoot'        => '/godam/v1',
				'videoShortcodeEP'     => '/video-shortcode',
				'productByIdsEP'       => '/wcproducts-by-ids',
				'addToCartAjax'        => 'wc/store/cart',
				'ajaxUrl'              => admin_url( 'admin-ajax.php' ),
				'getProductHtmlAction' => 'godam_get_product_html',
				'productGalleryNonce'  => wp_create_nonce( 'godam_get_product_html' ),
				'api_nonce'            => wp_create_nonce( 'wc_store_api' ),
			) 
		);
	}

	/**
	 * Appends inline CSS styles for the product modal based on passed attributes.
	 *
	 * @param array $atts Associative array of CSS attribute values.
	 */
	public function define_css_for_modal( $atts ) {
		$bg_color      = $atts['cta_bg_color'];
		$icon_bg_color = $atts['cta_button_bg_color'];
		$icon_color    = $atts['cta_button_icon_color'];
		$radius        = $atts['cta_button_border_radius'];
		$price_color   = $atts['cta_product_price_color'];

		$css = "
			<style>
				.godam-product-sidebar {
					background-color: {$bg_color};
				}
				.godam-product-sidebar button,
				.godam-product-sidebar a,
				.godam-product-modal-close {
					background-color: {$icon_bg_color};
					color: {$icon_color};
					border-radius: {$radius}%;
				}
				.godam-sidebar-product-price {
					color: {$price_color};
				}
			</style>
		";

		echo $css; // phpcs:ignore
	}

	/**
	 * Render callback for the [godam_product_gallery] shortcode.
	 *
	 * Outputs a dynamic product video gallery based on provided or default attributes.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string Rendered HTML for the gallery.
	 */
	public function render( $atts ) {

		// 1. Define default attributes and allow filtering. Add filter for default attributes.
		$default_atts = apply_filters(
			'rtgodam_product_gallery_default_attributes',
			array(
				'layout'                      => 'carousel',
				'view'                        => '4-3',
				'product'                     => '',
				'align'                       => '',
				'autoplay'                    => '',
				'play_button_enabled'         => '',
				'play_button_bg_color'        => '#000000',
				'play_button_icon_color'      => '#ffffff',
				'play_button_size'            => 40,
				'play_button_radius'          => 50,
				'unmute_button_enabled'       => '',
				'unmute_button_bg_color'      => 'rgba(0,0,0,0.4)',
				'unmute_button_icon_color'    => '#ffffff',
				'card_width'                  => 21.5,
				'arrow_bg_color'              => 'rgba(0,0,0,0.5)',
				'arrow_icon_color'            => '#ffffff',
				'arrow_size'                  => 32,
				'arrow_border_radius'         => 4,
				'arrow_visibility'            => 'always',
				'grid_columns'                => 4,
				'grid_row_gap'                => 16,
				'grid_column_gap'             => 16,
				'grid_card_alignment'         => 'start',
				'cta_enabled'                 => false,
				'cta_display_position'        => 'below-inside',
				'cta_bg_color'                => '#ffffff',
				'cta_button_bg_color'         => '#000000',
				'cta_button_icon_color'       => '#ffffff',
				'cta_button_border_radius'    => 30,
				'cta_product_name_font_size'  => 16,
				'cta_product_price_font_size' => 14,
				'cta_product_name_color'      => '#000000',
				'cta_product_price_color'     => '#333333',
				'cta_cart_action'             => 'mini-cart',
			)
		);

		// 2. Merge provided attributes with defaults.
		$atts = shortcode_atts(
			$default_atts,
			$atts,
			'godam_product_gallery'
		);

		// 3. Allow filtering of final attributes. Add filter for processed attributes.
		$atts = apply_filters( 'rtgodam_product_gallery_attributes', $atts );

		if ( ! defined( 'GODAM_PRODUCT_GALLERY_CSS_PRINTED' ) ) {
			define( 'GODAM_PRODUCT_GALLERY_CSS_PRINTED', true );
			// Add CSS for Video Modal.
			$this->define_css_for_modal( $atts );
		}

		wp_enqueue_style( 'godam-product-gallery-style' );

		wp_enqueue_script( 'godam-product-gallery-script' );

		// Enqueue GoDAM Player.
		if ( ! is_admin() ) {
			wp_enqueue_script( 'godam-player-frontend-script' );
			wp_enqueue_script( 'godam-player-analytics-script' );
			wp_enqueue_style( 'godam-player-frontend-style' );
			wp_enqueue_style( 'godam-player-style' );
		}

		$product_ids = array();

		// Get trashed product IDs to exclude.
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- 'suppress_filters' is set to false; safe per VIP docs
		$trashed_product_ids = get_posts(
			array(
				'post_type'      => 'product',
				'post_status'    => 'trash',
				'fields'         => 'ids',
				'posts_per_page' => -1,
			)
		);

		// 4. Sanitize product IDs.
		if ( ! empty( $atts['product'] ) ) {
			// Logic for "random" argument.
			if ( strtolower( $atts['product'] ) === 'random' ) {
				// Fetch all product IDs that have video meta and pick 5 random ones.
				// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- 'suppress_filters' is set to false; safe per VIP docs
				$all_product_ids = get_posts(
					array(
						'post_type'      => 'product',
						'post_status'    => 'publish',
						'fields'         => 'ids',
						'posts_per_page' => -1,
						'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							array(
								'key'     => '_rtgodam_product_video_gallery_ids',
								'compare' => 'EXISTS',
							),
						),
					)
				);

				shuffle( $all_product_ids );
				$product_ids = array_slice( $all_product_ids, 0, 5 );
			} else {
				// Parse comma-separated IDs.
				$product_ids = array_filter( array_map( 'absint', explode( ',', $atts['product'] ) ) );
			}

			// Exclude trashed product IDs.
			if ( ! empty( $product_ids ) ) {
				$product_ids = array_diff( $product_ids, $trashed_product_ids );
				$product_ids = array_values( $product_ids );
			}
		}

		// 5. Build WP_Query args for fetching videos.
		$args = array(
			'post_type'      => 'attachment',
			'post_mime_type' => 'video',
			'post_status'    => 'inherit',
			'posts_per_page' => -1,
		);

		// Add filter for query arguments.
		$args = apply_filters( 'rtgodam_product_gallery_query_args', $args, $atts );

		if ( ! empty( $product_ids ) ) {
			$args['meta_query'][] = array(
				'key'     => '_video_parent_product_id',
				'value'   => $product_ids,
				'compare' => 'IN',
			);
		} else {
			$args['meta_query'][] = array(
				'key'     => '_video_parent_product_id',
				'value'   => $trashed_product_ids,
				'compare' => 'NOT IN',
			);
		}

		// 6. Fetch videos.
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- 'suppress_filters' is set to false; safe per VIP docs
		$video_posts = get_posts( $args );

		// Allow developers to modify fetched video posts before rendering.
		$video_posts = apply_filters( 'rtgodam_product_gallery_video_posts', $video_posts, $atts );

		ob_start();

		if ( $video_posts ) {

			// Add action before gallery output.
			do_action( 'rtgodam_product_gallery_before_output', $video_posts, $atts );

			/**
			 * Start of godam-product-gallery rendering.
			 */
			$alignment_class = ! empty( $atts['align'] ) ? ' align' . $atts['align'] : '';

			echo '<div class="godam-product-gallery layout-' . esc_attr( $atts['layout'] ) . 
				esc_attr( $alignment_class ) . '" 
				data-product="' . esc_attr( $atts['product'] ) . '"
			>';

			/**
			 * Layout Logic begins here.
			 */
			if ( 'carousel' === $atts['layout'] ) {
				echo '<div class="godam-carousel-wrapper">';
			
				printf(
					'<button class="carousel-arrow left %s" style="background:%s;color:%s;border-radius:%dpx;width:%dpx;height:%dpx;font-size:%dpx;" aria-label="%s">&#10094;</button>',
					esc_attr( 'hover' ? 'hide-until-hover' : '' === $atts['arrow_visibility'] ),
					esc_attr( $this->utility_instance->hex_to_rgba( $atts['arrow_bg_color'] ) ),
					esc_attr( $atts['arrow_icon_color'] ),
					intval( $atts['arrow_border_radius'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] / 2 ),
					esc_attr__( 'Scroll left', 'godam' )
				);
			
				echo '<div class="carousel-track">';
			} elseif ( 'grid' === $atts['layout'] ) {
				echo '<div class="godam-grid-wrapper">';

				printf(
					'<div class="grid-container" style="display: grid;grid-template-columns: repeat(%1$d, 1fr); row-gap: %2$dpx; column-gap: %3$dpx; justify-items: %4$s;">',
					intval( $atts['grid_columns'] ),
					intval( $atts['grid_row_gap'] ),
					intval( $atts['grid_column_gap'] ),
					esc_attr( $atts['grid_card_alignment'] ),
				);
			}

			/**
			 * Video Wrapper Begins here.
			 */
			$video_attrs = $atts['autoplay'] ? ' autoplay muted loop playsinline' : '';
			$this->render_video_wrapper( $video_posts, $atts, $video_attrs, $trashed_product_ids );
			/**
			 * Video Wrapper Ends here.
			 */

			/**
			 * Layout Logic ends here.
			 */
			if ( 'carousel' === $atts['layout'] ) {
				echo '</div>'; // .carousel-track ends.
			
				// Right Scroll Arrow.
				printf(
					'<button class="carousel-arrow right %s" style="background:%s;color:%s;border-radius:%dpx;width:%dpx;height:%dpx;font-size:%dpx;" aria-label="%s">&#10095;</button>',
					esc_attr( 'hover' ? 'hide-until-hover' : '' === $atts['arrow_visibility'] ),
					esc_attr( $this->utility_instance->hex_to_rgba( $atts['arrow_bg_color'] ) ),
					esc_attr( $atts['arrow_icon_color'] ),
					intval( $atts['arrow_border_radius'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] / 2 ),
					esc_attr__( 'Scroll right', 'godam' )
				);
			
				echo '</div>'; // .godam-carousel-wrapper ends.
			} elseif ( 'grid' === $atts['layout'] ) {
				echo '</div></div>'; // .godam-grid-wrapper ends, .grid-container ends.
			}

			// Add Mini Cart for fetching it when CTA cart action is Mini Cart.
			echo '<div class="godam-product-video-gallery--cart-basket hidden">';
				echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore
			echo '</div>';
			
			echo '</div>'; // .godam-product-gallery ends.

			// Add action after gallery output.
			do_action( 'rtgodam_product_gallery_after_output', $video_posts, $atts );

		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		return ob_get_clean();
	}

	/**
	 * Render individual video items and video Wrapper.
	 *
	 * @param array  $video_posts Array of WP_Post video attachments.
	 * @param array  $atts        Shortcode attributes.
	 * @param string $video_attrs Extra attributes for video tag (autoplay/muted/loop).
	 * @param array  $trashed_product_ids  Array of trashed product IDs to exclude.
	 */
	private function render_video_wrapper( $video_posts, $atts, $video_attrs, $trashed_product_ids ) {

		foreach ( $video_posts as $video ) {
			// Add action before each video item.
			do_action( 'rtgodam_product_gallery_before_video_item', $video, $atts );

			$video_id    = intval( $video->ID );
			$video_title = get_the_title( $video_id );

			$custom_thumbnail = get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true );
			$fallback_thumb   = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
		
			$thumbnail = $custom_thumbnail ?: $fallback_thumb;

			$video_url = $video->guid;

			$video_attached_products = get_post_meta( $video_id, '_video_parent_product_id', false );

			// Remove trashed product IDs from the list.
			if ( ! empty( $trashed_product_ids ) ) {
				$video_attached_products = array_diff( $video_attached_products, $trashed_product_ids );
				$video_attached_products = array_values( $video_attached_products );
			}

			$data_product_ids = implode( ',', array_map( 'absint', (array) $video_attached_products ) );

			echo '<div class="godam-product-video-item view-' . esc_attr( $atts['view'] ) . '">';

			if ( ! empty( $video_url ) ) {

				echo '<div class="godam-video-wrapper">';

				if ( ! $atts['autoplay'] ) {
					// Thumbnail video.
					printf(
						'<div class="godam-product-video-thumbnail" data-video-id="%s" data-video-attached-product-ids="%s" data-cta-enabled="%s" data-cta-display-position="%s" style="width:%srem;">',
						esc_attr( $video_id ),
						esc_attr( $data_product_ids ),
						esc_attr( $atts['cta_enabled'] ),
						esc_attr( $atts['cta_display_position'] ),
						esc_attr( $atts['card_width'] )
					);
					echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $video_title ) . '" />';
					echo '</div>'; // .godam-product-video-thumbnail ends.
				} else {
					// Autoplay video.
					printf(
						'<video class="godam-product-video" data-video-id="%s" data-video-attached-product-ids="%s" data-cta-enabled="%s" data-cta-display-position="%s" src="%s" %s playsinline style="width:%srem;"></video>',
						esc_attr( $video_id ),
						esc_attr( $data_product_ids ),
						esc_attr( $atts['cta_enabled'] ),
						esc_attr( $atts['cta_display_position'] ),
						esc_url( $video_url ),
						esc_attr( $video_attrs ),
						esc_attr( $atts['card_width'] )
					);
				}

				if ( $atts['play_button_enabled'] ) {
					// Play button overlay.
					printf(
						'<button class="godam-play-button" style="background:%1$s;width:%2$dpx;height:%2$dpx;border-radius:%3$dpx;" aria-label="%5$s">
							<svg width="%6$d" height="%6$d" viewBox="0 0 24 24" fill="%4$s" xmlns="http://www.w3.org/2000/svg">
								<path d="M8 5v14l11-7z"/>
							</svg>
						</button>',
						esc_attr( $this->utility_instance->hex_to_rgba( $atts['play_button_bg_color'] ) ),
						esc_attr( $atts['play_button_size'] ),
						esc_attr( $atts['play_button_radius'] ),
						esc_attr( $atts['play_button_icon_color'] ),
						esc_attr__( 'Play video', 'godam' ),
						intval( $atts['play_button_size'] / 2 )
					);

				} elseif ( $atts['autoplay'] ) {
					// Unmute button overlay.
					printf(
						'<button class="godam-unmute-button" style="background:%1$s;color:%2$s;width:30px;height:30px;font-size:16px;border-radius:50%%;" aria-label="%3$s">
							<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
								<path d="M5 9v6h4l5 5V4l-5 5H5z" />
								<g transform="translate(17, 9)">
									<line x1="0" y1="0" x2="6" y2="6" stroke="currentColor" stroke-width="2" />
									<line x1="0" y1="6" x2="6" y2="0" stroke="currentColor" stroke-width="2" />
								</g>
							</svg>
						</button>',
						esc_attr( $this->utility_instance->hex_to_rgba( $atts['unmute_button_bg_color'] ) ),
						esc_attr( $atts['unmute_button_icon_color'] ),
						esc_attr__( 'Unmute video', 'godam' )
					);
				}

				echo '</div>'; // .godam-video-wrapper ends.

				if ( $atts['cta_enabled'] && ( 'below' === $atts['cta_display_position'] || 'below-inside' === $atts['cta_display_position'] ) ) {

					$product_ids = array_map( 'absint', (array) $video_attached_products );

					$main_product = wc_get_product( $product_ids[0] );

					$has_dropdown = count( $video_attached_products ) > 1;

					// Add action to allow overriding CTA markup.
					if ( apply_filters( 'rtgodam_product_gallery_render_cta', true, $main_product, $product_ids, $atts ) ) {

						echo '<div class="godam-product-cta-wrapper">';
					
						if ( $main_product ) {
							printf(
								'<div class="godam-product-cta" style="width:%srem;background-color:%s">',
								esc_attr( $atts['card_width'] ),
								esc_attr( $this->utility_instance->hex_to_rgba( $atts['cta_bg_color'] ) ),
							);

								echo '<div class="cta-thumbnail">';
									echo wp_kses_post( $main_product->get_image( 'woocommerce_thumbnail' ) );
								echo '</div>'; // .cta-thumbnail ends.

								echo '<div class="cta-details">';
									echo '<p class="product-title" style="';
										echo 'font-size:' . intval( $atts['cta_product_name_font_size'] ) . 'px;';
										echo 'color:' . esc_attr( $atts['cta_product_name_color'] ) . ';';
										echo 'margin-top:0;';
									echo '">';
										echo '<a href="' . esc_url( get_permalink( $main_product->get_id() ) ) . '" class="product-title-link">';
											echo esc_html( $main_product->get_name() );
										echo '</a>';
									echo '</p>';
							
									echo '<p class="product-price" style="';
										echo 'font-size:' . intval( $atts['cta_product_price_font_size'] ) . 'px;';
										echo 'color:' . esc_attr( $atts['cta_product_price_color'] ) . ';';
										echo 'margin:4px 0 0;';
									echo '">' . wp_kses_post( $main_product->get_price_html() ) . '</p>';
								echo '</div>'; // .cta-details ends

								echo '<button class="cta-add-to-cart main-cta" data-product-cart="' . esc_attr( $atts['cta_cart_action'] ) . '" data-product-dropdown="' . esc_attr( $has_dropdown ) . '" data-product-id="' . esc_attr( $main_product->get_id() ) . '" data-product-page-url="' . esc_url( get_permalink( $main_product->get_id() ) ) . '"  style="background-color:' . esc_attr( $this->utility_instance->hex_to_rgba( $atts['cta_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">';
									echo $has_dropdown ? '&#9662;' : '+';
								echo '</button>';

							// Add action before the dropdown.
							do_action( 'rtgodam_product_gallery_cta_dropdown_before', $product_ids, $video, $atts );

							// Detached Dropdown for more products.
							if ( $has_dropdown ) {
								echo '<div class="cta-dropdown">';
								foreach ( $product_ids as $product_id ) {
									$product = wc_get_product( $product_id );
									if ( $product ) {
										$timestamp_meta_key = 'godam_product_timestamp_meta_' . $video_id;
										$timestamp          = get_post_meta( $product_id, $timestamp_meta_key, true );

										echo '<div class="cta-dropdown-item">';
											echo '<div class="cta-thumbnail-small">';
												echo wp_kses_post( $product->get_image( 'woocommerce_gallery_thumbnail' ) );
										
												// Add play icon if timestamp is available.
										if ( ! empty( $timestamp ) ) {
											echo '<button class="product-play-timestamp-button" data-video-id="' . esc_attr( $video_id ) . '" data-timestamp="' . esc_attr( $timestamp ) . '" data-video-attached-product-id="' . esc_attr( $product_id ) . '" data-cta-enabled="' . esc_attr( $atts['cta_enabled'] ) . '" data-cta-display-position="' . esc_attr( $atts['cta_display_position'] ) . '"aria-label="Play at timestamp" style="background-color:' . esc_attr( $this->utility_instance->hex_to_rgba( $atts['play_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['play_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['play_button_radius'] ) . '%;">';
												echo '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>';
											echo '</button>';

											$this->markup_instance->generate_product_gallery_video_modal_markup( $atts['cta_enabled'], $atts['cta_display_position'], $video_id, $product_id, true );
										}
											echo '</div>'; // .cta-thumbnail-small ends.
											echo '<div class="cta-product-info">';
												echo '<p class="product-title" style="';
													echo 'font-size:' . intval( $atts['cta_product_name_font_size'] ) . 'px;';
													echo 'color:' . esc_attr( $atts['cta_product_name_color'] ) . ';';
													echo 'margin-top:0;">';
														echo '<a href="' . esc_url( get_permalink( $product->get_id() ) ) . '" class="product-title-link">';
															echo esc_html( $product->get_name() );
														echo '</a>';
												echo '</p>';

												echo '<p class="product-price" style="';
												echo 'font-size:' . intval( $atts['cta_product_price_font_size'] ) . 'px;';
												echo 'color:' . esc_attr( $atts['cta_product_price_color'] ) . ';';
												echo 'margin:4px 0 0;" >' . wp_kses_post( $product->get_price_html() ) . '</p>';
											echo '</div>'; // .cta-product-info ends.
											echo '<button class="cta-add-to-cart" data-product-cart="' . esc_attr( $atts['cta_cart_action'] ) . '" data-product-id="' . esc_attr( $product_id ) . '" data-product-page-url="' . esc_url( get_permalink( $product->get_id() ) ) . '" style="background-color:' . esc_attr( $this->utility_instance->hex_to_rgba( $atts['cta_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">+</button>';
										echo '</div>'; // .cta-dropdown-item ends.
									}
								}
								echo '</div>'; // .cta-dropdown ends.
							}

							// Add action after the dropdown.
							do_action( 'rtgodam_product_gallery_cta_dropdown_after', $product_ids, $video, $atts );

							echo '</div>'; // .godam-product-cta ends.
						}

						echo '</div>'; // .godam-product-cta-wrapper ends.

					}
				}
				
				$this->markup_instance->generate_product_gallery_video_modal_markup( $atts['cta_enabled'], $atts['cta_display_position'], $video_id, $data_product_ids );
			}

			echo '</div>'; // .godam-product-video-item ends.

			// Add action after each video item.
			do_action( 'rtgodam_product_gallery_after_video_item', $video, $atts );
		}
	}

	/**
	 * AJAX callback to fetch and return a product's HTML content.
	 *
	 * This function is triggered via an AJAX request and returns rendered HTML for a single product,
	 * typically used in quick views, sidebars, or modal popups.
	 *
	 * @return void
	 */
	public function godam_get_product_html_callback() {

		$nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';

		if ( ! wp_verify_nonce( $nonce, 'godam_get_product_html' ) ) {
			wp_send_json_error( 'Invalid request.', 400 );
		}

		if ( ! isset( $_GET['product_id'] ) ) {
			wp_send_json_error( 'Missing product ID', 400 );
		}
	
		$product_id = absint( $_GET['product_id'] );
	
		$post = get_post( $product_id );
	
		if ( ! $post || 'product' !== $post->post_type ) {
			wp_send_json_error( 'Invalid product ID', 400 );
		}
	
		// Set up post and product for WooCommerce template functions.
		global $product;
		$product = wc_get_product( $product_id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.
	
		if ( ! $product ) {
			wp_send_json_error( 'Product not found.', 400 );
		}
	
		setup_postdata( $post );

		$product = wc_get_product( $product_id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable.

		$product_images = array();

		// Get the main product image first.
		$main_image_id = $product->get_image_id();
		if ( $main_image_id ) {
			$main_image_url = wp_get_attachment_image_url( $main_image_id, 'full' );
			if ( $main_image_url ) {
				$product_images[] = $main_image_url;
			}
		}

		// Get all gallery images.
		$gallery_image_ids = $product->get_gallery_image_ids();
		foreach ( $gallery_image_ids as $gallery_image_id ) {
			$gallery_image_url = wp_get_attachment_image_url( $gallery_image_id, 'full' );
			if ( $gallery_image_url ) {
				$product_images[] = $gallery_image_url;
			}
		}

		// Fallback to placeholder if no images found.
		if ( empty( $product_images ) ) {
			$product_images[] = wc_placeholder_img_src( 'full' );
		}
	
		ob_start();
		?>
		<div class="godam-image-gallery">
			<!-- main image display -->
			<div class="godam-main-image">
				<img src="<?php echo esc_url( $product_images[0] ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>" />
			</div>

			<!-- thumbnail carousel with horizontal scroll -->
			<div class="godam-thumbnail-carousel">
				<button class="godam-thumbnail-nav godam-thumbnail-prev" aria-label="<?php echo esc_attr__( 'Previous thumbnails', 'godam' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);"><path d="M15 19V5l-8 7z"></path></svg>
				</button>
				
				<div class="godam-thumbnail-container">
					<div class="godam-thumbnail-track">
						<?php foreach ( $product_images as $index => $image_url ) : ?>
							<div class="godam-thumbnail-item <?php echo ( 0 === $index ) ? 'active' : ''; ?>" data-index="<?php echo esc_attr( $index ); ?>">
								<?php // translators: %d refers to the image index (1-based). ?>
								<img class="godam-thumbnail-image" src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( sprintf( __( 'Image %d', 'godam' ), $index + 1 ) ); ?>">
							</div>
						<?php endforeach; ?>
					</div>
				</div>
				
				<button class="godam-thumbnail-nav godam-thumbnail-next" aria-label="<?php echo esc_attr__( 'Next thumbnails', 'godam' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(0, 0, 0, 1);"><path d="m9 19 8-7-8-7z"></path></svg>
				</button>
			</div>
		</div>
		<div class="godam-single-product-sidebar-content">
			<div class="godam-sidebar-product-title">
				<h3><?php echo esc_html( $product->get_name() ); ?></h3>
			</div>
			<p class="godam-sidebar-product-price"><?php echo wp_kses_post( $product->get_price_html() ); ?></p>

			<?php
				$average      = $product->get_average_rating();
				$rating_count = $product->get_rating_count();

				$full_star_svg  = sprintf(
					'<img src="%s" alt="%s" width="16" height="16" style="vertical-align:middle;" />',
					esc_url( RTGODAM_URL . 'assets/src/images/rating-full-star.svg' ),
					esc_attr__( 'Full Star', 'godam' )
				);
				$empty_star_svg = sprintf(
					'<img src="%s" alt="%s" width="16" height="16" style="vertical-align:middle;" />',
					esc_url( RTGODAM_URL . 'assets/src/images/rating-empty-star.svg' ),
					esc_attr__( 'Empty Star', 'godam' )
				);

				$allowed_svg = array(
					'svg'            => array(
						'xmlns'   => true,
						'width'   => true,
						'height'  => true,
						'viewBox' => true,
					),
					'defs'           => array(),
					'linearGradient' => array(
						'id' => true,
						'x1' => true,
						'y1' => true,
						'x2' => true,
						'y2' => true,
					),
					'stop'           => array(
						'offset'     => true,
						'stop-color' => true,
					),
					'path'           => array(
						'd'    => true,
						'fill' => true,
					),
				);
				?>

			<div class="godam-sidebar-product-rating">
				<?php
				// Always render 5 stars.
				for ( $i = 1; $i <= 5; $i++ ) {
					if ( 0 === $rating_count ) {
						// No reviews → show all empty stars.
						echo wp_kses_post( $empty_star_svg );
					} elseif ( $average >= $i ) {
							echo wp_kses_post( $full_star_svg ); // Full star.
					} elseif ( $average > $i - 1 ) {
						$partial = ( $average - ( $i - 1 ) ) * 100; // % fill for partial star.
						echo $this->utility_instance->get_partial_star_svg( $partial ); /* phpcs:ignore */
					} else {
						echo wp_kses_post( $empty_star_svg ); // Empty star.

					}
				}
				?>
			</div>

			<p class="godam-sidebar-product-description"><?php echo wp_kses_post( $product->get_description() ); ?></p> 
		
			<?php
			// Replace Woo's form/button with Product Sidebar Add to Cart button or Product Sidebar View Product button.
			$product_url = get_permalink( $product_id );
			?>
		<div class="single-product-sidebar-actions">
			<?php if ( $product->is_type( 'variable' ) || $product->is_type( 'grouped' ) || $product->is_type( 'external' ) || ! $product->is_in_stock() ) : ?>
				<a class="godam-product-sidebar-view-product-button" href="<?php echo esc_url( $product_url ); ?>" target="_blank" rel="noopener noreferrer">
					<?php echo esc_html__( 'View Product', 'godam' ); ?>
				</a>
			<?php else : ?>
				<button class="godam-product-sidebar-add-to-cart-button" data-product-id="<?php echo esc_attr( $product_id ); ?>">
					<?php echo esc_html__( 'Add to Cart', 'godam' ); ?>
				</button>
			<?php endif; ?>

			<div class="rtgodam-product-video-gallery-slider-modal-content--cart-basket">
				<?php echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore ?>
			</div>
		</div>
		<?php
		
		echo '</div>';
		
		
		wp_reset_postdata();
	
		$html = ob_get_clean();     

		// Add filter to change html markup for product sidebar.
		$html = apply_filters( 'rtgodam_ajax_product_html', $html, $product_id );

		// Add action before sending JSON response.
		do_action( 'rtgodam_ajax_product_html_sent', $product_id );
	
		wp_send_json_success( $html );
	}
}
