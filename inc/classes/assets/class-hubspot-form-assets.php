<?php
/**
 * HubSpot Form Assets class.
 *
 * Loads HubSpot's forms v2 library plus a small bridge script, for the GoDAM
 * Central source (which, unlike the leadin plugin, has no WordPress shortcode).
 * Enqueued on demand from the player template (see inc/templates/godam-player.php)
 * only when a Central HubSpot layer is actually rendered — mirroring
 * Marketo_Form_Assets.
 *
 * forms v2 renders both kinds of form: a legacy-editor form itself, and a
 * new-editor form by switching it to HubSpot's V4 embed. The bridge detects a
 * submit for both — the legacy iframe callback and the V4 `hs-form-event` — so the
 * player's confirmation step works whichever the account's form uses. (An earlier
 * iteration loaded the per-portal V4 embed directly, which has no legacy path and
 * left layers on an older form blank.)
 *
 * The `hubspotutk` cookie that associates a submission with a contact (rather than
 * "Unknown Contact") is not set by the form library; HubSpot's tracking code sets
 * it, and the plugin injects that separately for a Central-only site when view
 * tracking is on (see Map_Tracker::maybe_enqueue_hubspot_tracking_code()).
 *
 * @since 2.6.0
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Hubspot;

defined( 'ABSPATH' ) || exit;

/**
 * HubSpot Form Assets class.
 *
 * @since 2.6.0
 */
class Hubspot_Form_Assets {

	use Singleton;

	/**
	 * HubSpot forms v2 embed script.
	 *
	 * @var string
	 */
	const HUBSPOT_FORMS_SCRIPT = 'https://js.hsforms.net/forms/v2.js';

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
	 * Register and enqueue HubSpot's forms v2 library plus the GoDAM bridge.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {
		// Only for a Central HubSpot connection; the leadin source renders through
		// its own [hubspot] shortcode and needs none of this.
		if ( ! Hubspot::is_configured() || 'central' !== Hubspot::get_active_source() ) {
			return;
		}

		// HubSpot's forms v2 library, which renders both a legacy-editor form and a
		// new-editor form (switching the latter to HubSpot's V4 embed).
		if ( ! wp_script_is( 'rtgodam-hubspot-forms-v2', 'registered' ) ) {
			wp_register_script(
				'rtgodam-hubspot-forms-v2',
				self::HUBSPOT_FORMS_SCRIPT,
				array(),
				RTGODAM_VERSION,
				true
			);
		}

		$init_asset_file = RTGODAM_PATH . 'assets/build/js/hubspot-form.min.asset.php';
		$init_asset      = array(
			'dependencies' => array(),
			'version'      => filemtime( RTGODAM_PATH . 'assets/build/js/hubspot-form.min.js' ),
		);

		if ( file_exists( $init_asset_file ) ) {
			// phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- file path is constant.
			$init_asset = include $init_asset_file;
		}

		wp_register_script(
			'rtgodam-hubspot-form',
			RTGODAM_URL . 'assets/build/js/hubspot-form.min.js',
			array_merge( $init_asset['dependencies'], array( 'rtgodam-hubspot-forms-v2' ) ),
			$init_asset['version'],
			true
		);

		wp_enqueue_script( 'rtgodam-hubspot-forms-v2' );
		wp_enqueue_script( 'rtgodam-hubspot-form' );
	}
}
