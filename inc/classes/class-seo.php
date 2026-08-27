<?php
/**
 * Class to handle the SEO functionality for the GoDAM block.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Seo
 */
class Seo {

	use Singleton;

	const VIDEO_SEO_SCHEMA_META_KEY         = 'godam_video_seo_schema';
	const VIDEO_SEO_SCHEMA_UPDATED_META_KEY = 'godam_video_seo_schema_updated';
	const ATTACHMENT_POSTS_MAP_META_KEY     = 'godam_posts_using_attachment';
	const POST_ATTACHMENTS_META_KEY         = '_godam_seo_attachments';

	/**
	 * Content URLs already emitted by the cached wp_head schema output.
	 *
	 * Lets the render-time collector skip videos that were already output from
	 * the queried post's content, avoiding duplicate JSON-LD.
	 *
	 * @since 2.1.0
	 *
	 * @var array<string,bool>
	 */
	private $emitted_content_urls = array();

	/**
	 * Attachment IDs already emitted by the cached wp_head schema output.
	 *
	 * @since 2.1.0
	 *
	 * @var array<int,bool>
	 */
	private $emitted_attachment_ids = array();

	/**
	 * Headlines already emitted by the cached wp_head schema output for entries
	 * that carry neither a contentUrl nor an attachment ID (e.g. a seoOverride
	 * block without a media id). Lets the render-time collector de-duplicate
	 * those entries too, which cannot be keyed by URL or attachment.
	 *
	 * @since 2.1.0
	 *
	 * @var array<string,bool>
	 */
	private $emitted_headlines = array();

	/**
	 * Video SEO entries collected at render time from block-theme templates,
	 * template parts and synced patterns (content that is not part of the
	 * queried post's own post_content). Keyed by contentUrl (or headline) for
	 * de-duplication.
	 *
	 * @since 2.1.0
	 *
	 * @var array<string,array>
	 */
	private $render_collected_schemas = array();

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
		add_action( 'save_post', array( $this, 'elementor_save_seo_data_as_postmeta' ), 10, 1 );
		add_filter( 'rest_prepare_attachment', array( $this, 'add_video_duration_for_video_seo' ), 10, 2 );
		add_action( 'wp_head', array( $this, 'add_video_seo_schema' ) );

		// Render-time capture for videos that live outside the queried post's
		// content — block-theme templates, template parts and synced patterns.
		add_filter( 'render_block', array( $this, 'collect_render_time_video_seo' ), 10, 2 );
		add_action( 'wp_footer', array( $this, 'output_render_time_video_seo_schema' ), 20 );

