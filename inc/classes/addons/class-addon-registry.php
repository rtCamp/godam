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
 *
 * @since 1.8.0
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
	 *
	 * @since 1.8.0
	 */
	protected function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init' ), 15 );
	}

	/**
	 * Fire the registration hook, then boot qualifying add-ons.
	 *
	 * @since 1.8.0
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
	}

	/**
	 * Register an add-on.
	 *
	 * @since 1.8.0
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
	 * @since 1.8.0
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
	 * @since 1.8.0
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
	 * @since 1.8.0
	 *
	 * @return Abstract_Addon[]
	 */
	public function get_all() {
		return $this->addons;
	}

	/**
	 * Check if an add-on is registered and booted.
	 *
	 * @since 1.8.0
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
	 * @since 1.8.0
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
