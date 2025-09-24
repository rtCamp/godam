<?php
/**
 * Plugin class for handling GoDAM uploads and filesystem operations.
 *
 * This class manages the integration of GoDAM with WordPress uploads,
 * including stream wrappers, file validation, and CDN support.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

use RTGODAM\Inc\Filesystem\Filters\Local_To_GoDAM;
use RTGODAM\Inc\Filesystem\Filters\GoDAM_To_Local;

use WP_Error;

/**
 * @psalm-consistent-constructor
 */
class Plugin {

	/**
	 * Max length allowed for file paths in the Files Service.
	 *
	 * @since n.e.x.t
	 */
	const MAX_FILE_PATH_LENGTH = 255;

	/**
	 * Original wp_upload_dir() before being replaced by GoDAM Uploads.
	 *
	 * @since n.e.x.t
	 *
	 * @var ?array{path: string, basedir: string, baseurl: string, url: string}
	 */
	public $original_upload_dir;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?API_Client
	 */
	private $client = null;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?static
	 */
	private static $instance = null;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?string
	 */
	public $host = null;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?string
	 */
	private $key = null;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?string
	 */
	private $cdn_host = null;

	/**
	 * Local to GoDAM filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @var ?Local_To_GoDAM
	 */
	private $filter_local_to_godam = null;

	/**
	 * GoDAM to Local filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @var ?GoDAM_To_Local
	 */
	private $filter_godam_to_local = null;

	/**
	 * Media Library filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @var ?Media_Library
	 */
	private $media_library_filters = null;

	/**
	 *
	 * @since n.e.x.t
	 *
	 * @return static
	 */
	public static function get_instance() {

		if ( ! self::$instance ) {
			self::$instance = new static(
				defined( 'GODAM_UPLOAD_MEDIA_API_HOST' ) ? GODAM_UPLOAD_MEDIA_API_HOST : null,
				defined( 'GODAM_UPLOAD_MEDIA_API_KEY' ) ? GODAM_UPLOAD_MEDIA_API_KEY : null
			);
		}

		return self::$instance;
	}

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param string  $host The host URL for the GoDAM Media API.
	 * @param ?string $key The API key for accessing GoDAM.
	 */
	public function __construct( $host, $key ) {
		$this->host = $host;
		$this->key  = $key;
	}

	/**
	 * Setup the hooks, urls filtering etc for godam Uploads
	 *
	 * @since n.e.x.t
	 */
	public function setup() {
		$this->register_stream_wrapper();

		// Register the chunk uploader.
		Chunk_Uploader::get_instance();

		// Update the upload directory to use GoDAM.
		add_filter( 'upload_dir', array( $this, 'filter_upload_dir' ) );
		add_filter( 'wp_image_editors', array( $this, 'filter_editors' ), 9 );
		add_action( 'add_attachment', array( $this, 'add_extra_metadata' ) );
		add_action( 'delete_attachment', array( $this, 'delete_attachment_files' ) );
		add_filter( 'wp_read_image_metadata', array( $this, 'wp_filter_read_image_metadata' ), 10, 2 );
		add_filter( 'wp_resource_hints', array( $this, 'wp_filter_resource_hints' ), 10, 2 );

		add_action( 'wp_handle_sideload_prefilter', array( $this, 'filter_sideload_move_temp_file_to_godam' ) );
		add_filter( 'wp_generate_attachment_metadata', array( $this, 'set_filesize_in_attachment_meta' ), 10, 2 );

		add_filter( 'wp_handle_upload_prefilter', array( $this, 'filter_validate_file' ) );
		add_filter( 'wp_handle_sideload_prefilter', array( $this, 'filter_validate_file' ) );

		// Initialize URL filters.
		$this->setup_url_filters();
	}

	/**
	 * Tear down the hooks, url filtering etc for godam Uploads
	 *
	 * @since n.e.x.t
	 */
	public function tear_down() {

		stream_wrapper_unregister( 'godam' );
		remove_filter( 'upload_dir', array( $this, 'filter_upload_dir' ) );
		remove_filter( 'wp_image_editors', array( $this, 'filter_editors' ), 9 );
		remove_filter( 'wp_handle_sideload_prefilter', array( $this, 'filter_sideload_move_temp_file_to_godam' ) );
		remove_filter( 'wp_generate_attachment_metadata', array( $this, 'set_filesize_in_attachment_meta' ) );

		remove_filter( 'wp_handle_upload_prefilter', array( $this, 'filter_validate_file' ) );
		remove_filter( 'wp_handle_sideload_prefilter', array( $this, 'filter_validate_file' ) );
	}

