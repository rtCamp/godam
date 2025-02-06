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
use Transcoder\Inc\REST_API\Analytics;
use Transcoder\Inc\REST_API\Video_Comments;

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
		// $this->load_attachment_templates();

		// TODO: think of a better place to put this.
		$offload_media = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );
		$offload_media = isset( $offload_media['offLoadMedia'] ) ? $offload_media['offLoadMedia'] : false;
		
		$offload_media = false; // disabling the S3 bucket for now

		if ( $offload_media ) {
			Media_Filters::get_instance();
		}
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
		Video_Comments::get_instance();
	}

	public function load_attachment_templates() {
		add_filter( 'pre_option_wp_attachment_pages_enabled', '__return_true' );
		remove_filter( 'the_content', 'prepend_attachment' );

		add_filter( 'render_block_core/post-content', array( $this, 'godam_render_block' ), 10, 3 );
	}

	public function godam_render_block( $block_content, $block, $instance ) {

		// Custom code will go here.
		if (
			empty( $instance->context['postId'] )
			|| ! is_attachment( $instance->context['postId'] )
		) {
			return $block_content;
		}

		$html     = '';
		$located  = RT_TRANSCODER_PATH . 'inc/classes/templates/attachment-media-video.php';

		ob_start();

		load_template( $located, true );

		$block_markup = ob_get_clean();

		if ( ! $block_markup ) {
			return $block_content;
		}

		foreach ( parse_blocks( $block_markup ) as $parsed_block ) {
			$html .= render_block( $parsed_block );
		}
		
		return $html . $block_content;
	}
}
