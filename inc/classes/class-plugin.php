<?php
/**
 * Plugin manifest class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use \Transcoder\Inc\Traits\Singleton;
use \Transcoder\Inc\Pages;
use \Transcoder\Inc\Blocks;
use \Transcoder\Inc\Assets;

/**
 * Class Plugin
 */
class Plugin {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {

		// Load plugin classes.
		Assets::get_instance();
		$this->load_post_types();
		$this->load_taxonomies();
		$this->load_plugin_configs();
		Blocks::get_instance();
		Pages::get_instance();


		// Add a custom "Edit Video" button for video files in the Media Library
		add_filter('attachment_fields_to_edit', function ($form_fields, $post) {
			// Check if the file is a video
			$mime_type = get_post_mime_type($post->ID);
			if (strpos($mime_type, 'video/') !== false) {
				// Generate the edit video link (adjust URL as needed)
				$edit_url = admin_url('admin.php?page=video_editor&id=' . $post->ID);

				// Add a new field for the Edit Video button
				$form_fields['edit_video'] = [
					'label' => '',
					'input' => 'html',
					'html'  => '<a href="' . esc_url($edit_url) . '" class="button button-primary" target="_blank">Edit Video</a>',
				];
			}

			return $form_fields;
		}, 10, 2);
	}

	/**
	 * Load Post Types.
	 */
	public function load_post_types() {

		// Load all post types.

	}

	/**
	 * Load Taxonomies.
	 */
	public function load_taxonomies() {

		// Load all taxonomies classes.

	}

	/**
	 * Load Plugin Configs.
	 */
	public function load_plugin_configs() {

		// Load all plugin configs.

	}

}
