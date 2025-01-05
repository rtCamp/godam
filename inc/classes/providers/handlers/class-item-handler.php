<?php
/**
 * Item_Handler class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Handlers;

use Transcoder\Inc\EasyDAM_Constants;
use Transcoder\Inc\Providers\Storage\StorageFactory;
use \Transcoder\Inc\Providers\Exceptions\EasyDamException;

/**
 * Class Item_Handler
 */
class Item_Handler {

	/**
	 * Handle item.
	 * 
	 * Get all the different images sizes and upload them to the storage provider.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return void
	 * @throws Exception If the provider is not supported.
	 */
	public function upload_item( $attachment_id ) {

		$metadata = wp_get_attachment_metadata( $attachment_id );

		if ( ! $metadata ) {
			error_log( "Metadata not found for attachment ID: $attachment_id" );
			return;
		}

		// Check if attachment type is image, then only upload.
		if ( 'image' !== substr( get_post_mime_type( $attachment_id ), 0, 5 ) ) {
			error_log( "Attachment is not an image for attachment ID: $attachment_id" );
			return;
		}

		// Check if S3 url already present.
		$s3_url = get_post_meta( $attachment_id, 's3_url', true );

		if ( ! empty( $s3_url ) ) {
			error_log( "S3 URL already present for attachment ID: $attachment_id" );
			return;
		}

		$provider = StorageFactory::get_instance()->get_provider();

		$file_path = get_attached_file( $attachment_id );

		if ( ! file_exists( $file_path ) ) {
			error_log( "File not found for attachment ID: $attachment_id" );
			return;
		}

		$bucket_path = $this->get_settings_base_path();

		$file_name = $bucket_path . basename( $file_path );

		try {
			$s3_url = $provider->upload( $file_path, $file_name );
			// Store the S3 URL.
			update_post_meta( $attachment_id, 's3_url', $s3_url );
		} catch ( \Exception $e ) {
			Error_Handler::handle_exception( $e );
		}

		// Get all image sizes metadata.
		$image_sizes = wp_get_attachment_metadata( $attachment_id );

		if ( ! empty( $image_sizes['sizes'] ) ) {
			foreach ( $image_sizes['sizes'] as $size => $size_data ) {
				// Generate the file path for each size.
				$resized_file_path = path_join( dirname( $file_path ), $size_data['file'] );
	
				if ( file_exists( $resized_file_path ) ) {
					$resized_file_name = $bucket_path . $size_data['file'];
	
					try {
						$resized_object_url = $provider->upload( $resized_file_path, $resized_file_name );
	
						// Store the S3 URL for each image size.
						update_post_meta( $attachment_id, "s3_url_{$size}", $resized_object_url );
					} catch ( \Exception $e ) {
						error_log( "Failed to upload {$size} size: " . $e->getMessage() );
					}
				} else {
					error_log( "File for {$size} size not found: $resized_file_path" );
				}
			}
		}
	}

	/**
	 * Delete item.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return void
	 */
	public function delete_item( $attachment_id ) {

		$s3_url   = get_post_meta( $attachment_id, 's3_url', true );
		$provider = StorageFactory::get_instance()->get_provider();

		// get only the file name from the URL.
		$s3_url    = basename( $s3_url );
		$base_path = $this->get_settings_base_path();

		$s3_url = $base_path . $s3_url;

		if ( ! empty( $s3_url ) ) {
			$provider->delete( $s3_url );
		}

		// Get all image sizes metadata.
		$image_sizes = wp_get_attachment_metadata( $attachment_id );

		if ( ! empty( $image_sizes['sizes'] ) ) {
			foreach ( $image_sizes['sizes'] as $size => $size_data ) {
				$s3_url = get_post_meta( $attachment_id, "s3_url_{$size}", true );

				// get only the file name from the URL.
				$s3_url = basename( $s3_url );
				$s3_url = $base_path . $s3_url;

				if ( ! empty( $s3_url ) ) {
					$provider->delete( $s3_url );
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
	public static function upload_item_x( $attachment_id ) {

		$image_sizes = wp_get_attachment_metadata( $attachment_id );

		if ( ! $image_sizes ) {
			throw new EasyDamException( "Metadata not found for attachment ID: $attachment_id" );
		}

		if ( 'image' !== substr( get_post_mime_type( $attachment_id ), 0, 5 ) ) {
			throw new EasyDamException( "Attachment is not an image for attachment ID: $attachment_id" );
		}

		$s3_url = get_post_meta( $attachment_id, 's3_url', true );

		if ( ! empty( $s3_url ) ) {
			throw new EasyDamException( "S3 URL already present for attachment ID: $attachment_id" );
		}

		$provider = StorageFactory::get_instance()->get_provider();

		$file_path = get_attached_file( $attachment_id );

		if ( ! file_exists( $file_path ) ) {
			throw new EasyDamException( "File not found for attachment ID: $attachment_id" );
		}

		$bucket_path = self::get_settings_base_path_x();

		$file_name = $bucket_path . basename( $file_path );

		$s3_url = $provider->upload( $file_path, $file_name );
		update_post_meta( $attachment_id, 's3_url', $s3_url );

		$failed_count = 0;

		if ( ! empty( $image_sizes['sizes'] ) ) {
			foreach ( $image_sizes['sizes'] as $size => $size_data ) {
				// Generate the file path for each size.
				$resized_file_path = path_join( dirname( $file_path ), $size_data['file'] );
	
				if ( file_exists( $resized_file_path ) ) {
					$resized_file_name = $bucket_path . $size_data['file'];
	
					try {
						$resized_object_url = $provider->upload( $resized_file_path, $resized_file_name );
	
						update_post_meta( $attachment_id, "s3_url_{$size}", $resized_object_url );
					} catch ( EasyDamException $e ) {
						$failed_count++;
					}
				} else {
					$failed_count++;
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

	/**
	 * Get the base path from the settings.
	 *
	 * @return string|bool
	 */
	private function get_settings_base_path() {
		$options = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );
	
		if ( ! $options || empty( $options['bucketPath'] ) ) {
			return false;
		}
	
		// Ensure the bucketPath has no leading slash and exactly one trailing slash.
		$bucket_path = trim( $options['bucketPath'], '/' );
		$bucket_path = trailingslashit( $bucket_path );
	
		return $bucket_path;
	}

}
