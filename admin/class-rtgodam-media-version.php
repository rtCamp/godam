<?php
/**
 * The transcoder-specific functionality of the plugin.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */

use function Crontrol\Event\delete;

defined( 'ABSPATH' ) || exit;

/**
 * Handle request/response with trancoder api.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */
class RTGODAM_Media_Version {
	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 */
	public function __construct() {
		add_filter( 'attachment_fields_to_edit', array( $this, 'rtgodam_add_attachment_version_field' ), 10, 2 );
		add_filter( 'attachment_fields_to_save', array( $this, 'rtgodam_replace_attachment_version' ), 10, 2 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'rtgodam_update_media_versions' ), 10, 3 );
		add_filter( 'intermediate_image_sizes_advanced', array( $this, 'rtgodam_disable_intermediate_image_sizes_advanced_media_versions' ), 10, 3 );
		add_filter( 'wp_handle_upload_prefilter', array( $this, 'rtgodam_check_media_versions_eligibility' ) );
		add_action( 'add_attachment', array( $this, 'rtgodam_create_media_versions' ), 10 );
		add_action( 'delete_attachment', array( $this, 'rtgodam_delete_media_versions' ), 10 );
	}

	public function rtgodam_add_attachment_version_field( $form_fields, $post ) {

		$get_origin_post_base_version = get_post_meta( $post->ID, 'rtgodam_attachment_base_version', true );
		$origin_post_versions         = get_post_meta( $post->ID, 'rtgodam_media_versions', true );
		$origin_post_versions         = is_array( $origin_post_versions ) ? $origin_post_versions : array();
		if ( ! empty( $origin_post_versions ) ) {
			$options = '';
			foreach ( $origin_post_versions as $origin_post_version ) {
				$options .= '<option ' . selected( $origin_post_version, $get_origin_post_base_version, false ) . ' value="' . $origin_post_version . '">' . get_the_title( $origin_post_version ) . '</option>';
			}
			$form_fields['media_versions'] = array(
				'label'        => __( 'Replace media with following versions', 'godam' ),
				'input'        => 'html',
				'html'         => sprintf(
					'<select id="rtgodam-update-media-versions" style="width:100%%;" name="attachments[%1$d][media_versions]">%2$s</select>',
					(int) $post->ID,
					$options
				),
				'helps'        => '',
				'show_in_edit' => true,
			);
		}
		$form_fields['replace_media'] = array(
			'label'        => '',
			'input'        => 'html',
			'html'         => sprintf(
				'<button type="button" data-post-id="%1$s" class="button button-secondary" id="rtgodam-add-media-button">%2$s</button>',
				esc_attr( $post->ID ),
				__( 'Add Media version', 'godam' )
			),
			'value'        => '',
			'show_in_edit' => true,
		);
		return $form_fields;
	}

	public function rtgodam_create_media_versions( $attachment_id ) {

		$origin_post_id = filter_input( INPUT_POST, 'origin_post_id', FILTER_VALIDATE_INT );
		$origin_post_id = wp_unslash( sanitize_text_field( $origin_post_id ) );

		if ( empty( $origin_post_id ) ) {
			return;
		}

		add_post_meta( $attachment_id, 'rtgodam_is_attachment_version', 'yes' );
		add_post_meta( $attachment_id, 'origin_post_id', $origin_post_id );
		$this->rtgodam_add_media_version_meta_data_for_origin( $attachment_id, $origin_post_id );
	}

	public function rtgodam_add_media_version_meta_data_for_origin( $attachment_id, $origin_post_id ) {

		$origin_post_versions = get_post_meta( $origin_post_id, 'rtgodam_media_versions', true );
		$origin_post_versions = is_array( $origin_post_versions ) ? $origin_post_versions : array();
		if ( in_array( $attachment_id, $origin_post_versions, true ) ) {
			return;
		}

		$origin_post_versions[] = $attachment_id;
		update_post_meta( $origin_post_id, 'rtgodam_media_versions', $origin_post_versions );
	}

	public function rtgodam_update_media_versions( $response, $attachment, $meta ) {

		$rtgodam_is_attachment_version = get_post_meta( $attachment->ID, 'rtgodam_is_attachment_version', true );
		if ( empty( $rtgodam_is_attachment_version ) || 'yes' !== $rtgodam_is_attachment_version ) {
			return $response;
		}

		$attachment_id = wp_update_post(
			array(
				'ID'        => $attachment->ID,
				'post_type' => 'attachment-version',
			)
		);

		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error( 'failed_to_create_attachment_version', __( 'Failed to create attachment version', 'godam' ) );
		}

		$origin_post_id = get_post_meta( $attachment->ID, 'origin_post_id', true );
		$this->rtgodam_create_media_version_for_origin( $origin_post_id );

		return $response;
	}

	public function rtgodam_create_media_version_for_origin( $attachment_id ) {

		$has_attachment_origin_version = get_post_meta( $attachment_id, 'rtgodam_has_attachment_version', true );
		if ( ! empty( $has_attachment_origin_version ) && 'yes' === $has_attachment_origin_version ) {
			return;
		}

		$attachment = get_post( $attachment_id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new WP_Error( 'invalid_attachment', 'Invalid attachment ID.' );
		}
		$file = get_attached_file( $attachment_id );

		if ( ! $file || ! file_exists( $file ) ) {
			return new WP_Error( 'missing_file', 'Original file not found.' );
		}

		// Get path info for original file.
		$pathinfo = pathinfo( $file );
		$dir      = $pathinfo['dirname'];
		$basename = $pathinfo['basename'];

		// Generate unique filename in same directory.
		$new_basename = wp_unique_filename( $dir, $basename );
		$new_file     = trailingslashit( $dir ) . $new_basename;

			// Copy main file.
		if ( ! copy( $file, $new_file ) ) {
			return new WP_Error( 'copy_failed', 'Could not copy main file.' );
		}

		// Build URL from path.
		$upload_dir = wp_get_upload_dir();
		$new_url    = str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $new_file );

		// Prepare new attachment post args.
		$new_attachment_args = array(
			'post_author'    => $attachment->post_author,
			'post_title'     => __( 'Base Version of ', 'godam' ) . $attachment->post_title,
			'post_status'    => 'inherit',
			'post_mime_type' => $attachment->post_mime_type,
			'post_type'      => 'attachment',
			'guid'           => $new_url,
		);

		// Insert new attachment.
		$new_attachment_id = wp_insert_attachment( $new_attachment_args, $new_file );
		if ( is_wp_error( $new_attachment_id ) ) {
			return $new_attachment_id;
		}

		wp_update_post(
			array(
				'ID'        => $new_attachment_id,
				'post_type' => 'attachment-version',
			)
		);

		add_post_meta( $attachment_id, 'rtgodam_has_attachment_version', 'yes' );
		add_post_meta( $attachment_id, 'rtgodam_attachment_base_version', $new_attachment_id );
	}

	public function rtgodam_replace_attachment_version( $post, $attachment_data ) {
		$current_time = new DateTime( 'now', wp_timezone() );
		$timestamp    = $current_time->getTimestamp();

		if ( is_array( $attachment_data ) && isset( $attachment_data['media_versions'] ) ) {
			$source_id = intval( $attachment_data['media_versions'] );
			$target_id = intval( $post['ID'] );

			if ( $source_id && 'base-version' !== $source_id ) {
				update_post_meta( $target_id, 'rtgodam_attachment_base_version', $source_id );

				$target_id = absint( $target_id );
				$source_id = absint( $source_id );

				if ( ! $target_id || ! $source_id ) {
					return new WP_Error( 'invalid_ids', 'Invalid attachment IDs.' );
				}

				$target_file = get_attached_file( $target_id );
				$source_file = get_attached_file( $source_id );

				if ( ! $target_file || ! file_exists( $target_file ) ) {
					return new WP_Error( 'missing_target', 'Target attachment file not found.' );
				}

				if ( ! $source_file || ! file_exists( $source_file ) ) {
					return new WP_Error( 'missing_source', 'Source attachment file not found.' );
				}

				$target_mime = get_post_mime_type( $target_id );
				$source_mime = get_post_mime_type( $source_id );
				if ( $target_mime && $source_mime && $target_mime !== $source_mime ) {
					return new WP_Error( 'mime_mismatch', 'Source and target mime types do not match.' );
				}

				$this->rtgoam_remove_attachment_files_only( $target_id );

				if ( ! copy( $source_file, $target_file ) ) {
					return new WP_Error( 'copy_failed', 'Failed to replace file on disk.' );
				}

				$metadata = wp_generate_attachment_metadata( $target_id, $target_file );
				if ( ! is_wp_error( $metadata ) && ! empty( $metadata ) ) {
					wp_update_attachment_metadata( $target_id, $metadata );
				}

				if ( 0 === strpos( $source_mime, 'video/' ) ) {

					$metadata = wp_read_video_metadata( $source_file );
					update_post_meta( $target_id, '_video_duration', intval( $metadata['length'] ) );
					update_post_meta( $target_id, '_video_file_size', filesize( $source_file ) );
				}

				update_post_meta( $target_id, 'media_version_updated_at', $timestamp );
			}
		}

		return $post;
	}

	public function rtgodam_delete_media_versions( $attachment_id ) {

		$rtgodam_has_attachment_version = get_post_meta( $attachment_id, 'rtgodam_has_attachment_version', true );
		if ( empty( $rtgodam_has_attachment_version ) || 'yes' !== $rtgodam_has_attachment_version ) {
			return;
		}

		$origin_post_versions = get_post_meta( $attachment_id, 'rtgodam_media_versions', true );

		if ( empty( $origin_post_versions ) ) {
			return;
		}
		$origin_post_versions = is_array( $origin_post_versions ) ? $origin_post_versions : array();

		foreach ( $origin_post_versions as $origin_post_version ) {
			$origin_post_version_id = wp_update_post(
				array(
					'ID'        => (int) $origin_post_version,
					'post_type' => 'attachment',
				)
			);
			if ( ! is_wp_error( $origin_post_version_id ) ) {
				wp_delete_attachment( $origin_post_version_id, true );
			}
		}
	}

	public function rtgodam_disable_intermediate_image_sizes_advanced_media_versions( $sizes, $metadata, $attachment_id ) {
		$rtgodam_is_attachment_version = get_post_meta( $attachment_id, 'rtgodam_is_attachment_version', true );
		if ( ! empty( $rtgodam_is_attachment_version ) && 'yes' === $rtgodam_is_attachment_version ) {
			return array();
		}
		return $sizes;
	}

	public function rtgoam_remove_attachment_files_only( $attachment_id ) {
		$meta         = wp_get_attachment_metadata( $attachment_id );
		$backup_sizes = get_post_meta( $attachment_id, '_wp_attachment_backup_sizes', true );
		$file         = get_attached_file( $attachment_id );

		if ( empty( $meta ) ) {
			return;
		}

		wp_delete_attachment_files( $attachment_id, $meta, $backup_sizes, $file );
		delete_post_meta( $attachment_id, '_wp_attachment_backup_sizes' );
		delete_post_meta( $attachment_id, '_wp_attachment_metadata' );
	}

	public function rtgodam_check_media_versions_eligibility( $file ) {
		$origin_post_id = filter_input( INPUT_POST, 'origin_post_id', FILTER_VALIDATE_INT );
		if ( empty( $origin_post_id ) ) {
			return $file;
		}

		$mime = get_post_mime_type( $origin_post_id );
		if ( isset( $file['type'] ) && $mime !== $file['type'] ) {
			$file['error'] = __( 'The uploaded file type does not match the original media type.', 'godam' );
		}

		if ( wp_attachment_is_image( $origin_post_id ) ) {
			$origin_post_meta   = wp_get_attachment_metadata( $origin_post_id );
			$origin_post_width  = absint( $origin_post_meta['width'] );
			$origin_post_height = absint( $origin_post_meta['height'] );
			$file_dimentions    = getimagesize( $file['tmp_name'] );
			$file_width         = absint( $file_dimentions[0] );
			$file_height        = absint( $file_dimentions[1] );

			if ( $origin_post_width !== $file_width || $origin_post_height !== $file_height ) {
				$file['error'] = sprintf(
					/* translators: 1: file width, 2: file height, 3: origin width, 4: origin height */
					__( 'The uploaded file width %1$d and height %2$d should match the original media width %3$d & height %4$d.', 'godam' ),
					$file_width,
					$file_height,
					$origin_post_width,
					$origin_post_height
				);
			}
		}
		return $file;
	}
}
