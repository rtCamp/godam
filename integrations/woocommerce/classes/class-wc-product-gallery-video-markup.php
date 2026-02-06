<?php
/**
 * WooCommerce GoDAM Product Gallery Block Video Markup Logic
 *
 * Depending on CTA settings and product association, it dynamically outputs:
 * - A basic video modal,
 * - A single-product modal with optional timestamping,
 * - Or a multi-product modal with product list and mini-cart.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Product_Gallery_Video_Markup
 */
class WC_Product_Gallery_Video_Markup {

	use Singleton;

	/**
	 * Generates and echoes the appropriate video modal markup based on CTA settings and product data.
	 *
	 * This function decides which modal markup to render for a product gallery video, depending on
	 * whether the CTA (Call-To-Action) is enabled and where it should be displayed.
	 *
	 * Behavior:
	 * - If CTA is enabled and positioned 'inside' or 'below-inside':
	 *   - Parses the `$product_ids` into an array.
	 *   - If multiple products are present, renders a modal showing all products.
	 *   - If only one product is present, renders a single product modal with optional timestamping.
	 * - If CTA is disabled or positioned differently, renders a basic video modal.
	 *
	 * @param bool   $cta_enabled         Whether CTA is enabled.
	 * @param string $cta_display_position Position of the CTA (e.g., 'inside', 'below-inside').
	 * @param int    $video_id            The ID of the video.
	 * @param string $product_ids         Comma-separated list of product IDs.
	 * @param string $instance_id         Unique ID for each GoDAM Gallery Block.
	 * @param bool   $timestamped         Whether the modal should be timestamp-aware (default false).
	 */
	public function generate_product_gallery_video_modal_markup( $cta_enabled, $cta_display_position, $video_id, $product_ids, $instance_id, $timestamped = false ) {

		if ( $cta_enabled && ( 'inside' === $cta_display_position || 'below-inside' === $cta_display_position ) ) {

			$product_ids_array = array_map( 'absint', explode( ',', $product_ids ) );
			$no_of_products    = count( $product_ids_array ) > 1;

			// Mutiple - show all products.
			if ( $no_of_products ) {
				echo wp_kses_post( (string) $this->generate_cta_enabled_muliple_product_modal_markup( $product_ids_array, $video_id, $instance_id ) );
			} else {
				// single - show full product.
				echo wp_kses_post( (string) $this->generate_cta_enabled_single_product_modal_markup( $product_ids, $video_id, $timestamped, $instance_id ) );
			}
		} else {
			// video modal markup.
			echo wp_kses_post( (string) $this->generate_video_modal_markup( $video_id, $instance_id ) );
		}
	}

	/**
	 * Outputs the modal HTML markup for videos with multiple associated products and CTA enabled.
	 *
	 * This private function generates the complete modal structure when a video is linked to
	 * multiple products and the Call-To-Action (CTA) is active. It includes:
	 * - A modal container with a close button.
	 * - A video placeholder with a play icon and swipe hints.
	 * - A sidebar containing:
	 *   - A header showing the label "Products seen in the video".
	 *   - A WooCommerce mini-cart block.
	 *   - A close button for the sidebar.
	 *   - A placeholder for dynamically loaded product content.
	 *
	 * The product IDs are safely cast to integers and embedded as a comma-separated string
	 * in the `data-product-ids` attribute of the sidebar for client-side JavaScript access.
	 *
	 * @param array  $product_ids         Array of product IDs associated with the video.
	 * @param int    $video_id            The ID of the video for which the modal is being rendered.
	 * @param string $instance_id         Unique ID for each GoDAM Gallery Block.
	 */
	private function generate_cta_enabled_muliple_product_modal_markup( $product_ids, $video_id, $instance_id ) {
		ob_start();

		$data_product_ids = implode( ',', array_map( 'absint', (array) $product_ids ) );
		?>
			<div class="godam-product-modal-container" data-modal-video-id="<?php echo esc_attr( $video_id ); ?>" data-gallery-id="<?php echo esc_attr( $instance_id ); ?>"> <!-- overlay container -->
				<div class="close">
					<button class="godam-product-modal-close" aria-label="<?php __( 'Close modal', 'godam' ); ?>">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
					</button>
				</div>
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
					<div class="godam-product-sidebar" data-product-ids="<?php echo esc_attr( $data_product_ids ); ?>">
						<div class="godam-sidebar-header">
							<h3 class="godam-header-text"><?php esc_html_e( 'Products seen in the video', 'godam' ); ?></h3>

							<div class="godam-sidebar-header-actions">
								<div class="godam-product-video-gallery-sidebar--cart-basket">
									<?php
										$mini_cart_block = do_blocks( '<!-- wp:woocommerce/mini-cart /-->' );
										echo ! empty( $mini_cart_block ) ? wp_kses_post( $mini_cart_block ) : '';
									?>
								</div>
								<button class="godam-sidebar-close" aria-label="<?php __( 'Close sidebar', 'godam' ); ?>">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
								</button>
								
							</div>
						</div>
						<div class="godam-sidebar-product">
							<div class="spinner"></div>
						</div>
					</div>
					<button class="sidebar-collapsible-open-button hidden">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
							<path d="M3 12.5V4a1 1 0 0 1 1-1h8.5a1 1 0 0 1 .7.3l8.5 8.5a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 13.2a1 1 0 0 1-.3-.7Z"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linejoin="round"/>
							<circle cx="8" cy="8" r="1.5" fill="currentColor"/>
						</svg>
						<p><?php esc_html_e( 'Products', 'godam' ); ?></p>
					</button>
				</div>
			</div>
		<?php

		$html = ob_get_clean();
		return is_string( $html ) ? $html : '';
	}