	/**
	 * Register the stream wrapper for godam
	 *
	 * @since n.e.x.t
	 */
	public function register_stream_wrapper() {
		Stream_Wrapper::register( $this );
		$acl = defined( 'GODAM_UPLOADS_OBJECT_ACL' ) ? GODAM_UPLOADS_OBJECT_ACL : 'public-read';
		stream_context_set_option( stream_context_get_default(), 'godam', 'ACL', $acl );
		stream_context_set_option( stream_context_get_default(), 'godam', 'seekable', true );
	}

	/**
	 * Get the original upload directory before it was replaced by S3 uploads.
	 *
	 * @since n.e.x.t
	 *
	 * @return array{path: string, basedir: string, baseurl: string, url: string}
	 */
	public function get_original_upload_dir(): array {

		if ( empty( $this->original_upload_dir ) ) {
			wp_upload_dir();
		}

		/**
		 * @var array{path: string, basedir: string, baseurl: string, url: string}
		 */
		$upload_dir = $this->original_upload_dir;

		if ( empty( $upload_dir ) ) {
			// Fallback to the default upload directory if not set.
			$upload_dir = wp_upload_dir();
		}

		return $upload_dir;
	}

	/**
	 * Get the GoDAM URL base for uploads.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	public function get_remote_url() {
		if ( ! empty( $this->cdn_host ) ) {
			return $this->cdn_host;
		}

		// Fetch the CDN host from the GoDAM settings.
		$this->cdn_host = rtgodam_get_cdn_host( '/uploads' );

		return $this->cdn_host;
	}

	/**
	 * Overwrite the default wp_upload_dir.
	 *
	 * @since n.e.x.t
	 *
	 * @param array{path: string, basedir: string, baseurl: string, url: string} $dirs Upload directories and paths.
	 * @return array{path: string, basedir: string, baseurl: string, url: string}
	 */
	public function filter_upload_dir( array $dirs ) {

		$this->original_upload_dir = $dirs;

		$godam_path      = 'godam://wp-content/uploads';
		$dirs['path']    = str_replace( path_join( WP_CONTENT_DIR, 'uploads' ), $godam_path, $dirs['path'] );
		$dirs['basedir'] = str_replace( path_join( WP_CONTENT_DIR, 'uploads' ), $godam_path, $dirs['basedir'] );
		// Keep original URLs - let the URL filters handle URL replacement.
		return $dirs;
	}

	/**
	 * Delete all attachment files from godam when an attachment is deleted.
	 *
	 * WordPress Core's handling of deleting files for attachments via
	 * wp_delete_attachment_files is not compatible with remote streams, as
	 * it makes many assumptions about local file paths. The hooks also do
	 * not exist to be able to modify their behavior. As such, we just clean
	 * up the godam files when an attachment is removed, and leave WordPress to try
	 * a failed attempt at mangling the godam:// urls.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $post_id The ID of the attachment post to delete files for.
	 */
	public function delete_attachment_files( int $post_id ) {
		$meta = wp_get_attachment_metadata( $post_id );
		$file = get_attached_file( $post_id );
		if ( ! $file ) {
			return;
		}

		if ( ! empty( $meta['sizes'] ) ) {
			foreach ( $meta['sizes'] as $sizeinfo ) {
				$intermediate_file = str_replace( basename( $file ), $sizeinfo['file'], $file );
				wp_delete_file( $intermediate_file );
			}
		}

		wp_delete_file( $file );
	}

	/**
	 * @since n.e.x.t
	 *
	 * @return API_Client
	 */
	public function client() {
		if ( ! empty( $this->client ) ) {
			return $this->client;
		}

		// Use the current blog ID for multisite support.
		$site_id = function_exists( 'get_current_blog_id' ) ? (string) get_current_blog_id() : '1';

		$this->client = new API_Client(
			$this->host,
			$site_id,
			$this->key,
			API_Cache::get_instance()
		);

		return $this->client;
	}