		// Hook to update SEO when attachment is edited.
		add_action( 'edit_attachment', array( $this, 'schedule_seo_sync_for_attachment' ) );
		add_action( 'godam_sync_attachment_seo', array( $this, 'sync_seo_for_attachment_posts' ) );
	}

	/**
	 * Save SEO schema data from 'godam/video' blocks as post meta.
	 *
	 * This function parses the Gutenberg block content of the post and extracts
	 * any `seo` attribute from blocks of type `godam/video`. The extracted data
	 * is then saved in the post meta under the key `godam_video_seo_schema`,
	 * along with a timestamp in `godam_video_seo_schema_updated`.
	 *
	 * Add-ons can contribute additional schemas via the
	 * `godam_video_seo_extra_block_schemas` filter.
	 *
	 * Also handles WPBakery shortcodes in the same post.
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

		// Skip if this is an Elementor post (handled separately).
		$is_elementor = $this->is_elementor_post( $post_ID );
		if ( $is_elementor ) {
			return;
		}

		$content = $post->post_content;

		$video_seo_schema = array();
		$attachments_used = array();

		// Parse Gutenberg blocks if content contains godam/video blocks.
		$has_video_block = ! empty( $content ) && strpos( $content, '<!-- wp:godam/video' ) !== false;

		if ( $has_video_block ) {
			$blocks = parse_blocks( $content );

			foreach ( $blocks as $block ) {
				$result           = $this->extract_video_seo_schema_from_block( $block, true );
				$video_seo_schema = array_merge( $video_seo_schema, $result['schemas'] );
				$attachments_used = array_merge( $attachments_used, $result['attachments'] );
			}
		}

		// Parse WPBakery shortcodes if they exist.
		if ( ! empty( $content ) && has_shortcode( $content, 'godam_video' ) ) {
			$result           = $this->godam_get_video_seo_data_from_wpbakery( $content, true );
			$video_seo_schema = array_merge( $video_seo_schema, $result['schemas'] );
			$attachments_used = array_merge( $attachments_used, $result['attachments'] );
		}

		/**
		 * Filter to let add-ons contribute extra block-based video SEO schemas.
		 *
		 * For example, the GoDAM for WooCommerce add-on uses this to parse
		 * `godam/video-product-gallery` (Shoppable Video) blocks and return
		 * the resulting VideoObject SEO entries.
		 *
		 * @since 1.10.0
		 *
		 * @param array  $extra_schemas Array of extra SEO data arrays (initially empty).
		 * @param string $content       The post content.
		 * @param int    $post_ID       The post ID.
		 */
		$extra_schemas = apply_filters( 'godam_video_seo_extra_block_schemas', array(), $content, $post_ID );
		if ( is_array( $extra_schemas ) ) {
			$video_seo_schema = array_merge( $video_seo_schema, $extra_schemas );
		}

		/**
		 * Filter to let add-ons contribute extra attachment IDs for the
		 * attachment ↔ post mapping used by `edit_attachment` SEO resync.
		 *
		 * For example, the GoDAM for WooCommerce add-on uses this to register
		 * video attachments from `godam/video-product-gallery` blocks, which
		 * are not parsed by the core `extract_video_seo_schema_from_block()`.
		 *
		 * @since 1.10.0
		 *
		 * @param int[]  $extra_attachments Array of extra attachment IDs (initially empty).
		 * @param string $content           The post content.
		 * @param int    $post_ID           The post ID.
		 */
		$extra_attachments = apply_filters( 'godam_video_seo_extra_block_attachments', array(), $content, $post_ID );
		if ( is_array( $extra_attachments ) ) {
			$attachments_used = array_merge( $attachments_used, $extra_attachments );
		}

		if ( ! empty( $video_seo_schema ) ) {
			/**
			 * Filter the video SEO schema data before it is cached as post meta.
			 *
			 * Allows add-ons (e.g. WooCommerce integration) to enrich each video's
			 * cached SEO data with additional information such as product details.
			 *
			 * @since 1.10.0
			 *
			 * @param array $video_seo_schema Array of video SEO data arrays.
			 * @param int   $post_ID          The post ID being saved.
			 */
			$video_seo_schema = apply_filters( 'godam_video_seo_cache_data', $video_seo_schema, $post_ID );

			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); writes its own cached video SEO schema meta, not attachment data.
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); writes its own cached-schema-updated timestamp meta, not attachment data.
			$this->update_attachment_post_mapping( $post_ID, array_unique( $attachments_used ) );

			/**
			 * Fired after video SEO schema is saved as post meta.
			 *
			 * Add-ons can use this to perform additional save-time operations,
			 * such as storing reverse-lookup meta for gallery block product IDs.
			 *
			 * @since 1.10.0
			 *
			 * @param int   $post_ID          The post ID.
			 * @param array $video_seo_schema The saved schema array.
			 */
			do_action( 'godam_video_seo_schema_saved', $post_ID, $video_seo_schema );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); clears its own cached video SEO schema meta, not attachment data.
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); clears its own cached-schema-updated timestamp meta, not attachment data.
			$this->update_attachment_post_mapping( $post_ID, array() );

			/**
			 * Fired after video SEO schema is cleared from a post.
			 *
			 * @since 1.10.0
			 *
			 * @param int $post_ID The post ID.
			 */
			do_action( 'godam_video_seo_schema_cleared', $post_ID );
		}
	}

	/**
	 * Extract SEO schema from a block.
	 *
	 * If the block has seoOverride set to false or not set, it will fetch SEO from the media library.
	 * Otherwise, it will use the SEO data from the block attributes.
	 *
	 * @param array $block             Block data.
	 * @param bool  $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	private function extract_video_seo_schema_from_block( $block, $track_attachments = false ) {
		$schemas     = array();
		$attachments = array();

		if ( isset( $block['blockName'] ) && 'godam/video' === $block['blockName'] ) {
			$seo_override  = isset( $block['attrs']['seoOverride'] ) ? $block['attrs']['seoOverride'] : false;
			$attachment_id = isset( $block['attrs']['id'] ) ? (int) $block['attrs']['id'] : 0;

			if ( $seo_override && isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				// Use overridden SEO from block attributes.
				$seo_entry = $block['attrs']['seo'];

				// Include attachment_id so add-ons can resolve the attachment
				// on the first save (before _godam_seo_attachments exists).
				if ( $attachment_id > 0 ) {
					$seo_entry['attachment_id'] = $attachment_id;
				}

				$schemas[] = $seo_entry;
			} elseif ( $attachment_id > 0 ) {
				// Fetch SEO from media library attachment.
				$media_seo = $this->get_seo_from_attachment( $attachment_id );
				if ( ! empty( $media_seo ) ) {
					$media_seo['attachment_id'] = $attachment_id;
					$schemas[]                  = $media_seo;
					if ( $track_attachments ) {
						$attachments[] = $attachment_id;
					}
				}
			} elseif ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) ) {
				// Fallback to block SEO if no attachment ID.
				$schemas[] = $block['attrs']['seo'];
			}
		}

		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner_block ) {
				$result = $this->extract_video_seo_schema_from_block( $inner_block, $track_attachments );
				if ( $track_attachments ) {
					$schemas     = array_merge( $schemas, $result['schemas'] );
					$attachments = array_merge( $attachments, $result['attachments'] );
				} else {
					$schemas = array_merge( $schemas, $result );
				}
			}
		}

		if ( $track_attachments ) {
			return array(
				'schemas'     => $schemas,
				'attachments' => $attachments,
			);
		}

		return $schemas;
	}

	/**
	 * Get SEO data from a media library attachment.
	 *
	 * @since 1.7.0
	 *
	 * @param int $attachment_id The attachment ID.
	 * @return array The SEO data from the attachment.
	 */
	public function get_seo_from_attachment( $attachment_id ) {
		/**
		 * Fires before resolving/reading this attachment's post object,
		 * postmeta, canonical URL and video metadata for SEO schema
		 * generation, so integrations that centralize media on another site
		 * can switch context first. Every read below (the attachment post
		 * itself, its rtgodam_transcoded_url/rtgodam_media_video_thumbnail
		 * postmeta, its attachment URL, and its video metadata) is scoped to
		 * this single attachment.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
			$attachment = get_post( $attachment_id );

			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				return array();
			}

			$meta = get_post_meta( $attachment_id );

			// Get transcoded URL or fallback to attachment URL.
			$content_url = '';
			if ( ! empty( $meta['rtgodam_transcoded_url'][0] ) ) {
				$content_url = $meta['rtgodam_transcoded_url'][0];
			} else {
				$content_url = wp_get_attachment_url( $attachment_id );
			}

			// Get video duration in ISO 8601 format.
			$attachment_meta = wp_get_attachment_metadata( $attachment_id );
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		$duration = '';
		if ( ! empty( $attachment_meta['length'] ) && is_numeric( $attachment_meta['length'] ) ) {
			$duration = $this->seconds_to_iso8601( (int) $attachment_meta['length'] );
		}

		// Get thumbnail URL.
		$thumbnail_url = '';
		if ( ! empty( $meta['rtgodam_media_video_thumbnail'][0] ) ) {
			$thumbnail_url = $meta['rtgodam_media_video_thumbnail'][0];
		}

		// Get upload date in ISO 8601 format.
		$upload_date = '';
		if ( ! empty( $attachment->post_date_gmt ) && '0000-00-00 00:00:00' !== $attachment->post_date_gmt ) {
			$upload_date = gmdate( 'c', strtotime( $attachment->post_date_gmt ) );
		}

		// Strip HTML from description.
		$description = wp_strip_all_tags( $attachment->post_content );

		return array(
			'contentUrl'       => $content_url,
			'headline'         => $attachment->post_title,
			'description'      => $description,
			'uploadDate'       => $upload_date,
			'duration'         => $duration,
			'thumbnailUrl'     => $thumbnail_url,
			'isFamilyFriendly' => true,
		);
	}

	/**
	 * Convert seconds to ISO 8601 duration format.
	 *
	 * @param int $seconds Duration in seconds.
	 * @return string ISO 8601 duration string.
	 */
	private function seconds_to_iso8601( $seconds ) {
		$hours   = floor( $seconds / 3600 );
		$minutes = floor( ( $seconds % 3600 ) / 60 );
		$secs    = $seconds % 60;

		$iso_duration = 'PT';
		if ( $hours > 0 ) {
			$iso_duration .= $hours . 'H';
		}
		if ( $minutes > 0 ) {
			$iso_duration .= $minutes . 'M';
		}
		if ( $secs > 0 || 'PT' === $iso_duration ) {
			$iso_duration .= $secs . 'S';
		}

		return $iso_duration;
	}

	/**
	 * Check if a post is built with Elementor.
	 *
	 * @param int $post_id The post ID.
	 * @return bool True if it's an Elementor post, false otherwise.
	 */
	public function is_elementor_post( $post_id ) {
		return 'builder' === get_post_meta( $post_id, '_elementor_edit_mode', true ); // godam-coverage-ignore -- is_elementor_post(): $post_id is always a host post/page ID at every call site (never an attachment ID); reads that post's own '_elementor_edit_mode' flag.
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
			/**
			 * Fires before reading this attachment's video metadata (duration)
			 * for the REST API response, so integrations that centralize media
			 * on another site can switch context first. $post is the
			 * attachment being serialized by the `rest_prepare_attachment`
			 * filter, so this is genuinely attachment-scoped.
			 *
			 * @since 2.2.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );
			$meta = wp_get_attachment_metadata( $post->ID );
			do_action( 'rtgodam_after_attachment_lookup' );

			if ( ! empty( $meta['length'] ) && is_numeric( $meta['length'] ) ) {
				$response->data['video_duration_iso8601'] = $this->seconds_to_iso8601( (int) $meta['length'] );
			}
		}

		return $response;
	}

	/**
	 * Outputs structured data for VideoObject schema on singular pages.
	 *
	 * This function reads cached SEO data from post meta for optimal performance.
	 * The SEO data is cached when the post is saved (in save_seo_data_as_postmeta).
	 *
	 * The schema includes properties like name, description, content URL,
	 * thumbnail, upload date, duration, and family-friendly status.
	 *
	 * Only executes on singular pages and if valid cached SEO data exists.
	 *
	 * @return void
	 */
	public function add_video_seo_schema() {
		if ( ! is_singular() ) {
			return;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return;
		}

		// Read cached SEO schema from post meta (fast!).
		$cached_schemas = get_post_meta( $post_id, self::VIDEO_SEO_SCHEMA_META_KEY, true ); // godam-coverage-ignore -- add_video_seo_schema(): $post_id is get_queried_object_id() (the current page); reads that page's own cached SEO meta, not attachment data.

		if ( empty( $cached_schemas ) || ! is_array( $cached_schemas ) ) {
			return;
		}

		$output_schemas    = array();
		$seen_content_urls = array();

		// Build a set of contentUrls claimed by VPG (Shoppable Video) entries.
		// When the same video appears in both a godam/video block and a VPG block,
		// the VPG version takes priority (it carries product data via the add-on).
		$vpg_content_urls = array();
		foreach ( $cached_schemas as $video ) {
			if ( ! empty( $video['_source'] ) && 'vpg' === $video['_source'] && ! empty( $video['contentUrl'] ) && is_string( $video['contentUrl'] ) ) {
				$vpg_content_urls[ $video['contentUrl'] ] = true;
			}
		}

		foreach ( $cached_schemas as $video ) {
			if ( ! is_array( $video ) || empty( $video['headline'] ) ) {
				continue;
			}

			$content_url = ! empty( $video['contentUrl'] ) && is_string( $video['contentUrl'] ) ? $video['contentUrl'] : '';
			$is_vpg      = ! empty( $video['_source'] ) && 'vpg' === $video['_source'];

			// Skip standalone entries whose video already exists in a VPG block.
			if ( ! $is_vpg && $content_url && isset( $vpg_content_urls[ $content_url ] ) ) {
				continue;
			}

			// Deduplicate by contentUrl within the same context.
			if ( $content_url && isset( $seen_content_urls[ $content_url ] ) ) {
				continue;
			}
			if ( $content_url ) {
				$seen_content_urls[ $content_url ] = true;
			}

			$schema = $this->build_video_object_schema( $video, $post_id );
			if ( empty( $schema ) ) {
				continue;
			}

			// Record what we emit here so the render-time collector (wp_footer)
			// does not output the same video a second time. Track by contentUrl
			// and attachment ID, plus headline as a last resort for entries that
			// have neither (so those can still be de-duplicated at flush time).
			if ( $content_url ) {
				$this->emitted_content_urls[ $content_url ] = true;
			}
			if ( ! empty( $video['attachment_id'] ) ) {
				$this->emitted_attachment_ids[ (int) $video['attachment_id'] ] = true;
			}
			if ( ! $content_url && empty( $video['attachment_id'] ) && ! empty( $video['headline'] ) ) {
				$this->emitted_headlines[ $video['headline'] ] = true;
			}

			$output_schemas[] = $schema;
		}

		if ( empty( $output_schemas ) ) {
			return;
		}

		/**
		 * Filter the complete array of video SEO schemas before JSON-LD output.
		 *
		 * Allows add-ons to add, remove, reorder, or group schema entries —
		 * for example, the GoDAM for WooCommerce add-on uses this to wrap
		 * Shoppable Video schemas in an ItemList for carousel rich results.
		 *
		 * A third argument `$cached_schemas` is passed so add-ons can inspect
		 * the raw cached data (including `_source` markers) without an extra
		 * `get_post_meta()` call.
		 *
		 * @since 1.10.0
		 *
		 * @param array $output_schemas  Array of schema arrays (VideoObject entries).
		 * @param int   $post_id         The current post ID.
		 * @param array $cached_schemas  Raw cached SEO data from post meta.
		 */
		$output_schemas = apply_filters( 'godam_video_seo_schemas', $output_schemas, $post_id, $cached_schemas );

		if ( empty( $output_schemas ) ) {
			return;
		}

		// Output a single <script> with all schemas.
		echo '<script type="application/ld+json">' . wp_json_encode(
			count( $output_schemas ) === 1 ? $output_schemas[0] : $output_schemas,
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
		) . '</script>';
	}

	/**
	 * Build a sanitized VideoObject schema array from a raw video SEO entry.
	 *
	 * Shared by the cached wp_head output ({@see add_video_seo_schema}) and the
	 * render-time output ({@see output_render_time_video_seo_schema}) so both
	 * paths produce identical schema and fire the same per-entry filter.
	 *
	 * @since 2.1.0
	 *
	 * @param array $video   Raw video SEO data (headline, contentUrl, etc.).
	 * @param int   $post_id The current post ID for filter context. May be 0 on
	 *                       non-singular render-time views (archives/search/404),
	 *                       where the queried object has no post ID.
	 * @return array|null The VideoObject schema array, or null when invalid.
	 */
	private function build_video_object_schema( $video, $post_id ) {
		if ( ! is_array( $video ) || empty( $video['headline'] ) ) {
			return null;
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

		/**
		 * Filter an individual video SEO schema entry before output.
		 *
		 * Allows add-ons to modify or extend a single VideoObject schema,
		 * e.g. by adding an associatedProduct for WooCommerce integration.
		 *
		 * @since 1.10.0
		 *
		 * @param array $schema  The VideoObject schema array.
		 * @param array $video   The raw cached video SEO data.
		 * @param int   $post_id The current post ID. May be 0 when emitted from
		 *                       the render-time path on non-singular views
		 *                       (archives/search/404); guard with a check before
		 *                       using it (e.g. get_post_type( $post_id )).
		 */
		return apply_filters( 'godam_video_seo_schema', $schema, $video, $post_id );
	}

	/**
	 * Whether the current request is a front-end page render where render-time
	 * video SEO should be collected and emitted.
	 *
	 * Unlike the cached wp_head output ({@see add_video_seo_schema}), this is
	 * intentionally NOT limited to singular views: a godam/video block may be
	 * placed in any block-theme template, including templates that render an
	 * archive, the blog home, the front page, search results or 404. It only
	 * excludes admin screens, REST requests (e.g. editor block previews) and
	 * feeds, none of which output a `wp_footer` document head we can attach to.
	 *
	 * The `godam_video_seo_render_context` filter lets integrators narrow this
	 * scope further (e.g. suppress on archives to avoid repeating the same
	 * schema across listing pages).
	 *
	 * @since 2.1.0
	 *
	 * @return bool True on a front-end HTML page render, false otherwise.
	 */
	private function is_render_time_seo_context() {
		if ( is_admin() ) {
			return false;
		}

		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return false;
		}

		if ( is_feed() ) {
			return false;
		}

		/**
		 * Filters whether render-time video SEO schema should be collected and
		 * emitted for the current front-end view.
		 *
		 * This runs only for genuine front-end page renders — admin, REST and
		 * feed requests are already excluded and never reach the filter. Return
		 * false to suppress the render-time VideoObject output on specific
		 * views. For example, to keep it on singular content and the front page
		 * only, and off other archives/search (avoiding the same schema being
		 * repeated across listing pages):
		 *
		 *     add_filter(
		 *         'godam_video_seo_render_context',
		 *         function ( $emit ) {
		 *             return is_singular() || is_front_page();
		 *         }
		 *     );
		 *
		 * All conditional tags (is_singular(), is_archive(), is_front_page(),
		 * is_search(), …) are available inside the callback.
		 *
		 * @since 2.1.0
		 *
		 * @param bool $emit Whether to emit render-time video SEO on this view.
		 *                    Defaults to true for every front-end view.
		 */
		return (bool) apply_filters( 'godam_video_seo_render_context', true );
	}

	/**
	 * Collect video SEO schema from blocks rendered outside the queried post's
	 * content — block-theme templates, template parts and synced patterns.
	 *
	 * The cached wp_head output ({@see add_video_seo_schema}) only covers
	 * godam/video blocks stored in the queried post's own post_content. Videos
	 * placed in a template, template part or synced pattern (a `wp_block` post)
	 * are composed into the page at render time and never appear in that
	 * content, so they are captured here via the `render_block` filter and
	 * emitted together in {@see output_render_time_video_seo_schema}.
	 *
	 * This is a read-only pass; the block output is always returned unchanged.
	 *
	 * @since 2.1.0
	 *
	 * @param string $block_content The rendered block HTML (returned unchanged).
	 * @param array  $parsed_block  The parsed block array.
	 * @return string The unchanged block HTML.
	 */
	public function collect_render_time_video_seo( $block_content, $parsed_block ) {
		// Cheapest check first: skip every block that is not a godam/video.
		if ( empty( $parsed_block['blockName'] ) || 'godam/video' !== $parsed_block['blockName'] ) {
			return $block_content;
		}

		// Front-end page renders only — but any view, not just singular: the
		// video may be placed in a template that renders an archive, the blog
		// home or the front page.
		if ( ! $this->is_render_time_seo_context() ) {
			return $block_content;
		}

		$schemas = $this->extract_video_seo_schema_from_block( $parsed_block );

		foreach ( $schemas as $seo_entry ) {
			if ( ! is_array( $seo_entry ) || empty( $seo_entry['headline'] ) ) {
				continue;
			}

			$content_url   = ! empty( $seo_entry['contentUrl'] ) && is_string( $seo_entry['contentUrl'] ) ? $seo_entry['contentUrl'] : '';
			$attachment_id = ! empty( $seo_entry['attachment_id'] ) ? (int) $seo_entry['attachment_id'] : 0;

			// Deduplicate within the render-collected set (a template part or
			// synced pattern carrying the same video can render many times).
			// Prefer the attachment ID as the key: the same underlying video can
			// render with slightly different contentUrl strings, and keying by
			// attachment collapses those reliably. Fall back to contentUrl, then
			// headline, for entries without an attachment (e.g. seoOverride).
			//
			// De-duplication against the cached wp_head output is deferred to
			// flush time ({@see output_render_time_video_seo_schema}): render_block
			// can fire before wp_head (e.g. in block themes), so the "already
			// emitted" sets may still be empty while this collector runs.
			if ( $attachment_id > 0 ) {
				$dedupe_key = 'attachment:' . $attachment_id;
			} elseif ( $content_url ) {
				$dedupe_key = 'url:' . $content_url;
			} else {
				$dedupe_key = 'headline:' . $seo_entry['headline'];
			}
			if ( isset( $this->render_collected_schemas[ $dedupe_key ] ) ) {
				continue;
			}

			$this->render_collected_schemas[ $dedupe_key ] = $seo_entry;
		}

		return $block_content;
	}

	/**
	 * Output JSON-LD for videos collected at render time — those living in
	 * block-theme templates, template parts or synced patterns rather than in
	 * the queried post's content.
	 *
	 * Runs in wp_footer, after every block has rendered and after the cached
	 * wp_head output has recorded which videos it already emitted, so the two
	 * paths never duplicate a VideoObject.
	 *
	 * @since 2.1.0
	 *
	 * @return void
	 */
	public function output_render_time_video_seo_schema() {
		if ( ! $this->is_render_time_seo_context() ) {
			return;
		}

		if ( empty( $this->render_collected_schemas ) ) {
			return;
		}

		$post_id = get_queried_object_id();

		$output_schemas = array();
		foreach ( $this->render_collected_schemas as $video ) {
			// Skip videos already emitted by the cached wp_head output. This
			// de-duplication runs here (not at collect time) because render_block
			// can fire before wp_head (e.g. in block themes), so the "already
			// emitted" sets may still be empty while the collector runs. By
			// wp_footer — which always runs after both — both paths have finished
			// populating state, so this comparison is reliable either way.
			$content_url   = ! empty( $video['contentUrl'] ) && is_string( $video['contentUrl'] ) ? $video['contentUrl'] : '';
			$attachment_id = ! empty( $video['attachment_id'] ) ? (int) $video['attachment_id'] : 0;
			$headline      = ! empty( $video['headline'] ) ? $video['headline'] : '';

			if ( $content_url && isset( $this->emitted_content_urls[ $content_url ] ) ) {
				continue;
			}
			if ( $attachment_id > 0 && isset( $this->emitted_attachment_ids[ $attachment_id ] ) ) {
				continue;
			}
			// Last resort for entries with neither a contentUrl nor an attachment.
			if ( ! $content_url && 0 === $attachment_id && $headline && isset( $this->emitted_headlines[ $headline ] ) ) {
				continue;
			}

			$schema = $this->build_video_object_schema( $video, $post_id );
			if ( ! empty( $schema ) ) {
				$output_schemas[] = $schema;
			}
		}

		if ( empty( $output_schemas ) ) {
			return;
		}

		/**
		 * This filter is documented in this file, in add_video_seo_schema().
		 *
		 * Note: on this render-time path `$post_id` may be 0 for non-singular
		 * views (archives/search/404), unlike the singular-only wp_head path.
		 *
		 * The third argument is an empty array here because render-collected
		 * schemas have no backing post-meta cache; add-ons that inspect it
		 * (e.g. the VPG ItemList grouping) simply no-op in that case.
		 */
		$output_schemas = apply_filters( 'godam_video_seo_schemas', $output_schemas, $post_id, array() );

		if ( empty( $output_schemas ) ) {
			return;
		}

		// Output a single <script> with all render-collected schemas.
		echo '<script type="application/ld+json">' . wp_json_encode(
			count( $output_schemas ) === 1 ? $output_schemas[0] : $output_schemas,
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
		) . '</script>';
	}

	/**
	 * Extract SEO data from Elementor godam_video widget for a given post.
	 *
	 * @param int  $post_id           The ID of the post.
	 * @param bool $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	public function godam_get_video_seo_data_from_elementor( $post_id, $track_attachments = false ) {
		$empty_result = $track_attachments ? array(
			'schemas'     => array(),
			'attachments' => array(),
		) : array();

		// Bail if not built with Elementor.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return $empty_result;
		}

		if ( ! $this->is_elementor_post( $post_id ) ) {
			return $empty_result;
		}

		// Get the raw Elementor data.
		$data = get_post_meta( $post_id, '_elementor_data', true ); // godam-coverage-ignore -- godam_get_video_seo_data_from_elementor(): $post_id is the host post being saved (sole caller passes save_post's $post_ID); reads that post's own '_elementor_data', not attachment data.
		if ( empty( $data ) ) {
			return $empty_result;
		}

		$widgets = json_decode( $data, true );
		if ( ! is_array( $widgets ) ) {
			return $empty_result;
		}

		$seo_data    = array();
		$attachments = array();
		$seo_obj     = $this;

		$extractor = function ( $elements ) use ( &$seo_data, &$attachments, &$extractor, $seo_obj, $track_attachments ) {
			foreach ( $elements as $element ) {
				$_seo_data = array();
				if (
					isset( $element['widgetType'] ) &&
					'godam-video' === $element['widgetType']
				) {
					$settings = array();
					if ( isset( $element['settings'] ) && is_array( $element['settings'] ) ) {
						$settings = $element['settings'];
					}
					$seo_override = isset( $settings['seo_override'] ) && 'yes' === $settings['seo_override'];

					// If seo_override is false, try to fetch SEO from the media attachment.
					if ( ! $seo_override ) {
						// Get attachment ID from video-file setting.
						$attachment_id = 0;
						if ( isset( $settings['video-file']['id'] ) && is_numeric( $settings['video-file']['id'] ) ) {
							$attachment_id = absint( $settings['video-file']['id'] );
						}

						if ( $attachment_id > 0 ) {
							$media_seo = $seo_obj->get_seo_from_attachment( $attachment_id );
							if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
								$seo_data[] = $media_seo;
								if ( $track_attachments ) {
									$attachments[] = $attachment_id;
								}
								continue;
							}
						}
					}

					// Use widget settings if seo_override is true or no attachment data available.
					if (
						isset( $settings['seo_content_headline'] ) &&
						! empty( $settings['seo_content_headline'] )
					) {
						$_seo_data['contentUrl']       = isset( $settings['seo_content_url'] ) ? $settings['seo_content_url'] : '';
						$_seo_data['headline']         = isset( $settings['seo_content_headline'] ) ? $settings['seo_content_headline'] : '';
						$_seo_data['description']      = isset( $settings['seo_content_description'] ) ? $settings['seo_content_description'] : '';
						$_seo_data['uploadDate']       = isset( $settings['seo_content_upload_date'] ) ? $settings['seo_content_upload_date'] : '';
						$_seo_data['thumbnailUrl']     = isset( $settings['seo_content_video_thumbnail_url'] ) ? $settings['seo_content_video_thumbnail_url'] : '';
						$_seo_data['isFamilyFriendly'] = isset( $settings['seo_content_family_friendly'] ) ? 'yes' === $settings['seo_content_family_friendly'] : true;
						$_seo_data['duration']         = isset( $settings['seo_content_duration'] ) ? $settings['seo_content_duration'] : '';

						$seo_data[] = $_seo_data;
					}
				}

				if ( isset( $element['elements'] ) && is_array( $element['elements'] ) ) {
					$extractor( $element['elements'] ); // Recurse into inner elements.
				}
			}
		};

		$extractor( $widgets );

		if ( $track_attachments ) {
			return array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			);
		}

		return $seo_data;
	}

	/**
	 * Stores the SEO data for elementor.
	 *
	 * @param int $post_ID Post ID.
	 * @return void
	 */
	public function elementor_save_seo_data_as_postmeta( $post_ID ) {
		// Check if Elementor is active and this post uses Elementor.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return;
		}

		$edit_mode = get_post_meta( $post_ID, '_elementor_edit_mode', true ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; reads its own '_elementor_edit_mode' flag, not attachment data.
		if ( 'builder' !== $edit_mode ) {
			return;
		}

		$result           = $this->godam_get_video_seo_data_from_elementor( $post_ID, true );
		$video_seo_schema = $result['schemas'];
		$attachments_used = $result['attachments'];

		if ( ! empty( $video_seo_schema ) ) {
			/** This filter is documented in inc/classes/class-seo.php */
			$video_seo_schema = apply_filters( 'godam_video_seo_cache_data', $video_seo_schema, $post_ID );

			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY, $video_seo_schema ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; writes its own cached video SEO schema meta, not attachment data.
			update_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY, time() ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; writes its own cached-schema-updated timestamp meta, not attachment data.
			$this->update_attachment_post_mapping( $post_ID, array_unique( $attachments_used ) );
			do_action( 'godam_video_seo_schema_saved', $post_ID, $video_seo_schema );
		} else {
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; clears its own cached video SEO schema meta, not attachment data.
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; clears its own cached-schema-updated timestamp meta, not attachment data.
			$this->update_attachment_post_mapping( $post_ID, array() );
			do_action( 'godam_video_seo_schema_cleared', $post_ID );
		}
	}

	/**
	 * Extract SEO data from WPBakery godam_video shortcodes.
	 *
	 * @param string $content           The post content containing shortcodes.
	 * @param bool   $track_attachments Whether to track attachments used.
	 * @return array Contains 'schemas' and 'attachments' arrays when tracking, otherwise just schemas.
	 */
	public function godam_get_video_seo_data_from_wpbakery( $content, $track_attachments = false ) {
		$seo_data    = array();
		$attachments = array();

		if ( empty( $content ) ) {
			return $track_attachments ? array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			) : $seo_data;
		}

		// Match all godam_video shortcodes.
		$pattern = get_shortcode_regex( array( 'godam_video' ) );

		if ( preg_match_all( '/' . $pattern . '/s', $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				$atts = shortcode_parse_atts( $match[3] );

				if ( empty( $atts ) || ! is_array( $atts ) ) {
					continue;
				}

				$seo_override  = isset( $atts['seo_override'] ) && '1' === $atts['seo_override'];
				$attachment_id = isset( $atts['id'] ) ? absint( $atts['id'] ) : 0;
				$media_seo     = array();

				if ( $attachment_id > 0 ) {
					$media_seo = $this->get_seo_from_attachment( $attachment_id );
				}

				// If seo_override is false, try to fetch SEO from the media attachment.
				if ( ! $seo_override ) {
					if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
						$seo_data[] = $media_seo;
						if ( $track_attachments ) {
							$attachments[] = $attachment_id;
						}
						continue;
					}
				}

				// Use shortcode attributes if seo_override is true or no attachment data available.
				if ( ! empty( $atts['seo_headline'] ) ) {
					$video_seo = array(
						'contentUrl'       => ! empty( $media_seo['contentUrl'] ) ? $media_seo['contentUrl'] : ( isset( $atts['seo_content_url'] ) ? $atts['seo_content_url'] : '' ),
						'headline'         => isset( $atts['seo_headline'] ) ? $atts['seo_headline'] : '',
						'description'      => isset( $atts['seo_description'] ) ? $atts['seo_description'] : '',
						'uploadDate'       => ! empty( $media_seo['uploadDate'] ) ? $media_seo['uploadDate'] : ( isset( $atts['seo_upload_date'] ) ? $atts['seo_upload_date'] : '' ),
						'thumbnailUrl'     => ! empty( $media_seo['thumbnailUrl'] ) ? $media_seo['thumbnailUrl'] : ( isset( $atts['seo_thumbnail_url'] ) ? $atts['seo_thumbnail_url'] : '' ),
						'isFamilyFriendly' => isset( $atts['seo_family_friendly'] ) ? '1' === $atts['seo_family_friendly'] : true,
						'duration'         => ! empty( $media_seo['duration'] ) ? $media_seo['duration'] : ( isset( $atts['seo_duration'] ) ? $atts['seo_duration'] : '' ),
					);

					$seo_data[] = $video_seo;
					if ( $track_attachments && $attachment_id > 0 && ! empty( $media_seo ) ) {
						$attachments[] = $attachment_id;
					}
				}
			}
		}

		if ( $track_attachments ) {
			return array(
				'schemas'     => $seo_data,
				'attachments' => $attachments,
			);
		}

		return $seo_data;
	}

	/**
	 * Build a stable identity string for a [blog_id, post_id] pair, used only to
	 * compare/dedupe entries in memory — never persisted or parsed back apart.
	 *
	 * @param int $blog_id Blog ID the post belongs to.
	 * @param int $post_id Post ID, local to that blog.
	 * @return string
	 */
	private function make_post_ref_key( $blog_id, $post_id ) {
		return ( (int) $blog_id ) . ':' . ( (int) $post_id );
	}

	/**
	 * Read the [blog_id, post_id] reference list for an attachment.
	 *
	 * Legacy entries (a bare post ID, from before blog_id qualification) are
	 * attributed to the *current* blog — the same assumption every older version
	 * of this code already made, since that shape never recorded a site. This is
	 * necessarily a best-effort guess for pre-existing data, but every write from
	 * here on is unambiguous.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @return array<string, array{blog_id:int, post_id:int}> Keyed by make_post_ref_key().
	 */
	private function get_attachment_post_refs( $attachment_id ) {
		$raw = get_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, true );
		$raw = is_array( $raw ) ? $raw : array();

		$refs = array();
		foreach ( $raw as $entry ) {
			if ( is_array( $entry ) && isset( $entry['post_id'] ) ) {
				$blog_id = isset( $entry['blog_id'] ) ? (int) $entry['blog_id'] : get_current_blog_id();
				$post_id = (int) $entry['post_id'];
			} else {
				$blog_id = get_current_blog_id();
				$post_id = (int) $entry;
			}
			if ( $post_id <= 0 ) {
				continue;
			}
			$refs[ $this->make_post_ref_key( $blog_id, $post_id ) ] = array(
				'blog_id' => $blog_id,
				'post_id' => $post_id,
			);
		}
		return $refs;
	}

	/**
	 * Persist the [blog_id, post_id] reference list for an attachment.
	 *
	 * @param int                                            $attachment_id Attachment WP post ID.
	 * @param array<string, array{blog_id:int, post_id:int}> $refs          Keyed by make_post_ref_key().
	 * @return void
	 */
	private function save_attachment_post_refs( $attachment_id, array $refs ) {
		if ( empty( $refs ) ) {
			delete_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY );
			return;
		}
		update_post_meta( $attachment_id, self::ATTACHMENT_POSTS_MAP_META_KEY, array_values( $refs ) );
	}

	/**
	 * Update the mapping of which posts use a specific attachment for SEO schema generation.
	 *
	 * @param int   $post_id     The post ID.
	 * @param array $attachments Array of attachment IDs used in the post.
	 */
	private function update_attachment_post_mapping( $post_id, $attachments ) {
		// Normalize: cast to positive integers and discard zeroes/non-numeric values.
		$attachments = array_values( array_unique( array_filter( array_map( 'absint', $attachments ) ) ) );

		// Get current attachments this post was using.
		$previous_attachments = get_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY, true ); // godam-coverage-ignore -- update_attachment_post_mapping(): $post_id is the post being saved; reads its own local POST_ATTACHMENTS_META_KEY tracking meta, not attachment data (see docblock a few lines below).
		$previous_attachments = is_array( $previous_attachments ) ? $previous_attachments : array();

		// Captured before the switch below, so this is always the site $post_id
		// actually belongs to (the one currently active), not the media site.
		$blog_id  = get_current_blog_id();
		$post_ref = $this->make_post_ref_key( $blog_id, $post_id );

		/**
		 * Fires before touching any attachment's reverse-index meta below,
		 * so integrations that centralize media on another site can switch
		 * context first. Deliberately does NOT wrap this method's own
		 * $post_id reads/writes (POST_ATTACHMENTS_META_KEY, above and
		 * below) — that's the current post being saved, not attachment
		 * data, and stays local.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		// Remove post from old attachments' mapping.
		$removed_attachments = array_diff( $previous_attachments, $attachments );
		foreach ( $removed_attachments as $attachment_id ) {
			$posts_using = $this->get_attachment_post_refs( $attachment_id );
			unset( $posts_using[ $post_ref ] );
			$this->save_attachment_post_refs( $attachment_id, $posts_using );
		}

		// Add post to new attachments' mapping.
		$new_attachments = array_diff( $attachments, $previous_attachments );
		foreach ( $new_attachments as $attachment_id ) {
			$posts_using = $this->get_attachment_post_refs( $attachment_id );
			if ( ! isset( $posts_using[ $post_ref ] ) ) {
				$posts_using[ $post_ref ] = array(
					'blog_id' => $blog_id,
					'post_id' => $post_id,
				);
				$this->save_attachment_post_refs( $attachment_id, $posts_using );
			}
		}

		do_action( 'rtgodam_after_attachment_lookup' );

		// Update post's attachment list.
		if ( ! empty( $attachments ) ) {
			update_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY, $attachments ); // godam-coverage-ignore -- update_attachment_post_mapping(): $post_id is the post being saved; writes its own local POST_ATTACHMENTS_META_KEY tracking meta, not attachment data (see docblock above).
		} else {
			delete_post_meta( $post_id, self::POST_ATTACHMENTS_META_KEY ); // godam-coverage-ignore -- update_attachment_post_mapping(): $post_id is the post being saved; clears its own local POST_ATTACHMENTS_META_KEY tracking meta, not attachment data (see docblock above).
		}
	}

	/**
	 * Schedule a background job to sync SEO for all posts using an attachment.
	 *
	 * @param int $attachment_id The attachment ID.
	 */
	public function schedule_seo_sync_for_attachment( $attachment_id ) {
		/**
		 * Fires before resolving this attachment's post object and its
		 * reverse-index meta (which posts use it), so integrations that
		 * centralize media on another site can switch context first.
		 * $attachment_id arrives directly from WordPress core's
		 * `edit_attachment` action (fired with the attachment's own post ID),
		 * so it is genuinely an attachment ID here.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		$attachment = get_post( $attachment_id );

		// Only process video attachments.
		if ( ! $attachment || strpos( $attachment->post_mime_type, 'video/' ) !== 0 ) {
			do_action( 'rtgodam_after_attachment_lookup' );
			return;
		}

		// Check if any posts are using this attachment.
		$posts_using = $this->get_attachment_post_refs( $attachment_id );

		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $posts_using ) ) {
			return;
		}

		// Schedule the sync to run in the background.
		if ( ! wp_next_scheduled( 'godam_sync_attachment_seo', array( $attachment_id ) ) ) {
			wp_schedule_single_event( time(), 'godam_sync_attachment_seo', array( $attachment_id ) );
		}
	}

	/**
	 * Sync SEO for all posts using a specific attachment.
	 * This runs as a background task when an attachment is updated.
	 *
	 * Each referencing post is resolved on its own originating site — not
	 * necessarily the site this background job happens to run on, and not the
	 * media site either — since ATTACHMENT_POSTS_MAP_META_KEY now records
	 * blog_id alongside each post ID.
	 *
	 * @param int $attachment_id The attachment ID.
	 */
	public function sync_seo_for_attachment_posts( $attachment_id ) {
		/**
		 * Fires before reading this attachment's reverse-index meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$posts_using = $this->get_attachment_post_refs( $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $posts_using ) ) {
			return;
		}

		$is_multisite = is_multisite();

		foreach ( $posts_using as $ref ) {
			$blog_id = $ref['blog_id'];
			$post_id = $ref['post_id'];

			$switched = $is_multisite && $blog_id > 0 && get_current_blog_id() !== $blog_id;
			if ( $switched ) {
				switch_to_blog( $blog_id ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.switch_to_blog_switch_to_blog
			}

			try {
				$post = get_post( $post_id ); // godam-coverage-ignore -- sync_seo_for_attachment_posts(): reads HOST posts referencing the attachment (see the docblock note on this exact line) — documented structural limitation, not a hook-fixable gap.
				if ( ! $post ) {
					continue;
				}

				// Check if it's an Elementor post.
				$is_elementor = $this->is_elementor_post( $post_id );

				if ( $is_elementor ) {
					$this->elementor_save_seo_data_as_postmeta( $post_id );
				} else {
					$this->save_seo_data_as_postmeta( $post_id, $post );
				}
			} finally {
				if ( $switched ) {
					restore_current_blog();
				}
			}
		}
	}
}
