<?php
/**
 * Class to handle GoDAM Stream Wrapper.
 *
 * This class implements a custom stream wrapper for GoDAM, allowing
 * interaction with files stored in the GoDAM Files API.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

use RTGODAM\Inc\Helpers\Debug;

// phpcs:disable WordPress.PHP.DevelopmentFunctions.error_log_trigger_error
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_read_fopen
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fopen
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fread
// phpcs:disable WordPressVIPMinimum.Performance.FetchingRemoteData.FileGetContentsUnknown
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_rename
// phpcs:disable WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents

/**
 * Class Stream_Wrapper
 *
 * This class implements a custom stream wrapper for GoDAM, allowing
 * interaction with files stored in the GoDAM Files API.
 *
 * @since n.e.x.t
 *
 * @package RTGODAM\Inc\Filesystem
 */
class Stream_Wrapper {

	/**
	 * Default protocol.
	 *
	 * @since n.e.x.t
	 */
	const DEFAULT_PROTOCOL = 'godam';

	/**
	 * Allowed fopen modes.
	 *
	 * We are ignoring `b`, `t` and `+` modes as they do not affect how this
	 * Stream Wrapper works.
	 * Not supporting `c` and `e` modes as these are rarely used and adds complexity
	 * to support.
	 *
	 * @since n.e.x.t
	 */
	const ALLOWED_MODES = array( 'r', 'w', 'a', 'x' );

	/**
	 * The Stream context. Set by PHP.
	 *
	 * @since n.e.x.t
	 *
	 * @var     resource|null   Stream context.
	 */
	public $context;

	/**
	 * The GoDAM Files API Client.
	 *
	 * @since n.e.x.t
	 *
	 * @var     API_Client  GoDAM Files API Client.
	 */
	public $client;

	/**
	 * The fopen mode for current file.
	 *
	 * @since n.e.x.t
	 *
	 * @var     string      The fopen mode.
	 */
	protected $mode;

	/**
	 * The file resource fetched through the GoDAM Files API.
	 *
	 * @since n.e.x.t
	 *
	 * @var     resource    The file resource.
	 */
	protected $file;

	/**
	 * The path to the opened file.
	 *
	 * @since n.e.x.t
	 *
	 * @var     string      Opened path.
	 */
	protected $path;

	/**
	 * The temp file URI.
	 *
	 * @since n.e.x.t
	 *
	 * @var     string      The file URI.
	 */
	protected $uri;

	/**
	 * Is file seekable.
	 *
	 * @since n.e.x.t
	 *
	 * @var     bool        Is seekable.
	 */
	protected $seekable;

	/**
	 * Protocol for the stream to register to.
	 *
	 * @since n.e.x.t
	 *
	 * @var string  The defined protocol.
	 */
	private $protocol = self::DEFAULT_PROTOCOL;


	/**
	 * Flush empty file flag.
	 *
	 * Flag to determine if an empty file should be flushed to the
	 * Filesystem.
	 *
	 * @since n.e.x.t
	 *
	 * @var     bool    Should flush empty file.
	 */
	private $should_flush_empty;

	/**
	 * The options for the stream wrapper.
	 *
	 * @since n.e.x.t
	 *
	 * @var     array   Options for the stream wrapper.
	 */
	public static ?API_Client $default_client = null;

	/**
	 * HashMap for exact filename lookups to provide O(1) performance
	 *
	 * @since n.e.x.t
	 *
	 * @var array
	 */
	private static $local_files_map = array();

	/**
	 * HashMap of wildcard patterns for local files
	 *
	 * @since n.e.x.t
	 *
	 * @var array
	 */
	private static $local_file_patterns = array();

	/**
	 * File handle for local files
	 *
	 * @since n.e.x.t
	 *
	 * @var resource|null
	 */
	private $handle;

	/**
	 * Array of directories to be used for local files
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string, string> Associative array where keys are directory names and values are their paths.
	 */
	private array $directories;

	/**
	 * Directory index file name
	 *
	 * This is used to determine if a directory is empty or not.
	 * If the directory contains this file, it is considered empty.
	 *
	 * @since n.e.x.t
	 *
	 * @var     int  The directory index file name
	 */
	private int $directory_index;

