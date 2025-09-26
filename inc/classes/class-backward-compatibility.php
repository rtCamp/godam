<?php
/**
 * Class to handle Backward Compatibility of settings.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Backward_Compatibility
 *
 * @since n.e.x.t
 */
class Backward_Compatibility {

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
		add_action( 'option_rtgodam-settings', array( $this, 'apply_rtgodam_settings_backward_compatibility' ) );
	}

	/**
	 * Apply backward compatibility for GoDAM settings.
	 *
	 * @param array $settings The current settings array.
	 *
	 * @return array Modified settings with backward compatibility applied.
	 */
	public function apply_rtgodam_settings_backward_compatibility( $settings ) {
		if ( ! is_array( $settings ) ) {
			return $settings;
		}

		$settings = $this->apply_video_ads_backward_compatibility( $settings );

		return $settings;
	}

	/**
	 * Apply backward compatibility for video ads settings.
	 *
	 * This function migrates old ad settings to the new structure if necessary.
	 *
	 * @param array $settings The current settings array.
	 * @return array The updated settings array with backward compatibility applied.
	 */
	private function apply_video_ads_backward_compatibility( $settings ) {
		// If the old ads_settings exist, migrate to global_layers.video_ads if not already set.
		if ( isset( $settings['ads_settings'] ) && is_array( $settings['ads_settings'] ) ) {
			if ( ! isset( $settings['global_layers']['video_ads'] ) || ! is_array( $settings['global_layers']['video_ads'] ) ) {
				$settings['global_layers']['video_ads'] = array();
			}

			if ( ! isset( $settings['global_layers']['video_ads']['enabled'] ) ) {
				$settings['global_layers']['video_ads']['enabled'] = rest_sanitize_boolean( $settings['ads_settings']['enable_global_video_ads'] ?? false );
			}

			if ( ! isset( $settings['global_layers']['video_ads']['adTagUrl'] ) ) {
				$settings['global_layers']['video_ads']['adTagUrl'] = esc_url_raw( $settings['ads_settings']['adTagUrl'] ?? '' );
			}
		}

		return $settings;
	}
}
