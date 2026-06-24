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
			'page'     => array(
				'description'       => __( 'Current page of the collection.', 'godam' ),
				'type'              => 'integer',
				'default'           => 1,
				'minimum'           => 1,
				'sanitize_callback' => 'absint',
			),
			'per_page' => array(
				'description'       => __( 'Maximum number of items to be returned in result set.', 'godam' ),
				'type'              => 'integer',
				'default'           => 20,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
			'search'   => array(
				'description'       => __( 'Limit results to those matching a string.', 'godam' ),
				'type'              => 'string',
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'orderby'  => array(
				'description'       => __( 'Sort collection by attribute.', 'godam' ),
				'type'              => 'string',
				'default'           => 'date',
				'enum'              => array( 'date', 'modified', 'title' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'order'    => array(
				'description'       => __( 'Order sort attribute ascending or descending.', 'godam' ),
				'type'              => 'string',
				'default'           => 'desc',
				'enum'              => array( 'asc', 'desc' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'filter'   => array(
				'description'       => __( 'Limit the collection to a subset of videos.', 'godam' ),
				'type'              => 'string',
				'default'           => 'all',
				'enum'              => array( 'all', 'edited', 'unedited', 'transcoded', 'non_transcoded' ),
				'sanitize_callback' => 'sanitize_key',
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

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'video',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => in_array( $orderby, array( 'date', 'modified', 'title' ), true ) ? $orderby : 'date',
			'order'          => $order,
		);

		if ( '' !== $search ) {
			$args['s'] = $search;
		}

		$meta_query = $this->build_filter_meta_query( $filter );
		if ( ! empty( $meta_query ) ) {
			$args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		$query = new WP_Query( $args );

		$items = array();
		foreach ( $query->posts as $post ) {
			$items[] = $this->prepare_video_item( $post );
		}

		$response = new WP_REST_Response(
			array(
				'items'      => $items,
				'total'      => (int) $query->found_posts,
				'totalPages' => (int) $query->max_num_pages,
			),
			200
		);

		$response->header( 'X-WP-Total', (int) $query->found_posts );
		$response->header( 'X-WP-TotalPages', (int) $query->max_num_pages );

		return $response;
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
	 * @param string $filter One of all|edited|unedited|transcoded|non_transcoded.
	 * @return array meta_query fragment (empty for 'all').
	 */
	private function build_filter_meta_query( $filter ) {
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

		return array(
			'id'                => (int) $post->ID,
			'title'             => isset( $prepared['title'] ) ? $prepared['title'] : get_the_title( $post ),
			'url'               => isset( $prepared['url'] ) ? $prepared['url'] : wp_get_attachment_url( $post->ID ),
			'thumbnail'         => isset( $prepared['image']['src'] ) ? $prepared['image']['src'] : '',
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
