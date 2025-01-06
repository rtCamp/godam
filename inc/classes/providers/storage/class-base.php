<?php
/**
 * Base storage provider class.
 * 
 * It's the base class for the storage providers access like AWS S3, Google Cloud Storage, etc.
 * 
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Storage;

/**
 * Base class for storage providers.
 */
abstract class Base {

	/**
	 * The storage provider name.
	 * 
	 * @var string
	 */
	protected $provider;

	/**
	 * The storage provider client.
	 * 
	 * @var object
	 */
	protected $client;

	/**
	 * The storage provider bucket.
	 * 
	 * @var string
	 */
	protected $bucket;

	/**
	 * Constructor.
	 * 
	 * @param array $args The storage provider arguments.
	 */
	public function __construct( $args ) {
		$this->client = $this->get_client( $args );

		$this->bucket = $args['bucket'];
	}

	/**
	 * Get the storage provider client.
	 *
	 * @param array $args The storage provider arguments.
	 * @return object The storage provider client.
	 */
	abstract protected function get_client( $args );

	/**
	 * Upload a file to the storage provider.
	 * 
	 * @param string $file The file path.
	 * @param string $key  The file key.
	 * @return bool True on success, false on failure.
	 */
	abstract public function upload( $file, $key );

	/**
	 * Get the list of buckets with that provider.
	 *
	 * @return array
	 */
	abstract public function get_buckets();

	/**
	 * Check whether the provided credentials can read from the storage provider.
	 * 
	 * @return void
	 * @throws EasyDamException If the credentials are invalid.
	 */
	abstract public function can_write();
}
