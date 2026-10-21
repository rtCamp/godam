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
	const TRANSCRIPT_EXCERPT_META_KEY       = '_godam_seo_transcript_excerpt';

	/**
	 * Maximum length of a fallback description (transcript or page excerpt).
	 *
	 * @since 2.5.0
	 */
	const DESCRIPTION_MAX_LENGTH = 160;

	/**
	 * Most unregistered builder-style shortcode names removed from one page
	 * text when building its fallback description. Together with the name
	 * length limit below, it keeps the pattern core builds from them far below
	 * PCRE's size limit, whatever a page contains.
	 *
	 * @since 2.5.0
	 */
	const FALLBACK_UNREGISTERED_SHORTCODES_LIMIT = 100;

	/**
	 * Which unregistered tag names the fallback description treats as page-builder
	 * shortcodes (`vc_row`, `et_pb_section`, `fusion_builder_container`,
	 * `contact-form-7`): 64 characters at most, starting with a letter, with an
	 * underscore or hyphen in them. Plain bracketed words are common in ordinary
	 * text and stay.
	 *
	 * @since 2.5.0
	 */
	const FALLBACK_SHORTCODE_NAME_PATTERN = '/^(?=.{1,64}$)(?=[A-Za-z0-9]*[_-])[A-Za-z][A-Za-z0-9_-]*$/D';

	/**
	 * Seconds before a failed transcript fetch is retried.
	 *
	 * @since 2.5.0
	 */
	const TRANSCRIPT_RETRY_AFTER = HOUR_IN_SECONDS;

	/**
	 * Post meta marking that a page with video SEO cached by an older GoDAM version has been
	 * queued for a one-time re-save (see {@see Seo::maybe_queue_legacy_resave()}).
	 *
	 * @since 2.5.0
	 */
	const LEGACY_RESAVE_META_KEY = '_godam_seo_legacy_resave';

	/**
	 * Option holding the IDs of pages waiting for that re-save.
	 *
	 * @since 2.5.0
	 */
	const LEGACY_RESAVE_QUEUE_OPTION = 'godam_video_seo_resave_queue';

	/**
	 * WP-Cron hook that works through the re-save queue.
	 *
	 * @since 2.5.0
	 */
	const LEGACY_RESAVE_CRON_HOOK = 'godam_video_seo_resave_batch';

	/**
	 * Pages re-saved per WP-Cron run; the rest wait for the next run.
	 *
	 * @since 2.5.0
	 */
	const LEGACY_RESAVE_BATCH_SIZE = 10;

	/**
	 * Page IDs queued during this request, written to the queue option once
	 * at shutdown.
	 *
	 * @var int[]
	 */
	private $pending_legacy_resaves = array();

	/**
	 * Shortest video (seconds) that gets key moments. Google ignores clips on
	 * videos under 30 seconds.
	 *
	 * @since 2.5.0
	 */
	const KEY_MOMENTS_MIN_DURATION = 30;

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

		// One-time background re-save of pages whose cached video SEO was saved
		// by an older version and can't be resolved at output time (see
		// maybe_queue_legacy_resave()).
		add_action( self::LEGACY_RESAVE_CRON_HOOK, array( $this, 'process_legacy_resave_queue' ) );
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
			// Whether this post had video SEO before. Most saves are of posts with
			// no video at all; listeners (e.g. the sitemap cache) can skip those.
			$had_schema = metadata_exists( 'post', $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );

			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); clears its own cached video SEO schema meta, not attachment data.
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY ); // godam-coverage-ignore -- save_seo_data_as_postmeta(): $post_ID is the host post being saved (save_post action); clears its own cached-schema-updated timestamp meta, not attachment data.
			// Keep tracking videos that produced no schema yet (e.g. an empty
			// Media Library title), so editing them later re-syncs this page.
			$this->update_attachment_post_mapping( $post_ID, array_unique( $attachments_used ) );

			/**
			 * Fired after video SEO schema is cleared from a post.
			 *
			 * @since 1.10.0
			 * @since 2.5.0 Added `$had_schema`.
			 *
			 * @param int  $post_ID    The post ID.
			 * @param bool $had_schema Whether the post had cached video SEO before
			 *                         this save. False for posts with no video.
			 */
			do_action( 'godam_video_seo_schema_cleared', $post_ID, $had_schema );
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
			$seo_entry     = null;

			if ( $seo_override && isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) && is_array( $block['attrs']['seo'] ) ) {
				// Use overridden SEO from block attributes.
				$seo_entry = $block['attrs']['seo'];

				// Include attachment_id so add-ons can resolve the attachment
				// on the first save (before _godam_seo_attachments exists).
				if ( $attachment_id > 0 ) {
					$seo_entry['attachment_id'] = $attachment_id;
				}
			} elseif ( $attachment_id > 0 ) {
				// Fetch SEO from media library attachment. Only allow a remote
				// transcript fetch on save, never during a page render.
				$media_seo = $this->get_seo_from_attachment( $attachment_id, $track_attachments );
				if ( ! empty( $media_seo ) ) {
					$media_seo['attachment_id'] = $attachment_id;
					$seo_entry                  = $media_seo;
					if ( $track_attachments ) {
						$attachments[] = $attachment_id;
					}
				}
			} elseif ( isset( $block['attrs']['seo'] ) && ! empty( $block['attrs']['seo'] ) && is_array( $block['attrs']['seo'] ) ) {
				// Fallback to block SEO if no attachment ID.
				$seo_entry = $block['attrs']['seo'];
			}

			if ( null !== $seo_entry ) {
				// Per-video "Exclude from video sitemap" toggle. Kept on the block,
				// independent of the SEO override, and carried into the cache.
				$seo_entry['excludeFromSitemap'] = ! empty( $block['attrs']['excludeFromVideoSitemap'] );
				$schemas[]                       = $seo_entry;
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
	 * @since 2.5.0 contentUrl is the HLS stream (or original file), never the
	 *              DASH manifest; adds embedUrl; falls back to the transcript
	 *              for an empty description. Added `$allow_remote`.
	 *
	 * @param int  $attachment_id The attachment ID.
	 * @param bool $allow_remote  Whether an uncached transcript may be fetched for
	 *                            the description fallback. False on page renders.
	 * @return array The SEO data from the attachment.
	 */
	public function get_seo_from_attachment( $attachment_id, $allow_remote = true ) {
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

			// Get video duration in ISO 8601 format.
			$attachment_meta = wp_get_attachment_metadata( $attachment_id );
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		// Point Google at a format it can index: the HLS (.m3u8) stream, or the
		// original upload. Never the DASH (.mpd) manifest, which Google can't use.
		$content_url = $this->get_attachment_content_url( $attachment_id );

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

		// Strip HTML from description. When the media item has no description,
		// fall back to the start of its transcript (fetched and cached once).
		$description = trim( wp_strip_all_tags( $attachment->post_content ) );
		if ( '' === $description ) {
			$description = $this->get_transcript_excerpt( $attachment_id, $allow_remote );
		}

		return array(
			'contentUrl'       => $content_url,
			'embedUrl'         => $this->get_embed_url( $attachment_id ),
			'headline'         => $attachment->post_title,
			'description'      => $description,
			'uploadDate'       => $upload_date,
			'duration'         => $duration,
			'thumbnailUrl'     => $thumbnail_url,
			'isFamilyFriendly' => true,
		);
	}

	/**
	 * Resolve the URL Google should index as a video's `contentUrl`.
	 *
	 * Google's supported formats list M3U8 (HLS) but not MPD (DASH), so this
	 * prefers the HLS stream and falls back to the original uploaded file.
	 * `rtgodam_transcoded_url` (the DASH manifest) is deliberately never used.
	 *
	 * @since 2.5.0
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string The HLS URL, the original file URL, or '' when neither exists.
	 */
	public function get_attachment_content_url( $attachment_id ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id ) {
			return '';
		}

		if ( function_exists( 'rtgodam_get_hls_transcoded_url_from_attachment' ) ) {
			// Fires its own rtgodam_before/after_attachment_lookup pair.
			$hls_url = (string) rtgodam_get_hls_transcoded_url_from_attachment( $attachment_id );
		} else {
			do_action( 'rtgodam_before_attachment_lookup' );
			$hls_url = (string) get_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', true );
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		if ( '' !== $hls_url && ! self::is_dash_url( $hls_url ) ) {
			$content_url = $hls_url;
		} else {
			/**
			 * Fires before reading this attachment's original file URL, so
			 * integrations that centralize media on another site can switch
			 * context first.
			 *
			 * @since 2.5.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );
			$original_url = wp_get_attachment_url( $attachment_id );
			do_action( 'rtgodam_after_attachment_lookup' );

			$content_url = ( $original_url && ! self::is_dash_url( $original_url ) ) ? $original_url : '';
		}

		/**
		 * Filters the URL used as a video's schema `contentUrl` and sitemap
		 * `<video:content_loc>`.
		 *
		 * @since 2.5.0
		 *
		 * @param string $content_url   HLS URL, original file URL, or ''.
		 * @param int    $attachment_id Attachment ID.
		 */
		return (string) apply_filters( 'godam_video_seo_content_url', $content_url, $attachment_id );
	}

	/**
	 * Build the player (embed) URL for a video, used as schema `embedUrl` and
	 * sitemap `<video:player_loc>`.
	 *
	 * Uses GoDAM's existing video-embed page (`?godam_page=video-embed&id=…`),
	 * so no new public URL is created.
	 *
	 * @since 2.5.0
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string The embed URL, or '' for an invalid ID.
	 */
	public function get_embed_url( $attachment_id ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id ) {
			return '';
		}

		$embed_url = add_query_arg(
			array(
				'godam_page' => 'video-embed',
				'id'         => $attachment_id,
			),
			home_url( '/' )
		);

		/**
		 * Filters the player URL used as a video's schema `embedUrl`.
		 *
		 * Return '' to leave `embedUrl` out.
		 *
		 * @since 2.5.0
		 *
		 * @param string $embed_url     The embed page URL.
		 * @param int    $attachment_id Attachment ID.
		 */
		return (string) apply_filters( 'godam_video_seo_embed_url', $embed_url, $attachment_id );
	}

	/**
	 * Whether a URL points at a DASH (.mpd) manifest.
	 *
	 * @since 2.5.0
	 *
	 * @param string $url URL to check.
	 * @return bool
	 */
	public static function is_dash_url( $url ) {
		if ( ! is_string( $url ) || '' === $url ) {
			return false;
		}

		$path = (string) wp_parse_url( $url, PHP_URL_PATH );

		return '.mpd' === strtolower( substr( $path, -4 ) );
	}

	/**
	 * Get a short plain-text excerpt of a video's transcript, for use as a
	 * fallback schema description.
	 *
	 * The transcript is a WebVTT/SRT file referenced by `rtgodam_transcript_path`.
	 * Its text is fetched once and cached on the attachment (keyed by the
	 * transcript path, so a new transcript is picked up automatically). Pass
	 * `$allow_remote = false` on page renders to only ever read that cache.
	 *
	 * @since 2.5.0
	 *
	 * @param int  $attachment_id Attachment ID.
	 * @param bool $allow_remote  Whether the transcript file may be fetched when not cached.
	 * @return string Excerpt of up to {@see self::DESCRIPTION_MAX_LENGTH} characters, or ''.
	 */
	public function get_transcript_excerpt( $attachment_id, $allow_remote = false ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id ) {
			return '';
		}

		/**
		 * Fires before reading this attachment's transcript meta, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.5.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$transcript_path = (string) get_post_meta( $attachment_id, 'rtgodam_transcript_path', true );
		$is_deleted      = (bool) get_post_meta( $attachment_id, 'rtgodam_transcript_deleted', true );
		$cache           = get_post_meta( $attachment_id, self::TRANSCRIPT_EXCERPT_META_KEY, true );
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( '' === $transcript_path || $is_deleted ) {
			return '';
		}

		if ( is_array( $cache ) && isset( $cache['path'], $cache['text'] ) && $cache['path'] === $transcript_path ) {
			$failed_at = isset( $cache['failed_at'] ) ? (int) $cache['failed_at'] : 0;

			// A failed fetch is remembered for an hour, so saves that happen in
			// bursts (e.g. WooCommerce stock changes re-saving product pages)
			// don't each wait on a dead transcript URL. After that, retry.
			if ( ! $failed_at || ! $allow_remote || ( time() - $failed_at ) < self::TRANSCRIPT_RETRY_AFTER ) {
				return (string) $cache['text'];
			}
		}

		if ( ! $allow_remote ) {
			return '';
		}

		$raw = $this->read_transcript_file( $transcript_path );
		if ( false === $raw ) {
			do_action( 'rtgodam_before_attachment_lookup' );
			update_post_meta(
				$attachment_id,
				self::TRANSCRIPT_EXCERPT_META_KEY,
				array(
					'path'      => $transcript_path,
					'text'      => '',
					'failed_at' => time(),
				)
			);
			do_action( 'rtgodam_after_attachment_lookup' );

			return '';
		}

		$excerpt = self::trim_to_length( self::transcript_to_text( $raw ), self::DESCRIPTION_MAX_LENGTH );

		do_action( 'rtgodam_before_attachment_lookup' );
		update_post_meta(
			$attachment_id,
			self::TRANSCRIPT_EXCERPT_META_KEY,
			array(
				'path' => $transcript_path,
				'text' => $excerpt,
			)
		);
		do_action( 'rtgodam_after_attachment_lookup' );

		return $excerpt;
	}

	/**
	 * Read a transcript file's contents.
	 *
	 * Files in this site's uploads directory are read from disk (this also
	 * works on local sites whose hostnames don't resolve from PHP); anything
	 * else is fetched with wp_safe_remote_get().
	 *
	 * @since 2.5.0
	 *
	 * @param string $url Transcript URL.
	 * @return string|false File contents, or false on failure.
	 */
	private function read_transcript_file( $url ) {
		$uploads = wp_get_upload_dir();
		if ( ! empty( $uploads['baseurl'] ) && ! empty( $uploads['basedir'] ) && 0 === strpos( $url, trailingslashit( $uploads['baseurl'] ) ) ) {
			$relative = substr( $url, strlen( trailingslashit( $uploads['baseurl'] ) ) );
			$file     = trailingslashit( $uploads['basedir'] ) . rawurldecode( $relative );

			// realpath() throws a ValueError on a NUL byte (e.g. "%00" in the URL).
			if ( false !== strpos( $file, "\0" ) ) {
				return false;
			}

			$real = realpath( $file );
			$base = realpath( $uploads['basedir'] );

			// Compare against the uploads dir *with* a trailing separator, so a
			// sibling such as "/uploads-other/" can't pass the prefix check.
			if ( $real && $base && 0 === strpos( $real, trailingslashit( $base ) ) && is_file( $real ) && is_readable( $real ) ) {
				$contents = file_get_contents( $real ); // phpcs:ignore WordPressVIPMinimum.Performance.FetchingRemoteData.FileGetContentsUnknown -- local uploads file, path validated above.
				return false === $contents ? false : (string) $contents;
			}
		}

		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout' => 3, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- runs on save, kept short.
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return false;
		}

		return (string) wp_remote_retrieve_body( $response );
	}

	/**
	 * Convert a WebVTT or SRT transcript into plain running text.
	 *
	 * Drops the WEBVTT header, NOTE/STYLE/REGION blocks, cue identifiers,
	 * timing lines and inline tags, then joins the cue text with spaces.
	 *
	 * @since 2.5.0
	 *
	 * @param string $raw Transcript file contents.
	 * @return string Plain text.
	 */
	public static function transcript_to_text( $raw ) {
		$raw    = str_replace( array( "\r\n", "\r" ), "\n", (string) $raw );
		$raw    = preg_replace( '/^\xEF\xBB\xBF/', '', $raw ); // UTF-8 BOM.
		$blocks = preg_split( "/\n\s*\n/", $raw );
		$parts  = array();

		foreach ( $blocks as $block ) {
			$lines = array_values( array_filter( array_map( 'trim', explode( "\n", trim( $block ) ) ), 'strlen' ) );
			if ( empty( $lines ) ) {
				continue;
			}

			// Only cue blocks carry spoken text, and a cue block always has a
			// timing line ("00:00:01.000 --> 00:00:04.000", or "," in SRT).
			// Header, NOTE, STYLE and REGION blocks have none and are skipped.
			$timing_index = null;
			foreach ( $lines as $index => $line ) {
				if ( false !== strpos( $line, '-->' ) ) {
					$timing_index = $index;
					break;
				}
			}

			if ( null === $timing_index ) {
				continue;
			}

			// Lines before the timing line are the cue identifier (numeric in
			// SRT, any text in WebVTT); the cue text is everything after it.
			// Text that merely starts with "Note" or is a number is kept.
			foreach ( array_slice( $lines, $timing_index + 1 ) as $line ) {
				$text = trim( preg_replace( '/<[^>]*>/', '', $line ) );
				if ( '' !== $text ) {
					// Decode entities, then strip again: "&lt;/script&gt;" must not
					// come back as a real tag.
					$parts[] = wp_strip_all_tags( html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
				}
			}
		}

		return trim( preg_replace( '/\s+/u', ' ', implode( ' ', $parts ) ) );
	}

	/**
	 * Trim text to a maximum length, cutting at a word boundary and adding an
	 * ellipsis when shortened. The result, ellipsis included, never exceeds
	 * `$max_length` characters.
	 *
	 * @since 2.5.0
	 *
	 * @param string $text       Plain text.
	 * @param int    $max_length Maximum number of characters.
	 * @return string
	 */
	public static function trim_to_length( $text, $max_length ) {
		$text = trim( preg_replace( '/\s+/u', ' ', (string) $text ) );

		if ( mb_strlen( $text, 'UTF-8' ) <= $max_length ) {
			return $text;
		}

		$cut        = mb_substr( $text, 0, $max_length - 1, 'UTF-8' );
		$last_space = mb_strrpos( $cut, ' ', 0, 'UTF-8' );

		// Only back off to a word boundary if it doesn't throw away most of the text.
		if ( false !== $last_space && $last_space > (int) ( $max_length * 0.6 ) ) {
			$cut = mb_substr( $cut, 0, $last_space, 'UTF-8' );
		}

		return rtrim( $cut, " \t\n\r\0\x0B.,;:-" ) . '…';
	}

	/**
	 * Interpret a stored family-friendly flag as a real boolean.
	 *
	 * Older blocks and page-builder settings can store this as a string
	 * ("True", "false", "1", "yes", ""), and a plain (bool) cast would turn
	 * "false" into true.
	 *
	 * @since 2.5.0
	 *
	 * @param mixed $value Stored value.
	 * @return bool
	 */
	public static function to_bool( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( is_string( $value ) ) {
			$value = strtolower( trim( $value ) );
			if ( in_array( $value, array( 'false', '0', 'no', 'off', '' ), true ) ) {
				return false;
			}
			return true;
		}

		return (bool) $value;
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
			// JSON_HEX_TAG / JSON_HEX_AMP encode < > & as \u003C \u003E \u0026, so no
			// value (e.g. a description containing "</script>") can close the tag.
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG | JSON_HEX_AMP
		) . '</script>';
	}

	/**
	 * Build a sanitized VideoObject schema array from a raw video SEO entry.
	 *
	 * Shared by the cached wp_head output ({@see add_video_seo_schema}) and the
	 * render-time output ({@see output_render_time_video_seo_schema}) so both
	 * paths produce identical schema and fire the same per-entry filter.
	 *
	 * Also used by the video sitemap ({@see Video_Sitemap}), so the sitemap and
	 * the schema always agree.
	 *
	 * @since 2.1.0
	 * @since 2.5.0 Public. HLS contentUrl, embedUrl, description fallbacks, and
	 *              empty description/uploadDate are left out instead of output empty.
	 *
	 * @param array $video   Raw video SEO data (headline, contentUrl, etc.).
	 * @param int   $post_id The current post ID for filter context. May be 0 on
	 *                       non-singular render-time views (archives/search/404),
	 *                       where the queried object has no post ID.
	 * @return array|null The VideoObject schema array, or null when invalid.
	 */
	public function build_video_object_schema( $video, $post_id ) {
		if ( ! is_array( $video ) || empty( $video['headline'] ) ) {
			return null;
		}

		$attachment_id = ! empty( $video['attachment_id'] ) ? absint( $video['attachment_id'] ) : 0;

		$schema = array(
			'@context' => 'https://schema.org',
			'@type'    => 'VideoObject',
			'name'     => sanitize_text_field( $video['headline'] ?? '' ),
		);

		// Never output an empty description (Search Console flags it). Fall back
		// to the transcript, then the page excerpt; otherwise leave it out.
		$description = $this->resolve_schema_description( $video, $attachment_id, $post_id );
		if ( '' !== $description ) {
			$schema['description'] = $description;
		}

		$content_url = $this->resolve_schema_content_url( $video, $attachment_id );

		// Elementor and WPBakery entries cached by older GoDAM versions have no attachment
		// ID and a DASH contentUrl, so neither contentUrl nor embedUrl can be
		// resolved for them here. Re-save the page once in the background to
		// rebuild its cache in the current shape.
		if ( 0 === $attachment_id && $post_id > 0 && ! empty( $video['contentUrl'] ) && self::is_dash_url( (string) $video['contentUrl'] ) ) {
			$this->maybe_queue_legacy_resave( $post_id );
		}
		if ( '' !== $content_url ) {
			$schema['contentUrl'] = esc_url_raw( $content_url );
		}

		$embed_url = ! empty( $video['embedUrl'] ) && is_string( $video['embedUrl'] )
			? $video['embedUrl']
			: $this->get_embed_url( $attachment_id );
		if ( '' !== $embed_url ) {
			$schema['embedUrl'] = esc_url_raw( $embed_url );
		}

		$upload_date = sanitize_text_field( $video['uploadDate'] ?? '' );
		if ( '' !== $upload_date ) {
			$schema['uploadDate'] = $upload_date;
		}

		// A real JSON boolean, whatever shape the stored value has.
		$schema['isFamilyFriendly'] = isset( $video['isFamilyFriendly'] ) ? self::to_bool( $video['isFamilyFriendly'] ) : true;

		if ( ! empty( $video['thumbnailUrl'] ) ) {
			$schema['thumbnailUrl'] = esc_url_raw( $video['thumbnailUrl'] );
		}

		if ( ! empty( $video['duration'] ) ) {
			$schema['duration'] = sanitize_text_field( $video['duration'] );
		}

		// Key moments: the video's chapters as Clip entries, so Google can show
		// "jump to" links in search. Needs the host page to build each clip's URL.
		if ( $attachment_id > 0 && $post_id > 0 ) {
			$clips = $this->get_key_moment_clips( $attachment_id, $post_id, $schema['duration'] ?? '' );
			if ( ! empty( $clips ) ) {
				$schema['hasPart'] = $clips;
			}
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
	 * Build Google "key moments" for a video from its GoDAM chapters.
	 *
	 * Each chapter becomes a schema.org `Clip` with a deep link that seeks the
	 * player on the host page (`?t=<seconds>#godam-video-<id>`). The fragment
	 * is not an element anchor: the GoDAM player script reads it and matches
	 * `<id>` against the player's `data-id` attribute. Read at output time from
	 * the attachment's `rtgodam_meta`, so editing chapters updates the schema
	 * without re-saving the page. Skipped for videos known to be shorter than
	 * {@see Seo::KEY_MOMENTS_MIN_DURATION} seconds.
	 *
	 * @see https://developers.google.com/search/docs/appearance/structured-data/video#clip
	 *
	 * @since 2.5.0
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param int    $post_id       Host post ID (the page the video is on).
	 * @param string $duration      Video duration (ISO 8601), used to end the last clip.
	 * @return array[] Clip entries for `hasPart`, or an empty array.
	 */
	public function get_key_moment_clips( $attachment_id, $post_id, $duration = '' ) {
		$attachment_id = absint( $attachment_id );
		$post_id       = absint( $post_id );

		if ( ! $attachment_id || ! $post_id ) {
			return array();
		}

		/**
		 * Filters whether chapters are output as key moments (`hasPart` Clips).
		 *
		 * @since 2.5.0
		 *
		 * @param bool $enabled       Default true.
		 * @param int  $attachment_id Attachment ID.
		 * @param int  $post_id       Host post ID.
		 */
		if ( ! apply_filters( 'godam_video_seo_key_moments_enabled', true, $attachment_id, $post_id ) ) {
			return array();
		}

		/**
		 * Fires before reading this attachment's chapters (rtgodam_meta), so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.5.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$meta = get_post_meta( $attachment_id, 'rtgodam_meta', true );
		do_action( 'rtgodam_after_attachment_lookup' );

		$chapters = ( is_array( $meta ) && ! empty( $meta['chapters'] ) && is_array( $meta['chapters'] ) ) ? $meta['chapters'] : array();
		if ( empty( $chapters ) ) {
			return array();
		}

		$page_url = (string) get_permalink( $post_id ); // godam-coverage-ignore -- get_key_moment_clips(): $post_id is the host page, never an attachment.
		if ( '' === $page_url ) {
			return array();
		}

		$duration_seconds = self::iso8601_to_seconds( $duration );

		// Google only shows key moments for videos of at least 30 seconds.
		if ( $duration_seconds > 0 && $duration_seconds < self::KEY_MOMENTS_MIN_DURATION ) {
			return array();
		}

		$clips = self::chapters_to_clips( $chapters, $page_url, $attachment_id, $duration_seconds );

		/**
		 * Filters the key moment Clip entries output in a video's `hasPart`.
		 *
		 * @since 2.5.0
		 *
		 * @param array[] $clips         Clip entries.
		 * @param int     $attachment_id Attachment ID.
		 * @param int     $post_id       Host post ID.
		 * @param array   $chapters      Raw chapters from rtgodam_meta.
		 */
		$clips = apply_filters( 'godam_video_seo_key_moments', $clips, $attachment_id, $post_id, $chapters );

		return is_array( $clips ) ? array_values( $clips ) : array();
	}

	/**
	 * Convert GoDAM chapters into schema.org Clip entries.
	 *
	 * Chapters are sorted by start time and offsets are whole seconds, rounded
	 * down. Duplicate start seconds (the first chapter wins) and chapters
	 * starting at or after the end of the video are dropped first. A chapter's
	 * end is then its own `endTime` when set, otherwise the next kept
	 * chapter's start, otherwise the video duration, and never later than the
	 * next kept chapter's start or the duration. Chapters without a title,
	 * with an unreadable start, or with no length are skipped.
	 *
	 * Pure: no WordPress calls.
	 *
	 * @since 2.5.0
	 *
	 * @param array  $chapters         Chapters (`text`, `startTime`, optional `endTime`, `originalTime`).
	 * @param string $page_url         Host page URL.
	 * @param int    $attachment_id    Attachment ID, for the `#godam-video-<id>` deep-link fragment.
	 * @param int    $duration_seconds Video length in seconds, or 0 when unknown.
	 * @return array[] Clip entries.
	 */
	public static function chapters_to_clips( array $chapters, $page_url, $attachment_id, $duration_seconds = 0 ) {
		$rows = array();

		foreach ( $chapters as $chapter ) {
			$chapter = (array) $chapter;
			$name    = trim( wp_strip_all_tags( (string) ( $chapter['text'] ?? '' ) ) );

			$start_raw = ( isset( $chapter['startTime'] ) && '' !== (string) $chapter['startTime'] )
				? $chapter['startTime']
				: ( $chapter['originalTime'] ?? null );
			$start     = self::parse_time_to_seconds( $start_raw );

			if ( '' === $name || null === $start || $start < 0 ) {
				continue;
			}

			$end = ( isset( $chapter['endTime'] ) && '' !== (string) $chapter['endTime'] )
				? self::parse_time_to_seconds( $chapter['endTime'] )
				: null;

			$rows[] = array(
				'name'  => $name,
				'start' => $start,
				'end'   => $end,
			);
		}

		usort(
			$rows,
			function ( $a, $b ) {
				return $a['start'] <=> $b['start'];
			}
		);

		// Strip any fragment from the page URL; the clip adds its own.
		$base = (string) preg_replace( '/#.*$/', '', (string) $page_url );
		$sep  = ( false === strpos( $base, '?' ) ) ? '?' : '&';

		// Whole seconds, rounded down for both start and end, so a clip never
		// overlaps the next one. De-duplicate (keeping the first chapter for a
		// given second) and drop chapters past the end of the video *before*
		// working out ends, so "next chapter" always means one that is output.
		$kept        = array();
		$seen_starts = array();

		foreach ( $rows as $row ) {
			$start_offset = (int) floor( $row['start'] );

			if ( isset( $seen_starts[ $start_offset ] ) ) {
				continue;
			}

			if ( $duration_seconds > 0 && $start_offset >= $duration_seconds ) {
				continue;
			}

			$seen_starts[ $start_offset ] = true;

			$row['start_offset'] = $start_offset;
			$kept[]              = $row;
		}

		$clips = array();
		$count = count( $kept );

		for ( $i = 0; $i < $count; $i++ ) {
			$start_offset = $kept[ $i ]['start_offset'];
			$next_start   = ( $i + 1 < $count ) ? $kept[ $i + 1 ]['start_offset'] : null;

			$end_offset = null;
			if ( null !== $kept[ $i ]['end'] ) {
				$end_offset = (int) floor( $kept[ $i ]['end'] );
			} elseif ( null !== $next_start ) {
				$end_offset = $next_start;
			} elseif ( $duration_seconds > 0 ) {
				$end_offset = (int) $duration_seconds;
			}

			$clip = array(
				'@type'       => 'Clip',
				'name'        => $kept[ $i ]['name'],
				'startOffset' => $start_offset,
			);

			if ( null !== $end_offset ) {
				// Never run into the next clip or past the end of the video.
				if ( null !== $next_start ) {
					$end_offset = min( $end_offset, $next_start );
				}
				if ( $duration_seconds > 0 ) {
					$end_offset = min( $end_offset, (int) $duration_seconds );
				}
				if ( $end_offset <= $start_offset ) {
					continue;
				}
				$clip['endOffset'] = $end_offset;
			}

			$clip['url'] = $base . $sep . 't=' . $start_offset . '#godam-video-' . (int) $attachment_id;
			$clips[]     = $clip;
		}

		return $clips;
	}

	/**
	 * Parse a chapter time: plain seconds ("90", "12.5"), "mm:ss" or "hh:mm:ss(.ms)".
	 *
	 * @since 2.5.0
	 *
	 * @param mixed $value Time value.
	 * @return float|null Seconds, or null when unreadable.
	 */
	public static function parse_time_to_seconds( $value ) {
		if ( null === $value || is_array( $value ) || is_object( $value ) ) {
			return null;
		}

		$value = trim( (string) $value );

		if ( '' === $value ) {
			return null;
		}

		if ( is_numeric( $value ) ) {
			return (float) $value;
		}

		if ( ! preg_match( '/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/', $value, $m ) ) {
			return null;
		}

		$hours   = '' !== $m[1] ? (int) $m[1] : 0;
		$minutes = (int) $m[2];
		$seconds = (float) $m[3];

		return $hours * 3600 + $minutes * 60 + $seconds;
	}

	/**
	 * Convert an ISO 8601 duration (e.g. "PT1H2M3S") to whole seconds.
	 *
	 * @since 2.5.0
	 *
	 * @param string $duration ISO 8601 duration.
	 * @return int Seconds, or 0 when unparseable.
	 */
	public static function iso8601_to_seconds( $duration ) {
		if ( ! is_string( $duration ) || ! preg_match( '/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i', trim( $duration ), $m ) ) {
			return 0;
		}

		$days    = isset( $m[1] ) ? (int) $m[1] : 0;
		$hours   = isset( $m[2] ) ? (int) $m[2] : 0;
		$minutes = isset( $m[3] ) ? (int) $m[3] : 0;
		$seconds = isset( $m[4] ) ? (float) $m[4] : 0;

		return (int) round( $days * 86400 + $hours * 3600 + $minutes * 60 + $seconds );
	}

	/**
	 * Queue a one-time background re-save of a page whose cached video SEO
	 * was cached by an older GoDAM version.
	 *
	 * In older GoDAM versions only the block stored an attachment ID in each cached entry;
	 * Elementor and WPBakery entries kept just the DASH (.mpd) contentUrl. Such
	 * entries can't be resolved to an HLS contentUrl or an embedUrl at output
	 * time, so the page's cache is rebuilt once via WP-Cron. A post meta flag
	 * makes sure each page is only ever queued once.
	 *
	 * Built for sites with many such pages, since the first sitemap index
	 * request can hit all of them: IDs are collected for the request and
	 * written to one queue option at shutdown, a single cron event is
	 * scheduled, and each run re-saves {@see Seo::LEGACY_RESAVE_BATCH_SIZE}
	 * pages.
	 *
	 * @since 2.5.0
	 *
	 * @param int $post_id Host post ID.
	 * @return void
	 */
	public function maybe_queue_legacy_resave( $post_id ) {
		$post_id = absint( $post_id );
		if ( ! $post_id ) {
			return;
		}

		if ( get_post_meta( $post_id, self::LEGACY_RESAVE_META_KEY, true ) ) { // godam-coverage-ignore -- maybe_queue_legacy_resave(): $post_id is the host page, never an attachment.
			return;
		}

		update_post_meta( $post_id, self::LEGACY_RESAVE_META_KEY, time() ); // godam-coverage-ignore -- maybe_queue_legacy_resave(): flag on the host page, never an attachment.

		if ( empty( $this->pending_legacy_resaves ) ) {
			add_action( 'shutdown', array( $this, 'flush_legacy_resave_queue' ) );
		}

		$this->pending_legacy_resaves[] = $post_id;
	}

	/**
	 * Add the pages queued during this request to the re-save queue and make
	 * sure a cron run is scheduled. Runs once, at shutdown.
	 *
	 * @since 2.5.0
	 *
	 * @return void
	 */
	public function flush_legacy_resave_queue() {
		if ( empty( $this->pending_legacy_resaves ) ) {
			return;
		}

		$queue = get_option( self::LEGACY_RESAVE_QUEUE_OPTION, array() );
		$queue = is_array( $queue ) ? array_map( 'absint', $queue ) : array();
		$queue = array_values( array_unique( array_filter( array_merge( $queue, $this->pending_legacy_resaves ) ) ) );

		$this->pending_legacy_resaves = array();

		update_option( self::LEGACY_RESAVE_QUEUE_OPTION, $queue, false );
		$this->schedule_legacy_resave_run();
	}

	/**
	 * Re-save the next batch of queued pages (WP-Cron callback), and schedule
	 * another run while pages remain.
	 *
	 * @since 2.5.0
	 *
	 * @return void
	 */
	public function process_legacy_resave_queue() {
		$queue = get_option( self::LEGACY_RESAVE_QUEUE_OPTION, array() );
		$queue = is_array( $queue ) ? array_values( array_filter( array_map( 'absint', $queue ) ) ) : array();

		if ( empty( $queue ) ) {
			return;
		}

		$batch     = array_slice( $queue, 0, self::LEGACY_RESAVE_BATCH_SIZE );
		$remaining = array_slice( $queue, self::LEGACY_RESAVE_BATCH_SIZE );

		// Save the shorter queue first, so a fatal error on one page can't
		// make every later run retry the same batch.
		update_option( self::LEGACY_RESAVE_QUEUE_OPTION, $remaining, false );

		foreach ( $batch as $post_id ) {
			$this->resave_post_video_seo( $post_id );
		}

		if ( ! empty( $remaining ) ) {
			$this->schedule_legacy_resave_run();
		}
	}

	/**
	 * Schedule the next queue run, unless one is already scheduled.
	 *
	 * @since 2.5.0
	 *
	 * @return void
	 */
	private function schedule_legacy_resave_run() {
		if ( ! wp_next_scheduled( self::LEGACY_RESAVE_CRON_HOOK ) ) {
			wp_schedule_single_event( time(), self::LEGACY_RESAVE_CRON_HOOK );
		}
	}

	/**
	 * Rebuild a page's cached video SEO (one page of the re-save queue).
	 *
	 * @since 2.5.0
	 *
	 * @param int $post_id Host post ID.
	 * @return void
	 */
	public function resave_post_video_seo( $post_id ) {
		$post = get_post( $post_id ); // godam-coverage-ignore -- resave_post_video_seo(): host page queued by maybe_queue_legacy_resave(), never an attachment.
		if ( ! $post ) {
			return;
		}

		if ( $this->is_elementor_post( $post_id ) ) {
			$this->elementor_save_seo_data_as_postmeta( $post_id );
		} else {
			$this->save_seo_data_as_postmeta( $post_id, $post );
		}
	}

	/**
	 * Resolve the `contentUrl` for a cached SEO entry.
	 *
	 * Resolved at output time rather than trusted from the cache, so pages saved
	 * by older GoDAM versions (whose cache holds the DASH .mpd URL) are fixed without a
	 * re-save, and a video that finishes HLS transcoding after the page was
	 * saved starts pointing at the HLS stream straight away.
	 *
	 * @since 2.5.0
	 *
	 * @param array $video         Cached SEO entry.
	 * @param int   $attachment_id Attachment ID, or 0.
	 * @return string URL, or '' when there is no indexable URL.
	 */
	private function resolve_schema_content_url( array $video, $attachment_id ) {
		if ( $attachment_id > 0 ) {
			$content_url = $this->get_attachment_content_url( $attachment_id );
			if ( '' !== $content_url ) {
				return $content_url;
			}
		}

		$stored = ! empty( $video['contentUrl'] ) && is_string( $video['contentUrl'] ) ? $video['contentUrl'] : '';

		// Never hand Google a DASH manifest it can't index.
		return self::is_dash_url( $stored ) ? '' : $stored;
	}

	/**
	 * Resolve the description for a cached SEO entry: the entry's own
	 * description, else the transcript excerpt, else the page excerpt.
	 *
	 * @since 2.5.0
	 *
	 * @param array $video         Cached SEO entry.
	 * @param int   $attachment_id Attachment ID, or 0.
	 * @param int   $post_id       Host post ID, or 0.
	 * @return string Plain text, or '' when none is available.
	 */
	private function resolve_schema_description( array $video, $attachment_id, $post_id ) {
		$description = trim( wp_strip_all_tags( (string) ( $video['description'] ?? '' ) ) );

		if ( '' === $description && $attachment_id > 0 ) {
			// Cache-only read: never fetch a transcript during a page render.
			$description = $this->get_transcript_excerpt( $attachment_id, false );
		}

		if ( '' === $description && $post_id > 0 ) {
			$description = $this->get_post_excerpt_fallback( $post_id );
		}

		/**
		 * Filters the description used for a video's schema and sitemap entry.
		 *
		 * Return '' to leave the description out.
		 *
		 * @since 2.5.0
		 *
		 * @param string $description   Resolved description.
		 * @param array  $video         Cached SEO entry.
		 * @param int    $post_id       Host post ID, or 0.
		 */
		return trim( (string) apply_filters( 'godam_video_seo_description', $description, $video, $post_id ) );
	}

	/**
	 * Build a fallback description from the host page: its manual excerpt, or
	 * else the start of its text content. Block markup and shortcodes are
	 * stripped without rendering them.
	 *
	 * @since 2.5.0
	 *
	 * @param int $post_id Host post ID.
	 * @return string Up to {@see self::DESCRIPTION_MAX_LENGTH} characters, or ''.
	 */
	private function get_post_excerpt_fallback( $post_id ) {
		$post = get_post( $post_id ); // godam-coverage-ignore -- get_post_excerpt_fallback(): $post_id is the host page (queried object), never an attachment.
		if ( ! is_object( $post ) || empty( $post->post_type ) || 'attachment' === $post->post_type ) {
			return '';
		}

		// Only a publicly viewable post may feed the description: never a
		// draft, pending, scheduled or private one.
		if ( ! is_post_publicly_viewable( $post ) ) {
			return '';
		}

		// Never expose a password-protected page's text to visitors who haven't
		// entered the password (core's get_the_excerpt() follows the same rule).
		if ( ! empty( $post->post_password ) ) {
			return '';
		}

		$text = has_excerpt( $post ) ? $post->post_excerpt : $post->post_content;
		$text = preg_replace( '/<!--.*?-->/s', '', (string) $text );
		$text = wp_strip_all_tags( $this->strip_all_shortcodes( $text ) );
		// Decode entities, then strip again: text stored as "&lt;/script&gt;"
		// must not come back as a real tag.
		$text = wp_strip_all_tags( html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );

		return self::trim_to_length( $text, self::DESCRIPTION_MAX_LENGTH );
	}

	/**
	 * Remove shortcodes from a text, including page-builder shortcodes that are
	 * not registered yet, together with the text they enclose.
	 *
	 * Core's strip_shortcodes() only removes the shortcodes registered at the
	 * moment it runs. The video sitemap is served at parse_request priority 1,
	 * before a page builder such as WPBakery or Divi registers its own, so
	 * their tags would stay in the description as raw `[vc_row]` text while a
	 * front-end page (wp_head, after the builder loaded) drops them. Adding
	 * the unregistered builder-style tag names found in the text to core's list,
	 * through its own `strip_shortcodes_tagnames` filter, gives the same result
	 * at both points.
	 *
	 * Only names that look like a builder tag are added (see
	 * {@see self::FALLBACK_SHORTCODE_NAME_PATTERN}): ordinary bracketed text
	 * such as `[sic]`, `[1]` or `[b]bold[/b]` is left alone, so the description
	 * of a page whose shortcodes are all registered does not change.
	 *
	 * @since 2.5.0
	 *
	 * @param string $text Page text.
	 * @return string Text without shortcodes.
	 */
	private function strip_all_shortcodes( $text ) {
		$add_found_tag_names = static function ( $tags, $content ) {
			global $shortcode_tags;

			$tags       = (array) $tags;
			$registered = is_array( $shortcode_tags ) ? $shortcode_tags : array();
			$found      = array();

			preg_match_all( '@\[([^<>&/\[\]\x00-\x20=]++)@', (string) $content, $matches );

			foreach ( array_unique( $matches[1] ) as $name ) {
				if ( count( $found ) >= self::FALLBACK_UNREGISTERED_SHORTCODES_LIMIT ) {
					break;
				}

				// A tag another filter took off the list is registered: leave it be.
				if ( array_key_exists( $name, $registered ) || ! preg_match( self::FALLBACK_SHORTCODE_NAME_PATTERN, $name ) ) {
					continue;
				}

				$found[] = $name;
			}

			return array_merge( $tags, $found );
		};

		add_filter( 'strip_shortcodes_tagnames', $add_found_tag_names, 10, 2 );

		try {
			$stripped = strip_shortcodes( $text );
		} finally {
			remove_filter( 'strip_shortcodes_tagnames', $add_found_tag_names, 10 );
		}

		return (string) $stripped;
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

		// Only a singular view has a host post. On term and author archives the
		// queried object ID is a term or user ID, which would otherwise be read
		// as an unrelated post (description fallback, re-save queue, clip URLs).
		$post_id = is_singular() ? get_queried_object_id() : 0;

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
			// JSON_HEX_TAG / JSON_HEX_AMP encode < > & as \u003C \u003E \u0026, so no
			// value (e.g. a description containing "</script>") can close the tag.
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG | JSON_HEX_AMP
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
					$exclude      = isset( $settings['seo_exclude_from_sitemap'] ) && 'yes' === $settings['seo_exclude_from_sitemap'];

					// Get attachment ID from video-file setting.
					$attachment_id = 0;
					if ( isset( $settings['video-file']['id'] ) && is_numeric( $settings['video-file']['id'] ) ) {
						$attachment_id = absint( $settings['video-file']['id'] );
					}

					// If seo_override is false, try to fetch SEO from the media attachment.
					if ( ! $seo_override ) {
						if ( $attachment_id > 0 ) {
							$media_seo = $seo_obj->get_seo_from_attachment( $attachment_id );
							if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
								$media_seo['attachment_id']      = $attachment_id;
								$media_seo['excludeFromSitemap'] = $exclude;
								$seo_data[]                      = $media_seo;
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

						$_seo_data['excludeFromSitemap'] = $exclude;
						if ( $attachment_id > 0 ) {
							$_seo_data['attachment_id'] = $attachment_id;
						}

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
			$had_schema = metadata_exists( 'post', $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY );

			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_META_KEY ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; clears its own cached video SEO schema meta, not attachment data.
			delete_post_meta( $post_ID, self::VIDEO_SEO_SCHEMA_UPDATED_META_KEY ); // godam-coverage-ignore -- elementor_save_seo_data_as_postmeta(): $post_ID is the host post being saved; clears its own cached-schema-updated timestamp meta, not attachment data.
			$this->update_attachment_post_mapping( $post_ID, array() );
			/** This action is documented in inc/classes/class-seo.php */
			do_action( 'godam_video_seo_schema_cleared', $post_ID, $had_schema );
		}
	}

	/**
	 * Undo WPBakery's shortcode-safe encoding of a param value.
	 *
	 * WPBakery stores `"` as two backticks, and `[` / `]` as `{` / `}`
	 * wrapped in backticks, so they can't break the shortcode. Same mapping
	 * as WPBakery's `vc_value_from_safe()`, without depending on it being
	 * loaded.
	 *
	 * @since 2.5.0
	 *
	 * @param mixed $value Raw shortcode attribute value.
	 * @return string Decoded value.
	 */
	public static function decode_wpbakery_param( $value ) {
		if ( ! is_scalar( $value ) ) {
			return '';
		}

		return str_replace( array( '`{`', '`}`', '``' ), array( '[', ']', '"' ), (string) $value );
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

				$exclude = isset( $atts['seo_exclude_from_sitemap'] ) && '1' === $atts['seo_exclude_from_sitemap'];

				// If seo_override is false, try to fetch SEO from the media attachment.
				if ( ! $seo_override ) {
					if ( ! empty( $media_seo ) && ! empty( $media_seo['headline'] ) ) {
						$media_seo['attachment_id']      = $attachment_id;
						$media_seo['excludeFromSitemap'] = $exclude;
						$seo_data[]                      = $media_seo;
						if ( $track_attachments ) {
							$attachments[] = $attachment_id;
						}
						continue;
					}
				}

				// Override = No: the SEO fields only mirror the Media Library (the
				// editor fills them in), so stored copies are never used. With no
				// usable attachment data (video deleted, title cleared) nothing is
				// output, rather than a stale VideoObject.
				if ( ! $seo_override ) {
					// Still track a video the Media Library knows about (e.g. its
					// title is empty for now), so filling in the title later
					// re-syncs this page, as for blocks.
					if ( $track_attachments && $attachment_id > 0 && ! empty( $media_seo ) ) {
						$attachments[] = $attachment_id;
					}
					continue;
				}

				// Override = Yes: use the shortcode attributes, with the
				// attachment's technical values taking priority when it exists.
				if ( ! empty( $atts['seo_headline'] ) ) {
					$video_seo = array(
						'contentUrl'         => ! empty( $media_seo['contentUrl'] ) ? $media_seo['contentUrl'] : ( isset( $atts['seo_content_url'] ) ? $atts['seo_content_url'] : '' ),
						'headline'           => self::decode_wpbakery_param( $atts['seo_headline'] ),
						'description'        => isset( $atts['seo_description'] ) ? self::decode_wpbakery_param( $atts['seo_description'] ) : '',
						'uploadDate'         => ! empty( $media_seo['uploadDate'] ) ? $media_seo['uploadDate'] : ( isset( $atts['seo_upload_date'] ) ? $atts['seo_upload_date'] : '' ),
						'thumbnailUrl'       => ! empty( $media_seo['thumbnailUrl'] ) ? $media_seo['thumbnailUrl'] : ( isset( $atts['seo_thumbnail_url'] ) ? $atts['seo_thumbnail_url'] : '' ),
						'isFamilyFriendly'   => isset( $atts['seo_family_friendly'] ) ? '1' === $atts['seo_family_friendly'] : true,
						'duration'           => ! empty( $media_seo['duration'] ) ? $media_seo['duration'] : ( isset( $atts['seo_duration'] ) ? $atts['seo_duration'] : '' ),
						'excludeFromSitemap' => $exclude,
					);

					if ( $attachment_id > 0 ) {
						$video_seo['attachment_id'] = $attachment_id;
					}

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
