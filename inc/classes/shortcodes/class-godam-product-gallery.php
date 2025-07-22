<?php
/**
 * GoDAM Product Gallery Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Product_Gallery.
 *
 * Handles [godam_product_gallery] shortcode.
 */
class GoDAM_Product_Gallery {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_product_gallery', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );

		add_action(
			'wp_enqueue_scripts',
			function () {
				if ( ! is_admin() ) {
					wp_enqueue_script( 'godam-player-frontend-script' );
					wp_enqueue_script( 'godam-player-analytics-script' );
					wp_enqueue_style( 'godam-player-frontend-style' );
					wp_enqueue_style( 'godam-player-style' );
				}
			} 
		);

		add_action( 'wp_ajax_godam_get_product_html', array( $this, 'godam_get_product_html_callback' ) );
		add_action( 'wp_ajax_nopriv_godam_get_product_html', array( $this, 'godam_get_product_html_callback' ) );
	}

	/**
	 * Register gallery-specific scripts and styles.
	 */
	public function register_scripts() {
		wp_enqueue_style(
			'godam-product-gallery-style',
			RTGODAM_URL . 'assets/build/css/godam-product-gallery.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-product-gallery.css' )
		);

		wp_register_script(
			'godam-product-gallery-script',
			RTGODAM_URL . 'assets/build/js/godam-product-gallery.min.js',
			array( 'wp-data', 'wp-element', 'wp-hooks' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-product-gallery.min.js' ),
			true
		);
		
		wp_localize_script(
			'godam-product-gallery-script',
			'godamVars',
			array(
				'namespaceRoot'        => '/wp-json/godam/v1',
				'videoShortcodeEP'     => '/video-shortcode',
				'productByIdsEP'       => '/wcproducts-by-ids',
				'addToCartAjax'        => '/?wc-ajax=add_to_cart',
				'ajaxUrl'              => admin_url( 'admin-ajax.php' ),
				'getProductHtmlAction' => 'godam_get_product_html',
				'productGalleryNonce'  => wp_create_nonce( 'godam_get_product_html' ),
				'api_nonce'            => wp_create_nonce( 'wc_store_api' ),
			) 
		);
		
		wp_enqueue_script( 'godam-product-gallery-script' );
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

		$product_ids = array();

		// 4. Sanitize product IDs.
		if ( ! empty( $atts['product'] ) ) {
			// Logic for "random" argument.
			if ( strtolower( $atts['product'] ) === 'random' ) {
				// Fetch all product IDs that have video meta and pick 5 random ones.
				$all_product_ids = get_posts(
					array(
						'post_type'      => 'product',
						'post_status'    => 'publish',
						'fields'         => 'ids',
						'posts_per_page' => -1,
						'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
							array(
								'key'     => '_video_parent_product_id',
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
				'compare' => 'EXISTS',
			);
		}

		// 6. Fetch videos.
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
					esc_attr( $this->hex_to_rgba( $atts['arrow_bg_color'] ) ),
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
							esc_attr( $this->hex_to_rgba( $atts['play_button_bg_color'] ) ),
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
							esc_attr( $this->hex_to_rgba( $atts['unmute_button_bg_color'] ) ),
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
									esc_attr( $this->hex_to_rgba( $atts['cta_bg_color'] ) ),
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

									echo '<button class="cta-add-to-cart main-cta" data-product-cart="' . esc_attr( $atts['cta_cart_action'] ) . '" data-product-dropdown="' . esc_attr( $has_dropdown ) . '" data-product-id="' . esc_attr( $main_product->get_id() ) . '" data-product-page-url="' . esc_url( get_permalink( $main_product->get_id() ) ) . '"  style="background-color:' . esc_attr( $this->hex_to_rgba( $atts['cta_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">';
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
												echo '<button class="product-play-timestamp-button" data-video-id="' . esc_attr( $video_id ) . '" data-timestamp="' . esc_attr( $timestamp ) . '" data-video-attached-product-id="' . esc_attr( $product_id ) . '" data-cta-enabled="' . esc_attr( $atts['cta_enabled'] ) . '" data-cta-display-position="' . esc_attr( $atts['cta_display_position'] ) . '"aria-label="Play at timestamp" style="background-color:' . esc_attr( $this->hex_to_rgba( $atts['play_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['play_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['play_button_radius'] ) . '%;">';
													echo '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>';
												echo '</button>';
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
												echo '<button class="cta-add-to-cart" data-product-cart="' . esc_attr( $atts['cta_cart_action'] ) . '" data-product-id="' . esc_attr( $product_id ) . '" data-product-page-url="' . esc_url( get_permalink( $product->get_id() ) ) . '" style="background-color:' . esc_attr( $this->hex_to_rgba( $atts['cta_button_bg_color'] ) ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">+</button>';
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
					
					$this->generate_product_gallery_video_modal_markup( $atts['cta_enabled'], $atts['cta_display_position'], $video_id, $data_product_ids );
				}

				echo '</div>'; // .godam-product-video-item ends.

				// Add action after each video item.
				do_action( 'rtgodam_product_gallery_after_video_item', $video, $atts );
			}

			/**
			 * Layout Logic ends here.
			 */
			if ( 'carousel' === $atts['layout'] ) {
				echo '</div>'; // .carousel-track ends.
			
				// Right Scroll Arrow.
				printf(
					'<button class="carousel-arrow right %s" style="background:%s;color:%s;border-radius:%dpx;width:%dpx;height:%dpx;font-size:%dpx;" aria-label="%s">&#10095;</button>',
					esc_attr( 'hover' ? 'hide-until-hover' : '' === $atts['arrow_visibility'] ),
					esc_attr( $this->hex_to_rgba( $atts['arrow_bg_color'] ) ),
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
			
			echo '</div>'; // .godam-product-gallery ends.

			// Add action after gallery output.
			do_action( 'rtgodam_product_gallery_after_output', $video_posts, $atts );

		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		return ob_get_clean();
	}

	/**
	 * Helper function: Converts a hex color code to an RGB or RGBA string.
	 *
	 * This function handles hex codes in the following formats:
	 * - 8-digit hex (e.g., #RRGGBBAA) → returns `rgba(r, g, b, a)`
	 * - 6-digit hex (e.g., #RRGGBB)   → returns `rgb(r, g, b)`
	 * - If the input is already in `rgb(...)` or `rgba(...)` format, it is returned as-is.
	 * - Any other format is returned with the '#' prefix unchanged.
	 *
	 * @param string $hex The color value in hex, rgb, or rgba format.
	 * @return string The color value converted to `rgb(...)`, `rgba(...)`, or unchanged.
	 */
	private function hex_to_rgba( $hex ) {

		// If already in rgba or rgb format, return as is.
		if ( strpos( $hex, 'rgba' ) === 0 || strpos( $hex, 'rgb' ) === 0 ) {
			return $hex;
		}

		$hex = str_replace( '#', '', $hex );
	
		if ( strlen( $hex ) === 8 ) {
			$r = hexdec( substr( $hex, 0, 2 ) );
			$g = hexdec( substr( $hex, 2, 2 ) );
			$b = hexdec( substr( $hex, 4, 2 ) );
			$a = hexdec( substr( $hex, 6, 2 ) ) / 255;
			return "rgba({$r}, {$g}, {$b}, {$a})";
		}
	
		if ( strlen( $hex ) === 6 ) {
			$r = hexdec( substr( $hex, 0, 2 ) );
			$g = hexdec( substr( $hex, 2, 2 ) );
			$b = hexdec( substr( $hex, 4, 2 ) );
			return "rgb({$r}, {$g}, {$b})";
		}
	
		return "#{$hex}";
	}

	public function generate_product_gallery_video_modal_markup( $cta_enabled, $cta_display_position, $video_id, $product_ids ) {

		if( $cta_enabled && ( 'inside' === $cta_display_position || 'below-inside' === $cta_display_position ) ) {

			$product_ids_array = array_map( 'absint', explode( ',', $product_ids ) );
			$no_of_products = count( $product_ids_array ) > 1;

			// Mutiple - show all products
			if ( $no_of_products ) {
				echo $this->generate_cta_enabled_muliple_product_modal_markup( $product_ids_array, $video_id );
			} else {
				// single - show full product
				echo $this->generate_cta_enabled_single_product_modal_markup( $product_ids, $video_id );
			}

		} else {
			// video modal markup
			echo $this->generate_video_modal_markup( $video_id );
		}
	}

	private function generate_cta_enabled_muliple_product_modal_markup( $product_ids, $video_id ) {
		?>
			<div class="godam-product-modal-container" data-modal-video-id="<?php echo $video_id ?>"> <!-- overlay container -->
				<div class="godam-product-modal-content">
					<div class="godam-product-video-container column">
						<div class="video-container animate-video-loading" style="aspect-ratio:responsive;">
							<div class="animate-play-btn">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
									<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
								</svg>
							</div>
						</div>
						<div class="godam-swipe-overlay">
							<div class="godam-swipe-hint">
								<div class="chevron chevron-up"></div>
								<div class="chevron chevron-down"></div>
								<span class="godam-scroll-or-swipe-text"></span>
							</div>
						</div>
					</div>
					<div class="godam-product-sidebar">
						<div class="godam-sidebar-header">
							<h3><?php esc_html_e( 'Products seen in the video', 'godam' ) ?></h3>
							<div class="godam-product-video-gallery--cart-basket">
								<?php
									echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore
								?>
							</div>
							<button class="godam-sidebar-close" aria-label="<?php __( 'Close sidebar', 'godam' ) ?>">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(255, 255, 255, 1);transform: ;msFilter:;"><path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
							</button>
						</div>
						<div class="godam-product-sidebar-grid">
							<?php foreach ( $product_ids as $product_id ) :
								$product = wc_get_product( $product_id );
								if ( ! $product ) {
									continue;
								}
								$product_link = get_permalink( $product_id );
								$product_image = $product->get_image();
								$product_title = $product->get_name();
								$product_price = $product->get_price_html();
								$product_rating_customer_count = $product->get_rating_count(); // @todo Rating display
								$product_rating_average_count = $product->get_average_rating();
								$product_type = $product->get_type();
								?>
								<div class="godam-sidebar-product-item">
									<div class="godam-sidebar-product-image"><?php echo $product_image; ?></div>
									<div class="godam-sidebar-product-title"><?php echo esc_html( $product_title ); ?></div>
									<div class="godam-sidebar-product-price"><?php echo wp_kses_post( $product_price ); ?></div>
									<?php
									if ( in_array( $product_type, array( 'variable', 'grouped', 'external' ), true ) ) {
										?>
										<a class="godam-product-sidebar-add-to-cart-button"
										   href="<?php echo esc_url( $product_link ); ?>"
										   target="_blank"
										   aria-label="<?php esc_attr_e( 'View Product', 'godam' ); ?>">
											<?php esc_html_e( 'View Product', 'godam' ); ?>
										</a>
										<?php
									} else {
										?>
										<button class="godam-product-sidebar-add-to-cart-button"
												data-product-id="<?php echo esc_attr( $product->get_id() ); ?>"
												aria-label="<?php esc_attr_e( 'Add to Cart', 'godam' ); ?>">
											<?php esc_html_e( 'Add to Cart', 'godam' ); ?>
										</button>
										<?php
									}
									?>
								</div>
							<?php endforeach; ?>
						</div>
					</div>
				</div>
			</div>
		<?php
	}

	private function generate_cta_enabled_single_product_modal_markup( $product_id, $video_id ) {
		?>
			<div class="godam-product-modal-container" data-modal-video-id="<?php echo $video_id ?>"> <!-- overlay container -->
				<div class="godam-product-modal-content">
					<div class="godam-product-video-container column">
						<div class="video-container animate-video-loading" style="aspect-ratio:responsive;">
							<div class="animate-play-btn">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
									<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
								</svg>
							</div>
						</div>
						<div class="godam-swipe-overlay">
							<div class="godam-swipe-hint">
								<div class="chevron chevron-up"></div>
								<div class="chevron chevron-down"></div>
								<span class="godam-scroll-or-swipe-text"></span>
							</div>
						</div>
					</div>
					<div class="godam-product-sidebar">
						<div class="godam-sidebar-header">
							<button class="godam-sidebar-close" aria-label="<?php __( 'Close sidebar', 'godam' ) ?>">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" style="fill: rgba(255, 255, 255, 1);transform: ;msFilter:;"><path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
							</button>
						</div>
						<div class="godam-product-sidebar-single">
							<?php
								global $product;
								$product = wc_get_product( $product_id );

								ob_start();

									woocommerce_show_product_images(); // todo opacity 0 by default in images.
									woocommerce_template_single_title();
									woocommerce_template_single_rating();
									woocommerce_template_single_price();
									woocommerce_template_single_excerpt();
									// Replace Woo's form/button with Product Sidebar Add to Cart button or Product Sidebar View Product button.
									$product_url = get_permalink( $product_id );

									if ( $product->is_type( 'variable' ) || $product->is_type( 'grouped' ) || $product->is_type( 'external' ) ) {
										echo '<a class="product-sidebar-view-product-button" href="' . esc_url( $product_url ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'View Product', 'godam' ) . '</a>';
									} else {
										echo '<button class="product-sidebar-add-to-cart-button" data-product-id="' . esc_attr( $product_id ) . '">' . esc_html__( 'Add to Cart', 'godam' ) . '</button>';
									}
									?>

									<div class="rtgodam-product-video-gallery-slider-modal-content--cart-basket">
										<?php
											echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore
										?>
									</div>

									<?php
									woocommerce_template_single_meta();
									woocommerce_template_single_sharing();

								$html = ob_get_clean();
								echo $html;
							?>
						</div>
					</div>
				</div>
			</div>
		<?php
	}

	private function generate_video_modal_markup( $video_id ) {
		?>
		<div class="godam-product-modal-container" data-modal-video-id="<?php echo $video_id ?>"> <!-- overlay container -->
			<div class="godam-product-modal-content">
				<div class="godam-product-video-container">
					<div class="video-container animate-video-loading" style="aspect-ratio:responsive;">
						<div class="animate-play-btn">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
								<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
							</svg>
						</div>
					</div>
					<div class="godam-swipe-overlay">
						<div class="godam-swipe-hint">
							<div class="chevron chevron-up"></div>
							<div class="chevron chevron-down"></div>
							<span class="godam-scroll-or-swipe-text"></span>
						</div>
					</div>
				</div>
			</div>
		</div>
	<?php
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

		$nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( $_GET['_wpnonce'] ) : '';

		if ( ! wp_verify_nonce( $nonce, 'godam_get_product_html' ) ) {
			wp_send_json_error( 'Invalid request.' );
		}

		if ( ! isset( $_GET['product_id'] ) ) {
			wp_send_json_error( 'Missing product ID' );
		}
	
		$product_id = absint( $_GET['product_id'] );
	
		$post = get_post( $product_id );
	
		if ( ! $post || 'product' !== $post->post_type ) {
			wp_send_json_error( 'Invalid product ID' );
		}
	
		// Set up post and product for WooCommerce template functions.
		global $product;
		$product = wc_get_product( $product_id );
	
		if ( ! $product ) {
			wp_send_json_error( 'Product not found.' );
		}
	
		setup_postdata( $post );
	
		ob_start();
		?>
		<div class="single-product">
			<?php
			

			
			?>
		</div>
		<?php
		wp_reset_postdata();
	
		$html = ob_get_clean();

		error_log($html);

		// Add filter to change html markup for product sidebar.
		$html = apply_filters( 'rtgodam_ajax_product_html', $html, $product_id );

		// Add action before sending JSON response.
		do_action( 'rtgodam_ajax_product_html_sent', $product_id );
	
		wp_send_json_success( $html );
	}
}
