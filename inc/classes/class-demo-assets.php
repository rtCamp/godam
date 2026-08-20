<?php
/**
 * Demo assets helper.
 *
 * Seeds real GoDAM media into the site as virtual attachments (no file download —
 * just transcoding metadata pointing at GoDAM-hosted URLs) for the onboarding
 * tours, via the public SaaS Demo Assets API
 * (`godam_core.api.demo.get_demo_file`, guest — no API key). Created attachment
 * IDs are tracked in an option; a tracked attachment that has been deleted is
 * transparently recreated on next use.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

/**
 * Class Demo_Assets.
 */
class Demo_Assets {

	/**
	 * Option holding the map of demo assets → attachment id.
	 *
	 * Shape: array( "<category>/<file_name>" => (int) attachment_id ).
	 *
	 * @var string
	 */
	const OPTION = 'rtgodam_demo_attachments';

	/**
	 * Meta flag marking an attachment as a demo asset (registrar skips these).
	 *
	 * @var string
	 */
	const DEMO_META = 'rtgodam_is_demo_attachment';

	/**
	 * Meta storing the "<category>/<file_name>" key, so a demo attachment can be
	 * re-discovered if the tracking option is lost.
	 *
	 * @var string
	 */
	const KEY_META = 'rtgodam_demo_key';

	/**
	 * Get (creating if needed) the attachment id for a demo video.
	 *
	 * @param string $file_name Demo file name as configured in the demo library (e.g. "demo 1").
	 * @return int Attachment id, or 0 when the demo can't be resolved (caller degrades).
	 */
	public static function get_video( $file_name ) {
		return self::get_or_create( 'video', $file_name );
	}

	/**
	 * Resolve a demo asset to an attachment id: tracked → re-discovered → created.
	 *
	 * @param string $category Demo sub-folder (e.g. "video").
	 * @param string $file_name Demo file name.
	 * @return int Attachment id, or 0 on failure.
	 */
	private static function get_or_create( $category, $file_name ) {
		$key = $category . '/' . $file_name;

		$map = get_option( self::OPTION, array() );
		if ( ! is_array( $map ) ) {
			$map = array();
		}

		// 1) Tracked id still valid?
		if ( ! empty( $map[ $key ] ) && self::is_valid_attachment( (int) $map[ $key ] ) ) {
			return (int) $map[ $key ];
		}

		// 2) Re-discover an existing demo attachment (option may have been lost).
		$existing = self::find_existing( $key );
		if ( $existing ) {
			$map[ $key ] = $existing;
			update_option( self::OPTION, $map );
			return $existing;
		}

		// 3) Fetch from the SaaS demo API and create the virtual attachment.
		$payload = self::fetch_demo_file( $category, $file_name );
		if ( is_wp_error( $payload ) || empty( $payload ) ) {
			return 0;
		}

		$attach_id = self::create_from_payload( $key, $file_name, $payload );
		if ( $attach_id > 0 ) {
			$map[ $key ] = $attach_id;
			update_option( self::OPTION, $map );
		}

		return $attach_id;
	}

