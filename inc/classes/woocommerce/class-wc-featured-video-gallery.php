<?php

namespace RTGODAM\Inc\WooCommerce;

use RTGODAM\Inc\Traits\Singleton;

class WC_Featured_Video_Gallery {

	use Singleton;

	public function __construct() {
		add_action( 'admin_footer-post.php', array( $this, 'inject_gallery_video_field' ) );
			add_action( 'save_post_product', array( $this, 'save_gallery_video' ) );
			add_filter( 'woocommerce_single_product_image_thumbnail_html', array( $this, 'render_video_in_gallery' ), 20, 2 );
	}

	/**
	 * Inject fields into Product Gallery meta box
	 */
	public function inject_gallery_video_field() {
		$screen = get_current_screen();
		if ( $screen->post_type !== 'product' ) {
			return;
		}

		global $post;
		$video_url      = get_post_meta( $post->ID, '_gallery_video_url', true );
		$uploaded_video = get_post_meta( $post->ID, '_gallery_uploaded_video', true );
		?>

			<script>
			jQuery(document).ready(function($) {
				const videoWrapper = `
					<div id="wc-gallery-video-field" style="margin-top: 1em;">
						<strong>Product Gallery Video</strong>
						<p>
							<label>Video URL:</label><br>
							<input type="text" name="gallery_video_url" value="<?php echo esc_attr( $video_url ); ?>" style="width: 100%;" placeholder="https://youtube.com/..." />
						</p>
						<p>
							<label>Or upload from Media Library:</label><br>
							<input type="hidden" name="gallery_uploaded_video" id="gallery_uploaded_video" value="<?php echo esc_attr( $uploaded_video ); ?>" />
							<button type="button" class="button select-gallery-video">Upload / Select Video</button>
							<span class="gallery-video-preview" style="margin-left: 10px;"><?php echo $uploaded_video ? basename( $uploaded_video ) : ''; ?></span>
						</p>
					</div>
				`;

				$('#product_images_container').append(videoWrapper);

				$('.select-gallery-video').on('click', function(e) {
					e.preventDefault();
					const frame = wp.media({
						title: 'Select a Video',
						library: { type: 'video' },
						button: { text: 'Use this video' },
						multiple: false
					});
					frame.on('select', function() {
						const attachment = frame.state().get('selection').first().toJSON();
						$('#gallery_uploaded_video').val(attachment.url);
						$('.gallery-video-preview').text(attachment.filename);
					});
					frame.open();
				});
			});
			</script>

			<?php
	}

		/**
		 * Save video fields from gallery metabox
		 */
	public function save_gallery_video( $post_id ) {
		if ( isset( $_POST['gallery_video_url'] ) ) {
			update_post_meta( $post_id, '_gallery_video_url', esc_url_raw( $_POST['gallery_video_url'] ) );
		}

		if ( isset( $_POST['gallery_uploaded_video'] ) ) {
			update_post_meta( $post_id, '_gallery_uploaded_video', esc_url_raw( $_POST['gallery_uploaded_video'] ) );
		}
	}

		/**
		 * Render video in frontend gallery
		 */
	public function render_video_in_gallery( $html, $attachment_id ) {
		global $post;

		$product        = wc_get_product( $post->ID );
		$video_url      = get_post_meta( $post->ID, '_gallery_video_url', true );
		$uploaded_video = get_post_meta( $post->ID, '_gallery_uploaded_video', true );
		$video_source   = $uploaded_video ?: $video_url;

		// Only inject before the first image
		if ( $video_source && $attachment_id === $product->get_gallery_image_ids()[0] ) {
			$video_html = '<div class="woocommerce-product-gallery__image" data-thumb="' . esc_url( $video_source ) . '">';

			if ( strpos( $video_source, 'youtube.com' ) !== false || strpos( $video_source, 'youtu.be' ) !== false || strpos( $video_source, 'vimeo.com' ) !== false ) {
				$video_html .= '<div class="wc-video-iframe-wrapper" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">';
				$video_html .= '<iframe src="' . esc_url( $video_source ) . '" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>';
				$video_html .= '</div>';
			} else {
				$video_html .= '<video controls style="width:100%;">';
				$video_html .= '<source src="' . esc_url( $video_source ) . '" type="video/mp4">';
				$video_html .= '</video>';
			}

			$video_html .= '</div>';

			return $video_html . $html;
		}

		return $html;
	}
}