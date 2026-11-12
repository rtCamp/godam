<?php
/**
 * Abilities for finding and inspecting GoDAM media.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Media_Usage_Tracker;
use RTGODAM\Inc\Taxonomies\Media_Folders;

/**
 * Class Media_Abilities
 *
 * @since n.e.x.t
 */
class Media_Abilities extends Ability_Group {

	/**
	 * Largest page an agent may request from godam/list-media.
	 *
	 * @var int
	 */
	const MAX_PER_PAGE = 50;

	/**
	 * Largest number of items godam/get-media-health scans in one call.
	 *
	 * @var int
	 */
	const MAX_HEALTH_SCAN = 1000;

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/list-media',
			array(
				'label'               => __( 'List media', 'godam' ),
				'description'         => __( 'List media in the GoDAM library, newest first. Filter by type, transcoding status, folder, or a keyword matched against title, caption and description. Returns IDs to pass to the other godam/* abilities.', 'godam' ),
				'category'            => 'godam-media',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'type'      => array(
							'type' => 'string',
							'enum' => array( 'video', 'audio', 'image', 'document' ),
						),
						'status'    => array(
							'type'        => 'string',
							'enum'        => array( 'transcoded', 'processing', 'failed', 'not_transcoded' ),
							'description' => __( 'Transcoding status.', 'godam' ),
						),
						'folder_id' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => __( 'Folder ID from godam/list-folders. 0 means media in no folder.', 'godam' ),
						),
						'search'    => array(
							'type'        => 'string',
							'description' => __( 'Keyword matched against title, caption and description. Not a semantic search.', 'godam' ),
						),
						'page'      => array(
							'type'    => 'integer',
							'minimum' => 1,
							'default' => 1,
						),
						'per_page'  => array(
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => self::MAX_PER_PAGE,
							'default' => 20,
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'total'       => array( 'type' => 'integer' ),
						'total_pages' => array( 'type' => 'integer' ),
						'page'        => array( 'type' => 'integer' ),
						'items'       => array(
							'type'  => 'array',
							'items' => $this->media_schema(),
						),
					),
				),
				'execute_callback'    => array( $this, 'list_media' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);

		$this->add(
			'godam/get-media',
			array(
				'label'               => __( 'Get media details', 'godam' ),
				'description'         => __( 'Full details of one media item: type, duration, transcoding status and job ID, streaming URLs, thumbnail, folder, and whether a transcript exists.', 'godam' ),
				'category'            => 'godam-media',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => $this->media_schema(),
				'execute_callback'    => array( $this, 'get_media' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);

		$this->add(
			'godam/where-is-media-used',
			array(
				'label'               => __( 'Find where media is used', 'godam' ),
				'description'         => __( 'List every post, page, product or widget that embeds a media item, with links. Use before deleting or replacing media, or to find the pages a video appears on.', 'godam' ),
				'category'            => 'godam-media',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'media_id' => array( 'type' => 'integer' ),
						'count'    => array( 'type' => 'integer' ),
						'used_in'  => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'where_is_media_used' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);

		$this->add(
			'godam/get-transcript',
			array(
				'label'               => __( 'Get transcript', 'godam' ),
				'description'         => __( 'The transcript of a video or audio item. "text" returns readable prose for summarising or quoting; "segments" returns timed lines for locating a moment.', 'godam' ),
				'category'            => 'godam-media',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'id'     => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media (attachment) ID.', 'godam' ),
						),
						'format' => array(
							'type'    => 'string',
							'enum'    => array( 'text', 'segments', 'vtt' ),
							'default' => 'text',
						),
					),
					'required'   => array( 'id' ),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'media_id'   => array( 'type' => 'integer' ),
						'status'     => array( 'type' => 'string' ),
						'format'     => array( 'type' => 'string' ),
						'transcript' => array(
							'type'        => array( 'string', 'array', 'null' ),
							'description' => 'Prose for "text", WebVTT for "vtt", timed lines for "segments"; null when there is no transcript yet.',
						),
					),
				),
				'execute_callback'    => array( $this, 'get_transcript' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			)
		);

		$this->add(
			'godam/get-media-health',
			array(
				'label'               => __( 'Check media library health', 'godam' ),
				'description'         => __( 'Scan recent media for problems: failed or missing transcoding, video and audio without transcripts, images without alt text, and media not used anywhere. Returns counts and the affected IDs.', 'godam' ),
				'category'            => 'godam-media',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'scan_limit' => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'maximum'     => self::MAX_HEALTH_SCAN,
							'default'     => 200,
							'description' => __( 'How many of the most recent media items to scan.', 'godam' ),
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'scanned' => array( 'type' => 'integer' ),
						'issues'  => array( 'type' => 'object' ),
					),
				),
				'execute_callback'    => array( $this, 'get_media_health' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);
	}

	/**
	 * Permission: the user can browse the media library.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_browse_library() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Permission: the user can edit the specific media item.
	 *
	 * Mirrors the transcription REST route this ability delegates to.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return bool
	 */
	public function can_edit_media( $input = array() ) {
		$id = isset( $input['id'] ) ? absint( $input['id'] ) : 0;

		return $id ? parent::can_edit_media( $input ) : current_user_can( 'upload_files' );
	}

	/**
	 * Executes godam/list-media.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array
	 */
	public function list_media( $input = array() ) {
		$input    = is_array( $input ) ? $input : array();
		$page     = max( 1, (int) ( $input['page'] ?? 1 ) );
		$per_page = min( self::MAX_PER_PAGE, max( 1, (int) ( $input['per_page'] ?? 20 ) ) );

		$query_args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'date',
			'order'          => 'DESC',
		);

		if ( ! empty( $input['type'] ) ) {
			$query_args['post_mime_type'] = 'document' === $input['type'] ? array( 'application', 'text' ) : $input['type'];
		}

		if ( ! empty( $input['search'] ) ) {
			$query_args['s'] = sanitize_text_field( $input['search'] );
		}

		if ( isset( $input['folder_id'] ) ) {
			$folder_id = absint( $input['folder_id'] );

			$query_args['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				0 === $folder_id
					? array(
						'taxonomy' => Media_Folders::SLUG,
						'operator' => 'NOT EXISTS',
					)
					: array(
						'taxonomy' => Media_Folders::SLUG,
						'field'    => 'term_id',
						'terms'    => $folder_id,
					),
			);
		}

		if ( ! empty( $input['status'] ) ) {
			$query_args['meta_query'] = array( $this->status_meta_query( $input['status'] ) ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		do_action( 'rtgodam_before_attachment_lookup' );
		$query = new \WP_Query( $query_args );
		do_action( 'rtgodam_after_attachment_lookup' );

		return array(
			'total'       => (int) $query->found_posts,
			'total_pages' => (int) $query->max_num_pages,
			'page'        => $page,
			'items'       => array_map( array( $this, 'shape_media' ), $query->posts ),
		);
	}

	/**
	 * Executes godam/get-media.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_media( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		return is_wp_error( $post ) ? $post : $this->shape_media( $post );
	}

	/**
	 * Executes godam/where-is-media-used.
	 *
	 * Reads the usage index the plugin already maintains on every save, so this
	 * is a lookup, not a scan of site content.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function where_is_media_used( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$tracker = Media_Usage_Tracker::get_instance();

		do_action( 'rtgodam_before_attachment_lookup' );
		$sources = get_post_meta( $post->ID, Media_Usage_Tracker::SOURCES_META_KEY, true );
		do_action( 'rtgodam_after_attachment_lookup' );

		$entries = $this->normalise_usage_sources( is_array( $sources ) ? $sources : array() );
		$blog_id = get_current_blog_id();

		// Sites indexed before source tracking existed have IDs but no sources.
		foreach ( $tracker->get_usage_post_ids( $post->ID ) as $usage_id ) {
			$key = $blog_id . ':' . $usage_id;
			if ( ! isset( $entries[ $key ] ) ) {
				$entries[ $key ] = array(
					'blog_id' => $blog_id,
					'post_id' => (int) $usage_id,
					'sources' => array( 'content' ),
				);
			}
		}

		$used_in = array();

		foreach ( $entries as $entry ) {
			$item = $this->describe_usage( $entry );

			if ( $item ) {
				$used_in[] = $item;
			}
		}

		return array(
			'media_id' => $post->ID,
			'count'    => count( $used_in ),
			'used_in'  => $used_in,
		);
	}

	/**
	 * Normalises the usage-sources meta into one entry per referencing post.
	 *
	 * The stored shape is keyed `"<blog_id>:<post_id>"` with values
	 * `{blog_id, post_id, sources[]}`. The constant's docblock describes an
	 * older `post_id => sources[]` shape, which is also accepted here.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $sources Raw `_godam_usage_sources` meta.
	 *
	 * @return array<string, array{blog_id: int, post_id: int, sources: string[]}>
	 */
	private function normalise_usage_sources( array $sources ) {
		$entries = array();

		foreach ( $sources as $key => $value ) {
			if ( is_array( $value ) && isset( $value['post_id'] ) ) {
				$blog_id = (int) ( $value['blog_id'] ?? get_current_blog_id() );
				$post_id = (int) $value['post_id'];
				$list    = (array) ( $value['sources'] ?? array() );
			} else {
				$blog_id = get_current_blog_id();
				$post_id = (int) $key;
				$list    = (array) $value;
			}

			$entries[ $blog_id . ':' . $post_id ] = array(
				'blog_id' => $blog_id,
				'post_id' => $post_id,
				'sources' => array_values( array_map( 'strval', $list ) ),
			);
		}

		return $entries;
	}

	/**
	 * Describes one usage entry for an agent, resolving the post on its own site.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $entry Entry from normalise_usage_sources().
	 *
	 * @return array|null Null when the referencing post no longer exists.
	 */
	private function describe_usage( array $entry ) {
		if ( 0 === $entry['post_id'] ) {
			return array(
				'blog_id'   => $entry['blog_id'],
				'post_id'   => 0,
				'title'     => __( 'Block widgets', 'godam' ),
				'post_type' => 'widget',
				'status'    => 'publish',
				'sources'   => $entry['sources'],
				'url'       => null,
				'edit_url'  => admin_url( 'widgets.php' ),
			);
		}

		$switched = is_multisite() && get_current_blog_id() !== $entry['blog_id'];

		if ( $switched ) {
			switch_to_blog( $entry['blog_id'] );
		}

		$usage_post = get_post( $entry['post_id'] ); // godam-coverage-ignore -- describe_usage(): post_id is the host post that embeds the media, read on its own site (switched to above), not the attachment.
		$item       = null;

		// Skip posts the acting user cannot read, such as private posts and other
		// users' drafts, so their titles are never revealed.
		if ( $usage_post && current_user_can( 'read_post', $usage_post->ID ) ) { // godam-coverage-ignore -- describe_usage(): read check on the host post that embeds the media, on its own site (switched to above), not the attachment.
			$item = array(
				'blog_id'   => $entry['blog_id'],
				'post_id'   => $entry['post_id'],
				'title'     => $this->plain_title( $usage_post ),
				'post_type' => $usage_post->post_type,
				'status'    => $usage_post->post_status,
				'sources'   => $entry['sources'],
				'url'       => 'publish' === $usage_post->post_status ? get_permalink( $usage_post ) : null,
				'edit_url'  => current_user_can( 'edit_post', $entry['post_id'] ) ? get_edit_post_link( $entry['post_id'], 'raw' ) : null, // godam-coverage-ignore -- describe_usage(): edit check on the same host post, not the attachment.
			);
		}

		if ( $switched ) {
			restore_current_blog();
		}

		return $item;
	}

	/**
	 * Executes godam/get-transcript.
	 *
	 * The transcription route returns where the transcript lives, not the
	 * transcript itself, so the WebVTT file is fetched from the CDN here.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_transcript( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$format = $input['format'] ?? 'text';
		$found  = $this->rest( 'GET', '/godam/v1/transcription', array( 'attachment_id' => $post->ID ) );

		if ( is_wp_error( $found ) ) {
			return $found;
		}

		if ( empty( $found['transcript_path'] ) ) {
			return array(
				'media_id'   => $post->ID,
				'status'     => $found['status'] ? $found['status'] : 'not_requested',
				'format'     => $format,
				'transcript' => null,
				'hint'       => __( 'No transcript yet. Request one with godam/request-transcription, then check back.', 'godam' ),
			);
		}

		// A transcript is a small CDN file; keep the timeout short so a slow CDN
		// can't hold the agent's request open. Matches the VIP branch's 3s.
		$args = array( 'timeout' => 3 );

		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			$response = vip_safe_wp_remote_get( $found['transcript_path'], '', 3, 3, 20, $args );
		} else {
			$response = wp_safe_remote_get( $found['transcript_path'], $args );
		}

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return new \WP_Error(
				'rtgodam_transcript_unreachable',
				__( 'A transcript is recorded for this media but could not be downloaded from the CDN. Try godam/get-transcript again in a moment.', 'godam' ),
				array( 'path' => $found['transcript_path'] )
			);
		}

		$vtt      = wp_remote_retrieve_body( $response );
		$segments = $this->parse_vtt( $vtt );

		if ( 'vtt' === $format ) {
			$transcript = $vtt;
		} elseif ( 'segments' === $format ) {
			$transcript = $segments;
		} else {
			$transcript = implode( ' ', wp_list_pluck( $segments, 'text' ) );
		}

		return array(
			'media_id'   => $post->ID,
			'status'     => 'transcribed',
			'format'     => $format,
			'transcript' => $transcript,
			'empty'      => empty( $segments ),
		);
	}

	/**
	 * Executes godam/get-media-health.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array
	 */
	public function get_media_health( $input = array() ) {
		$limit = min( self::MAX_HEALTH_SCAN, max( 1, (int) ( $input['scan_limit'] ?? 200 ) ) );

		do_action( 'rtgodam_before_attachment_lookup' );

		$posts = get_posts(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => $limit,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		$tracker = Media_Usage_Tracker::get_instance();
		$issues  = array(
			'transcoding_failed' => array(),
			'not_transcoded'     => array(),
			'missing_transcript' => array(),
			'missing_alt_text'   => array(),
			'unused'             => array(),
		);

		foreach ( $posts as $post ) {
			$type   = $this->media_type( $this->attachment_mime_type( $post ) );
			$status = $this->transcoding_status( $post->ID );
			$item   = array(
				'id'    => $post->ID,
				'title' => $this->plain_title( $post ),
			);

			if ( in_array( $type, array( 'video', 'audio' ), true ) ) {
				if ( 'failed' === $status ) {
					$item['error']                  = $this->meta_or_null( $post->ID, 'rtgodam_transcoding_error_msg' );
					$issues['transcoding_failed'][] = $item;
				} elseif ( 'not_transcoded' === $status ) {
					$issues['not_transcoded'][] = $item;
				} elseif ( 'transcoded' === $status && ! $this->meta_or_null( $post->ID, 'rtgodam_transcript_path' ) ) {
					$issues['missing_transcript'][] = $item;
				}
			}

			if ( 'image' === $type && '' === trim( (string) $this->meta_or_null( $post->ID, '_wp_attachment_image_alt' ) ) ) {
				$issues['missing_alt_text'][] = $item;
			}

			if ( empty( $tracker->get_usage_post_ids( $post->ID ) ) ) {
				$issues['unused'][] = $item;
			}
		}

		$summary = array();
		foreach ( $issues as $issue => $items ) {
			$summary[ $issue ] = array(
				'count' => count( $items ),
				'items' => $items,
			);
		}

		return array(
			'scanned' => count( $posts ),
			'issues'  => $summary,
			'note'    => __( '"unused" relies on the usage index; run the media usage sync under GoDAM Tools if this site has content from before GoDAM was installed.', 'godam' ),
		);
	}

	/**
	 * Builds the meta query clause for a normalised transcoding status.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $status One of transcoded, processing, failed, not_transcoded.
	 *
	 * @return array
	 */
	private function status_meta_query( $status ) {
		$key        = 'rtgodam_transcoding_status';
		$transcoded = array( 'transcoded', 'Transcoded' );
		$failed     = array( 'failed', 'Failed', 'blocked' );

		switch ( $status ) {
			case 'transcoded':
				return array(
					'key'     => $key,
					'value'   => $transcoded,
					'compare' => 'IN',
				);

			case 'failed':
				return array(
					'key'     => $key,
					'value'   => $failed,
					'compare' => 'IN',
				);

			case 'not_transcoded':
				return array(
					'relation' => 'OR',
					array(
						'key'     => $key,
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'   => $key,
						'value' => '',
					),
				);

			default: // processing.
				return array(
					'relation' => 'AND',
					array(
						'key'     => $key,
						'value'   => array_merge( $transcoded, $failed, array( '' ) ),
						'compare' => 'NOT IN',
					),
				);
		}
	}

	/**
	 * Parses WebVTT into timed segments.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $vtt WebVTT document.
	 *
	 * @return array<int, array{start: float, end: float, text: string}>
	 */
	private function parse_vtt( $vtt ) {
		$segments = array();
		$blocks   = preg_split( '/\R{2,}/', trim( str_replace( "\r\n", "\n", (string) $vtt ) ) );

		foreach ( $blocks as $block ) {
			$lines  = array_values( array_filter( array_map( 'trim', explode( "\n", $block ) ), 'strlen' ) );
			$timing = null;

			foreach ( $lines as $index => $line ) {
				if ( false !== strpos( $line, '-->' ) ) {
					$timing = $index;
					break;
				}
			}

			if ( null === $timing ) {
				continue;
			}

			list( $start, $end ) = array_map( 'trim', explode( '-->', $lines[ $timing ] ) );
			$text                = trim( implode( ' ', array_slice( $lines, $timing + 1 ) ) );

			if ( '' === $text ) {
				continue;
			}

			$segments[] = array(
				'start' => $this->vtt_seconds( strtok( $start, ' ' ) ),
				'end'   => $this->vtt_seconds( strtok( $end, ' ' ) ),
				'text'  => $text,
			);
		}

		return $segments;
	}

	/**
	 * Converts a WebVTT timestamp to seconds.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $stamp `hh:mm:ss.mmm` or `mm:ss.mmm`.
	 *
	 * @return float
	 */
	private function vtt_seconds( $stamp ) {
		$parts   = array_reverse( explode( ':', str_replace( ',', '.', (string) $stamp ) ) );
		$seconds = 0.0;

		foreach ( $parts as $power => $part ) {
			$seconds += (float) $part * ( 60 ** $power );
		}

		return round( $seconds, 3 );
	}
}
