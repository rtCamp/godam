<?php
/**
 * Register REST API endpoints for the Video Editor list view.
 *
 * Powers the DataViews-based videos grid on the Video Editor admin page:
 * a paginated, sortable, filterable, searchable collection of video
 * attachments enriched with the fields the grid renders (duration, poster,
 * transcoding status, layers/edited state, GoDAM-Central source, last-edited
 * date).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;
use WP_Query;

/**
 * Class Video_Editor
 */
class Video_Editor extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'video-editor';

	/**
	 * Get REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/videos',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_videos' ),
						'permission_callback' => array( $this, 'get_videos_permissions_check' ),
						'args'                => $this->get_videos_args(),
					),
				),
			),
		);
	}

	/**
	 * Permission check — same capability the Video Editor page requires.
	 *
	 * @return bool
	 */
	public function get_videos_permissions_check() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Argument schema for the videos collection endpoint.
	 *
	 * @return array
	 */
	private function get_videos_args() {
		return array(
			'page'          => array(
				'description'       => __( 'Current page of the collection.', 'godam' ),
				'type'              => 'integer',
				'default'           => 1,
				'minimum'           => 1,
				'sanitize_callback' => 'absint',
			),
			'per_page'      => array(
				'description'       => __( 'Maximum number of items to be returned in result set.', 'godam' ),
				'type'              => 'integer',
				'default'           => 20,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
			'search'        => array(
				'description'       => __( 'Limit results to those matching a string.', 'godam' ),
				'type'              => 'string',
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'orderby'       => array(
				'description'       => __( 'Sort collection by attribute.', 'godam' ),
				'type'              => 'string',
				'default'           => 'date',
				'enum'              => array( 'date', 'modified', 'title' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'order'         => array(
				'description'       => __( 'Order sort attribute ascending or descending.', 'godam' ),
				'type'              => 'string',
				'default'           => 'desc',
				'enum'              => array( 'asc', 'desc' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'filter'        => array(
				'description'       => __( 'Limit the collection to a subset of items.', 'godam' ),
				'type'              => 'string',
				'default'           => 'all',
				'enum'              => array( 'all', 'edited', 'unedited', 'transcoded', 'non_transcoded' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'media_type'    => array(
				'description'       => __( 'Limit the collection to a media type.', 'godam' ),
				'type'              => 'string',
				'default'           => 'video',
				'enum'              => array( 'video', 'image', 'audio' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'prioritize_id' => array(
				'description'       => __( 'Attachment id to surface first on page 1 (used to pin the demo video during the onboarding tour).', 'godam' ),
				'type'              => 'integer',
				'default'           => 0,
				'minimum'           => 0,
				'sanitize_callback' => 'absint',
			),
		);
	}

	/**
	 * Return a paginated collection of video attachments for the list view.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function get_videos( $request ) {
		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );
		$search   = (string) $request->get_param( 'search' );
		$orderby  = (string) $request->get_param( 'orderby' );
		$order    = strtoupper( (string) $request->get_param( 'order' ) ) === 'ASC' ? 'ASC' : 'DESC';
		$filter   = (string) $request->get_param( 'filter' );

		// Which media type the list is showing (video|image|audio). Defaults to
		// video (the historic behaviour); WP_Query accepts these as mime prefixes.
		$media_type = (string) $request->get_param( 'media_type' );
		if ( ! in_array( $media_type, array( 'video', 'image', 'audio' ), true ) ) {
			$media_type = 'video';
		}

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => $media_type,
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => in_array( $orderby, array( 'date', 'modified', 'title' ), true ) ? $orderby : 'date',
			'order'          => $order,
		);

		// Match core's `query-attachments` behaviour: users who can't edit others'
		// content should only see their own uploads.
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			$args['author'] = get_current_user_id();
		}

		if ( '' !== $search ) {
			$args['s'] = $search;
		}

		$meta_query = $this->build_filter_meta_query( $filter, $media_type );
		if ( ! empty( $meta_query ) ) {
			$args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		/**
		 * Fires before the video-editor's attachment listing query, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		$query = new WP_Query( $args );

		$items = array();
		foreach ( $query->posts as $post ) {
			$items[] = $this->prepare_video_item( $post );
		}

		// Pin a specific attachment (the tour's demo video) to the front of page 1.
		// Only for the unfiltered, unsearched first page, so a filter/search view
		// isn't shown a card that violates it; capped to per_page so counts hold.
		// The pinned item is only the onboarding demo VIDEO, so only apply it when
		// the list is showing videos (also keeps the video-only guard in
		// prioritize_item valid).
		$prioritize_id = (int) $request->get_param( 'prioritize_id' );
		if ( $prioritize_id > 0 && 1 === $page && '' === $search && 'all' === $filter && 'video' === $media_type ) {
			$items = $this->prioritize_item( $items, $prioritize_id, $per_page );
		}

		$found_posts   = (int) $query->found_posts;
		$max_num_pages = (int) $query->max_num_pages;

		/**
		 * Fires after the video-editor's attachment listing query, so
		 * integrations can restore the site context switched in
		 * `rtgodam_before_attachment_lookup`.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_after_attachment_lookup' );

		$response = new WP_REST_Response(
			array(
				'items'      => $items,
				'total'      => $found_posts,
				'totalPages' => $max_num_pages,
			),
			200
		);

		$response->header( 'X-WP-Total', $found_posts );
		$response->header( 'X-WP-TotalPages', $max_num_pages );

		return $response;
	}

	/**
	 * Move (or insert) a given attachment to the front of a prepared items list.
	 *
	 * Keeps the item once (dedupes if already in the page), and prepends it if it
	 * wasn't on the page — so the demo video is always the first card during the
	 * tour regardless of its date.
	 *
	 * @param array $items         Prepared video items.
	 * @param int   $prioritize_id Attachment id to surface first.
	 * @param int   $per_page      Page size to cap the result at.
	 * @return array
	 */
	private function prioritize_item( $items, $prioritize_id, $per_page ) {
		$pinned = null;
		$rest   = array();

		foreach ( $items as $item ) {
			if ( isset( $item['id'] ) && (int) $item['id'] === $prioritize_id ) {
				$pinned = $item;
			} else {
				$rest[] = $item;
			}
		}

		// Not on this page — prepare it directly if it's a valid video attachment.
		if ( null === $pinned ) {
			$post = get_post( $prioritize_id );
			// Enforce the same author scoping as the list query: users who can't
			// edit others' content may only surface their own uploads, otherwise
			// this becomes an IDOR that leaks other users' private video metadata.
			$owned = $post && ( current_user_can( 'edit_others_posts' ) || get_current_user_id() === (int) $post->post_author || 1 === (int) get_post_meta( $post->ID, 'rtgodam_is_demo_attachment', true ) );
			if ( $owned && 'attachment' === $post->post_type && 0 === strpos( (string) get_post_mime_type( $post ), 'video/' ) ) {
				$pinned = $this->prepare_video_item( $post );
			}
		}

		if ( null === $pinned ) {
			return $items;
		}

		array_unshift( $rest, $pinned );

		// Keep page 1 at per_page: when the pinned item wasn't already on the page
		// we'd otherwise return per_page + 1 (inflating counts). The dropped item
		// still surfaces on its natural page (the client dedups the pinned one).
		return array_slice( $rest, 0, $per_page );
	}

	/**
	 * Translate the list-view "All Videos" filter into a meta_query.
	 *
	 * Edited/unedited is derived from the published `rtgodam_meta['layers']`
	 * array. That meta is stored serialized, so we match at the SQL level on
	 * the serialized signature (`"layers";a:N:{`) to keep pagination counts
	 * accurate without a companion meta or backfill: a video with layers
	 * serializes as `"layers";a:<N>:{` with N > 0, and an empty/edited-then-
	 * cleared one as `"layers";a:0:{`.
	 *
	 * Trade-off / scale caveat: the edited/unedited `LIKE`/`NOT LIKE` clauses run
	 * unindexed full scans of `wp_postmeta` and the serialized signature is brittle
	 * to any future change in how `rtgodam_meta` is stored (e.g. JSON). On very
	 * large libraries this filter will get slow; the indexed fix is a dedicated
	 * boolean meta (e.g. `_rtgodam_has_layers`) written on save plus a one-time
	 * backfill, which `meta_query` can hit via an index instead of scanning.
	 *
	 * @param string $filter     One of all|edited|unedited|transcoded|non_transcoded.
	 * @param string $media_type video|image|audio — narrows which filters apply.
	 * @return array meta_query fragment (empty for 'all' or a non-applicable filter).
	 */
	private function build_filter_meta_query( $filter, $media_type = 'video' ) {
		// Transcode filters only apply to transcodable media (video/audio); images
		// are never transcoded, so treat these as "all" for images.
		if ( in_array( $filter, array( 'transcoded', 'non_transcoded' ), true ) && 'image' === $media_type ) {
			return array();
		}

		// Edited/unedited is derived from authored layers; audio has no layers, so
		// treat these as "all" for audio.
		if ( in_array( $filter, array( 'edited', 'unedited' ), true ) && 'audio' === $media_type ) {
			return array();
		}

		switch ( $filter ) {
			case 'transcoded':
				return array(
					array(
						'key'   => 'rtgodam_transcoding_status',
						'value' => 'transcoded',
					),
				);

			case 'non_transcoded':
				return array(
					'relation' => 'OR',
					array(
						'key'     => 'rtgodam_transcoding_status',
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'     => 'rtgodam_transcoding_status',
						'value'   => 'transcoded',
						'compare' => '!=',
					),
				);

			case 'edited':
				return array(
					'relation' => 'AND',
					array(
						'key'     => 'rtgodam_meta',
						'value'   => '"layers";a:',
						'compare' => 'LIKE',
					),
					array(
						'key'     => 'rtgodam_meta',
						'value'   => '"layers";a:0:',
						'compare' => 'NOT LIKE',
					),
				);

			case 'unedited':
				return array(
					'relation' => 'OR',
					array(
						'key'     => 'rtgodam_meta',
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'     => 'rtgodam_meta',
						'value'   => '"layers";a:',
						'compare' => 'NOT LIKE',
					),
					array(
						'key'     => 'rtgodam_meta',
						'value'   => '"layers";a:0:',
						'compare' => 'LIKE',
					),
				);

			case 'all':
			default:
				return array();
		}
	}

	/**
	 * Shape a single attachment into the item the DataViews grid consumes.
	 *
	 * Reuses `wp_prepare_attachment_for_js()` so the poster, formatted
	 * duration and GoDAM transcoding fields stay consistent with the rest of
	 * the media UI (GoDAM hooks `wp_prepare_attachment_for_js` to inject
	 * `transcoding_status`/`transcoded_url`).
	 *
	 * @param \WP_Post $post Attachment post.
	 * @return array
	 */
	private function prepare_video_item( $post ) {
		$prepared = wp_prepare_attachment_for_js( $post );
		$prepared = is_array( $prepared ) ? $prepared : array();

		$rtgodam_meta = get_post_meta( $post->ID, 'rtgodam_meta', true );
		$layers       = ( is_array( $rtgodam_meta ) && ! empty( $rtgodam_meta['layers'] ) && is_array( $rtgodam_meta['layers'] ) )
			? $rtgodam_meta['layers']
			: array();

		$godam_original_id = get_post_meta( $post->ID, '_godam_original_id', true );

		// Media type so the grid can render/route per type (audio has no poster →
		// the client shows an icon fallback; images use the image itself).
		$godam_mime = (string) get_post_mime_type( $post );
		if ( 0 === strpos( $godam_mime, 'image/' ) ) {
			$godam_type = 'image';
		} elseif ( 0 === strpos( $godam_mime, 'audio/' ) ) {
			$godam_type = 'audio';
		} else {
			$godam_type = 'video';
		}

		// Thumbnail resolution differs per media type. NOTE: `image.src` from
		// wp_prepare_attachment_for_js is only trustworthy for VIDEO (GoDAM injects
		// the poster there). For images it is WordPress' generic mime icon when the
		// attachment has no generated sizes — which is exactly the case for virtual
		// GoDAM Central images — so it must not be used as a thumbnail.
		$godam_thumbnail = '';
		if ( 'video' === $godam_type ) {
			$godam_thumbnail = isset( $prepared['image']['src'] ) ? $prepared['image']['src'] : '';
		} elseif ( 'image' === $godam_type ) {
			// Mirror the GoDAM media library: prefer the GoDAM CDN sub-sizes
			// (`rtgodam_image_sizes`, set for virtual/offloaded images), then local
			// generated sizes, then the attachment URL — which
			// filter_attachment_url_for_virtual_media rewrites to the CDN URL for
			// virtual media, so virtual images resolve to a real image.
			$godam_cdn_sizes = get_post_meta( $post->ID, 'rtgodam_image_sizes', true );
			$godam_cdn_sizes = is_array( $godam_cdn_sizes ) ? $godam_cdn_sizes : array();
			foreach ( array( 'thumbnail', 'medium', 'large' ) as $godam_size ) {
				if ( ! empty( $godam_cdn_sizes[ $godam_size ]['url'] ) ) {
					$godam_thumbnail = $godam_cdn_sizes[ $godam_size ]['url'];
					break;
				}
			}
			if ( empty( $godam_thumbnail ) && ! empty( $prepared['sizes']['medium']['url'] ) ) {
				$godam_thumbnail = $prepared['sizes']['medium']['url'];
			}
			if ( empty( $godam_thumbnail ) && ! empty( $prepared['sizes']['thumbnail']['url'] ) ) {
				$godam_thumbnail = $prepared['sizes']['thumbnail']['url'];
			}
			if ( empty( $godam_thumbnail ) ) {
				$godam_thumbnail = (string) wp_get_attachment_url( $post->ID );
			}
		} elseif ( 'audio' === $godam_type ) {
			// For audio, `image.src` is WordPress' generic audio MIME-type icon
			// (wp-includes/images/media/audio.png), not a real cover — ignore it and
			// use ONLY the GoDAM audio cover (matches the godam/audio block). When
			// there's none, leave it empty so the client shows the audio-icon tile.
			$godam_audio_cover = get_post_meta( $post->ID, 'rtgodam_media_audio_thumbnail', true );
			$godam_thumbnail   = ! empty( $godam_audio_cover ) ? $godam_audio_cover : '';
		}

		return array(
			'id'                => (int) $post->ID,
			'type'              => $godam_type,
			'title'             => isset( $prepared['title'] ) ? $prepared['title'] : get_the_title( $post ),
			'url'               => isset( $prepared['url'] ) ? $prepared['url'] : wp_get_attachment_url( $post->ID ),
			'thumbnail'         => $godam_thumbnail,
			'fileLength'        => isset( $prepared['fileLength'] ) ? $prepared['fileLength'] : '',
			'author'            => (int) $post->post_author,
			'godamCentral'      => ! empty( $godam_original_id ),
			'transcodeStatus'   => isset( $prepared['transcoding_status'] ) ? $prepared['transcoding_status'] : 'not_started',
			'isEdited'          => ! empty( $layers ),
			'layersCount'       => count( $layers ),
			'modifiedFormatted' => date_i18n( 'M j, Y', strtotime( $post->post_modified ) ),
		);
	}
}
