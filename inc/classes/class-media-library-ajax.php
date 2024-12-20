<?php
/**
 * Class to handle Media Folders.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Media_Library
 */
class Media_Library_Ajax {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_filter( 'ajax_query_attachments_args', array( $this, 'filter_media_library_by_taxonomy' ) );
	}

	/**
	 * Filter the media library arguments to include folders.
	 *
	 * @return void
	 */
	public function filter_media_library_by_taxonomy( $query_args ) {

		if ( isset( $_REQUEST['query']['media-folder'] ) ) {
			$media_folder_id = intval( $_REQUEST['query']['media-folder'] );
	
			if ( 0 === $media_folder_id ) {
				// Handling uncategorized attachments (no term selected for attachment).
				$query_args['tax_query'] = array(
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => get_terms(
							array(
								'taxonomy'   => 'media-folder',
								'fields'     => 'ids',
								'hide_empty' => false,
							)
						),
						'operator'         => 'NOT IN',
						'include_children' => false,
					),
				);
	
			} else if ( ! empty( $media_folder_id ) ) {
				// Filter attachments by selected folder.
				$query_args['tax_query'] = array(
					array(
						'taxonomy'         => 'media-folder',
						'field'            => 'term_id',
						'terms'            => $media_folder_id,
						'include_children' => false,
					),
				);	
			}

			unset( $query_args['media-folder'] );

		}
	
		return $query_args;
	}
}
