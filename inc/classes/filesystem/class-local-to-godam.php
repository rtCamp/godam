<?php
/**
 * Local to GoDAM Filter Class
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

defined( 'ABSPATH' ) || exit;

/**
 * Local to GoDAM Filter Class
 *
 * Handles replacing local URLs with GoDAM CDN URLs in content.
 */
class Local_To_GoDAM extends Base_Filter {

	/**
	 * Set up the filter hooks.
	 *
	 * @since n.e.x.t
	 */
	public function setup() {
		parent::setup();

		// Posts and Content.
		add_action( 'the_post', array( $this, 'filter_post_data' ) );
		add_filter( 'content_pagination', array( $this, 'filter_content_pagination' ) );
		add_filter( 'the_content', array( $this, 'filter_post' ), 100 );
		add_filter( 'the_excerpt', array( $this, 'filter_post' ), 100 );
		add_filter( 'rss_enclosure', array( $this, 'filter_post' ), 100 );
		add_filter( 'content_edit_pre', array( $this, 'filter_post' ) );
		add_filter( 'excerpt_edit_pre', array( $this, 'filter_post' ) );

		// Additional hooks for modern editor compatibility.
		add_filter( 'rest_prepare_post', array( $this, 'filter_post' ), 100 );
		add_filter( 'rest_prepare_page', array( $this, 'filter_post' ), 100 );
		add_filter( 'get_the_content', array( $this, 'filter_post' ), 100 );
		add_filter( 'get_the_excerpt', array( $this, 'filter_post' ), 100 );

		// Block editor specific hooks.
		add_filter( 'block_editor_rest_api_preload_paths', array( $this, 'filter_rest_preload_paths' ), 100 );
		// Widgets.
		add_filter( 'widget_form_callback', array( $this, 'filter_widget_display' ) );
		add_filter( 'widget_display_callback', array( $this, 'filter_widget_display' ) );
		if ( function_exists( 'is_wp_version_compatible' ) && is_wp_version_compatible( '5.8' ) ) {
			add_filter( 'customize_value_widget_block', array( $this, 'filter_customize_value_widget_block' ) );
			add_filter( 'widget_block_content', array( $this, 'filter_widget_block_content' ) );
		}

		// Customizer.
		add_filter( 'theme_mod_background_image', array( $this, 'filter_customizer_image' ) );
		add_filter( 'theme_mod_header_image', array( $this, 'filter_customizer_image' ) );
		add_filter( 'customize_value_custom_css', array( $this, 'filter_customize_css' ), 10, 2 );
		add_filter( 'wp_get_custom_css', array( $this, 'filter_wp_get_custom_css' ), 10, 2 );

		// Blocks and Templates.
		if ( function_exists( 'is_wp_version_compatible' ) && is_wp_version_compatible( '5.9' ) ) {
			add_filter( 'render_block', array( $this, 'filter_render_block' ), 100 );
			add_filter( 'get_block_templates', array( $this, 'filter_get_block_templates' ), 100, 3 );
			add_filter( 'get_block_template', array( $this, 'filter_get_block_template' ), 100, 3 );
		}

		// Media Library URLs.
		add_filter( 'wp_get_attachment_url', array( $this, 'filter_attachment_url' ), 100, 2 );
		add_filter( 'wp_get_attachment_image_src', array( $this, 'filter_attachment_image_src' ), 100, 4 );
		add_filter( 'wp_get_attachment_image_attributes', array( $this, 'filter_attachment_image_attributes' ), 100, 3 );
		add_filter( 'wp_get_attachment_image', array( $this, 'filter_attachment_image' ), 100 );
		add_filter( 'post_thumbnail_html', array( $this, 'filter_post_thumbnail_html' ), 100 );
		add_filter( 'wp_calculate_image_srcset', array( $this, 'filter_image_srcset' ), 100, 5 );
		add_filter( 'wp_calculate_image_sizes', array( $this, 'filter_image_sizes' ), 100 );
		add_filter( 'wp_get_attachment_image_srcset', array( $this, 'filter_attachment_image_srcset' ), 100 );
		add_filter( 'wp_get_attachment_image_sizes', array( $this, 'filter_attachment_image_sizes' ), 100 );
		add_filter( 'wp_get_attachment_metadata', array( $this, 'filter_attachment_metadata' ), 100 );
		add_filter( 'wp_get_attachment_thumb_url', array( $this, 'filter_attachment_thumb_url' ), 100 );
		add_filter( 'wp_get_attachment_thumb_file', array( $this, 'filter_attachment_thumb_file' ), 100 );

		// Shortcodes.
		add_filter( 'wp_video_shortcode', array( $this, 'filter_video_shortcode' ), 100 );
		add_filter( 'wp_audio_shortcode', array( $this, 'filter_audio_shortcode' ), 100 );

		// HTTPS Enforcement.
		add_filter( 'set_url_scheme', array( $this, 'set_url_scheme' ), 10, 3 );
	}

