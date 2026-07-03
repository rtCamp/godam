<?php
/**
 * Add-on Registry.
 *
 * Central registry for GoDAM add-ons. Add-ons register themselves here
 * during the `godam_register_addons` action.
 *
 * @package GoDAM
 * @since 1.8.0
 */

namespace RTGODAM\Inc\Addons;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Addon_Registry.
 */
class Addon_Registry {

	use Singleton;

	/**
	 * Registered add-ons keyed by slug.
	 *
	 * @var Abstract_Addon[]
	 */
	private $addons = array();

	/**
	 * Slugs of add-ons that booted successfully.
	 *
	 * @var string[]
	 */
	private $booted = array();

	/**
	 * Constructor.
	 */
	protected function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init' ), 15 );
	}

	/**
	 * Fire the registration hook, then boot qualifying add-ons.
	 *
	 * @return void
	 */
	public function init() {
		/**
		 * Fires when GoDAM is ready to accept add-on registrations.
		 *
		 * Add-ons should hook here and call `Addon_Registry::get_instance()->register( $addon )`.
		 *
		 * @since 1.8.0
		 *
		 * @param Addon_Registry $registry The registry instance.
		 */
		do_action( 'godam_register_addons', $this );

		$this->boot_addons();
		$this->warn_incompatible_addons();
	}

	/**
	 * Warn (do NOT disable) when a registered add-on is older than the minimum
	 * version that is compatible with this GoDAM release.
	 *
	 * The add-on still loads and runs — nothing is switched off — but an older
	 * add-on's integration may not match this GoDAM version's editor APIs or
	 * saved-data shape (e.g. GoDAM for WooCommerce 1.4.0 under GoDAM 2.0), so we
	 * surface a dismissible admin notice pointing the user at the update. The
	 * minimum-version map is filterable so future add-ons can declare their own.
	 *
	 * @return void
	 */
	private function warn_incompatible_addons() {
		// The notice only ever renders in wp-admin, so skip the whole check on
		// front-end / REST / cron requests instead of running it every load.
		if ( ! is_admin() ) {
			return;
		}

		/**
		 * Minimum add-on version compatible with the current GoDAM version,
		 * keyed by the slug the add-on registers under.
		 *
		 * @param array<string,array{version:string,name:string}> $minimums Minimum compatible versions.
		 */
		$minimums = apply_filters(
			'godam_addon_minimum_compatible_versions',
			array(
				'godam-for-woo' => array(
					'version' => '2.0.0',
					'name'    => __( 'GoDAM for WooCommerce', 'godam' ),
				),
			)
		);

		if ( ! is_array( $minimums ) ) {
			return;
		}

		foreach ( $minimums as $slug => $info ) {
			// Skip malformed filter entries: each needs a version and a name.
			if ( ! is_array( $info ) || empty( $info['version'] ) || empty( $info['name'] ) ) {
				continue;
			}

			$addon = $this->addons[ $slug ] ?? null;

			// Only registered (active) add-ons can be version-checked.
			if ( ! $addon ) {
				continue;
			}

			// A compatible (or newer) version is installed: nothing to warn about.
			if ( version_compare( $addon->get_version(), $info['version'], '>=' ) ) {
				continue;
			}

			// GoDAM add-ons are installed and updated from GoDAM's own Integration
			// Settings screen, not wp.org, so send the user there. The WordPress
			// plugin updater (update.php) has no update source for these add-ons
			// and would just fail.
			$update_url = admin_url( 'admin.php?page=rtgodam_settings#integrations-settings' );

			$this->show_addon_update_notice(
				sprintf(
					/* translators: 1: Add-on name, 2: opening link tag, 3: closing link tag */
					__( '%1$s is out of date and may not work correctly with this version of GoDAM. %2$sUpdate it to the latest version%3$s.', 'godam' ),
					'<strong>' . esc_html( $info['name'] ) . '</strong>',
					'<a href="' . esc_url( $update_url ) . '">',
					'</a>'
				)
			);
		}
	}

	/**
	 * Queue a dismissible "update this add-on" admin notice.
	 *
	 * The warning is shown only on the main WordPress Dashboard (index.php) and
	 * the Plugins screen (plugins.php) — the two places an admin naturally looks
	 * for update prompts. It is deliberately kept off GoDAM's own app screens
	 * (Video Editor, Analytics, Reel Pops) where a standard admin notice would
	 * overlap the single-page-app header. Both allowed screens also leave the
	 * admin_notices hook intact (Pages::handle_admin_head only strips it on
	 * GoDAM's own screens), so a plain admin_notices callback is enough.
	 *
	 * The screen is not known yet when this runs (plugins_loaded), so the screen
	 * check happens inside the admin_notices callback, by which point
	 * get_current_screen() is populated.
	 *
	 * @param string $message HTML notice content (may contain a link).
	 *
	 * @return void
	 */
	private function show_addon_update_notice( $message ) {
		add_action(
			'admin_notices',
			static function () use ( $message ) {
				// The notice links to GoDAM Integration Settings, which requires
				// `manage_options`. Don't show it to roles that land on the
				// Dashboard but can't act on it (matches every other notice in
				// the plugin, e.g. class-update.php).
				if ( ! current_user_can( 'manage_options' ) ) {
					return;
				}

				$screen          = get_current_screen();
				$allowed_screens = array( 'dashboard', 'plugins' );

				if ( ! $screen || ! in_array( $screen->id, $allowed_screens, true ) ) {
					return;
				}

				printf(
					'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
					wp_kses_post( $message )
				);
			}
		);
	}

	/**
	 * Register an add-on.
	 *
	 * @param Abstract_Addon $addon The add-on instance.
	 *
	 * @return bool True when registered, false on duplicate slug.
	 */
	public function register( Abstract_Addon $addon ) {
		$slug = $addon->get_slug();

		if ( isset( $this->addons[ $slug ] ) ) {
			return false;
		}

		$this->addons[ $slug ] = $addon;

		return true;
	}

	/**
	 * Boot all registered add-ons that satisfy dependency and version checks.
	 *
	 * @return void
	 */
	private function boot_addons() {
		foreach ( $this->addons as $slug => $addon ) {
			// Check GoDAM version compatibility.
			if ( ! $addon->is_godam_version_compatible() ) {
				$this->show_admin_notice(
					sprintf(
						/* translators: 1: Add-on name, 2: Required GoDAM version */
						esc_html__( '%1$s requires GoDAM %2$s or higher. Please update the GoDAM plugin.', 'godam' ),
						'<strong>' . esc_html( $addon->get_name() ) . '</strong>',
						esc_html( $addon->get_minimum_godam_version() )
					)
				);
				continue;
			}

			// Check add-on-specific dependencies (e.g. WooCommerce active).
			if ( ! $addon->dependencies_met() ) {
				foreach ( $addon->get_missing_dependency_messages() as $msg ) {
					$this->show_admin_notice( $msg );
				}
				continue;
			}

			$addon->boot();
			$this->booted[] = $slug;

			/**
			 * Fires after an add-on is booted successfully.
			 *
			 * @since 1.8.0
			 *
			 * @param Abstract_Addon $addon The add-on instance.
			 */
			do_action( 'godam_addon_booted', $addon );
			do_action( "godam_addon_{$slug}_booted", $addon );
		}
	}

	/**
	 * Get a registered add-on by slug.
	 *
	 * @param string $slug Add-on slug.
	 *
	 * @return Abstract_Addon|null
	 */
	public function get( $slug ) {
		return $this->addons[ $slug ] ?? null;
	}

	/**
	 * Get all registered add-ons.
	 *
	 * @return Abstract_Addon[]
	 */
	public function get_all() {
		return $this->addons;
	}

	/**
	 * Check if an add-on is registered and booted.
	 *
	 * @param string $slug Add-on slug.
	 *
	 * @return bool
	 */
	public function is_active( $slug ) {
		return in_array( $slug, $this->booted, true );
	}

	/**
	 * Helper: queue an admin notice.
	 *
	 * @param string $message HTML notice content.
	 *
	 * @return void
	 */
	private function show_admin_notice( $message ) {
		add_action(
			'admin_notices',
			function () use ( $message ) {
				printf( '<div class="notice notice-error"><p>%s</p></div>', wp_kses_post( $message ) );
			}
		);
	}
}
