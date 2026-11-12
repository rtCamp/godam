<?php
/**
 * Shared plumbing for GoDAM's ability groups.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Taxonomies\Media_Folders;

/**
 * Class Ability_Group
 *
 * Each subclass registers a related set of abilities. This base class applies
 * GoDAM's exposure defaults, runs GoDAM's own REST routes in-process, and gives
 * every ability the same shape for a media item.
 *
 * @since n.e.x.t
 */
abstract class Ability_Group {

	/**
	 * Writes that replace what is already there, so MCP clients ask the user
	 * before running them.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const DESTRUCTIVE_WRITES = array(
		'godam/update-media-details',
		'godam/update-video-settings',
		'godam/update-site-settings',
		'godam/add-media-to-page',
		'godam/set-chapters',
		'godam/remove-layer',
		'godam/move-media-to-folder',
		'godam/retranscode-media',
	);

	/**
	 * Abilities that reach outside the site: GoDAM Central or another server.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const OPEN_WORLD = array(
		'godam/import-media-from-url',
		'godam/get-transcript',
		'godam/request-transcription',
		'godam/retranscode-media',
		'godam/get-media-analytics',
		'godam/get-top-videos',
		'godam/get-storage-usage',
		'godam/get-layer-analytics',
		'godam/get-video-funnel',
		'godam/get-placement-performance',
		'godam/get-revenue-summary',
		'godam/get-top-products',
	);

	/**
	 * Abilities that need a GoDAM plan: a verified GoDAM API key, because the
	 * work is done by GoDAM Central. On a free site they stay listed, say so in
	 * their description, and return one clear error.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const PLAN_REQUIRED = array(
		'godam/request-transcription',
		'godam/retranscode-media',
		'godam/get-media-analytics',
		'godam/get-top-videos',
		'godam/get-storage-usage',
		'godam/get-layer-analytics',
		'godam/get-video-funnel',
		'godam/get-placement-performance',
		'godam/get-revenue-summary',
		'godam/get-top-products',
	);

	/**
	 * Default maximum length of a string input, in characters.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const MAX_STRING_LENGTH = 2000;

	/**
	 * Maximum length of free-text inputs such as descriptions and layer HTML.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const MAX_TEXT_LENGTH = 20000;

	/**
	 * Input properties that hold free text and get MAX_TEXT_LENGTH.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const TEXT_PROPERTIES = array( 'description', 'caption', 'html', 'text', 'content', 'css', 'custom_css' );

	/**
	 * Default maximum number of items in an array input.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	const MAX_ITEMS = 100;

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	abstract public function register();

	/**
	 * Registers one ability with GoDAM's exposure defaults applied.
	 *
	 * Abilities are private unless their meta says otherwise. Reads are made
	 * public; writes follow the WRITE_ABILITIES_OPTION setting, which is on
	 * unless an administrator turns it off. Both `meta.public` and
	 * `meta.mcp.public` are set because the MCP Adapter has read each of them
	 * in different releases.
	 *
	 * The input schema gets length and size limits, and abilities that need a
	 * GoDAM plan refuse to run on a site without a verified API key.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $name   Ability name, `godam/<verb-noun>`.
	 * @param array  $args   Arguments for wp_register_ability().
	 * @param bool   $writes Whether the ability changes data.
	 *
	 * @return void
	 */
	protected function add( $name, array $args, $writes = false ) {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		$public = $writes ? Abilities::writes_enabled() : true;

		/**
		 * Filters whether a GoDAM ability is exposed to clients such as MCP.
		 *
		 * The acting user's capabilities are still checked on every call; this
		 * only controls whether the ability is listed at all.
		 *
		 * @since n.e.x.t
		 *
		 * @param bool   $public Whether the ability is exposed.
		 * @param string $name   Ability name.
		 * @param bool   $writes Whether the ability changes data.
		 */
		$public = (bool) apply_filters( 'rtgodam_ability_is_public', $public, $name, $writes );

		$annotations = $writes
			? array(
				'readonly'    => false,
				'destructive' => false,
				'idempotent'  => false,
			)
			: array(
				'readonly'    => true,
				'destructive' => false,
				'idempotent'  => true,
			);

		if ( $writes && in_array( $name, static::DESTRUCTIVE_WRITES, true ) ) {
			$annotations['destructive'] = true;
		}

		if ( in_array( $name, static::OPEN_WORLD, true ) ) {
			$annotations['openWorldHint'] = true;
		}

		// The MCP switch in GoDAM settings hides every GoDAM ability from every
		// MCP server, the adapter's default server included, not only GoDAM's own,
		// and from the WordPress Abilities REST API, so off means off.
		$mcp_public = $public && Abilities::mcp_enabled();

		$defaults = array(
			'public'       => $mcp_public,
			'show_in_rest' => $mcp_public,
			'mcp'          => array(
				'public' => $mcp_public,
				'type'   => 'tool',
			),
			'annotations'  => $annotations,
		);

		$args['meta'] = array_replace_recursive( $defaults, $args['meta'] ?? array() );

		if ( ! empty( $args['input_schema'] ) ) {
			$args['input_schema'] = $this->limit_schema( $args['input_schema'] );
		}

		if ( in_array( $name, static::PLAN_REQUIRED, true ) && isset( $args['execute_callback'] ) ) {
			$args['description']      = trim( ( $args['description'] ?? '' ) . ' ' . __( 'Needs a GoDAM plan: the site must be connected to GoDAM with a verified API key.', 'godam' ) );
			$args['execute_callback'] = $this->require_plan( $args['execute_callback'] );
		}

		wp_register_ability( $name, $args );
	}

