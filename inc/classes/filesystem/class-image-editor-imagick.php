<?php
/**
 * Class to handle image editing with Imagick.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

use Imagick;
use WP_Error;
use WP_Image_Editor_Imagick;

/**
 * Class Image_Editor_Imagick
 *
 * This class extends WP_Image_Editor_Imagick to handle image editing
 * specifically for GoDAM, allowing for remote file handling and temporary
 * file management.
 *
 * @since n.e.x.t
 */
class Image_Editor_Imagick extends WP_Image_Editor_Imagick {

	/**
	 * @since n.e.x.t
	 *
	 * @var ?Imagick
	 */
	protected $image;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?string
	 */
	protected $file;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?array{width: int, height: int}
	 */
	protected $size;

	/**
	 * @since n.e.x.t
	 *
	 * @var ?string
	 */
	protected $remote_filename = null;

	/**
	 * Hold on to a reference of all temp local files.
	 *
	 * These are cleaned up on __destruct.
	 *
	 * @since n.e.x.t
	 *
	 * @var array
	 */
	protected $temp_files_to_cleanup = array();

	/**
	 * Loads image from $this->file into new Imagick Object.
	 *
	 * @since n.e.x.t
	 *
	 * @return true|WP_Error True if loaded; WP_Error on failure.
	 */
	public function load() {
		if ( $this->image instanceof Imagick ) {
			return true;
		}

		if ( $this->file && ! is_file( $this->file ) && ! preg_match( '|^https?://|', $this->file ) ) {
			return new WP_Error( 'error_loading_image', __( 'File doesn&#8217;t exist?', 'godam' ), $this->file );
		}

		$upload_dir = wp_upload_dir();

		if ( ! $this->file || strpos( $this->file, $upload_dir['basedir'] ) !== 0 ) {
			return parent::load();
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_tempnam
		$temp_filename                 = tempnam( get_temp_dir(), 'godam-uploads' );
		$this->temp_files_to_cleanup[] = $temp_filename;

		copy( $this->file, $temp_filename );
		$this->remote_filename = $this->file;
		$this->file            = $temp_filename;

		$result = parent::load();

		$this->file = $this->remote_filename;
		return $result;
	}

	/**
	 * Imagick by default can't handle godam:// paths
	 * for saving images. We have instead save it to a file file,
	 * then copy it to the godam:// path as a workaround.
	 *
	 * @since n.e.x.t
	 *
	 * @param Imagick $image Imagick object to save.
	 * @param ?string $filename Filename to save the image to.
	 * @param ?string $mime_type Mime type of the image.
	 * @return WP_Error|array{path: string, file: string, width: int, height: int, mime-type: string}
	 */
	protected function _save( $image, $filename = null, $mime_type = null ) { // phpcs:ignore PSR2.Methods.MethodDeclaration.Underscore -- This is a protected method, not a public one.
		/**
		 * @var ?string $filename
		 * @var string $extension
		 * @var string $mime_type
		 */
		list( $filename, $extension, $mime_type ) = $this->get_output_format( $filename, $mime_type );

		if ( ! $filename ) {
			$filename = $this->generate_filename( null, null, $extension );
		}

		$upload_dir = wp_upload_dir();

		if ( strpos( $filename, $upload_dir['basedir'] ) === 0 ) {
			// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_tempnam
			$temp_filename = tempnam( get_temp_dir(), 'godam-uploads' );
		} else {
			$temp_filename = false;
		}

		/**
		 * @var WP_Error|array{path: string, file: string, width: int, height: int, mime-type: string}
		 */
		$parent_call = parent::_save( $image, $temp_filename ?: $filename, $mime_type );

		if ( is_wp_error( $parent_call ) ) {
			if ( $temp_filename ) {
				// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
				unlink( $temp_filename );
			}

			return $parent_call;
		} else {
			/**
			 * @var array{path: string, file: string, width: int, height: int, mime-type: string} $save
			 */
			$save = $parent_call;
		}

		$copy_result = copy( $save['path'], $filename );

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
		unlink( $save['path'] );
		if ( $temp_filename ) {
			// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
			unlink( $temp_filename );
		}

		if ( ! $copy_result ) {
			return new WP_Error( 'unable-to-copy-to-godam', 'Unable to copy the temp image to GoDAM' );
		}

		$response = array(
			'path'      => $filename,
			'file'      => wp_basename( apply_filters( 'image_make_intermediate_size', $filename ) ),
			'width'     => $this->size['width'] ?? 0,
			'height'    => $this->size['height'] ?? 0,
			'mime-type' => $mime_type,
		);

		return $response;
	}

	/**
	 * Clean up temporary files on destruction.
	 * This will remove all temporary files created during the image editing process.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function __destruct() {
		array_map( 'unlink', $this->temp_files_to_cleanup );
		parent::__destruct();
	}
}
