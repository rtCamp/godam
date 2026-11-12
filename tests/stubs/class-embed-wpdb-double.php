<?php
/**
 * A $wpdb stand-in for the GoDAM share URL lookup in Embed.
 *
 * get_var() answers from a job ID => attachment ID map and records each
 * prepared query, so a test can tell how often the database was asked.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

/**
 * Class Embed_Wpdb_Double
 */
class Embed_Wpdb_Double {

	/**
	 * Post meta table name.
	 *
	 * @var string
	 */
	public $postmeta = 'wp_postmeta';

	/**
	 * Posts table name.
	 *
	 * @var string
	 */
	public $posts = 'wp_posts';

	/**
	 * Attachment IDs by job ID.
	 *
	 * @var array<string, int>
	 */
	public $attachments = array();

	/**
	 * Job IDs looked up, in order.
	 *
	 * @var string[]
	 */
	public $lookups = array();

	/**
	 * Keep the query and its argument together.
	 *
	 * @param string $query Query with a %s placeholder.
	 * @param string $value Job ID.
	 *
	 * @return array{0: string, 1: string}
	 */
	public function prepare( $query, $value ) {
		return array( $query, $value );
	}

	/**
	 * Answer the lookup from the map.
	 *
	 * @param array{0: string, 1: string} $prepared What prepare() returned.
	 *
	 * @return string|null
	 */
	public function get_var( $prepared ) {
		$this->lookups[] = $prepared[1];

		return isset( $this->attachments[ $prepared[1] ] ) ? (string) $this->attachments[ $prepared[1] ] : null;
	}
}