	/**
	 * Filter post data.
	 *
	 * @param \WP_Post $post The post object.
	 */
	public function filter_post_data( $post ) {
		// Prepare post for filtering.
	}

	/**
	 * Filter post content.
	 *
	 * @since n.e.x.t
	 *
	 * @param string|object $content The post content or REST response object.
	 *
	 * @return string|object Filtered content or original object.
	 */
	public function filter_post( $content ) {
		// Handle WP_REST_Response objects (from rest_prepare_post).
		if ( is_object( $content ) && method_exists( $content, 'get_data' ) ) {
			return $this->filter_rest_response( $content );
		}

		// Handle strings (from the_content, the_excerpt, etc.).
		if ( is_string( $content ) ) {
			if ( empty( $content ) ) {
				return $content;
			}

			$cache    = array();
			$to_cache = array();

			$filtered_content = $this->process_content( $content, $cache, $to_cache );

			return $filtered_content;
		}

		return $content;
	}

	/**
	 * Filter content pagination.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $pages Array of content pages.
	 *
	 * @return array Filtered pages.
	 */
	public function filter_content_pagination( $pages ) {
		if ( empty( $pages ) || ! is_array( $pages ) ) {
			return $pages;
		}

		$cache    = array();
		$to_cache = array();

		foreach ( $pages as $key => $page ) {
			$pages[ $key ] = $this->process_content( $page, $cache, $to_cache );
		}

		return $pages;
	}

	/**
	 * Filter widget display.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $instance Widget instance.
	 *
	 * @return array Filtered instance.
	 */
	public function filter_widget_display( $instance ) {
		return $this->handle_widget( $instance );
	}

	/**
	 * Filter widget block for customizer.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $value Widget block value.
	 *
	 * @return array Filtered value.
	 */
	public function filter_customize_value_widget_block( $value ) {
		return $this->handle_widget( $value );
	}

	/**
	 * Filter widget block content.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content Widget block content.
	 *
	 * @return string Filtered content.
	 */
	public function filter_widget_block_content( $content ) {
		if ( empty( $content ) ) {
			return $content;
		}

		$cache    = array();
		$to_cache = array();

		return $this->process_content( $content, $cache, $to_cache );
	}

	/**
	 * Filter customizer image.
	 *
	 * @since n.e.x.t
	 *
	 * @param string|object $value Image URL or header image object.
	 *
	 * @return string|object Filtered value.
	 */
	public function filter_customizer_image( $value ) {
		// Handle header image objects (stdClass with url property).
		if ( is_object( $value ) && isset( $value->url ) ) {
			$url = $value->url;
			if ( ! empty( $url ) && $this->url_needs_replacing( $url ) ) {
				$new_url = $this->get_replacement_url( $url );
				if ( $new_url ) {
					$value->url = $new_url;
				}
			}
			return $value;
		}

		// Handle string URLs.
		if ( is_string( $value ) && ! empty( $value ) && $this->url_needs_replacing( $value ) ) {
			$new_url = $this->get_replacement_url( $value );
			return $new_url ? $new_url : $value;
		}

		return $value;
	}

	/**
	 * Filter customizer CSS.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $css  The CSS.
	 * @param string $type The CSS type.
	 *
	 * @return string Filtered CSS.
	 */
	public function filter_customize_css( $css, $type ) {
		return $this->filter_post( $css );
	}

	/**
	 * Filter custom CSS.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $css  The CSS.
	 * @param string $type The CSS type.
	 *
	 * @return string Filtered CSS.
	 */
	public function filter_wp_get_custom_css( $css, $type ) {
		return $this->filter_post( $css );
	}

	/**
	 * Filter rendered block.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $block_content Block content.
	 *
	 * @return string Filtered content.
	 */
	public function filter_render_block( $block_content ) {
		return $this->filter_post( $block_content );
	}

	/**
	 * Filter block templates.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $query_result  Array of block templates.
	 * @param array  $query         Query arguments.
	 * @param string $template_type Template type.
	 *
	 * @return array Filtered templates.
	 */
	public function filter_get_block_templates( $query_result, $query, $template_type ) {
		if ( empty( $query_result ) ) {
			return $query_result;
		}

		foreach ( $query_result as $block_template ) {
			$block_template = $this->filter_get_block_template( $block_template, $block_template->id, $template_type );
		}

		return $query_result;
	}

