<?php
/**
 * Class Chunk_Uploader
 *
 * @package RTGODAM\Inc\Filesystem
 */

namespace RTGODAM\Inc\Filesystem;

use RTGODAM\Inc\Traits\Singleton;

// phpcs:disable WordPress.PHP.DevelopmentFunctions.$this->debug_trigger_error
// phpcs:disable WordPress.PHP.NoSilencedErrors.Discouraged
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_read_fopen
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fopen
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fread
// phpcs:disable WordPressVIPMinimum.Performance.FetchingRemoteData.FileGetContentsUnknown
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_rename
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents

/**
 * Class Chunk_Uploader
 * This class handles chunked file uploads using Plupload.
 * It allows large files to be uploaded in smaller chunks to avoid timeouts and memory issues.
 *
 * @since n.e.x.t
 */
class Chunk_Uploader {

	use Singleton;

	/**
	 * Default max upload size in bytes.
	 * This is set to 4GB by default.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	public const DEFAULT_MAX_UPLOAD_SIZE = 4 * GB_IN_BYTES;

	/**
	 * The maximum upload size in bytes.
	 * This is set to the default WordPress max upload size.
	 *
	 * @since n.e.x.t
	 *
	 * @var int
	 */
	public $max_upload_size;

	/**
	 * Constructor.
	 *
	 * Initializes the chunk uploader by setting up filters and actions.
	 */
	public function __construct() {
		// Save default before we filter it.
		$this->max_upload_size = wp_max_upload_size();

		if ( ! defined( 'GODAM_ENABLE_CHUNK_UPLOADING' ) || false === GODAM_ENABLE_CHUNK_UPLOADING ) {
			return;
		}

		add_filter( 'plupload_init', array( $this, 'filter_plupload_settings' ) );
		add_filter( 'upload_post_params', array( $this, 'filter_plupload_params' ) );
		add_filter( 'plupload_default_settings', array( $this, 'filter_plupload_settings' ) );
		add_filter( 'plupload_default_params', array( $this, 'filter_plupload_params' ) );
		add_filter( 'upload_size_limit', array( $this, 'filter_upload_size_limit' ) );
		add_action( 'wp_ajax_chunk_uploader', array( $this, 'ajax_chunk_receiver' ) );
		add_action( 'post-upload-ui', array( $this, 'upload_output' ) );
		add_filter( 'block_editor_settings_all', array( $this, 'gutenberg_size_filter' ) );
	}

	/**
	 * Filters the Plupload parameters to set the action for chunked uploads.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $plupload_params The Plupload parameters.
	 * @return array Modified Plupload parameters.
	 */
	public function filter_plupload_params( $plupload_params ) {
		$plupload_params['action'] = 'chunk_uploader';
		return $plupload_params;
	}

	/**
	 * Filters the Plupload settings to set the upload URL, max file size, and chunk size.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $plupload_settings The Plupload settings.
	 * @return array Modified Plupload settings.
	 */
	public function filter_plupload_settings( $plupload_settings ) {
		$max_chunk = MB_IN_BYTES * 80;
		if ( $max_chunk > $this->max_upload_size ) {
			$default_chunk = ( $this->max_upload_size * 0.8 ) / KB_IN_BYTES;
		} else {
			$default_chunk = $max_chunk / KB_IN_BYTES;
		}

		$plupload_settings['url']                      = admin_url( 'admin-ajax.php' );
		$plupload_settings['filters']['max_file_size'] = $this->filter_upload_size_limit( '' ) . 'b';
		$plupload_settings['chunk_size']               = $default_chunk . 'kb';
		$plupload_settings['max_retries']              = 1;

		return $plupload_settings;
	}

	/**
	 * Return the maximum upload limit in bytes for the current user.
	 *
	 * @since n.e.x.t
	 *
	 * @return int
	 */
	public function get_upload_limit() {
		return self::DEFAULT_MAX_UPLOAD_SIZE;
	}

	/**
	 * Filters the upload size limit to return the maximum upload size set in the settings.
	 *
	 * @since n.e.x.t
	 *
	 * @return int The maximum upload size limit in bytes.
	 */
	public function filter_upload_size_limit() {
		return $this->get_upload_limit();
	}

	/**
	 * Filters the Gutenberg editor settings to set the maximum upload file size.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $editor_settings The Gutenberg editor settings.
	 * @return array Modified Gutenberg editor settings.
	 */
	public function gutenberg_size_filter( $editor_settings ) {
		$editor_settings['maxUploadFileSize'] = $this->max_upload_size;

		return $editor_settings;
	}

