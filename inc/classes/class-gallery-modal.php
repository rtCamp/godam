<?php
/**
 * Gallery Modal Class.
 *
 * Handles template loading for gallery modal iframe pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Gallery_Modal.
 *
 * Manages template loading for gallery modal iframe functionality.
 */
class Gallery_Modal {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'template_include', array( $this, 'rtgodam_load_gallery_modal_template' ) );
	}

	/**
	 * Load the gallery modal template.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $template The current template.
	 * @return string The path to the gallery modal template.
	 */
	public function rtgodam_load_gallery_modal_template( $template ) {
		if ( 'gallery-modal' !== get_query_var( 'godam_page' ) ) {
			return $template;
		}

		$attachment_id = absint( get_query_var( 'id' ) );

		// Validate attachment ID.
		if ( ! $attachment_id ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Check if attachment exists and is valid.
		$attachment = get_post( $attachment_id );
		if ( ! $attachment || 
			'attachment' !== $attachment->post_type || 
			'inherit' !== $attachment->post_status ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Check if it's a video attachment.
		if ( ! wp_attachment_is( 'video', $attachment_id ) ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Include the modal template.
		$template_path = RTGODAM_PATH . 'inc/templates/godam-gallery-modal.php';
		if ( file_exists( $template_path ) ) {
			include $template_path;
			exit;
		}

		// Fallback 404 if template doesn't exist.
		status_header( 404 );
		nocache_headers();
		get_template_part( '404' );
		exit;
	}
}
