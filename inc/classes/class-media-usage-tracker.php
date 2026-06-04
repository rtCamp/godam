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
 */
class Media_Usage_Tracker {

	use Singleton;

	/**
	 * Meta key on attachments: int[] of unique post IDs that reference this attachment.
	 */
	const ATTACHMENT_META_KEY = '_godam_usage_post_ids';

	/**
	 * Meta key on posts: int[] of unique WP attachment post IDs tracked for this post.
	 * Stored so the next save can diff cheaply instead of re-querying every attachment.
	 */
	const POST_META_KEY = '_godam_tracked_media';

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

		$this->sync_post_attachments( $post_id, $post->post_content );
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

		// Schedule removes before wiping local meta so the tracked list is still readable.
		$wp_site = $this->get_wp_site();
		foreach ( $this->get_tracked_attachment_ids( $post_id ) as $attachment_id ) {
			$godam_id = $this->get_godam_id_for_attachment( $attachment_id );
			if ( $godam_id ) {
				$this->schedule_remove_media_view( $godam_id, $post_id, $wp_site );
			}
		}

		$this->remove_post_from_all_attachments( $post_id );
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

		$added   = array_diff( $new_ids, $old_ids );
		$removed = array_diff( $old_ids, $new_ids );

		$wp_site   = $this->get_wp_site();
		$post_type = get_post_type( $post_id );

		foreach ( $added as $attachment_id ) {
			$this->add_post_to_attachment( $attachment_id, $post_id );

			$godam_id = $this->get_godam_id_for_attachment( $attachment_id );
			if ( $godam_id ) {
				$this->schedule_log_media_view( $godam_id, $post_id, $wp_site, $post_type );
			}
		}

		foreach ( $removed as $attachment_id ) {
			$this->remove_post_from_attachment( $attachment_id, $post_id );

			$godam_id = $this->get_godam_id_for_attachment( $attachment_id );
			if ( $godam_id ) {
				$this->schedule_remove_media_view( $godam_id, $post_id, $wp_site );
			}
		}

		// Persist the new set so the next save can diff cheaply.
		update_post_meta( $post_id, self::POST_META_KEY, array_values( $new_ids ) );
	}

	/**
	 * Remove a post ID from every attachment it was previously tracking.
	 *
	 * @param int $post_id Post ID to untrack everywhere.
	 * @return void
	 */
	private function remove_post_from_all_attachments( $post_id ) {
		$tracked = $this->get_tracked_attachment_ids( $post_id );

		foreach ( $tracked as $attachment_id ) {
			$this->remove_post_from_attachment( $attachment_id, $post_id );
		}
	}

	// -------------------------------------------------------------------------
	// Attachment meta read/write
	// -------------------------------------------------------------------------

	/**
	 * Add $post_id to the usage list of an attachment.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @param int $post_id       Post ID using the attachment.
	 * @return void
	 */
	private function add_post_to_attachment( $attachment_id, $post_id ) {
		$ids   = $this->get_usage_post_ids( $attachment_id );
		$ids[] = (int) $post_id;
		update_post_meta( $attachment_id, self::ATTACHMENT_META_KEY, array_values( array_unique( $ids ) ) );
	}

	/**
	 * Remove $post_id from the usage list of an attachment.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @param int $post_id       Post ID to remove.
	 * @return void
	 */
	private function remove_post_from_attachment( $attachment_id, $post_id ) {
		$ids     = $this->get_usage_post_ids( $attachment_id );
		$new_ids = array_values( array_diff( $ids, array( (int) $post_id ) ) );
		update_post_meta( $attachment_id, self::ATTACHMENT_META_KEY, $new_ids );
	}

	/**
	 * Get the list of post IDs that reference a given attachment.
	 *
	 * @param int $attachment_id Attachment WP post ID.
	 * @return int[]
	 */
	public function get_usage_post_ids( $attachment_id ) {
		$ids = get_post_meta( $attachment_id, self::ATTACHMENT_META_KEY, true );
		return is_array( $ids ) ? array_map( 'intval', $ids ) : array();
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
	 * Two-pass approach:
	 *  Pass 1 — HTML URL extraction: covers every block that renders inline HTML
	 *            (Gutenberg blocks, Classic Editor, custom blocks) plus any
	 *            background-image or data-src references.
	 *  Pass 2 — Block attribute parsing: catches WP core and GoDAM blocks that
	 *            store an attachment ID in their block comment JSON even when the
	 *            rendered HTML may not yet be present (e.g. dynamic/SSR blocks).
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