	/**
	 * AJAX chunk receiver.
	 *
	 * Ajax callback for plupload to handle chunked uploads.
	 * Based on code by Davit Barbakadze
	 * https://gist.github.com/jayarjo/5846636
	 *
	 * Mirrors /wp-admin/async-upload.php
	 *
	 * @since n.e.x.t
	 *
	 * @todo Figure out a way to stop further chunks from uploading when there is an error in Gutenberg
	 */
	public function ajax_chunk_receiver() {
		// Add nonce verification for form data.
		if ( ! isset( $_REQUEST['_wpnonce'] ) || ! wp_verify_nonce( sanitize_text_field( $_REQUEST['_wpnonce'] ), 'media-form' ) ) {
			wp_die( esc_html__( 'Nonce verification failed.', 'godam' ) );
		}

		// Check that we have an upload and there are no errors.
		if ( empty( $_FILES ) || ! isset( $_FILES['async-upload']['error'] ) || ! isset( $_FILES['async-upload']['tmp_name'] ) || ! empty( $_FILES['async-upload']['error'] ) || ! is_numeric( $_FILES['async-upload']['error'] ) ) {
			// Failed to move uploaded file.
			die();
		}

		// Authenticate user.
		if ( ! is_user_logged_in() || ! current_user_can( 'upload_files' ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to upload files.', 'godam' ) );
		}
		check_admin_referer( 'media-form' );

		// Sanitize all input variables.
		$chunk        = isset( $_REQUEST['chunk'] ) ? absint( $_REQUEST['chunk'] ) : 0;
		$current_part = $chunk + 1;
		$chunks       = isset( $_REQUEST['chunks'] ) ? absint( $_REQUEST['chunks'] ) : 0;

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- This is a file name, not user input.
		$file_name = $_REQUEST['name'] ?? $this->get_async_filename();

		// Use WordPress helper for file system operations.
		$upload_dir     = wp_get_upload_dir();
		$godam_temp_dir = trailingslashit( $upload_dir['basedir'] ) . 'tmp';

		// Only run on first chunk.
		if ( 0 === $chunk ) {
			// Create temp directory if it doesn't exist.
			if ( ! @is_dir( $godam_temp_dir ) ) {
				wp_mkdir_p( $godam_temp_dir );
			}

			// Protect temp directory from browsing.
			$index_pathname = $godam_temp_dir . '/index.php';
			if ( ! file_exists( $index_pathname ) ) {
				$index_file = fopen( $index_pathname, 'w' );
				if ( false !== $index_file ) {
					fwrite( $index_file, "<?php\n// Silence is golden.\n" );
					fclose( $index_file );
				}
			}

			// TODO: Scan temp dir for files older than 24 hours and delete them.
			$files = glob( $godam_temp_dir . '/*.part' );
			if ( is_array( $files ) ) {
				foreach ( $files as $tmp_file ) {
					if ( @filemtime( $tmp_file ) < ( time() - DAY_IN_SECONDS ) ) {
						@unlink( $tmp_file );
					}
				}
			}
		}

		$file_path = sprintf( '%s/%d-%s.part', $godam_temp_dir, get_current_blog_id(), sha1( $file_name ) );

		// Debugging.
		if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			$size = file_exists( $file_path ) ? size_format( filesize( $file_path ), 3 ) : '0 B';
			$this->debug( "GoDAM: Processing \"$file_name\" part $current_part of $chunks as $file_path . $size processed so far." );
		}

		$godam_max_upload_size = $this->get_upload_limit();
		if ( file_exists( $file_path ) && filesize( $file_path ) + filesize( $this->get_async_tempname() ) > $godam_max_upload_size ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				$this->debug( 'GoDAM: File size limit exceeded.' );
			}

			if ( ! $chunks || $chunk === $chunks - 1 ) {
				@unlink( $file_path );

				if ( ! isset( $_REQUEST['short'] ) || ! isset( $_REQUEST['type'] ) ) {
					echo wp_json_encode(
						array(
							'success' => false,
							'data'    => array(
								'message'  => esc_html__( 'The file size has exceeded the maximum file size setting.', 'godam' ),
								'filename' => $file_name,
							),
						)
					);
					wp_die();
				} else {
					status_header( 202 );
					printf(
						'<div class="error-div error">%s <strong>%s</strong><br />%s</div>',
						sprintf(
							'<button type="button" class="dismiss button-link" onclick="jQuery(this).parents(\'div.media-item\').slideUp(200, function(){jQuery(this).remove();});">%s</button>',
							esc_html__( 'Dismiss', 'godam' )
						),
						sprintf(
							/* translators: %s: Name of the file that failed to upload. */
							esc_html__( '&#8220;%s&#8221; has failed to upload.', 'godam' ),
							esc_html( $file_name )
						),
						esc_html__( 'The file size has exceeded the maximum file size setting.', 'godam' )
					);
					exit;
				}
			}

			die();
		}