	/**
	 * Initialize the stream wrapper.
	 *
	 * @since n.e.x.t
	 *
	 * @param Plugin $plugin The plugin instance to use for the stream wrapper.
	 * @param string $protocol The protocol to use for the stream wrapper.
	 * @param null   $cache Optional cache adapter to use for caching file stats.
	 */
	public static function register( Plugin $plugin, $protocol = 'godam', $cache = null ) {
		if ( in_array( $protocol, stream_get_wrappers() ) ) {
			stream_wrapper_unregister( $protocol );
		}

		// Set the client passed in as the default stream context client.
		stream_wrapper_register( $protocol, get_called_class(), STREAM_IS_URL );

		$default                        = stream_context_get_options( stream_context_get_default() );
		$default[ $protocol ]['plugin'] = $plugin;
		$default[ $protocol ]['client'] = $plugin->client();

		if ( $cache ) {
			$default[ $protocol ]['cache'] = $cache;
		} elseif ( ! isset( $default[ $protocol ]['cache'] ) ) {
			// Set a default cache adapter.
			$default[ $protocol ]['cache'] = API_Cache::get_instance();
		}

		stream_context_set_default( $default );
	}

	/**
	 * Opens a file
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path URL that was passed to the original function.
	 * @param   string $mode Type of access. See `fopen` docs.
	 *
	 * @return  bool    True on success or false on failure
	 */
	public function stream_open( string $path, string $mode ): bool {
		$this->path = $path;
		$this->uri  = $path;

		// Check if this is a file that should be handled locally.
		if ( static::is_local_file( $path ) ) {
			$local_path = static::get_local_tmp_path( $path );

			// Create directory if it doesn't exist for write modes.
			if ( strpos( $mode, 'w' ) !== false || strpos( $mode, 'a' ) !== false || strpos( $mode, 'x' ) !== false || strpos( $mode, 'c' ) !== false ) {
				$dir = dirname( $local_path );
				if ( ! file_exists( $dir ) ) {
					\wp_mkdir_p( $dir );
				}
			}

			$this->handle = fopen( $local_path, $mode );

			if ( ! $this->handle ) {
				return false;
			}

			return true;
		}

		// Original implementation for non-local files.
		$path = $this->trim_path( $path );
		// Also ignore '+' modes since the handlers are all read+write anyway.
		$mode = rtrim( $mode, 'bt+' );

		if ( ! $this->validate( $path, $mode ) ) {
			return false;
		}

		try {
			$result = $this->options( 'client' )->get_file( $path );

			if ( is_wp_error( $result ) ) {
				if ( 'file-not-found' !== $result->get_error_code() || 'r' === $mode ) {
					trigger_error(
						sprintf( 'stream_open/get_file failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $result->get_error_message() ) ),
						E_USER_WARNING
					);

					return false;
				}

				// File doesn't exist on File service so create new file.
				$file = $this->string_to_resource( '', $mode );
			} else {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
				$file = fopen( $result, $mode );
			}

			// Get meta data.
			$meta           = stream_get_meta_data( $file );
			$this->seekable = $meta['seekable'];
			$this->uri      = $meta['uri'];

			$this->file = $file;
			$this->path = $path;
			$this->mode = $mode;

			// Cache file stats so that calls to url_stat will work.
			$stats = fstat( $file );
			$this->options( 'cache' )->cache_file_stats(
				$path,
				array(
					'size'  => $stats['size'],
					'mtime' => $stats['mtime'],
				)
			);

			return true;
		} catch ( \Exception $e ) {
			trigger_error(
				sprintf( 'stream_open failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $e->getMessage() ) ),
				E_USER_WARNING
			);

			return false;
		}
	}

	/**
	 * Close a file
	 *
	 * @since n.e.x.t
	 */
	public function stream_close() {
		Debug::info( sprintf( 'stream_close => %s + %s', $this->path, $this->uri ) );

		$result = true;

		// If this is a local file, close the local file handle.
		if ( static::is_local_file( $this->uri ) && $this->handle ) {
			$result       = fclose( $this->handle );
			$this->handle = null;
		}

		// Don't attempt to flush new file when in read mode.
		if ( $this->should_flush_empty && 'r' !== $this->mode ) {
			$result = $this->stream_flush();
		}

		return $this->close_handler( $this->file ) && $result;
	}

	/**
	 * Check for end of file
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool
	 */
	public function stream_eof() {
		// If this is a local file, use the local file handle.
		if ( static::is_local_file( $this->uri ) && $this->handle ) {
			return feof( $this->handle );
		}

		// Original implementation for non-local files.
		if ( ! $this->file ) {
			return true;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_feof
		return feof( $this->file );
	}

	/**
	 * Read the contents of the file
	 *
	 * @since n.e.x.t
	 *
	 * @param string $count of bytes to read.
	 *
	 * @return  string  The file contents
	 */
	public function stream_read( $count ) {
		Debug::info( sprintf( 'stream_read => %s + %s + %s', $count, $this->path, $this->uri ) );

		// If this is a local file, use the local file handle.
		if ( static::is_local_file( $this->uri ) && $this->handle ) {
			return fread( $this->handle, $count );
		}

		// Original implementation for non-local files.
		if ( ! $this->file ) {
			return false;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
		$string = fread( $this->file, $count );
		if ( false === $string ) {
			trigger_error(
				sprintf( 'Error reading from file: %s #godam-streams', esc_html( $this->path ) ),
				E_USER_WARNING
			);
			return '';
		}

		return $string;
	}

	/**
	 * Flush to a file
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool    True on success. False on failure
	 */
	public function stream_flush() {
		Debug::info( sprintf( 'stream_flush =>  %s + %s', $this->path, $this->uri ) );

		if ( ! $this->file ) {
			return false;
		}

		if ( 'r' === $this->mode ) {
			// No writes in 'read' mode.
			trigger_error(
				sprintf( 'stream_flush failed for %s with error: No writes allowed in "read" mode #godam-streams', esc_html( $this->path ) ),
				E_USER_WARNING
			);

			return false;
		}

		try {
			// Upload to file service.
			$result = $this->options( 'client' )->upload_file( $this->uri, $this->path );
			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'stream_flush failed for %s with error: %s #godam-streams', esc_html( $this->path ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				if ( $this->should_flush_empty ) {
					$this->should_flush_empty = false;

					/**
					 * The API client does not have a method to clear file stats cache;
					 * However, if we pass an empty array, this effectively clears the cache.
					 * See API_Client::is_file(): if $stats is empty, it calls the API.
					 *
					 * We have to clear the cache because we have failed to upload the file;
					 * as a result, it was not create on the remote end.
					 */
					$this->options( 'cache' )->cache_file_stats( $this->path, array() );
				}

				return false;
			}

			$this->should_flush_empty = false;
			return fflush( $this->file );
		} catch ( \Exception $e ) {
			trigger_error(
				sprintf( 'stream_flush failed for %s with error: %s #godam-streams', esc_html( $this->path ), esc_html( $e->getMessage() ) ),
				E_USER_WARNING
			);

			return false;
		}
	}

	/**
	 * Seek a pointer position on a file
	 *
	 * @since n.e.x.t
	 *
	 * @param   int $offset The offset to seek to.
	 * @param   int $whence The position from where to seek.
	 *
	 * @return  bool  True if position was updated, False if not
	 */
	public function stream_seek( $offset, $whence ) {
		Debug::info( sprintf( 'stream_seek =>  %s + %s + %s + %s', $offset, $whence, $this->path, $this->uri ) );

		if ( ! $this->seekable ) {
			// File not seekable.
			trigger_error(
				sprintf( 'File not seekable: %s #godam-streams', esc_html( $this->path ) ),
				E_USER_WARNING
			);
			return false;
		}

		$result = fseek( $this->file, $offset, $whence );

		if ( -1 === $result ) {
			// Seek failed.
			trigger_error(
				sprintf( 'Error seeking on file: %s #godam-streams', esc_html( $this->path ) ),
				E_USER_WARNING
			);
			return false;
		}

		return true;
	}

	/**
	 * Write to a file
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $data   The data to be written.
	 *
	 * @return  int|bool    Number of bytes written or false on error
	 */
	public function stream_write( $data ) {
		Debug::info( sprintf( 'stream_write =>  %s + %s', $this->path, $this->uri ) );

		// If this is a local file, use the local file handle.
		if ( static::is_local_file( $this->uri ) && $this->handle ) {
			return fwrite( $this->handle, $data );
		}

		// Original implementation for non-local files.
		if ( ! $this->file ) {
			return 0;
		}

		if ( 'r' === $this->mode ) {
			// No writes in 'read' mode.
			trigger_error(
				sprintf( 'stream_write failed for %s with error: No writes allowed in "read" mode #godam-streams', esc_html( $this->path ) ),
				E_USER_WARNING
			);

			return false;
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite
		$length = fwrite( $this->file, $data );

		if ( false === $length ) {
			trigger_error(
				sprintf( 'Error writing to file: %s #godam-stream', esc_html( $this->path ) ),
				E_USER_WARNING
			);
			return false;
		}

		$this->should_flush_empty = false;

		return $length;
	}

	/**
	 * Delete a file
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path Path to the file to delete.
	 *
	 * @return  bool    True if success. False on failure
	 */
	public function unlink( $path ) {
		// Check if this is a file that should be handled locally.
		if ( static::is_local_file( $path ) ) {
			$local_path = static::get_local_tmp_path( $path );

			if ( ! file_exists( $local_path ) ) {
				return false;
			}

			return unlink( $local_path );
		}

		// Original implementation for non-local files.
		$path = $this->trim_path( $path );

		try {
			$result = $this->options( 'client' )->delete_file( $path );

			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'unlink failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				return false;
			}

			$this->close_handler();

			return true;
		} catch ( \Exception $e ) {
			trigger_error(
				sprintf( 'unlink failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $e->getMessage() ) ),
				E_USER_WARNING
			);

			return false;
		}
	}

	/**
	 * Get file stats
	 *
	 * @since n.e.x.t
	 *
	 * @return  array   The file statistics
	 */
	public function stream_stat() {
		// If this is a local file, use the local file handle.
		if ( static::is_local_file( $this->uri ) && $this->handle ) {
			return fstat( $this->handle );
		}

		// Original implementation for non-local files.
		if ( $this->file ) {
			return fstat( $this->file );
		}

		return array(
			0         => 0,
			'dev'     => 0,
			1         => 0,
			'ino'     => 0,
			2         => 0,
			'mode'    => 0,
			3         => 0,
			'nlink'   => 0,
			4         => 0,
			'uid'     => 0,
			5         => 0,
			'gid'     => 0,
			6         => -1,
			'rdev'    => -1,
			7         => 0,
			'size'    => 0,
			8         => 0,
			'atime'   => 0,
			9         => 0,
			'mtime'   => 0,
			10        => 0,
			'ctime'   => 0,
			11        => -1,
			'blksize' => -1,
			12        => -1,
			'blocks'  => -1,
		);
	}

	/**
	 * Get file stats by path
	 *
	 * Use by functions like is_dir, file_exists etc.
	 * See: http://php.net/manual/en/streamwrapper.url-stat.php
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path Path to the file or directory.
	 * @param   int    $flags Flags to modify the behavior of the function.
	 *
	 * @return  array|bool  The file statistics or false if failed
	 */
	public function url_stat( $path, $flags ) {
		$this->path = $path;
		$this->uri  = $path;

		// Check if this is a file that should be handled locally.
		if ( static::is_local_file( $path ) ) {
			$local_path = static::get_local_tmp_path( $path );

			if ( ! file_exists( $local_path ) ) {
				if ( ! ( $flags & STREAM_URL_STAT_QUIET ) ) {
					trigger_error( 'stat(): stat failed for ' . esc_html( $path ), E_USER_WARNING );
				}

				return false;
			}

			return stat( $local_path );
		}

		// Original implementation for non-local files.
		$path = $this->trim_path( $path );

		// Default stats.
		$stats = array(
			0         => 0,
			'dev'     => 0,
			1         => 0,
			'ino'     => 0,
			2         => 16895,
			'mode'    => 16895,
			3         => 0,
			'nlink'   => 0,
			4         => 0,
			'uid'     => 0,
			5         => 0,
			'gid'     => 0,
			6         => -1,
			'rdev'    => -1,
			7         => 0,
			'size'    => 0,
			8         => 0,
			'atime'   => 0,
			9         => 0,
			'mtime'   => 0,
			10        => 0,
			'ctime'   => 0,
			11        => -1,
			'blksize' => -1,
			12        => -1,
			'blocks'  => -1,
		);

		$extension = pathinfo( $path, PATHINFO_EXTENSION );
		/**
		 * If the file is actually just a path to a directory
		 * then return it as always existing. This is to work
		 * around wp_upload_dir doing file_exists checks on
		 * the uploads directory on every page load.
		 *
		 * Added by Joe Hoyle
		 *
		 * Hanif's note: Copied from humanmade's S3 plugin
		 *              https://github.com/humanmade/S3-Uploads
		 */
		if ( ! $extension ) {
			return $stats;
		}

		try {
			$info   = array();
			$result = $this->options( 'client' )->get_stats( $path, $info );
			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'url_stat failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				return false;
			}

			if ( ! $result ) {
				// File not found, return default stats for file.
				return false;
			}

			// Here we should parse the meta data into the statistics array.
			// and then combine with data from `is_file` API.
			// see: http://php.net/manual/en/function.stat.php.
			$stats['mode']  = 33206; // read+write permissions.
			$stats['size']  = (int) $info['size'];
			$stats['atime'] = (int) $info['mtime'];
			$stats['mtime'] = (int) $info['mtime'];
			$stats['ctime'] = (int) $info['mtime'];
			$stats[2]       = $stats['mode'];
			$stats[7]       = $stats['size'];
			$stats[8]       = $stats['atime'];
			$stats[9]       = $stats['mtime'];
			$stats[10]      = $stats['ctime'];

			return $stats;
		} catch ( \Exception $e ) {
			trigger_error(
				sprintf( 'url_stat failed for %s with error: %s #godam-streams', esc_html( $path ), esc_html( $e->getMessage() ) ),
				E_USER_WARNING
			);

			return false;
		}
	}

	/**
	 * This method is called in response to fseek() to determine the current position.
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool|int    Returns current position or false on failure
	 */
	public function stream_tell() {
		Debug::info( sprintf( 'stream_tell =>  %s + %s', $this->path, $this->uri ) );

		return $this->file ? ftell( $this->file ) : false;
	}

	/**
	 * Called in response to rename() to rename a file or directory.
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path_from  Path to file to rename.
	 * @param   string $path_to    New path to the file.
	 *
	 * @return  bool    True on successful rename
	 */
	public function rename( $path_from, $path_to ) {
		// If source and destination paths are the same, return true (no action needed).
		if ( $path_from === $path_to ) {
			return true;
		}

		// Check if source is a local file.
		$from_is_local = static::is_local_file( $path_from );
		// Check if destination is a local file.
		$to_is_local = static::is_local_file( $path_to );

		// Both source and destination are local files.
		if ( $from_is_local && $to_is_local ) {
			$local_from = static::get_local_tmp_path( $path_from );
			$local_to   = static::get_local_tmp_path( $path_to );

			if ( ! file_exists( $local_from ) ) {
				return false;
			}

			// Create directory for destination if it doesn't exist.
			$dir = dirname( $local_to );
			if ( ! file_exists( $dir ) ) {
				\wp_mkdir_p( $dir );
			}

			return rename( $local_from, $local_to );
		} elseif ( $from_is_local && ! $to_is_local ) { // // Source is local but destination is not.
			$local_from = static::get_local_tmp_path( $path_from );

			if ( ! file_exists( $local_from ) ) {
				return false;
			}

			// Read content from local file.
			$content = file_get_contents( $local_from );
			if ( false === $content ) {
				return false;
			}

			// Trim the destination path.
			$path_to = $this->trim_path( $path_to );

			// Create a temporary file with the content.
			$tmp_file = tmpfile();
			fwrite( $tmp_file, $content );
			rewind( $tmp_file );

			// Write content to remote file.
			$result = $this->options( 'client' )->upload_file( $tmp_file, $path_to );

			// Close the temporary file.
			fclose( $tmp_file );

			// If successful, delete the local file.
			if ( $result ) {
				unlink( $local_from );
			}

			return $result;
		} elseif ( ! $from_is_local && $to_is_local ) { // Source is not local but destination.
			// Trim the source path.
			$path_from = $this->trim_path( $path_from );

			// Get content from remote file.
			$content = $this->options( 'client' )->get_file( $path_from );
			if ( false === $content ) {
				return false;
			}

			// Write content to local file.
			$local_to = static::get_local_tmp_path( $path_to );

			// Create directory for destination if it doesn't exist.
			$dir = dirname( $local_to );
			if ( ! file_exists( $dir ) ) {
				\wp_mkdir_p( $dir );
			}

			$result = file_put_contents( $local_to, $content ) !== false;

			// If successful, delete the remote file.
			if ( $result ) {
				$this->options( 'client' )->delete_file( $path_from );
			}

			return $result;
		}

		// Original implementation for non-local files.
		$path_from = $this->trim_path( $path_from );
		$path_to   = $this->trim_path( $path_to );

		try {
			// Get original file first.
			// Note: Subooptimal. Should figure out a way to do this without downloading the file as this could.
			// get really inefficient with large files.
			$result = $this->options( 'client' )->get_file( $path_from );
			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'rename/get_file/from failed for %s with error: %s #godam-streams', esc_html( $path_from ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				return false;
			}

			// Convert to actual file to upload to new path.
			$file      = fopen( $result, 'r' );          // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			$meta      = stream_get_meta_data( $file );
			$file_path = $meta['uri'];

			// Upload to file service.
			$result = $this->options( 'client' )->upload_file( $file_path, $path_to );
			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'rename/upload_file/to failed for %s with error: %s #godam-streams', esc_html( $file_path ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				return false;
			}

			// Delete old file.
			$result = $this->options( 'client' )->delete_file( $path_from );
			if ( is_wp_error( $result ) ) {
				trigger_error(
					sprintf( 'rename/delete_file/from failed for %s with error: %s #godam-streams', esc_html( $path_from ), esc_html( $result->get_error_message() ) ),
					E_USER_WARNING
				);

				return false;
			}

			return true;
		} catch ( \Exception $e ) {
			trigger_error(
				sprintf( 'rename/delete_file/from failed for %s with error: %s #godam-streams', esc_html( $path_from ), esc_html( $e->getMessage() ) ),
				E_USER_WARNING
			);

			return false;
		}
	}

	/**
	 * Called in response to mkdir()
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path The path to the directory to create.
	 * @param int    $mode Mode to set on the directory.
	 * @param int    $options Options for the directory creation.
	 *
	 * @return  bool
	 */
	public function mkdir( string $path, int $mode, int $options ): bool { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- args needed by spec
		// Check if this is a file that should be handled locally.
		if ( static::is_local_file( $path ) ) {
			$local_path = static::get_local_tmp_path( $path );

			if ( file_exists( $local_path ) ) {
				return false;
			}

			return \wp_mkdir_p( $local_path );
		}

		return true;
	}

	/**
	 * Set metadata on a stream
	 *
	 * @since n.e.x.t
	 *
	 * @link http://php.net/manual/en/streamwrapper.stream-metadata.php
	 *
	 * @param   string $path The path to the file or directory.
	 * @param   int    $option The option to set. One of the STREAM_META_* constants.
	 * @param   mixed  $value Value to set for the option.
	 *
	 * @return  bool
	 */
	public function stream_metadata( $path, $option, $value ) {
		Debug::info( sprintf( 'stream_metadata =>  %s + %s + %s', $path, $option, json_encode( $value ) ) );   // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode

		switch ( $option ) {
			case STREAM_META_TOUCH:
				if ( false === file_exists( $path ) ) {
					$file = fopen( $path, 'w' );    // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
					if ( is_resource( $file ) ) {
						$result = fflush( $file );
						return fclose( $file ) && $result;
					}

					return false;
				}

				return true;

			default:
				return false;
		}
	}

	/**
	 * Called in response to stream_select()
	 *
	 * @since n.e.x.t
	 *
	 * @link http://php.net/manual/en/streamwrapper.stream-castt.php
	 *
	 * @param   int $cast_as The type of cast to perform.
	 *
	 * @return  resource|bool
	 */
	public function stream_cast( $cast_as ) {
		Debug::info( sprintf( 'stream_cast =>  %s + %s + %s', $cast_as, $this->path, $this->uri ) );

		if ( ! is_null( $this->file ) ) {
			return $this->file;
		}

		return false;
	}

	/**
	 * Open a directory handler
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path   The path to the directory to open.
	 *
	 * @return  bool    True on success. False on failure.
	 */
	public function dir_opendir( $path ) {
		$this->path = $path;

		// List the directory contents.
		$directories = $this->options( 'client' )->listdir( $this->path );

		if ( is_wp_error( $directories ) || ! is_array( $directories ) ) {
			return false;
		}

		$this->directories     = $directories;
		$this->directory_index = 0;

		return true;
	}

	/**
	 * Read the next directory entry
	 *
	 * @since n.e.x.t
	 *
	 * @return  string|bool    The next directory entry or false if no more entries
	 */
	public function dir_readdir() {
		if ( $this->directory_index < count( $this->directories ) ) {
			return $this->directories[ $this->directory_index++ ];
		}
		return false;
	}

	/**
	 * Rewind the directory handler to the start
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool    True on success. False on failure.
	 */
	public function dir_rewinddir() {
		$this->directory_index = 0;
		return true;
	}

	/**
	 * Close the directory handler
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool    True on success. False on failure.
	 */
	public function dir_closedir() {
		$this->directories     = array();
		$this->directory_index = 0;
		return true;
	}

	/**
	 * Write file to a temporary resource handler
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $data   The file content to be written.
	 * @param   string $mode   The fopen mode.
	 *
	 * @return  resource   Returns resource or false on write error
	 */
	protected function string_to_resource( $data, $mode ) {
		// Create a temporary file.
		$tmp_handler = tmpfile();
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite
		if ( false === fwrite( $tmp_handler, $data ) ) {
			trigger_error( 'Error creating temporary resource #godam-streams', E_USER_ERROR );
		}

		switch ( $mode ) {
			case 'a':
				// Make sure pointer is at end of file for appends.
				fseek( $tmp_handler, 0, SEEK_END );
				break;
			default:
				// Need to rewind file pointer as fwrite moves it to EOF.
				rewind( $tmp_handler );
		}

		return $tmp_handler;
	}

	/**
	 * Closes the open file handler
	 *
	 * @since n.e.x.t
	 *
	 * @return  bool        True on success. False on failure.
	 */
	protected function close_handler() {
		if ( ! $this->file ) {
			return true;
		}

		$result = fclose( $this->file );

		if ( $result ) {
			$this->file = null;
			$this->path = null;
			$this->uri  = null;
			$this->mode = null;
		}

		return $result;
	}

	/**
	 * Get the stream context options available to the current stream
	 *
	 * @since n.e.x.t
	 *
	 * @param string $option           The option to return. If empty, returns all options.
	 * @param bool   $remove_context_data Set to true to remove contextual kvp's
	 *                                  like 'client' from the result.
	 *
	 * @return array|API_Client|API_Cache|null
	 */
	private function options( $option = '', $remove_context_data = false ) {
		// Context is not set when doing things like stat.
		if ( null === $this->context ) {
			$options = array();
		} else {
			$options = stream_context_get_options( $this->context );
			/** @var array{client?: API_Client, cache?: API_Cache, Bucket: string, Key: string, acl: string, seekable?: bool} $options */
			$options = $options[ $this::DEFAULT_PROTOCOL ] ?? array();
		}

		$default = stream_context_get_options( stream_context_get_default() );
		/** @var array{client?: API_Client, cache?: API_Cache, Bucket: string, Key: string, acl: string, seekable?: bool} $default */
		$default = $default[ $this::DEFAULT_PROTOCOL ] ?? array();
		/** @var array{client?: API_Client, cache?: API_Cache, Bucket: string, Key: string, acl: string, seekable?: bool} $default */
		$result = $options + $default;

		if ( $remove_context_data ) {
			unset( $result['client'], $result['seekable'], $result['cache'] );
		}

		if ( $option ) {
			return $result[ $option ] ?? null;
		}

		return $result;
	}

	/**
	 * Converted the protocol file path into something the File Service
	 * API client can use
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path       Original protocol path.
	 *
	 * @return  string      Modified path
	 */
	protected function trim_path( $path ) {
		return ltrim( $path, 'godam:/\\' );
	}

	/**
	 * Validates the provided stream arguments for fopen.
	 *
	 * @since n.e.x.t
	 *
	 * @param   string $path   Path to file.
	 * @param   string $mode   fopen mode.
	 *
	 * @return  bool
	 */
	public function validate( $path, $mode ) {
		if ( ! in_array( $mode, static::ALLOWED_MODES, true ) ) {
			trigger_error( esc_html( "Mode not supported: { $mode }. Use one 'r', 'w', 'a', or 'x'." ) );

			return false;
		}

		// When using mode "x" validate if the file exists before attempting.
		// to read.
		if ( 'x' === $mode ) {
			try {
				$info   = array();
				$result = $this->options( 'client' )->is_file( $path, $info );
				if ( is_wp_error( $result ) ) {
					trigger_error(
						sprintf(
							'fopen mode validation failed for mode %s on path %s with error: %s #godam-streams',
							esc_html( $mode ),
							esc_html( $path ),
							esc_html( $result->get_error_message() )
						),
						E_USER_WARNING
					);

					return false;
				}

				if ( $result ) {
					// File already exists.
					trigger_error(
						sprintf( 'File %s already exists. Cannot use mode %s', esc_html( $path ), esc_html( $mode ) )
					);

					return false;
				}

				return true;
			} catch ( \Exception $e ) {
				trigger_error(
					sprintf(
						'fopen mode validation failed for mode %s on path %s with error: %s #godam-streams',
						esc_html( $mode ),
						esc_html( $path ),
						esc_html( $e->getMessage() )
					),
					E_USER_WARNING
				);

				return false;
			}
		}

		return true;
	}

	/**
	 * Add a file to the list of files that should be handled locally.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path Path to the file or a pattern.
	 * @return bool True if the file was added, false otherwise
	 */
	public static function add_local_file( $file_path ) {
		if ( empty( $file_path ) || ! is_string( $file_path ) ) {
			return false;
		}

		// Check if pattern contains wildcards (* or ? or [).
		$is_pattern = strpbrk( $file_path, '*?[' ) !== false;
		str_contains( $file_path, '[' );

		if ( $is_pattern ) {
			static::$local_file_patterns[ $file_path ] = true;
		} else {
			static::$local_files_map[ $file_path ] = true;
		}

		return true;
	}

	/**
	 * Remove a file from the list of files that should be handled locally
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path Path to the file or pattern.
	 * @return bool True if the file was removed, false otherwise
	 */
	public static function remove_local_file( $file_path ) {
		unset( static::$local_file_patterns[ $file_path ] );
		unset( static::$local_files_map[ $file_path ] );
		return true;
	}

	/**
	 * Get the list of files that should be handled locally
	 *
	 * @since n.e.x.t
	 *
	 * @return array List of file paths and patterns
	 */
	public static function get_local_files() {
		return array_merge( static::$local_files_map, static::$local_file_patterns );
	}

	/**
	 * Check if a file should be handled locally
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path Path to the file.
	 * @return bool True if the file should be handled locally, false otherwise
	 */
	public static function is_local_file( $file_path ) {
		// O(1) check for exact matches.
		if ( isset( static::$local_files_map[ $file_path ] ) ) {
			return true;
		}

		// Check against wildcard patterns.
		foreach ( static::$local_file_patterns as $pattern => $value ) {
			if ( fnmatch( $pattern, $file_path, FNM_PATHNAME ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get the local path for a file in the tmp directory
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path Original file path.
	 * @return string Local path in the tmp directory
	 */
	private static function get_local_tmp_path( $file_path ) {
		// Extract the wp-content part of the path.
		if ( preg_match( '#(wp-content/.+)$#', $file_path, $matches ) ) {
			$relative_path = $matches[1];
		} elseif ( strpos( $file_path, 'godam://' ) === 0 ) {
			// Handle godam:// paths.
			$relative_path = substr( $file_path, 6 ); // Remove 'godam://' prefix.
		} else {
			// Fallback - use the full path structure.
			$relative_path = ltrim( $file_path, '/' );
		}

		$tmp_path = get_temp_dir() . $relative_path;

		// Ensure the directory exists.
		$dir = dirname( $tmp_path );
		if ( ! file_exists( $dir ) ) {
			\wp_mkdir_p( $dir );
		}

		return $tmp_path;
	}
}