	/**
	 * Filter block template.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Block_Template|null $block_template The block template.
	 * @param string                  $id             Template ID.
	 * @param string                  $template_type  Template type.
	 *
	 * @return \WP_Block_Template|null Filtered template.
	 */
	public function filter_get_block_template( $block_template, $id, $template_type ) {
		if ( empty( $block_template ) ) {
			return $block_template;
		}

		$content = $block_template->content;

		if ( empty( $content ) ) {
			return $block_template;
		}

		$filtered_content = $this->filter_post( $content );

		if ( ! empty( $filtered_content ) && $filtered_content !== $block_template->content ) {
			$block_template->content = $filtered_content;
		}

		return $block_template;
	}

	/**
	 * Filter attachment URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url     Attachment URL.
	 * @param int    $post_id Attachment post ID.
	 *
	 * @return string Filtered URL.
	 */
	public function filter_attachment_url( $url, $post_id ) {
		// Check if attachment is migrated to GoDAM.
		$is_migrated = get_post_meta( $post_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $url;
		}

		$item_source = array(
			'id'          => $post_id,
			'source_type' => 'media-library',
		);

		$new_url = $this->get_url( $item_source );
		return $new_url ? $new_url : $url;
	}

	/**
	 * Filter attachment image src.
	 *
	 * @since n.e.x.t
	 *
	 * @param array|false      $image         Image data or false.
	 * @param int              $attachment_id Attachment ID.
	 * @param string|int|array $size          Image size.
	 * @param bool             $icon          Whether to show icon.
	 *
	 * @return array|false Filtered image data.
	 */
	public function filter_attachment_image_src( $image, $attachment_id, $size, $icon ) {
		if ( ! $image || ! isset( $image[0] ) ) {
			return $image;
		}

		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $image;
		}

		$item_source = array(
			'id'          => $attachment_id,
			'source_type' => 'media-library',
		);

		$new_url = $this->get_url( $item_source, $size );
		if ( $new_url ) {
			$image[0] = $new_url;
		}