		/**
		 * Open temp file.
		 */
		if ( 0 === $chunk ) {
			$out = @fopen( $file_path, 'wb' );
		} elseif ( is_writable( $file_path ) ) { // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_is_writable -- We are checking if the file is writable before appending.
			$out = @fopen( $file_path, 'ab' );
		} else {
			$out = false;
		}

		if ( $out ) {
			// Read binary input stream and append it to temp file.
			$in = @fopen( $this->get_async_tempname(), 'rb' );

			if ( $in ) {
				// Explain why we use a while loop here.
				while ( $buff = @fread( $in, 4096 ) ) {
					@fwrite( $out, $buff );
				}
			} else {
				// Failed to open input stream. Attempt to clean up unfinished output.
				@fclose( $out );
				@unlink( $file_path );
				$this->debug( "GoDAM: Error reading uploaded part $current_part of $chunks." );

				if ( ! isset( $_REQUEST['short'] ) || ! isset( $_REQUEST['type'] ) ) {
					// translators: %1$d: Current part, %2$d: Total chunks.
					echo wp_json_encode(
						array(
							'success' => false,
							'data'    => array(
								// translators: %1$d: Current part, %2$d: Total chunks.
								'message'  => sprintf( esc_html__( 'There was an error reading uploaded part %1$d of %2$d.', 'godam' ), esc_html( $current_part ), esc_html( $chunks ) ),
								'filename' => esc_html( $file_name ),
							),
						)
					);
					wp_die();
				} else {
					status_header( 202 );
					// translators: %s: Name of the file that failed to upload.
					printf(
						'<div class="error-div error">%s <strong>%s</strong><br />%s</div>',
						sprintf(
							'<button type="button" class="dismiss button-link" onclick="jQuery(this).parents(\'div.media-item\').slideUp(200, function(){jQuery(this).remove();});">%s</button>',
							esc_html__( 'Dismiss', 'godam' )
						),
						sprintf(
							/* translators: %s: Name of the file that failed to upload. */
							esc_html__( '&#8220;%s&#8221; has failed to upload.', 'godam' ),
							esc_html( $file_name )
						),
						// translators: %1$d: Current part, %2$d: Total chunks.
						sprintf( esc_html__( 'There was an error reading uploaded part %1$d of %2$d.', 'godam' ), esc_html( $current_part ), esc_html( $chunks ) )
					);
					exit;
				}
			}

			@fclose( $in );
			@fclose( $out );
			@unlink( $this->get_async_tempname() );
		} else {
			// Failed to open output stream.
			$this->debug( "GoDAM: Failed to open output stream $file_path to write part $current_part of $chunks." );

			if ( ! isset( $_REQUEST['short'] ) || ! isset( $_REQUEST['type'] ) ) {
				echo wp_json_encode(
					array(
						'success' => false,
						'data'    => array(
							'message'  => esc_html__( 'There was an error opening the temp file for writing. Available temp directory space may be exceeded or the temp file was cleaned up before the upload completed.', 'godam' ),
							'filename' => esc_html( $file_name ),
						),
					)
				);
				wp_die();
			} else {
				status_header( 202 );
				printf(
					'<div class="error-div error">%s <strong>%s</strong><br />%s</div>',
					sprintf(
						'<button type="button" class="dismiss button-link" onclick="jQuery(this).parents(\'div.media-item\').slideUp(200, function(){jQuery(this).remove();});">%s</button>',
						esc_html__( 'Dismiss', 'godam' )
					),
					sprintf(
						// translators: %s: Name of the file that failed to upload.
						esc_html__( '&#8220;%s&#8221; has failed to upload.', 'godam' ),
						esc_html( $file_name )
					),
					esc_html__( 'There was an error opening the temp file for writing. Available temp directory space may be exceeded or the temp file was cleaned up before the upload completed.', 'godam' )
				);
				exit;
			}
		}

