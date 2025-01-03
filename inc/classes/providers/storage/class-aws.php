<?php
/**
 * AWS S3 storage class.
 * 
 * It's the class that handles the AWS S3 storage provider
 * 
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Storage;

use Aws\S3\S3Client;
use Aws\Exception\AwsException;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;

/**
 * Base class for storage providers.
 */
class AWS extends Base {

	/**
	 * The storage provider name.
	 * 
	 * @var string
	 */
	protected $provider = 'aws';

	/**
	 * Get the storage provider client.
	 *
	 * @param array $args The storage provider arguments.
	 * @return object The storage provider client.
	 */
	protected function get_client( $args ) {
		$client = new S3Client(
			array(
				'version'     => 'latest',
				'region'      => $args['region'],
				'credentials' => array(
					'key'    => $args['key'],
					'secret' => $args['secret'],
				),
			) 
		);

		return $client;
	}

	/**
	 * Upload a file to the storage provider.
	 *
	 * @param string $file The file path.
	 * @param string $name The file name.
	 * @return string The file url.
	 */
	public function upload( $file, $name ) {
		try {
			$result = $this->client->putObject(
				array(
					'Bucket'     => $this->bucket,
					'Key'        => $name,
					'SourceFile' => $file,
				)
			);

			return $result['ObjectURL'];

		} catch ( AwsException $e ) {
			throw new EasyDamException(
				$e->getAwsErrorMessage(),
				$e->getCode(),
				true,
			);
		}
	}

	/**
	 * Delete a file from the storage provider.
	 * 
	 * @param string $name The file name.
	 * 
	 * @return void
	 */
	public function delete( $name ) {
		try {
			$this->client->deleteObject(
				array(
					'Bucket' => $this->bucket,
					'Key'    => $name,
				)
			);
		} catch ( AwsException $e ) {
			error_log( $e->getMessage() );
		}
	}

	/**
	 * Get the list of buckets from the storage provider.
	 *
	 * @return array
	 */
	public function get_buckets() {
		$buckets = $this->client->listBuckets();
		$bucket_list = array();
		foreach ( $buckets['Buckets'] as $bucket ) {
			$bucket_list[] = $bucket['Name'];
		}
		return $bucket_list;
	}

	/**
	 * Check whether the provided credentials can read from the storage provider.
	 * 
	 * @return void
	 */
	public function can_write() {
		try {

			$this->client->putObject([
				'Bucket' => $this->bucket,
				'Key'    => 'test-file.txt',
				'Body'   => 'THIS IS A DUMMY TEXT FILE FROM EASYDAM PLUGIN. THIS FILE CAN BE DELETED.',
			]);

			// try to delete this file if it was created
			$this->client->deleteObject([
				'Bucket' => $this->bucket,
				'Key'    => 'test-file.txt',
			]);

		} catch ( AwsException $e ) {
			throw new EasyDamException(
				$e->getAwsErrorMessage(),
				$e->getCode(),
				true,
			);
		}
	}
}
