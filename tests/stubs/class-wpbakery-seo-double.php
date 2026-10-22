<?php
/**
 * Test double for reading WPBakery Video SEO data without the Media Library.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use RTGODAM\Inc\Seo;

/**
 * Seo with the Media Library lookup replaced by fixed data.
 */
class Wpbakery_Seo_Double extends Seo {

	/**
	 * SEO data per attachment ID; a missing ID means the video is gone.
	 *
	 * @var array<int, array>
	 */
	public $media = array();

	/**
	 * @param int  $attachment_id Attachment ID.
	 * @param bool $allow_remote  Ignored.
	 * @return array
	 */
	public function get_seo_from_attachment( $attachment_id, $allow_remote = true ) {
		return $this->media[ $attachment_id ] ?? array();
	}
}
