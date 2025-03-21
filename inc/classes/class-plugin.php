<?php
/**
 * Plugin manifest class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

defined( 'ABSPATH' ) || exit;

use Transcoder\Inc\Traits\Singleton;
use Transcoder\Inc\Pages;
use Transcoder\Inc\Blocks;
use Transcoder\Inc\Assets;
use Transcoder\Inc\Deactivation;
use Transcoder\Inc\Cron;

use Transcoder\Inc\Taxonomies\Media_Folders;

use Transcoder\Inc\REST_API\GF;
use Transcoder\Inc\REST_API\Settings;
use Transcoder\Inc\REST_API\Meta_Rest_Fields;
use Transcoder\Inc\REST_API\Media_Library;
use Transcoder\Inc\REST_API\Ads;
use Transcoder\Inc\REST_API\Transcoding;
use Transcoder\Inc\REST_API\Analytics;

/**
 * Class Plugin.
 */
class Plugin {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {

		// Load plugin classes.
		Assets::get_instance();
		Blocks::get_instance();
		Pages::get_instance();
		Media_Library_Ajax::get_instance();
		Cron::get_instance();

		$this->load_post_types();
		$this->load_taxonomies();
		$this->load_plugin_configs();
		$this->load_rest_api();
	}

	/**
	 * Load Post Types.
	 */
	public function load_post_types() {
	}

	/**
	 * Load Taxonomies.
	 */
	public function load_taxonomies() {
		Media_Folders::get_instance();
	}

	/**
	 * Load Plugin Configs.
	 */
	public function load_plugin_configs() {
	}

	/**
	 * Load REST API.
	 *
	 * @return void
	 */
	public function load_rest_api() {
		GF::get_instance();
		Settings::get_instance();
		Meta_Rest_Fields::get_instance();
		Media_Library::get_instance();
		Ads::get_instance();
		Transcoding::get_instance();
		Analytics::get_instance();
		Deactivation::get_instance();
	}
}