		return $image;
	}

	/**
	 * Filter attachment image attributes.
	 *
	 * @since n.e.x.t
	 *
	 * @param array    $attr       Image attributes.
	 * @param \WP_Post $attachment Attachment post.
	 * @param string   $size       Image size.
	 *
	 * @return array Filtered attributes.
	 */
	public function filter_attachment_image_attributes( $attr, $attachment, $size ) {
		$is_migrated = get_post_meta( $attachment->ID, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $attr;
		}

		if ( ! empty( $size ) && ! empty( $attr['src'] ) ) {
			$item_source = array(
				'id'          => $attachment->ID,
				'source_type' => 'media-library',
			);

			$new_url = $this->get_url( $item_source, $size );
			if ( $new_url ) {
				$attr['src'] = $new_url;
			}
		}

		return $attr;
	}

	/**
	 * Filter attachment image HTML.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $html Image HTML.
	 *
	 * @return string Filtered HTML.
	 */
	public function filter_attachment_image( $html ) {
		return $this->filter_post( $html );
	}

	/**
	 * Filter post thumbnail HTML.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $html Thumbnail HTML.
	 *
	 * @return string Filtered HTML.
	 */
	public function filter_post_thumbnail_html( $html ) {
		return $this->filter_post( $html );
	}

	/**
	 * Filter image srcset sources.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $sources       {
	 *     One or more arrays of source data to include in the 'srcset'.
	 *
	 *     @type array $width {
	 *         @type string $url        The URL of an image source.
	 *         @type string $descriptor The descriptor type used in the image candidate string,
	 *                                  either 'w' or 'x'.
	 *         @type int    $value      The source width if paired with a 'w' descriptor, or a
	 *                                  pixel density value if paired with an 'x' descriptor.
	 *     }
	 * }
	 * @param array  $size_array    Array of width and height values.
	 * @param string $image_src     The 'src' of the image.
	 * @param array  $image_meta    The image meta data as returned by 'wp_get_attachment_metadata()'.
	 * @param int    $attachment_id Image attachment ID or 0.
	 *
	 * @return array Filtered sources array.
	 */
	public function filter_image_srcset( $sources, $size_array, $image_src, $image_meta, $attachment_id ) {
		// Validate parameters.
		if ( empty( $sources ) || ! is_array( $sources ) ) {
			return $sources;
		}

		if ( ! is_numeric( $attachment_id ) || $attachment_id <= 0 ) {
			return $sources;
		}

		// Check if attachment is migrated to GoDAM.
		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return $sources;
		}

		// Get upload directories for URL replacement.
		$upload_dirs = $this->plugin->get_original_upload_dir();
		if ( ! is_array( $upload_dirs ) || empty( $upload_dirs['baseurl'] ) ) {
			return $sources;
		}

		$cdn_base   = rtrim( $this->plugin->get_remote_url(), '/' );
		$local_base = rtrim( $upload_dirs['baseurl'], '/' );

		// Replace local URLs with CDN URLs in each source.
		foreach ( $sources as $width => $source ) {
			if ( isset( $source['url'] ) && $this->url_needs_replacing( $source['url'] ) ) {
				$sources[ $width ]['url'] = str_replace( $local_base, $cdn_base, $source['url'] );
			}
		}

		return $sources;
	}

	/**
	 * Filter image sizes.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $sizes Image sizes.
	 *
	 * @return string Filtered sizes.
	 */
	public function filter_image_sizes( $sizes ) {
		return $sizes;
	}

	/**
	 * Filter attachment image srcset.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $srcset Attachment srcset.
	 *
	 * @return string Filtered srcset.
	 */
	public function filter_attachment_image_srcset( $srcset ) {
		return $this->filter_post( $srcset );
	}

	/**
	 * Filter attachment image sizes.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $sizes Attachment sizes.
	 *
	 * @return string Filtered sizes.
	 */
	public function filter_attachment_image_sizes( $sizes ) {
		return $sizes;
	}

	/**
	 * Filter attachment metadata.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $metadata Attachment metadata.
	 *
	 * @return array Filtered metadata.
	 */
	public function filter_attachment_metadata( $metadata ) {
		return $metadata;
	}

	/**
	 * Filter attachment thumbnail URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url Thumbnail URL.
	 *
	 * @return string Filtered URL.
	 */
	public function filter_attachment_thumb_url( $url ) {
		if ( ! $this->url_needs_replacing( $url ) ) {
			return $url;
		}

		$new_url = $this->get_replacement_url( $url );
		return $new_url ? $new_url : $url;
	}

	/**
	 * Filter attachment thumbnail file.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file Thumbnail file path.
	 *
	 * @return string Filtered file path.
	 */
	public function filter_attachment_thumb_file( $file ) {
		return $file;
	}

	/**
	 * Filter video shortcode.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $output Video shortcode output.
	 *
	 * @return string Filtered output.
	 */
	public function filter_video_shortcode( $output ) {
		return $this->filter_post( $output );
	}

	/**
	 * Filter audio shortcode.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $output Audio shortcode output.
	 *
	 * @return string Filtered output.
	 */
	public function filter_audio_shortcode( $output ) {
		return $this->filter_post( $output );
	}

	/**
	 * Set URL scheme.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url         The URL.
	 * @param string $scheme      The scheme.
	 * @param string $orig_scheme Original scheme.
	 *
	 * @return string Modified URL.
	 */
	public function set_url_scheme( $url, $scheme, $orig_scheme ) {
		// Force HTTPS for CDN URLs if needed.
		if ( 'http' === $scheme && empty( $orig_scheme ) && $this->should_filter_content() && ! $this->url_needs_replacing( $url ) ) {
			$parts = wp_parse_url( $url );

			if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) || 'http' !== $parts['scheme'] ) {
				return $url;
			}

			$cdn_host = wp_parse_url( $this->plugin->get_remote_url(), PHP_URL_HOST );
			if ( $parts['host'] === $cdn_host ) {
				return substr_replace( $url, 'https', 0, 4 );
			}
		}

		return $url;
	}

	/**
	 * Check if content should be filtered.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if content should be filtered.
	 */
	protected function should_filter_content() {
		return true;
	}

	/**
	 * Check if URL needs replacing.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url The URL to check.
	 *
	 * @return bool True if URL needs replacing.
	 */
	public function url_needs_replacing( $url ) {
		if ( empty( $url ) ) {
			return false;
		}

		// Parse the URL to get its components.
		$parsed_url = wp_parse_url( $url );
		if ( ! $parsed_url || empty( $parsed_url['host'] ) ) {
			return false;
		}

		// Get the current site's host from WordPress home option to avoid infinite loops.
		$home_url = get_option( 'home' );
		if ( empty( $home_url ) ) {
			return false;
		}

		$home_parsed = wp_parse_url( $home_url );
		if ( ! $home_parsed || empty( $home_parsed['host'] ) ) {
			return false;
		}

		// Remove port from both hosts if present for comparison.
		$current_host = preg_replace( '/:\d+$/', '', $home_parsed['host'] );
		$url_host     = preg_replace( '/:\d+$/', '', $parsed_url['host'] );

		// Check if the URL belongs to the current site and contains wp-content/uploads.
		$is_current_site  = ( $url_host === $current_host );
		$has_uploads_path = strpos( $url, '/wp-content/uploads' ) !== false;

		return $is_current_site && $has_uploads_path;
	}

	/**
	 * Get URL for item source.
	 *
	 * @since n.e.x.t
	 *
	 * @param array       $item_source The item source data.
	 * @param string|null $object_key  Optional object key.
	 *
	 * @return string|false The CDN URL or false if not found.
	 */
	protected function get_url( $item_source, $object_key = null ) {
		if ( empty( $item_source['id'] ) ) {
			return false;
		}

		$attachment_id = $item_source['id'];

		// Check if file is migrated to GoDAM.
		$is_migrated = get_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
		if ( ! $is_migrated ) {
			return false;
		}

		// Get file path.
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path ) {
			return false;
		}

		// If file path starts with godam://, extract the relative path.
		if ( strpos( $file_path, 'godam://' ) === 0 ) {
			// Extract relative path from godam:// protocol.
			$relative_path = str_replace( 'godam://wp-content/uploads', '', $file_path );
		} else {
			// Convert local path to relative path.
			$upload_dirs   = $this->plugin->get_original_upload_dir();
			$relative_path = str_replace( $upload_dirs['basedir'], '', $file_path );
		}

		// Handle image sizes.
		if ( $object_key && is_string( $object_key ) && 'full' !== $object_key ) {
			$metadata = wp_get_attachment_metadata( $attachment_id );
			if ( ! empty( $metadata['sizes'][ $object_key ]['file'] ) ) {
				$size_file     = $metadata['sizes'][ $object_key ]['file'];
				$relative_path = str_replace( basename( $relative_path ), $size_file, $relative_path );
			}
		}

		// Generate CDN URL.
		$cdn_url = rtrim( $this->plugin->get_remote_url(), '/' ) . $relative_path;

		return $cdn_url;
	}

	/**
	 * Filter REST API response object content.
	 *
	 * @since n.e.x.t
	 *
	 * @param object $response WP_REST_Response object.
	 *
	 * @return object Modified response object.
	 */
	private function filter_rest_response( $response ) {
		$data = $response->get_data();

		// Filter the content.raw field (used by Gutenberg editor).
		if ( isset( $data['content'] ) && isset( $data['content']['raw'] ) ) {
			$filtered_content_raw   = $this->process_content_string( $data['content']['raw'] );
			$data['content']['raw'] = $filtered_content_raw;
		}

		// Filter the content.rendered field (used for preview).
		if ( isset( $data['content'] ) && isset( $data['content']['rendered'] ) ) {
			$filtered_content            = $this->process_content_string( $data['content']['rendered'] );
			$data['content']['rendered'] = $filtered_content;
		}

		// Filter the excerpt.raw field if it exists.
		if ( isset( $data['excerpt'] ) && isset( $data['excerpt']['raw'] ) ) {
			$filtered_excerpt_raw   = $this->process_content_string( $data['excerpt']['raw'] );
			$data['excerpt']['raw'] = $filtered_excerpt_raw;
		}

		// Filter the excerpt.rendered field if it exists.
		if ( isset( $data['excerpt'] ) && isset( $data['excerpt']['rendered'] ) ) {
			$filtered_excerpt            = $this->process_content_string( $data['excerpt']['rendered'] );
			$data['excerpt']['rendered'] = $filtered_excerpt;
		}

		// Update the response object with filtered data.
		$response->set_data( $data );

		return $response;
	}

	/**
	 * Process a single content string for URL replacement.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $content The content string to process.
	 *
	 * @return string Processed content.
	 */
	private function process_content_string( $content ) {
		if ( empty( $content ) ) {
			return $content;
		}

		$cache    = array();
		$to_cache = array();

		return $this->process_content( $content, $cache, $to_cache );
	}

	/**
	 * Filter REST API preload paths for block editor.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $paths Preload paths.
	 * @return array Filtered paths.
	 */
	public function filter_rest_preload_paths( $paths ) {
		// This ensures our filters run when the editor loads content via REST API.
		return $paths;
	}
}
