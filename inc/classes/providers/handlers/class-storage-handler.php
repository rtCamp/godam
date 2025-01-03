<?php
/**
 * Storage_Handler class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Handlers;

use Transcoder\Inc\Providers\Exceptions\EasyDamException;
use Transcoder\Inc\Providers\Storage\StorageFactory;

/**
 * Class Storage_Handler
 */
class Storage_Handler {

	/**
	 * Get buckets.
	 *
	 * Get the list of all the buckets if accessKey and secretKey are provided.
	 * Currently just returns REST response as that is where it is being used.
	 *
	 * @return \WP_REST_Response
	 */
	public static function get_buckets() {

		try {
			$provider = StorageFactory::get_instance()->get_provider();
			$buckets  = $provider->get_buckets();

			return new \WP_REST_Response( $buckets, 200 );

		} catch ( EasyDamException $e ) {
			return Error_Handler::handle_exception( $e, true );
		}
	}

	/**
	 * Check credentials.
	 *
	 * Check if the credentials are valid and can write to the storage.
	 * Currently just returns REST response as that is where it is being used.
	 *
	 * @return \WP_REST_Response
	 */
	public static function check_credentials() {
		try {
			$provider = StorageFactory::get_instance()->get_provider();
			$provider->can_write();
			
			$response = array(
				'status'  => 'success',
				'message' => 'Credentials are valid and can write storage.',
			);

			return new \WP_REST_Response( $response, 200 );

		} catch ( EasyDamException $e ) {
			return Error_Handler::handle_exception( $e, true );
		}
	}
}
