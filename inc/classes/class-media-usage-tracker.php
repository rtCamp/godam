<?php
/**
 * Track attachment usage across posts.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Media_Usage_Tracker
 *
 * Maintains a reverse index: for every media attachment used in a post,
 * this class stores the list of referencing post IDs in the attachment's
 * `_godam_usage_post_ids` meta.
 *
 * The index is reference-counted by source (see SOURCES_META_KEY) so multiple
 * independent trackers — this content scanner plus the WooCommerce add-on, which
 * stores video references in post meta rather than content — can share one index
 * without clobbering each other. Other plugins register usage via the public
 * register_media_usage()/unregister_media_usage() methods (or the matching
 * `godam_register_media_usage` / `godam_unregister_media_usage` actions).
 *
 * Supports both WP-native numeric attachment IDs and GoDAM Central string IDs
 * (stored in `_godam_original_id` meta on virtual-media attachments).
 *
 * Detection strategy:
 * 1. Parse media element src/href URLs directly from the HTML in post_content.
 *    This covers every Gutenberg block that renders inline HTML — including all
 *    third-party and custom blocks — as well as Classic Editor content.
 * 2. Walk parsed block attributes for WP core blocks whose attachment-ID
 *    attributes are stable and well-documented (id, mediaId, ids).
 *    GoDAM's own blocks are handled the same way.
 * 3. A `godam_attachment_ids_from_block` filter lets custom blocks contribute
 *    additional IDs without patching this class.
 * 4. GoDAM shortcodes ([godam_video], [godam_audio], [godam_video_gallery]) left
 *    raw in content — used by the Classic Editor and by WPBakery elements, which
 *    persist as shortcodes — are parsed directly (neither rendered HTML nor a block).
 * 5. Elementor-built posts store their widget tree in `_elementor_data` post meta
 *    (not post_content); media controls there are walked separately on save.
 * 6. Block-based widgets live in the `widget_block` option (no post), tracked via
 *    option-change hooks under the WIDGET_SOURCE anchor.
 *
 * Detection is asset-agnostic: images, audio, PDFs and video are all handled the
 * same way, and any attachment carrying `_godam_original_id` (i.e. transcoded
 * GoDAM Central media) additionally triggers Central tracking.
 */
class Media_Usage_Tracker {

	use Singleton;

	/**
	 * Meta key on attachments: int[] of unique post IDs that reference this attachment.
	 *
	 * This is the derived, public query list — the set of post IDs with at least
	 * one referencing source. Kept in sync from SOURCES_META_KEY so existing
	 * consumers of get_usage_post_ids() are unaffected.
	 */
	const ATTACHMENT_META_KEY = '_godam_usage_post_ids';

	/**
	 * Meta key on attachments: source-aware reference map.
	 *
	 * Shape: `array<int $post_id, string[] $sources>` — for each referencing post,
	 * the list of distinct sources that reference this attachment from that post
	 * (e.g. 'content', 'woo_reel_pop', 'woo_featured').
	 *
	 * Multiple independent trackers (this content scanner plus the WooCommerce
	 * add-on) write through register_media_usage()/unregister_media_usage(), which
	 * reference-count by source so a removal by one source does not wipe a usage
	 * another source still holds. A GoDAM Central log fires only on the FIRST
	 * source for a (attachment, post) pair; a remove only when the LAST one drops.
	 */
	const SOURCES_META_KEY = '_godam_usage_sources';

	/**
	 * Meta key on posts: int[] of unique WP attachment post IDs tracked for this post.
	 * Stored so the next save can diff cheaply instead of re-querying every attachment.
	 */
	const POST_META_KEY = '_godam_tracked_media';

	/**
	 * Source label for media embedded in block-based widgets (the `widget_block`
	 * option). Block widgets are site-global, not attached to any post, so usage
	 * is anchored to a synthetic post ID of 0 under this source.
	 */
	const WIDGET_SOURCE = 'block_widget';

	/**
	 * Option storing the int[] of attachment IDs currently tracked across all
	 * block widgets, so changes to the `widget_block` option can be diffed cheaply.
	 */
	const WIDGET_TRACKED_OPTION = 'godam_widget_tracked_media';

	/**
	 * Lazily-resolved hostname of this WordPress site (e.g. "blog.example.com").
	 * Computed once per request from home_url() and reused everywhere.
	 *
	 * @var string|null
	 */
	private $wp_site = null;

	/**
	 * Per-request cache: GoDAM Central ID → WP attachment post ID.
	 *
	 * @var array<string,int>
	 */
	private $godam_id_cache = array();

	/**
	 * Per-request cache: URL → WP attachment post ID.
	 *
	 * @var array<string,int>
	 */
	private $url_id_cache = array();

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	private function setup_hooks() {
		// Track on every post save (create, update, status change, untrash).
		add_action( 'save_post', array( $this, 'on_save_post' ), 99, 2 );

		// Clean up when a post is permanently deleted (not trashed).
		// before_delete_post fires while post meta is still intact.
		add_action( 'before_delete_post', array( $this, 'on_before_delete_post' ) );

		// Note: delete_attachment is intentionally not hooked. Deleting the WP
		// attachment (virtual-media placeholder) does not remove the file from the
		// GoDAM CDN, so embed locations should stay tracked on GoDAM Central.
		// Any stale IDs in _godam_tracked_media are self-healing on the next post save:
		// numeric block-attr IDs still resolve (no diff), and for string GoDAM IDs
		// the if($godam_id) guard in sync_post_attachments prevents a spurious
		// remove_media_view call because _godam_original_id meta is already gone.

		// Async Action Scheduler handlers for GoDAM Central tracking API.
		add_action( 'godam_async_log_media_view', array( $this, 'async_log_media_view' ), 10, 4 );
		add_action( 'godam_async_remove_media_view', array( $this, 'async_remove_media_view' ), 10, 3 );

		// Public usage-registration API for other plugins (e.g. the WooCommerce
		// add-on) that store media references outside post_content. Reference-counted
		// by source so concurrent trackers cannot clobber each other's usage.
		add_action( 'godam_register_media_usage', array( $this, 'register_media_usage' ), 10, 3 );
		add_action( 'godam_unregister_media_usage', array( $this, 'unregister_media_usage' ), 10, 3 );

		// Block-based widgets store their blocks in the `widget_block` option, not
		// in any post, so save_post never sees them. Track that option directly.
		add_action( 'add_option_widget_block', array( $this, 'on_block_widgets_added' ), 10, 2 );
		add_action( 'update_option_widget_block', array( $this, 'on_block_widgets_updated' ), 10, 2 );
	}

