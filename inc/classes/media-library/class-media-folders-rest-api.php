<?php
/**
 * Media Folders REST API class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Media_Library;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Folders_REST_API
 */
class Media_Folders_REST_API {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for the class.
	 */
	private function setup_hooks() {
		add_filter( 'rest_prepare_media-folder', array( $this, 'add_data_to_media_folder_rest_api' ), 10, 2 );
	}

	/**
	 * Add additional data to the media folder REST API response.
	 *
	 * @param \WP_REST_Response $response The response object.
	 * @param \WP_Term          $term     The term object.
	 * @return \WP_REST_Response
	 */
	public function add_data_to_media_folder_rest_api( $response, $term ) {
		// Add the attachment count to the response.
		$response->data['attachmentCount'] = (int) Media_Folder_Utils::get_instance()->get_attachment_count( $term->term_id );

		return $response;
	}
}
