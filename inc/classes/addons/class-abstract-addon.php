<?php
/**
 * Abstract Add-on class.
 *
 * All GoDAM add-ons must extend this class to be recognized by the add-on system.
 *
 * @package GoDAM
 * @since 1.8.0
 */

namespace RTGODAM\Inc\Addons;

defined( 'ABSPATH' ) || exit;

/**
 * Abstract class Abstract_Addon.
 *
 * Provides standard interface for GoDAM add-ons (e.g., GoDAM for Woo).
 */
abstract class Abstract_Addon {

	/**
	 * Unique add-on slug. Must be overridden.
	 *
	 * @return string
	 */
	abstract public function get_slug();

	/**
	 * Human-readable add-on name.
	 *
	 * @return string
	 */
	abstract public function get_name();

	/**
	 * Add-on version string.
	 *
	 * @return string
	 */
	abstract public function get_version();

	/**
	 * Absolute path to the add-on's root directory (with trailing slash).
	 *
	 * @return string
	 */
	abstract public function get_path();

	/**
	 * URL to the add-on's root directory (with trailing slash).
	 *
	 * @return string
	 */
	abstract public function get_url();

	/**
	 * Bootstrap the add-on: register hooks, load files, etc.
	 *
	 * Called only when all dependency checks pass.
	 *
	 * @return void
	 */
	abstract public function boot();

	/**
	 * Return an array of dependency checks.
	 *
	 * Each entry is an associative array:
	 *   'name'      => (string) Human-readable dependency name.
	 *   'check'     => (callable) Returns true when the dependency is satisfied.
	 *   'message'   => (string) Admin notice text when the dependency is missing.
	 *
	 * @return array<int, array{name: string, check: callable, message: string}>
	 */
	public function get_dependencies() {
		return array();
	}

	/**
	 * Check whether all dependencies are satisfied.
	 *
	 * @return bool
	 */
	public function dependencies_met() {
		foreach ( $this->get_dependencies() as $dep ) {
			if ( is_callable( $dep['check'] ) && ! call_user_func( $dep['check'] ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get missing dependency messages.
	 *
	 * @return string[]
	 */
	public function get_missing_dependency_messages() {
		$messages = array();

		foreach ( $this->get_dependencies() as $dep ) {
			if ( is_callable( $dep['check'] ) && ! call_user_func( $dep['check'] ) ) {
				$messages[] = $dep['message'];
			}
		}

		return $messages;
	}

	/**
	 * Minimum required GoDAM version.
	 *
	 * Override in your add-on to enforce a version requirement.
	 *
	 * @return string Semantic version, e.g. '1.7.0'.
	 */
	public function get_minimum_godam_version() {
		return '1.7.0';
	}

	/**
	 * Check if the running GoDAM version satisfies the minimum requirement.
	 *
	 * @return bool
	 */
	public function is_godam_version_compatible() {
		if ( ! defined( 'RTGODAM_VERSION' ) ) {
			return false;
		}
		return version_compare( RTGODAM_VERSION, $this->get_minimum_godam_version(), '>=' );
	}
}