	/**
	 * Whether an id points to a live (non-trashed) attachment.
	 *
	 * @param int $attachment_id Attachment id.
	 * @return bool
	 */
	private static function is_valid_attachment( $attachment_id ) {
		/**
		 * Fires before reading this candidate demo attachment's post record,
		 * so integrations that centralize media on another site can switch
		 * context first. Reads the attachment's own post_type/post_status to
		 * confirm the tracked id still points at a live (non-trashed)
		 * attachment.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$post = get_post( $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $post instanceof \WP_Post
			&& 'attachment' === $post->post_type
			&& 'trash' !== $post->post_status;
	}

	/**
	 * Find an already-created demo attachment for a key.
	 *
	 * @param string $key "<category>/<file_name>".
	 * @return int Attachment id, or 0.
	 */
	private static function find_existing( $key ) {
		/**
		 * Fires before querying for an existing demo attachment by its
		 * tracking key, so integrations that centralize media on another
		 * site can switch context first. This is a real attachment query
		 * (post_type => 'attachment') keyed on the KEY_META marker this
		 * class itself writes on every demo attachment it creates.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
		$ids = get_posts(
			array(
				'post_type'        => 'attachment',
				'post_status'      => 'inherit',
				'posts_per_page'   => 1,
				'fields'           => 'ids',
				'suppress_filters' => false,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_key'         => self::KEY_META,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'meta_value'       => $key,
			)
		);
		do_action( 'rtgodam_after_attachment_lookup' );

		return ! empty( $ids ) ? (int) $ids[0] : 0;
	}

	/**
	 * Fetch a demo file payload from the SaaS Demo Assets API (guest endpoint).
	 *
	 * @param string $category Demo sub-folder.
	 * @param string $file_name Demo file name.
	 * @return array|\WP_Error Transcoder-job-style payload, or WP_Error.
	 */
	private static function fetch_demo_file( $category, $file_name ) {
		$url = add_query_arg(
			array(
				'category'  => rawurlencode( $category ),
				'file_name' => rawurlencode( $file_name ),
			),
			RTGODAM_API_BASE . '/api/method/godam_core.api.demo.get_demo_file'
		);

		// Short timeout so a slow/unreachable demo API can't block tour start (the
		// client awaits /demo-video). Matches the VIP branch's 3s.
		$args = array( 'timeout' => 3 );

		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			$response = vip_safe_wp_remote_get( $url, '', 3, 3, 20, $args );
		} else {
			$response = wp_safe_remote_get( $url, $args );
		}

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return new \WP_Error( 'godam_demo_http', __( 'Demo asset request failed.', 'godam' ) );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		// Frappe whitelisted methods wrap the return value under `message`.
		$payload = ( is_array( $body ) && isset( $body['message'] ) ) ? $body['message'] : $body;

		if ( empty( $payload ) || ! is_array( $payload ) || empty( $payload['name'] ) ) {
			return new \WP_Error( 'godam_demo_empty', __( 'Demo asset not found.', 'godam' ) );
		}

		return $payload;
	}

	/**
	 * Create a virtual attachment from a demo payload.
	 *
	 * @param string $key       "<category>/<file_name>".
	 * @param string $file_name Demo file name (title/filename fallback).
	 * @param array  $payload   Demo API payload (Transcoder Job shape).
	 * @return int Attachment id, or 0 on failure.
	 */
	private static function create_from_payload( $key, $file_name, $payload ) {
		$mp4 = ! empty( $payload['transcoded_mp4_url'] ) ? $payload['transcoded_mp4_url'] : '';
		$mpd = ! empty( $payload['transcoded_file_path'] ) ? $payload['transcoded_file_path'] : '';
		$hls = ! empty( $payload['transcoded_hls_path'] ) ? $payload['transcoded_hls_path'] : '';

		$data = array(
			'id'       => $payload['name'],
			'title'    => ! empty( $payload['title'] ) ? $payload['title'] : $file_name,
			'url'      => $mp4 ? $mp4 : $hls,
			'mime'     => 'video/mp4',
			'type'     => 'video',
			'mpd_url'  => $mpd,
			'hls_url'  => $hls,
			'icon'     => ! empty( $payload['thumbnail_url'] ) ? $payload['thumbnail_url'] : '',
			'filename' => ! empty( $payload['orignal_file_name'] ) ? $payload['orignal_file_name'] : ( $file_name . '.mp4' ),
			'width'    => isset( $payload['width'] ) ? (int) $payload['width'] : 0,
			'height'   => isset( $payload['height'] ) ? (int) $payload['height'] : 0,
		);

		$attach_id = \RTGODAM\Inc\REST_API\Media_Library::get_instance()->create_virtual_attachment(
			$data,
			array( 'is_demo' => true )
		);

		if ( is_wp_error( $attach_id ) || ! $attach_id ) {
			return 0;
		}

		/**
		 * Fires before writing this attachment's demo-asset marker, so
		 * integrations that centralize media on another site can switch
		 * context first — this runs after create_virtual_attachment()'s own
		 * wrap has already restored.
		 *
		 * @since 1.8.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		update_post_meta( $attach_id, self::KEY_META, $key );
		do_action( 'rtgodam_after_attachment_lookup' );

		return (int) $attach_id;
	}
}