	/**
	 * Outputs the modal HTML markup for a video with a single associated product and CTA enabled.
	 *
	 * This private function renders a modal structure specifically for a video linked to one product.
	 * It includes:
	 * - A modal container with `data-modal-video-id`, `data-modal-timestamped`, and `data-modal-attached-product-id`.
	 * - A close button to dismiss the modal.
	 * - A video display section with a loading animation and swipe indicators.
	 * - A sidebar section containing:
	 *   - A hidden heading for accessibility.
	 *   - A WooCommerce mini-cart block.
	 *   - A close button for the sidebar.
	 *   - A placeholder for dynamic product content.
	 *
	 * The `$timestamped` value defaults to `0` if not set, and all dynamic attributes are safely rendered.
	 *
	 * @param int    $product_id          The single product ID associated with the video.
	 * @param int    $video_id            The ID of the video the modal is for.
	 * @param bool   $timestamped         Whether the modal should include timestamping (default false).
	 * @param string $instance_id         Unique ID for each GoDAM Gallery Block.
	 */
	private function generate_cta_enabled_single_product_modal_markup( $product_id, $video_id, $timestamped, $instance_id, ) {
		ob_start();

		if ( ! $timestamped ) {
			$timestamped = 0;
		}
		?>
			<div class="godam-product-modal-container" data-modal-video-id="<?php echo esc_attr( $video_id ); ?>" data-modal-timestamped="<?php echo esc_attr( $timestamped ); ?>" data-modal-attached-product-id="<?php echo esc_attr( $product_id ); ?>" data-gallery-id="<?php echo esc_attr( $instance_id ); ?>"> <!-- overlay container -->
				<div class="close">
					<button class="godam-product-modal-close" aria-label="<?php __( 'Close modal', 'godam' ); ?>">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
					</button>
				</div>
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
					<div class="godam-product-sidebar single-product-sidebar" data-product-ids="<?php echo esc_attr( $product_id ); ?>">
						<div class="godam-sidebar-header">
							<h3 class="godam-header-text hidden"><?php esc_html_e( 'Products seen in the video', 'godam' ); ?></h3>

							<div class="godam-sidebar-header-actions">
								<div class="godam-product-video-gallery-sidebar--cart-basket">
									<?php
										$mini_cart_block = do_blocks( '<!-- wp:woocommerce/mini-cart /-->' );
										echo ! empty( $mini_cart_block ) ? wp_kses_post( $mini_cart_block ) : '';
									?>
								</div>
								<button class="godam-sidebar-close" aria-label="<?php __( 'Toggle sidebar', 'godam' ); ?>">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
								</button>
							</div>
						</div>
						<div class="godam-sidebar-product">
							<div class="spinner"></div>
						</div>
					</div>
					<button class="sidebar-collapsible-open-button hidden">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
							<path d="M3 12.5V4a1 1 0 0 1 1-1h8.5a1 1 0 0 1 .7.3l8.5 8.5a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 13.2a1 1 0 0 1-.3-.7Z"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linejoin="round"/>
							<circle cx="8" cy="8" r="1.5" fill="currentColor"/>
						</svg>
						<p><?php esc_html_e( 'Products', 'godam' ); ?></p>
					</button>
				</div>
			</div>
		<?php

		$html = ob_get_clean();
		return is_string( $html ) ? $html : '';
	}

	/**
	 * Outputs the modal HTML markup for a video without any associated products or CTA.
	 *
	 * This private function renders a simplified video modal that contains:
	 * - A modal container with `data-modal-video-id` to identify the associated video.
	 * - A close button to dismiss the modal.
	 * - A video display section with loading animation and a play icon.
	 * - Swipe hint overlay indicating vertical interaction.
	 *
	 * This markup is used when no product or CTA is linked to the video, focusing solely on video playback.
	 *
	 * @param int    $video_id            The ID of the video for which the modal is being rendered.
	 * @param string $instance_id         Unique ID for each GoDAM Gallery Block.
	 */
	private function generate_video_modal_markup( $video_id, $instance_id, ) {
		ob_start();

		?>
		<div class="godam-product-modal-container " data-modal-video-id="<?php echo esc_attr( $video_id ); ?>" data-gallery-id="<?php echo esc_attr( $instance_id ); ?>"> <!-- overlay container -->
			<div class="close">
				<button class="godam-product-modal-close" aria-label="<?php __( 'Close modal', 'godam' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path></svg>
				</button>
			</div>
			<div class="godam-product-modal-content no-sidebar">
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

		$html = ob_get_clean();
		return is_string( $html ) ? $html : '';
	}
}