<?php
/**
 * MCP abilities partial: Abilities_Execution.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\MCP;

use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Media_Library;
use RTGODAM\Inc\REST_API\Site;
use RTGODAM\Inc\REST_API\Transcoding;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Abilities_Execution trait.
 */
trait Abilities_Execution {

	/**
	 * Return the MCP route contract.
	 *
	 * @return array<string, mixed>
	 */
	public function get_contract() {
		return array(
			'routes' => Route_Contract::get_instance()->get_routes(),
		);
	}

	/**
	 * Execute attachment details through the existing media library controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_attachment_details( $input = null ) {
		return $this->dispatch_media_library_callback(
			'get_attachment_by_id',
			array(
				'id' => isset( $input['id'] ) ? (string) $input['id'] : '',
			)
		);
	}

	/**
	 * Update media metadata through the ability API.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_media_metadata( $input = null ) {
		$attachment_id = isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0;

		if ( $attachment_id <= 0 ) {
			return new WP_Error( 'godam_mcp_invalid_attachment_id', __( 'A valid attachment ID is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$attachment = get_post( $attachment_id );
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new WP_Error( 'godam_mcp_attachment_not_found', __( 'The requested attachment was not found.', 'godam' ), array( 'status' => 404 ) );
		}

		$post_update    = array(
			'ID' => $attachment_id,
		);
		$updated_fields = array();

		if ( array_key_exists( 'title', (array) $input ) ) {
			$post_update['post_title'] = sanitize_text_field( wp_unslash( (string) $input['title'] ) );
			$updated_fields['title']   = $post_update['post_title'];
		}

		if ( array_key_exists( 'caption', (array) $input ) ) {
			$post_update['post_excerpt'] = sanitize_textarea_field( wp_unslash( (string) $input['caption'] ) );
			$updated_fields['caption']   = $post_update['post_excerpt'];
		}

		if ( array_key_exists( 'description', (array) $input ) ) {
			$post_update['post_content']   = sanitize_textarea_field( wp_unslash( (string) $input['description'] ) );
			$updated_fields['description'] = $post_update['post_content'];
		}

		if ( array_key_exists( 'slug', (array) $input ) ) {
			$post_update['post_name'] = sanitize_title( wp_unslash( (string) $input['slug'] ) );
			$updated_fields['slug']   = $post_update['post_name'];
		}

		if ( array_key_exists( 'alt_text', (array) $input ) ) {
			$alt_text = sanitize_text_field( wp_unslash( (string) $input['alt_text'] ) );
			update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt_text );
			$updated_fields['alt_text'] = $alt_text;
		}

		if ( empty( $updated_fields ) ) {
			return new WP_Error( 'godam_mcp_no_metadata_updates', __( 'At least one metadata field is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$update_result = null;
		if ( count( $post_update ) > 1 ) {
			$update_result = wp_update_post( wp_slash( $post_update ), true );
			if ( is_wp_error( $update_result ) ) {
				return $update_result;
			}
		}

		return array(
			'attachment_id' => $attachment_id,
			'attachment'    => $this->get_attachment_metadata_snapshot( $attachment_id ),
			'write_result'  => array(
				'updated_fields' => array_keys( $updated_fields ),
				'post_update'    => $update_result,
			),
		);
	}

	/**
	 * Execute media folders through the existing media library controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_media_folders( $input = null ) {
		return $this->dispatch_media_library_callback(
			'get_media_folders',
			array(
				'page'     => isset( $input['page'] ) ? absint( $input['page'] ) : null,
				'per_page' => isset( $input['per_page'] ) ? absint( $input['per_page'] ) : null,
				'parent'   => isset( $input['parent'] ) ? absint( $input['parent'] ) : null,
				'bookmark' => isset( $input['bookmark'] ) ? (bool) $input['bookmark'] : null,
				'locked'   => isset( $input['locked'] ) ? (bool) $input['locked'] : null,
			)
		);
	}

	/**
	 * Create a media folder.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_media_folder( $input = null ) {
		$name = isset( $input['name'] ) ? sanitize_text_field( wp_unslash( $input['name'] ) ) : '';

		if ( '' === $name ) {
			return new WP_Error( 'godam_mcp_invalid_folder_name', __( 'A folder name is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$args = array();
		if ( isset( $input['parent_id'] ) ) {
			$args['parent'] = absint( $input['parent_id'] );
		}

		$result = wp_insert_term( $name, 'media-folder', $args );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$folder_id = isset( $result['term_id'] ) ? absint( $result['term_id'] ) : 0;

		return array(
			'folder'       => $this->get_media_folder_snapshot( $folder_id ),
			'write_result' => $result,
		);
	}

	/**
	 * Rename a media folder.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function rename_media_folder( $input = null ) {
		$folder_id = isset( $input['folder_id'] ) ? absint( $input['folder_id'] ) : 0;
		$name      = isset( $input['name'] ) ? sanitize_text_field( wp_unslash( $input['name'] ) ) : '';

		if ( $folder_id <= 0 ) {
			return new WP_Error( 'godam_mcp_invalid_folder_id', __( 'A valid folder ID is required.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( '' === $name ) {
			return new WP_Error( 'godam_mcp_invalid_folder_name', __( 'A folder name is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$term = get_term( $folder_id, 'media-folder' );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'godam_mcp_folder_not_found', __( 'The requested folder was not found.', 'godam' ), array( 'status' => 404 ) );
		}

		$result = wp_update_term(
			$folder_id,
			'media-folder',
			array(
				'name' => $name,
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'folder_id'    => $folder_id,
			'folder'       => $this->get_media_folder_snapshot( $folder_id ),
			'write_result' => $result,
		);
	}

	/**
	 * Delete one or more media folders.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function delete_media_folders( $input = null ) {
		return $this->dispatch_media_library_callback(
			'bulk_delete_folders',
			array(
				'folder_ids' => $this->normalize_folder_ids( $input['folder_ids'] ?? array() ),
			),
			'DELETE'
		);
	}

	/**
	 * Set bookmark status for one or more media folders.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function set_media_folders_bookmark_status( $input = null ) {
		return $this->dispatch_media_library_callback(
			'bulk_update_folder_bookmark',
			array(
				'folder_ids'      => $this->normalize_folder_ids( $input['folder_ids'] ?? array() ),
				'bookmark_status' => isset( $input['bookmark_status'] ) ? (bool) $input['bookmark_status'] : false,
			),
			'POST'
		);
	}

	/**
	 * Set lock status for one or more media folders.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function set_media_folders_lock_status( $input = null ) {
		return $this->dispatch_media_library_callback(
			'bulk_update_folder_lock',
			array(
				'folder_ids'    => $this->normalize_folder_ids( $input['folder_ids'] ?? array() ),
				'locked_status' => isset( $input['locked_status'] ) ? (bool) $input['locked_status'] : false,
			),
			'POST'
		);
	}

	/**
	 * Assign one or more attachments to a media folder.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function assign_media_to_folder( $input = null ) {
		return $this->dispatch_media_library_callback(
			'assign_images_to_folder',
			array(
				'attachment_ids' => isset( $input['attachment_ids'] ) && is_array( $input['attachment_ids'] ) ? array_values( array_filter( array_map( 'absint', $input['attachment_ids'] ) ) ) : array(),
				'folder_term_id' => isset( $input['folder_id'] ) ? absint( $input['folder_id'] ) : 0,
			),
			'POST'
		);
	}

	/**
	 * Set the selected video thumbnail.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function set_video_thumbnail_ability( $input = null ) {
		return $this->dispatch_media_library_callback(
			'set_video_thumbnail',
			array(
				'attachment_id' => isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0,
				'thumbnail_url' => isset( $input['thumbnail_url'] ) ? esc_url_raw( wp_unslash( (string) $input['thumbnail_url'] ) ) : '',
			),
			'POST'
		);
	}

	/**
	 * Upload a custom video thumbnail.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function upload_custom_video_thumbnail_ability( $input = null ) {
		return $this->dispatch_media_library_callback(
			'upload_custom_video_thumbnail',
			array(
				'attachment_id' => isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0,
				'thumbnail_url' => isset( $input['thumbnail_url'] ) ? esc_url_raw( wp_unslash( (string) $input['thumbnail_url'] ) ) : '',
			),
			'POST'
		);
	}

	/**
	 * Delete a custom video thumbnail.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function delete_custom_video_thumbnail_ability( $input = null ) {
		return $this->dispatch_media_library_callback(
			'remove_custom_video_thumbnail',
			array(
				'attachment_id' => isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0,
				'thumbnail_url' => isset( $input['thumbnail_url'] ) ? esc_url_raw( wp_unslash( (string) $input['thumbnail_url'] ) ) : '',
			),
			'POST'
		);
	}

	/**
	 * Execute transcoding status through the existing transcoding controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_transcoding_status( $input = null ) {
		$ids = array();

		if ( isset( $input['ids'] ) && is_array( $input['ids'] ) ) {
			$ids = array_values( array_filter( array_map( 'absint', $input['ids'] ) ) );
		}

		return $this->dispatch_transcoding_callback(
			'get_transcoding_status',
			array(
				'ids' => $ids,
			)
		);
	}

	/**
	 * Retranscode selected or all eligible media.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function retranscode_media_ability( $input = null ) {
		$attachment_ids = isset( $input['attachment_ids'] ) && is_array( $input['attachment_ids'] ) ? array_values( array_filter( array_map( 'absint', $input['attachment_ids'] ) ) ) : array();
		$all_media      = ! empty( $input['all_media'] );
		$force          = ! empty( $input['force'] );

		if ( $all_media ) {
			$candidates = $this->dispatch_transcoding_callback(
				'get_media_require_retranscoding',
				array(
					'force' => $force,
				),
				'GET'
			);

			if ( is_wp_error( $candidates ) ) {
				return $candidates;
			}

			$attachment_ids = isset( $candidates['data'] ) && is_array( $candidates['data'] ) ? array_values( array_filter( array_map( 'absint', $candidates['data'] ) ) ) : array();
		}

		$results = array();

		foreach ( $attachment_ids as $attachment_id ) {
			$result = $this->dispatch_transcoding_callback(
				'retranscode_media',
				array(
					'id' => $attachment_id,
				),
				'POST'
			);

			if ( is_wp_error( $result ) ) {
				return $result;
			}

			if ( is_array( $result ) ) {
				$result['attachment_id'] = $attachment_id;
			}

			$results[] = $result;
		}

		return array(
			'attachment_ids'  => $attachment_ids,
			'requested_count' => count( $attachment_ids ),
			'processed_count' => count( $results ),
			'results'         => $results,
			'all_media'       => $all_media,
			'force'           => $force,
		);
	}

	/**
	 * Return current site capabilities and discovery details.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_site_capabilities_ability() {
		$current_user = wp_get_current_user();
		$namespaces   = rest_get_server()->get_namespaces();
		$capabilities = is_array( $current_user->allcaps )
			? array_values( array_keys( array_filter( $current_user->allcaps ) ) )
			: array();

		$site_data = null;
		if ( current_user_can( 'edit_posts' ) ) {
			$site_data = $this->dispatch_site_callback( 'get_site_data', array() );
			if ( is_wp_error( $site_data ) ) {
				$site_data = null;
			}
		}

		return array(
			'authenticated'           => true,
			'user'                    => array(
				'id'           => (int) $current_user->ID,
				'login'        => (string) $current_user->user_login,
				'display_name' => (string) $current_user->display_name,
			),
			'site_url'                => site_url(),
			'godam_detected'          => in_array( 'godam/v1', $namespaces, true ),
			'abilities_api_available' => in_array( 'wp-abilities/v1', $namespaces, true ),
			'role_capabilities'       => $capabilities,
			'available_abilities'     => $this->get_registered_ability_ids(),
			'upload_capability'       => current_user_can( 'upload_files' ),
			'transcoding_available'   => in_array( 'godam/v1', $namespaces, true ) && current_user_can( 'upload_files' ),
			'site_data'               => $site_data,
		);
	}

	/**
	 * Search GoDAM entities.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function search_entities_ability( $input = null ) {
		$entity = isset( $input['entity'] ) ? sanitize_key( $input['entity'] ) : '';
		$query  = isset( $input['query'] ) ? trim( sanitize_text_field( wp_unslash( (string) $input['query'] ) ) ) : '';
		$limit  = isset( $input['limit'] ) ? absint( $input['limit'] ) : 5;

		if ( ! in_array( $entity, array( 'video', 'attachment', 'folder' ), true ) ) {
			return new WP_Error( 'godam_mcp_invalid_entity', __( 'A valid entity type is required.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( '' === $query ) {
			return new WP_Error( 'godam_mcp_invalid_query', __( 'A search query is required.', 'godam' ), array( 'status' => 400 ) );
		}

		$limit      = max( 1, min( 20, $limit ) );
		$candidates = 'folder' === $entity
			? $this->search_folder_candidates( $query )
			: $this->search_media_candidates( $entity, $query, max( 15, $limit * 3 ) );

		usort( $candidates, array( $this, 'compare_search_candidates' ) );

		return array(
			'entity'     => $entity,
			'query'      => $query,
			'candidates' => array_slice( $candidates, 0, $limit ),
		);
	}

	/**
	 * Return transcoded video URLs for GoDAM attachments.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_transcoded_video_urls_ability( $input = null ) {
		$limit = isset( $input['limit'] ) ? absint( $input['limit'] ) : 10;
		$limit = max( 1, min( 50, $limit ) );

		$query = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'post_mime_type' => 'video',
				'post_status'    => 'any',
				'posts_per_page' => $limit,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- Required to find transcoded media.
					'relation' => 'OR',
					array(
						'key'     => 'rtgodam_transcoded_url',
						'compare' => 'EXISTS',
					),
					array(
						'key'     => 'rtgodam_hls_transcoded_url',
						'compare' => 'EXISTS',
					),
				),
			)
		);

		$items = array();
		foreach ( $query->posts as $attachment ) {
			$attachment_id  = (int) $attachment->ID;
			$transcoded_url = (string) get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
			$hls_url        = (string) get_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', true );
			$thumbnail_url  = (string) get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
			$analytics      = get_post_meta( $attachment_id, 'rtgodam_analytics', true );

			if ( '' === $transcoded_url && '' === $hls_url ) {
				continue;
			}

			$items[] = array(
				'attachment_id'      => $attachment_id,
				'title'              => (string) get_the_title( $attachment_id ),
				'source_url'         => (string) wp_get_attachment_url( $attachment_id ),
				'transcoded_url'     => $transcoded_url,
				'hls_url'            => $hls_url,
				'thumbnail_url'      => $thumbnail_url,
				'average_engagement' => $this->get_average_engagement_value( $analytics ),
				'date'               => (string) get_post_field( 'post_date_gmt', $attachment_id ),
			);
		}

		return array(
			'limit'       => $limit,
			'total_found' => count( $items ),
			'items'       => $items,
		);
	}

	/**
	 * Return rising trend videos from analytics.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_rising_trend_videos_ability( $input = null ) {
		$site_url = isset( $input['site_url'] ) ? esc_url_raw( wp_unslash( (string) $input['site_url'] ) ) : '';
		$limit    = isset( $input['limit'] ) ? absint( $input['limit'] ) : 10;
		$limit    = max( 1, min( 25, $limit ) );

		$top_videos = $this->dispatch_analytics_callback(
			'fetch_top_videos',
			array(
				'site_url' => $site_url,
				'page'     => 1,
				'limit'    => max( 20, $limit * 3 ),
			)
		);

		if ( is_wp_error( $top_videos ) ) {
			return $top_videos;
		}

		$candidates = isset( $top_videos['top_videos'] ) && is_array( $top_videos['top_videos'] ) ? $top_videos['top_videos'] : array();
		$items      = array();

		foreach ( $candidates as $video ) {
			$video_id = isset( $video['video_id'] ) ? absint( $video['video_id'] ) : 0;
			if ( $video_id <= 0 ) {
				continue;
			}

			$analytics = $this->dispatch_analytics_callback(
				'fetch_analytics_data',
				array(
					'site_url' => $site_url,
					'video_id' => $video_id,
				)
			);

			if ( is_wp_error( $analytics ) ) {
				continue;
			}

			$payload      = isset( $analytics['data'] ) && is_array( $analytics['data'] ) ? $analytics['data'] : array();
			$views_change = isset( $payload['views_change'] ) ? (float) $payload['views_change'] : 0.0;

			if ( $views_change <= 0 ) {
				continue;
			}

			$items[] = array(
				'video_id'          => $video_id,
				'title'             => (string) ( $video['title'] ?? '' ),
				'plays'             => isset( $payload['plays'] ) ? (int) $payload['plays'] : (int) ( $video['plays'] ?? 0 ),
				'page_load'         => isset( $payload['page_load'] ) ? (int) $payload['page_load'] : 0,
				'play_time'         => isset( $payload['play_time'] ) ? (int) $payload['play_time'] : 0,
				'views_change'      => $views_change,
				'watch_time_change' => isset( $payload['watch_time_change'] ) ? (float) $payload['watch_time_change'] : 0.0,
				'play_rate_change'  => isset( $payload['play_rate_change'] ) ? (float) $payload['play_rate_change'] : 0.0,
				'thumbnail_url'     => $video['thumbnail_url'] ?? null,
			);
		}

		usort(
			$items,
			static function ( $left, $right ) {
				$views_compare = ( $right['views_change'] <=> $left['views_change'] );
				if ( 0 !== $views_compare ) {
					return $views_compare;
				}

				return ( $right['plays'] <=> $left['plays'] );
			}
		);

		return array(
			'site_url'    => $site_url,
			'limit'       => $limit,
			'total_found' => min( count( $items ), $limit ),
			'items'       => array_slice( $items, 0, $limit ),
		);
	}

	/**
	 * Return the normalized media inventory envelope used by the Node MCP server.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_media_inventory_bridge_ability( $input = null ) {
		$page            = isset( $input['page'] ) ? absint( $input['page'] ) : 1;
		$per_page        = isset( $input['perPage'] ) ? absint( $input['perPage'] ) : 20;
		$search          = isset( $input['search'] ) ? sanitize_text_field( wp_unslash( (string) $input['search'] ) ) : '';
		$folder_ids      = isset( $input['folderIds'] ) && is_array( $input['folderIds'] )
			? array_values( array_unique( array_filter( array_map( 'absint', $input['folderIds'] ) ) ) )
			: array();
		$resolved_folder = null;

		if ( ! empty( $input['folderName'] ) ) {
			$resolved_folder = $this->resolve_entity_id(
				'folder',
				0,
				sanitize_text_field( wp_unslash( (string) $input['folderName'] ) ),
				5
			);
			if ( is_wp_error( $resolved_folder ) ) {
				return $resolved_folder;
			}

			$folder_ids[] = (int) $resolved_folder['id'];
			$folder_ids   = array_values( array_unique( $folder_ids ) );
		}

		$folders = $this->dispatch_media_library_callback(
			'get_media_folders',
			array(
				'page'     => max( 1, $page ),
				'per_page' => max( 1, min( 100, $per_page ) ),
				'bookmark' => isset( $input['bookmark'] ) ? (bool) $input['bookmark'] : null,
				'locked'   => isset( $input['locked'] ) ? (bool) $input['locked'] : null,
			)
		);

		if ( is_wp_error( $folders ) ) {
			return $folders;
		}

		$unorganized = $this->dispatch_media_library_callback(
			'get_count_by_category',
			array(
				'folder_id' => 0,
			)
		);

		if ( is_wp_error( $unorganized ) ) {
			return $unorganized;
		}

		$filtered = is_array( $folders ) ? $folders : array();

		if ( ! empty( $folder_ids ) ) {
			$filtered = array_values(
				array_filter(
					$filtered,
					static function ( $folder ) use ( $folder_ids ) {
						return in_array( (int) ( $folder['id'] ?? 0 ), $folder_ids, true );
					}
				)
			);
		}

		if ( '' !== trim( $search ) ) {
			$search_lower = strtolower( $search );
			$filtered     = array_values(
				array_filter(
					$filtered,
					static function ( $folder ) use ( $search_lower ) {
						return false !== strpos( strtolower( (string) ( $folder['name'] ?? '' ) ), $search_lower );
					}
				)
			);
		}

		$prepared_folders = array_map( array( $this, 'normalize_folder_record_exact' ), $filtered );
		$response         = $this->build_bridge_envelope(
			array(
				'total_folders'         => count( $prepared_folders ),
				'empty_folders'         => count(
					array_filter(
						$prepared_folders,
						static function ( $folder ) {
							return 'empty_folder' === $folder['status'];
						}
					)
				),
				'oversized_folders'     => count(
					array_filter(
						$prepared_folders,
						static function ( $folder ) {
							return 'oversized_folder' === $folder['status'];
						}
					)
				),
				'unorganized_indicator' => (int) ( $unorganized['count'] ?? 0 ) > 0,
				'unorganized_count'     => (int) ( $unorganized['count'] ?? 0 ),
				'folders'               => $prepared_folders,
				'page'                  => max( 1, $page ),
				'per_page'              => max( 1, min( 100, $per_page ) ),
			),
			sprintf(
				'Media inventory loaded with %1$d folders and %2$d empty folders.',
				count( $prepared_folders ),
				count(
					array_filter(
						$prepared_folders,
						static function ( $folder ) {
							return 'empty_folder' === $folder['status'];
						}
					)
				)
			),
			array(
				'folders'     => $this->build_source_status(),
				'unorganized' => $this->build_source_status(),
			)
		);

		if ( is_array( $resolved_folder ) ) {
			$response['resolved_folder'] = $resolved_folder;
		}

		return $response;
	}

	/**
	 * Return the normalized transcoding overview envelope used by the Node MCP server.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_transcoding_overview_bridge_ability( $input = null ) {
		$limit         = isset( $input['limit'] ) ? absint( $input['limit'] ) : 50;
		$only_failures = ! empty( $input['onlyFailures'] );
		$statuses      = isset( $input['statuses'] ) && is_array( $input['statuses'] )
			? array_values( array_filter( array_map( 'sanitize_text_field', $input['statuses'] ) ) )
			: array();
		$resolved      = $this->resolve_entity_ids(
			'video',
			isset( $input['attachmentIds'] ) && is_array( $input['attachmentIds'] ) ? $input['attachmentIds'] : array(),
			isset( $input['videoNames'] ) && is_array( $input['videoNames'] ) ? $input['videoNames'] : array(),
			5
		);

		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}

		$not_transcoded = $this->dispatch_transcoding_callback( 'get_media_require_retranscoding', array(), 'GET' );
		if ( is_wp_error( $not_transcoded ) ) {
			return $not_transcoded;
		}

		$base_ids = ! empty( $resolved['ids'] )
			? $resolved['ids']
			: ( isset( $not_transcoded['data'] ) && is_array( $not_transcoded['data'] ) ? array_slice( array_map( 'absint', $not_transcoded['data'] ), 0, max( 1, min( 100, $limit ) ) ) : array() );

		$status_map = $this->dispatch_transcoding_callback( 'get_transcoding_status', array( 'ids' => $base_ids ), 'GET' );
		if ( is_wp_error( $status_map ) ) {
			return $status_map;
		}

		$check_status = $this->dispatch_transcoding_callback( 'check_transcoded_status', array( 'ids' => implode( ',', $base_ids ) ), 'GET' );
		if ( is_wp_error( $check_status ) ) {
			return $check_status;
		}

		$normalized_statuses = array_map( 'strtolower', $statuses );
		$items               = array();

		foreach ( $base_ids as $attachment_id ) {
			$status = $status_map[ (string) $attachment_id ] ?? $status_map[ $attachment_id ] ?? array();
			$item   = array(
				'attachment_id' => (int) $attachment_id,
				'title'         => '',
				'job_id'        => '',
				'status'        => (string) ( $status['status'] ?? 'unknown' ),
				'progress'      => (int) ( $status['progress'] ?? 0 ),
				'message'       => (string) ( $status['message'] ?? '' ),
				'thumbnail'     => isset( $status['thumbnail'] ) && '' !== (string) $status['thumbnail'] ? (string) $status['thumbnail'] : null,
				'error_code'    => $status['error_code'] ?? null,
				'error_msg'     => isset( $status['error_msg'] ) ? (string) $status['error_msg'] : null,
			);

			if ( $only_failures && 'failed' !== $item['status'] ) {
				continue;
			}

			if ( ! empty( $normalized_statuses ) && ! in_array( strtolower( $item['status'] ), $normalized_statuses, true ) ) {
				continue;
			}

			$items[] = $item;
		}

		$total_processing = count(
			array_filter(
				$items,
				static function ( $item ) {
					return 'transcoding' === $item['status'];
				}
			)
		);
		$total_failed     = count(
			array_filter(
				$items,
				static function ( $item ) {
					return 'failed' === $item['status'];
				}
			)
		);

		return array_merge(
			$this->build_bridge_envelope(
				array(
					'total_items'       => count( $items ),
					'total_pending'     => count(
						array_filter(
							$items,
							static function ( $item ) {
								return in_array( $item['status'], array( 'queued', 'downloading', 'downloaded', 'not_started', 'not_transcoding' ), true );
							}
						)
					),
					'total_processing'  => $total_processing,
					'total_transcoded'  => count(
						array_filter(
							$items,
							static function ( $item ) {
								return 'transcoded' === $item['status'];
							}
						)
					),
					'total_failed'      => $total_failed,
					'total_stalled'     => 0,
					'inspected_ids'     => array_values( array_map( 'absint', $base_ids ) ),
					'items'             => array_values( $items ),
					'total_media_count' => (int) ( $not_transcoded['total_media_count'] ?? 0 ),
					'transcode_count'   => (int) ( $check_status['transcode_count'] ?? $not_transcoded['transcode_count'] ?? 0 ),
					'retranscode_count' => (int) ( $check_status['retranscode_count'] ?? $not_transcoded['retranscode_count'] ?? 0 ),
					'storage_exceeded'  => ! empty( $not_transcoded['storage_exceeded'] ),
				),
				sprintf( 'Transcoding overview loaded with %1$d processing items and %2$d failed items.', $total_processing, $total_failed ),
				array(
					'not_transcoded' => $this->build_source_status(),
					'status'         => $this->build_source_status(),
					'check_status'   => $this->build_source_status(),
				)
			),
			array(
				'resolved_videos' => $resolved['resolved'],
			)
		);
	}

	/**
	 * Return the normalized upload or transcode status envelope used by the Node MCP server.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_upload_or_transcode_status_bridge_ability( $input = null ) {
		$resolved_attachment = $this->resolve_entity_id(
			'attachment',
			isset( $input['attachmentId'] ) ? absint( $input['attachmentId'] ) : 0,
			isset( $input['attachmentName'] ) ? sanitize_text_field( wp_unslash( (string) $input['attachmentName'] ) ) : '',
			5
		);

		if ( is_wp_error( $resolved_attachment ) ) {
			return $resolved_attachment;
		}

		return $this->build_upload_or_transcode_status_envelope( (int) $resolved_attachment['id'] );
	}

	/**
	 * Return the normalized upload-to-media envelope used by the Node MCP server.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function upload_video_to_media_bridge_ability( $input = null ) {
		return $this->execute_upload_video_bridge( $input, false );
	}

	/**
	 * Return the normalized upload-and-track-transcode envelope used by the Node MCP server.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function upload_and_track_transcode_bridge_ability( $input = null ) {
		return $this->execute_upload_video_bridge( $input, true );
	}

	/**
	 * Execute dashboard metrics through the existing analytics controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_dashboard_metrics( $input = null ) {
		return $this->dispatch_analytics_callback(
			'fetch_dashboard_metrics',
			array(
				'site_url' => $input['site_url'] ?? '',
			)
		);
	}

	/**
	 * Execute dashboard history through the existing analytics controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_dashboard_history( $input = null ) {
		return $this->dispatch_analytics_callback(
			'fetch_dashboard_history',
			array(
				'site_url' => $input['site_url'] ?? '',
				'days'     => isset( $input['days'] ) ? absint( $input['days'] ) : null,
			)
		);
	}

	/**
	 * Execute top videos through the existing analytics controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_top_videos( $input = null ) {
		return $this->dispatch_analytics_callback(
			'fetch_top_videos',
			array(
				'site_url' => $input['site_url'] ?? '',
				'page'     => isset( $input['page'] ) ? absint( $input['page'] ) : 1,
				'limit'    => isset( $input['limit'] ) ? absint( $input['limit'] ) : 10,
			)
		);
	}

	/**
	 * Execute video analytics summary through the existing analytics controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_video_analytics_summary( $input = null ) {
		return $this->dispatch_analytics_callback(
			'fetch_analytics_data',
			array(
				'site_url' => $input['site_url'] ?? '',
				'video_id' => isset( $input['video_id'] ) ? absint( $input['video_id'] ) : 0,
			)
		);
	}

	/**
	 * Execute video analytics history through the existing analytics controller.
	 *
	 * @param array<string, mixed>|null $input Ability input.
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_video_analytics_history( $input = null ) {
		return $this->dispatch_analytics_callback(
			'fetch_analytics_history',
			array(
				'site_url' => $input['site_url'] ?? '',
				'video_id' => isset( $input['video_id'] ) ? absint( $input['video_id'] ) : 0,
				'days'     => isset( $input['days'] ) ? absint( $input['days'] ) : null,
			)
		);
	}

	/**
	 * Dispatch an input payload through the existing analytics REST controller.
	 *
	 * @param string               $method Analytics controller method.
	 * @param array<string, mixed> $params Request params.
	 * @return array<string, mixed>|WP_Error
	 */
}