		/** Check if file has finished uploading all parts. */
		if ( ! $chunks || $chunk === $chunks - 1 ) {
			// Debugging.
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				$size = file_exists( $file_path ) ? size_format( filesize( $file_path ), 3 ) : '0 B';
				$this->debug( "GoDAM: Completing \"$file_name\" upload with a $size final size." );
			}

			// Recreate upload in $_FILES global and pass off to WordPress.
			$_FILES['async-upload']['tmp_name'] = $file_path;

			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- This is a file name, not user input.
			$_FILES['async-upload']['name'] = $file_name;
			$_FILES['async-upload']['size'] = filesize( $this->get_async_tempname() );
			$wp_filetype                    = wp_check_filetype_and_ext( $this->get_async_tempname(), $this->get_async_filename() );
			$_FILES['async-upload']['type'] = $wp_filetype['type'];

			header( 'Content-Type: text/plain; charset=' . get_option( 'blog_charset' ) );

			if ( ! isset( $_REQUEST['short'] ) || ! isset( $_REQUEST['type'] ) ) { // Ajax like media uploader in modal.
				send_nosniff_header();
				nocache_headers();

				$this->wp_ajax_upload_attachment();
				die( '0' );

			} else { // Non-ajax like add new media page.
				$post_id = 0;
				if ( isset( $_REQUEST['post_id'] ) ) {
					$post_id = absint( $_REQUEST['post_id'] );
					if ( ! get_post( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
						$post_id = 0;
					}
				}

				$id = media_handle_upload(
					'async-upload',
					$post_id,
					array(),
					array(
						'action'    => 'wp_handle_sideload',
						'test_form' => false,
					)
				);

				if ( is_wp_error( $id ) ) {
					// translators: %s: Name of the file that failed to upload.
					printf(
						'<div class="error-div error">%s <strong>%s</strong><br />%s</div>',
						sprintf(
							'<button type="button" class="dismiss button-link" onclick="jQuery(this).parents(\'div.media-item\').slideUp(200, function(){jQuery(this).remove();});">%s</button>',
							esc_html__( 'Dismiss', 'godam' )
						),
						sprintf(
						/* translators: %s: Name of the file that failed to upload. */
							esc_html__( '&#8220;%s&#8221; has failed to upload.', 'godam' ),
							esc_html( ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '' )
						),
						esc_html( $id->get_error_message() )
					);
					exit;
				}

				if ( ! empty( $_REQUEST['short'] ) ) {
					// Short form response - attachment ID only.
					echo esc_html( $id );
				} else {
					// Long form response - big chunk of HTML.
					$type = $_REQUEST['type']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- This is a request type, not user input.

					/**
					 * Filters the returned ID of an uploaded attachment.
					 *
					 * The dynamic portion of the hook name, `$type`, refers to the attachment type.
					 *
					 * Possible hook names include:
					 *
					 *  - `async_upload_audio`
					 *  - `async_upload_file`
					 *  - `async_upload_image`
					 *  - `async_upload_video`
					 *
					 * @since 2.5.0
					 *
					 * @param int $id Uploaded attachment ID.
					 */
					echo esc_html( apply_filters( "async_upload_{$type}", $id ) );
				}
			}
		}

