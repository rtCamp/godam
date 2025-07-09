<?php
/**
 * REST API class for Media Library Pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use RTGODAM\Inc\Media_Library\Media_Folder_Create_Zip;
use RTGODAM\Inc\Media_Library_Ajax;

defined( 'ABSPATH' ) || exit;

/**
 * Class Media_Library
 */
class Media_Library extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'media-library';

	/**
	 * Register custom REST API routes for Settings Pages.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/assign-folder',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'assign_images_to_folder' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'attachment_ids' => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'integer' ),
							'description' => __( 'Array of attachment IDs to associate.', 'godam' ),
						),
						'folder_term_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => __( 'ID of the folder term to associate with the attachments.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-exif-data',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_exif_data' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'attachment_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => __( 'Attachment ID to get EXIF data for.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/set-video-thumbnail',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'set_video_thumbnail' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'attachment_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => __( 'Attachment ID to set video thumbnail for.', 'godam' ),
						),
						'thumbnail_url' => array(
							'required'    => true,
							'type'        => 'string',
							'description' => __( 'Attachment URL to set as the thumbnail.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-video-thumbnail',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_video_thumbnails' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'attachment_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => __( 'Attachment ID to get video thumbnail for.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/download-folder/(?P<folder_id>\d+)',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'download_folder' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(
						'folder_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => __( 'ID of the folder to create a ZIP file for.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/bulk-delete-folders',
				'args'      => array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'bulk_delete_folders' ),
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'args'                => array(
						'folder_ids' => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'integer' ),
							'description' => __( 'Array of folder IDs to delete.', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/bulk-lock-folders',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'bulk_update_folder_lock' ),
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'args'                => array(
						'folder_ids'    => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'integer' ),
							'description' => __( 'Array of folder IDs to update lock status for.', 'godam' ),
						),
						'locked_status' => array(
							'required'    => true,
							'type'        => 'boolean',
							'description' => __( 'The desired lock status (true for locked, false for unlocked).', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/bulk-bookmark-folders',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'bulk_update_folder_bookmark' ),
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'args'                => array(
						'folder_ids'      => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'integer' ),
							'description' => __( 'Array of folder IDs to update bookmark status for.', 'godam' ),
						),
						'bookmark_status' => array(
							'required'    => true,
							'type'        => 'boolean',
							'description' => __( 'The desired bookmark status (true for bookmarked, false for unbookmarked).', 'godam' ),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-godam-cmm-files',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_godam_cmm_files' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
					'args'                => array(),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/create-media-entry',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_media_entry' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/attachment-by-id/(?P<id>[a-zA-Z0-9_-]+)',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_attachment_by_id' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_posts' );
					},
				),
			),
		);
	}

	/**
	 * Verify the API key using external API.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function assign_images_to_folder( $request ) {
		$attachment_ids = $request->get_param( 'attachment_ids' );
		$folder_term_id = $request->get_param( 'folder_term_id' );

		// if folder id is 0, remove the folder from the attachments.
		if ( 0 === $folder_term_id ) {
			foreach ( $attachment_ids as $attachment_id ) {

				$return = $this->remove_all_terms_from_id( $attachment_id, 'media-folder' );

				if ( is_wp_error( $return ) ) {
					return new \WP_Error( 'term_assignment_failed', 'Failed to remove folder from the attachments.', array( 'status' => 500 ) );
				}
			}

			return rest_ensure_response(
				array(
					'success' => true,
					'message' => 'Attachments successfully removed from the folder.',
				)
			);
		}

		$term = get_term( $folder_term_id, 'media-folder' );

		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'invalid_term', 'Invalid folder term ID.', array( 'status' => 400 ) );
		}

		foreach ( $attachment_ids as $attachment_id ) {
			if ( get_post_type( $attachment_id ) !== 'attachment' ) {
				return new \WP_Error( 'invalid_attachment', 'Invalid attachment ID.', array( 'status' => 400 ) );
			}

			$return = wp_set_object_terms( $attachment_id, $folder_term_id, 'media-folder' );

			if ( is_wp_error( $return ) ) {
				return new \WP_Error( 'term_assignment_failed', 'Failed to associate attachments with the folder.', array( 'status' => 500 ) );
			}
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'Attachments successfully associated with the folder.',
			)
		);
	}

	/**
	 * Remove all terms of a specific taxonomy for a given post ID.
	 *
	 * @param int    $post_id   The ID of the post or object.
	 * @param string $taxonomy  The taxonomy to remove terms from.
	 *
	 * @return bool|WP_ERROR True if terms are successfully removed, WP_Error otherwise.
	 */
	private function remove_all_terms_from_id( $post_id, $taxonomy ) {
		if ( ! taxonomy_exists( $taxonomy ) ) {
			return new \WP_Error( 'invalid_taxonomy', 'Invalid taxonomy.', array( 'status' => 400 ) );
		}

		// Get all terms associated with the post ID for the taxonomy.
		$terms = wp_get_object_terms( $post_id, $taxonomy, array( 'fields' => 'ids' ) );

		if ( is_wp_error( $terms ) ) {
			return $terms;
		}

		return wp_remove_object_terms( $post_id, $terms, $taxonomy );
	}

	/**
	 * Get EXIF data.
	 *
	 * Get the EXIF data for the attachment ID.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function get_exif_data( $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );

		// Get the file path of the image.
		$file_path = get_attached_file( $attachment_id );

		if ( ! file_exists( $file_path ) ) {
			return new \WP_Error( 'image_not_found', 'Image file not found.', array( 'status' => 404 ) );
		}

		// Read EXIF data from the image.
		$exif_data = exif_read_data( $file_path, 0, true );

		if ( false === $exif_data ) {
			return new \WP_Error( 'exif_data_not_found', 'No EXIF data found.', array( 'status' => 204 ) );
		}

		// Extract and filter the desired EXIF data fields.
		$filtered_data = array();

		if ( isset( $exif_data['EXIF']['DateTimeOriginal'] ) ) {
			$filtered_data['DateTimeOriginal'] = $exif_data['EXIF']['DateTimeOriginal'];
		}

		if ( isset( $exif_data['IFD0']['Make'] ) ) {
			$filtered_data['Make'] = $exif_data['IFD0']['Make'];
		}

		if ( isset( $exif_data['IFD0']['Model'] ) ) {
			$filtered_data['Model'] = $exif_data['IFD0']['Model'];
		}

		if ( isset( $exif_data['EXIF']['ExposureTime'] ) ) {
			$filtered_data['ExposureTime'] = $exif_data['EXIF']['ExposureTime'];
		}

		if ( isset( $exif_data['EXIF']['FNumber'] ) ) {
			$filtered_data['FNumber'] = $this->format_fnumber( $exif_data['EXIF']['FNumber'] );
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $filtered_data,
			)
		);
	}

	/**
	 * Format FNumber value.
	 *
	 * @param string|int $fnumber The FNumber value.
	 * @return string Formatted FNumber value.
	 */
	private function format_fnumber( $fnumber ) {
		if ( is_string( $fnumber ) && strpos( $fnumber, '/' ) !== false ) {
			list( $numerator, $denominator ) = explode( '/', $fnumber );
			if ( is_numeric( $numerator ) && is_numeric( $denominator ) && 0 !== $denominator ) {
				return 'f/' . round( $numerator / $denominator, 1 );
			}
		}

		return $fnumber;
	}

	/**
	 * Get video thumbnails.
	 *
	 * Get the video thumbnail for the attachment ID.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function get_video_thumbnails( $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );

		// Check if attachment is of type video.
		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! preg_match( '/^video\//', $mime_type ) ) {
			return new \WP_Error( 'invalid_attachment', 'Attachment is not a video.', array( 'status' => 404 ) );
		}

		$thumbnail_array = get_post_meta( $attachment_id, 'rtgodam_media_thumbnails', true );

		if ( ! is_array( $thumbnail_array ) ) {
			return new \WP_Error( 'thumbnails_not_found', 'No thumbnails found.', array( 'status' => 204 ) );
		}

		if ( function_exists( 'wp_get_upload_dir' ) ) {
			$uploads = wp_get_upload_dir();
		} else {
			$uploads = wp_upload_dir();
		}

		foreach ( $thumbnail_array as $key => $thumbnail_src ) {
				$file_url = $thumbnail_src;

			if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ||
			0 === strpos( $file_url, 'http://' ) ||
			0 === strpos( $file_url, 'https://' ) ) {
				$thumbnail_src = $file_url;
			} else {
				$thumbnail_src = $uploads['baseurl'] . '/' . $file_url;
			}
			$thumbnail_array[ $key ] = $thumbnail_src;
		}

		// only filter for the unique values.
		$thumbnail_array = array_unique( $thumbnail_array );

		$selected_thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

		if ( ! empty( $selected_thumbnail ) ) {
					$file_url = $selected_thumbnail;

			if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ||
			0 === strpos( $file_url, 'http://' ) ||
			0 === strpos( $file_url, 'https://' ) ) {
				$selected_thumbnail = $file_url;
			} else {
				$selected_thumbnail = $uploads['baseurl'] . '/' . $file_url;
			}
		}

		$data = array();

		if ( ! empty( $selected_thumbnail ) ) {
			$data['selected'] = $selected_thumbnail;
		}

		$data['thumbnails'] = $thumbnail_array;

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * Set video thumbnail.
	 *
	 * Set the video thumbnail for the attachment ID.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function set_video_thumbnail( $request ) {
		$attachment_id = $request->get_param( 'attachment_id' );
		$thumbnail_url = $request->get_param( 'thumbnail_url' );

		// Check if attachment is of type video.
		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! preg_match( '/^video\//', $mime_type ) ) {
			return new \WP_Error( 'invalid_attachment', 'Attachment is not a video.', array( 'status' => 400 ) );
		}

		// Check if the thumbnail URL is valid.
		if ( ! filter_var( $thumbnail_url, FILTER_VALIDATE_URL ) ) {
			return new \WP_Error( 'invalid_thumbnail_url', 'Invalid thumbnail URL.', array( 'status' => 400 ) );
		}

		// Update the video thumbnail.
		update_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', $thumbnail_url );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'Video thumbnail successfully set.',
			)
		);
	}

	/**
	 * Download folder as ZIP.
	 *
	 * Create a ZIP file of the folder with the given ID.
	 *
	 * @since n.e.x.t
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function download_folder( $request ) {
		$folder_id = $request->get_param( 'folder_id' );

		if ( ! $folder_id || ! is_numeric( $folder_id ) ) {
			return new \WP_Error( 'invalid_folder_id', 'Invalid folder ID.', array( 'status' => 400 ) );
		}

		// Check if the term of the folder exists.
		$term = get_term( $folder_id, 'media-folder' );

		if ( ! $term || is_wp_error( $term ) ) {
			return new \WP_Error( 'invalid_folder', 'Invalid folder term ID.', array( 'status' => 404 ) );
		}

		$result = Media_Folder_Create_Zip::get_instance()->create_zip( $folder_id, 'media-folder-' . $term->slug . '.zip' );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'ZIP file created successfully.',
				'data'    => $result,
			)
		);
	}

	/**
	 * Delete multiple folders.
	 *
	 * Deletes an array of folder IDs.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_delete_folders( $request ) {
		$folder_ids = $request->get_param( 'folder_ids' );

		if ( empty( $folder_ids ) || ! is_array( $folder_ids ) ) {
			return new \WP_Error( 'invalid_ids', 'No folder IDs provided or invalid format.', array( 'status' => 400 ) );
		}

		$deleted_count = 0;
		$errors        = array();

		foreach ( $folder_ids as $folder_id ) {
			if ( ! is_numeric( $folder_id ) || $folder_id <= 0 ) {
				// translators: %s is the invalid folder ID.
				$errors[] = sprintf( __( 'Invalid folder ID: %s', 'godam' ), $folder_id );
				continue;
			}

			$term = get_term( $folder_id, 'media-folder' );

			if ( ! $term || is_wp_error( $term ) ) {
				// translators: %s is the invalid folder ID.
				$errors[] = sprintf( __( 'Folder ID %s not found or invalid.', 'godam' ), $folder_id );
				continue;
			}

			$result = wp_delete_term( $folder_id, 'media-folder' );

			if ( is_wp_error( $result ) ) {
				// translators: %s is the invalid folder ID where delete failed.
				$errors[] = sprintf( __( 'Failed to delete folder %s', 'godam' ), $folder_id );
			} elseif ( false === $result ) {
				// translators: %s is the ID of folder not found.
				$errors[] = sprintf( __( 'Folder ID %s not found during deletion attempt.', 'godam' ), $folder_id );
			} elseif ( 0 === $result ) {
				// translators: %s is the invalid folder ID.
				$errors[] = sprintf( __( 'Folder ID %s cannot be deleted (possibly uncategorized or default term).', 'godam' ), $folder_id );
			} else {
				++$deleted_count;
			}
		}

		if ( $deleted_count > 0 && empty( $errors ) ) {
			return rest_ensure_response(
				array(
					'success' => true,
					// translators: %d is the number of folders deleted.
					'message' => sprintf( __( '%d folder(s) deleted successfully.', 'godam' ), $deleted_count ),
				)
			);
		} elseif ( $deleted_count > 0 && ! empty( $errors ) ) {
			return new \WP_REST_Response(
				array(
					'success'       => true, // Partial success
					// translators: %1$d is the number of folders deleted, %2$s are the errors.
					'message'       => sprintf( __( 'Error deleting some folders. Deleted: %1$d. Errors: %2$s', 'godam' ), $deleted_count, implode( ', ', $errors ) ),
					'errors'        => $errors,
					'deleted_count' => $deleted_count,
				),
				200 // HTTP OK for partial success.
			);
		} else {
			return new \WP_Error( 'bulk_delete_failed', __( 'No folders were deleted.', 'godam' ) . ' Errors: ' . implode( ', ', $errors ), array( 'status' => 500 ) );
		}
	}

	/**
	 * Update meta status for multiple folders.
	 * This is a helper method used by bulk_update_folder_lock_status and bulk_update_folder_bookmark_status.
	 *
	 * @param array  $folder_ids Array of folder IDs.
	 * @param string $meta_key   The meta key to update ('locked' or 'bookmark').
	 * @param bool   $value      The boolean value to set (true or false).
	 * @return array Success status and messages.
	 */
	private function update_folder_meta_status( $folder_ids, $meta_key, $value ) {
		$updated_count = 0;
		$failed_ids    = array();
		$errors        = array();

		foreach ( $folder_ids as $folder_id ) {
			if ( ! is_numeric( $folder_id ) || $folder_id <= 0 ) {
				// translators: %s is the invalid folder ID.
				$errors[] = sprintf( __( 'Invalid folder ID: %s', 'godam' ), $folder_id );
				continue;
			}

			$term = get_term( $folder_id, 'media-folder' );

			if ( ! $term || is_wp_error( $term ) ) {
				// translators: %s is the invalid folder ID.
				$errors[] = sprintf( __( 'Folder ID %s not found or invalid.', 'godam' ), $folder_id );
				continue;
			}

			$result = update_term_meta( $folder_id, $meta_key, $value );

			if ( false === $result ) {
				++$updated_count;
			} else {
				++$updated_count;
			}
		}

		return array(
			'updated_count' => $updated_count,
			'failed_ids'    => $failed_ids,
			'errors'        => $errors,
		);
	}

	/**
	 * Bulk update folder lock status.
	 *
	 * Sets the 'locked' meta status for an array of folder IDs.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_update_folder_lock( $request ) {
		$folder_ids    = $request->get_param( 'folder_ids' );
		$locked_status = (bool) $request->get_param( 'locked_status' );

		if ( empty( $folder_ids ) || ! is_array( $folder_ids ) ) {
			return new \WP_Error( 'invalid_ids', 'No folder IDs provided or invalid format.', array( 'status' => 400 ) );
		}

		$result = $this->update_folder_meta_status( $folder_ids, 'locked', $locked_status );

		if ( $result['updated_count'] > 0 && empty( $result['errors'] ) ) {
			return rest_ensure_response(
				array(
					'success'       => true,
					'message'       => sprintf(
						$locked_status
						// translators: %d number of folders.
							? __( '%d folder(s) locked successfully.', 'godam' )
							// translators: %d number of folders.
							: __( '%d folder(s) unlocked successfully.', 'godam' ),
						$result['updated_count']
					),
					'updated_ids'   => $folder_ids,
					'locked_status' => $locked_status,
				)
			);
		} elseif ( $result['updated_count'] > 0 && ! empty( $result['errors'] ) ) {
			return new \WP_REST_Response(
				array(
					'success'       => true, // Partial success.
					'message'       => sprintf(
						$locked_status
						// translators: %d number of folders.
							? __( 'Some folders locked, but issues occurred with others. Locked: %d.', 'godam' )
							// translators: %d number of folders.
							: __( 'Some folders unlocked, but issues occurred with others. Unlocked: %d.', 'godam' ),
						$result['updated_count']
					),
					'errors'        => $result['errors'],
					'updated_count' => $result['updated_count'],
					'updated_ids'   => array_diff( $folder_ids, $result['failed_ids'] ),
					'locked_status' => $locked_status,
				),
				200
			);
		} else {
			return new \WP_Error( 'bulk_lock_failed', __( 'No folders were updated for lock status.', 'godam' ) . ' Errors: ' . implode( ', ', $result['errors'] ), array( 'status' => 500 ) );
		}
	}

	/**
	 * Bulk update folder bookmark status.
	 *
	 * Sets the 'bookmark' meta status for an array of folder IDs.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_update_folder_bookmark( $request ) {
		$folder_ids      = $request->get_param( 'folder_ids' );
		$bookmark_status = (bool) $request->get_param( 'bookmark_status' );

		if ( empty( $folder_ids ) || ! is_array( $folder_ids ) ) {
			return new \WP_Error( 'invalid_ids', 'No folder IDs provided or invalid format.', array( 'status' => 400 ) );
		}

		$result = $this->update_folder_meta_status( $folder_ids, 'bookmark', $bookmark_status );

		if ( $result['updated_count'] > 0 && empty( $result['errors'] ) ) {
			return rest_ensure_response(
				array(
					'success'         => true,
					'message'         => sprintf(
						$bookmark_status
						// translators: %d number of folders.
							? __( '%d folder(s) bookmarked successfully.', 'godam' )
							// translators: %d number of folders.
							: __( '%d folder(s) unbookmarked successfully.', 'godam' ),
						$result['updated_count']
					),
					'updated_ids'     => $folder_ids,
					'bookmark_status' => $bookmark_status,
				)
			);
		} elseif ( $result['updated_count'] > 0 && ! empty( $result['errors'] ) ) {
			return new \WP_REST_Response(
				array(
					'success'         => true, // Partial success.
					'message'         => sprintf(
						$bookmark_status
						// translators: %d number of folders.
							? __( 'Some folders bookmarked, but issues occurred with others. Bookmarked: %d.', 'godam' )
							// translators: %d number of folders.
							: __( 'Some folders unbookmarked, but issues occurred with others. Unbookmarked: %d.', 'godam' ),
						$result['updated_count'],
					),
					'errors'          => $result['errors'],
					'updated_count'   => $result['updated_count'],
					'updated_ids'     => array_diff( $folder_ids, $result['failed_ids'] ),
					'bookmark_status' => $bookmark_status,
				),
				200
			);
		} else {
			return new \WP_Error( 'bulk_bookmark_failed', __( 'No folders were updated for bookmark status.', 'godam' ) . ' Errors: ' . implode( ', ', $result['errors'] ), array( 'status' => 500 ) );
		}
	}

	/**
	 * Handles a REST API request to fetch media files from GoDAM CMM.
	 *
	 * This endpoint retrieves a list of media files (video, audio, etc.) from the GoDAM API
	 * using an API key stored in WordPress options. The response is paginated based on
	 * `page` and `per_page` parameters. The media type can be filtered using the `type` parameter.
	 *
	 * Supported types: 'video', 'audio', 'image', etc.
	 * For 'video' type, the job type is sent as 'stream' to the external API.
	 *
	 * The returned response contains the processed list of media items with additional meta
	 * fields (like artist and album for audio), total count, and pagination information.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response JSON-formatted response containing:
	 */
	public function get_godam_cmm_files( $request ) {
		// Extract and sanitize pagination and filter parameters from the request.
		$page     = max( 1, absint( $request->get_param( 'page' ) ) );
		$per_page = max( 1, absint( $request->get_param( 'per_page' ) ) );
		$type     = $request->get_param( 'type' ) ?? 'all';
		$search   = $request->get_param( 'search' );

		// For now, we hardcode total count as 20 for all types till we get the API endpoint ready.
		$total     = 'video' === $type ? 20 : ( 'audio' === $type ? 20 : 20 );
		$all_items = array();

		// Retrieve the GoDAM API key stored in WordPress options.
		$api_key = get_option( 'rtgodam-api-key', '' );

		// Proceed only if the media type is provided and API key exists.
		if ( isset( $type ) && ! empty( $api_key ) ) {
			// Construct the GoDAM API endpoint URL.
			$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.file.get_list_of_files_with_api_key';

			// Prepare query arguments.
			$request_args = array(
				'api_key'   => $api_key,
				'page_size' => $per_page,
				'page'      => $page,
			);

			// For video, GoDAM expects `job_type=stream`.
			if ( 'video' === $type ) {
				$request_args['job_type'] = 'stream';
			} else {
				$request_args['job_type'] = $type;
			}

			// Set the search argument.
			if ( ! empty( $search ) ) {
				$request_args['search'] = $search;
			}

			// Add query params to the API URL.
			$api_url = add_query_arg(
				$request_args,
				$api_url
			);

			// Make the API request to GoDAM.
			$response = wp_remote_get(
				$api_url,
				array(
					'headers' => array(
						'Content-Type' => 'application/json',
					),
				)
			);

			// Check for WP_Error or non-200 status codes.
			if ( is_wp_error( $response ) ) {
				return rest_ensure_response(
					array(
						'success' => false,
						'message' => 'Failed to fetch media from GoDAM: ' . $response->get_error_message(),
					)
				);
			}

			$response_code = wp_remote_retrieve_response_code( $response );

			if ( 200 !== $response_code ) {
				return rest_ensure_response(
					array(
						'success' => false,
						'message' => "GoDAM API returned HTTP status {$response_code}.",
					)
				);
			}

			$body = json_decode( wp_remote_retrieve_body( $response ) );

			if ( empty( $body->message->files ) || ! is_array( $body->message->files ) ) {
				return rest_ensure_response(
					array(
						'success' => false,
						'message' => 'Unexpected API response format or no files found.',
					)
				);
			}

			$response = $body->message->files;

			$all_items = array();

			// Prepare and normalize each media item for compatibility with WordPress Media Library.
			foreach ( $response as $key => $item ) {
				$all_items[ $key ] = Media_Library_Ajax::get_instance()->prepare_godam_media_item( $item );
				/**
				 * For audio type, ensure that meta keys for artist and album exist.
				 * 
				 * Note - This is a temporary fix till API starts sending the meta fields as well.
				 */
				if ( 'audio' === $type ) {
					$all_items[ $key ]['meta']           = isset( $all_items[ $key ]['meta'] ) ? $all_items[ $key ]['meta'] : array();
					$all_items[ $key ]['meta']['artist'] = isset( $all_items[ $key ]['meta']['artist'] ) ? $all_items[ $key ]['meta']['artist'] : '';
					$all_items[ $key ]['meta']['album']  = isset( $all_items[ $key ]['meta']['album'] ) ? $all_items[ $key ]['meta']['album'] : '';
				}
			}
		}

		// Return a REST response with pagination and status details.
		return rest_ensure_response(
			array(
				'success'     => true,
				'message'     => 'Filtered GoDAM files by MIME type.',
				'data'        => array_values( $all_items ),
				'total_items' => $total,
				'mime_type'   => $type,
				'page'        => $page,
				'per_page'    => $per_page,
				'has_more'    => $body->message->has_more,
			) 
		);
	}

	/**
	 * Creates a virtual media attachment entry in the WordPress Media Library.
	 *
	 * This is primarily used to allow external media (like GoDAM-hosted videos/audios)
	 * to be represented within the native Media Library interface, enabling support
	 * for layering, editing, or interaction via Gutenberg/Elementor blocks.
	 *
	 * @param \WP_REST_Request $request REST API request object.
	 * @return \WP_REST_Response|\WP_Error API response with attachment data or error.
	 */
	public function create_media_entry( $request ) {
		// Retrieve request payload.
		$data = $request->get_json_params();

		// Validate required fields.
		if ( empty( $data['id'] ) || empty( $data['title'] ) || empty( $data['url'] ) || empty( $data['mime'] ) ) {
			return new \WP_Error( 'missing_params', 'Required fields are missing.', array( 'status' => 400 ) );
		}

		// Sanitize the GoDAM ID.
		$godam_id = sanitize_text_field( $data['id'] );

		// Check if a media entry already exists for this GoDAM ID.
		$existing = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'meta_key'       => '_godam_original_id',
				'meta_value'     => $godam_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'post_status'    => 'any',
				'fields'         => 'ids',
				'posts_per_page' => 1,
			) 
		);

		// If found, return existing attachment instead of duplicating.
		if ( $existing->have_posts() ) {
			$existing_id = $existing->posts[0];
			return new \WP_REST_Response(
				array(
					'success'    => true,
					'attachment' => wp_prepare_attachment_for_js( $existing_id ),
					'message'    => 'Attachment already exists',
				),
				200 
			);
		}

		// Prepare post data for the virtual media entry.
		$attachment = array(
			'post_title'     => sanitize_text_field( $data['title'] ),
			'post_mime_type' => sanitize_text_field( $data['mime'] ),
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'guid'           => esc_url_raw( $data['url'] ),
		);

		// Insert the attachment into WordPress.
		$attach_id = wp_insert_attachment( $attachment, $data['title'] );

		// If creation fails, return an error response.
		if ( is_wp_error( $attach_id ) ) {
			return new \WP_REST_Response(
				array(
					'success' => false,
					'error'   => $attach_id->get_error_message(),
				),
				500 
			);
		}

		// Set custom metadata to track GoDAM-related properties.
		update_post_meta( $attach_id, '_godam_original_id', $godam_id );
		update_post_meta( $attach_id, '_godam_icon', esc_url_raw( $data['icon'] ?? '' ) );
		update_post_meta( $attach_id, '_filesize_human', sanitize_text_field( $data['filesizeHumanReadable'] ?? '' ) );
		update_post_meta( $attach_id, '_godam_label', sanitize_text_field( $data['label'] ?? '' ) );
		update_post_meta( $attach_id, '_owner_email', sanitize_email( $data['owner'] ?? '' ) );
		update_post_meta( $attach_id, 'rtgodam_transcoded_url', esc_url_raw( $data['url'] ?? '' ) );
		update_post_meta( $attach_id, 'rtgodam_transcoding_status', 'transcoded' );
		update_post_meta( $attach_id, 'icon', $data['icon'] );

		// Return the newly created media object.
		return new \WP_REST_Response(
			array(
				'success'    => true,
				'attachment' => wp_prepare_attachment_for_js( $attach_id ),
				'message'    => 'Attachment created',
			),
			201 
		);
	}

	/**
	 * Retrieves a media attachment by its GoDAM ID.
	 *
	 * If an attachment exists in the Media Library with `_godam_original_id` matching
	 * the given ID, its corresponding media object is fetched using the core WP REST API.
	 *
	 * If no match is found, the method assumes the GoDAM ID is already a valid
	 * WordPress attachment ID and attempts to fetch it directly.
	 *
	 * This is useful for clients who want to retrieve media metadata via REST,
	 * regardless of whether it's a native or virtual entry.
	 *
	 * @param \WP_REST_Request $request The REST request containing the GoDAM media ID.
	 * @return \WP_REST_Response|\WP_Error The media object response or an error if not found.
	 */
	public function get_attachment_by_id( $request ) {
		// Sanitize the GoDAM media ID from the request.
		$godam_id = sanitize_text_field( $request['id'] );

		// Try to find an attachment that matches the GoDAM original ID.
		$query = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'meta_key'       => '_godam_original_id',
				'meta_value'     => $godam_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'post_status'    => 'inherit',
				'posts_per_page' => 1,
				'fields'         => 'ids',
			) 
		);

		// If a match is found, use that attachment ID.
		// Otherwise, fallback to assuming $godam_id itself is a WordPress attachment ID.
		$attachment_id = $godam_id;

		if ( $query->have_posts() ) {
			$attachment_id = $query->posts[0];
		}

		// Prepare an internal REST request to fetch media item via core endpoint.
		$internal_request = new \WP_REST_Request( 'GET', '/wp/v2/media/' . $attachment_id );
		// Execute the request and capture the response.
		$response = rest_do_request( $internal_request );

		// Return the full media object (or WP_Error if not found).
		return $response;
	}
}
