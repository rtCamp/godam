<?php
/**
 * StorageFactory class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Providers\Storage;

defined( 'ABSPATH' ) || exit;

use Transcoder\Inc\EasyDAM_Constants;
use Transcoder\Inc\Traits\Singleton;
use Transcoder\Inc\Providers\Storage\AWS;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;

/**
 * A factory class to create storage provider clients.
 * 
 * This class is a singleton and should be used to get the storage provider client.
 */
class StorageFactory {

	use Singleton;

	/**
	 * Provider client.
	 * 
	 * @var \Transcoder\Inc\Providers\Storage\Base
	 */
	private $provider_client = null; 

	/**
	 * Get the provider client.
	 */
	public function get_provider() {

		if ( ! $this->provider_client ) {
			$this->provider_client = $this->create();
		}

		return $this->provider_client;
	}

	/**
	 * Create a storage provider client based on database settings.
	 *
	 * @return \Transcoder\Inc\Providers\Storage\Base The storage provider client.
	 */
	private function create() {
		$provider_name = 'aws';

		$config = $this->get_config( $provider_name );

		return new AWS( $config );
	}

	/**
	 * Get the configuration for a provider.
	 *
	 * @param string $provider_name The provider name.
	 *
	 * @return array The provider configuration.
	 *
	 * @throws EasyDamException If the configuration is missing or incomplete.
	 */
	private function get_config( $provider_name ) {
		$options = get_option( EasyDAM_Constants::S3_STORAGE_OPTIONS );
	
		if ( ! $options || ! isset( $options[ $provider_name ] ) ) {
			throw new EasyDamException( esc_html( "Configuration for provider $provider_name is missing." ), 404 );
		}
	
		$provider_config = $options[ $provider_name ];
	
		// Ensure all necessary keys are present.
		$required_keys = array( 'accessKey', 'secretKey' );
		foreach ( $required_keys as $key ) {
			if ( empty( $provider_config[ $key ] ) ) {
				throw new EasyDamException( esc_html( "Missing '$key' for provider." ), 404 );
			}
		}
	
		return array(
			'key'    => $provider_config['accessKey'],
			'secret' => $provider_config['secretKey'],
			'bucket' => $provider_config['bucket'] ?? null,
			'region' => 'us-east-1', // TODO: make this configurable.
		);
	}
}
