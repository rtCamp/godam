<?php
/**
 * IMA Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

use RTGODAM\Inc\Traits\Singleton;

/**
 * IMA Assets class.
 */
class IMA_Assets {
	use Singleton;

	/**
	 * Constructor register hooks if not already registered.
	 *
	 * @return void
	 * @since n.e.x.t
	 */
	protected function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue the IMA SDK.
	 *
	 * @return void
	 * @since n.e.x.t
	 */
	public function enqueue_scripts() {
		// No need to set dns-prefetch resource hint for IMA SDK as WordPress automatically does that for 3rd party scripts.
		wp_enqueue_script(
			'ima-sdk',
			'https://imasdk.googleapis.com/js/sdkloader/ima3.js', // It is required to load the IMA SDK from the Google CDN, else it will show console error.
			array(),
			RTGODAM_VERSION,
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);
	}
}
