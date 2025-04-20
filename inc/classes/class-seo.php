<?php
/**
 * Class to handle teh SEO functionality for the GoDAM block.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Blocks
 */
class Seo {

	use Singleton;

	const VIDEO_SEO_SCHEMA_META_KEY         = 'godam_video_seo_schema';
	const VIDEO_SEO_SCHEMA_UPDATED_META_KEY = 'godam_video_seo_schema_updated';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'save_post', array( $this, 'save_seo_data_as_postmeta' ), 10, 2 );
		add_filter( 'rest_prepare_attachment', array( $this, 'add_video_duration_for_video_seo' ), 10, 2 );
		add_action( 'wp_head', array( $this, 'add_video_seo_schema' ) );
	}

	/**
	 * Save SEO schema data from 'godam/video' blocks as post meta.
	 *
	 * This function parses the Gutenberg block content of the post and extracts
	 * any `seo` attribute from blocks of type `godam/video`. The extracted data is
	 * then saved in the post meta under the key `godam_video_seo_schema`, along with
	 * a timestamp in `godam_video_seo_schema_updated`.
	 *
	 * @param int     $post_ID Post ID.
	 * @param WP_Post $post    Post object.
	 */
	public function save_seo_data_as_postmeta( $post_ID, $post ) {
		// Bail if this is an autosave or revision.
		if ( wp_is_post_autosave( $post_ID ) || wp_is_post_revision( $post_ID ) ) {
			return;
		}

		// Ensure we're working with a valid WP_Post object.
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		$content = $post->post_content;

		// Parse blocks only if content exists and contains blocks.
		if ( empty( $content ) || strpos( $content, '<!-- wp:' ) === false ) {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
			return;
		}

		$blocks           = parse_blocks( $content );
		$video_seo_schema = array();

		foreach ( $blocks as $block ) {
			// Flatten nested blocks (if any).
			$video_seo_schema = array_merge(
				$video_seo_schema,
				$this->extract_video_seo_schema_from_block( $block )
			);
		}

		if ( ! empty( $video_seo_schema ) ) {
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema );
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY );
		}
	}

	/**
	 * Extract SEO schema from a block.
	 *
	 * @param array $block Block data.
	 * @return array Extracted SEO schema.
	 */
	private function extract_video_seo_schema_from_block( $block ) {
		$schemas = array();

		if ( isset( $block['blockName'] ) && 'godam/video' === $block['blockName'] ) {
			if ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				$schemas[] = $block['attrs']['seo'];
			}
		}
	
		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner_block ) {
				$schemas = array_merge(
					$schemas,
					$this->extract_video_seo_schema_from_block( $inner_block )
				);
			}
		}
	
		return $schemas;
	}

	/**
	 * Add ISO 8601 video duration to REST API response for video attachments.
	 *
	 * @param WP_REST_Response $response  The response object.
	 * @param WP_Post          $post      The attachment post object.
	 * @return WP_REST_Response
	 */
	public function add_video_duration_for_video_seo( $response, $post ) {
		if ( 'video' === $post->post_mime_type || str_starts_with( $post->post_mime_type, 'video/' ) ) {
			$meta = wp_get_attachment_metadata( $post->ID );
	
			if ( ! empty( $meta['length'] ) && is_numeric( $meta['length'] ) ) {
				$duration_seconds = (int) $meta['length'];
	
				$hours   = floor( $duration_seconds / 3600 );
				$minutes = floor( ( $duration_seconds % 3600 ) / 60 );
				$seconds = $duration_seconds % 60;
	
				$iso_duration = 'PT';
				if ( $hours > 0 ) {
					$iso_duration .= $hours . 'H';
				}
				if ( $minutes > 0 ) {
					$iso_duration .= $minutes . 'M';
				}
				if ( $seconds > 0 || 'PT' === $iso_duration ) {
					$iso_duration .= $seconds . 'S';
				}
	
				$response->data['video_duration_iso8601'] = $iso_duration;
			}
		}
	
		return $response;
	}

	/**
	 * Outputs structured data for VideoObject schema on singular pages.
	 *
	 * This function retrieves custom video SEO metadata from the current post
	 * and generates a single JSON-LD script tag containing one or more
	 * VideoObject schemas. This improves SEO and video visibility in search engines.
	 *
	 * The schema includes properties like name, description, embed URL, content URL,
	 * thumbnail, upload date, duration, and family-friendly status.
	 *
	 * Only executes on singular pages and if valid video metadata exists.
	 *
	 * @return void
	 */
	public function add_video_seo_schema() {
		if ( ! is_singular() ) {
			return;
		}
	
		global $post;
	
		$raw = get_post_meta( $post->ID, self::VIDEO_SEO_SCHEMA_META_KEY, true );
	
		// Normalize and validate raw data.
		if ( empty( $raw ) ) {
			return;
		}
	
		if ( ! is_array( $raw ) ) {
			$raw = maybe_unserialize( $raw );
		}
	
		if ( ! is_array( $raw ) || empty( $raw ) ) {
			return;
		}
	
		$schemas = array();
	
		foreach ( $raw as $video ) {
			if ( ! is_array( $video ) ) {
				continue;
			}
	
			$schema = array(
				'@context'         => 'https://schema.org',
				'@type'            => 'VideoObject',
				'name'             => sanitize_text_field( $video['headline'] ?? '' ),
				'description'      => wp_strip_all_tags( $video['description'] ?? '' ),
				'contentUrl'       => esc_url_raw( $video['contentUrl'] ?? '' ),
				'uploadDate'       => sanitize_text_field( $video['uploadDate'] ?? '' ),
				'isFamilyFriendly' => isset( $video['isFamilyFriendly'] ) ? (bool) $video['isFamilyFriendly'] : true,
			);
	
			if ( ! empty( $video['thumbnailUrl'] ) ) {
				$schema['thumbnailUrl'] = esc_url_raw( $video['thumbnailUrl'] );
			}
	
			if ( ! empty( $video['duration'] ) ) {
				$schema['duration'] = sanitize_text_field( $video['duration'] );
			}
	
			$schemas[] = $schema;
		}
	
		if ( empty( $schemas ) ) {
			return;
		}
	
		// Output a single <script> with all VideoObject schemas.
		echo '<script type="application/ld+json">' . wp_json_encode(
			count( $schemas ) === 1 ? $schemas[0] : $schemas,
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
		) . '</script>';
	}
}
