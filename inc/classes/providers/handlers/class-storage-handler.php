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
	 *
	 * @return array
	 * @throws EasyDamException If cannot get buckets.
	 */
	public static function get_buckets() {

		$provider = StorageFactory::get_instance()->get_provider();
		$buckets  = $provider->get_buckets();

		return $buckets;
	}

	/**
	 * Check credentials.
	 *
	 * Check if the credentials are valid and can write to the storage.
	 *
	 * @return void
	 * @throws EasyDamException If the credentials are not valid.
	 */
	public static function check_credentials() {

		$provider = StorageFactory::get_instance()->get_provider();
		$provider->can_write();
	}
}