	/**
	 * Filter the image editors to use our custom Image_Editor_Imagick.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $editors List of image editor classes.
	 * @return array
	 */
	public function filter_editors( array $editors ) {
		$position = array_search( 'WP_Image_Editor_Imagick', $editors );
		if ( false !== $position ) {
			unset( $editors[ $position ] );
		}

		array_unshift( $editors, __NAMESPACE__ . '\\Image_Editor_Imagick' );

		return $editors;
	}

	/**
	 * Add extra metadata to the attachment when it is added.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $attachment_id The ID of the attachment.
	 */
	public function add_extra_metadata( int $attachment_id ) {
		// Add meta to check if media file is uploaded to GoDAM.
		update_post_meta( $attachment_id, '_media_migrated_to_godam_cdn', true );
	}

	/**
	 * Copy the file from /tmp to an godam dir so handle_sideload doesn't fail due to
	 * trying to do a rename() on the file cross streams. This is somewhat of a hack
	 * to work around the core issue https://core.trac.wordpress.org/ticket/29257
	 *
	 * @since n.e.x.t
	 *
	 * @param array{tmp_name: string} $file File array.
	 * @return array{tmp_name: string}
	 */
	public function filter_sideload_move_temp_file_to_godam( array $file ) {
		$upload_dir = wp_upload_dir();
		$new_path   = $upload_dir['basedir'] . '/tmp/' . basename( $file['tmp_name'] );

		// Return file if it already exists.
		if ( file_exists( $new_path ) ) {
			$file['tmp_name'] = $new_path;
			return $file;
		}

		copy( $file['tmp_name'], $new_path );

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
		unlink( $file['tmp_name'] );
		$file['tmp_name'] = $new_path;

		return $file;
	}

	/**
	 * Store the attachment filesize in the attachment meta array.
	 *
	 * Getting the filesize of an image in GoDAM involves a remote HEAD request,
	 * which is a bit slower than a local filesystem operation would be. As a
	 * result, operations like `wp_prepare_attachments_for_js' take substantially
	 * longer to complete against godam uploads than if they were performed with a
	 * local filesystem.i
	 *
	 * Saving the filesize in the attachment metadata when the image is
	 * uploaded allows core to skip this stat when retrieving and formatting it.
	 *
	 * @since n.e.x.t
	 *
	 * @param array{file?: string} $metadata      Attachment metadata.
	 * @param int                  $attachment_id Attachment ID.
	 * @return array{file?: string, filesize?: int} Attachment metadata array, with "filesize" value added.
	 */
	public function set_filesize_in_attachment_meta( array $metadata, int $attachment_id ) {
		$file = get_attached_file( $attachment_id );
		if ( ! $file ) {
			return $metadata;
		}
		if ( ! isset( $metadata['filesize'] ) && file_exists( $file ) ) {
			$metadata['filesize'] = filesize( $file );
		}

		return $metadata;
	}

	/**
	 * Filters wp_read_image_metadata. exif_read_data() doesn't work on
	 * file streams so we need to make a temporary local copy to extract
	 * exif data from.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $meta The metadata array to filter.
	 * @param string $file The file path to read metadata from.
	 * @return array|bool
	 */
	public function wp_filter_read_image_metadata( array $meta, string $file ) {
		remove_filter( 'wp_read_image_metadata', array( $this, 'wp_filter_read_image_metadata' ), 10 );
		$temp_file = $this->copy_image_from_godam( $file );
		$meta      = wp_read_image_metadata( $temp_file );
		add_filter( 'wp_read_image_metadata', array( $this, 'wp_filter_read_image_metadata' ), 10, 2 );
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
		unlink( $temp_file );
		return $meta;
	}

	/**
	 * Add the DNS address for the GoDAM Bucket to list for DNS prefetch.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $hints Hints for prefetching.
	 * @param string $relation_type The relation type, e.g. 'dns-prefetch'.
	 * @return array
	 */
	public function wp_filter_resource_hints( $hints, $relation_type ) {
		if ( 'dns-prefetch' === $relation_type ) {
			$hints[] = $this->get_remote_url();
		}

		return $hints;
	}

