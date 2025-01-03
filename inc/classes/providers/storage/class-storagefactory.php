<?php
/**
 * StorageFactory class.
 *
 * @package transcoder
 */
namespace Transcoder\Inc\Providers\Storage;

use Transcoder\Inc\Providers\Storage\AWS;

use Transcoder\Inc\Traits\Singleton;

class StorageFactory {

	use Singleton;

	/**
	 * Provider client.
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
	 * @throws \Exception If the provider is not supported.
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
	 * @throws \Exception If the configuration is missing or incomplete.
	 */
	private function get_config( $provider_name ) {
		// TODO: store the database setting key name in some constant.
		$options = get_option( 'easydam_storage_aws' );
	
		if ( ! $options || ! isset( $options[ $provider_name ] ) ) {
			throw new \Exception( "Configuration for provider $provider_name is missing." );
		}
	
		$provider_config = $options[ $provider_name ];
	
		// Ensure all necessary keys are present.
		$required_keys = array( 'accessKey', 'secretKey' );
		foreach ( $required_keys as $key ) {
			if ( empty( $provider_config[ $key ] ) ) {
				throw new \Exception( "Missing '$key' for provider." );
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
