<?php
/**
 * IMA Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
	 * @since 1.4.8
	 */
	protected function __construct() {
		// Players are often rendered inside the content, after `wp_enqueue_scripts`
		// has already run (classic themes, shortcodes). Enqueue straight away then;
		// the script is printed in the footer.
		if ( did_action( 'wp_enqueue_scripts' ) ) {
			$this->enqueue_scripts();
			return;
		}

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue the IMA SDK.
	 *
	 * @return void
	 * @since 1.4.8
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
