<?php
/**
 * Extend SureForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\SureForms\Blocks;

use RTGODAM\Inc\Traits\Singleton;

use WP_Block_Editor_Context;
use WP_Block_Type_Registry;

defined( 'ABSPATH' ) || exit;

/**
 * Class Register.
 */
class Register {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for sureforms.
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * Filter to register new block as fields for sureforms.
		 */
		add_filter( 'srfm_register_additional_blocks', array( $this, 'add_additional_blocks' ) );

		/**
		 * Filter to allow the register block.
		 */
		add_filter( 'srfm_allowed_block_types', array( $this, 'allowed_blocks' ) );

		/**
		 * Filter to remove the `fields` blocks from other post types except `sureforms_form`.
		 */
		add_filter( 'allowed_block_types_all', array( $this, 'allowed_blocks_for_post' ), 10, 2 );
	}

	/**
	 * Function to add the additional blocks as fields for SureForms.
	 *
	 * @param array $blocks Blocks to be registered.
	 *
	 * @return array
	 */
	public function add_additional_blocks( $blocks ) {

		$new_blocks = array();

		/**
		 * Add all the blocks.
		 */
		$new_blocks[] = array(
			'dir'       => RTGODAM_PATH . 'inc/classes/sureforms/blocks/**/*.php',
			'namespace' => 'RTGODAM\\Inc\\SureForms\\Blocks',
		);

		/**
		 * Merge the custom and incoming blocks.
		 */
		$blocks = array( ...$blocks, ...$new_blocks );

		return $blocks;
	}

	/**
	 * List of allowed blocks for sureforms edit forms page.
	 *
	 * @param array $allowed_blocks Allowed Blocks.
	 *
	 * @return array
	 */
	public function allowed_blocks( $allowed_blocks ) {
		$new_blocks_to_allow = array(
			'godam/srfm-recorder',
		);

		return array_merge( $allowed_blocks, $new_blocks_to_allow );
	}

	/**
	 * Disallow srfm specific blocks for form fields to other post types
	 *
	 * @param bool|array<string>      $allowed_block_types Array of block types.
	 * @param WP_Block_Editor_Context $editor_context      The current block editor context.
	 *
	 * @return array<mixed>|bool
	 */
	public function allowed_blocks_for_post( $allowed_block_types, $editor_context ) {

		/**
		 * Bail early if context is sureforms post type.
		 */
		if ( ! empty( $editor_context->post->post_type ) && 'sureforms_form' === $editor_context->post->post_type ) {
			return $allowed_block_types;
		}

		// No need to allow `recorder field` from godam, if post type is not sureforms_form.
		$disallowed_blocks = array( 'godam/srfm-recorder' );

		// Get all registered blocks if $allowed_block_types is not already set.
		if ( ! is_array( $allowed_block_types ) || empty( $allowed_block_types ) ) {
			$registered_blocks   = WP_Block_Type_Registry::get_instance()->get_all_registered();
			$allowed_block_types = array_keys( $registered_blocks );
		}

		// Create a new array for the allowed blocks.
		$filtered_blocks = array();

		// Loop through each block in the allowed blocks list.
		foreach ( $allowed_block_types as $block ) {

			// Check if the block is not in the disallowed blocks list.
			if ( ! in_array( $block, $disallowed_blocks, true ) ) {

				// If it's not disallowed, add it to the filtered list.
				$filtered_blocks[] = $block;
			}
		}

		// Return the filtered list of allowed blocks.
		return $filtered_blocks;
	}
}