	/**
	 * Wraps an execute callback so it returns one clear error on a site
	 * without a verified GoDAM API key.
	 *
	 * @since n.e.x.t
	 *
	 * @param callable $callback Execute callback.
	 *
	 * @return callable
	 */
	protected function require_plan( $callback ) {
		return function ( $input = null ) use ( $callback ) {
			if ( ! $this->site_has_plan() ) {
				return self::plan_required_error();
			}

			return call_user_func( $callback, $input );
		};
	}

	/**
	 * Whether the site is connected to GoDAM with a verified API key.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	protected function site_has_plan() {
		return rtgodam_is_api_key_valid();
	}

	/**
	 * The error an ability returns when it needs a GoDAM plan and the site has none.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_Error
	 */
	public static function plan_required_error() {
		return new \WP_Error(
			'rtgodam_plan_required',
			__( 'This needs a GoDAM plan. Connect this site to GoDAM with a verified API key in GoDAM > Settings, then try again.', 'godam' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Adds input limits to a JSON Schema: `additionalProperties: false` on
	 * objects that list their properties, `maxLength` on strings and
	 * `maxItems` on arrays. A limit the schema already sets is kept.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $schema   JSON Schema.
	 * @param string $property Name of the property this schema describes, if any.
	 *
	 * @return array
	 */
	protected function limit_schema( array $schema, $property = '' ) {
		$type  = $schema['type'] ?? null;
		$types = (array) $type;

		if ( in_array( 'object', $types, true ) && ! empty( $schema['properties'] ) && is_array( $schema['properties'] ) ) {
			if ( ! array_key_exists( 'additionalProperties', $schema ) ) {
				$schema['additionalProperties'] = false;
			}

			foreach ( $schema['properties'] as $key => $child ) {
				if ( is_array( $child ) ) {
					$schema['properties'][ $key ] = $this->limit_schema( $child, (string) $key );
				}
			}
		}

		if ( 'string' === $type && ! isset( $schema['maxLength'] ) && ! isset( $schema['enum'] ) ) {
			$schema['maxLength'] = in_array( $property, self::TEXT_PROPERTIES, true ) ? self::MAX_TEXT_LENGTH : self::MAX_STRING_LENGTH;
		}

		if ( in_array( 'array', $types, true ) ) {
			if ( ! isset( $schema['maxItems'] ) ) {
				$schema['maxItems'] = self::MAX_ITEMS;
			}

			if ( isset( $schema['items'] ) && is_array( $schema['items'] ) ) {
				$schema['items'] = $this->limit_schema( $schema['items'] );
			}
		}

		return $schema;
	}

	/**
	 * Runs a REST route in-process and returns its data.
	 *
	 * Abilities reuse GoDAM's REST controllers rather than duplicating their
	 * logic, so each route's own validation and permission checks still apply
	 * on top of the ability's.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $method HTTP method.
	 * @param string $route  Full route, e.g. `/godam/v1/transcription`.
	 * @param array  $params Request parameters.
	 *
	 * @return mixed|\WP_Error Response data, or an error carrying the route's message.
	 */
	protected function rest( $method, $route, array $params = array() ) {
		$request = new \WP_REST_Request( $method, $route );

		if ( 'GET' === $method ) {
			$request->set_query_params( $params );
		} else {
			$request->set_body_params( $params );
		}

		$response = rest_do_request( $request );
		$data     = rest_get_server()->response_to_data( $response, false );

		if ( $response->is_error() ) {
			$code    = is_array( $data ) && ! empty( $data['code'] ) ? $data['code'] : 'rtgodam_ability_failed';
			$message = is_array( $data ) && ! empty( $data['message'] ) ? $data['message'] : __( 'The GoDAM request failed.', 'godam' );

			return new \WP_Error( $code, $message, array( 'status' => $response->get_status() ) );
		}

		return $data;
	}

	/**
	 * Returns the attachment if it exists, or an error an agent can act on.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return \WP_Post|\WP_Error
	 */
	protected function get_attachment( $attachment_id ) {
		$post = $this->attachment_post( $attachment_id );

		if ( ! $post || 'attachment' !== $post->post_type ) {
			return new \WP_Error(
				'rtgodam_media_not_found',
				/* translators: %d: attachment ID. */
				sprintf( __( 'No media item with ID %d exists. Use godam/list-media to find IDs.', 'godam' ), absint( $attachment_id ) ),
				array( 'status' => 404 )
			);
		}

		return $post;
	}

	/**
	 * Shapes an attachment into the media object every ability returns.
	 *
	 * Keeps what an agent acts on — IDs, status, links — and leaves out the
	 * dozens of internal meta keys an attachment carries.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Post $post Attachment.
	 *
	 * @return array
	 */
	protected function shape_media( \WP_Post $post ) {
		$id = $post->ID;

		do_action( 'rtgodam_before_attachment_lookup' );

		$mime     = (string) get_post_mime_type( $post );
		$folders  = wp_get_object_terms( $id, Media_Folders::SLUG, array( 'fields' => 'all' ) );
		$folder   = ( ! is_wp_error( $folders ) && ! empty( $folders ) ) ? $folders[0] : null;
		$duration = $this->duration( $id );

		$shaped = array(
			'id'               => $id,
			'title'            => $this->plain_title( $post ),
			'type'             => $this->media_type( $mime ),
			'mime_type'        => $mime,
			'uploaded'         => get_post_time( 'c', true, $post ),
			'duration_seconds' => $duration['seconds'],
			'duration_source'  => $duration['source'],
			'transcoding'      => array(
				'status' => $this->transcoding_status( $id ),
				'job_id' => $this->meta_or_null( $id, 'rtgodam_transcoding_job_id' ),
				'error'  => $this->meta_or_null( $id, 'rtgodam_transcoding_error_msg' ),
			),
			'has_transcript'   => (bool) get_post_meta( $id, 'rtgodam_transcript_path', true ),
			'folder'           => $folder ? array(
				'id'   => (int) $folder->term_id,
				'name' => $folder->name,
			) : null,
			'urls'             => array(
				'original'  => wp_get_attachment_url( $id ),
				'dash'      => $this->meta_or_null( $id, 'rtgodam_transcoded_url' ),
				'hls'       => $this->meta_or_null( $id, 'rtgodam_hls_transcoded_url' ),
				'thumbnail' => $this->meta_or_null( $id, 'rtgodam_media_video_thumbnail' ),
				'edit'      => get_edit_post_link( $id, 'raw' ),
			),
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		return $shaped;
	}

	/**
	 * A media item's duration, labelled with where it came from.
	 *
	 * GoDAM's transcoder measures duration, but that figure is not stored on
	 * uploaded attachments. `_video_duration` is Video_Metadata's copy of
	 * WordPress's own reading of the file, which can be wrong — 72s for a
	 * 45.5s file was seen in testing. Agents are told so rather than handed
	 * the number as fact.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return array{seconds: int|null, source: string|null}
	 */
	protected function duration( $attachment_id ) {
		do_action( 'rtgodam_before_attachment_lookup' );

		$seconds = (int) get_post_meta( $attachment_id, '_video_duration', true );

		if ( $seconds <= 0 ) {
			$metadata = wp_get_attachment_metadata( $attachment_id );
			$seconds  = (int) ( $metadata['length'] ?? 0 );
		}

		do_action( 'rtgodam_after_attachment_lookup' );

		return $seconds > 0
			? array(
				'seconds' => $seconds,
				'source'  => 'local_metadata',
			)
			: array(
				'seconds' => null,
				'source'  => null,
			);
	}

	/**
	 * A post's title as its author typed it.
	 *
	 * The core get_the_title() texturises and HTML-encodes for display
	 * ("What&#8217;s new"), which an agent would then quote or search for
	 * verbatim.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_Post $post Post.
	 *
	 * @return string
	 */
	protected function plain_title( \WP_Post $post ) {
		return '' !== $post->post_title ? $post->post_title : __( '(no title)', 'godam' );
	}

	/**
	 * Normalises the stored transcoding status.
	 *
	 * The plugin stores this meta with inconsistent casing and vocabulary
	 * (`Transcoded` and `transcoded`, `failed` and `blocked`, `Queued` and
	 * `not_started`). Agents get four stable values instead.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return string One of transcoded, processing, failed, not_transcoded.
	 */
	protected function transcoding_status( $attachment_id ) {
		$raw = strtolower( trim( (string) $this->meta_or_null( $attachment_id, 'rtgodam_transcoding_status' ) ) );

		if ( '' === $raw ) {
			return 'not_transcoded';
		}

		if ( 'transcoded' === $raw ) {
			return 'transcoded';
		}

		if ( in_array( $raw, array( 'failed', 'blocked' ), true ) ) {
			return 'failed';
		}

		return 'processing';
	}

	/**
	 * Maps a MIME type to the four media types GoDAM's abilities speak.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $mime MIME type.
	 *
	 * @return string One of video, audio, image, document.
	 */
	protected function media_type( $mime ) {
		$top = strtok( $mime, '/' );

		return in_array( $top, array( 'video', 'audio', 'image' ), true ) ? $top : 'document';
	}

	/**
	 * A media item's stored GoDAM settings: the layers, chapters and player
	 * configuration (`videoConfig`) the media editor saves.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return array
	 */
	protected function godam_meta( $attachment_id ) {
		$meta = $this->meta_or_null( $attachment_id, 'rtgodam_meta' );

		return is_array( $meta ) ? $meta : array();
	}

	/**
	 * Saves a media item's GoDAM settings through the attachment's REST field,
	 * as the media editor does.
	 *
	 * The whole value is written back, so callers change only their own part
	 * of what godam_meta() returned and the rest is kept as it was. The field
	 * keeps its own rules, such as the custom-CSS limit for non-admins.
	 *
	 * @since n.e.x.t
	 *
	 * @param int   $attachment_id Attachment ID.
	 * @param array $meta          Settings to save.
	 *
	 * @return true|\WP_Error
	 */
	protected function save_godam_meta( $attachment_id, array $meta ) {
		$result = $this->rest( 'POST', '/wp/v2/media/' . $attachment_id, array( 'rtgodam_meta' => $meta ) );

		return is_wp_error( $result ) ? $result : true;
	}

	/**
	 * The media editor's address for a media item.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return string
	 */
	protected function editor_url( $attachment_id ) {
		return admin_url( 'admin.php?page=rtgodam_media_editor&id=' . absint( $attachment_id ) );
	}

	/**
	 * Reads a single attachment meta value, returning null rather than an empty string.
	 *
	 * @since n.e.x.t
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $key           Meta key.
	 *
	 * @return mixed|null
	 */
	protected function meta_or_null( $attachment_id, $key ) {
		do_action( 'rtgodam_before_attachment_lookup' );
		$value = get_post_meta( $attachment_id, $key, true );
		do_action( 'rtgodam_after_attachment_lookup' );

		return ( '' === $value || false === $value ) ? null : $value;
	}

	/*
	 * Attachment access.
	 *
	 * Every read of attachment data is bracketed by the
	 * rtgodam_before_attachment_lookup / rtgodam_after_attachment_lookup pair,
	 * like the rest of GoDAM, so integrations that keep media on another site
	 * (such as wp-dam on multisite) can switch to it first. Abilities go through
	 * these helpers rather than calling the core functions directly. Reads of
	 * the host posts media is placed on are not bracketed.
	 */

	/**
	 * The attachment post, or null.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return \WP_Post|null
	 */
	protected function attachment_post( $attachment_id ) {
		do_action( 'rtgodam_before_attachment_lookup' );
		$post = get_post( absint( $attachment_id ) );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $post;
	}

	/**
	 * An attachment's MIME type.
	 *
	 * @since n.e.x.t
	 *
	 * @param int|\WP_Post $attachment Attachment ID or post.
	 *
	 * @return string
	 */
	protected function attachment_mime_type( $attachment ) {
		do_action( 'rtgodam_before_attachment_lookup' );
		$mime = (string) get_post_mime_type( $attachment );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $mime;
	}

	/**
	 * An attachment's file URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return string
	 */
	protected function attachment_url( $attachment_id ) {
		do_action( 'rtgodam_before_attachment_lookup' );
		$url = (string) wp_get_attachment_url( $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $url;
	}

	/**
	 * An attachment's WordPress metadata (dimensions, length and so on).
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return array
	 */
	protected function attachment_metadata( $attachment_id ) {
		do_action( 'rtgodam_before_attachment_lookup' );
		$metadata = wp_get_attachment_metadata( $attachment_id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return is_array( $metadata ) ? $metadata : array();
	}

	/**
	 * Permission: the user can edit the media item named by the input's `id`.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return bool
	 */
	public function can_edit_media( $input = array() ) {
		$id = isset( $input['id'] ) ? absint( $input['id'] ) : 0;

		if ( ! $id ) {
			return false;
		}

		do_action( 'rtgodam_before_attachment_lookup' );
		$can = current_user_can( 'edit_post', $id );
		do_action( 'rtgodam_after_attachment_lookup' );

		return $can;
	}

	/**
	 * JSON Schema for the media object returned by shape_media().
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	protected function media_schema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id'               => array( 'type' => 'integer' ),
				'title'            => array( 'type' => 'string' ),
				'type'             => array(
					'type' => 'string',
					'enum' => array( 'video', 'audio', 'image', 'document' ),
				),
				'mime_type'        => array( 'type' => 'string' ),
				'uploaded'         => array( 'type' => 'string' ),
				'duration_seconds' => array( 'type' => array( 'integer', 'null' ) ),
				'duration_source'  => array(
					'type'        => array( 'string', 'null' ),
					'enum'        => array( 'local_metadata', null ),
					'description' => 'local_metadata is WordPress\'s reading of the uploaded file and can differ from the transcoded stream.',
				),
				'transcoding'      => array( 'type' => 'object' ),
				'has_transcript'   => array( 'type' => 'boolean' ),
				'folder'           => array( 'type' => array( 'object', 'null' ) ),
				'urls'             => array( 'type' => 'object' ),
			),
		);
	}

	/**
	 * Input schema for abilities that act on one media item.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	protected function media_id_input() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id' => array(
					'type'        => 'integer',
					'minimum'     => 1,
					'description' => __( 'Media (attachment) ID, as returned by godam/list-media.', 'godam' ),
				),
			),
			'required'   => array( 'id' ),
		);
	}
}
