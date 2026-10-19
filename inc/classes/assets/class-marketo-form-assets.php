<?php
/**
 * Marketo Form Assets class.
 *
 * Loads Marketo's forms2 library and a small init script that renders each
 * Marketo form layer present on the page. Enqueued on demand from the player
 * template (see inc/templates/godam-player.php) only when a Marketo layer is
 * actually rendered — mirroring the Jetpack_Form_Assets precedent.
 *
 * @since 2.5.0
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Marketo;

defined( 'ABSPATH' ) || exit;

/**
 * Marketo Form Assets class.
 *
 * @since 2.5.0
 */
class Marketo_Form_Assets {

	use Singleton;

	/**
	 * Constructor.
	 *
	 * The template invokes this during content rendering, so enqueue right away
	 * if `wp_enqueue_scripts` has already fired; otherwise defer to the hook.
	 */
	protected function __construct() {
		if ( did_action( 'wp_enqueue_scripts' ) ) {
			$this->enqueue_scripts();
		} else {
			add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		}
	}

	/**
	 * Register and enqueue the Marketo forms2 library plus the GoDAM init script.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {
		// Nothing to load without valid credentials.
		if ( ! Marketo::is_configured() ) {
			return;
		}

		$settings = Marketo::get_settings();
		$host     = Marketo::get_instance_host();

		// Marketo's forms2 library, served from the account's instance host.
		if ( ! wp_script_is( 'rtgodam-marketo-forms2', 'registered' ) ) {
			wp_register_script(
				'rtgodam-marketo-forms2',
				$host . '/js/forms2/js/forms2.min.js',
				array(),
				RTGODAM_VERSION,
				true
			);
		}

		$init_asset_file = RTGODAM_PATH . 'assets/build/js/marketo-form.min.asset.php';
		$init_asset      = array(
			'dependencies' => array(),
			'version'      => filemtime( RTGODAM_PATH . 'assets/build/js/marketo-form.min.js' ),
		);

		if ( file_exists( $init_asset_file ) ) {
			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is constant.
			$init_asset = include $init_asset_file;
		}

		wp_register_script(
			'rtgodam-marketo-form',
			RTGODAM_URL . 'assets/build/js/marketo-form.min.js',
			array_merge( $init_asset['dependencies'], array( 'rtgodam-marketo-forms2' ) ),
			$init_asset['version'],
			true
		);

		wp_localize_script(
			'rtgodam-marketo-form',
			'godamMarketoFormData',
			array(
				'podId'        => $settings['podId'],
				'munchkinId'   => $settings['munchkinId'],
				'recaptchaKey' => $settings['recaptchaKey'],
				'instanceHost' => $host,
			)
		);

		wp_enqueue_script( 'rtgodam-marketo-forms2' );
		wp_enqueue_script( 'rtgodam-marketo-form' );
	}
}
