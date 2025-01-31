<?php
/**
 * REST API class for Media Library Pages.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

use Transcoder\Inc\Providers\Handlers\Item_Handler;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;
use Transcoder\Inc\Providers\Handlers\Error_Handler;

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
							'description' => 'Array of attachment IDs to associate.',
						),
						'folder_term_id' => array(
							'required'    => true,
							'type'        => 'integer',
							'description' => 'ID of the folder term to associate with the attachments.',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/upload-to-s3',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'upload_to_s3' ),
					'permission_callback' => function () {
						return false; // disable REST API for now.
					},
					'args'                => array(
						'attachment_ids' => array(
							'required'    => true,
							'type'        => 'array',
							'items'       => array( 'type' => 'integer' ),
							'description' => 'Array of attachment IDs to upload to S3.',
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
							'description' => 'Attachment ID to get EXIF data for.',
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
							'description' => 'Attachment ID to set video thumbnail for.',
						),
						'thumbnail_url' => array(
							'required'    => true,
							'type'        => 'string',
							'description' => 'Attachment URL to set as the thumbnail.',
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
							'description' => 'Attachment ID to get video thumbnail for.',
						),
					),
				),
			),
		);
	}

	/**
	 * Verify the license key using external API.
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
	 * Upload to S3.
	 * 
	 * Upload the list of attachment IDs to S3.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function upload_to_s3( $request ) {

		$attachment_ids = $request->get_param( 'attachment_ids' );

		$successful_uploads = array();

		foreach ( $attachment_ids as $attachment_id ) {

			try {
				Item_Handler::upload_item( $attachment_id );
				$successful_uploads[] = $attachment_id;
			} catch ( EasyDamException $e ) {
				Error_Handler::handle_exception( $e );
			}
		}

		return rest_ensure_response(
			array(
				'success'  => true,
				'message'  => 'Attachments successfully uploaded to S3.',
				'uploaded' => $successful_uploads,
			) 
		);
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

		// Get the file path of the image
		$file_path = get_attached_file( $attachment_id );

		if ( ! file_exists( $file_path ) ) {
			return new \WP_Error( 'image_not_found', 'Image file not found.', array( 'status' => 404 ) );
		}

		// Read EXIF data from the image
		$exif_data = @exif_read_data( $file_path, 0, true );

		if ( false === $exif_data ) {
			return new \WP_Error( 'exif_data_not_found', 'No EXIF data found.', array( 'status' => 404 ) );
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
			if ( is_numeric( $numerator ) && is_numeric( $denominator ) && $denominator != 0 ) {
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

		// Check if attachment is of type video
		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! preg_match( '/^video\//', $mime_type ) ) {
			return new \WP_Error( 'invalid_attachment', 'Attachment is not a video.', array( 'status' => 400 ) );
		}

		$thumbnail_array = get_post_meta( $attachment_id, 'rtmedia_media_thumbnails', true );

		if ( ! is_array( $thumbnail_array ) ) {
			$thumbnail_array = get_post_meta( $attachment_id, '_rt_media_thumbnails', true );
		}

		if ( ! is_array( $thumbnail_array ) ) {
			return new \WP_Error( 'thumbnails_not_found', 'No thumbnails found.', array( 'status' => 404 ) );
		}

		if ( function_exists( 'wp_get_upload_dir' ) ) {
			$uploads = wp_get_upload_dir();
		} else {
			$uploads = wp_upload_dir();
		}

		foreach ( $thumbnail_array as $key => $thumbnail_src ) {
			$file_url = $thumbnail_src;

			if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
				$thumbnail_src = $file_url;
			} else {
				$thumbnail_src = $uploads['baseurl'] . '/' . $file_url;
			}

			$thumbnail_array[ $key ] = $thumbnail_src;
		}

		$selected_thumbnail = get_post_meta( $attachment_id, '_rt_media_video_thumbnail', true );

		if ( ! empty( $selected_thumbnail ) ) {
			$file_url = $selected_thumbnail;

			if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
				$selected_thumbnail = $file_url;
			} else {
				$selected_thumbnail = $uploads['baseurl'] . '/' . $file_url;
			}
		}

		$data = [];

		if ( ! empty( $selected_thumbnail ) ) {
			$data['selected'] = $selected_thumbnail;
		}

		$data['thumbnails'] = $thumbnail_array;

		return rest_ensure_response(
			array(
				'success'    => true,
				'data'  => $data,
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

		// Check if attachment is of type video
		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! preg_match( '/^video\//', $mime_type ) ) {
			return new \WP_Error( 'invalid_attachment', 'Attachment is not a video.', array( 'status' => 400 ) );
		}

		// Check if the thumbnail URL is valid
		if ( ! filter_var( $thumbnail_url, FILTER_VALIDATE_URL ) ) {
			return new \WP_Error( 'invalid_thumbnail_url', 'Invalid thumbnail URL.', array( 'status' => 400 ) );
		}

		// Update the video thumbnail
		update_post_meta( $attachment_id, '_rt_media_video_thumbnail', $thumbnail_url );

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => 'Video thumbnail successfully set.',
			) 
		);
	}
}
