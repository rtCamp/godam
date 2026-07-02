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
	 * Warn about known add-on plugins that are active but did not register
	 * through the add-on framework.
	 *
	 * An add-on that is active yet absent from the registry could not hook
	 * `godam_register_addons`, which means it predates this framework and is
	 * therefore too old to be compatible with the current GoDAM version (e.g.
	 * GoDAM for WooCommerce 1.4.0 running under GoDAM 2.0). Rather than let it
	 * inject broken UI, tell the user to update it. This is version-agnostic:
	 * any future add-on gets the same treatment automatically once it ships a
	 * registering version.
	 *
	 * @return void
	 */
	private function warn_incompatible_addons() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		/**
		 * Known GoDAM add-ons, keyed by plugin file, mapped to the slug they
		 * are expected to register under and their display name.
		 *
		 * @param array<string,array{slug:string,name:string}> $known_addons Known add-ons.
		 */
		$known_addons = apply_filters(
			'godam_known_addon_plugins',
			array(
				'godam-for-woo/godam-for-woo.php' => array(
					'slug' => 'godam-for-woo',
					'name' => __( 'GoDAM for WooCommerce', 'godam' ),
				),
			)
		);

		foreach ( $known_addons as $plugin_file => $info ) {
			if ( ! is_plugin_active( $plugin_file ) ) {
				continue;
			}

			// Active but it registered correctly: nothing to warn about.
			if ( isset( $this->addons[ $info['slug'] ] ) ) {
				continue;
			}

			$this->show_admin_notice(
				sprintf(
					/* translators: %s: Add-on name */
					esc_html__( '%s is out of date and may not work correctly with this version of GoDAM. Please update it to the latest version.', 'godam' ),
					'<strong>' . esc_html( $info['name'] ) . '</strong>'
				)
			);
		}
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
