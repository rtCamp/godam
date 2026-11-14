<?php
/**
 * Abilities for organising the GoDAM library.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Media_Library\Media_Folder_Utils;
use RTGODAM\Inc\Taxonomies\Media_Folders;

/**
 * Class Library_Abilities
 *
 * The write abilities here go through the same REST routes the GoDAM media
 * library UI uses. That keeps the protections those routes carry — the
 * per-attachment edit check and the locked-folder guard on moves — rather than
 * re-implementing them.
 *
 * @since n.e.x.t
 */
class Library_Abilities extends Ability_Group {

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/list-folders',
			array(
				'label'               => __( 'List folders', 'godam' ),
				'description'         => __( 'List every folder in the GoDAM library with its parent and how many media items it holds. Folder IDs are used by godam/list-media and godam/move-media-to-folder.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'parent_id' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => __( 'Only list folders directly inside this folder. 0 lists top-level folders. Omit to list all.', 'godam' ),
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'count'   => array( 'type' => 'integer' ),
						'folders' => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'list_folders' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);

		$this->add(
			'godam/create-folder',
			array(
				'label'               => __( 'Create folder', 'godam' ),
				'description'         => __( 'Create a folder in the GoDAM library, optionally inside another folder.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'name'      => array(
							'type'      => 'string',
							'minLength' => 1,
						),
						'parent_id' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'default'     => 0,
							'description' => __( 'Parent folder ID. 0 creates a top-level folder.', 'godam' ),
						),
					),
					'required'   => array( 'name' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'create_folder' ),
				'permission_callback' => array( $this, 'can_manage_folders' ),
			),
			true
		);

		$this->add(
			'godam/move-media-to-folder',
			array(
				'label'               => __( 'Move media to a folder', 'godam' ),
				'description'         => __( 'Move one or more media items into a folder, or out of their folder with folder_id 0. Media in a locked folder cannot be moved out.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'media_ids' => array(
							'type'     => 'array',
							'items'    => array(
								'type'    => 'integer',
								'minimum' => 1,
							),
							'minItems' => 1,
						),
						'folder_id' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => __( 'Destination folder ID. 0 removes the media from its folder.', 'godam' ),
						),
					),
					'required'   => array( 'media_ids', 'folder_id' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'move_media_to_folder' ),
				'permission_callback' => array( $this, 'can_assign_folders' ),
				'meta'                => array(
					'annotations' => array( 'idempotent' => true ),
				),
			),
			true
		);

		$this->add(
			'godam/update-media-details',
			array(
				'label'               => __( 'Update media details', 'godam' ),
				'description'         => __( 'Change a media item\'s title, caption, description or alt text. Only the fields given are changed.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'id'          => array(
							'type'    => 'integer',
							'minimum' => 1,
						),
						'title'       => array( 'type' => 'string' ),
						'caption'     => array( 'type' => 'string' ),
						'description' => array( 'type' => 'string' ),
						'alt_text'    => array( 'type' => 'string' ),
					),
					'required'   => array( 'id' ),
				),
				'output_schema'       => $this->media_schema(),
				'execute_callback'    => array( $this, 'update_media_details' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
				'meta'                => array(
					'annotations' => array( 'idempotent' => false ),
				),
			),
			true
		);

		$this->add(
			'godam/import-media-from-url',
			array(
				'label'               => __( 'Import media from a URL', 'godam' ),
				'description'         => __( 'Download a file from a public URL into the GoDAM library, optionally straight into a folder. A video or audio file is then sent to GoDAM for transcoding as with any upload, which takes a few minutes; check progress with godam/get-media.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'url'       => array(
							'type'        => 'string',
							'format'      => 'uri',
							'description' => __( 'Public http(s) URL of the file. Its type must be one the site allows uploading.', 'godam' ),
						),
						'title'     => array(
							'type'        => 'string',
							'description' => __( 'Title for the media item. Defaults to the file name.', 'godam' ),
						),
						'folder_id' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => __( 'Folder to put the media in, from godam/list-folders. 0 or omitted leaves it outside any folder.', 'godam' ),
						),
					),
					'required'   => array( 'url' ),
				),
				'output_schema'       => $this->media_schema(),
				'execute_callback'    => array( $this, 'import_media_from_url' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			),
			true
		);
		$this->add(
			'godam/list-central-media',
			array(
				'label'               => __( 'List media on GoDAM Central', 'godam' ),
				'description'         => __( 'List the media stored in this site\'s GoDAM Central account, newest first, 20 per page. These are not in the site\'s library until added with godam/add-central-media. Each item says whether it is already on the site.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'type'   => array(
							'type'        => 'string',
							'enum'        => array( 'video', 'audio', 'image', 'document' ),
							'default'     => 'video',
							'description' => __( 'Kind of media to list.', 'godam' ),
						),
						'search' => array(
							'type'        => 'string',
							'maxLength'   => 200,
							'description' => __( 'Only list media whose name matches this text.', 'godam' ),
						),
						'page'   => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'default'     => 1,
							'description' => __( 'Page of results.', 'godam' ),
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'items'    => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
						'page'     => array( 'type' => 'integer' ),
						'total'    => array( 'type' => 'integer' ),
						'has_more' => array( 'type' => 'boolean' ),
					),
				),
				'execute_callback'    => array( $this, 'list_central_media' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
			)
		);

		$this->add(
			'godam/add-central-media',
			array(
				'label'               => __( 'Add media from GoDAM Central', 'godam' ),
				'description'         => __( 'Add one media item from this site\'s GoDAM Central account to the site\'s library, optionally straight into a folder. The file stays on GoDAM Central and is already transcoded, so it can be transcribed. Adding the same item again returns the existing one. Pass the item\'s type and title from godam/list-central-media too: the item is then found in one request instead of a read of the whole account.', 'godam' ),
				'category'            => 'godam-library',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'central_id' => array(
							'type'        => 'string',
							'pattern'     => '^[A-Za-z0-9_-]{1,64}$',
							'description' => __( 'The item\'s central_id from godam/list-central-media.', 'godam' ),
						),
						'type'       => array(
							'type'        => 'string',
							'enum'        => array_keys( self::CENTRAL_MEDIA_TYPES ),
							'description' => __( 'The item\'s kind, as listed by godam/list-central-media. Optional, but it makes the item quicker to find.', 'godam' ),
						),
						'title'      => array(
							'type'        => 'string',
							'maxLength'   => 200,
							'description' => __( 'The item\'s title from godam/list-central-media. Optional, but it makes the item quicker to find.', 'godam' ),
						),
						'folder_id'  => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'description' => __( 'Folder to put the media in, from godam/list-folders. 0 or omitted leaves it outside any folder.', 'godam' ),
						),
					),
					'required'   => array( 'central_id' ),
				),
				'output_schema'       => $this->media_schema(),
				'execute_callback'    => array( $this, 'add_central_media' ),
				'permission_callback' => array( $this, 'can_browse_library' ),
				'meta'                => array(
					'annotations' => array( 'idempotent' => true ),
				),
			),
			true
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
	 * Permission: the user can create folders.
	 *
	 * Reads the capability from the taxonomy itself, so it follows whatever
	 * the folder taxonomy is registered with.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_manage_folders() {
		$taxonomy = get_taxonomy( Media_Folders::SLUG );

		return $taxonomy && current_user_can( $taxonomy->cap->edit_terms ); // phpcs:ignore WordPress.WP.Capabilities.Undetermined -- the folder taxonomy's own capability, as registered.
	}

	/**
	 * Permission: the user can assign folders.
	 *
	 * Matches the assign-folder route; that route then checks each attachment.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_assign_folders() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Executes godam/list-folders.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function list_folders( $input = array() ) {
		$args = array(
			'taxonomy'   => Media_Folders::SLUG,
			'hide_empty' => false,
			'orderby'    => 'name',
		);

		if ( isset( $input['parent_id'] ) ) {
			$args['parent'] = absint( $input['parent_id'] );
		}

		$terms = get_terms( $args );

		if ( is_wp_error( $terms ) ) {
			return $terms;
		}

		$utils   = Media_Folder_Utils::get_instance();
		$folders = array();

		foreach ( $terms as $term ) {
			$folders[] = array(
				'id'          => (int) $term->term_id,
				'name'        => $term->name,
				'parent_id'   => (int) $term->parent,
				// The term's own count skips unattached media, which is most of a library.
				'media_count' => (int) $utils->get_attachment_count( $term->term_id ),
				'locked'      => (bool) $utils->is_folder_locked( $term->term_id ),
			);
		}

		return array(
			'count'   => count( $folders ),
			'folders' => $folders,
		);
	}

	/**
	 * Executes godam/create-folder through the folder taxonomy's REST route.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function create_folder( $input = array() ) {
		$taxonomy  = get_taxonomy( Media_Folders::SLUG );
		$rest_base = ( $taxonomy && ! empty( $taxonomy->rest_base ) ) ? $taxonomy->rest_base : Media_Folders::SLUG;
		$params    = array( 'name' => sanitize_text_field( $input['name'] ?? '' ) );

		if ( ! empty( $input['parent_id'] ) ) {
			$params['parent'] = absint( $input['parent_id'] );
		}

		$term = $this->rest( 'POST', '/wp/v2/' . $rest_base, $params );

		if ( is_wp_error( $term ) ) {
			return $term;
		}

		return array(
			'id'        => (int) $term['id'],
			'name'      => $term['name'],
			'parent_id' => (int) $term['parent'],
		);
	}

	/**
	 * Executes godam/move-media-to-folder through the media library route.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function move_media_to_folder( $input = array() ) {
		$media_ids = array_map( 'absint', (array) ( $input['media_ids'] ?? array() ) );
		$folder_id = absint( $input['folder_id'] ?? 0 );

		$result = $this->rest(
			'POST',
			'/godam/v1/media-library/assign-folder',
			array(
				'attachment_ids' => $media_ids,
				'folder_term_id' => $folder_id,
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'moved'     => $media_ids,
			'folder_id' => $folder_id,
		);
	}

	/**
	 * Executes godam/update-media-details through the core media route.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function update_media_details( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$params = array_intersect_key(
			(array) $input,
			array_flip( array( 'title', 'caption', 'description', 'alt_text' ) )
		);

		if ( empty( $params ) ) {
			return new \WP_Error( 'rtgodam_nothing_to_update', __( 'Give at least one of title, caption, description or alt_text.', 'godam' ) );
		}

		$updated = $this->rest( 'POST', '/wp/v2/media/' . $post->ID, $params );

		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return $this->shape_media( $this->attachment_post( $post->ID ) );
	}

	/**
	 * Executes godam/import-media-from-url.
	 *
	 * Uses core's sideload, the same path as "Upload from URL" tools: the
	 * download refuses private and local addresses, and the file must be a type
	 * the site allows. GoDAM's upload hooks then pick the attachment up like any
	 * other upload.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function import_media_from_url( $input = array() ) {
		$url = esc_url_raw( $input['url'] ?? '', array( 'http', 'https' ) );

		if ( ! $url || ! wp_http_validate_url( $url ) ) {
			return new \WP_Error( 'rtgodam_invalid_url', __( 'Give a public http or https URL.', 'godam' ), array( 'status' => 400 ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		// The same size limit as an upload in the Media Library. The download
		// stops one byte past it, so a huge file cannot fill the disk.
		$max_size = (int) wp_max_upload_size();

		// Zero means the site takes no uploads right now: the storage quota is
		// used up, or uploads are switched off. Refuse before downloading.
		if ( $max_size <= 0 ) {
			return new \WP_Error(
				'rest_upload_limited_space',
				__( 'This site cannot take new uploads right now: its upload size limit is zero or its storage space is used up. Delete files to free up space, or ask a site administrator to raise the upload limit.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		$limit_download = static function ( $args ) use ( $max_size ) {
			$args['limit_response_size'] = $max_size + 1;

			return $args;
		};

		add_filter( 'http_request_args', $limit_download ); // phpcs:ignore WordPressVIPMinimum.Hooks.RestrictedHooks.http_request_args -- sets the response size limit, not the timeout.
		$tmp_file = download_url( $url );
		remove_filter( 'http_request_args', $limit_download );

		if ( is_wp_error( $tmp_file ) ) {
			return $tmp_file;
		}

		if ( (int) filesize( $tmp_file ) > $max_size ) {
			wp_delete_file( $tmp_file );

			return new \WP_Error(
				'rest_upload_file_too_big',
				/* translators: %s: maximum allowed file size, e.g. "64 MB". */
				sprintf( __( 'This file is too big to import. Files must be %s or smaller, the same limit as an upload in the Media Library. Use a smaller file, or ask a site administrator to raise the site\'s maximum upload size.', 'godam' ), size_format( $max_size ) ),
				array( 'status' => 413 )
			);
		}

		$name = sanitize_file_name( wp_basename( (string) wp_parse_url( $url, PHP_URL_PATH ) ) );

		/*
		 * A download link often has no extension in its path (/get?id=42, /download/12345), and
		 * core's sideload refuses a file with no extension as a disallowed type. Core's
		 * download_url() names the temp file from the response's Content-Disposition or
		 * Content-Type, so take the extension from there. A response with neither still gets
		 * core's file-type error, as before.
		 */
		if ( '' === pathinfo( $name, PATHINFO_EXTENSION ) ) {
			$extension = pathinfo( $tmp_file, PATHINFO_EXTENSION );

			if ( '' !== $extension && 'tmp' !== $extension ) {
				$name = sanitize_file_name( ( '' !== $name ? $name : 'import' ) . '.' . $extension );
			}
		}

		$file = array(
			'name'     => $name,
			'tmp_name' => $tmp_file,
		);

		$too_big = $this->check_upload_limits( $tmp_file );

		if ( is_wp_error( $too_big ) ) {
			wp_delete_file( $tmp_file );
			return $too_big;
		}

		$post_data = array();

		if ( ! empty( $input['title'] ) ) {
			$post_data['post_title'] = sanitize_text_field( $input['title'] );
		}

		$attachment_id = media_handle_sideload( $file, 0, null, $post_data );

		if ( is_wp_error( $attachment_id ) ) {
			wp_delete_file( $tmp_file );
			return $attachment_id;
		}

		if ( ! empty( $input['folder_id'] ) ) {
			$moved = $this->move_media_to_folder(
				array(
					'media_ids' => array( $attachment_id ),
					'folder_id' => $input['folder_id'],
				)
			);

			if ( is_wp_error( $moved ) ) {
				return new \WP_Error(
					$moved->get_error_code(),
					/* translators: 1: attachment ID, 2: reason the move failed. */
					sprintf( __( 'Imported as media ID %1$d, but it could not be put in the folder: %2$s Use godam/move-media-to-folder to move it.', 'godam' ), $attachment_id, $moved->get_error_message() ),
					array( 'status' => 400 )
				);
			}
		}

		return $this->shape_media( $this->attachment_post( $attachment_id ) );
	}

	/**
	 * Applies the limits a normal upload gets on multisite: the network's
	 * upload size limit, the site's storage quota and the user's quota.
	 *
	 * Sideloading fires `wp_handle_sideload_prefilter`, but core runs these
	 * checks only for uploads, so without this an import could go past them.
	 * The checks and error codes match the REST media route's.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $tmp_file Path of the downloaded file.
	 *
	 * @return true|\WP_Error
	 */
	private function check_upload_limits( $tmp_file ) {
		if ( ! is_multisite() || get_site_option( 'upload_space_check_disabled' ) ) {
			return true;
		}

		$size = (int) filesize( $tmp_file );

		if ( $size > get_upload_space_available() ) {
			/* translators: %s: required disk space in kilobytes. */
			return new \WP_Error( 'rest_upload_limited_space', sprintf( __( 'Not enough space to import this file. %s KB needed. Free up space by deleting unused media in the Media Library, or ask a network administrator to raise the site\'s storage limit.', 'godam' ), number_format( ( $size - get_upload_space_available() ) / KB_IN_BYTES ) ), array( 'status' => 400 ) );
		}

		if ( $size > KB_IN_BYTES * (int) get_site_option( 'fileupload_maxk', 1500 ) ) {
			/* translators: %s: maximum allowed file size in kilobytes. */
			return new \WP_Error( 'rest_upload_file_too_big', sprintf( __( 'This file is too big. Files must be less than %s KB in size. Use a smaller file, or ask a network administrator to raise the limit in Network Admin > Settings > Network Settings.', 'godam' ), get_site_option( 'fileupload_maxk', 1500 ) ), array( 'status' => 400 ) );
		}

		if ( ! function_exists( 'upload_is_user_over_quota' ) ) {
			require_once ABSPATH . 'wp-admin/includes/ms.php';
		}

		if ( upload_is_user_over_quota( false ) ) {
			return new \WP_Error( 'rest_upload_user_quota_exceeded', __( 'You have used your space quota. Please delete files before uploading.', 'godam' ), array( 'status' => 400 ) );
		}

		return true;
	}

	/**
	 * Job type GoDAM Central's file list takes for each kind of media.
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string,string>
	 */
	const CENTRAL_MEDIA_TYPES = array(
		'video'    => 'video',
		'audio'    => 'audio',
		'image'    => 'image',
		'document' => 'application/pdf',
	);

	/**
	 * Fetches one page of this site's GoDAM Central media.
	 *
	 * Goes through the route the Media Library's GoDAM tab uses, which sends the
	 * site's API key to GoDAM Central. The key is never part of the result.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $type     One of the CENTRAL_MEDIA_TYPES keys.
	 * @param int    $page     Page number.
	 * @param int    $per_page Items per page.
	 * @param string $search   Optional search text.
	 *
	 * @return array|\WP_Error The route's data, with `data` holding the items.
	 */
	private function central_media_page( $type, $page, $per_page, $search = '' ) {
		$params = array(
			'type'     => self::CENTRAL_MEDIA_TYPES[ $type ] ?? 'video',
			'page'     => max( 1, absint( $page ) ),
			'per_page' => max( 1, absint( $per_page ) ),
		);

		if ( '' !== $search ) {
			$params['search'] = $search;
		}

		$result = $this->rest( 'GET', '/godam/v1/media-library/get-godam-cmm-files', $params );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( ! is_array( $result ) || empty( $result['success'] ) || ! isset( $result['data'] ) || ! is_array( $result['data'] ) ) {
			return new \WP_Error(
				'rtgodam_central_unavailable',
				__( 'GoDAM Central did not return the media list. Try again in a moment. If it keeps failing, the site owner can contact GoDAM support at https://app.godam.io/helpdesk.', 'godam' ),
				array( 'status' => 502 )
			);
		}

		return $result;
	}

	/**
	 * Finds the site's media item made from a GoDAM Central item, if any.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $central_id GoDAM Central item ID.
	 *
	 * @return int Attachment ID, or 0.
	 */
	private function media_id_for_central_id( $central_id ) {
		do_action( 'rtgodam_before_attachment_lookup' );

		$ids = get_posts( // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- a single-ID lookup run on request by a signed-in user, not on a front-end page.
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => '_godam_original_id', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- the only way to match a Central item.
				'meta_value'     => $central_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			)
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		return $ids ? (int) $ids[0] : 0;
	}

	/**
	 * Fetches one page of GoDAM Central media, trying once more if it fails.
	 *
	 * GoDAM Central's list sometimes fails for a moment under load. One more
	 * try saves the agent a failed tool call and a retry of its own.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $type     One of the CENTRAL_MEDIA_TYPES keys.
	 * @param int    $page     Page number.
	 * @param int    $per_page Items per page.
	 * @param string $search   Optional text to match against the name.
	 *
	 * @return array|\WP_Error
	 */
	private function central_media_page_with_retry( $type, $page, $per_page, $search = '' ) {
		$result = $this->central_media_page( $type, $page, $per_page, $search );

		if ( is_wp_error( $result ) ) {
			$result = $this->central_media_page( $type, $page, $per_page, $search );
		}

		return $result;
	}

	/**
	 * Finds one item in this site's GoDAM Central account by its ID.
	 *
	 * GoDAM Central has no lookup by ID for a site key. With the item's type and
	 * title the search finds it in one request. Without them, or when the search
	 * misses, the whole list is read, 100 at a time, the given type first.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $central_id The item's ID on GoDAM Central.
	 * @param string $type       Optional CENTRAL_MEDIA_TYPES key to look in first.
	 * @param string $title      Optional title to search for.
	 *
	 * @return array|null|\WP_Error The item, null when it is not in the account, or the error from GoDAM Central.
	 */
	private function find_central_item( $central_id, $type = '', $title = '' ) {
		$types = array_keys( self::CENTRAL_MEDIA_TYPES );

		if ( isset( self::CENTRAL_MEDIA_TYPES[ $type ] ) ) {
			$types = array_merge( array( $type ), array_diff( $types, array( $type ) ) );
		} else {
			$type = '';
		}

		$pick = static function ( $result ) use ( $central_id ) {
			foreach ( $result['data'] as $item ) {
				if ( is_array( $item ) && isset( $item['id'] ) && (string) $item['id'] === $central_id ) {
					return $item;
				}
			}

			return null;
		};

		// The quick way: search by title, in the given type or in each one.
		if ( '' !== $title ) {
			foreach ( '' !== $type ? array( $type ) : $types as $search_type ) {
				$result = $this->central_media_page_with_retry( $search_type, 1, 100, $title );

				// A failed search is not final: the full read below gets its own tries.
				if ( is_wp_error( $result ) ) {
					continue;
				}

				$found = $pick( $result );

				if ( null !== $found ) {
					return $found;
				}
			}
		}

		foreach ( $types as $list_type ) {
			for ( $page = 1; $page <= 5; $page++ ) {
				$result = $this->central_media_page_with_retry( $list_type, $page, 100 );

				if ( is_wp_error( $result ) ) {
					return $result;
				}

				$found = $pick( $result );

				if ( null !== $found ) {
					return $found;
				}

				if ( empty( $result['has_more'] ) ) {
					break;
				}
			}
		}

		return null;
	}

	/**
	 * Executes godam/list-central-media.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function list_central_media( $input = array() ) {
		$type   = isset( $input['type'] ) && isset( self::CENTRAL_MEDIA_TYPES[ $input['type'] ] ) ? $input['type'] : 'video';
		$search = sanitize_text_field( $input['search'] ?? '' );
		$result = $this->central_media_page( $type, $input['page'] ?? 1, 20, $search );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$items = array();

		foreach ( $result['data'] as $item ) {
			if ( ! is_array( $item ) || empty( $item['id'] ) ) {
				continue;
			}

			$central_id = sanitize_text_field( (string) $item['id'] );
			$media_id   = $this->media_id_for_central_id( $central_id );

			$items[] = array(
				'central_id'       => $central_id,
				'title'            => sanitize_text_field( (string) ( $item['title'] ?? '' ) ),
				'type'             => sanitize_key( (string) ( $item['type'] ?? '' ) ),
				'status'           => sanitize_text_field( (string) ( $item['status'] ?? '' ) ),
				'duration_seconds' => isset( $item['duration'] ) ? (int) round( (float) $item['duration'] ) : null,
				'size'             => sanitize_text_field( (string) ( $item['filesizeHumanReadable'] ?? '' ) ),
				'on_site_media_id' => $media_id ? $media_id : null,
			);
		}

		return array(
			'items'    => $items,
			'page'     => (int) ( $result['current_page'] ?? 1 ),
			'total'    => (int) ( $result['total_count'] ?? count( $items ) ),
			'has_more' => ! empty( $result['has_more'] ),
		);
	}

	/**
	 * Executes godam/add-central-media.
	 *
	 * The agent gives only the item's ID. The item's address, type and stream
	 * addresses are read from GoDAM Central with the site's own key, so a
	 * caller cannot make a library entry that points at an address of its
	 * choosing.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function add_central_media( $input = array() ) {
		$central_id = (string) ( $input['central_id'] ?? '' );

		if ( ! preg_match( '/^[A-Za-z0-9_-]{1,64}$/', $central_id ) ) {
			return new \WP_Error( 'rtgodam_invalid_central_id', __( 'Give the central_id of an item from godam/list-central-media.', 'godam' ), array( 'status' => 400 ) );
		}

		$found = $this->find_central_item( $central_id, (string) ( $input['type'] ?? '' ), sanitize_text_field( (string) ( $input['title'] ?? '' ) ) );

		if ( is_wp_error( $found ) ) {
			return $found;
		}

		if ( null === $found ) {
			return new \WP_Error(
				'rtgodam_central_media_not_found',
				__( 'No media with that central_id is in this site\'s GoDAM Central account. Use godam/list-central-media to find it.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		if ( empty( $found['url'] ) ) {
			return new \WP_Error(
				'rtgodam_central_media_not_ready',
				__( 'GoDAM Central is still processing this media. Check godam/list-central-media again in a few minutes and add it once its status is Transcoded.', 'godam' ),
				array( 'status' => 409 )
			);
		}

		$request = new \WP_REST_Request( 'POST', '/godam/v1/media-library/create-media-entry' );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( wp_json_encode( $found ) );

		$response = rest_do_request( $request );
		$data     = rest_get_server()->response_to_data( $response, false );

		if ( $response->is_error() || empty( $data['attachment']['id'] ) ) {
			$reason = is_array( $data ) ? ( $data['message'] ?? ( $data['error'] ?? '' ) ) : '';

			return new \WP_Error(
				'rtgodam_central_media_not_added',
				/* translators: %s: reason the media could not be added. */
				sprintf( __( 'The media could not be added to the library: %s', 'godam' ), sanitize_text_field( (string) $reason ) ),
				array( 'status' => $response->is_error() ? $response->get_status() : 500 )
			);
		}

		$attachment_id = absint( $data['attachment']['id'] );

		if ( ! empty( $input['folder_id'] ) ) {
			$moved = $this->move_media_to_folder(
				array(
					'media_ids' => array( $attachment_id ),
					'folder_id' => $input['folder_id'],
				)
			);

			if ( is_wp_error( $moved ) ) {
				return new \WP_Error(
					$moved->get_error_code(),
					/* translators: 1: attachment ID, 2: reason the move failed. */
					sprintf( __( 'Added as media ID %1$d, but it could not be put in the folder: %2$s', 'godam' ), $attachment_id, $moved->get_error_message() ),
					array( 'status' => 400 )
				);
			}
		}

		return $this->shape_media( $this->attachment_post( $attachment_id ) );
	}
}
