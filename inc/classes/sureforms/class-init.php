<?php
/**
 * Extend SureForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Sureforms;

use RTGODAM\Inc\Traits\Singleton;

use RTGODAM\Inc\Sureforms\Assets;
use RTGODAM\Inc\SureForms\Blocks\Register;
use RTGODAM\Inc\Sureforms\Form_Submit;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init.
 */
class Init {

	use Singleton;

	/**
	 * Is SureForms active?
	 *
	 * @access private
	 * @var bool
	 */
	private $is_sureforms_active = false;

	/**
	 * Constructor.
	 */
	protected function __construct() {

		$this->is_sureforms_active = $this->check_sureforms_active();

		/**
		 * Add only if sureforms is active.
		 */
		if ( $this->is_sureforms_active ) {
			$this->load_sureforms_classes();

			$this->setup_hooks();
		}
	}

	/**
	 * Setup hooks.
	 */
	private function setup_hooks() {

		add_action( 'save_post_sureforms_form', array( $this, 'add_godam_identifier_field' ), 10, 3 );
	}

	/**
	 * To check if sureforms plugins is active.
	 *
	 * @return bool
	 */
	private function check_sureforms_active() {

		if ( ! function_exists( 'is_plugin_active' ) ) {
			/**
			 * Required to check for the `is_plugin_active` function.
			 */
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'sureforms/sureforms.php' );
	}

	/**
	 * Function to load the sureforms integration class with GoDAM.
	 *
	 * @return void
	 */
	public function load_sureforms_classes() {

		/**
		 * Register the blocks.
		 */
		Register::get_instance();
		Assets::get_instance();
		Form_Submit::get_instance();
	}

	/**
	 * Add GoDAM identifier field to SureForms post content if missing.
	 *
	 * @param int     $post_id The post ID.
	 * @param WP_Post $post    The post object.
	 */
	public function add_godam_identifier_field( $post_id, $post ) {
		// Bail early if autosave, revision, or invalid post object.
		if (
			( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE )
			|| wp_is_post_revision( $post_id )
			|| ! ( $post instanceof \WP_Post )
		) {
			return;
		}

		$content = $post->post_content;

		// Define block details for checking.
		$block_name  = 'srfm/input';
		$target_slug = 'godam_source';
		$label       = 'GoDAM Source';

		// Parse blocks once.
		$blocks = parse_blocks( $content );

		// Check if block with the target slug exists.
		$block_present = false;
		foreach ( $blocks as $block ) {
			if (
				isset( $block['blockName'], $block['attrs']['slug'] )
				&& $block['blockName'] === $block_name
				&& $block['attrs']['slug'] === $target_slug
			) {
				$block_present = true;
				break;
			}
		}

		// If the block is already present, no need to add it again.
		if ( $block_present ) {
			return;
		}

		// Build the new block comment string with a unique block_id and current post ID.
		$new_block_comment = sprintf(
			'<!-- wp:%s {"block_id":"%s","label":"%s","slug":"%s","formId":%d,"defaultValue":""} /-->',
			$block_name,
			wp_generate_uuid4(),
			$label,
			$target_slug,
			$post_id
		);

		// Append the new block comment to the existing content.
		$new_content = $content . "\n" . $new_block_comment;

		// Update the post content with the new block added.
		wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $new_content,
			)
		);
	}
}
