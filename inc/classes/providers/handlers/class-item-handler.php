<?php
/**
 * Item_Handler class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Handlers;

use Transcoder\Inc\EasyDAM_Constants;
use Transcoder\Inc\Providers\Storage\StorageFactory;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;

/**
 * Class Item_Handler
 */
class Item_Handler {

	/**
	 * Delete item.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 * @throws EasyDamException If delete fails.
	 */
	public static function delete_item( $attachment_id ) {

		$s3_url = get_post_meta( $attachment_id, 's3_url', true );

		if ( empty( $s3_url ) ) {
			new EasyDamException( "S3 URL not found for attachment ID: $attachment_id" );
		}

		$provider = StorageFactory::get_instance()->get_provider();

		// get only the file name from the URL.
		$s3_filename = basename( $s3_url );
		$base_path   = self::get_settings_base_path_x();

		$s3_filename = $base_path . $s3_filename;

		if ( ! empty( $s3_filename ) ) {
			$provider->delete( $s3_filename );
		}

		// Get all image sizes metadata.
		$image_sizes = wp_get_attachment_metadata( $attachment_id );

		$failed_count = 0;

		if ( ! empty( $image_sizes['sizes'] ) ) {
			foreach ( $image_sizes['sizes'] as $size => $size_data ) {
				$s3_url = get_post_meta( $attachment_id, "s3_url_{$size}", true );

				// get only the file name from the URL.
				$s3_url = basename( $s3_url );
				$s3_url = $base_path . $s3_url;

				if ( ! empty( $s3_url ) ) {

					try {
						$provider->delete( $s3_url );
					} catch ( EasyDamException $e ) {
						++$failed_count;
					}
				}
			}
		}
	}

	/**
	 * Upload item.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 * @throws EasyDamException If upload fails.
	 */
	public static function upload_item( $attachment_id ) {

		$image_sizes = wp_get_attachment_metadata( $attachment_id );

		if ( ! $image_sizes ) {
			throw new EasyDamException( esc_html( "Metadata not found for attachment ID: $attachment_id" ) );
		}

		if ( 'image' !== substr( get_post_mime_type( $attachment_id ), 0, 5 ) ) {
			throw new EasyDamException( esc_html( "Attachment is not an image for attachment ID: $attachment_id" ) );
		}

		$bucket_path = self::get_settings_base_path_x();

		$s3_url = get_post_meta( $attachment_id, 's3_url', true );
		$file_path = get_attached_file( $attachment_id );

		$provider = StorageFactory::get_instance()->get_provider();

		if ( empty( $s3_url ) ) {

			if ( ! file_exists( $file_path ) ) {
				throw new EasyDamException( esc_html( "File not found for attachment ID: $attachment_id" ) );
			}

			$file_name = $bucket_path . basename( $file_path );

			$s3_url = $provider->upload( $file_path, $file_name );
			update_post_meta( $attachment_id, 's3_url', $s3_url );
		}

		$failed_count = 0;

		if ( ! empty( $image_sizes['sizes'] ) ) {
			foreach ( $image_sizes['sizes'] as $size => $size_data ) {

				$s3_url = get_post_meta( $attachment_id, "s3_url_{$size}", true );

				if ( ! empty( $s3_url ) ) {
					continue;
				}

				// Generate the file path for each size.
				$resized_file_path = path_join( dirname( $file_path ), $size_data['file'] );
	
				if ( file_exists( $resized_file_path ) ) {
					$resized_file_name = $bucket_path . $size_data['file'];
	
					try {
						$resized_object_url = $provider->upload( $resized_file_path, $resized_file_name );
	
						update_post_meta( $attachment_id, "s3_url_{$size}", $resized_object_url );
					} catch ( EasyDamException $e ) {
						++$failed_count;
					}
				} else {
					++$failed_count;
				}
			}
		}
	}

	/**
	 * Get the base path from the settings.
	 *
	 * @return string|bool
	 */
	private static function get_settings_base_path_x() {
		$options = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );

		if ( ! $options || empty( $options['bucketPath'] ) ) {
			return false;
		}

		$bucket_path = trim( $options['bucketPath'], '/' );
		$bucket_path = trailingslashit( $bucket_path );

		return $bucket_path;
	}
}
