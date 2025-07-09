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
				'api_nonce' => wp_create_nonce( 'wc_store_api' ),
			) 
		);
		
		wp_enqueue_script( 'godam-product-gallery-script' );
	}

	/**
	 * Render the product gallery shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the gallery.
	 */
	public function render( $atts ) {

		// Add filter for default attributes.
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
				'arrow_bg_color'              => 'rgba(0,0,0,0.5)',
				'arrow_icon_color'            => '#ffffff',
				'arrow_size'                  => 32,
				'arrow_border_radius'         => 4,
				'arrow_visibility'            => 'always',
				'cta_enabled'                 => false,
				'cta_display_position'        => 'below',
				'cta_button_bg_color'         => '#000000',
				'cta_button_icon_color'       => '#ffffff',
				'cta_button_border_radius'    => 30,
				'cta_product_name_font_size'  => 16,
				'cta_product_price_font_size' => 14,
				'cta_product_name_color'      => '#000000',
				'cta_product_price_color'     => '#333333',
			)
		);

		$atts = shortcode_atts(
			$default_atts,
			$atts,
			'godam_product_gallery'
		);

		// Add filter for processed attributes.
		$atts = apply_filters( 'rtgodam_product_gallery_attributes', $atts );

		$product_ids = array();

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
						'meta_query'     => array(
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

		$video_posts = get_posts( $args );

		ob_start();

		if ( $video_posts ) {

			// Add action before gallery output.
			do_action( 'rtgodam_product_gallery_before_output', $video_posts, $atts );

			$alignment_class = ! empty( $atts['align'] ) ? ' align' . $atts['align'] : '';

			echo '<div class="godam-product-gallery layout-' . esc_attr( $atts['layout'] ) . 
				esc_attr( $alignment_class ) . '" 
				data-product="' . esc_attr( $atts['product'] ) . '"
			>';

			if ( 'carousel' === $atts['layout'] ) {
				echo '<div class="godam-carousel-wrapper">';
			
				printf(
					'<button class="carousel-arrow left %s" style="background:%s;color:%s;border-radius:%dpx;width:%dpx;height:%dpx;font-size:%dpx;" aria-label="%s">&#10094;</button>',
					esc_attr( $atts['arrow_visibility'] === 'hover' ? 'hide-until-hover' : '' ),
					esc_attr( $this->hex_to_rgba( $atts['arrow_bg_color'] ) ),
					esc_attr( $atts['arrow_icon_color'] ),
					intval( $atts['arrow_border_radius'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] / 2 ),
					esc_attr__( 'Scroll left', 'godam' )
				);
			
				echo '<div class="carousel-track">';
			}

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

				if ( ! empty( $video_url ) ) {

					echo '<div class="godam-product-video-item view-' . esc_attr( $atts['view'] ) . '">';

					echo '<div class="godam-video-wrapper">';

					if ( ! $atts['autoplay'] ) {
						echo '<div class="godam-product-video-thumbnail" data-video-id="' . esc_attr( $video_id ) . '">';
						echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $video_title ) . '" />';
						echo '</div>';
					} else {
						echo '<video class="godam-product-video" data-video-id="' . esc_attr( $video_id ) . '" src="' . esc_url( $video_url ) . '"' . $video_attrs . ' playsinline></video>';
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
							$atts['play_button_size'],
							$atts['play_button_radius'],
							esc_attr( $atts['play_button_icon_color'] ),
							esc_attr__( 'Play video', 'godam' ),
							intval( $atts['play_button_size'] / 2 )
						);

					} elseif ( $atts['autoplay'] ) {
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

					echo '</div>';

					if ( $atts['cta_enabled'] && $atts['cta_display_position'] === 'below' ) {
						$video_width_map = array(
							'16-9' => '42rem',
							'4-3'  => '21.5rem',
							'9-16' => '18.5rem',
							'3-4'  => '18.5rem',
							'1-1'  => '19rem',
						);
					
						$cta_width   = isset( $video_width_map[ $atts['view'] ] ) ? $video_width_map[ $atts['view'] ] : '100%';
						$product_ids = array_map( 'absint', (array) $video_attached_products );

						$main_product = wc_get_product( $product_ids[0] );
						// $other_products = array_slice( $product_ids, 1 );
						$has_dropdown = count( $video_attached_products ) > 1;

						echo '<div class="godam-product-cta-wrapper">';
					
						if ( $main_product ) {
							echo '<div class="godam-product-cta" style="width:' . esc_attr( $cta_width ) . ';">';

								echo '<div class="cta-thumbnail">';
									echo $main_product->get_image( 'woocommerce_thumbnail' );
								echo '</div>';

								echo '<div class="cta-details">';
									echo '<p class="product-title" style="';
										echo 'font-size:' . intval( $atts['cta_product_name_font_size'] ) . 'px;';
										echo 'color:' . esc_attr( $atts['cta_product_name_color'] ) . ';';
										echo 'margin-top:0;';
									echo '">' . esc_html( $main_product->get_name() ) . '</p>';
						
									echo '<p class="product-price" style="';
										echo 'font-size:' . intval( $atts['cta_product_price_font_size'] ) . 'px;';
										echo 'color:' . esc_attr( $atts['cta_product_price_color'] ) . ';';
										echo 'margin:4px 0 0;';
									echo '">' . $main_product->get_price_html() . '</p>';
								echo '</div>';

								echo '<button class="cta-add-to-cart main-cta" data-product-id="' . esc_attr( $main_product->get_id() ) . '" style="background-color:' . esc_attr( $atts['cta_button_bg_color'] ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">';
									echo $has_dropdown ? '▾' : '+';
								echo '</button>';

								// Detached Dropdown
							if ( $has_dropdown ) {
								echo '<div class="cta-dropdown">';
								foreach ( $product_ids as $product_id ) {
									$product = wc_get_product( $product_id );
									if ( $product ) {
										echo '<div class="cta-dropdown-item">';
											echo '<div class="cta-thumbnail-small">' . $product->get_image( 'woocommerce_gallery_thumbnail' ) . '</div>';
											echo '<div class="cta-product-info">';
												echo '<p class="product-title" style="';
												echo 'font-size:' . intval( $atts['cta_product_name_font_size'] ) . 'px;';
												echo 'color:' . esc_attr( $atts['cta_product_name_color'] ) . ';';
												echo 'margin-top:0; ">' . esc_html( $product->get_name() ) . '</p>';

												echo '<p class="product-price" style="';
												echo 'font-size:' . intval( $atts['cta_product_price_font_size'] ) . 'px;';
												echo 'color:' . esc_attr( $atts['cta_product_price_color'] ) . ';';
												echo 'margin:4px 0 0;" >' . $product->get_price_html() . '</p>';
											echo '</div>';
											echo '<button class="cta-add-to-cart" data-product-id="' . esc_attr( $product_id ) . '"style="background-color:' . esc_attr( $atts['cta_button_bg_color'] ) . ';color:' . esc_attr( $atts['cta_button_icon_color'] ) . ';border-radius:' . esc_attr( $atts['cta_button_border_radius'] ) . '%;" aria-label="Add to cart">+</button>';
										echo '</div>';
									}
								}
								echo '</div>';
							}

							echo '</div>';
						}

						echo '</div>';
					}                   

					echo '</div>';
				}

				// Add action after each video item.
				do_action( 'rtgodam_product_gallery_after_video_item', $video, $atts );
			}

			if ( 'carousel' === $atts['layout'] ) {
				echo '</div>'; // .carousel-track
			
				printf(
					'<button class="carousel-arrow right %s" style="background:%s;color:%s;border-radius:%dpx;width:%dpx;height:%dpx;font-size:%dpx;" aria-label="%s">&#10095;</button>',
					esc_attr( $atts['arrow_visibility'] === 'hover' ? 'hide-until-hover' : '' ),
					esc_attr( $this->hex_to_rgba( $atts['arrow_bg_color'] ) ),
					esc_attr( $atts['arrow_icon_color'] ),
					intval( $atts['arrow_border_radius'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] ),
					intval( $atts['arrow_size'] / 2 ),
					esc_attr__( 'Scroll right', 'godam' )
				);
			
				echo '</div>'; // .godam-carousel-wrapper
			}
			
			echo '</div>'; // .godam-product-gallery

			// Add action after gallery output.
			do_action( 'rtgodam_product_gallery_after_output', $video_posts, $atts );

		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		return ob_get_clean();
	}

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
}
