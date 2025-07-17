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
use RTGODAM\Inc\Rewrite;
use RTGODAM\Inc\Video_Preview;
use RTGODAM\Inc\Video_Permalinks;

use RTGODAM\Inc\Post_Types\GoDAM_Video;

use RTGODAM\Inc\Taxonomies\Media_Folders;

use RTGODAM\Inc\REST_API\Jetpack;
use RTGODAM\Inc\REST_API\GF;
use RTGODAM\Inc\REST_API\CF7;
use RTGODAM\Inc\REST_API\WPForms;
use RTGODAM\Inc\REST_API\Forminator_Forms;
use RTGODAM\INC\REST_API\SureForms;
use RTGODAM\Inc\REST_API\Fluent_Forms;
use RTGODAM\Inc\REST_API\Everest_Forms;
use RTGODAM\Inc\REST_API\Settings;
use RTGODAM\Inc\REST_API\Meta_Rest_Fields;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Ads;
use RTGODAM\Inc\REST_API\Transcoding;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Polls;
use RTGODAM\Inc\REST_API\Dynamic_Shortcode;
use RTGODAM\Inc\REST_API\Dynamic_Gallery;
use RTGODAM\Inc\Gravity_Forms;

use RTGODAM\Inc\Shortcodes\GoDAM_Player;
use RTGODAM\Inc\Shortcodes\GoDAM_Video_Gallery;

use RTGODAM\Inc\Cron_Jobs\Retranscode_Failed_Media;
use RTGODAM\Inc\Video_Metadata;

use RTGODAM\Inc\Media_Library\Media_Folders_REST_API;
use RTGODAM\Inc\WPForms\WPForms_Integration;
use RTGODAM\Inc\Media_Library\Media_Edit_Enhancements;

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
		Rewrite::get_instance();
		Video_Preview::get_instance();
		Video_Permalinks::get_instance();

		// Load shortcodes.
		GoDAM_Player::get_instance();
		GoDAM_Video_Gallery::get_instance();

		$this->load_post_types();
		$this->load_taxonomies();
		$this->load_plugin_configs();
		$this->load_rest_api();
		$this->init_gravity_forms();
		$this->load_sureforms();
		$this->load_fluentforms();

		WPForms_Integration::get_instance()->init();

		// Load cron jobs.
		Retranscode_Failed_Media::get_instance();

		// Load video metadata.
		Video_Metadata::get_instance();

		// Load Elementor widgets.
		$this->load_elementor_widgets();

		$this->load_media_library();
	}

	/**
	 * Load Post Types.
	 */
	public function load_post_types() {
		GoDAM_Video::get_instance();
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
		Jetpack::get_instance();
		GF::get_instance();
		CF7::get_instance();
		WPForms::get_instance();
		Forminator_Forms::get_instance();
		SureForms::get_instance();
		Fluent_Forms::get_instance();
		Everest_Forms::get_instance();
		Settings::get_instance();
		Meta_Rest_Fields::get_instance();
		Media_Library::get_instance();
		Ads::get_instance();
		Transcoding::get_instance();
		Analytics::get_instance();
		Deactivation::get_instance();
		Polls::get_instance();
		Dynamic_Shortcode::get_instance();
		Dynamic_Gallery::get_instance();
	}

	/**
	 * Load all the classes related to the media library.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	private function load_media_library() {
		Media_Folders_REST_API::get_instance();
		Media_Edit_Enhancements::get_instance();
	}

	/**
	 * Registers the elementor widgets if required.
	 *
	 * @return void
	 */
	public function load_elementor_widgets() {
		if ( ! did_action( 'elementor/loaded' ) ) {
			return;
		}

		Elementor_Widgets::get_instance();
	}

	/**
	 * Init Gravity Forms
	 */
	public function init_gravity_forms() {
		Gravity_Forms\Init::get_instance();
	}

	/**
	 * Initialize SureForms Extension class.
	 *
	 * @return void
	 */
	public function load_sureforms() {
		\RTGODAM\Inc\Sureforms\Init::get_instance();
	}

	/**
	 * Initialize FluentForms Extension class.
	 *
	 * @return void
	 */
	public function load_fluentforms() {
		\RTGODAM\Inc\FluentForms\Init::get_instance();
	}
}
