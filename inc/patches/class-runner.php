<?php
/**
 * Patch runner for plugin updates.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Patches;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Runner
 */
class Runner {
	use Singleton;

	/**
	 * Option key used to persist applied patch IDs.
	 *
	 * @var string
	 */
	const APPLIED_PATCHES_OPTION = 'rtgodam_applied_patches';

	/**
	 * Registered patch instances.
	 *
	 * @var array
	 */
	private $patches = array();

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 */
	final protected function __construct() {
		$this->register_patches();
	}

	/**
	 * Register all versioned patches.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	private function register_patches() {
		$this->patches = array(
			Video_Block_Seo_Override_Id_Normalization::get_instance(),
		);
	}

	/**
	 * Schedule pending patches for current upgrade path.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $saved_version Previously stored plugin version.
	 * @param string $current_version Current plugin version.
	 *
	 * @return void
	 */
	public function maybe_schedule_patches( $saved_version, $current_version ) {
		if ( empty( $saved_version ) || empty( $current_version ) ) {
			return;
		}

		$applied_patch_ids = $this->get_applied_patch_ids();

		foreach ( $this->patches as $patch ) {
			if ( ! $patch instanceof Base_Patch ) {
				continue;
			}

			$patch_id = $patch->get_patch_id();

			if ( in_array( $patch_id, $applied_patch_ids, true ) ) {
				continue;
			}

			$target_version = (string) $patch->get_target_version();
			$target_reached = version_compare( (string) $current_version, $target_version, '>=' );
			$crossed_target = version_compare( (string) $saved_version, $target_version, '<' ) && $target_reached;
			$same_version   = version_compare( (string) $current_version, (string) $saved_version, '=' );
			$backfill_patch = $same_version && version_compare( (string) $saved_version, $target_version, '>=' );

			if ( $crossed_target || $backfill_patch ) {
				$patch->maybe_schedule();
			}
		}
	}

	/**
	 * Return all applied patch IDs.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function get_applied_patch_ids() {
		$applied_patch_ids = get_option( self::APPLIED_PATCHES_OPTION, array() );

		if ( ! is_array( $applied_patch_ids ) ) {
			return array();
		}

		return array_values(
			array_unique(
				array_filter( $applied_patch_ids, 'is_string' )
			)
		);
	}

	/**
	 * Mark patch as applied.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $patch_id Patch identifier.
	 *
	 * @return void
	 */
	public function mark_patch_as_applied( $patch_id ) {
		if ( empty( $patch_id ) || ! is_string( $patch_id ) ) {
			return;
		}

		$applied_patch_ids = $this->get_applied_patch_ids();

		if ( in_array( $patch_id, $applied_patch_ids, true ) ) {
			return;
		}

		$applied_patch_ids[] = $patch_id;

		update_option( self::APPLIED_PATCHES_OPTION, array_values( array_unique( $applied_patch_ids ) ) );
	}
}
