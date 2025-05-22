<?php
/**
 * Plugin manifest class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Pages;
use RTGODAM\Inc\Blocks;
use RTGODAM\Inc\Assets;
use RTGODAM\Inc\Deactivation;
use RTGODAM\Inc\Media_Tracker;

use RTGODAM\Inc\Taxonomies\Media_Folders;

use RTGODAM\Inc\REST_API\GF;
use RTGODAM\Inc\REST_API\CF7;
use RTGODAM\Inc\REST_API\WPForms;
use RTGODAM\Inc\REST_API\Settings;
use RTGODAM\Inc\REST_API\Meta_Rest_Fields;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Ads;
use RTGODAM\Inc\REST_API\Transcoding;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Polls;

use RTGODAM\Inc\Shortcodes\GoDAM_Player;

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
		Media_Tracker::get_instance();
		Seo::get_instance();

		// Load shortcodes.
		GoDAM_Player::get_instance();

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
		CF7::get_instance();
		WPForms::get_instance();
		Settings::get_instance();
		Meta_Rest_Fields::get_instance();
		Media_Library::get_instance();
		Ads::get_instance();
		Transcoding::get_instance();
		Analytics::get_instance();
		Deactivation::get_instance();
		Polls::get_instance();
	}
}