		die();
	}

	/**
	 * Get the filename for the async upload.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public function get_async_filename() {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
		return ! empty( $_FILES['async-upload']['name'] ) ? $_FILES['async-upload']['name'] : '';
	}

	/**
	 * Get the temporary file name for the async upload.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public function get_async_tempname() {
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
		return ! empty( $_FILES['async-upload']['tmp_name'] ) ? $_FILES['async-upload']['tmp_name'] : '';
	}

	/**
	 * Copied from wp-admin/includes/ajax-actions.php because we have to override the args for
	 * the media_handle_upload function. As of WP 6.0.1.
	 *
	 * @since n.e.x.t
	 */
	public function wp_ajax_upload_attachment() {
		check_ajax_referer( 'media-form' );

		/**
		 * This function does not use wp_send_json_success() / wp_send_json_error()
		 * as the html4 Plupload handler requires a text/html content-type for older IE.
		 * See https://core.trac.wordpress.org/ticket/31037
		 */
		if ( ! current_user_can( 'upload_files' ) ) {
			echo wp_json_encode(
				array(
					'success' => false,
					'data'    => array(
						'message'  => esc_html__( 'Sorry, you are not allowed to upload files.', 'godam' ),
						'filename' => ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '',
					),
				)
			);

			wp_die();
		}

		if ( isset( $_REQUEST['post_id'] ) ) {
			$post_id = absint( $_REQUEST['post_id'] );

			if ( ! current_user_can( 'edit_post', $post_id ) ) {
				echo wp_json_encode(
					array(
						'success' => false,
						'data'    => array(
							'message'  => esc_html__( 'Sorry, you are not allowed to attach files to this post.', 'godam' ),
							'filename' => ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '',
						),
					)
				);

				wp_die();
			}
		} else {
			$post_id = null;
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$post_data = ! empty( $_REQUEST['post_data'] ) ? _wp_get_allowed_postdata( _wp_translate_postdata( false, (array) $_REQUEST['post_data'] ) ) : array();

		if ( is_wp_error( $post_data ) ) {
			wp_die( esc_html( $post_data->get_error_message() ) );
		}

		// If the context is custom header or background, make sure the uploaded file is an image.
		if ( isset( $post_data['context'] ) && in_array( $post_data['context'], array( 'custom-header', 'custom-background' ), true ) ) {
			$wp_filetype = wp_check_filetype_and_ext( ! empty( $this->get_async_tempname() ) ? $this->get_async_tempname() : '', ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '' );

			if ( ! wp_match_mime_types( 'image', $wp_filetype['type'] ) ) {
				echo wp_json_encode(
					array(
						'success' => false,
						'data'    => array(
							'message'  => esc_html__( 'The uploaded file is not a valid image. Please try again.', 'godam' ),
							'filename' => ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '',
						),
					)
				);

				wp_die();
			}
		}

		// This is the modded function from wp-admin/includes/ajax-actions.php.
		$attachment_id = media_handle_upload(
			'async-upload',
			$post_id,
			$post_data,
			array(
				'action'    => 'wp_handle_sideload',
				'test_form' => false,
			)
		);

		if ( is_wp_error( $attachment_id ) ) {
			echo wp_json_encode(
				array(
					'success' => false,
					'data'    => array(
						'message'  => esc_html( $attachment_id->get_error_message() ),
						'filename' => ! empty( $this->get_async_filename() ) ? $this->get_async_filename() : '',
					),
				)
			);

			wp_die();
		}

		if ( isset( $post_data['context'] ) && isset( $post_data['theme'] ) ) {
			if ( 'custom-background' === $post_data['context'] ) {
				update_post_meta( $attachment_id, '_wp_attachment_is_custom_background', $post_data['theme'] );
			}

			if ( 'custom-header' === $post_data['context'] ) {
				update_post_meta( $attachment_id, '_wp_attachment_is_custom_header', $post_data['theme'] );
			}
		}

		$attachment = wp_prepare_attachment_for_js( $attachment_id );
		if ( ! $attachment ) {
			wp_die();
		}

		echo wp_json_encode(
			array(
				'success' => true,
				'data'    => $attachment,
			)
		);

		wp_die();
	}

	/**
	 * Outputs JavaScript to handle chunk upload success and display the max upload size.
	 *
	 * This function is hooked into the 'post-upload-ui' action to add custom JavaScript
	 * that will handle chunk uploads and display the maximum upload size.
	 *
	 * @since n.e.x.t
	 */
	public function upload_output() {
		global $pagenow;
		if ( ! in_array( $pagenow, array( 'post-new.php', 'post.php', 'upload.php', 'media-new.php' ), true ) ) {
			return;
		}
		?>
		<script type="text/javascript">
			// When each chunk is uploaded, check if there were any errors or not and stop the rest
			jQuery(function() {
				if ( typeof uploader !== 'undefined' ) {
					uploader.bind('ChunkUploaded', function (up, file, response) {
						// Stop the upload!
						if (response.status === 202) {
							up.removeFile(file);
							uploadSuccess(file, response.response);
						}
					});
				}
			});
		</script>
		<?php
	}

	/**
	 * Logs debug messages to the error log if WP_DEBUG is enabled or if forced.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $message Message to log.
	 * @return void
	 */
	protected function debug( $message ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			// Log the message to the error log.
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( "GoDAM: $message" );
		}
	}
}
