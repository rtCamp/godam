<?php
/**
 * Video_Migration test double for the Vimeo resolver tests.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use RTGODAM\Inc\REST_API\Video_Migration;

/**
 * Video_Migration with GoDAM Central replaced by a lookup table.
 */
class Vimeo_Migration_Double extends Video_Migration {

	/**
	 * Vimeo URLs looked up in "Central".
	 *
	 * @var string[]
	 */
	public $lookups = array();

	/**
	 * Attachment ID to return, or null for a failed lookup.
	 *
	 * @var int|null
	 */
	public $attachment_id = 501;

	/**
	 * Record the lookup instead of calling GoDAM Central.
	 *
	 * @param string $vimeo_url Vimeo URL.
	 *
	 * @return int|\WP_Error
	 */
	public function create_attachment_from_vimeo_video( $vimeo_url ) {
		$this->lookups[] = $vimeo_url;

		return null === $this->attachment_id ? new \WP_Error( 'invalid_response', 'Invalid response from GoDAM Central.' ) : $this->attachment_id;
	}
}
