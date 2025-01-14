<?php
/**
 * Plugin manifest class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;
use Transcoder\Inc\Pages;
use Transcoder\Inc\Blocks;
use Transcoder\Inc\Assets;

use Transcoder\Inc\Taxonomies\Media_Folders;

use Transcoder\Inc\REST_API\GF;
use Transcoder\Inc\REST_API\Settings;
use Transcoder\Inc\REST_API\Meta_Rest_Fields;
use Transcoder\Inc\REST_API\Media_Library;
use Transcoder\Inc\REST_API\Ads;
use Transcoder\Inc\REST_API\Transcoding;

use Transcoder\Inc\Providers\Media_Filters;

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

		$this->load_post_types();
		$this->load_taxonomies();
		$this->load_plugin_configs();
		$this->load_rest_api();

		// TODO: think of a better place to put this.
		$offload_media = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );
		$offload_media = isset( $offload_media['offLoadMedia'] ) ? $offload_media['offLoadMedia'] : false;
		
		$offload_media = false; // disabling the S3 bucket for now

		if ( $offload_media ) {
			Media_Filters::get_instance();
		}

		// TODO: think of a better place to put this.
		// Add a custom "Edit Video" button for video files in the Media Library.
		add_filter(
			'attachment_fields_to_edit',
			function ( $form_fields, $post ) {
				// Check if the file is a video.
				$mime_type = get_post_mime_type( $post->ID );
				if ( strpos( $mime_type, 'video/' ) !== false ) {
					// Generate the edit video link (adjust URL as needed).
					$edit_url = admin_url( 'admin.php?page=video_editor&id=' . $post->ID );

					// Add a new field for the Edit Video button.
					$form_fields['edit_video'] = array(
						'label' => '',
						'input' => 'html',
						'html'  => '<a href="' . esc_url( $edit_url ) . '" class="button button-primary" target="_blank">Edit Video</a>',
					);
				}

				return $form_fields;
			},
			10,
			2
		);

		// Add a custom "View Analytics" button for video files in the Media Library.
		add_filter(
			'attachment_fields_to_edit',
			function ( $form_fields, $post ) {
				// Check if the file is a video.
				$mime_type = get_post_mime_type( $post->ID );
				if ( strpos( $mime_type, 'video/' ) !== false ) {
					// Generate the analytics page link (adjust URL as needed).
					$edit_url = admin_url( 'admin.php?page=analytics&id=' . $post->ID );

					// Add a new field for the View Analysis button.
					$form_fields['analysis'] = array(
						'label' => '',
						'input' => 'html',
						'html'  => '<a href="' . esc_url( $edit_url ) . '" class="button button-primary" target="_blank">View Analytics</a>',
					);
				}

				return $form_fields;
			},
			10,
			2
		);
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
	}
}