	// -------------------------------------------------------------------------
	// Hook handlers
	// -------------------------------------------------------------------------

	/**
	 * Re-scan post content and sync attachment usage on every post save.
	 *
	 * Trashed posts are intentionally left tracked (the relationship is preserved
	 * while the post is in trash; it is only removed on permanent deletion).
	 *
	 * @param int      $post_id Post ID.
	 * @param \WP_Post $post    Post object.
	 * @return void
	 */
	public function on_save_post( $post_id, $post ) {
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}

		// Attachments are media themselves, not "posts with media".
		if ( 'attachment' === $post->post_type ) {
			return;
		}

		// Skip truly ephemeral statuses.
		if ( in_array( $post->post_status, array( 'auto-draft', 'inherit' ), true ) ) {
			return;
		}

		// Skip post types that never carry GoDAM media but can save very
		// frequently (WooCommerce orders, Action Scheduler rows, etc.), so we
		// don't pay parse_blocks()/regex/meta-read cost on every such save.
		if ( ! $this->is_tracked_post_type( $post->post_type ) ) {
			return;
		}

		$this->sync_post_attachments( $post_id, $post->post_content );
	}

	/**
	 * Whether the media usage tracker should scan a given post type on save.
	 *
	 * Excludes high-frequency, non-content post types by default. The delete path
	 * is intentionally NOT gated by this, so previously-tracked data is still
	 * cleaned up if a type is later added to the skip list.
	 *
	 * @param string $post_type Post type slug.
	 * @return bool
	 */
	private function is_tracked_post_type( $post_type ) {
		$skip = array(
			'attachment',
			'revision',
			'nav_menu_item',
			'custom_css',
			'customize_changeset',
			'oembed_cache',
			'user_request',
			'wp_global_styles',
			'scheduled-action',     // Action Scheduler.
			'shop_order',           // WooCommerce (legacy/compat storage).
			'shop_order_refund',
			'shop_subscription',
		);

		/**
		 * Filters the post types the media usage tracker skips on save.
		 *
		 * @param string[] $skip      Post type slugs to skip.
		 * @param string   $post_type The post type being evaluated.
		 */
		$skip = (array) apply_filters( 'godam_media_usage_skip_post_types', $skip, $post_type );

		return ! in_array( $post_type, $skip, true );
	}

	/**
	 * Remove a post from all attachment usage lists when it is permanently deleted.
	 *
	 * @param int $post_id Post ID being permanently deleted.
	 * @return void
	 */
	public function on_before_delete_post( $post_id ) {
		if ( 'attachment' === get_post_type( $post_id ) ) {
			return;
		}

		// Unregister the 'content' source before wiping local meta so the tracked
		// list is still readable. unregister_media_usage() fires the Central remove
		// only when no other source still references the pair.
		foreach ( $this->get_tracked_attachment_ids( $post_id ) as $attachment_id ) {
			$this->unregister_media_usage( $attachment_id, $post_id, 'content' );
		}

		delete_post_meta( $post_id, self::POST_META_KEY );
	}

	// -------------------------------------------------------------------------
	// Core sync logic
	// -------------------------------------------------------------------------

	/**
	 * Diff previously tracked attachment IDs against newly extracted ones and
	 * update meta on only the affected attachments.
	 *
	 * @param int    $post_id      Post ID.
	 * @param string $post_content Current post content.
	 * @return void
	 */
	public function sync_post_attachments( $post_id, $post_content ) {
		$old_ids = $this->get_tracked_attachment_ids( $post_id );
		$new_ids = $this->extract_attachment_ids( $post_content );

		// Featured image lives outside post_content — add it separately.
		$thumbnail_id = (int) get_post_meta( $post_id, '_thumbnail_id', true );
		if ( $thumbnail_id > 0 ) {
			$new_ids = array_values( array_unique( array_merge( $new_ids, array( $thumbnail_id ) ) ) );
		}

		// Elementor-built posts store their widget tree in _elementor_data, not content.
		$elementor_ids = $this->extract_ids_from_elementor( $post_id );
		if ( ! empty( $elementor_ids ) ) {
			$new_ids = array_values( array_unique( array_merge( $new_ids, $elementor_ids ) ) );
		}

		$added   = array_diff( $new_ids, $old_ids );
		$removed = array_diff( $old_ids, $new_ids );

		// Route through the reference-counted index under the 'content' source.
		foreach ( $added as $attachment_id ) {
			$this->register_media_usage( $attachment_id, $post_id, 'content' );
		}

		foreach ( $removed as $attachment_id ) {
			$this->unregister_media_usage( $attachment_id, $post_id, 'content' );
		}

		// Persist the new set so the next save can diff cheaply.
		update_post_meta( $post_id, self::POST_META_KEY, array_values( $new_ids ) );
	}

	// -------------------------------------------------------------------------
	// Reference-counted usage registry (public API)
	// -------------------------------------------------------------------------

	/**
	 * Register that an attachment is used by a post from a given source.
	 *
	 * Reference-counted by source: a GoDAM Central log_media_view fires only when
	 * this is the FIRST source to reference the (attachment, post) pair, so two
	 * independent trackers referencing the same media on the same post do not
	 * generate duplicate logs — nor will one's removal drop the other's usage.
	 *
	 * Also exposed as the `godam_register_media_usage` action for plugins that
	 * cannot call this method directly.
	 *
	 * @param int    $attachment_id WP attachment post ID.
	 * @param int    $post_id       Referencing post ID. 0 is allowed for global,
	 *                              non-post contexts (e.g. block widgets).
	 * @param string $source        Source identifier (e.g. 'content', 'woo_reel_pop').
	 * @param string $post_type     Optional explicit post type for the Central payload.
	 *                              Defaults to get_post_type($post_id); pass this for
	 *                              synthetic anchors where get_post_type() is meaningless.
	 * @return void
	 */
	public function register_media_usage( $attachment_id, $post_id, $source = 'content', $post_type = '' ) {
		$attachment_id = (int) $attachment_id;
		$post_id       = (int) $post_id;
		$source        = sanitize_key( (string) $source );

		if ( $attachment_id <= 0 || $post_id < 0 || '' === $source ) {
			return;
		}

		$map      = $this->get_usage_sources( $attachment_id );
		$existing = isset( $map[ $post_id ] ) ? $map[ $post_id ] : array();

		$was_referenced = ! empty( $existing );

		if ( in_array( $source, $existing, true ) ) {
			return; // Already recorded for this source; nothing changes.
		}

		$existing[]      = $source;
		$map[ $post_id ] = $existing;
		$this->save_usage_sources( $attachment_id, $map );

		// First source to reference this pair → notify GoDAM Central.
		if ( ! $was_referenced ) {
			$godam_id = $this->get_godam_id_for_attachment( $attachment_id );
			if ( $godam_id ) {
				$type = '' !== $post_type ? $post_type : (string) get_post_type( $post_id );
				$this->schedule_log_media_view( $godam_id, $post_id, $this->get_wp_site(), $type );
			}
		}
	}

	/**
	 * Unregister a source's reference to an attachment from a post.
	 *
	 * A GoDAM Central remove_media_view fires only when the LAST source for the
	 * (attachment, post) pair is removed.
	 *
	 * Also exposed as the `godam_unregister_media_usage` action.
	 *
	 * @param int    $attachment_id WP attachment post ID.
	 * @param int    $post_id       Referencing post ID.
	 * @param string $source        Source identifier.
	 * @return void
	 */
	public function unregister_media_usage( $attachment_id, $post_id, $source = 'content' ) {
		$attachment_id = (int) $attachment_id;
		$post_id       = (int) $post_id;
		$source        = sanitize_key( (string) $source );

		if ( $attachment_id <= 0 || $post_id < 0 || '' === $source ) {
			return;
		}

		$map = $this->get_usage_sources( $attachment_id );

		if ( ! isset( $map[ $post_id ] ) || ! in_array( $source, $map[ $post_id ], true ) ) {
			return; // Nothing to remove for this source.
		}

		$remaining = array_values( array_diff( $map[ $post_id ], array( $source ) ) );

		if ( empty( $remaining ) ) {
			unset( $map[ $post_id ] );
		} else {
			$map[ $post_id ] = $remaining;
		}

		$this->save_usage_sources( $attachment_id, $map );

		// Last source removed → notify GoDAM Central.
		if ( empty( $remaining ) ) {
			$godam_id = $this->get_godam_id_for_attachment( $attachment_id );
			if ( $godam_id ) {
				$this->schedule_remove_media_view( $godam_id, $post_id, $this->get_wp_site() );
			}
		}
	}

	/**
	 * Get the list of post IDs that reference a given attachment.
	 *
	 * The derived, public query list — one entry per post with at least one
	 * referencing source. Unchanged signature for existing consumers.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @return int[]
	 */
	public function get_usage_post_ids( $attachment_id ) {
		$ids = get_post_meta( $attachment_id, self::ATTACHMENT_META_KEY, true );
		return is_array( $ids ) ? array_map( 'intval', $ids ) : array();
	}

	/**
	 * Read the source-aware reference map for an attachment.
	 *
	 * Lazily migrates legacy data: on installs predating the source map, the
	 * existing `_godam_usage_post_ids` entries are treated as the 'content'
	 * source (the only writer before this API existed). The migration is
	 * persisted on the next save_usage_sources() call.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @return array<int, string[]> Map of post ID → source list.
	 */
	private function get_usage_sources( $attachment_id ) {
		$map = get_post_meta( $attachment_id, self::SOURCES_META_KEY, true );

		if ( is_array( $map ) ) {
			$normalized = array();
			foreach ( $map as $post_id => $sources ) {
				$normalized[ (int) $post_id ] = array_values( array_filter( array_map( 'strval', (array) $sources ) ) );
			}
			return $normalized;
		}

		// Lazy migration from the legacy post-ID list.
		$legacy = $this->get_usage_post_ids( $attachment_id );
		$map    = array();
		foreach ( $legacy as $post_id ) {
			$map[ (int) $post_id ] = array( 'content' );
		}
		return $map;
	}

	/**
	 * Persist the source-aware reference map and keep the derived post-ID list in sync.
	 *
	 * @param int                  $attachment_id Attachment WP post ID.
	 * @param array<int, string[]> $map           Map of post ID → source list.
	 * @return void
	 */
	private function save_usage_sources( $attachment_id, array $map ) {
		$clean = array();
		foreach ( $map as $post_id => $sources ) {
			$sources = array_values( array_unique( array_filter( (array) $sources ) ) );
			if ( ! empty( $sources ) ) {
				$clean[ (int) $post_id ] = $sources;
			}
		}

		if ( empty( $clean ) ) {
			delete_post_meta( $attachment_id, self::SOURCES_META_KEY );
			delete_post_meta( $attachment_id, self::ATTACHMENT_META_KEY );
			return;
		}

		update_post_meta( $attachment_id, self::SOURCES_META_KEY, $clean );

		// Derived public list holds real post IDs only — the synthetic anchor 0
		// (block widgets, other non-post contexts) is recorded in the source map
		// but never leaks into get_usage_post_ids().
		$post_ids = array();
		foreach ( array_keys( $clean ) as $post_id ) {
			$post_id = (int) $post_id;
			if ( $post_id > 0 ) {
				$post_ids[] = $post_id;
			}
		}
		update_post_meta( $attachment_id, self::ATTACHMENT_META_KEY, $post_ids );
	}

	/**
	 * Get the attachment IDs currently tracked for a post.
	 *
	 * @param int $post_id Post ID.
	 * @return int[]
	 */
	private function get_tracked_attachment_ids( $post_id ) {
		$ids = get_post_meta( $post_id, self::POST_META_KEY, true );
		return is_array( $ids ) ? array_map( 'intval', $ids ) : array();
	}

	// -------------------------------------------------------------------------
	// Content parsing
	// -------------------------------------------------------------------------

	/**
	 * Extract all WP attachment post IDs referenced in $post_content.
	 *
	 * Three-pass approach:
	 *  Pass 1 — HTML URL extraction: covers every block that renders inline HTML
	 *            (Gutenberg blocks, Classic Editor, custom blocks) plus any
	 *            background-image or data-src references.
	 *  Pass 2 — Block attribute parsing: catches WP core and GoDAM blocks that
	 *            store an attachment ID in their block comment JSON even when the
	 *            rendered HTML may not yet be present (e.g. dynamic/SSR blocks).
	 *  Pass 3 — Shortcode parsing: catches GoDAM shortcodes left raw in content
	 *            (Classic Editor, text widgets, WPBakery elements) which are
	 *            neither rendered HTML nor parsed blocks at save time.
	 *
	 * @param string $post_content Raw post content as stored in the database.
	 * @return int[] array of unique WP attachment post IDs.
	 */
	public function extract_attachment_ids( $post_content ) {
		if ( empty( $post_content ) ) {
			return array();
		}

		$attachment_ids = array();

		// Pass 1: resolve every media URL found in HTML.
		foreach ( $this->extract_media_urls_from_html( $post_content ) as $url ) {
			$id = $this->resolve_url_to_attachment_id( $url );
			if ( $id > 0 ) {
				$attachment_ids[] = $id;
			}
		}

		// Pass 2: walk block comment JSON for known block types.
		$attachment_ids = array_merge(
			$attachment_ids,
			$this->extract_ids_from_blocks( parse_blocks( $post_content ) )
		);

		// Pass 3: GoDAM shortcodes left raw in content.
		$attachment_ids = array_merge(
			$attachment_ids,
			$this->extract_ids_from_shortcodes( $post_content )
		);

		/**
		 * Filters the complete set of attachment IDs extracted from post content.
		 *
		 * Use this to add IDs from completely custom extraction logic (e.g. shortcodes,
		 * custom fields that embed attachment references outside of post_content).
		 *
		 * @param int[]  $attachment_ids Resolved WP attachment post IDs.
		 * @param string $post_content   Raw post content.
		 */
		$attachment_ids = (array) apply_filters( 'godam_extracted_attachment_ids', $attachment_ids, $post_content );

		return array_values( array_unique( array_filter( array_map( 'intval', $attachment_ids ) ) ) );
	}

	/**
	 * Extract attachment IDs from GoDAM shortcodes in raw content.
	 *
	 * The HTML pass only sees rendered markup and the block pass only sees parsed
	 * blocks, so a raw shortcode left in post_content — Classic Editor, a text
	 * widget, or a WPBakery element (which persists as a shortcode) — is invisible
	 * to both. This pass closes that gap.
	 *
	 * Asset-agnostic: `id`/`src`/`transcoded_url` resolve any transcoded media
	 * (image, audio, video, PDF); `include` is the CSV used by the gallery shortcode.
	 *
	 * @param string $content Raw content.
	 * @return int[]
	 */
	private function extract_ids_from_shortcodes( $content ) {
		// Cheap bail-out before the (relatively expensive) regex.
		if ( false === strpos( $content, '[godam_' ) ) {
			return array();
		}

		$pattern = get_shortcode_regex( array( 'godam_video', 'godam_audio', 'godam_video_gallery' ) );
		if ( empty( $pattern ) || ! preg_match_all( '/' . $pattern . '/', $content, $matches ) ) {
			return array();
		}

		$ids = array();

		// Group 3 of the shortcode regex is the raw attribute string.
		foreach ( $matches[3] as $attr_string ) {
			$atts = shortcode_parse_atts( $attr_string );
			if ( ! is_array( $atts ) ) {
				continue;
			}

			// Single-asset shortcodes: numeric WP id or GoDAM Central string id.
			if ( ! empty( $atts['id'] ) ) {
				$id = $this->resolve_attachment_id( $atts['id'] );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}

			// Fallback to a media URL carried in src / transcoded_url.
			foreach ( array( 'src', 'transcoded_url' ) as $url_attr ) {
				if ( ! empty( $atts[ $url_attr ] ) ) {
					$id = $this->resolve_url_to_attachment_id( $atts[ $url_attr ] );
					if ( $id > 0 ) {
						$ids[] = $id;
					}
				}
			}

			// Gallery shortcode: include="1,2,3".
			if ( ! empty( $atts['include'] ) ) {
				foreach ( preg_split( '/[\s,]+/', (string) $atts['include'] ) as $raw_id ) {
					$id = $this->resolve_attachment_id( $raw_id );
					if ( $id > 0 ) {
						$ids[] = $id;
					}
				}
			}
		}

		return $ids;
	}

	/**
	 * Extract attachment IDs from an Elementor-built post's `_elementor_data`.
	 *
	 * Elementor stores its widget tree as JSON in post meta, not in post_content,
	 * so neither the HTML nor the block pass can see it. This walks the tree for
	 * Elementor media controls — `{ "id": <attachment id>, "url": "..." }` — which
	 * covers GoDAM's own godam-video / godam-audio widgets as well as native
	 * Elementor image / video / gallery widgets pointing at transcoded media.
	 *
	 * @param int $post_id Post ID.
	 * @return int[]
	 */
	private function extract_ids_from_elementor( $post_id ) {
		// Skip entirely on sites without Elementor — avoids a meta read on every
		// save for the common case. Mirrors the guard in the Seo class.
		if ( ! did_action( 'elementor/loaded' ) ) {
			return array();
		}

		$data = get_post_meta( $post_id, '_elementor_data', true );
		if ( empty( $data ) || ! is_string( $data ) ) {
			return array();
		}

		$tree = json_decode( $data, true );
		if ( ! is_array( $tree ) ) {
			return array();
		}

		$ids = array();
		$this->collect_elementor_media_ids( $tree, $ids );

		return $ids;
	}

	/**
	 * Recursively collect attachment IDs from Elementor media controls.
	 *
	 * Recognises the Elementor media-control shape `{ id: <numeric>, url: <string> }`
	 * wherever it appears in the widget tree (single media and gallery items),
	 * without coupling to specific widget types. Element nodes use string id hashes
	 * and carry no `url`, so they don't match and are simply recursed into.
	 *
	 * @param mixed $node Elementor elements/settings subtree.
	 * @param int[] $ids  Accumulator (by reference).
	 * @return void
	 */
	private function collect_elementor_media_ids( $node, array &$ids ) {
		if ( ! is_array( $node ) ) {
			return;
		}

		// A media control: an array holding both a numeric 'id' and a non-empty 'url'.
		if (
			isset( $node['id'], $node['url'] ) &&
			is_numeric( $node['id'] ) &&
			is_string( $node['url'] ) &&
			'' !== $node['url']
		) {
			$id = (int) $node['id'];
			if ( $id > 0 ) {
				$ids[] = $id;
			}
			return; // A media-control node has no deeper media to find.
		}

		foreach ( $node as $value ) {
			if ( is_array( $value ) ) {
				$this->collect_elementor_media_ids( $value, $ids );
			}
		}
	}

	// -------------------------------------------------------------------------
	// Block widgets
	// -------------------------------------------------------------------------

	/**
	 * Sync block-widget media when the `widget_block` option is first created.
	 *
	 * @param string $option Option name (unused).
	 * @param mixed  $value  New option value.
	 * @return void
	 */
	public function on_block_widgets_added( $option, $value ) {
		unset( $option );
		$this->sync_block_widget_media( $value );
	}

	/**
	 * Sync block-widget media when the `widget_block` option changes.
	 *
	 * @param mixed $old_value Previous option value (unused).
	 * @param mixed $value     New option value.
	 * @return void
	 */
	public function on_block_widgets_updated( $old_value, $value ) {
		unset( $old_value );
		$this->sync_block_widget_media( $value );
	}

	/**
	 * Diff the attachment set across all block widgets and register the changes.
	 *
	 * Block widgets are site-global (not tied to a post), so usage is anchored to
	 * a synthetic context (post ID 0, post type WIDGET_SOURCE) under the
	 * WIDGET_SOURCE source. The previously-tracked set is cached in the
	 * WIDGET_TRACKED_OPTION option to keep diffs cheap. The synthetic anchor is
	 * recorded in the per-attachment source map but never appears in the public
	 * get_usage_post_ids() list (see save_usage_sources()).
	 *
	 * @param mixed $widget_block_option The `widget_block` option value.
	 * @return void
	 */
	private function sync_block_widget_media( $widget_block_option ) {
		$new_ids = array();

		if ( is_array( $widget_block_option ) ) {
			foreach ( $widget_block_option as $key => $instance ) {
				if ( '_multiwidget' === $key || empty( $instance['content'] ) ) {
					continue;
				}
				$new_ids = array_merge( $new_ids, $this->extract_attachment_ids( $instance['content'] ) );
			}
		}

		$new_ids = array_values( array_unique( array_filter( array_map( 'intval', $new_ids ) ) ) );

		$old_ids = get_option( self::WIDGET_TRACKED_OPTION, array() );
		$old_ids = is_array( $old_ids ) ? array_map( 'intval', $old_ids ) : array();

		foreach ( array_diff( $new_ids, $old_ids ) as $attachment_id ) {
			$this->register_media_usage( $attachment_id, 0, self::WIDGET_SOURCE, self::WIDGET_SOURCE );
		}

		foreach ( array_diff( $old_ids, $new_ids ) as $attachment_id ) {
			$this->unregister_media_usage( $attachment_id, 0, self::WIDGET_SOURCE );
		}

		update_option( self::WIDGET_TRACKED_OPTION, $new_ids, false );
	}

	/**
	 * Collect every media-bearing URL from HTML content.
	 *
	 * Scans:
	 *  - src  on <img>, <video>, <audio>, <source>, <track>, <embed>, <iframe>
	 *  - href on <a> when it points to a known media file extension
	 *  - background-image / background CSS property in style attributes
	 *  - data-src (lazy-loaded images / videos)
	 *
	 * @param string $html Raw HTML.
	 * @return string[] Unique list of raw URLs.
	 */
	private function extract_media_urls_from_html( $html ) {
		$urls = array();

		// src on all media-bearing tags.
		preg_match_all(
			'/<(?:img|video|audio|source|track|embed|iframe)\b[^>]+\bsrc=(["\'])([^"\']+)\1/i',
			$html,
			$matches
		);
		if ( ! empty( $matches[2] ) ) {
			$urls = array_merge( $urls, $matches[2] );
		}

		// data-src (lazy load).
		preg_match_all(
			'/<[^>]+\bdata-src=(["\'])([^"\']+)\1/i',
			$html,
			$matches
		);
		if ( ! empty( $matches[2] ) ) {
			$urls = array_merge( $urls, $matches[2] );
		}

		// href on <a> tags — filter to media extensions only.
		preg_match_all(
			'/<a\b[^>]+\bhref=(["\'])([^"\']+)\1/i',
			$html,
			$matches
		);
		if ( ! empty( $matches[2] ) ) {
			foreach ( $matches[2] as $href ) {
				if ( $this->url_looks_like_media_file( $href ) ) {
					$urls[] = $href;
				}
			}
		}

		// background-image: url(...) in inline style attributes or <style> blocks.
		preg_match_all(
			'/background(?:-image)?\s*:\s*url\s*\(\s*["\']?([^"\')\s]+)["\']?\s*\)/i',
			$html,
			$matches
		);
		if ( ! empty( $matches[1] ) ) {
			$urls = array_merge( $urls, $matches[1] );
		}

		return array_unique( array_filter( $urls ) );
	}

	/**
	 * Resolve a URL to a WP attachment post ID.
	 *
	 * Handles:
	 *  - GoDAM Central CDN URLs: https://{subdomain}.gdcdn.us/{godam_id}/filename
	 *  - Standard WordPress uploads URLs
	 *
	 * Results are memoised per request to avoid redundant DB lookups when the
	 * same attachment is referenced multiple times in a post.
	 *
	 * @param string $url URL to resolve.
	 * @return int WP attachment post ID, or 0 if unresolved.
	 */
	private function resolve_url_to_attachment_id( $url ) {
		if ( empty( $url ) || ! is_string( $url ) ) {
			return 0;
		}

		// Strip query string — cache-busting params must not cause misses.
		$clean_url = preg_replace( '/\?.*$/', '', $url );

		if ( isset( $this->url_id_cache[ $clean_url ] ) ) {
			return $this->url_id_cache[ $clean_url ];
		}

		$resolved = 0;

		// GoDAM Central CDN: https://{sub}.gdcdn.us/{godam_id}/filename .
		if ( preg_match( '#https?://[a-z0-9]+\.gdcdn\.us/([a-z0-9]{6,24})/#i', $clean_url, $m ) ) {
			$resolved = $this->get_attachment_id_by_godam_original_id( $m[1] );
		}

		// WordPress uploads URL.
		if ( ! $resolved && false !== strpos( $clean_url, '/wp-content/uploads/' ) ) {
			$resolved = (int) attachment_url_to_postid( $clean_url );  // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.attachment_url_to_postid_attachment_url_to_postid
		}

		// Fallback using the site's dynamic upload base URL (covers custom upload dirs).
		if ( ! $resolved ) {
			$upload_dir = wp_upload_dir();
			if (
				! empty( $upload_dir['baseurl'] ) &&
				false !== strpos( $clean_url, $upload_dir['baseurl'] )
			) {
				$resolved = (int) attachment_url_to_postid( $clean_url );  // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.attachment_url_to_postid_attachment_url_to_postid
			}
		}

		$this->url_id_cache[ $clean_url ] = $resolved;
		return $resolved;
	}

	/**
	 * Extract attachment IDs from a parsed Gutenberg block tree.
	 *
	 * Handles WP core blocks with stable attribute conventions and GoDAM's own
	 * blocks. Recurses into innerBlocks. Emits a per-block filter so third-party
	 * blocks can contribute IDs without modifying this class.
	 *
	 * @param array $blocks Output of parse_blocks().
	 * @return int[]
	 */
	private function extract_ids_from_blocks( array $blocks ) {
		$ids = array();

		foreach ( $blocks as $block ) {
			if ( empty( $block['blockName'] ) ) {
				// Skip blocks without a name (e.g. Classic Editor content) since they won't have structured attributes to parse. Their media should be caught by the HTML URL extraction pass anyway.
				continue;
			}

			$attrs     = is_array( $block['attrs'] ) ? $block['attrs'] : array();
			$block_ids = $this->extract_ids_from_block_attrs( $block['blockName'], $attrs );

			/**
			 * Filters the attachment IDs extracted from a single block.
			 *
			 * Third-party plugins that register custom blocks can hook here to
			 * return additional attachment IDs without needing to parse content
			 * themselves.
			 *
			 * @param int[]  $block_ids IDs found by built-in logic (may be empty).
			 * @param array  $block     The full parsed block: blockName, attrs, innerBlocks, innerHTML.
			 */
			$block_ids = (array) apply_filters( 'godam_attachment_ids_from_block', $block_ids, $block );

			$ids = array_merge( $ids, $block_ids );

			// Recurse.
			if ( ! empty( $block['innerBlocks'] ) ) {
				$ids = array_merge( $ids, $this->extract_ids_from_blocks( $block['innerBlocks'] ) );
			}
		}

		return $ids;
	}

	/**
	 * Extract attachment IDs from a single block's attributes.
	 *
	 * Only WP core blocks and GoDAM blocks are handled here. Unknown block types
	 * return an empty array and are expected to use the filter instead.
	 *
	 * @param string $block_name Block name (e.g. "core/image").
	 * @param array  $attrs      Block attributes.
	 * @return int[]
	 */
	private function extract_ids_from_block_attrs( $block_name, array $attrs ) {
		$ids = array();

		switch ( $block_name ) {
			// Try "id" first; fall back to extracting the GoDAM ID from "src".
			case 'core/image':
			case 'core/video':
			case 'core/audio':
			case 'core/file':
			case 'core/cover':
			case 'godam/audio':
			case 'godam/video':
			case 'godam/pdf':
				$id = $this->resolve_attachment_id( $attrs['id'] ?? null );
				if ( ! $id && ! empty( $attrs['src'] ) ) {
					$id = $this->resolve_url_to_attachment_id( $attrs['src'] );
				}
				if ( $id > 0 ) {
					$ids[] = $id;
				}
				break;

			case 'godam/gallery-v2-item':
				$id = $this->resolve_attachment_id( $attrs['videoId'] ?? null );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
				break;

			// core/media-text uses "mediaId".
			case 'core/media-text':
				$id = $this->resolve_attachment_id( $attrs['mediaId'] ?? null );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
				break;

			// core/gallery carries a legacy "ids" array (new-style uses innerBlocks/core/image).
			case 'core/gallery':
				if ( ! empty( $attrs['ids'] ) && is_array( $attrs['ids'] ) ) {
					foreach ( $attrs['ids'] as $gid ) {
						$id = $this->resolve_attachment_id( $gid );
						if ( $id > 0 ) {
							$ids[] = $id;
						}
					}
				}
				break;

			default:
				// For unrecognised blocks, attempt resolution on common attachment
				// attribute names before delegating to the filter.
				// "id" first, then fall back to a CDN URL in "src" (same pattern as godam/pdf).
				$id = $this->resolve_attachment_id( $attrs['id'] ?? null );
				if ( ! $id && ! empty( $attrs['src'] ) ) {
					$id = $this->resolve_url_to_attachment_id( $attrs['src'] );
				}
				if ( $id > 0 ) {
					$ids[] = $id;
				}

				if ( ! empty( $attrs['ids'] ) && is_array( $attrs['ids'] ) ) {
					foreach ( $attrs['ids'] as $gid ) {
						$id = $this->resolve_attachment_id( $gid );
						if ( $id > 0 ) {
							$ids[] = $id;
						}
					}
				}

				/**
				 * Filters attachment IDs for block types not handled by the switch above.
				 *
				 * Use this to support custom blocks that store attachment references in
				 * non-standard attribute names.
				 *
				 * @param int[]  $ids        IDs resolved so far (may already contain results from common attrs).
				 * @param string $block_name The block name (e.g. "my-plugin/custom-block").
				 * @param array  $attrs      The block's full attribute array.
				 */
				$ids = (array) apply_filters( 'godam_attachment_ids_from_block_attrs', $ids, $block_name, $attrs );
				break;
		}

		return $ids;
	}

	// -------------------------------------------------------------------------
	// GoDAM Central tracking API
	// -------------------------------------------------------------------------

	/**
	 * Return the hostname of this WordPress site, computed once per request.
	 *
	 * @return string e.g. "blog.example.com"
	 */
	private function get_wp_site() {
		if ( null === $this->wp_site ) {
			$this->wp_site = wp_parse_url( home_url(), PHP_URL_HOST );
		}
		return $this->wp_site;
	}

	/**
	 * Return the GoDAM Central ID for a WP attachment, or an empty string if it
	 * is not a GoDAM Central media item.
	 *
	 * @param int $attachment_id WP attachment post ID.
	 * @return string GoDAM Central ID, or '' if not a Central media item.
	 */
	private function get_godam_id_for_attachment( $attachment_id ) {
		return get_post_meta( $attachment_id, '_godam_original_id', true );
	}

	/**
	 * Schedule an async Action Scheduler job to call log_media_view on GoDAM Central.
	 * Falls back to a synchronous call when Action Scheduler is unavailable.
	 *
	 * @param string $godam_id  GoDAM Central media ID.
	 * @param int    $post_id   WordPress post ID.
	 * @param string $wp_site   WordPress site hostname.
	 * @param string $post_type WordPress post type.
	 * @return void
	 */
	private function schedule_log_media_view( $godam_id, $post_id, $wp_site, $post_type ) {
		$args = array( $godam_id, (int) $post_id, $wp_site, $post_type );

		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			$this->async_log_media_view( ...$args );
			return;
		}

		if ( ! as_has_scheduled_action( 'godam_async_log_media_view', $args ) ) {
			as_enqueue_async_action( 'godam_async_log_media_view', $args );
		}
	}

	/**
	 * Schedule an async Action Scheduler job to call remove_media_view on GoDAM Central.
	 * Falls back to a synchronous call when Action Scheduler is unavailable.
	 *
	 * @param string $godam_id GoDAM Central media ID.
	 * @param int    $post_id  WordPress post ID.
	 * @param string $wp_site  WordPress site hostname.
	 * @return void
	 */
	private function schedule_remove_media_view( $godam_id, $post_id, $wp_site ) {
		$args = array( $godam_id, (int) $post_id, $wp_site );

		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			$this->async_remove_media_view( ...$args );
			return;
		}

		if ( ! as_has_scheduled_action( 'godam_async_remove_media_view', $args ) ) {
			as_enqueue_async_action( 'godam_async_remove_media_view', $args );
		}
	}

	/**
	 * Async handler: notify GoDAM Central that a media item has been embedded in a post.
	 *
	 * @param string $godam_id  GoDAM Central media ID (Transcoder Job name).
	 * @param int    $post_id   WordPress post ID.
	 * @param string $wp_site   WordPress site hostname.
	 * @param string $post_type WordPress post type.
	 * @return void
	 */
	public function async_log_media_view( $godam_id, $post_id, $wp_site, $post_type ) {
		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return;
		}

		$godam_id  = sanitize_text_field( $godam_id );
		$post_id   = (int) $post_id;
		$wp_site   = sanitize_text_field( $wp_site );
		$post_type = sanitize_text_field( $post_type );

		if ( empty( $godam_id ) ) {
			return;
		}

		$endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.tracking.log_media_view';

		$payload = array(
			'media_id'   => $godam_id,
			'platform'   => 'WordPress',
			'wp_site'    => $wp_site,
			'post_id'    => $post_id,
			'post_type'  => $post_type,
			'parent_url' => get_permalink( $post_id ),
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'method'  => 'POST',
				'timeout' => 10, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'headers' => array(
					'Content-Type' => 'application/json',
					// This is an unauthenticated endpoint, so no X-Api-Key header is sent.
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: log_media_view request failed for media "%s" on post %d. Error: %s',
					$godam_id,
					$post_id,
					$response->get_error_message()
				)
			);
			return;
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $status_code ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: log_media_view returned HTTP %d for media "%s" on post %d. Body: %s',
					$status_code,
					$godam_id,
					$post_id,
					wp_remote_retrieve_body( $response )
				)
			);
		}
	}

	/**
	 * Async handler: notify GoDAM Central that a media item has been removed from a post.
	 * Requires a valid API key — silently skips if none is configured.
	 *
	 * @param string $godam_id GoDAM Central media ID (Transcoder Job name).
	 * @param int    $post_id  WordPress post ID.
	 * @param string $wp_site  WordPress site hostname.
	 * @return void
	 */
	public function async_remove_media_view( $godam_id, $post_id, $wp_site ) {
		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return;
		}

		$godam_id = sanitize_text_field( $godam_id );
		$post_id  = (int) $post_id;
		$wp_site  = sanitize_text_field( $wp_site );

		if ( empty( $godam_id ) ) {
			return;
		}

		$endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.tracking.remove_media_view';

		$payload = array(
			'media_id'   => $godam_id,
			'platform'   => 'WordPress',
			'wp_site'    => $wp_site,
			'post_id'    => $post_id,
			'parent_url' => get_permalink( $post_id ),
		);

		$response = wp_remote_post(
			$endpoint,
			array(
				'method'  => 'POST',
				'timeout' => 10, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				'headers' => array(
					'Content-Type' => 'application/json',
					// Unlike log_media_view (a public ingest endpoint), the remove
					// endpoint is authenticated, so the API key is sent here.
					'X-Api-Key'    => $api_key,
				),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: remove_media_view request failed for media "%s" on post %d. Error: %s',
					$godam_id,
					$post_id,
					$response->get_error_message()
				)
			);
			return;
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $status_code ) {
			error_log( // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				sprintf(
					'GoDAM: remove_media_view returned HTTP %d for media "%s" on post %d. Body: %s',
					$status_code,
					$godam_id,
					$post_id,
					wp_remote_retrieve_body( $response )
				)
			);
		}
	}

	// -------------------------------------------------------------------------
	// GoDAM Central ID resolution
	// -------------------------------------------------------------------------

	/**
	 * Resolve any attachment ID value — numeric WP ID or GoDAM Central string ID —
	 * to a WP attachment post ID.
	 *
	 * Centralises the "is numeric → cast, is string → Central lookup" logic so
	 * every block case in extract_ids_from_block_attrs() behaves consistently
	 * without duplicating the branch.
	 *
	 * @param mixed $raw_id Raw attribute value (int, numeric string, or GoDAM ID string).
	 * @return int WP attachment post ID, or 0 if unresolvable.
	 */
	private function resolve_attachment_id( $raw_id ) {
		if ( empty( $raw_id ) ) {
			return 0;
		}

		if ( is_numeric( $raw_id ) ) {
			return (int) $raw_id;
		}

		if ( is_string( $raw_id ) ) {
			return $this->get_attachment_id_by_godam_original_id( $raw_id );
		}

		return 0;
	}

	/**
	 * Find the WP attachment post ID for a GoDAM Central ID.
	 *
	 * Uses a per-request cache to avoid repeated DB hits when the same Central
	 * media appears multiple times in a post (e.g. gallery with repeated item).
	 *
	 * @param string $godam_id Value of _godam_original_id meta (e.g. "bibajkt1mh").
	 * @return int WP attachment post ID or 0.
	 */
	private function get_attachment_id_by_godam_original_id( $godam_id ) {
		if ( empty( $godam_id ) || ! is_string( $godam_id ) ) {
			return 0;
		}

		if ( isset( $this->godam_id_cache[ $godam_id ] ) ) {
			return $this->godam_id_cache[ $godam_id ];
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$post_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_godam_original_id' AND meta_value = %s LIMIT 1",
				$godam_id
			)
		);

		$this->godam_id_cache[ $godam_id ] = $post_id;
		return $post_id;
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	/**
	 * Return true if a URL's path ends with a known media/document extension.
	 *
	 * Used to filter <a href> links so we only consider links to actual files,
	 * not navigation links.
	 *
	 * @param string $url URL to check.
	 * @return bool
	 */
	private function url_looks_like_media_file( $url ) {
		// Build the allowed-extension list once from WordPress's own MIME type map so
		// it stays in sync with upload_mimes filter customisations automatically.
		static $extensions = null;
		if ( null === $extensions ) {
			$extensions = array();
			$mime_types = array_keys( wp_get_mime_types() );
			foreach ( $mime_types as $ext_string ) {
				foreach ( explode( '|', $ext_string ) as $ext ) {
					$extensions[] = $ext;
				}
			}
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( empty( $path ) ) {
			return false;
		}

		return in_array( strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), $extensions, true );
	}
}
