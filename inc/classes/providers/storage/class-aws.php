<?php
/**
 * AWS S3 storage class.
 * 
 * It's the class that handles the AWS S3 storage provider
 * 
 * @package transcoder
 */

namespace RTGODAM\Inc\Providers\Storage;

defined( 'ABSPATH' ) || exit;

use Aws\S3\S3Client;
use Aws\Exception\AwsException;
use RTGODAM\Inc\Providers\Exceptions\EasyDamException;

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
	 *
	 * @return string The file url.
	 * @throws EasyDamException If the operation fails.
	 */
	public function upload( $file, $name ) {
		try {
			if ( empty( $this->bucket ) ) {
				throw new EasyDamException(
					'Bucket name is missing.',
					400
				);
			}

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
				esc_html( $e->getAwsErrorMessage() ),
				esc_html( $e->getCode() ),
				true
			);
		}
	}

	/**
	 * Delete a file from the storage provider.
	 * 
	 * @param string $name The file name.
	 * 
	 * @return void
	 * @throws EasyDamException If the operation fails.
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
			throw new EasyDamException(
				esc_html( $e->getAwsErrorMessage() ),
				esc_html( $e->getCode() ),
				true
			);
		}
	}

	/**
	 * Get the list of buckets from the storage provider.
	 *
	 * @return array
	 * @throws EasyDamException If the operation fails.
	 */
	public function get_buckets() {

		try {
			$buckets     = $this->client->listBuckets();
			$bucket_list = array();
			foreach ( $buckets['Buckets'] as $bucket ) {
				$bucket_list[] = $bucket['Name'];
			}
			return $bucket_list;
		} catch ( AwsException $e ) {
			throw new EasyDamException(
				esc_html( $e->getAwsErrorMessage() ),
				esc_html( $e->getCode() ),
				true
			);
		}
	}

	/**
	 * Check whether the provided credentials can read from the storage provider.
	 * 
	 * @return bool True if the credentials can read, false otherwise.
	 * @throws EasyDamException If the operation fails.
	 */
	public function can_write() {
		try {

			if ( empty( $this->bucket ) ) {
				throw new EasyDamException(
					'Bucket name is missing.',
					404
				);
			}

			$this->client->putObject(
				array(
					'Bucket' => $this->bucket,
					'Key'    => 'test-file.txt',
					'Body'   => 'THIS IS A DUMMY TEXT FILE FROM EASYDAM PLUGIN. THIS FILE CAN BE DELETED.',
				)
			);

			$this->client->deleteObject(
				array(
					'Bucket' => $this->bucket,
					'Key'    => 'test-file.txt',
				)
			);

			return true;

		} catch ( AwsException $e ) {
			throw new EasyDamException(
				esc_html( $e->getAwsErrorMessage() ),
				404,
				true
			);
		} catch ( \Exception $e ) {
			throw new EasyDamException(
				esc_html( $e->getMessage() ),
				404,
				true
			);
		}
	}
}
