<?php
/**
 * Gallery Modal Class.
 *
 * Handles rewrite rules for gallery modal iframe pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Gallery_Modal.
 *
 * Manages rewrite rules for gallery modal iframe functionality.
 */
class Gallery_Modal {
	use Singleton;

	/**
	 * Query var for gallery modal.
	 *
	 * @var string
	 */
	const QUERY_VAR = 'rtgodam_video_modal';

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_action( 'init', array( $this, 'add_rewrite_rules' ) );
		add_filter( 'query_vars', array( $this, 'add_query_vars' ) );
		add_action( 'template_redirect', array( $this, 'template_redirect' ) );
	}

	/**
	 * Add rewrite rules for gallery modal.
	 */
	public function add_rewrite_rules() {
		add_rewrite_rule(
			'^godam-video-modal/?$',
			'index.php?' . self::QUERY_VAR . '=1',
			'top'
		);

		// Flush rewrite rules on activation (only once)
		if ( ! get_option( 'rtgodam_gallery_modal_rewrite_flushed' ) ) {
			flush_rewrite_rules();
			update_option( 'rtgodam_gallery_modal_rewrite_flushed', true );
		}
	}

	/**
	 * Add query vars for gallery modal.
	 *
	 * @param array $vars Existing query vars.
	 * @return array Modified query vars.
	 */
	public function add_query_vars( $vars ) {
		$vars[] = self::QUERY_VAR;
		$vars[] = 'id';
		return $vars;
	}

	/**
	 * Handle template redirect for gallery modal.
	 */
	public function template_redirect() {
		if ( ! get_query_var( self::QUERY_VAR ) ) {
			return;
		}

		$attachment_id = absint( get_query_var( 'id' ) );

		// Validate attachment ID
		if ( ! $attachment_id ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Check if attachment exists and is valid
		$attachment = get_post( $attachment_id );
		if ( ! $attachment || 
			 'attachment' !== $attachment->post_type || 
			 'inherit' !== $attachment->post_status ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Check if it's a video attachment
		if ( ! wp_attachment_is( 'video', $attachment_id ) ) {
			status_header( 404 );
			nocache_headers();
			get_template_part( '404' );
			exit;
		}

		// Include the modal template
		$template_path = RTGODAM_PATH . 'inc/templates/godam-gallery-modal.php';
		if ( file_exists( $template_path ) ) {
			include $template_path;
			exit;
		}

		// Fallback 404 if template doesn't exist
		status_header( 404 );
		nocache_headers();
		get_template_part( '404' );
		exit;
	}
}