<?php
/**
 * Class to handle site HTTP headers.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Headers
 */
class Headers {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'wp_headers', array( $this, 'fix_camera_microphone_permissions' ) );
	}

	/**
	 * Fix camera and microphone permissions for GoDAM video recorder form field.
	 *
	 * @param array $headers The current HTTP headers.
	 *
	 * @return array Modified headers with updated Permissions-Policy.
	 */
	public function fix_camera_microphone_permissions( $headers ) {
		// Only modify headers for frontend pages.
		if ( is_admin() ) {
			return $headers;
		}

		// Get the current policy or start with a blank string.
		$policy = isset( $headers['Permissions-Policy'] ) ? $headers['Permissions-Policy'] : '';

		// Define what we need.
		$requirements = array(
			'camera'     => '(self)',
			'microphone' => '(self)',
		);

		foreach ( $requirements as $feature => $value ) {
			if ( strpos( $policy, $feature ) !== false ) {
				// Feature exists: Update its value to (self).
				$policy = preg_replace(
					'/' . $feature . '=\([^)]*\)/',
					$feature . '=' . $value,
					$policy
				);
			} else {
				// Feature missing: Append it gracefully.
				$separator = ( '' === $policy ) ? '' : ', ';
				$policy   .= $separator . $feature . '=' . $value;
			}
		}

		$headers['Permissions-Policy'] = $policy;
		return $headers;
	}
}
