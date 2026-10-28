<?php
/**
 * HubSpot Form Assets class.
 *
 * Loads HubSpot's current per-portal forms embed plus a small bridge script, for
 * the GoDAM Central source (which, unlike the leadin plugin, has no WordPress
 * shortcode). Enqueued on demand from the player template (see
 * inc/templates/godam-player.php) only when a Central HubSpot layer is actually
 * rendered — mirroring Marketo_Form_Assets.
 *
 * The embed is HubSpot's new (`.hs-form-frame`) method rather than the legacy
 * forms v2 library: the legacy `hbspt.forms.create()` loads a new-editor form with
 * its script loader disabled, so it neither renders as a V4 form nor reports its
 * submit. The per-portal embed renders it and fires HubSpot's V4 submit event, so
 * the player's confirmation step works again.
 *
 * The `hubspotutk` cookie that associates a submission with a contact (rather than
 * "Unknown Contact") is not set by this embed; HubSpot's tracking code sets it, and
 * the plugin injects that separately for a Central-only site when view tracking is
 * on (see Map_Tracker::maybe_enqueue_hubspot_tracking_code()).
 *
 * @since n.e.x.t
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Hubspot;

defined( 'ABSPATH' ) || exit;

/**
 * HubSpot Form Assets class.
 *
 * @since n.e.x.t
 */
class Hubspot_Form_Assets {

	use Singleton;

	/**
	 * Handle for HubSpot's current per-portal forms embed loader.
	 *
	 * @var string
	 */
	const EMBED_HANDLE = 'rtgodam-hubspot-forms-embed';

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
	 * Register and enqueue HubSpot's per-portal forms embed plus the GoDAM bridge.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {
		// Only for a Central HubSpot connection; the leadin source renders through
		// its own [hubspot] shortcode and needs none of this.
		if ( ! Hubspot::is_configured() || 'central' !== Hubspot::get_active_source() ) {
			return;
		}

		$embed_src = Hubspot::central_forms_embed_src();

		// No connected portal means there is no embed to load and nothing to render.
		if ( '' === $embed_src ) {
			return;
		}

		// HubSpot's current per-portal forms embed. It renders every `.hs-form-frame`
		// on the page and fires the V4 submit event the bridge listens for. (The
		// `hubspotutk` cookie comes from the tracking code, injected separately — see
		// the class docblock.) The URL is HubSpot's canonical loader and carries no
		// version of its own.
		if ( ! wp_script_is( self::EMBED_HANDLE, 'registered' ) ) {
			wp_register_script(
				self::EMBED_HANDLE,
				$embed_src,
				array(),
				null, // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- HubSpot's canonical embed URL carries no version and must not be cache-busted.
				array(
					'in_footer' => true,
					'strategy'  => 'defer',
				)
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
			array_merge( $init_asset['dependencies'], array( self::EMBED_HANDLE ) ),
			$init_asset['version'],
			true
		);

		wp_enqueue_script( self::EMBED_HANDLE );
		wp_enqueue_script( 'rtgodam-hubspot-form' );
	}
}