	/**
	 * Get a local copy of the file.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file The file path to copy from.
	 * @return string
	 */
	public function copy_image_from_godam( $file ) {
		if ( ! function_exists( 'wp_tempnam' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		$temp_filename = wp_tempnam( $file );
		copy( $file, $temp_filename );
		return $temp_filename;
	}

	/**
	 * Validate the file before we allow uploading it.
	 *
	 * @since n.e.x.t
	 *
	 * @param  string[] $file An array of data for a single file.
	 */
	public function filter_validate_file( $file ) {
		$file_name   = rawurlencode( $file['name'] );
		$upload_path = trailingslashit( wp_get_upload_dir()['path'] );
		$file_path   = $upload_path . $file_name;

		$check_file_name = $this->validate_file_name( $file_path );
		if ( is_wp_error( $check_file_name ) ) {
			$file['error'] = $check_file_name->get_error_message();

			return $file;
		} elseif ( $check_file_name !== $file_name ) {
			$file['name'] = $check_file_name;
			$file_path    = $upload_path . $check_file_name;
		}

		$check_length = $this->validate_file_path_length( $file_path );
		if ( is_wp_error( $check_length ) ) {
			$file['error'] = $check_length->get_error_message();

			return $file;
		}

		return $file;
	}

	/**
	 * Use the VIP Filesystem API to check for filename uniqueness
	 *
	 * The `unique_filename` API will return an error if file type is not supported
	 * by the VIP Filesystem.
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $file_path   Path starting with /wp-content/uploads.
	 *
	 * @return  WP_Error|string        Unique Filename string if filetype is supported. Else WP_Error.
	 */
	protected function validate_file_name( $file_path ) {
		$result = $this->client->get_unique_filename( $file_path );

		if ( is_wp_error( $result ) ) {
			if ( 'invalid-file-type' !== $result->get_error_code() ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error
				trigger_error(
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					sprintf( '%s #godam-streams', $result->get_error_message() ),
					E_USER_WARNING
				);
			}
		}

		return $result;
	}

	/**
	 * Check if file path in within the allowed length.
	 *
	 * @since n.e.x.t
	 *
	 * @param  string $file_path Path starting with /wp-content/uploads.
	 */
	protected function validate_file_path_length( $file_path ) {
		if ( mb_strlen( $file_path ) > self::MAX_FILE_PATH_LENGTH ) {
			return new WP_Error( 'path-too-long', sprintf( 'The file name and path cannot exceed %d characters. Please rename the file to something shorter and try again.', self::MAX_FILE_PATH_LENGTH ) );
		}

		return true;
	}

	/**
	 * Set up URL filtering system.
	 *
	 * @since n.e.x.t
	 */
	public function setup_url_filters() {
		// Only setup if GoDAM filesystem is enabled.
		if ( ! $this->is_enabled() ) {
			return;
		}

		// Avoid double initialization.
		if ( $this->filter_local_to_godam || $this->filter_godam_to_local || $this->media_library_filters ) {
			return;
		}

		// Initialize filter classes.
		$this->filter_local_to_godam = new Local_To_GoDAM( $this );
		$this->filter_godam_to_local = new GoDAM_To_Local( $this );
		$this->media_library_filters = new Media_Library( $this );

		// Trigger setup action.
		do_action( 'rtgodam_filters_setup' );
	}

	/**
	 * Check if GoDAM filesystem is enabled.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool True if enabled.
	 */
	public function is_enabled() {
		// For now, always return true if the plugin is active.
		// You can add settings logic here later.
		return true;
	}

	/**
	 * Get the local to GoDAM filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @return ?Local_To_GoDAM
	 */
	public function get_local_to_godam_filter() {
		return $this->filter_local_to_godam;
	}

	/**
	 * Get the GoDAM to local filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @return ?GoDAM_To_Local
	 */
	public function get_godam_to_local_filter() {
		return $this->filter_godam_to_local;
	}

	/**
	 * Get the media library filter instance.
	 *
	 * @since n.e.x.t
	 *
	 * @return ?Media_Library
	 */
	public function get_media_library_filters() {
		return $this->media_library_filters;
	}
}
